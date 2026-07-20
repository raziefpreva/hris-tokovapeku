import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock } from "lucide-react";
import { todayWIB, toWIBDateString } from "@/lib/date-wib";

export const Route = createFileRoute("/app/absensi")({
  ssr: false,
  component: AbsensiPage,
});

interface Row {
  id_jadwal: string;
  tanggal: string;
  status_hari: "Masuk Kerja" | "LIBUR";
  shift: string | null;
  karyawan: { nama_karyawan: string; nik: string } | null;
  cabang: { nama_cabang: string; id_cabang: string } | null;
}

interface Cabang { id_cabang: string; nama_cabang: string }

function AbsensiPage() {
  const { data } = useCurrentUser();
  const [rows, setRows] = useState<Row[]>([]);
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [filterCabang, setFilterCabang] = useState<string>("all");
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return toWIBDateString(d);
  });
  const [to, setTo] = useState(() => todayWIB());

  useEffect(() => {
    supabase.from("cabang").select("id_cabang,nama_cabang").order("nama_cabang")
      .then(({ data }) => setCabangList((data ?? []) as Cabang[]));
  }, []);

  useEffect(() => {
    (async () => {
      let q = supabase
        .from("jadwal_kerja")
        .select("id_jadwal,tanggal,status_hari,shift,karyawan:karyawan(nama_karyawan,nik),cabang:cabang(id_cabang,nama_cabang)")
        .gte("tanggal", from)
        .lte("tanggal", to)
        .order("tanggal", { ascending: false });
      if (filterCabang !== "all") q = q.eq("id_cabang", filterCabang);
      const { data: l } = await q;
      setRows((l ?? []) as unknown as Row[]);
    })();
  }, [from, to, filterCabang]);

  const stats = useMemo(() => {
    const masuk = rows.filter(r => r.status_hari === "Masuk Kerja").length;
    const libur = rows.filter(r => r.status_hari === "LIBUR").length;
    return { masuk, libur, total: rows.length };
  }, [rows]);

  if (!data?.karyawan) return null;
  if (data.karyawan.role !== "Manager") {
    return (
      <AppShell role={data.karyawan.role} nama={data.karyawan.nama_karyawan} nik={data.karyawan.nik}>
        <Card><CardHeader><CardTitle>Akses ditolak</CardTitle><CardDescription>Halaman ini khusus Manager.</CardDescription></CardHeader></Card>
      </AppShell>
    );
  }

  return (
    <AppShell role={data.karyawan.role} nama={data.karyawan.nama_karyawan} nik={data.karyawan.nik}>
      <div className="space-y-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CalendarClock className="h-6 w-6" /> Log & Histori Absensi
          </h1>
          <p className="text-sm text-muted-foreground">
            Rekap kehadiran & kedisiplinan karyawan berdasarkan shift kerja.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Entri</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{stats.total}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Masuk Kerja</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-primary">{stats.masuk}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Libur</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-muted-foreground">{stats.libur}</div></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1"><Label htmlFor="from">Dari</Label><Input id="from" type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-44" /></div>
              <div className="space-y-1"><Label htmlFor="to">Sampai</Label><Input id="to" type="date" value={to} onChange={e => setTo(e.target.value)} className="w-44" /></div>
              <div className="space-y-1">
                <Label>Cabang</Label>
                <Select value={filterCabang} onValueChange={setFilterCabang}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Cabang</SelectItem>
                    {cabangList.map(c => <SelectItem key={c.id_cabang} value={c.id_cabang}>{c.nama_cabang}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <CardDescription className="ml-auto">{rows.length} baris</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Tanggal</TableHead><TableHead>Karyawan</TableHead><TableHead>NIK</TableHead>
                <TableHead>Cabang</TableHead><TableHead>Status</TableHead><TableHead>Shift</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id_jadwal}>
                    <TableCell className="font-mono text-xs">{r.tanggal}</TableCell>
                    <TableCell>{r.karyawan?.nama_karyawan ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.karyawan?.nik ?? "—"}</TableCell>
                    <TableCell>{r.cabang?.nama_cabang ?? "—"}</TableCell>
                    <TableCell><Badge variant={r.status_hari === "LIBUR" ? "secondary" : "default"}>{r.status_hari}</Badge></TableCell>
                    <TableCell>{r.shift ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Tidak ada data untuk rentang ini.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}