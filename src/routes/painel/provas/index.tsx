import { createFileRoute } from "@tanstack/react-router";

import { ExamsHome } from "@/pages/painel/ExamsHome";

export const Route = createFileRoute("/painel/provas/")({
  component: ExamsHome,
});
