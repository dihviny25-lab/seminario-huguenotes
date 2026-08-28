import { createLazyFileRoute } from "@tanstack/react-router";

import { AssignmentEditor } from "@/pages/painel/AssignmentEditor";

export const Route = createLazyFileRoute("/painel/tarefas/$assignmentId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { assignmentId } = Route.useParams();
  return <AssignmentEditor assignmentId={assignmentId} />;
}
