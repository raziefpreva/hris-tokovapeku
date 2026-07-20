import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pencil, AlertCircle, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/master/sop")({
  ssr: false,
  component: SopPage,
});

type Kategori = "OPENING" | "BERJALAN_TOKO" | "CLOSING";

interface Sop {
  id_sop: string;
  nama_sop: string;
  deskripsi: string | null;
  target_role: "Manager" | "Captain" | "Vaporista";
  batas_jam_upload: string;
  bobot_poin: number;
  tipe_shift: "Shift 1" | "Shift 2" | "Full Time";
  aktif: boolean;
  kategori: Kategori;
  tipe_shifts?: string[] | null;
  hari_berlaku?: number[] | null;
  target_karyawan_id?: string | null;
}

interface Cabang { id_cabang: string; nama_cabang: string }
interface PivotRow {
  id_sop: string;
  id_cabang: string;
  bobot_poin: number;
  poin_sukses: number;
  poin_telat: number;
  poin_tidak_dilakukan: number;
}
interface CabangPoinEntry {
  poin_sukses: number;
  poin_telat: number;
  poin_tidak_dilakukan: number;
}
interface KaryawanLite { id_karyawan: string; nama_karyawan: string; nik: string }
interface AssigneeRow { id_sop: string; id_cabang: string; id_karyawan: string | null; sumber: "jadwal" | "manual" }
type FlowAcc = "Captain" | "Manager"

const KATEGORI_TABS: { value: Kategori; label: string; icon: string }[] = [
  { value: "OPENING", label: "OPENING", icon: "⏰" },
  { value: "BERJALAN_TOKO", label: "BERJALAN TOKO", icon: "⚙️" },
  { value: "CLOSING", label: "CLOSING", icon: "🔒" },
];

const HARI_LABEL = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const SHIFT_CHOICES: ("Shift 1" | "Shift 2")[] = ["Shift 1", "Shift 2"];

