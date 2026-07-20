import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { MobileShell } from "@/components/app/MobileShell";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, AlertTriangle, CheckCircle2, XCircle, Clock, Sun, Moon, Settings2, Award, RefreshCw } from "lucide-react";
import { useTodayWIB } from "@/lib/date-wib";
import { CameraCapture } from "@/components/app/CameraCapture";

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export const Route = createFileRoute("/app/tugas")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    status: typeof search.status === "string" ? (search.status as string) : undefined,
    cabang: typeof search.cabang === "string" ? (search.cabang as string) : undefined,
    team: search.team === "1" || search.team === 1 || search.team === true ? "1" : undefined,
  }),
  component: TugasPage,
});

interface TugasRow {
  id_tugas: string;
  tanggal: string;
  id_sop: string;
  id_cabang: string;
  id_karyawan: string;
  jam_upload: string | null;
  status_upload: string | null;
  status_tugas: string;
  file_bukti: string[];
  catatan_atasan: string | null;
  alasan_telat: string | null;
  is_backup_mode?: boolean | null;
  sop?: { nama_sop: string; batas_jam_upload: string; bobot_poin: number; kategori?: string | null; tipe_shift?: string | null; tipe_shifts?: string[] | null } | null;
  cabang?: { nama_cabang: string; latitude?: number | null; longitude?: number | null } | null;
  karyawan?: { nama_karyawan: string | null } | null;
  done_by_me?: boolean;
  done_by_name?: string | null;
}

