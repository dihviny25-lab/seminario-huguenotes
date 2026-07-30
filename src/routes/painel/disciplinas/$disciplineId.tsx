import { createFileRoute } from "@tanstack/react-router";

import { DisciplineDetail } from "@/pages/painel/DisciplineDetail";

export const Route = createFileRoute("/painel/disciplinas/$disciplineId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { disciplineId } = Route.useParams();
  return <DisciplineDetail disciplineId={disciplineId} />;
}
