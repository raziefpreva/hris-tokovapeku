import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MobileShell } from "@/components/app/MobileShell";
import { AppShell } from "@/components/app/AppShell";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { clearMockSession } from "@/lib/auth/mockSession";
import { Loader2, LogOut, User, Building2, BadgeCheck } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/app/profil")({
  ssr: false,
  component: ProfilPage,
});

function ProfilPage() {
  const { data, loading } = useCurrentUser();
  const nav = useNavigate();
  const [cabangNames, setCabangNames] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      if (!data?.cabangIds?.length) { setCabangNames([]); return; }
      const { data: rows } = await supabase
        .from("cabang").select("nama_cabang").in("id_cabang", data.cabangIds);
      setCabangNames((rows ?? []).map((r: any) => r.nama_cabang));
    })();
  }, [data?.cabangIds]);

  async function logout() {
    clearMockSession();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  }

  if (loading || !data?.karyawan) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  const k = data.karyawan;

  const body = (
    <div className="space-y-4">
      <div className="flex flex-col items-center pt-2">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
          <User className="h-10 w-10" />
        </div>
        <h1 className="mt-3 text-xl font-bold">{k.nama_karyawan}</h1>
        <p className="text-xs text-muted-foreground">NIK {k.nik}</p>
        <Badge variant="secondary" className="mt-2">{k.role}</Badge>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><BadgeCheck className="h-4 w-4 text-primary" />Akun</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-medium">{k.status_akun}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="truncate font-medium">{data.email ?? "-"}</span></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4 text-primary" />Cabang Penempatan</CardTitle></CardHeader>
        <CardContent>
          {cabangNames.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada cabang ditugaskan.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {cabangNames.map((n) => <li key={n} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" />{n}</li>)}
            </ul>
          )}
        </CardContent>
      </Card>

      <Button variant="destructive" className="h-11 w-full" onClick={logout}>
        <LogOut className="mr-2 h-4 w-4" />Keluar / Logout
      </Button>
    </div>
  );

  if (k.role === "Manager") {
    return <AppShell role={k.role} nama={k.nama_karyawan} nik={k.nik}>{body}</AppShell>;
  }
  return <MobileShell role={k.role}>{body}</MobileShell>;
}