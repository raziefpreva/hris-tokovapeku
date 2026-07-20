import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { MobileShell } from "@/components/app/MobileShell";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Coffee, Calendar, Building2, CheckSquare, ClipboardCheck, Users, CalendarDays, ListChecks, BarChart3, Clock, AlertCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { todayWIB } from "@/lib/date-wib";
import { useProgressCabang, progressTone } from "@/hooks/useProgressCabang";

export const Route = createFileRoute("/app/")({
  ssr: false,
  component: Dashboard,
});

function Dashboard() {
  const { data, loading, profileError } = useCurrentUser();
  const [stats, setStats] = useState<{
    tugasHariIni: number;
    menungguVerif: number;
    cabangCount: number;
    karyawanAktif: number;
    jadwalHariIni: number;
  }>({ tugasHariIni: 0, menungguVerif: 0, cabangCount: 0, karyawanAktif: 0, jadwalHariIni: 0 });
  const [myStats, setMyStats] = useState<{ belum: number; menunggu: number; acc: number; ditolak: number }>(
    { belum: 0, menunggu: 0, acc: 0, ditolak: 0 },
  );

  const today = todayWIB();
  const isManagerRole = data?.karyawan?.role === "Manager";
  // Manager → semua cabang. Non-Manager → cabang yang di-assign ke user (karyawan_cabang_pivot).
  const progressCabangIds: string[] | null = !data?.karyawan
    ? []
    : isManagerRole
      ? null
      : (data.cabangIds ?? []);
  const { data: cabangProgress } = useProgressCabang(progressCabangIds, today);

  async function loadStats() {
    if (!data?.karyawan) return;
    const today = todayWIB();
    const todayDow = new Date(today + "T00:00:00+07:00").getDay();
    const [txToday, txPending, cabCount, karyawanAktif, jadwalCount, pivotRows] = await Promise.all([
      supabase.from("transaksi_ceklist_harian").select("id_tugas", { count: "exact", head: true }).eq("tanggal", today),
      supabase.from("transaksi_ceklist_harian").select("id_tugas", { count: "exact", head: true }).eq("status_tugas", "Menunggu Verifikasi").eq("tanggal", today),
      supabase.from("cabang").select("id_cabang", { count: "exact", head: true }),
      supabase.from("karyawan").select("id_karyawan", { count: "exact", head: true }).eq("status_akun", "Aktif"),
      supabase.from("jadwal_kerja").select("id_jadwal", { count: "exact", head: true }).eq("tanggal", today).eq("status_hari", "Masuk Kerja"),
      supabase
        .from("sop_cabang_pivot")
        .select("id_sop, master_ceklist_sop!inner(aktif,hari_berlaku)"),
    ]);
    // Expected tasks today = jumlah pasangan (sop × cabang) yang aktif dan hari_berlaku mencakup hari ini.
    let expectedToday = 0;
    for (const row of (pivotRows.data ?? []) as any[]) {
      const sop = row.master_ceklist_sop;
      if (!sop?.aktif) continue;
      const hari = sop.hari_berlaku;
      if (!Array.isArray(hari) || hari.length === 0 || hari.includes(todayDow)) {
        expectedToday += 1;
      }
    }
    const tugasCount = (txToday.count ?? 0) > 0 ? (txToday.count ?? 0) : expectedToday;
    setStats({
      tugasHariIni: tugasCount,
      menungguVerif: txPending.count ?? 0,
      cabangCount: cabCount.count ?? 0,
      karyawanAktif: karyawanAktif.count ?? 0,
      jadwalHariIni: jadwalCount.count ?? 0,
    });
  }

  useEffect(() => {
    if (!data?.karyawan) return;
    loadStats();
    const onFocus = () => loadStats();
    window.addEventListener("focus", onFocus);
    if (data.karyawan.role !== "Manager") {
      (async () => {
        const cabangAktifList = (data.jadwalHariIni?.id_cabang_list && data.jadwalHariIni.id_cabang_list.length > 0)
          ? data.jadwalHariIni.id_cabang_list
          : (data.jadwalHariIni?.id_cabang ? [data.jadwalHariIni.id_cabang] : []);
        const shiftAktifList = (data.jadwalHariIni?.shifts && data.jadwalHariIni.shifts.length > 0)
          ? data.jadwalHariIni.shifts.map((s: string) => s.toLowerCase())
          : (data.jadwalHariIni?.shift ? [data.jadwalHariIni.shift.toLowerCase()] : []);

        let q = supabase
          .from("transaksi_ceklist_harian")
          .select("id_sop, status_tugas, sop:master_ceklist_sop(tipe_shifts)")
          .eq("tanggal", today);
        if (cabangAktifList.length > 0) {
          q = q.in("id_cabang", cabangAktifList);
        } else {
          q = q.eq("id_karyawan", data.karyawan!.id_karyawan);
        }
        const { data: mine } = await q;
        const rankStatus = (s: string) => {
          if (s === "Disetujui (Murni)" || s === "Disetujui dengan Penalti") return 4;
          if (s === "Menunggu Verifikasi") return 3;
          if (s === "Ditolak") return 2;
          return 1;
        };
        const byKey = new Map<string, string>();
        for (const r of (mine ?? []) as any[]) {
          const sopShifts = (r.sop as any)?.tipe_shifts;
          if (Array.isArray(sopShifts) && sopShifts.length > 0 && shiftAktifList.length > 0) {
            const match = sopShifts.some((s: string) => shiftAktifList.includes(String(s).toLowerCase()));
            if (!match) continue;
          }
          const key = r.id_sop ?? r.status_tugas;
          const prev = byKey.get(key);
          if (!prev || rankStatus(r.status_tugas) > rankStatus(prev)) {
            byKey.set(key, r.status_tugas);
          }
        }
        const counts = { belum: 0, menunggu: 0, acc: 0, ditolak: 0 };
        for (const status of byKey.values()) {
          if (status === "Belum Dikerjakan") counts.belum++;
          else if (status === "Menunggu Verifikasi") counts.menunggu++;
          else if (status === "Disetujui (Murni)" || status === "Disetujui dengan Penalti") counts.acc++;
          else if (status === "Ditolak") counts.ditolak++;
        }
        setMyStats(counts);
      })();
    }
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.karyawan]);

  if (loading || !data) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!data.karyawan) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Profil Karyawan tidak ditemukan</CardTitle>
            <CardDescription>
              Sistem mencoba membuat profil otomatis namun gagal. Detail error di bawah ini
              dapat membantu menemukan field yang ditolak database.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {profileError ? (
              <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs text-destructive">
                {profileError}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">Tidak ada pesan error tambahan.</p>
            )}
            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()}>Coba Lagi</Button>
              <Button
                variant="outline"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = "/auth";
                }}
              >
                Logout & Login Ulang
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { karyawan, jadwalHariIni } = data;

  if (karyawan.role !== "Manager" && jadwalHariIni?.status_hari === "LIBUR") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/30 p-6 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Coffee className="h-12 w-12" />
        </div>
        <h1 className="mt-6 text-3xl font-bold">Hari ini Anda Libur</h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          Selamat Beristirahat! 🌿 Workspace pengisian tugas dikunci selama hari OFF Anda. Sampai
          jumpa di shift berikutnya, <span className="font-medium">{karyawan.nama_karyawan}</span>.
        </p>
        <Button variant="outline" className="mt-6" onClick={async () => { await supabase.auth.signOut(); window.location.href = "/auth"; }}>
          Keluar
        </Button>
      </div>
    );
  }

  const isManager = karyawan.role === "Manager";
  const content = (
    <div className="space-y-6">
        <div>
          <h1 className={isManager ? "text-2xl font-bold" : "text-xl font-bold leading-tight"}>
            Halo, {karyawan.nama_karyawan}
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {jadwalHariIni
              ? `Hari ini: ${jadwalHariIni.status_hari}${(jadwalHariIni.shifts && jadwalHariIni.shifts.length > 0) ? " · " + jadwalHariIni.shifts.join(" + ") : (jadwalHariIni.shift ? " · " + jadwalHariIni.shift : "")}`
              : "Tidak ada jadwal terdaftar untuk hari ini."}
          </p>
        </div>

        {isManager ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total Cabang" value={stats.cabangCount} icon={Building2} hint="Cabang terdaftar" to="/app/master/cabang" />
              <StatCard label="Karyawan Aktif" value={stats.karyawanAktif} icon={Users} hint="Status akun aktif" to="/app/master/karyawan" />
              <StatCard label="Jadwal Masuk Hari Ini" value={stats.jadwalHariIni} icon={CalendarDays} hint="Karyawan dijadwalkan masuk" to="/app/master/jadwal" />
              <StatCard label="Tugas Hari Ini" value={stats.tugasHariIni} icon={CheckSquare} hint="Total tugas tercatat" to="/app/tugas" />
            </div>

            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-primary" /> Antrian Verifikasi Ceklist
                  </CardTitle>
                  <CardDescription>Tugas dari Captain / Vaporista yang menunggu ACC atau Reject.</CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-primary">{stats.menungguVerif}</div>
                  <p className="text-xs text-muted-foreground">tugas pending</p>
                </div>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link to="/app/tugas">
                    <ClipboardCheck className="mr-2 h-4 w-4" /> Buka Antrian Verifikasi
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4 text-primary" /> Progress Ceklist Cabang Hari Ini
                </CardTitle>
                <CardDescription>Klik baris cabang untuk membuka antrian verifikasi terfilter.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {cabangProgress.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">Belum ada data cabang.</p>
                )}
                {cabangProgress.map((c) => {
                  const pct = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
                  const tone = progressTone(pct);
                  return (
                    <Link
                      key={c.id_cabang}
                      to="/app/tugas"
                      search={{ cabang: c.id_cabang, team: "1" } as any}
                      className="block rounded-lg border bg-card p-3 transition hover:border-primary hover:bg-primary/5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{c.nama_cabang}</p>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold tabular-nums ${tone.text}`}>{pct}%</span>
                          <Badge variant="outline" className="text-[10px]">{c.done}/{c.total}</Badge>
                        </div>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full transition-all ${tone.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatusCard
                label="Belum Dikerjakan"
                value={myStats.belum}
                icon={AlertCircle}
                tone="red"
                to="/app/tugas"
                search={{ status: "belum" }}
              />
              <StatusCard
                label="Menunggu Verifikasi"
                value={myStats.menunggu}
                icon={Clock}
                tone="amber"
                to="/app/tugas"
                search={{ status: "menunggu" }}
              />
              <StatusCard
                label="Sudah ACC"
                value={myStats.acc}
                icon={ClipboardCheck}
                tone="emerald"
                to="/app/tugas"
                search={{ status: "acc" }}
              />
              <StatusCard
                label="Ditolak"
                value={myStats.ditolak}
                icon={XCircle}
                tone="darkred"
                to="/app/tugas"
                search={{ status: "ditolak" }}
                hint="Perlu dikerjakan ulang"
              />
            </div>

            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4 text-primary" /> Progress Cabang Hari Ini
                </CardTitle>
                <CardDescription className="text-xs">
                  Progress seluruh tim di cabang & shift Anda hari ini. Tap untuk lihat semua tugas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 p-4 pt-2">
                {cabangProgress.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Belum ada cabang yang ditugaskan ke Anda.
                  </p>
                )}
                {cabangProgress.map((c) => {
                  const pct = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
                  const tone = progressTone(pct);
                  return (
                    <Link
                      key={c.id_cabang}
                      to="/app/tugas"
                      search={{ cabang: c.id_cabang, team: "1" } as any}
                      className="block rounded-lg border bg-card p-3 transition hover:border-primary hover:bg-primary/5 active:scale-[0.99]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{c.nama_cabang}</p>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold tabular-nums ${tone.text}`}>{pct}%</span>
                          <Badge variant="outline" className="text-[10px]">{c.done}/{c.total}</Badge>
                        </div>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full transition-all ${tone.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>

            {karyawan.role === "Captain" && (
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ClipboardCheck className="h-4 w-4 text-primary" /> Antrian Verifikasi
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <Button asChild className="h-11 w-full">
                    <Link to="/app/tugas">
                      <ClipboardCheck className="mr-2 h-4 w-4" /> {stats.menungguVerif} menunggu ACC
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}

        <Card>
          <CardHeader className="p-4 pb-2"><CardTitle className="text-base">Aksi Cepat</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2 p-4 pt-2 sm:flex-row sm:flex-wrap">
            {!isManager && (
              <Button asChild className="h-11 w-full justify-start sm:w-auto"><Link to="/app/tugas"><CheckSquare className="mr-2 h-4 w-4" /> Buka Tugas Saya</Link></Button>
            )}
            {(karyawan.role === "Captain" || karyawan.role === "Manager") && (
              <Button asChild variant="secondary" className="h-11 w-full justify-start sm:w-auto"><Link to="/app/tugas"><ClipboardCheck className="mr-2 h-4 w-4" /> Antrian Verifikasi</Link></Button>
            )}
            {isManager && (
              <>
                <Button asChild variant="outline"><Link to="/app/master/karyawan"><Users className="mr-2 h-4 w-4" /> Kelola Karyawan</Link></Button>
                <Button asChild variant="outline"><Link to="/app/master/cabang"><Building2 className="mr-2 h-4 w-4" /> Kelola Cabang</Link></Button>
                <Button asChild variant="outline"><Link to="/app/master/jadwal"><CalendarDays className="mr-2 h-4 w-4" /> Jadwal & Shift</Link></Button>
                <Button asChild variant="outline"><Link to="/app/master/sop"><ListChecks className="mr-2 h-4 w-4" /> Ceklist SOP</Link></Button>
                <Button asChild variant="outline"><Link to="/app/absensi"><Calendar className="mr-2 h-4 w-4" /> Log Absensi</Link></Button>
                <Button asChild variant="outline"><Link to="/app/kpi"><BarChart3 className="mr-2 h-4 w-4" /> Laporan KPI</Link></Button>
              </>
            )}
          </CardContent>
        </Card>
    </div>
  );

  if (isManager) {
    return (
      <AppShell role={karyawan.role} nama={karyawan.nama_karyawan} nik={karyawan.nik}>
        {content}
      </AppShell>
    );
  }
  return <MobileShell role={karyawan.role}>{content}</MobileShell>;
}

function StatCard({ label, value, icon: Icon, hint, to }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; hint?: string; to?: string }) {
  const card = (
    <Card className={to ? "cursor-pointer hover:shadow-md hover:border-blue-300 transition-all duration-200" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
  if (to) {
    return <Link to={to as any} className="block">{card}</Link>;
  }
  return card;
}

function StatusCard({
  label,
  value,
  icon: Icon,
  tone,
  to,
  search,
  hint,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "red" | "amber" | "emerald" | "darkred";
  to: string;
  search?: Record<string, string>;
  hint?: string;
}) {
  const toneMap = {
    red: { badge: "bg-red-100 text-red-700 border-red-200", icon: "text-red-600", value: "text-red-700" },
    amber: { badge: "bg-amber-100 text-amber-800 border-amber-200", icon: "text-amber-600", value: "text-amber-700" },
    emerald: { badge: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: "text-emerald-600", value: "text-emerald-700" },
    darkred: { badge: "bg-red-200 text-red-900 border-red-300", icon: "text-red-800", value: "text-red-900" },
  } as const;
  const t = toneMap[tone];
  return (
    <Link
      to={to as any}
      search={search as any}
      className="block cursor-pointer active:scale-95 transition-all hover:shadow-md"
    >
      <Card className="h-full">
        <CardContent className="flex flex-col items-center gap-1 p-3 text-center">
          <Badge variant="outline" className={`gap-1 ${t.badge}`}>
            <Icon className={`h-3 w-3 ${t.icon}`} /> {label}
          </Badge>
          <div className={`mt-1 text-3xl font-bold tabular-nums ${t.value}`}>{value}</div>
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}