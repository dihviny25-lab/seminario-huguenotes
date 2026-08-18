import { createFileRoute } from "@tanstack/react-router";

import { ExamEditor } from "@/pages/painel/ExamEditor";

export const Route = createFileRoute("/painel/provas/$examId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { examId } = Route.useParams();
  return <ExamEditor examId={examId} />;
}
