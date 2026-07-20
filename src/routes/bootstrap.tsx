import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Lock, Unlock, AlertTriangle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { bootstrapManager, getBootstrapStatus } from "@/lib/admin/users.functions";
import { supabase } from "@/integrations/supabase/client";
import { nikToEmail } from "@/lib/nik";

export const Route = createFileRoute("/bootstrap")({
  ssr: false,
  head: () => ({ meta: [{ title: "Setup Awal — Tokovapeku HRIS" }] }),
  component: BootstrapPage,
});

function BootstrapPage() {
  const navigate = useNavigate();
  const runBootstrap = useServerFn(bootstrapManager);
  const checkStatus = useServerFn(getBootstrapStatus);

  const [nik, setNik] = useState("");
  const [nama, setNama] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState<{ open: boolean; count: number } | null>(null);

  useEffect(() => {
    checkStatus({ data: undefined })
      .then((s) => setStatus(s))
      .finally(() => setChecking(false));
  }, [checkStatus]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nik || !nama || !password) {
      toast.error("Lengkapi semua kolom");
      return;
    }
    if (password.length < 6) {
      toast.error("Password minimal 6 karakter");
      return;
    }
    setLoading(true);
    try {
      await runBootstrap({ data: { nik, nama_karyawan: nama, password } });
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: nikToEmail(nik),
        password,
      });
      if (signInErr) {
        toast.success("Manager pertama berhasil dibuat", {
          description: "Silakan masuk dengan NIK & password yang baru.",
        });
        navigate({ to: "/auth" });
      } else {
        toast.success("Selamat datang, Manager!");
        navigate({ to: "/app" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal melakukan bootstrap";
      toast.error("Bootstrap gagal", { description: msg });
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/40 to-accent/30 px-4">
        <Card className="w-full max-w-lg shadow-xl border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">Memeriksa status setup...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLocked = !status?.open;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/40 to-accent/30 px-4 py-10">
      <Card className="w-full max-w-lg shadow-xl border-border/60">
        <CardHeader className="space-y-3 text-center">
          <img src={logo.url} alt="Tokovapeku" className="mx-auto h-14 w-14 object-contain" />
          <div className="flex items-center justify-center gap-2">
            <CardTitle className="text-2xl">{isLocked ? "Setup Ditutup" : "Setup Manager Pertama"}</CardTitle>
          </div>
          <CardDescription>
            {isLocked
              ? "Akun Manager pertama sudah terdaftar. Hubungi Manager untuk membuat akun baru."
              : "Daftarkan akun Manager pertama. Form ini hanya aktif saat tabel karyawan masih kosong."}
          </CardDescription>
          <div className="flex justify-center pt-1">
            {isLocked ? (
              <Badge variant="destructive" className="gap-1">
                <Lock className="h-3 w-3" />
                Terkunci · {status?.count ?? 0} karyawan terdaftar
              </Badge>
            ) : (
              <Badge variant="default" className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Unlock className="h-3 w-3" />
                Terbuka · Belum ada karyawan
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLocked ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-4 text-center">
                <AlertTriangle className="mx-auto h-8 w-8 text-destructive/80 mb-2" />
                <p className="text-sm font-medium text-destructive">Bootstrap sudah ditutup</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Sistem mendeteksi sudah ada {status?.count ?? 0} karyawan di database. Setup Manager pertama tidak tersedia lagi.
                </p>
              </div>
              <Button asChild variant="outline" className="w-full gap-2">
                <Link to="/auth">
                  <ArrowLeft className="h-4 w-4" />
                  Kembali ke Halaman Masuk
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nik">NIK Manager</Label>
                <Input
                  id="nik"
                  value={nik}
                  onChange={(e) => setNik(e.target.value)}
                  placeholder="contoh: 100001"
                  autoComplete="username"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nama">Nama Lengkap</Label>
                <Input
                  id="nama"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Nama Manager"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password (min. 6 karakter)</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Buat Akun Manager
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Sudah punya akun?{" "}
                <Link to="/auth" className="text-primary hover:underline">
                  Kembali ke halaman masuk
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}