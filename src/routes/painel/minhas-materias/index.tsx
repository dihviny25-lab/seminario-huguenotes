import { createFileRoute } from "@tanstack/react-router";

import { MyMaterials } from "@/pages/painel/MyMaterials";

export const Route = createFileRoute("/painel/minhas-materias/")({
  component: MyMaterials,
});
