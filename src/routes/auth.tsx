import logo from "@/assets/tokovapeku-logo.png";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { nikToEmail } from "@/lib/nik";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, AlertCircle } from "lucide-react";
import { todayWIB } from "@/lib/date-wib";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Masuk — Tokovapeku HRIS" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [nik, setNik] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app" });
    });
  }, [navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!nik || !password) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const email = nikToEmail(nik);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        const msg = error?.message?.toLowerCase().includes("invalid")
          ? "NIK atau password salah."
          : error?.message ?? "Login gagal. Periksa NIK dan password Anda.";
        setErrorMsg(msg);
        toast.error("Login gagal", { description: msg });
        setLoading(false);
        return;
      }

      // GERBANG 1: status_akun di tabel karyawan
      const { data: kar, error: karErr } = await supabase
        .from("karyawan")
        .select("status_akun, nama_karyawan, role")
        .eq("id_karyawan", data.user.id)
        .maybeSingle();
      if (karErr) {
        await supabase.auth.signOut();
        setErrorMsg(`Gagal memuat data karyawan: ${karErr.message}`);
        setLoading(false);
        return;
      }
      if (!kar) {
        await supabase.auth.signOut();
        setErrorMsg("Akun auth ditemukan tetapi tidak terdaftar sebagai karyawan. Hubungi Manager.");
        setLoading(false);
        return;
      }
      if (kar.status_akun === "Nonaktif") {
        await supabase.auth.signOut();
        setErrorMsg("Akun Anda sudah dinonaktifkan. Silakan hubungi Manager.");
        setLoading(false);
        return;
      }

      // GERBANG 2: jadwal hari ini (bypass untuk Manager)
      let liburHariIni = false;
      if (kar.role !== "Manager") {
        const today = todayWIB();
        const { data: jad } = await supabase
          .from("jadwal_kerja")
          .select("status_hari")
          .eq("id_karyawan", data.user.id)
          .eq("tanggal", today)
          .maybeSingle();
        if (jad?.status_hari === "LIBUR") {
          liburHariIni = true;
        }
      }

      // GERBANG 3: role splitting → dashboard sesuai jabatan
      toast.success(`Selamat datang, ${kar.nama_karyawan}`);
      // Semua role diarahkan ke dashboard utama setelah login.
      navigate({ to: "/app" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan tak terduga.";
      setErrorMsg(msg);
      toast.error("Login gagal", { description: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/40 to-accent/30 px-4">
      <Card className="w-full max-w-md shadow-xl border-border/60">
        <CardHeader className="space-y-3 text-center">
          <img src={logo} alt="Tokovapeku" className="mx-auto h-36 w-auto object-contain" />
          <div>
            <CardTitle className="text-2xl">Tokovapeku HRIS</CardTitle>
            <CardDescription>Task Management & Checklist Kerja</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nik">NIK Karyawan</Label>
              <Input
                id="nik"
                value={nik}
                onChange={(e) => setNik(e.target.value)}
                placeholder="contoh: 2024001"
                autoComplete="username"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Masuk
            </Button>
            {errorMsg && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              >
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            <p className="text-xs text-center text-muted-foreground/80">
              Akun dibuat oleh manager. Belum punya akun silakan hubungi manager
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
