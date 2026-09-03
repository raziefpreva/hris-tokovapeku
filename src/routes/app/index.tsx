import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/")({
  component: AppIndexComponent,
});

function AppIndexComponent() {
  return <div>HRIS Tokovapeku Dashboard</div>;
}
