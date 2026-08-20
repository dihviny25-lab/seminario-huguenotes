import { createFileRoute } from "@tanstack/react-router";

import { PortalDisciplineDetail } from "@/pages/portal/PortalDisciplineDetail";

export const Route = createFileRoute("/portal/disciplinas/$disciplineId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { disciplineId } = Route.useParams();
  return <PortalDisciplineDetail disciplineId={disciplineId} />;
}
