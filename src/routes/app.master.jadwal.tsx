import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useServerFn } from "@tanstack/react-start";
import { bulkUpsertJadwal, upsertJadwalCell, deleteJadwalCell, saveMasterShiftCabang } from "@/lib/admin/users.functions";
import { toast } from "sonner";
import { Loader2, Upload, Download, Clock, Plus, Trash2, FileText, FileSpreadsheet } from "lucide-react";
import ExcelJS from "exceljs";

export const Route = createFileRoute("/app/master/jadwal")({
  ssr: false,
  component: JadwalPage,
});

type StatusHari = "Masuk Kerja" | "LIBUR" | "CUTI";
type ShiftVal = "Shift 1" | "Shift 2";

interface JadwalRow {
  id_jadwal: string;
  tanggal: string;
  id_karyawan: string;
  id_cabang: string | null;
  status_hari: StatusHari;
  shift: ShiftVal | null;
  shifts?: ShiftVal[] | null;
  id_cabang_list?: string[] | null;
  assignments?: { shift: ShiftVal; id_cabang: string }[] | null;
}
interface Karyawan { id_karyawan: string; nik: string; nama_karyawan: string; status_akun: string; role?: string; divisi?: string | null; jabatan?: string | null }
interface Cabang { id_cabang: string; nama_cabang: string }

type ShiftName = "Shift 1" | "Shift 2";
interface ShiftMasterRow {
  id_shift: string;
  id_cabang: string | null;
  nama_shift: string;
  jam_mulai: string;
  jam_selesai: string;
  hari: number[] | null;
}
type ShiftRule = { days: number[]; mulai: string; selesai: string };

const HARI_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const SHIFT_OPTIONS: ShiftVal[] = ["Shift 1", "Shift 2"];
// Pilihan shift di modal Edit Jadwal
const SHIFT_PAIR_OPTIONS: ("Shift 1" | "Shift 2")[] = ["Shift 1", "Shift 2"];
const SHIFT_SHORT: Record<ShiftVal, string> = { "Shift 1": "S1", "Shift 2": "S2" };
function cabangShort(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 3);
  return parts.map((p) => p[0]).join("").slice(0, 4).toUpperCase();
}

function daysInMonth(ym: string): { day: number; dow: number; iso: string }[] {
  const [y, m] = ym.split("-").map(Number);
  const n = new Date(y, m, 0).getDate();
  const out: { day: number; dow: number; iso: string }[] = [];
  for (let d = 1; d <= n; d++) {
    const dt = new Date(y, m - 1, d);
    out.push({
      day: d,
      dow: dt.getDay(),
      iso: `${ym}-${String(d).padStart(2, "0")}`,
    });
  }
  return out;
}

function cellStyle(
  cell: JadwalRow | undefined,
  cabangNameById: Map<string, string>,
  opts?: { isManager?: boolean }
): { cls: string; label: string; title?: string } {
  if (!cell) {
    // Manager: default Full Time hijau bila belum diisi (tanggung jawab 24/7)
    if (opts?.isManager) return { cls: "bg-emerald-600 text-white font-semibold", label: "FT" };
    return { cls: "bg-muted/30 text-muted-foreground hover:bg-muted", label: "—" };
  }
  if (cell.status_hari === "CUTI") return { cls: "bg-red-600 text-white font-semibold", label: "CUTI" };
  if (cell.status_hari === "LIBUR") return { cls: "bg-red-500 text-white font-semibold", label: "OFF" };
  // Masuk Kerja — gabungkan multi-shift & multi-cabang
  const shiftsArr: ShiftVal[] = (cell.shifts && cell.shifts.length > 0)
    ? cell.shifts
    : (cell.shift ? [cell.shift] : []);
  const cabIds: string[] = (cell.id_cabang_list && cell.id_cabang_list.length > 0)
    ? cell.id_cabang_list
    : (cell.id_cabang ? [cell.id_cabang] : []);
  const shiftLabel = shiftsArr.map((s) => SHIFT_SHORT[s] ?? s).join("+") || "ON";
  const cabLabel = cabIds.map((id) => cabangShort(cabangNameById.get(id) ?? "")).filter(Boolean).join("+");
  const cls =
    shiftsArr.length > 1
      ? "bg-purple-600 text-white font-semibold"
      : shiftsArr[0] === "Shift 1"
        ? "bg-blue-500 text-white font-semibold"
        : shiftsArr[0] === "Shift 2"
          ? "bg-orange-500 text-white font-semibold"
          : "bg-emerald-500 text-white font-semibold";
  const fullCabNames = cabIds.map((id) => cabangNameById.get(id) ?? "").filter(Boolean).join(", ");
  return {
    cls,
    label: cabLabel ? `${shiftLabel}\n${cabLabel}` : shiftLabel,
    title: `${shiftsArr.join(", ") || "Masuk"}${fullCabNames ? " — " + fullCabNames : ""}`,
  };
}

