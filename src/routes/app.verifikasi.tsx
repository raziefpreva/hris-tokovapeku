import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getBuktiSignedUrls } from "@/lib/storage/bukti.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Image as ImageIcon, AlertTriangle, X } from "lucide-react";

export const Route = createFileRoute("/app/verifikasi")({
  ssr: false,
  component: VerifikasiPage,
  validateSearch: (s: Record<string, unknown>) => ({
    cabang: typeof s.cabang === "string" ? s.cabang : undefined,
    tanggal: typeof s.tanggal === "string" ? s.tanggal : undefined,
  }),
});

type Verdict = "approve" | "penalty" | "reject";

function VerifikasiContent({
  rows,
  selfId,
  role,
  search,
  onOpen,
  onAction,
}: {
  rows: Row[];
  selfId: string;
  role: string;
  search: { cabang?: string; tanggal?: string };
  onOpen: (r: Row) => void;
  onAction: (r: Row, mode: Verdict) => void;
}) {
  const isManager = role.toLowerCase() === "manager";
  const captainRows = rows.filter((r) => r.flow_type === "captain_to_manager");
  const managerDirectRows = rows.filter((r) => r.flow_type === "manager_direct");

  const Empty = (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center justify-center text-center">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-50 text-emerald-600 mb-2">
        <CheckCircle2 className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-gray-900">Antrian kosong 🎉</p>
    </div>
  );

  const renderRow = (r: Row) => {
    const isSelf = r.id_karyawan === selfId;
    let badgeClass = "bg-amber-100 text-amber-800";
    let badgeLabel = "Menunggu ACC";
    if (r.status_upload === "TELAT") {
      badgeClass = "bg-red-100 text-red-800";
      badgeLabel = "TELAT";
    } else if (r._is_personal) {
      badgeClass = "bg-blue-100 text-blue-800";
      badgeLabel = "Tugas Pribadi";
    }
    return (
      <div key={r.id_tugas} className="mb-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-gray-900 leading-snug">{r.sop?.nama_sop}</p>
            <p className="text-xs text-gray-500 mt-1">{r.cabang?.nama_cabang}</p>
            <p className="text-xs text-gray-500 mt-1">
              {r.karyawan?.nama_karyawan} · {r.tanggal}
            </p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${badgeClass}`}>
            {badgeLabel}
          </span>
        </div>

        {r.is_in_location === false && (
          <p className="text-xs text-amber-700 mt-2 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Dikerjakan di luar lokasi toko
            {r.upload_distance_m != null && ` (${Math.round(r.upload_distance_m)}m)`}
          </p>
        )}
        {r.alasan_telat && (
          <p className="text-xs text-gray-600 mt-2">
            <span className="font-medium">Alasan telat:</span> {r.alasan_telat}
          </p>
        )}

        <button
          type="button"
          onClick={() => onOpen(r)}
          className="w-full bg-gray-100 text-gray-700 py-2 rounded-xl text-sm mt-2 flex items-center justify-center gap-2"
        >
          <ImageIcon className="h-4 w-4" />
          Lihat {r.file_bukti.length} foto bukti
        </button>

        {isSelf ? (
          <p className="w-full text-center text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 py-2 rounded-xl mt-2">
            Mode Backup — diteruskan ke Manager
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onAction(r, "approve")}
              className="w-full bg-green-500 text-white py-3 rounded-xl text-sm font-semibold mt-3 flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" /> ACC
            </button>
            <button
              type="button"
              onClick={() => onAction(r, "penalty")}
              className="w-full bg-amber-400 text-white py-3 rounded-xl text-sm font-semibold mt-2 flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" /> ACC (Telat)
            </button>
            <button
              type="button"
              onClick={() => onAction(r, "reject")}
              className="w-full bg-red-100 text-red-600 py-3 rounded-xl text-sm font-semibold mt-2 flex items-center justify-center gap-1.5"
            >
              <XCircle className="h-4 w-4" /> Reject
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 mx-auto flex max-w-lg items-center justify-between border-b bg-white px-4 py-3">
        <div className="min-w-0">
          <h1 className="text-base font-bold text-gray-900 truncate">Antrian Verifikasi</h1>
          <p className="text-xs text-gray-500">{rows.length} tugas menunggu</p>
        </div>
        {(search.cabang || search.tanggal) && (
          <a
            href="/app/verifikasi"
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 shrink-0"
          >
            <X className="h-3 w-3" /> Filter
          </a>
        )}
      </div>

      {!isManager ? (
        <div className="mx-auto max-w-lg px-4 py-4 pb-24">
          {rows.length === 0 ? Empty : rows.map(renderRow)}
        </div>
      ) : (
        <div className="mx-auto max-w-lg px-4 py-4 pb-24">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Menunggu ACC dari Captain</h2>
            <div>
              {captainRows.length === 0 ? Empty : captainRows.map(renderRow)}
            </div>
          </section>
          <section className="mt-6 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Tugas Langsung dari Manager</h2>
            <div>
              {managerDirectRows.length === 0 ? Empty : managerDirectRows.map(renderRow)}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

interface Row {
  id_tugas: string;
  id_karyawan: string;
  id_cabang: string;
  status_tugas: string;
  status_upload: string | null;
  alasan_telat: string | null;
  file_bukti: string[];
  tanggal: string;
  catatan_atasan: string | null;
  is_in_location: boolean | null;
  upload_distance_m: number | null;
  flow_type?: string | null;
  is_backup_mode?: boolean | null;
  sop?: { nama_sop: string; bobot_poin: number } | null;
  // diisi setelah filter — true jika SOP punya target_karyawan_id
  _is_personal?: boolean;
  karyawan?: { nama_karyawan: string; nik: string } | null;
  cabang?: { nama_cabang: string } | null;
}

function VerifikasiPage() {
  const { data, loading } = useCurrentUser();
  const search = Route.useSearch();
  const [rows, setRows] = useState<Row[]>([]);
  const [active, setActive] = useState<Row | null>(null);
  const [mode, setMode] = useState<"approve" | "penalty" | "reject" | null>(null);
  const [catatan, setCatatan] = useState("");
  const [busy, setBusy] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const fetchSignedUrls = useServerFn(getBuktiSignedUrls);

  async function reload() {
    if (!data?.karyawan) return;
    const role = String(data.karyawan.role ?? "").toLowerCase();
    let query = supabase
      .from("transaksi_ceklist_harian")
      .select(
        "*, sop:master_ceklist_sop(nama_sop,bobot_poin,target_karyawan_id), karyawan:karyawan!transaksi_ceklist_harian_id_karyawan_fkey(nama_karyawan,nik), cabang:cabang(nama_cabang)",
      )
      .eq("status_tugas", "Menunggu Verifikasi")
      .order("jam_upload", { ascending: true });
    if (search.cabang) query = query.eq("id_cabang", search.cabang);
    if (search.tanggal) query = query.eq("tanggal", search.tanggal);

    if (role === "captain") {
      // Captain selalu bisa ACC home cabang — tidak peduli libur atau backup
      const homeIds = data.cabangIds ?? [];
      query = (query as any)
        .eq("flow_type", "vaporista_to_captain")
        .neq("id_karyawan", data.karyawan.id_karyawan);

      if (homeIds.length > 0) {
        // ACC semua tugas di home cabang, termasuk yang diassign ke Captain ini
        query = (query as any)
          .or(`diverifikasi_oleh.eq.${data.karyawan.id_karyawan},diverifikasi_oleh.is.null`)
          .in("id_cabang", homeIds);
      } else {
        query = (query as any).eq("diverifikasi_oleh", data.karyawan.id_karyawan);
      }
    } else if (role === "manager") {
      // Manager: hanya tugas yang ditujukan ke Manager.
      query = (query as any).in("flow_type", ["captain_to_manager", "manager_direct"]);
    } else {
      setRows([]);
      return;
    }

    const { data: list, error } = await query;
    if (error) {
      console.error("verifikasi queue failed", error);
      toast.error(`Gagal memuat antrian verifikasi: ${error.message}`);
      setRows([]);
      return;
    }
    const all = ((list ?? []) as any[]).map((r) => ({
      ...r,
      _is_personal: !!r.sop?.target_karyawan_id,
    })) as Row[];
    setRows(all);
  }

  useEffect(() => {
    if (data) reload();
  }, [data, search.cabang, search.tanggal]);

  useEffect(() => {
    if (!active) return;
    (async () => {
      const paths = active.file_bukti ?? [];
      if (paths.length === 0) {
        setSignedUrls({});
        return;
      }
      try {
        const urls = await fetchSignedUrls({ data: { paths } });
        setSignedUrls(urls);
      } catch (e) {
        console.error("Gagal memuat foto bukti", e);
        toast.error("Gagal memuat foto bukti");
        setSignedUrls({});
      }
    })();
  }, [active]);

  if (loading || !data?.karyawan) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  async function submitVerdict() {
    if (!active || !mode) return;
    setBusy(true);
    try {
      // Anti-ACC sendiri (UI hide + DB trigger backup)
      if (active.id_karyawan === data!.karyawan!.id_karyawan) {
        toast.error("Anda tidak dapat memverifikasi tugas Anda sendiri.");
        setBusy(false);
        return;
      }
      if (mode === "reject") {
        if (!catatan.trim()) {
          toast.error("Catatan penolakan wajib diisi");
          setBusy(false);
          return;
        }
        // arsipkan foto salah
        await supabase.from("tugas_audit_log").insert({
          id_tugas: active.id_tugas,
          file_bukti_salah: active.file_bukti,
          catatan_penolakan: catatan,
          rejected_by: data!.karyawan!.id_karyawan,
        });
        const { error } = await supabase
          .from("transaksi_ceklist_harian")
          .update({
            status_tugas: "Ditolak",
            file_bukti: [],
            catatan_atasan: catatan,
            diverifikasi_oleh: data!.karyawan!.id_karyawan,
          })
          .eq("id_tugas", active.id_tugas);
        if (error) throw error;
        toast.success("Tugas ditolak. Vaporista bisa re-upload.");
      } else {
        const newStatus = mode === "penalty" ? "Disetujui dengan Penalti" : "Disetujui (Murni)";
        const { error } = await supabase
          .from("transaksi_ceklist_harian")
          .update({
            status_tugas: newStatus,
            catatan_atasan: catatan || null,
            diverifikasi_oleh: data!.karyawan!.id_karyawan,
          })
          .eq("id_tugas", active.id_tugas);
        if (error) throw error;
        toast.success(newStatus);
      }
      setActive(null);
      setMode(null);
      setCatatan("");
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal memproses");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell role={data.karyawan.role} nama={data.karyawan.nama_karyawan} nik={data.karyawan.nik}>
      <VerifikasiContent
        rows={rows}
        selfId={data.karyawan.id_karyawan}
        role={String(data.karyawan.role ?? "")}
        search={search}
        onOpen={(r) => setActive(r)}
        onAction={(r, m) => { setActive(r); setMode(m); }}
      />

      <Dialog open={!!active} onOpenChange={(o) => { if (!o) { setActive(null); setMode(null); setCatatan(""); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{active?.sop?.nama_sop}</DialogTitle>
            <DialogDescription>
              {active?.karyawan?.nama_karyawan} · {active?.cabang?.nama_cabang}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 max-h-72 overflow-auto">
            {(active?.file_bukti ?? []).map((p) => (
              <a key={p} href={signedUrls[p]} target="_blank" rel="noreferrer">
                <img
                  src={signedUrls[p]}
                  alt="bukti"
                  className="h-40 w-full rounded-md border object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = "/placeholder.svg";
                  }}
                />
              </a>
            ))}
          </div>
          {mode && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {mode === "reject" ? "Catatan penolakan (wajib)" : "Catatan (opsional)"}
              </label>
              <Textarea
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Tulis catatan untuk karyawan..."
                maxLength={500}
              />
            </div>
          )}
          <DialogFooter>
            {mode && (
              <>
                <Button variant="outline" onClick={() => { setActive(null); setMode(null); setCatatan(""); }}>
                  Batal
                </Button>
                <Button
                  onClick={submitVerdict}
                  disabled={busy || (mode === "reject" && !catatan.trim())}
                  variant={mode === "reject" ? "destructive" : "default"}
                >
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Konfirmasi
                </Button>
              </>
            )}
            {!mode && <Button onClick={() => setActive(null)}>Tutup</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}