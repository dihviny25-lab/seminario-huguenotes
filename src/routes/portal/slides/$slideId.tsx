import { createFileRoute } from "@tanstack/react-router";

import { PortalSlideReader } from "@/pages/portal/PortalSlideReader";

export const Route = createFileRoute("/portal/slides/$slideId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { slideId } = Route.useParams();
  return <PortalSlideReader slideId={slideId} />;
}
