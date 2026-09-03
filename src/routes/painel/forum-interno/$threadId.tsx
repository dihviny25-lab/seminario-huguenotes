import { createFileRoute } from "@tanstack/react-router";

import { TeacherForumThread } from "@/pages/painel/TeacherForumThread";

export const Route = createFileRoute("/painel/forum-interno/$threadId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { threadId } = Route.useParams();
  return <TeacherForumThread threadId={threadId} />;
}
