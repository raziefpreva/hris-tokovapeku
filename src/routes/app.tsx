import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getMockSession } from "@/lib/auth/mockSession";

export const Route = createFileRoute("/app")({
  ssr: false,
  beforeLoad: async () => {
    const mock = getMockSession();
    if (mock) return { user: { id: mock.userId, email: null } };
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => <Outlet />,
});