function statusBadge(s: string) {
  const map: Record<string, { label: string; className: string }> = {
    "Belum Dikerjakan": { label: "Belum", className: "bg-muted text-muted-foreground" },
    "Menunggu Verifikasi": { label: "Menunggu Verifikasi", className: "bg-amber-100 text-amber-800 border-amber-200" },
    "Disetujui (Murni)": { label: "Disetujui", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    "Disetujui dengan Penalti": { label: "Disetujui (Penalti)", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    Ditolak: { label: "Ditolak", className: "bg-red-100 text-red-800 border-red-200" },
  };
  const m = map[s] ?? { label: s, className: "" };
  return <Badge variant="outline" className={m.className}>{m.label}</Badge>;
}

function kategoriBadge(k?: string | null) {
  const key = String(k ?? "").toUpperCase();
  if (key === "OPENING")
    return (
      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
        <Sun className="mr-1 h-3 w-3" /> Opening
      </Badge>
    );
  if (key === "CLOSING")
    return (
      <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-800">
        <Moon className="mr-1 h-3 w-3" /> Closing
      </Badge>
    );
  if (key === "BERJALAN_TOKO")
    return (
      <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-800">
        <Settings2 className="mr-1 h-3 w-3" /> Berjalan Toko
      </Badge>
    );
  return null;
}

function TugasPage() {
  const { data, loading, reload: reloadUser } = useCurrentUser();
  const search = Route.useSearch() as { status?: string; cabang?: string; team?: string };
  const [rows, setRows] = useState<TugasRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<TugasRow | null>(null);
  const [files, setFiles] = useState<File[] | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [alasan, setAlasan] = useState("");

  const today = useTodayWIB();
  const role = String(data?.karyawan?.role ?? "");
  const isManager = role === "Manager";
  // Cabang aktif HANYA dari jadwal hari ini (User-Centric). Tanpa jadwal = tidak ada tugas.
  // Sekarang mendukung multi-shift dan multi-cabang per hari.
  const cabangAktifList: string[] =
    (data?.jadwalHariIni?.id_cabang_list && data.jadwalHariIni.id_cabang_list.length > 0)
      ? data.jadwalHariIni.id_cabang_list
      : (data?.jadwalHariIni?.id_cabang ? [data.jadwalHariIni.id_cabang] : []);
  const shiftAktifList: string[] =
    (data?.jadwalHariIni?.shifts && data.jadwalHariIni.shifts.length > 0)
      ? data.jadwalHariIni.shifts
      : (data?.jadwalHariIni?.shift ? [data.jadwalHariIni.shift] : []);
  const cabangAktif = cabangAktifList[0] ?? null;
  const shiftAktif = shiftAktifList[0] ?? null;
  const statusHariIni = data?.jadwalHariIni?.status_hari ?? null;
  const isCaptain = role.toLowerCase() === "captain";
  const homeCabangIds = data?.cabangIds ?? [];
  // Backup mode (per cabang): TRUE jika cabang itu bukan penempatan asli karyawan
  const isBackupForCabang = (idCabang: string) =>
    !isManager && homeCabangIds.length > 0 && !homeCabangIds.includes(idCabang);
  // Untuk ringkasan UI (badge), tampilkan backup jika SEMUA cabang aktif bukan asli
  const isBackupMode =
    !isManager && cabangAktifList.length > 0 && cabangAktifList.every(isBackupForCabang);

  // Nama-nama cabang backup yang sedang ditangani hari ini.
  const backupCabangNames = (rows ?? [])
    .filter((r) => isBackupForCabang(r.id_cabang))
    .map((r) => r.cabang?.nama_cabang)
    .filter((x): x is string => !!x);
  const backupLabel = Array.from(new Set(backupCabangNames)).join(", ");

  async function ensureTodaysTasks() {
    if (!data?.karyawan) return;
    const r = String(data.karyawan.role ?? "").toLowerCase();
    if (r !== "captain" && r !== "vaporista") return;

    // Captain: selalu generate home cabang (walau libur atau backup di cabang lain)
    // Vaporista: hanya generate kalau masuk kerja dan ada jadwal
    const isCaptainRole = r === "captain";

    if (!isCaptainRole) {
      // Vaporista: harus ada jadwal dan masuk kerja
      if (cabangAktifList.length === 0) return;
      if (statusHariIni && statusHariIni !== "Masuk Kerja") return;
      if (shiftAktifList.length === 0) return;
    }

    const todayDow = new Date(today + "T00:00:00+07:00").getUTCDay();

    // Cabang yang perlu digenerate untuk Captain:
    // 1. Selalu home cabang (walau libur/backup)
    // 2. Cabang backup hari ini (kalau masuk kerja)
    const captainTargetCabangs: string[] = isCaptainRole
      ? Array.from(new Set([
          ...homeCabangIds, // selalu home cabang
          ...(statusHariIni === "Masuk Kerja" ? cabangAktifList : []), // backup kalau masuk
        ]))
      : cabangAktifList;

    const allowedRolesFor = (idCabang: string): string[] =>
      r === "captain"
        ? isBackupForCabang(idCabang) ? ["vaporista"] : ["captain", "vaporista"]
        : r === "vaporista" ? ["vaporista"] : [];

    // Shift yang dipakai untuk generate: kalau libur pakai default shift home cabang
    const shiftsToUse = shiftAktifList.length > 0 ? shiftAktifList : ["Shift 1", "Shift 2"];

    const roleMatches = (target: string, allowedRoles: string[]) => {
      const tr = String(target ?? "").toLowerCase();
      return allowedRoles.some((ar) => tr.includes(ar) || ar.includes(tr));
    };
    const shiftMatches = (sopShifts: string[] | null | undefined, sopShiftLegacy: string | null | undefined, currentShift: string) => {
      const arr = (Array.isArray(sopShifts) && sopShifts.length > 0
        ? sopShifts
        : (sopShiftLegacy ? [sopShiftLegacy] : [])).map((x) => String(x).toLowerCase());
      const cur = String(currentShift).toLowerCase();
      if (arr.length === 0) return true; // SOP tanpa tipe shift = berlaku semua shift
      if (cur === "full time") return true; // Full Time mengerjakan semua
      return arr.some((s) => s === cur);
    };
    const hariMatches = (hari: number[] | null | undefined) => {
      if (!Array.isArray(hari) || hari.length === 0) return true; // null/empty = setiap hari
      return hari.includes(todayDow);
    };
    const personalMatches = (targetKaryawanId: string | null | undefined) => {
      if (!targetKaryawanId) return true;
      return targetKaryawanId === data!.karyawan!.id_karyawan;
    };

    // Ambil semua assignee yang berlaku hari ini
    const { data: assigneeRows } = await supabase
      .from("sop_assignee")
      .select("id_sop, id_karyawan, sumber, berlaku_dari, berlaku_sampai")
      .or(`berlaku_dari.is.null,berlaku_dari.lte.${today}`)
      .or(`berlaku_sampai.is.null,berlaku_sampai.gte.${today}`);
    const assigneeMap = new Map<string, string[]>(); // id_sop -> [id_karyawan]
    for (const a of (assigneeRows ?? []) as any[]) {
      if (!assigneeMap.has(a.id_sop)) assigneeMap.set(a.id_sop, []);
      if (a.id_karyawan) assigneeMap.get(a.id_sop)!.push(a.id_karyawan);
    }

    // Cek apakah karyawan ini boleh mengerjakan SOP (restrict_assignee)
    const assigneeMatches = (idSop: string, restrictAssignee: boolean | null | undefined) => {
      if (!restrictAssignee) return true; // tidak dibatasi = semua boleh
      const allowed = assigneeMap.get(idSop) ?? [];
      if (allowed.length === 0) return true; // tidak ada assignee = semua boleh
      return allowed.includes(data!.karyawan!.id_karyawan);
    };

    // Pasangan {shift, id_cabang} – sumber kebenaran untuk BKO silang.
    const rawPairs = (data?.jadwalHariIni?.assignments ?? []).filter(
      (a) => a && a.shift && a.id_cabang,
    );
    const jadwalPairs: { shift: string; id_cabang: string }[] = rawPairs.length > 0
      ? rawPairs
      : cabangAktifList.flatMap((idc) =>
          shiftAktifList.map((sh) => ({ shift: sh, id_cabang: idc })),
        );

    // Captain: tambahkan home cabang dengan semua shift walau hari ini libur/backup
    const captainHomePairs: { shift: string; id_cabang: string }[] = isCaptainRole
      ? homeCabangIds.flatMap((idc) =>
          ["Shift 1", "Shift 2"].map((sh) => ({ shift: sh, id_cabang: idc }))
        ).filter((p) => !jadwalPairs.some((jp) => jp.shift === p.shift && jp.id_cabang === p.id_cabang))
      : [];

    const pairs = [...jadwalPairs, ...captainHomePairs];

    // Existing tasks: keyed by `${id_cabang}|${id_sop}` so multi-cabang tidak dianggap duplikat
    const { data: existing } = await supabase
      .from("transaksi_ceklist_harian")
      .select("id_sop,id_cabang")
      .eq("id_karyawan", data.karyawan.id_karyawan)
      .eq("tanggal", today);
    const existingKeys = new Set((existing ?? []).map((e: any) => `${e.id_cabang}|${e.id_sop}`));

    const toInsert: any[] = [];
    // Group pairs by cabang → kumpulan shift di cabang itu.
    const cabangShiftMap = new Map<string, Set<string>>();
    for (const p of pairs) {
      if (!cabangShiftMap.has(p.id_cabang)) cabangShiftMap.set(p.id_cabang, new Set());
      cabangShiftMap.get(p.id_cabang)!.add(p.shift);
    }

    for (const [idCabang, shiftSet] of cabangShiftMap) {
      const shiftsForCabang = Array.from(shiftSet);
      const allowedRoles = allowedRolesFor(idCabang);
      if (allowedRoles.length === 0) continue;
      const backupHere = isBackupForCabang(idCabang);

      // Kumpulkan SOP yang cocok untuk shift yang berlaku KHUSUS di cabang ini.
      const sopIdSet = new Set<string>();

      // 1) Coba ambil SOP via pivot cabang
      const { data: pivot } = await supabase
        .from("sop_cabang_pivot")
        .select("id_sop, master_ceklist_sop!inner(id_sop, target_role, aktif, tipe_shift, tipe_shifts, hari_berlaku, target_karyawan_id, restrict_assignee)")
        .eq("id_cabang", idCabang);
      const pivotRows = (pivot ?? []).filter((p: any) => p.master_ceklist_sop?.aktif);
      for (const p of pivotRows) {
        const sop = p.master_ceklist_sop;
        if (!roleMatches(sop.target_role, allowedRoles)) continue;
        if (!hariMatches(sop.hari_berlaku)) continue;
        if (!personalMatches(sop.target_karyawan_id)) continue;
        if (!assigneeMatches(p.id_sop, sop.restrict_assignee)) continue;
        for (const sh of shiftsForCabang) {
          if (shiftMatches(sop.tipe_shifts, sop.tipe_shift, sh)) { sopIdSet.add(p.id_sop); break; }
        }
      }

      // 2) Fallback bila pivot kosong: ambil semua SOP aktif
      if (sopIdSet.size === 0) {
        const { data: allSops } = await supabase
          .from("master_ceklist_sop")
          .select("id_sop, target_role, aktif, tipe_shift, tipe_shifts, hari_berlaku, target_karyawan_id, restrict_assignee")
          .eq("aktif", true);
        for (const s of (allSops ?? []) as any[]) {
          if (!roleMatches(s.target_role, allowedRoles)) continue;
          if (!hariMatches(s.hari_berlaku)) continue;
          if (!personalMatches(s.target_karyawan_id)) continue;
          if (!assigneeMatches(s.id_sop, s.restrict_assignee)) continue;
          for (const sh of shiftsForCabang) {
            if (shiftMatches(s.tipe_shifts, s.tipe_shift, sh)) { sopIdSet.add(s.id_sop); break; }
          }
        }
      }

      for (const id_sop of sopIdSet) {
        const key = `${idCabang}|${id_sop}`;
        if (existingKeys.has(key)) continue;
        toInsert.push({
          tanggal: today,
          id_karyawan: data.karyawan!.id_karyawan,
          id_cabang: idCabang,
          id_sop,
          is_backup_mode: backupHere,
        });
        existingKeys.add(key);
      }
    }
    if (toInsert.length) {
      const { error } = await supabase.from("transaksi_ceklist_harian").insert(toInsert);
      if (error) {
        console.error("insert transaksi_ceklist_harian failed", error);
        toast.error(`Gagal generate tugas hari ini: ${error.message}`);
      }
    }
  }

  async function reload() {
    if (!data?.karyawan) return;
    if (!isManager && !search.team) await ensureTodaysTasks();
    let query = supabase
      .from("transaksi_ceklist_harian")
      .select(
        "*, sop:master_ceklist_sop(nama_sop,batas_jam_upload,bobot_poin,kategori,tipe_shift,tipe_shifts), cabang:cabang(nama_cabang,latitude,longitude), karyawan:karyawan!transaksi_ceklist_harian_id_karyawan_fkey(nama_karyawan)",
      )
      .eq("tanggal", today)
      .order("created_at");
    if (search.team && search.cabang) {
      query = query.eq("id_cabang", search.cabang);
    } else if (!isManager) {
      // Shared-shift view: ambil semua tugas di cabang aktif hari ini,
      // lalu dedupe per (cabang, sop) pilih row yang paling progress.
      if (cabangAktifList.length > 0) {
        query = query.in("id_cabang", cabangAktifList);
      } else {
        query = query.eq("id_karyawan", data.karyawan.id_karyawan);
      }
    }
    const { data: list } = await query;
    let result = (list ?? []) as TugasRow[];

    // Dedupe per (id_cabang|id_sop) — pilih row paling "maju".
    if (true) {
      const myId = data.karyawan.id_karyawan;
      const rank = (s: string) => {
        if (s === "Disetujui (Murni)" || s === "Disetujui dengan Penalti") return 4;
        if (s === "Menunggu Verifikasi") return 3;
        if (s === "Ditolak") return 2;
        return 1; // Belum Dikerjakan
      };
      const byKey = new Map<string, TugasRow>();
      for (const r of result) {
        const key = `${r.id_cabang}|${r.id_sop}`;
        const prev = byKey.get(key);
        if (!prev) { byKey.set(key, r); continue; }
        const prevR = rank(prev.status_tugas);
        const curR = rank(r.status_tugas);
        if (curR > prevR) byKey.set(key, r);
        else if (curR === prevR) {
          // Prefer baris milik user sendiri agar ia bisa upload bila masih Belum.
          if (r.id_karyawan === myId && prev.id_karyawan !== myId) byKey.set(key, r);
        }
      }
      // Filter hanya tugas yang cocok dengan shift user (skip untuk Manager & team view)
      const userShifts = shiftAktifList.map((s) => s.toLowerCase());
      const rows = Array.from(byKey.values());
      result = (isManager || search.team ? rows : rows.filter((r) => {
        const sopShifts = (r.sop as any)?.tipe_shifts;
        if (!Array.isArray(sopShifts) || sopShifts.length === 0) return true;
        return sopShifts.some((s: string) => userShifts.includes(String(s).toLowerCase()));
      })).map((r) => ({
        ...r,
        done_by_me: r.id_karyawan === myId,
        done_by_name: r.id_karyawan === myId ? null : (r.karyawan?.nama_karyawan ?? null),
      }));
    }

    if (search.status) {
      const map: Record<string, (s: string) => boolean> = {
        belum: (s) => s === "Belum Dikerjakan",
        menunggu: (s) => s === "Menunggu Verifikasi",
        acc: (s) => s === "Disetujui (Murni)" || s === "Disetujui dengan Penalti",
        ditolak: (s) => s === "Ditolak",
      };
      const fn = map[search.status];
      if (fn) result = result.filter((r) => fn(r.status_tugas));
    }
    setRows(result);
  }

  useEffect(() => {
    if (data?.karyawan) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.karyawan?.id_karyawan, search.status, search.cabang, search.team]);

  // Realtime: refresh saat ada perubahan transaksi di cabang aktif hari ini
  useEffect(() => {
    if (!data?.karyawan || cabangAktifList.length === 0) return;
    const channel = supabase
      .channel(`tugas-shared-${today}-${cabangAktifList.join(",")}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transaksi_ceklist_harian" },
        (payload) => {
          const row: any = payload.new ?? payload.old;
          if (!row) return;
          if (row.tanggal !== today) return;
          if (!cabangAktifList.includes(row.id_cabang)) return;
          reload();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.karyawan?.id_karyawan, today, cabangAktifList.join(",")]);

  // Auto re-sync setiap kali tab kembali fokus / halaman dibuka ulang,
  // supaya tugas master yang baru dibuat Manager langsung muncul.
  useEffect(() => {
    if (!data?.karyawan) return;
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.karyawan?.id_karyawan, cabangAktif]);

  // Realtime: bila Manager menyimpan jadwal untuk user ini, refresh profil
  // (jadwalHariIni / cabang aktif) → ensureTodaysTasks otomatis generate tugas
  // dan subscription transaksi_ceklist_harian akan menarik tugas baru.
  useEffect(() => {
    if (!data?.karyawan?.id_karyawan) return;
    const uid = data.karyawan.id_karyawan;
    const channel = supabase
      .channel(`jadwal-self-${uid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "jadwal_kerja",
          filter: `id_karyawan=eq.${uid}`,
        },
        (payload) => {
          const row: any = payload.new ?? payload.old;
          if (row?.tanggal && row.tanggal !== today) return;
          reloadUser();
          reload();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.karyawan?.id_karyawan, today]);

  if (loading || !data?.karyawan) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  function isLate(row: TugasRow): boolean {
    if (!row.sop?.batas_jam_upload) return false;
    const now = new Date();
    // Normalisasi batas jam agar selalu HH:MM:SS
    const timeParts = row.sop.batas_jam_upload.split(":");
    const timeStr = timeParts.length === 2
      ? `${row.sop.batas_jam_upload}:00`
      : row.sop.batas_jam_upload;
    const deadline = new Date(`${row.tanggal}T${timeStr}+07:00`);
    return !isNaN(deadline.getTime()) && now > deadline;
  }

  async function uploadSubmit() {
    if (!selected || !files || files.length === 0) return;
    if (isLate(selected) && !alasan.trim()) {
      toast.error("Alasan telat wajib diisi");
      return;
    }
    setBusy(true);
    try {
      // === Geofence check (tidak memblokir upload) ===
      let isInLocation: boolean | null = null;
      let uploadLat: number | null = null;
      let uploadLng: number | null = null;
      let distanceM: number | null = null;
      const cabLat = selected.cabang?.latitude != null ? Number(selected.cabang.latitude) : null;
      const cabLng = selected.cabang?.longitude != null ? Number(selected.cabang.longitude) : null;
      if (cabLat != null && cabLng != null && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 12000,
              maximumAge: 0,
            });
          });
          uploadLat = pos.coords.latitude;
          uploadLng = pos.coords.longitude;
          distanceM = haversineMeters(uploadLat, uploadLng, cabLat, cabLng);
          isInLocation = (distanceM ?? Infinity) <= 50;
        } catch (err) {
          console.warn("Geolocation gagal", err);
          toast.warning("GPS tidak aktif — tugas tetap diupload, ditandai di luar lokasi.");
          isInLocation = false;
        }
      }

      const uploaded: string[] = [];
      for (const f of Array.from(files)) {
        const path = `${data!.karyawan!.id_karyawan}/${selected.id_tugas}/${Date.now()}-${f.name}`;
        const { error } = await supabase.storage.from("bukti-tugas").upload(path, f, {
          cacheControl: "3600",
          upsert: false,
        });
        if (error) throw error;
        uploaded.push(path);
      }
      const merged = [...(selected.file_bukti ?? []), ...uploaded];
      const now = new Date();
      const isLateUpload = isLate(selected);
      const statusUpload = isLateUpload ? "TELAT" : "Tepat Waktu";

      const autoApprove = isCaptain && !isBackupMode;
      const newStatus = autoApprove ? "Disetujui (Murni)" : "Menunggu Verifikasi";
      const { error: upErr } = await supabase
        .from("transaksi_ceklist_harian")
        .update({
          file_bukti: merged,
          jam_upload: now.toISOString(),
          status_upload: statusUpload,
          alasan_telat: isLateUpload ? (alasan || selected.alasan_telat) : null,
          status_tugas: newStatus,
          is_backup_mode: isBackupMode,
          is_in_location: isInLocation,
          upload_latitude: uploadLat,
          upload_longitude: uploadLng,
          upload_distance_m: distanceM,
        })
        .eq("id_tugas", selected.id_tugas);
      if (upErr) throw upErr;
      const locMsg = isInLocation === false ? " ⚠️ Tercatat di luar lokasi toko." : "";
      const lateMsg = isLateUpload ? " ⏰ Tercatat TELAT." : "";
      toast.success(
        autoApprove
          ? "Bukti terkirim & otomatis disetujui (Captain di cabang asli)." + lateMsg + locMsg
          : isBackupMode
            ? "Bukti terkirim — menunggu ACC Captain native cabang ini / Manager." + lateMsg + locMsg
            : "Bukti terkirim — menunggu verifikasi atasan." + lateMsg + locMsg,
      );
      setSelected(null);
      setFiles(null);
      setAlasan("");
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal upload");
    } finally {
      setBusy(false);
    }
  }

  const body = (
    <div className="space-y-4">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-tight">Tugas Saya</h1>
            <p className="text-xs text-muted-foreground">
              {rows.length} tugas SOP untuk shift hari ini.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-9 shrink-0"
            onClick={async () => {
              toast.info("Menyinkronkan tugas terbaru...");
              await reload();
              toast.success("Sinkron selesai");
            }}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Sinkron
          </Button>
        </div>
        {isBackupMode && (
          <Badge variant="outline" className="mt-2 border-orange-300 bg-orange-50 text-orange-800">
            Mode Backup — {backupLabel || "di cabang non-asli"}
          </Badge>
        )}
      </div>

      {!isManager && !cabangAktif && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader className="p-4">
            <CardTitle className="flex items-center gap-2 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4" /> Belum ada cabang aktif
            </CardTitle>
            <CardDescription className="text-amber-800">
              Manager belum menetapkan cabang / jadwal untuk Anda hari ini.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <TugasSections
        rows={rows}
        isBackupForCabang={isBackupForCabang}
        onUpload={(r) => { setSelected(r); setAlasan(r.alasan_telat ?? ""); }}
        showEmpty={rows.length === 0 && !!cabangAktif}
        homeCabangNames={(data?.cabangIds ?? [])
          .map((id) => rows.find((r) => r.id_cabang === id)?.cabang?.nama_cabang)
          .filter((x): x is string => !!x)}
      />
    </div>
  );

  return (
    <>
      {isManager ? (
        <AppShell
          role={data.karyawan.role}
          nama={data.karyawan.nama_karyawan}
          nik={data.karyawan.nik}
        >
          {body}
        </AppShell>
      ) : (
        <MobileShell role={data.karyawan.role}>{body}</MobileShell>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selected?.sop?.nama_sop}</DialogTitle>
            <DialogDescription>
              Upload foto bukti pengerjaan. Anda boleh upload beberapa foto sekaligus.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Foto / Video Bukti</Label>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full justify-start"
                onClick={() => setCameraOpen(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                {files && files.length > 0
                  ? `${files.length} bukti siap dikirim — ketuk untuk ganti`
                  : "Buka kamera / pilih file"}
              </Button>
              {files && files.length > 0 && (
                <div className="flex gap-2 overflow-x-auto">
                  {files.map((f, i) => (
                    <div key={i} className="shrink-0 text-[10px] text-muted-foreground">
                      {f.type.startsWith("video") ? "🎬" : "🖼️"} {f.name.slice(0, 16)}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selected && isLate(selected) && (
              <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3">
                <Label className="text-amber-900 flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Anda terlambat. Alasan WAJIB diisi.
                </Label>
                <Textarea
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  placeholder="Jelaskan kenapa terlambat..."
                  required
                  maxLength={500}
                />
              </div>
            )}
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" className="h-11 w-full sm:w-auto" onClick={() => setSelected(null)}>
              Batal
            </Button>
            <Button
              className="h-11 w-full sm:w-auto"
              onClick={uploadSubmit}
              disabled={busy || !files || files.length === 0 || (selected !== null && isLate(selected) && !alasan.trim())}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kirim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onConfirm={(fs) => setFiles(fs)}
      />
    </>
  );
}

function TugasSections({
  rows,
  isBackupForCabang,
  onUpload,
  showEmpty,
  homeCabangNames,
}: {
  rows: TugasRow[];
  isBackupForCabang: (id: string) => boolean;
  onUpload: (r: TugasRow) => void;
  showEmpty: boolean;
  homeCabangNames: string[];
}) {
  if (showEmpty) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Tidak ada SOP terjadwal untuk role Anda hari ini.
        </CardContent>
      </Card>
    );
  }
  const backupRows = rows.filter((r) => isBackupForCabang(r.id_cabang));
  const asalRows = rows.filter((r) => !isBackupForCabang(r.id_cabang));
  const backupNames = Array.from(new Set(backupRows.map((r) => r.cabang?.nama_cabang).filter((x): x is string => !!x))).join(", ");
  const asalNames = Array.from(new Set([
    ...asalRows.map((r) => r.cabang?.nama_cabang).filter((x): x is string => !!x),
    ...homeCabangNames,
  ])).join(", ");
  return (
    <div className="space-y-5">
      {backupRows.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-orange-500" />
            <h2 className="text-sm font-bold text-orange-900">
              Tugas Backup di {backupNames || "Cabang Lain"}
            </h2>
            <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-800 text-[10px]">
              {backupRows.length}
            </Badge>
          </div>
          <div className="grid gap-3">
            {backupRows.map((r) => <TugasCard key={r.id_tugas} r={r} onUpload={onUpload} accentClass="border-orange-200 bg-orange-50/30" />)}
          </div>
        </section>
      )}
      {asalRows.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <h2 className="text-sm font-bold text-emerald-900">
              Tugas Cabang Asal{asalNames ? ` (${asalNames})` : ""}
            </h2>
            <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 text-[10px]">
              {asalRows.length}
            </Badge>
          </div>
          <div className="grid gap-3">
            {asalRows.map((r) => <TugasCard key={r.id_tugas} r={r} onUpload={onUpload} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function TugasCard({ r, onUpload, accentClass }: { r: TugasRow; onUpload: (r: TugasRow) => void; accentClass?: string }) {
  const done = r.status_tugas === "Disetujui (Murni)" || r.status_tugas === "Disetujui dengan Penalti";
  const rejected = r.status_tugas === "Ditolak";
  const byOther = r.done_by_me === false && !!r.done_by_name;
  // Tugas milik rekan satu shift yang sudah dalam proses / selesai tidak boleh di-upload ulang.
  const lockedByOther = byOther && r.status_tugas !== "Belum Dikerjakan" && r.status_tugas !== "Ditolak";
  const canUpload = (r.status_tugas === "Belum Dikerjakan" || rejected) && !lockedByOther;
  return (
    <Card className={
      lockedByOther ? "border-slate-200 bg-slate-50 opacity-70" :
      rejected ? "border-red-300 bg-red-50/50" :
      done ? "border-emerald-200" : accentClass
    }>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug">{r.sop?.nama_sop}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{r.cabang?.nama_cabang}</p>
          </div>
          {statusBadge(r.status_tugas)}
        </div>
        {byOther && (
          <p className="text-[11px] font-medium text-slate-600">
            {lockedByOther ? "Sudah dikerjakan oleh " : "Sedang dipantau — terakhir oleh "}
            <span className="text-slate-900">{r.done_by_name}</span>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {kategoriBadge(r.sop?.kategori)}
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
            <Clock className="mr-1 h-3 w-3" /> Batas {r.sop?.batas_jam_upload?.slice(0, 5)} WIB
          </Badge>
          <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-800">
            <Award className="mr-1 h-3 w-3" /> {r.sop?.bobot_poin} poin
          </Badge>
          {r.status_upload && (
            <Badge variant="outline" className="text-[10px]">
              {r.status_upload === "Tepat Waktu" && <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-600" />}
              {r.status_upload === "TELAT" && <Clock className="mr-1 h-3 w-3 text-amber-600" />}
              {r.status_upload === "ALFA" && <XCircle className="mr-1 h-3 w-3 text-red-600" />}
              {r.status_upload}
            </Badge>
          )}
        </div>
        {r.catatan_atasan && (
          <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-xs">
            <p className="font-medium text-red-900">Catatan atasan:</p>
            <p className="text-red-800">{r.catatan_atasan}</p>
          </div>
        )}
        {canUpload && (
          <Button className="h-11 w-full text-sm" onClick={() => onUpload(r)}>
            <Upload className="mr-2 h-4 w-4" />
            {rejected ? "Re-upload Bukti" : "Upload Bukti"}
          </Button>
        )}
        {r.file_bukti?.length > 0 && (
          <p className="text-[11px] text-muted-foreground">{r.file_bukti.length} file bukti terlampir</p>
        )}
      </CardContent>
    </Card>
  );
}