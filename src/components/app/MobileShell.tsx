import logo from "@/assets/tokovapeku-logo.png";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { clearMockSession } from "@/lib/auth/mockSession";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, CheckSquare, ClipboardCheck, LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { useTodayWIB } from "@/lib/date-wib";

type Role = "Manager" | "Captain" | "Vaporista";

const TABS: { to: string; label: string; icon: React.ComponentType<{ className?: string }>; roles: Role[] }[] = [
  { to: "/app", label: "Beranda", icon: LayoutDashboard, roles: ["Vaporista", "Captain"] },
  { to: "/app/tugas", label: "Tugas", icon: CheckSquare, roles: ["Vaporista", "Captain"] },
  { to: "/app/verifikasi", label: "Verifikasi", icon: ClipboardCheck, roles: ["Captain", "Manager"] },
  { to: "/app/profil", label: "Profil", icon: User, roles: ["Vaporista", "Captain"] },
];

const WIB_DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const WIB_MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function formatTodayWIB(iso: string) {
  // iso = YYYY-MM-DD (WIB)
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  return `${WIB_DAY_NAMES[dt.getUTCDay()]}, ${d} ${WIB_MONTH_NAMES[(m ?? 1) - 1]} ${y}`;
}

export function MobileShell({
  children,
  role,
}: {
  children: ReactNode;
  role: Role;
}) {
  const nav = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const today = useTodayWIB();
  const items = TABS.filter((t) => t.roles.includes(role));

  async function logout() {
    clearMockSession();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen w-full bg-secondary/30">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background shadow-sm">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b bg-card/95 px-4 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2">
            <img src={logo} alt="Tokovapeku" className="h-10 w-auto shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">Tokovapeku</p>
              <p className="truncate text-[10px] text-muted-foreground">{formatTodayWIB(today)}</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={logout} aria-label="Keluar">
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-x-hidden px-4 pb-24 pt-4">{children}</main>

        {/* Bottom nav */}
        {items.length > 1 && (
          <nav className="sticky bottom-0 z-20 mt-auto border-t bg-card/95 backdrop-blur">
            <div
              className="grid"
              style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
            >
              {items.map((t) => {
                const Icon = t.icon;
                const active = pathname === t.to || (t.to !== "/app" && pathname.startsWith(t.to));
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
        )}
      </div>
    </div>
  );
}