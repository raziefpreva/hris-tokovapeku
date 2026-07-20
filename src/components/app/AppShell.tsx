import logo from "@/assets/tokovapeku-logo.png";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { clearMockSession } from "@/lib/auth/mockSession";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { DialogTitle, DialogDescription } from "@radix-ui/react-dialog";
import { useState } from "react";
import {
  LayoutDashboard,
  ClipboardCheck,
  CheckSquare,
  Building2,
  Users,
  ListChecks,
  CalendarDays,
  BarChart3,
  LogOut,
  Store,
  Menu,
  CalendarClock,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Role = "Manager" | "Captain" | "Vaporista";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
  group?: string;
}

const NAV: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, roles: ["Manager", "Captain", "Vaporista"], group: "Overview" },
  { to: "/app/tugas", label: "Tugas Saya", icon: CheckSquare, roles: ["Vaporista", "Captain"], group: "Overview" },
  { to: "/app/master/cabang", label: "Master Cabang", icon: Building2, roles: ["Manager"], group: "Master Data" },
  { to: "/app/master/karyawan", label: "Master Karyawan & Akun", icon: Users, roles: ["Manager"], group: "Master Data" },
  { to: "/app/master/jadwal", label: "Master Jadwal & Shift", icon: CalendarDays, roles: ["Manager"], group: "Master Data" },
  { to: "/app/master/sop", label: "Master Ceklist SOP", icon: ListChecks, roles: ["Manager"], group: "Master Data" },
  { to: "/app/monitoring-tugas", label: "Monitoring Tugas", icon: ClipboardList, roles: ["Manager"], group: "Transaksi & Validasi" },
  { to: "/app/verifikasi", label: "Verifikasi Ceklist", icon: ClipboardCheck, roles: ["Captain", "Manager"], group: "Transaksi & Validasi" },
  { to: "/app/absensi", label: "Log & Histori Absensi", icon: CalendarClock, roles: ["Manager"], group: "Transaksi & Validasi" },
  { to: "/app/kpi", label: "Laporan & Analisa KPI", icon: BarChart3, roles: ["Captain", "Manager"], group: "Laporan" },
];

export function AppShell({
  children,
  role,
  nama,
  nik,
}: {
  children: ReactNode;
  role: Role;
  nama: string;
  nik: string;
}) {
  const nav = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  async function logout() {
    clearMockSession();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  }

  const items = NAV.filter((i) => i.roles.includes(role));
  const grouped = items.reduce<Record<string, NavItem[]>>((acc, item) => {
    const g = item.group ?? "Menu";
    (acc[g] ||= []).push(item);
    return acc;
  }, {});

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {Object.entries(grouped).map(([group, groupItems]) => (
        <div key={group} className="mb-3">
          <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {group}
          </p>
          <div className="space-y-0.5">
            {groupItems.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.to || (item.to !== "/app" && pathname.startsWith(item.to));
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/70 hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );

  return (
    <div className="min-h-screen bg-secondary/30">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-card lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <img src={logo} alt="Tokovapeku" className="h-9 w-9 object-contain" />
          <div>
            <p className="font-semibold leading-tight">Tokovapeku HRIS</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Task Management
            </p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <NavList />
        </nav>
        <div className="border-t p-4">
          <div className="mb-3 space-y-1">
            <p className="text-sm font-medium">{nama}</p>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                {role}
              </Badge>
              <span className="text-xs text-muted-foreground">NIK {nik}</span>
            </div>
          </div>
          <Button variant="destructive" size="sm" className="w-full" onClick={logout}>
            <LogOut className="mr-2 h-3.5 w-3.5" />
            Keluar / Logout
          </Button>
        </div>
      </aside>

      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-card px-4 lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button size="icon" variant="ghost" aria-label="Buka menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <VisuallyHidden>
              <DialogTitle>Menu Navigasi</DialogTitle>
              <DialogDescription>Navigasi utama Tokovapeku HRIS</DialogDescription>
            </VisuallyHidden>
            <div className="flex h-16 items-center gap-2 border-b px-5">
              <img src={logo} alt="Tokovapeku" className="h-9 w-9 object-contain" />
              <div>
                <p className="font-semibold leading-tight">Tokovapeku HRIS</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Task Management
                </p>
              </div>
            </div>
            <nav className="space-y-1 p-3">
              <NavList onNavigate={() => setMobileOpen(false)} />
            </nav>
            <div className="border-t p-4">
              <div className="mb-3 space-y-1">
                <p className="text-sm font-medium">{nama}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{role}</Badge>
                  <span className="text-xs text-muted-foreground">NIK {nik}</span>
                </div>
              </div>
              <Button variant="destructive" size="sm" className="w-full" onClick={logout}>
                <LogOut className="mr-2 h-3.5 w-3.5" />
                Keluar / Logout
              </Button>
            </div>
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <img src={logo} alt="Tokovapeku" className="h-6 w-6 object-contain" />
          <span className="font-semibold">Tokovapeku HRIS</span>
        </div>
        <Button size="sm" variant="destructive" onClick={logout}>
          <LogOut className="mr-1 h-4 w-4" />
          Keluar
        </Button>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-lg px-4 py-4 pb-24 lg:max-w-4xl lg:px-6 lg:py-8 lg:pb-8">{children}</div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white shadow-[0_-1px_3px_rgba(0,0,0,0.04)] lg:hidden">
        <div className="grid grid-cols-4">
          {(role === "Manager"
            ? [
                { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
                { to: "/app/monitoring-tugas", label: "Monitoring", icon: ClipboardList, exact: false },
                { to: "/app/verifikasi", label: "Verifikasi", icon: ClipboardCheck, exact: false },
                { to: "/app/kpi", label: "Laporan", icon: BarChart3, exact: false },
              ]
            : role === "Captain"
            ? [
                { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
                { to: "/app/tugas", label: "Tugas Saya", icon: CheckSquare, exact: false },
                { to: "/app/verifikasi", label: "Verifikasi", icon: ClipboardCheck, exact: false },
                { to: "/app/absensi", label: "Absensi", icon: CalendarClock, exact: false },
              ]
            : [
                { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
                { to: "/app/tugas", label: "Tugas Saya", icon: CheckSquare, exact: false },
                { to: "/app/absensi", label: "Absensi", icon: CalendarClock, exact: false },
                { to: "/app/kpi", label: "Laporan", icon: BarChart3, exact: false },
              ]
          ).map((t) => {
            const Icon = t.icon;
            const active = t.exact ? pathname === t.to : pathname === t.to || pathname.startsWith(t.to + "/");
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-2 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {t.label}
              </Link>
            );
          })}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </div>
  );
}