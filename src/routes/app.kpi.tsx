import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export const Route = createFileRoute("/app/kpi")({
  ssr: false,
  component: KpiPage,
});

function KpiPage() {
  const { data } = useCurrentUser();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [perKaryawan, setPerKaryawan] = useState<{ nama: string; poin: number; tugas: number }[]>([]);
  const [perCabang, setPerCabang] = useState<{ nama: string; poin: number; bocor: number }[]>([]);

  useEffect(() => {
    (async () => {
      const start = `${month}-01`;
      const end = new Date(month + "-01");
      end.setMonth(end.getMonth() + 1);
      const endStr = end.toISOString().slice(0, 10);
      const { data: rows } = await supabase
        .from("transaksi_ceklist_harian")
        .select(
          "id_karyawan,id_cabang,poin_didapat,status_upload,status_tugas,karyawan:karyawan(nama_karyawan),cabang:cabang(nama_cabang),sop:master_ceklist_sop(bobot_poin)",
        )
        .gte("tanggal", start)
        .lt("tanggal", endStr);
      const kMap = new Map<string, { nama: string; poin: number; tugas: number }>();
      const cMap = new Map<string, { nama: string; poin: number; bocor: number }>();
      (rows ?? []).forEach((r: any) => {
        const kn = r.karyawan?.nama_karyawan ?? "?";
        const cn = r.cabang?.nama_cabang ?? "?";
        const k = kMap.get(r.id_karyawan) ?? { nama: kn, poin: 0, tugas: 0 };
        k.poin += Number(r.poin_didapat ?? 0);
        k.tugas += 1;
        kMap.set(r.id_karyawan, k);
        const c = cMap.get(r.id_cabang) ?? { nama: cn, poin: 0, bocor: 0 };
        // Cabang dapat poin penuh (bobot) jika tugas disetujui apa pun, 0 jika ALFA/Ditolak
        const bobot = Number(r.sop?.bobot_poin ?? 0);
        if (
          r.status_tugas === "Disetujui (Murni)" ||
          r.status_tugas === "Disetujui dengan Penalti"
        ) {
          c.poin += bobot;
        } else if (r.status_upload === "ALFA" || r.status_tugas === "Ditolak") {
          c.bocor += bobot;
        }
        cMap.set(r.id_cabang, c);
      });
      setPerKaryawan([...kMap.values()].sort((a, b) => b.poin - a.poin).slice(0, 20));
      setPerCabang([...cMap.values()].sort((a, b) => b.poin - a.poin));
    })();
  }, [month]);

  if (!data?.karyawan) return null;

  return (
    <AppShell role={data.karyawan.role} nama={data.karyawan.nama_karyawan} nik={data.karyawan.nik}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Laporan KPI</h1>
            <p className="text-sm text-muted-foreground">Performa per karyawan & per cabang, dihitung real-time dari poin transaksi.</p>
          </div>
          <div>
            <Label htmlFor="m">Bulan</Label>
            <Input id="m" type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-48" />
          </div>
        </div>

        <Tabs defaultValue="karyawan">
          <TabsList>
            <TabsTrigger value="karyawan">KPI Karyawan</TabsTrigger>
            <TabsTrigger value="cabang">KPI Cabang</TabsTrigger>
          </TabsList>
          <TabsContent value="karyawan">
            <Card>
              <CardHeader>
                <CardTitle>Top Karyawan — Akumulasi Poin</CardTitle>
                <CardDescription>Penalti −20% sudah termasuk dalam perhitungan personal.</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perKaryawan}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nama" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="poin" fill="hsl(220, 80%, 55%)" name="Poin" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="cabang">
            <Card>
              <CardHeader>
                <CardTitle>KPI Toko — Poin vs Kebocoran</CardTitle>
                <CardDescription>Cabang menerima 100% bobot untuk tugas yang disetujui (Murni / Penalti). Kebocoran = ALFA + Ditolak.</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perCabang}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nama" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="poin" fill="hsl(150, 60%, 45%)" name="Poin Toko" />
                    <Bar dataKey="bocor" fill="hsl(0, 75%, 55%)" name="Kebocoran" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}