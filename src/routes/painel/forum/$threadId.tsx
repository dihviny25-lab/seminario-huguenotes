import { createFileRoute } from "@tanstack/react-router";

import { ForumThread } from "@/pages/painel/ForumThread";

export const Route = createFileRoute("/painel/forum/$threadId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { threadId } = Route.useParams();
  return <ForumThread threadId={threadId} />;
}
