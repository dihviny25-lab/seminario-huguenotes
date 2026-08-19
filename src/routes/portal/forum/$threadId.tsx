import { createFileRoute } from "@tanstack/react-router";

import { PortalForumThread } from "@/pages/portal/PortalForumThread";

export const Route = createFileRoute("/portal/forum/$threadId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { threadId } = Route.useParams();
  return <PortalForumThread threadId={threadId} />;
}
