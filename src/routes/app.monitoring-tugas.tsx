import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ChevronDown, ChevronUp, Building2, ClipboardCheck } from "lucide-react";
import { todayWIB } from "@/lib/date-wib";
import { toast } from "sonner";

export const Route = createFileRoute("/app/monitoring-tugas")({
  ssr: false,
  component: MonitoringPage,
});

interface Row {
  id_tugas: string;
  id_sop?: string;
  id_cabang: string;
  id_karyawan: string;
  status_tugas: string;
  jam_upload: string | null;
  tanggal: string;
  sop?: { nama_sop: string; batas_jam_upload: string | null } | null;
  karyawan?: { nama_karyawan: string; nik: string } | null;
  cabang?: { nama_cabang: string } | null;
}

const DONE_STATUSES = new Set(["Disetujui (Murni)", "Disetujui dengan Penalti"]);

function MonitoringPage() {
  const { data, loading } = useCurrentUser();
  const [rows, setRows] = useState<Row[]>([]);
  const [cabangs, setCabangs] = useState<{ id_cabang: string; nama_cabang: string }[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const today = todayWIB();

  async function reload() {
    setBusy(true);
    try {
      const [{ data: cab }, { data: tx, error }] = await Promise.all([
        supabase.from("cabang").select("id_cabang,nama_cabang").order("nama_cabang"),
        supabase
          .from("transaksi_ceklist_harian")
          .select(
            "id_tugas,id_sop,id_cabang,id_karyawan,status_tugas,jam_upload,tanggal, sop:master_ceklist_sop(nama_sop,batas_jam_upload), karyawan:karyawan!transaksi_ceklist_harian_id_karyawan_fkey(nama_karyawan,nik), cabang:cabang(nama_cabang)",
          )
          .eq("tanggal", today),
      ]);
      if (error) throw error;
      setCabangs((cab ?? []) as any);
      setRows((tx ?? []) as any);
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal memuat data");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (data?.karyawan) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.karyawan]);

  const perCabang = useMemo(() => {
    const map = new Map<
      string,
      { total: number; belum: number; menunggu: number; selesai: number; rows: Row[] }
    >();
    for (const c of cabangs) map.set(c.id_cabang, { total: 0, belum: 0, menunggu: 0, selesai: 0, rows: [] });

    const rankStatus = (s: string) => {
      if (DONE_STATUSES.has(s)) return 4;
      if (s === "Menunggu Verifikasi") return 3;
      if (s === "Ditolak") return 2;
      return 1;
    };
    const deduped = new Map<string, Row & { assignees: string[] }>();
    for (const r of rows) {
      const key = r.id_cabang + '|' + (r.id_sop ?? r.id_tugas);
      const prev = deduped.get(key);
      const nama = r.karyawan?.nama_karyawan ?? '-';
      if (!prev) {
        deduped.set(key, { ...r, assignees: [nama] });
      } else {
        if (!prev.assignees.includes(nama)) prev.assignees.push(nama);
        if (rankStatus(r.status_tugas) > rankStatus(prev.status_tugas)) {
          deduped.set(key, { ...r, assignees: prev.assignees });
        }
      }
    }

    for (const r of deduped.values()) {
      const b = map.get(r.id_cabang);
      if (!b) continue;
      b.total += 1;
      b.rows.push(r);
      if (r.status_tugas === "Belum Dikerjakan") b.belum += 1;
      else if (r.status_tugas === "Menunggu Verifikasi") b.menunggu += 1;
      else if (DONE_STATUSES.has(r.status_tugas)) b.selesai += 1;
    }
    return map;
  }, [rows, cabangs]);

  if (loading || !data?.karyawan) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (data.karyawan.role !== "Manager") {
    return (
      <AppShell role={data.karyawan.role} nama={data.karyawan.nama_karyawan} nik={data.karyawan.nik}>
        <Card>
          <CardHeader>
            <CardTitle>Akses Ditolak</CardTitle>
            <CardDescription>Halaman ini hanya untuk Manager.</CardDescription>
          </CardHeader>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell role={data.karyawan.role} nama={data.karyawan.nama_karyawan} nik={data.karyawan.nik}>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Monitoring Tugas</h1>
          <p className="text-sm text-muted-foreground">
            Ringkasan progres ceklist hari ini ({today}) per cabang. Klik kartu untuk drill-down detail tugas.
          </p>
        </div>

        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat data…
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cabangs.map((c) => {
            const b = perCabang.get(c.id_cabang) ?? { total: 0, belum: 0, menunggu: 0, selesai: 0, rows: [] };
            const pct = b.total > 0 ? Math.round((b.selesai / b.total) * 100) : 0;
            const isOpen = expanded === c.id_cabang;
            return (
              <Card
                key={c.id_cabang}
                className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-blue-300"
                onClick={() => setExpanded(isOpen ? null : c.id_cabang)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Building2 className="h-4 w-4 text-primary" />
                      {c.nama_cabang}
                    </CardTitle>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <CardDescription>{b.total} tugas hari ini</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Belum: {b.belum}</Badge>
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Menunggu: {b.menunggu}</Badge>
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Selesai: {b.selesai}</Badge>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>Penyelesaian</span>
                      <span className="font-semibold tabular-nums">{pct}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full transition-all ${pct >= 100 ? "bg-emerald-500" : pct > 0 ? "bg-amber-500" : "bg-muted-foreground/30"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {expanded && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Detail Tugas — {cabangs.find((c) => c.id_cabang === expanded)?.nama_cabang}
              </CardTitle>
              <CardDescription>Daftar lengkap tugas hari ini di cabang ini.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Tugas</TableHead>
                      <TableHead>Assignee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Deadline</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(perCabang.get(expanded)?.rows ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                          Belum ada tugas tercatat.
                        </TableCell>
                      </TableRow>
                    )}
                    {(perCabang.get(expanded)?.rows ?? []).map((r) => (
                      <TableRow key={r.id_tugas}>
                        <TableCell className="font-medium">{r.sop?.nama_sop ?? "-"}</TableCell>
                        <TableCell>{(r as any).assignees ? (r as any).assignees.join(", ") : (r.karyawan?.nama_karyawan ?? "-")}</TableCell>
                        <TableCell>
                          <StatusBadge status={r.status_tugas} />
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.tanggal}
                          {r.sop?.batas_jam_upload ? ` · ${String(r.sop.batas_jam_upload).slice(0, 5)}` : ""}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.status_tugas === "Menunggu Verifikasi" ? (
                            <Button asChild size="sm" variant="outline">
                              <Link to="/app/verifikasi" search={{ cabang: expanded, tanggal: today } as any}>
                                <ClipboardCheck className="mr-1 h-3.5 w-3.5" /> Verifikasi
                              </Link>
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Belum Dikerjakan") return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Belum</Badge>;
  if (status === "Menunggu Verifikasi") return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Menunggu ACC</Badge>;
  if (DONE_STATUSES.has(status)) return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Selesai</Badge>;
  if (status === "Ditolak") return <Badge variant="destructive">Ditolak</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}