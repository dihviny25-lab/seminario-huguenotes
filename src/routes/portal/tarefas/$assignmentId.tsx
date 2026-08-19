import { createFileRoute } from "@tanstack/react-router";

import { PortalAssignmentDetail } from "@/pages/portal/PortalAssignmentDetail";

export const Route = createFileRoute("/portal/tarefas/$assignmentId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { assignmentId } = Route.useParams();
  return <PortalAssignmentDetail assignmentId={assignmentId} />;
}
