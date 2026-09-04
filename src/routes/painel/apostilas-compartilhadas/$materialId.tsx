import { createFileRoute } from "@tanstack/react-router";

import { SharedMaterialReader } from "@/pages/painel/SharedMaterialReader";

export const Route = createFileRoute("/painel/apostilas-compartilhadas/$materialId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { materialId } = Route.useParams();
  return <SharedMaterialReader materialId={materialId} />;
}
