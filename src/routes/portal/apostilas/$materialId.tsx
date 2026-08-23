import { createFileRoute } from "@tanstack/react-router";

import { PortalMaterialReader } from "@/pages/portal/PortalMaterialReader";

export const Route = createFileRoute("/portal/apostilas/$materialId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { materialId } = Route.useParams();
  return <PortalMaterialReader materialId={materialId} />;
}