function SopPage() {
  const { data } = useCurrentUser();
  const [list, setList] = useState<Sop[]>([]);
  const [cabang, setCabang] = useState<Cabang[]>([]);
  const [pivots, setPivots] = useState<PivotRow[]>([]);
  const [karyawanList, setKaryawanList] = useState<KaryawanLite[]>([]);
  const [assignees, setAssignees] = useState<AssigneeRow[]>([]);
  const [jadwalResults, setJadwalResults] = useState<KaryawanLite[]>([]);
  const [loadingJadwal, setLoadingJadwal] = useState(false);
  const [selectedCabang, setSelectedCabang] = useState<string>("");
  const [tab, setTab] = useState<Kategori>("OPENING");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const emptyForm = {
    nama_sop: "",
    deskripsi: "",
    target_role: "Vaporista" as Sop["target_role"],
    batas_jam_upload: "10:00",
    tipe_shifts: ["Shift 1"] as ("Shift 1" | "Shift 2")[],
    hari_berlaku: [...ALL_DAYS] as number[],
    is_personal: false,
    target_karyawan_id: "" as string,
    deadline_tanggal: "" as string,
    bobot_poin_personal: 10 as number,
    kategori: "OPENING" as Kategori,
    /** map id_cabang -> entry poin, key ada = cabang dicentang */
    cabang_points: {} as Record<string, CabangPoinEntry>,
    // Setting assignee & flow ACC
    restrict_assignee: false,
    assignee_sumber: "manual" as "jadwal" | "manual",
    assignee_ids: [] as string[],
    flow_acc: "Captain" as FlowAcc,
    // Filter jadwal shift
    jadwal_tanggal_dari: "" as string,
    jadwal_tanggal_sampai: "" as string,
    jadwal_shift: "" as string,
    jadwal_id_cabang: "" as string,
  };
  const [form, setForm] = useState(emptyForm);

  async function reload() {
    const [{ data: l }, { data: c }, { data: p }, { data: kar }, { data: asgn }] = await Promise.all([
      supabase.from("master_ceklist_sop").select("*").order("nama_sop"),
      supabase.from("cabang").select("id_cabang,nama_cabang").eq("aktif", true).order("nama_cabang"),
      supabase.from("sop_cabang_pivot").select("id_sop,id_cabang,bobot_poin,poin_sukses,poin_telat,poin_tidak_dilakukan"),
      supabase.from("karyawan").select("id_karyawan,nama_karyawan,nik").eq("status_akun", "Aktif").order("nama_karyawan"),
      supabase.from("sop_assignee").select("id_sop,id_cabang,id_karyawan,sumber"),
    ]);
    setList((l ?? []) as Sop[]);
    setCabang((c ?? []) as Cabang[]);
    setPivots((p ?? []) as PivotRow[]);
    setKaryawanList((kar ?? []) as KaryawanLite[]);
    setAssignees((asgn ?? []) as AssigneeRow[]);
  }
  useEffect(() => { reload(); }, []);

  // Hooks WAJIB dipanggil sebelum early-return — taruh useMemo di atas
  const filteredSops = useMemo(() => {
    if (!selectedCabang) return [] as (Sop & { poinCabang: number })[];
    const sopIds = new Set(pivots.filter((p) => p.id_cabang === selectedCabang).map((p) => p.id_sop));
    return list
      .filter((s) => s.kategori === tab && sopIds.has(s.id_sop))
      .map((s) => {
        const p = pivots.find((x) => x.id_sop === s.id_sop && x.id_cabang === selectedCabang);
        return { ...s, poinCabang: p?.bobot_poin ?? 0 };
      });
  }, [list, pivots, selectedCabang, tab]);

  const totalPoinCabang = useMemo(() => {
    if (!selectedCabang) return 0;
    const activeIds = new Set(list.filter((s) => s.aktif).map((s) => s.id_sop));
    return pivots
      .filter((p) => p.id_cabang === selectedCabang && activeIds.has(p.id_sop))
      .reduce((acc, p) => acc + p.bobot_poin, 0);
  }, [pivots, selectedCabang, list]);

  if (!data?.karyawan) return null;
  if (data.karyawan.role !== "Manager") {
    return (
      <AppShell role={data.karyawan.role} nama={data.karyawan.nama_karyawan} nik={data.karyawan.nik}>
        <Card><CardHeader><CardTitle>Akses ditolak</CardTitle></CardHeader></Card>
      </AppShell>
    );
  }

  function openCreate() {
    setEditId(null);
    setForm({ ...emptyForm, kategori: tab });
    setJadwalResults([]);
    setOpen(true);
  }

  function openEdit(s: Sop) {
    setEditId(s.id_sop);
    const cp: Record<string, CabangPoinEntry> = {};
    pivots.filter((p) => p.id_sop === s.id_sop).forEach((p) => {
      cp[p.id_cabang] = {
        poin_sukses: p.poin_sukses ?? 3,
        poin_telat: p.poin_telat ?? 2,
        poin_tidak_dilakukan: p.poin_tidak_dilakukan ?? -6,
      };
    });
    const shiftsArr = (Array.isArray(s.tipe_shifts) && s.tipe_shifts.length > 0
      ? s.tipe_shifts
      : (s.tipe_shift ? [s.tipe_shift] : ["Shift 1"])
    ).filter((x) => x === "Shift 1" || x === "Shift 2") as ("Shift 1" | "Shift 2")[];
    setForm({
      nama_sop: s.nama_sop,
      deskripsi: s.deskripsi ?? "",
      target_role: s.target_role,
      batas_jam_upload: s.batas_jam_upload?.slice(0, 5) ?? "10:00",
      tipe_shifts: shiftsArr.length ? shiftsArr : ["Shift 1"],
      hari_berlaku: Array.isArray(s.hari_berlaku) && s.hari_berlaku.length > 0 ? s.hari_berlaku : [...ALL_DAYS],
      is_personal: !!s.target_karyawan_id,
      target_karyawan_id: s.target_karyawan_id ?? "",
      deadline_tanggal: (s as any).deadline_tanggal ?? "",
      bobot_poin_personal: s.target_karyawan_id ? (s.bobot_poin ?? 10) : 10,
      kategori: s.kategori,
      cabang_points: cp,
      restrict_assignee: (s as any).restrict_assignee ?? false,
      assignee_sumber: "manual" as "jadwal" | "manual",
      assignee_ids: assignees.filter(a => a.id_sop === s.id_sop).map(a => a.id_karyawan).filter(Boolean) as string[],
      flow_acc: ((s as any).flow_acc ?? "Captain") as FlowAcc,
      jadwal_tanggal_dari: "",
      jadwal_tanggal_sampai: "",
      jadwal_shift: "",
      jadwal_id_cabang: "",
    });
    setJadwalResults([]);
    setOpen(true);
  }

  async function save() {
    if (!form.nama_sop.trim()) return toast.error("Nama SOP wajib diisi");
    if (form.is_personal) {
      if (!form.target_karyawan_id) return toast.error("Pilih karyawan untuk tugas khusus.");
      if (!form.deadline_tanggal) return toast.error("Tentukan tanggal deadline tugas pribadi.");
      if (!(form.bobot_poin_personal > 0)) return toast.error("Bobot poin tugas pribadi harus > 0.");
    } else {
      if (form.tipe_shifts.length === 0) return toast.error("Centang minimal satu Shift.");
      if (form.hari_berlaku.length === 0) return toast.error("Pilih minimal satu hari kerja berlaku.");
    }
    const cabangIds = form.is_personal ? [] : Object.keys(form.cabang_points);
    if (!form.is_personal && cabangIds.length === 0) return toast.error("Pilih minimal satu cabang.");
    setBusy(true);
    try {
      // bobot_poin di master = nilai pertama (legacy). Sumber kebenaran: pivot.
      const firstEntry = form.is_personal ? null : form.cabang_points[cabangIds[0]];
      const firstPoin = form.is_personal
        ? Number(form.bobot_poin_personal) || 10
        : (firstEntry?.poin_sukses ?? 3);
      const payload: any = {
        nama_sop: form.nama_sop.trim(),
        deskripsi: form.deskripsi.trim() || null,
        target_role: form.is_personal ? "Manager" : form.target_role,
        batas_jam_upload: form.batas_jam_upload,
        tipe_shift: form.is_personal ? null : form.tipe_shifts[0],
        tipe_shifts: form.is_personal ? [] : form.tipe_shifts,
        hari_berlaku: form.is_personal ? null : form.hari_berlaku,
        target_karyawan_id: form.is_personal ? form.target_karyawan_id : null,
        deadline_tanggal: form.is_personal ? (form.deadline_tanggal || null) : null,
        kategori: form.is_personal ? "BERJALAN_TOKO" : form.kategori,
        bobot_poin: firstPoin,
        poin_sukses: firstEntry?.poin_sukses ?? 3,
        poin_telat: firstEntry?.poin_telat ?? 2,
        poin_tidak_dilakukan: firstEntry?.poin_tidak_dilakukan ?? -6,
        flow_acc: form.flow_acc,
        restrict_assignee: form.restrict_assignee,
      };
      let id = editId;
      if (editId) {
        const { error } = await supabase.from("master_ceklist_sop").update(payload).eq("id_sop", editId);
        if (error) throw error;
        await supabase.from("sop_cabang_pivot").delete().eq("id_sop", editId);
      } else {
        const { data: created, error } = await supabase
          .from("master_ceklist_sop")
          .insert({ ...payload, aktif: true })
          .select("id_sop")
          .single();
        if (error) throw error;
        id = created!.id_sop;
      }
      if (!form.is_personal) {
        const rows = cabangIds.map((cid) => ({
          id_sop: id!,
          id_cabang: cid,
          bobot_poin: form.cabang_points[cid].poin_sukses,
          poin_sukses: form.cabang_points[cid].poin_sukses,
          poin_telat: form.cabang_points[cid].poin_telat,
          poin_tidak_dilakukan: form.cabang_points[cid].poin_tidak_dilakukan,
        }));
        const { error: pErr } = await supabase.from("sop_cabang_pivot").insert(rows);
        if (pErr) throw pErr;
      }
      // Simpan assignee
      await supabase.from("sop_assignee").delete().eq("id_sop", id!);
      if (form.restrict_assignee && form.assignee_sumber === "manual" && form.assignee_ids.length > 0) {
        const assigneeRows = form.assignee_ids.map(kid => ({
          id_sop: id!,
          id_cabang: cabangIds[0] ?? null,
          id_karyawan: kid,
          sumber: "manual" as const,
        }));
        const { error: aErr } = await supabase.from("sop_assignee").insert(assigneeRows);
        if (aErr) throw aErr;
      } else if (form.restrict_assignee && form.assignee_sumber === "jadwal") {
        const jadwalRow = { id_sop: id!, id_cabang: cabangIds[0] ?? null, id_karyawan: null, sumber: "jadwal" as const };
        const { error: aErr } = await supabase.from("sop_assignee").insert([jadwalRow]);
        if (aErr) throw aErr;
      }
      toast.success(editId ? "SOP diperbarui" : "SOP ditambahkan");
      setOpen(false);
      reload();
    } catch (e: any) {
      console.error("[Master SOP] gagal simpan", e);
      toast.error("Gagal menyimpan: " + (e?.message ?? "Tidak diketahui"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleAktif(s: Sop) {
    await supabase.from("master_ceklist_sop").update({ aktif: !s.aktif }).eq("id_sop", s.id_sop);
    reload();
  }
  async function hapus(id: string) {
    if (!confirm("Hapus SOP?")) return;
    await supabase.from("master_ceklist_sop").delete().eq("id_sop", id);
    reload();
  }

  async function cariKaryawanJadwal() {
    if (!form.jadwal_id_cabang) return toast.error("Pilih cabang terlebih dahulu.");
    if (!form.jadwal_tanggal_dari || !form.jadwal_tanggal_sampai || !form.jadwal_shift) {
      return toast.error("Isi tanggal dari, sampai, dan shift terlebih dahulu.");
    }
    setLoadingJadwal(true);
    try {
      const { data: rows, error } = await supabase
        .from("jadwal_kerja")
        .select("id_karyawan")
        .eq("id_cabang", form.jadwal_id_cabang)
        .eq("shift", form.jadwal_shift)
        .eq("status_hari", "Masuk Kerja")
        .gte("tanggal", form.jadwal_tanggal_dari)
        .lte("tanggal", form.jadwal_tanggal_sampai);
      if (error) throw error;
      const uniqueIds = [...new Set((rows ?? []).map((r: any) => r.id_karyawan))];
      const hasil = karyawanList.filter(k => uniqueIds.includes(k.id_karyawan));
      setJadwalResults(hasil);
      if (hasil.length === 0) toast.info("Tidak ada karyawan terjadwal di periode, cabang, dan shift tersebut.");
    } catch (e: any) {
      toast.error("Gagal cari jadwal: " + e.message);
    } finally {
      setLoadingJadwal(false);
    }
  }

  const totalFormPoints = Object.values(form.cabang_points).reduce((a, b) => a + (b.poin_sukses || 0), 0);

  return (
    <AppShell role={data.karyawan.role} nama={data.karyawan.nama_karyawan} nik={data.karyawan.nik}>
      <div className="space-y-4 pb-24">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Master Checklist SOP</h1>
            <p className="text-sm text-muted-foreground">Distribusikan tugas SOP ke banyak cabang dengan bobot poin independen per cabang.</p>
          </div>
        </div>

        {/* Cabang filter + KPI total */}
        <Card>
          <CardContent className="flex flex-wrap items-end justify-between gap-4 pt-6">
            <div className="min-w-[260px] flex-1">
              <Label className="mb-1 flex items-center gap-1.5 text-xs"><Building2 className="h-3.5 w-3.5" /> Pilih Cabang Terlebih Dahulu</Label>
              <Select value={selectedCabang} onValueChange={setSelectedCabang}>
                <SelectTrigger><SelectValue placeholder="— Belum dipilih —" /></SelectTrigger>
                <SelectContent>
                  {cabang.map((c) => <SelectItem key={c.id_cabang} value={c.id_cabang}>{c.nama_cabang}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {selectedCabang && (
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Poin Aktif</p>
                <p className={cn("text-3xl font-bold tabular-nums", totalPoinCabang === 100 ? "text-emerald-600" : totalPoinCabang > 100 ? "text-destructive" : "text-amber-600")}>
                  {totalPoinCabang}<span className="text-lg text-muted-foreground"> / 100</span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {!selectedCabang ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Building2 className="mb-3 h-10 w-10 opacity-40" />
              <p className="font-medium">Pilih cabang di atas untuk mulai mengelola SOP.</p>
              <p className="text-xs">Daftar tugas dan matriks poin akan muncul setelah cabang dipilih.</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as Kategori)}>
            <TabsList className="grid w-full grid-cols-3">
              {KATEGORI_TABS.map((k) => (
                <TabsTrigger key={k.value} value={k.value} className="gap-1.5">
                  <span>{k.icon}</span> {k.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {KATEGORI_TABS.map((k) => (
              <TabsContent key={k.value} value={k.value}>
                <Card>
                  <CardContent className="pt-6">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Nama SOP</TableHead><TableHead>Role</TableHead><TableHead>Shift</TableHead>
                        <TableHead>Batas Jam</TableHead><TableHead className="text-right">Poin Cabang Ini</TableHead>
                        <TableHead>Status</TableHead><TableHead className="w-24"></TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {filteredSops.map((s) => (
                          <TableRow key={s.id_sop}>
                            <TableCell className="font-medium">
                              {s.nama_sop}
                              {s.deskripsi && <p className="text-xs font-normal text-muted-foreground">{s.deskripsi}</p>}
                              {s.target_karyawan_id && (
                                <Badge className="mt-1 bg-blue-600 text-white hover:bg-blue-700">
                                  👤 Khusus: {karyawanList.find(k => k.id_karyawan === s.target_karyawan_id)?.nama_karyawan ?? "—"}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{s.target_role}</TableCell>
                            <TableCell className="text-xs">
                              {(s.tipe_shifts && s.tipe_shifts.length > 0 ? s.tipe_shifts : [s.tipe_shift]).filter(Boolean).join(" + ")}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{s.batas_jam_upload?.slice(0, 5)}</TableCell>
                            <TableCell className="text-right font-bold tabular-nums">{s.poinCabang}</TableCell>
                            <TableCell>
                              <Badge variant={s.aktif ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleAktif(s)}>
                                {s.aktif ? "Aktif" : "Nonaktif"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => hapus(s.id_sop)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredSops.length === 0 && (
                          <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                            Belum ada SOP {k.label} untuk cabang ini. Klik tombol + di kanan-bawah untuk menambah.
                          </TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>

      {/* FAB */}
      {selectedCabang && (
        <Button
          onClick={openCreate}
          size="icon"
          className="fixed bottom-6 right-6 z-20 h-14 w-14 rounded-full shadow-lg"
          aria-label="Tambah SOP"
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      {/* Form SOP */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit SOP" : "Tambah SOP Baru"}</DialogTitle>
            <DialogDescription>Centang banyak cabang sekaligus dan tetapkan bobot poin secara independen per cabang.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <div><Label>Nama Tugas / SOP</Label><Input value={form.nama_sop} onChange={(e) => setForm({ ...form, nama_sop: e.target.value })} /></div>
            <div><Label>Deskripsi (opsional)</Label><Textarea value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              {!form.is_personal && (
                <>
                  <div>
                    <Label>Kategori</Label>
                    <Select value={form.kategori} onValueChange={(v) => setForm({ ...form, kategori: v as Kategori })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {KATEGORI_TABS.map((k) => <SelectItem key={k.value} value={k.value}>{k.icon} {k.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tipe Shift</Label>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {SHIFT_CHOICES.map((sh) => {
                        const active = form.tipe_shifts.includes(sh);
                        return (
                          <button
                            key={sh}
                            type="button"
                            onClick={() => setForm({
                              ...form,
                              tipe_shifts: active
                                ? form.tipe_shifts.filter((x) => x !== sh)
                                : [...form.tipe_shifts, sh],
                            })}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                              active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-muted-foreground hover:bg-muted",
                            )}
                          >
                            {sh}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <Label>Target Role</Label>
                    <Select value={form.target_role} onValueChange={(v) => setForm({ ...form, target_role: v as Sop["target_role"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Vaporista">Vaporista</SelectItem>
                        <SelectItem value="Captain">Captain</SelectItem>
                        <SelectItem value="Manager">Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div>
                <Label>Batas Jam (WIB)</Label>
                <Input type="time" value={form.batas_jam_upload} onChange={(e) => setForm({ ...form, batas_jam_upload: e.target.value })} />
              </div>
              <div className="col-span-2 rounded-lg border bg-muted/30 p-3 space-y-2">
                <Label className="text-sm font-semibold">⭐ Sistem Poin Default</Label>
                <p className="text-xs text-muted-foreground">Nilai ini akan dipakai sebagai default saat menambah cabang baru. Bisa diubah per cabang di bawah.</p>
              </div>
              {form.is_personal && (
                <div>
                  <Label>Batas Tanggal (Deadline)</Label>
                  <Input
                    type="date"
                    value={form.deadline_tanggal}
                    onChange={(e) => setForm({ ...form, deadline_tanggal: e.target.value })}
                  />
                </div>
              )}
            </div>

            {!form.is_personal && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-semibold">Hari Kerja Berlaku</Label>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => setForm({ ...form, hari_berlaku: [...ALL_DAYS] })}>Pilih Semua</Button>
                  <Button type="button" size="sm" variant="ghost" className="h-7 text-xs"
                    onClick={() => setForm({ ...form, hari_berlaku: [] })}>Kosongkan</Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {HARI_LABEL.map((label, day) => {
                  const active = form.hari_berlaku.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setForm({
                        ...form,
                        hari_berlaku: active
                          ? form.hari_berlaku.filter((d) => d !== day)
                          : [...form.hari_berlaku, day].sort((a, b) => a - b),
                      })}
                      className={cn(
                        "h-9 w-12 rounded-md border text-xs font-semibold transition",
                        active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-muted-foreground hover:bg-muted",
                      )}
                    >{label}</button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">Tugas hanya digenerate pada hari-hari yang dipilih.</p>
            </div>
            )}

            <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 space-y-2">
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox checked={form.is_personal} onCheckedChange={(v) => setForm({ ...form, is_personal: !!v })} />
                <span className="text-sm font-semibold text-blue-900">👤 Tugas Khusus Pribadi (Karyawan Tertentu)</span>
              </label>
              {form.is_personal && (
                <>
                  <Select value={form.target_karyawan_id || undefined} onValueChange={(v) => setForm({ ...form, target_karyawan_id: v })}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Pilih karyawan…" /></SelectTrigger>
                    <SelectContent>
                      {karyawanList.map((k) => (
                        <SelectItem key={k.id_karyawan} value={k.id_karyawan}>
                          {k.nama_karyawan} <span className="ml-1 text-xs text-muted-foreground">({k.nik})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div>
                    <Label className="text-xs">Bobot Poin Tugas Pribadi</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={form.bobot_poin_personal}
                      onChange={(e) => setForm({ ...form, bobot_poin_personal: Number(e.target.value) })}
                      className="h-10 w-32 tabular-nums"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">Poin diberikan saat tugas pribadi ini di-ACC oleh Manager.</p>
                  </div>
                </>
              )}
              <p className="text-[11px] text-muted-foreground">Jika aktif, tugas hanya muncul di akun karyawan yang dipilih.</p>
            </div>

            {/* Flow ACC */}
            <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3 space-y-2">
              <Label className="text-sm font-semibold text-violet-900">✅ Flow ACC</Label>
              <p className="text-xs text-muted-foreground">Tentukan siapa yang harus ACC tugas ini. Jika Captain tidak ada di cabang, otomatis ke Manager.</p>
              <div className="flex gap-2">
                {(["Captain", "Manager"] as FlowAcc[]).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setForm({ ...form, flow_acc: opt })}
                    className={cn(
                      "flex-1 rounded-md border py-2 text-sm font-semibold transition",
                      form.flow_acc === opt
                        ? "border-violet-600 bg-violet-600 text-white"
                        : "border-input bg-background text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {opt === "Captain" ? "Vaporista → Captain → Manager" : "Vaporista → Manager"}
                  </button>
                ))}
              </div>
            </div>

            {/* Restrict Assignee */}
            {!form.is_personal && (
            <div className="rounded-lg border border-orange-200 bg-orange-50/40 p-3 space-y-2">
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={form.restrict_assignee}
                  onCheckedChange={(v) => setForm({ ...form, restrict_assignee: !!v, assignee_ids: [] })}
                />
                <span className="text-sm font-semibold text-orange-900">🎯 Batasi ke Karyawan Tertentu</span>
              </label>
              <p className="text-[11px] text-muted-foreground">Jika aktif, tugas hanya muncul untuk karyawan yang dipilih — bukan semua yang masuk shift.</p>
              {form.restrict_assignee && (
                <div className="space-y-2 pt-1">
                  <div className="flex gap-2">
                    {(["jadwal", "manual"] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setForm({ ...form, assignee_sumber: opt, assignee_ids: [] })}
                        className={cn(
                          "flex-1 rounded-md border py-1.5 text-xs font-semibold transition",
                          form.assignee_sumber === opt
                            ? "border-orange-500 bg-orange-500 text-white"
                            : "border-input bg-background text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {opt === "jadwal" ? "📅 Dari Jadwal Shift" : "✋ Pilih Manual"}
                      </button>
                    ))}
                  </div>
                  {form.assignee_sumber === "jadwal" && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs">Cabang</Label>
                        <Select
                          value={form.jadwal_id_cabang || undefined}
                          onValueChange={(v) => setForm({ ...form, jadwal_id_cabang: v, assignee_ids: [] })}
                        >
                          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Pilih cabang…" /></SelectTrigger>
                          <SelectContent>
                            {cabang.map((c) => (
                              <SelectItem key={c.id_cabang} value={c.id_cabang}>{c.nama_cabang}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Dari Tanggal</Label>
                          <Input
                            type="date"
                            value={form.jadwal_tanggal_dari}
                            onChange={(e) => setForm({ ...form, jadwal_tanggal_dari: e.target.value, assignee_ids: [] })}
                            className="h-9 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Sampai Tanggal</Label>
                          <Input
                            type="date"
                            value={form.jadwal_tanggal_sampai}
                            onChange={(e) => setForm({ ...form, jadwal_tanggal_sampai: e.target.value, assignee_ids: [] })}
                            className="h-9 text-xs"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Shift</Label>
                        <div className="flex gap-2 mt-1">
                          {SHIFT_CHOICES.map((sh) => (
                            <button
                              key={sh}
                              type="button"
                              onClick={() => setForm({ ...form, jadwal_shift: sh, assignee_ids: [] })}
                              className={cn(
                                "flex-1 rounded-md border py-1.5 text-xs font-semibold transition",
                                form.jadwal_shift === sh
                                  ? "border-orange-500 bg-orange-500 text-white"
                                  : "border-input bg-background text-muted-foreground hover:bg-muted",
                              )}
                            >{sh}</button>
                          ))}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={cariKaryawanJadwal}
                        disabled={loadingJadwal}
                      >
                        {loadingJadwal && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        Cari Karyawan dari Jadwal
                      </Button>
                      {jadwalResults.length > 0 && (
                        <div className="space-y-1">
                          <Label className="text-xs">Pilih dari hasil jadwal:</Label>
                          <div className="max-h-40 overflow-y-auto space-y-1 rounded-md border bg-background p-2">
                            {jadwalResults.map((k) => {
                              const checked = form.assignee_ids.includes(k.id_karyawan);
                              return (
                                <label key={k.id_karyawan} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-muted">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(v) => setForm({
                                      ...form,
                                      assignee_ids: v
                                        ? [...form.assignee_ids, k.id_karyawan]
                                        : form.assignee_ids.filter((id) => id !== k.id_karyawan),
                                    })}
                                  />
                                  <span className="text-sm">{k.nama_karyawan}</span>
                                  <span className="ml-auto text-xs text-muted-foreground">{k.nik}</span>
                                </label>
                              );
                            })}
                          </div>
                          {form.assignee_ids.length > 0 && (
                            <p className="text-xs text-orange-700 font-medium">{form.assignee_ids.length} karyawan dipilih</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {form.assignee_sumber === "manual" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Pilih karyawan yang boleh mengerjakan:</Label>
                      <div className="max-h-40 overflow-y-auto space-y-1 rounded-md border bg-background p-2">
                        {karyawanList.map((k) => {
                          const checked = form.assignee_ids.includes(k.id_karyawan);
                          return (
                            <label key={k.id_karyawan} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-muted">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => {
                                  setForm({
                                    ...form,
                                    assignee_ids: v
                                      ? [...form.assignee_ids, k.id_karyawan]
                                      : form.assignee_ids.filter((id) => id !== k.id_karyawan),
                                  });
                                }}
                              />
                              <span className="text-sm">{k.nama_karyawan}</span>
                              <span className="ml-auto text-xs text-muted-foreground">{k.nik}</span>
                            </label>
                          );
                        })}
                      </div>
                      {form.assignee_ids.length > 0 && (
                        <p className="text-xs text-orange-700 font-medium">{form.assignee_ids.length} karyawan dipilih</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            )}

            {!form.is_personal && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-sm font-semibold">Distribusi & Poin per Cabang</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => {
                    const all: Record<string, CabangPoinEntry> = {};
                    cabang.forEach((c) => {
                      all[c.id_cabang] = form.cabang_points[c.id_cabang] ?? {
                        poin_sukses: 3,
                        poin_telat: 2,
                        poin_tidak_dilakukan: -6,
                      };
                    });
                    setForm({ ...form, cabang_points: all });
                  }}>Centang Semua</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setForm({ ...form, cabang_points: {} })}>Kosongkan</Button>
                </div>
              </div>
              <div className="space-y-2">
                {cabang.length === 0 && <p className="text-xs text-muted-foreground">Belum ada cabang. Tambahkan dulu di Master Cabang.</p>}
                {cabang.map((c) => {
                  const entry = form.cabang_points[c.id_cabang];
                  const checked = entry !== undefined;
                  return (
                    <div key={c.id_cabang} className="rounded-md border bg-background overflow-hidden">
                      {/* Row utama: checkbox + nama cabang */}
                      <div className="flex items-center gap-3 px-3 py-2">
                        <Checkbox checked={checked} onCheckedChange={(v) => {
                          const cp = { ...form.cabang_points };
                          if (v) cp[c.id_cabang] = cp[c.id_cabang] ?? {
                            poin_sukses: 3,
                            poin_telat: 2,
                            poin_tidak_dilakukan: -6,
                          };
                          else delete cp[c.id_cabang];
                          setForm({ ...form, cabang_points: cp });
                        }} />
                        <span className="flex-1 text-sm font-medium">{c.nama_cabang}</span>
                        {checked && (
                          <span className="text-xs text-muted-foreground">
                            Sukses: <span className="font-semibold text-emerald-600">{entry.poin_sukses}</span>
                          </span>
                        )}
                      </div>
                      {/* Row poin sistem — hanya tampil jika cabang dicentang */}
                      {checked && (
                        <div className="border-t bg-muted/40 px-3 py-2 grid grid-cols-3 gap-2">
                          <div>
                            <p className="text-[10px] text-emerald-700 font-semibold mb-1">✅ Sukses</p>
                            <Input
                              type="number"
                              value={entry.poin_sukses}
                              onChange={(e) => setForm({
                                ...form,
                                cabang_points: {
                                  ...form.cabang_points,
                                  [c.id_cabang]: { ...entry, poin_sukses: Number(e.target.value) },
                                },
                              })}
                              className="h-8 text-xs tabular-nums"
                            />
                          </div>
                          <div>
                            <p className="text-[10px] text-amber-700 font-semibold mb-1">⏰ Telat</p>
                            <Input
                              type="number"
                              value={entry.poin_telat}
                              onChange={(e) => setForm({
                                ...form,
                                cabang_points: {
                                  ...form.cabang_points,
                                  [c.id_cabang]: { ...entry, poin_telat: Number(e.target.value) },
                                },
                              })}
                              className="h-8 text-xs tabular-nums"
                            />
                          </div>
                          <div>
                            <p className="text-[10px] text-red-700 font-semibold mb-1">❌ Tidak</p>
                            <Input
                              type="number"
                              value={entry.poin_tidak_dilakukan}
                              onChange={(e) => setForm({
                                ...form,
                                cabang_points: {
                                  ...form.cabang_points,
                                  [c.id_cabang]: { ...entry, poin_tidak_dilakukan: Number(e.target.value) },
                                },
                              })}
                              className="h-8 text-xs tabular-nums"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {totalFormPoints > 0 && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AlertCircle className="h-3.5 w-3.5" /> Total bobot poin lintas cabang: <span className="font-semibold text-foreground">{totalFormPoints}</span>
                </p>
              )}
            </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}