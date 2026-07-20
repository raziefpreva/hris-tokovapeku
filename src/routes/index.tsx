import { createFileRoute } from "@tanstack/react-router";
import { redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tokovapeku HRIS — Task Management" },
      { name: "description", content: "Sistem HRIS Tokovapeku: checklist SOP harian, verifikasi atasan, KPI cabang & karyawan." },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
