import { createFileRoute } from "@tanstack/react-router";

import { SharedMaterials } from "@/pages/painel/SharedMaterials";

export const Route = createFileRoute("/painel/apostilas-compartilhadas/")({
  component: SharedMaterials,
});
