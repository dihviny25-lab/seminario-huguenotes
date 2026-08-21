import { createFileRoute } from "@tanstack/react-router";

import { PortalLibraryReader } from "@/pages/portal/PortalLibraryReader";

export const Route = createFileRoute("/portal/biblioteca/$bookId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { bookId } = Route.useParams();
  return <PortalLibraryReader bookId={bookId} />;
}