function JadwalPage() {
  const { data } = useCurrentUser();
  const bulk = useServerFn(bulkUpsertJadwal);
  const upsertCell = useServerFn(upsertJadwalCell);
  const deleteCell = useServerFn(deleteJadwalCell);

  const [filterMonth, setFilterMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState<JadwalRow[]>([]);
  const [karyawan, setKaryawan] = useState<Karyawan[]>([]);
  const [cabangs, setCabangs] = useState<Cabang[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editCell, setEditCell] = useState<{ k: Karyawan; iso: string; current?: JadwalRow } | null>(null);
  const [formStatus, setFormStatus] = useState<StatusHari>("Masuk Kerja");
  // Pasangan: per-shift simpan id_cabang penempatan. null = shift tsb tidak dipilih.
  const [pairS1, setPairS1] = useState<{ on: boolean; cabang: string }>({ on: true, cabang: "" });
  const [pairS2, setPairS2] = useState<{ on: boolean; cabang: string }>({ on: false, cabang: "" });

  // Filter tabel: jabatan / divisi / cabang (penempatan utama).
  const [filterJabatan, setFilterJabatan] = useState<string>("__all__");
  const [filterDivisi, setFilterDivisi] = useState<string>("__all__");
  const [filterCabang, setFilterCabang] = useState<string>("__all__");
  const [karyawanCabangMap, setKaryawanCabangMap] = useState<Map<string, string[]>>(new Map());

  const days = useMemo(() => daysInMonth(filterMonth), [filterMonth]);

  // index: id_karyawan -> iso -> row
  const grid = useMemo(() => {
    const m = new Map<string, Map<string, JadwalRow>>();
    for (const r of rows) {
      if (!m.has(r.id_karyawan)) m.set(r.id_karyawan, new Map());
      m.get(r.id_karyawan)!.set(r.tanggal, r);
    }
    return m;
  }, [rows]);

  const cabangNameById = useMemo(() => {
    const m = new Map<string, string>();
    cabangs.forEach((c) => m.set(c.id_cabang, c.nama_cabang));
    return m;
  }, [cabangs]);

  const jabatanOptions = useMemo(() => {
    const set = new Set<string>();
    karyawan.forEach((k) => {
      const j = (k.jabatan ?? k.role ?? "").trim();
      if (j) set.add(j);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [karyawan]);
  const divisiOptions = useMemo(() => {
    const set = new Set<string>();
    karyawan.forEach((k) => { const d = (k.divisi ?? "").trim(); if (d) set.add(d); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [karyawan]);

  const filteredKaryawan = useMemo(() => {
    return karyawan.filter((k) => {
      if (filterJabatan !== "__all__") {
        const j = (k.jabatan ?? k.role ?? "").trim();
        if (j !== filterJabatan) return false;
      }
      if (filterDivisi !== "__all__") {
        if ((k.divisi ?? "").trim() !== filterDivisi) return false;
      }
      if (filterCabang !== "__all__") {
        const ids = karyawanCabangMap.get(k.id_karyawan) ?? [];
        if (!ids.includes(filterCabang)) return false;
      }
      return true;
    });
  }, [karyawan, filterJabatan, filterDivisi, filterCabang, karyawanCabangMap]);

  async function reload() {
    setLoading(true);
    setLoadError(null);
    try {
      const start = `${filterMonth}-01`;
      const endDate = new Date(filterMonth + "-01");
      endDate.setMonth(endDate.getMonth() + 1);
      const end = endDate.toISOString().slice(0, 10);
      const [jad, kar, cab, pivot] = await Promise.all([
        supabase.from("jadwal_kerja").select("*").gte("tanggal", start).lt("tanggal", end),
        supabase.from("karyawan").select("id_karyawan,nik,nama_karyawan,status_akun,role,divisi,jabatan").eq("status_akun", "Aktif").order("nama_karyawan", { ascending: true }),
        supabase.from("cabang").select("id_cabang,nama_cabang").order("nama_cabang"),
        supabase.from("karyawan_cabang_pivot").select("id_karyawan,id_cabang"),
      ]);
      if (jad.error || kar.error || cab.error || pivot.error) throw jad.error ?? kar.error ?? cab.error ?? pivot.error;
      setRows((jad.data ?? []) as JadwalRow[]);
      setKaryawan((kar.data ?? []) as Karyawan[]);
      setCabangs((cab.data ?? []) as Cabang[]);
      const m = new Map<string, string[]>();
      for (const p of (pivot.data ?? []) as { id_karyawan: string; id_cabang: string }[]) {
        if (!m.has(p.id_karyawan)) m.set(p.id_karyawan, []);
        m.get(p.id_karyawan)!.push(p.id_cabang);
      }
      setKaryawanCabangMap(m);
    } catch (err: any) {
      const message = "Gagal memuat jadwal, pastikan data karyawan tersedia.";
      setRows([]);
      setKaryawan([]);
      setCabangs([]);
      setLoadError(message);
      toast.error(err?.message ?? message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { reload(); }, [filterMonth]);

  if (!data?.karyawan) return null;
  if (data.karyawan.role !== "Manager") {
    return (
      <AppShell role={data.karyawan.role} nama={data.karyawan.nama_karyawan} nik={data.karyawan.nik}>
        <Card><CardHeader><CardTitle>Akses ditolak</CardTitle></CardHeader></Card>
      </AppShell>
    );
  }

  function openEditor(k: Karyawan, iso: string) {
    const current = grid.get(k.id_karyawan)?.get(iso);
    setEditCell({ k, iso, current });
    setFormStatus(current?.status_hari ?? "Masuk Kerja");
    // Susun pasangan {Shift, Cabang} dari data yang ada.
    const assigns = (current?.assignments && current.assignments.length > 0)
      ? current.assignments
      : (() => {
          // back-compat: bila assignments belum ada, derive dari shifts+id_cabang_list (pakai cabang pertama).
          const sArr = current?.shifts && current.shifts.length > 0
            ? current.shifts
            : current?.shift ? [current.shift] : [];
          const cArr = current?.id_cabang_list && current.id_cabang_list.length > 0
            ? current.id_cabang_list
            : current?.id_cabang ? [current.id_cabang] : [];
          return sArr
            .filter((s) => s === "Shift 1" || s === "Shift 2")
            .map((s) => ({ shift: s as ShiftVal, id_cabang: cArr[0] ?? "" }));
        })();
    const s1 = assigns.find((a) => a.shift === "Shift 1");
    const s2 = assigns.find((a) => a.shift === "Shift 2");
    setPairS1({ on: !!s1, cabang: s1?.id_cabang ?? "" });
    setPairS2({ on: !!s2, cabang: s2?.id_cabang ?? "" });
    if (!s1 && !s2 && (!current || current.status_hari === "Masuk Kerja")) {
      // default: Shift 1 menyala agar UI tidak kosong total.
      setPairS1({ on: true, cabang: "" });
    }
  }

  async function saveCell() {
    if (!editCell) return;
    setBusy(true);
    try {
      let assignments: { shift: ShiftVal; id_cabang: string }[] = [];
      if (formStatus === "Masuk Kerja") {
        if (pairS1.on) {
          if (!pairS1.cabang) throw new Error("Pilih cabang untuk Shift 1.");
          assignments.push({ shift: "Shift 1", id_cabang: pairS1.cabang });
        }
        if (pairS2.on) {
          if (!pairS2.cabang) throw new Error("Pilih cabang untuk Shift 2.");
          assignments.push({ shift: "Shift 2", id_cabang: pairS2.cabang });
        }
        if (assignments.length === 0) throw new Error("Centang minimal Shift 1 atau Shift 2.");
      }
      const shifts = assignments.map((a) => a.shift);
      const cabangList = Array.from(new Set(assignments.map((a) => a.id_cabang)));
      await upsertCell({
        data: {
          tanggal: editCell.iso,
          id_karyawan: editCell.k.id_karyawan,
          status_hari: formStatus,
          id_cabang: formStatus === "Masuk Kerja" ? (cabangList[0] ?? null) : null,
          shift: formStatus === "Masuk Kerja" ? (shifts[0] ?? null) : null,
          shifts: formStatus === "Masuk Kerja" ? shifts : [],
          id_cabang_list: formStatus === "Masuk Kerja" ? cabangList : [],
          assignments: formStatus === "Masuk Kerja" ? assignments : [],
        },
      });
      toast.success("Jadwal tersimpan");
      setEditCell(null);
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  }

  async function clearCell() {
    if (!editCell?.current) { setEditCell(null); return; }
    setBusy(true);
    try {
      await deleteCell({ data: { tanggal: editCell.iso, id_karyawan: editCell.k.id_karyawan } });
      toast.success("Jadwal dihapus");
      setEditCell(null);
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal hapus");
    } finally {
      setBusy(false);
    }
  }

  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith(".xlsx")) {
        throw new Error("Gunakan file .xlsx dari tombol Download Template Excel.");
      }
      const buf = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      const ws = wb.worksheets[0];
      if (!ws) throw new Error("Workbook kosong.");
      const headerRow = ws.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
        headers[col - 1] = String(cell.value ?? "").trim();
      });
      const idxNik = headers.findIndex((h) => /^nik$/i.test(h));
      if (idxNik < 0) throw new Error("Header 'NIK' tidak ditemukan.");

      // Cari kolom Penempatan Cabang
      const idxCabang = headers.findIndex((h) => /penempatan/i.test(h) || /cabang/i.test(h));

      // kolom tanggal = header berupa angka 1..31
      const dayCols: { col: number; day: number }[] = [];
      headers.forEach((h, i) => {
        const n = parseInt(String(h).match(/\d+/)?.[0] ?? "", 10);
        if (!isNaN(n) && n >= 1 && n <= 31) dayCols.push({ col: i + 1, day: n });
      });
      if (dayCols.length === 0) throw new Error("Tidak ada kolom tanggal pada header.");

      const { data: karList } = await supabase.from("karyawan").select("id_karyawan,nik");
      const nikMap = new Map((karList ?? []).map((k: any) => [String(k.nik), k.id_karyawan]));

      // Buat map nama cabang → id_cabang
      const cabangNameMap = new Map(cabangs.map((c) => [c.nama_cabang.toLowerCase().trim(), c.id_cabang]));

      const parsed: any[] = [];
      const mapVal = (raw: string): { status_hari: StatusHari; shift: ShiftVal | null } | null => {
        const v = raw.trim().toUpperCase();
        if (!v) return null;
        if (v === "OFF" || v === "LIBUR") return { status_hari: "LIBUR", shift: null };
        if (v === "CUTI") return { status_hari: "CUTI", shift: null };
        if (v === "SHIFT 1" || v === "S1") return { status_hari: "Masuk Kerja", shift: "Shift 1" };
        if (v === "SHIFT 2" || v === "S2") return { status_hari: "Masuk Kerja", shift: "Shift 2" };
        return null;
      };

      // Kumpulkan semua NIK yang ada di file — untuk hapus jadwal yang kosong
      const nikDiFile = new Set<string>();

      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const nik = String(row.getCell(idxNik + 1).value ?? "").trim();
        if (!nik) continue;
        const idKar = nikMap.get(nik);
        if (!idKar) continue;
        nikDiFile.add(idKar);

        // Baca cabang dari kolom Penempatan Cabang
        let idCabang: string | null = null;
        if (idxCabang >= 0) {
          const cabangVal = String(row.getCell(idxCabang + 1).value ?? "").trim().toLowerCase();
          idCabang = cabangNameMap.get(cabangVal) ?? null;
        }

        for (const { col, day } of dayCols) {
          const val = String(row.getCell(col).value ?? "").trim();
          const m = mapVal(val);
          const tanggal = `${filterMonth}-${String(day).padStart(2, "0")}`;
          if (!m) {
            // Sel kosong → hapus jadwal hari itu untuk karyawan ini
            await supabase
              .from("jadwal_kerja")
              .delete()
              .eq("id_karyawan", idKar)
              .eq("tanggal", tanggal);
            continue;
          }
          parsed.push({
            tanggal,
            id_karyawan: idKar,
            id_cabang: idCabang,
            status_hari: m.status_hari,
            shift: m.shift,
          });
        }
      }
      if (parsed.length === 0 && nikDiFile.size === 0) throw new Error("Tidak ada baris valid pada file Excel.");
      if (parsed.length > 0) {
        await bulk({ data: { rows: parsed } });
      }
      toast.success(`Upload selesai: ${parsed.length} baris jadwal diperbarui`);
      reload();
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function downloadTemplate() {
    const tid = toast.loading("Menyiapkan template Excel…");
    setBusy(true);
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(`Jadwal ${filterMonth}`);
      const headers = ["NIK", "Nama Karyawan", "Divisi", "Jabatan", "Penempatan Cabang", ...days.map((d) => `${HARI_SHORT[d.dow]} ${d.day}`)];
      ws.addRow(headers);
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(1).eachCell((c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
        c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      });
      ws.getColumn(1).width = 14;
      ws.getColumn(2).width = 26;
      ws.getColumn(3).width = 14;
      ws.getColumn(4).width = 14;
      ws.getColumn(5).width = 22; // Penempatan Cabang
      for (let i = 0; i < days.length; i++) ws.getColumn(6 + i).width = 10;

      // Buat list nama cabang untuk dropdown
      const cabangNames = cabangs.map((c) => c.nama_cabang).join(",");

      const list = filteredKaryawan.length > 0 ? filteredKaryawan : karyawan;
      list.forEach((k) => {
        // Ambil cabang default karyawan (cabang pertama dari pivot)
        const defaultCabangId = karyawanCabangMap?.get(k.id_karyawan)?.[0] ?? null;
        const defaultCabangName = defaultCabangId ? (cabangs.find(c => c.id_cabang === defaultCabangId)?.nama_cabang ?? "") : "";
        const cells = days.map((d) => {
          const cur = grid.get(k.id_karyawan)?.get(d.iso);
          if (!cur) return "";
          if (cur.status_hari === "CUTI") return "CUTI";
          if (cur.status_hari === "LIBUR") return "OFF";
          const sArr = (cur.shifts && cur.shifts.length > 0) ? cur.shifts : (cur.shift ? [cur.shift] : []);
          return (sArr[0] as string) ?? "";
        });
        ws.addRow([k.nik, k.nama_karyawan, k.divisi ?? "", k.jabatan ?? k.role ?? "", defaultCabangName, ...cells]);
      });

      // Data validation: dropdown cabang di kolom 5
      const lastRow = Math.max(ws.rowCount, 200);
      for (let r = 2; r <= lastRow; r++) {
        ws.getCell(r, 5).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`"${cabangNames}"`],
          showErrorMessage: true,
          errorTitle: "Cabang tidak valid",
          error: "Pilih cabang dari daftar.",
        };
      }
      // Data validation: dropdown shift di kolom 6+
      for (let col = 6; col < 6 + days.length; col++) {
        for (let r = 2; r <= lastRow; r++) {
          ws.getCell(r, col).dataValidation = {
            type: "list",
            allowBlank: true,
            formulae: ['"Shift 1,Shift 2,OFF,CUTI"'],
            showErrorMessage: true,
            errorTitle: "Nilai tidak valid",
            error: "Pilih salah satu: Shift 1, Shift 2, OFF, atau CUTI.",
          };
        }
      }
      ws.views = [{ state: "frozen", xSplit: 5, ySplit: 1 }];
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `template-jadwal-${filterMonth}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Template Excel ter-unduh (.xlsx)", { id: tid });
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal membuat template Excel", { id: tid });
    } finally {
      setBusy(false);
    }
  }

  function buildMatrixRows() {
    return karyawan.map((k) => {
      const cells = days.map((d) => {
        const cur = grid.get(k.id_karyawan)?.get(d.iso);
        if (!cur) return "";
        if (cur.status_hari === "CUTI") return "CUTI";
        if (cur.status_hari === "LIBUR") return "OFF";
        const sArr = (cur.shifts && cur.shifts.length > 0) ? cur.shifts : (cur.shift ? [cur.shift] : []);
        const cArr = (cur.id_cabang_list && cur.id_cabang_list.length > 0)
          ? cur.id_cabang_list
          : (cur.id_cabang ? [cur.id_cabang] : []);
        const sLabel = sArr.map((s) => SHIFT_SHORT[s as ShiftVal] ?? s).join("+");
        const cLabel = cArr.map((id) => cabangNameById.get(id) ?? "").filter(Boolean).join(", ");
        return cLabel ? `${sLabel} — ${cLabel}` : sLabel || "ON";
      });
      return { k, cells };
    });
  }

  async function exportExcel() {
    const tid = toast.loading("Menyiapkan file Excel…");
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(`Jadwal ${filterMonth}`);
      const headers = ["NIK", "Nama Karyawan", "Divisi", "Jabatan", ...days.map((d) => `${HARI_SHORT[d.dow]} ${d.day}`)];
      ws.addRow(headers);
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(1).eachCell((c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
        c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      });
      ws.getColumn(1).width = 14;
      ws.getColumn(2).width = 26;
      ws.getColumn(3).width = 14;
      ws.getColumn(4).width = 14;
      for (let i = 0; i < days.length; i++) ws.getColumn(5 + i).width = 10;
      const rows = buildMatrixRows();
      rows.forEach(({ k, cells }) => {
        const simplified = cells.map((c) => {
          if (!c) return "";
          if (c === "CUTI") return "CUTI";
          if (c === "OFF") return "OFF";
          if (/S1/.test(c) && /S2/.test(c)) return "Shift 1";
          if (/S1/.test(c)) return "Shift 1";
          if (/S2/.test(c)) return "Shift 2";
          return "";
        });
        ws.addRow([k.nik, k.nama_karyawan, k.divisi ?? "", k.jabatan ?? k.role ?? "", ...simplified]);
      });
      const lastRow = Math.max(ws.rowCount, 200);
      for (let col = 5; col < 5 + days.length; col++) {
        for (let r = 2; r <= lastRow; r++) {
          ws.getCell(r, col).dataValidation = {
            type: "list",
            allowBlank: true,
            formulae: ['"Shift 1,Shift 2,OFF,CUTI"'],
            showErrorMessage: true,
            errorTitle: "Nilai tidak valid",
            error: "Pilih salah satu: Shift 1, Shift 2, OFF, atau CUTI.",
          };
        }
      }
      ws.views = [{ state: "frozen", xSplit: 4, ySplit: 1 }];
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `laporan-jadwal-${filterMonth}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Excel ter-export (.xlsx)", { id: tid });
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal export Excel", { id: tid });
    }
  }

  function exportPDF() {
    try {
      toast.info("Membuka dialog cetak PDF... Pastikan memilih opsi Landscape dan ukuran kertas besar.");
      setTimeout(() => { window.print(); }, 300);
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal export PDF");
    }
  }

  return (
    <AppShell role={data.karyawan.role} nama={data.karyawan.nama_karyawan} nik={data.karyawan.nik}>
        <div className="space-y-4 jadwal-screen-root">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Matriks Jadwal Bulanan</h1>
            <p className="text-sm text-muted-foreground">Klik sel mana saja untuk mengubah status hari & penempatan cabang.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="bulan" className="text-xs">Bulan & Tahun</Label>
              <Input id="bulan" type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-44" />
            </div>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" /> Download Template Excel
            </Button>
            <Button variant="outline" onClick={exportPDF}>
              <FileText className="mr-2 h-4 w-4" /> Download PDF
            </Button>
            <Button variant="outline" onClick={exportExcel}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Download Excel
            </Button>
            <ShiftMasterButton cabangs={cabangs} />
            <Label className="inline-flex">
              <input type="file" accept=".xlsx" className="hidden" onChange={handleExcelUpload} disabled={busy} />
              <span className="inline-flex h-9 cursor-pointer items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Upload Excel
              </span>
            </Label>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-blue-500" /> Shift 1</span>
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-orange-500" /> Shift 2</span>
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-red-500" /> OFF</span>
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-red-600" /> CUTI</span>
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-muted" /> Belum diatur</span>
        </div>

        {/* Filter baris karyawan */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">Filter Jabatan</Label>
            <Select value={filterJabatan} onValueChange={setFilterJabatan}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Semua Jabatan</SelectItem>
                {jabatanOptions.map((j) => (<SelectItem key={j} value={j}>{j}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Filter Divisi</Label>
            <Select value={filterDivisi} onValueChange={setFilterDivisi}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Semua Divisi</SelectItem>
                {divisiOptions.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Filter Cabang (penempatan)</Label>
            <Select value={filterCabang} onValueChange={setFilterCabang}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Semua Cabang</SelectItem>
                {cabangs.map((c) => (<SelectItem key={c.id_cabang} value={c.id_cabang}>{c.nama_cabang}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="jadwal-print-area">
          <CardContent className="p-0">
            <div className="hidden jadwal-print-title px-3 pb-3 text-center">
              <h2 className="text-base font-bold">LAPORAN JADWAL KERJA BULANAN - TOKOVAPEKU HRIS</h2>
              <p className="text-xs text-muted-foreground">Periode: {filterMonth}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="jadwal-matrix-table border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-background">
                  <tr>
                    <th className="sticky left-0 z-20 bg-background border-b border-r px-3 py-2 text-left font-semibold min-w-[200px]">
                      Karyawan
                    </th>
                    {days.map((d) => {
                      const weekend = d.dow === 0 || d.dow === 6;
                      return (
                        <th
                          key={d.iso}
                          className={`border-b border-r px-1 py-1 text-center font-medium min-w-[40px] ${weekend ? "bg-red-50 text-red-700" : "text-muted-foreground"}`}
                        >
                          <div className="text-[10px] leading-none">{HARI_SHORT[d.dow]}</div>
                          <div className="text-sm font-bold leading-tight">{d.day}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filteredKaryawan.map((k) => (
                    <tr key={k.id_karyawan} className="hover:bg-muted/20">
                      <td className="sticky left-0 z-10 bg-background border-b border-r px-3 py-2 min-w-[200px]">
                        <div className="font-medium truncate max-w-[200px]">{k.nama_karyawan}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{k.nik}</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                          {(k.divisi || "—") + " • " + (k.jabatan || k.role || "—")}
                        </div>
                      </td>
                      {days.map((d) => {
                        const cell = grid.get(k.id_karyawan)?.get(d.iso);
                        const s = cellStyle(cell, cabangNameById, { isManager: k.role === "Manager" });
                        return (
                          <td key={d.iso} className="border-b border-r p-0.5">
                            <button
                              type="button"
                              onClick={() => openEditor(k, d.iso)}
                              title={s.title ?? ""}
                              className={`h-12 w-full min-w-[56px] whitespace-pre-line rounded px-0.5 text-[9px] leading-tight transition-colors ${s.cls}`}
                            >
                              {s.label}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {filteredKaryawan.length === 0 && (
                    <tr><td colSpan={days.length + 1} className="text-center py-8 text-muted-foreground">
                      {loading ? "Memuat..." : loadError ?? (karyawan.length === 0 ? "Belum ada karyawan aktif." : "Tidak ada karyawan yang cocok dengan filter.")}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={!!editCell} onOpenChange={(o) => !o && setEditCell(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Edit Jadwal</DialogTitle>
            </DialogHeader>
            {editCell && (
              <div className="space-y-3 text-sm">
                <div className="rounded-md bg-muted/40 px-3 py-2">
                  <div className="font-medium">{editCell.k.nama_karyawan}</div>
                  <div className="text-xs text-muted-foreground font-mono">{editCell.k.nik} • {editCell.iso}</div>
                </div>
                <div className="space-y-1.5">
                  <Label>Status Hari</Label>
                  <Select value={formStatus} onValueChange={(v) => setFormStatus(v as StatusHari)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Masuk Kerja">Masuk Kerja</SelectItem>
                      <SelectItem value="LIBUR">OFF / Libur</SelectItem>
                      <SelectItem value="CUTI">CUTI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formStatus === "Masuk Kerja" && (
                  <>
                    <div className="space-y-2">
                      <Label>Pasangan Shift &amp; Cabang (centang untuk BKO silang)</Label>
                      {([
                        { key: "Shift 1" as const, pair: pairS1, setter: setPairS1, dot: "bg-blue-500" },
                        { key: "Shift 2" as const, pair: pairS2, setter: setPairS2, dot: "bg-orange-500" },
                      ]).map(({ key, pair, setter, dot }) => (
                        <div
                          key={key}
                          className={`rounded-md border p-2.5 transition ${pair.on ? "border-primary bg-primary/5" : "border-input bg-background"}`}
                        >
                          <label className="flex cursor-pointer items-center gap-2">
                            <Checkbox
                              checked={pair.on}
                              onCheckedChange={(v) => setter({ ...pair, on: !!v })}
                            />
                            <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} />
                            <span className="text-sm font-semibold">{key}</span>
                          </label>
                          {pair.on && (
                            <div className="mt-2 pl-7">
                              <Select
                                value={pair.cabang || undefined}
                                onValueChange={(v) => setter({ ...pair, cabang: v })}
                              >
                                <SelectTrigger className="h-10">
                                  <SelectValue placeholder="Pilih cabang penempatan…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {cabangs.length === 0 && (
                                    <SelectItem value="__none__" disabled>Belum ada cabang</SelectItem>
                                  )}
                                  {cabangs.map((c) => (
                                    <SelectItem key={c.id_cabang} value={c.id_cabang}>
                                      {c.nama_cabang}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      ))}
                      <p className="text-[11px] text-muted-foreground">
                        Contoh BKO: centang Shift 1 → Sunter, dan Shift 2 → Bandung di hari yang sama.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
            <DialogFooter className="gap-2">
              {editCell?.current && (
                <Button variant="outline" onClick={clearCell} disabled={busy}>Hapus</Button>
              )}
              <Button onClick={saveCell} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

const SHIFT_DEFS: { name: ShiftName; def: { mulai: string; selesai: string } }[] = [
  { name: "Shift 1", def: { mulai: "09:00", selesai: "15:30" } },
  { name: "Shift 2", def: { mulai: "15:30", selesai: "22:00" } },
];

function ShiftMasterButton({ cabangs }: { cabangs: Cabang[] }) {
  const saveMasterShift = useServerFn(saveMasterShiftCabang);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<string>("__global__");
  const [rows, setRows] = useState<ShiftMasterRow[]>([]);
  const [vals, setVals] = useState<Record<ShiftName, ShiftRule[]>>({
    "Shift 1": [{ days: ALL_DAYS, mulai: "09:00", selesai: "15:30" }],
    "Shift 2": [{ days: ALL_DAYS, mulai: "15:30", selesai: "22:00" }],
  });
  const [busy, setBusy] = useState(false);

  async function loadAll() {
    const { data, error } = await supabase
      .from("master_shift_cabang")
      .select("*")
      .order("nama_shift", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[Master Shift Cabang] gagal memuat", error);
      toast.error(error.message);
      return;
    }
    setRows((data ?? []) as ShiftMasterRow[]);
  }
  useEffect(() => { if (open) loadAll(); }, [open]);

  useEffect(() => {
    const next = { ...vals } as Record<ShiftName, ShiftRule[]>;
    for (const sd of SHIFT_DEFS) {
      const found = rows.filter(r =>
        r.nama_shift === sd.name &&
        (scope === "__global__" ? r.id_cabang === null : r.id_cabang === scope)
      );
      next[sd.name] = found.length > 0
        ? found.map(r => ({
            days: Array.isArray(r.hari) && r.hari.length > 0 ? r.hari : ALL_DAYS,
            mulai: r.jam_mulai.slice(0, 5),
            selesai: r.jam_selesai.slice(0, 5),
          }))
        : [{ days: ALL_DAYS, mulai: sd.def.mulai, selesai: sd.def.selesai }];
    }
    setVals(next);
  }, [scope, rows]);

  function updateRule(name: ShiftName, idx: number, patch: Partial<ShiftRule>) {
    setVals(prev => ({
      ...prev,
      [name]: prev[name].map((rule, i) => i === idx ? { ...rule, ...patch } : rule),
    }));
  }

  function toggleDay(name: ShiftName, idx: number, day: number) {
    setVals(prev => ({
      ...prev,
      [name]: prev[name].map((rule, i) => {
        if (i !== idx) return rule;
        const has = rule.days.includes(day);
        return { ...rule, days: has ? rule.days.filter(d => d !== day) : [...rule.days, day].sort((a, b) => a - b) };
      }),
    }));
  }

  function addRule(name: ShiftName) {
    const fallback = SHIFT_DEFS.find(sd => sd.name === name)?.def ?? { mulai: "09:00", selesai: "22:00" };
    setVals(prev => ({ ...prev, [name]: [...prev[name], { days: [], mulai: fallback.mulai, selesai: fallback.selesai }] }));
  }

  function removeRule(name: ShiftName, idx: number) {
    setVals(prev => ({ ...prev, [name]: prev[name].filter((_, i) => i !== idx) }));
  }

  function cleanRules(name: ShiftName) {
    const used = new Set<number>();
    return vals[name]
      .map(rule => ({
        days: Array.from(new Set(rule.days)).filter(d => d >= 0 && d <= 6).sort((a, b) => a - b),
        mulai: (rule.mulai || "09:00").slice(0, 5),
        selesai: (rule.selesai || "22:00").slice(0, 5),
      }))
      .filter(rule => rule.days.length > 0 && rule.mulai && rule.selesai)
      .map(rule => {
        for (const day of rule.days) {
          if (used.has(day)) throw new Error(`${name}: hari ${HARI_SHORT[day]} dipakai di lebih dari satu aturan.`);
          used.add(day);
        }
        return rule;
      });
  }

  async function save() {
    setBusy(true);
    try {
      const id_cabang = scope === "__global__" ? null : scope;
      const payloadPreview: Record<ShiftName, ShiftRule[]> = {
        "Shift 1": cleanRules("Shift 1"),
        "Shift 2": cleanRules("Shift 2"),
      };
      for (const sd of SHIFT_DEFS) {
        const rules = payloadPreview[sd.name];
        if (rules.length === 0) throw new Error(`${sd.name}: minimal pilih satu hari operasional.`);
      }
      const payload = { id_cabang, shifts_json: JSON.stringify(payloadPreview) };
      console.log("[Master Shift Cabang] payload simpan", { scope, payload });
      const result = await saveMasterShift({ data: payload });
      console.log("[Master Shift Cabang] hasil simpan", result);
      toast.success("Data berhasil disimpan!");
      await loadAll();
    } catch (e) {
      console.error("[Master Shift Cabang] gagal simpan", e);
      toast.error("Gagal menyimpan: " + (e instanceof Error ? e.message : "Gagal menyimpan"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Clock className="mr-2 h-4 w-4" /> Atur Master Shift Cabang
      </Button>
      <DialogContent className="max-h-[80vh] max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="px-6 pb-3 pt-6">
          <DialogTitle>Master Shift Cabang</DialogTitle>
        </DialogHeader>
        <div className="max-h-[calc(80vh-8rem)] space-y-4 overflow-y-auto px-6 pb-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Berlaku untuk</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__global__">Semua Cabang (Global Default)</SelectItem>
                {cabangs.map(c => (
                  <SelectItem key={c.id_cabang} value={c.id_cabang}>{c.nama_cabang}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {SHIFT_DEFS.map(sd => (
            <div key={sd.name} className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{sd.name}</p>
                <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => addRule(sd.name)}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Aturan
                </Button>
              </div>
              {vals[sd.name].map((rule, idx) => (
                <div key={`${sd.name}-${idx}`} className="space-y-2 rounded-md bg-background/60 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-muted-foreground">Aturan #{idx + 1}</p>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeRule(sd.name, idx)} disabled={vals[sd.name].length === 1}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {HARI_SHORT.map((label, day) => {
                      const active = rule.days.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(sd.name, idx, day)}
                          className={`grid h-8 w-8 place-items-center rounded-full text-[11px] font-bold transition ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
                        >
                          {label.slice(0, 1)}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Mulai</Label>
                      <Input type="time" className="h-10" value={rule.mulai} onChange={e => updateRule(sd.name, idx, { mulai: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Selesai</Label>
                      <Input type="time" className="h-10" value={rule.selesai} onChange={e => updateRule(sd.name, idx, { selesai: e.target.value })} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}

          <p className="text-[11px] text-muted-foreground">
            Template "Global" dipakai bila cabang tertentu belum punya pengaturan sendiri.
          </p>
        </div>
        <DialogFooter className="sticky bottom-0 border-t bg-background px-6 py-4">
          <Button variant="outline" onClick={() => setOpen(false)}>Tutup</Button>
          <Button type="button" onClick={save} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}