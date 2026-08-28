import { createLazyFileRoute } from "@tanstack/react-router";

import { TakeExam } from "@/pages/portal/TakeExam";

export const Route = createLazyFileRoute("/portal/provas/$examId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { examId } = Route.useParams();
  return <TakeExam examId={examId} />;
}
