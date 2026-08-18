import { createFileRoute } from "@tanstack/react-router";

import { TakeExam } from "@/pages/portal/TakeExam";

export const Route = createFileRoute("/portal/provas/$examId")({
  head: () => ({
    meta: [{ title: "Prova — Seminário Huguenotes" }],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { examId } = Route.useParams();
  return <TakeExam examId={examId} />;
}
