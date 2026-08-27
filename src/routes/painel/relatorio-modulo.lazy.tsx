import { createLazyFileRoute } from "@tanstack/react-router";

import { ClassReport } from "@/pages/painel/reports/ClassReport";

export const Route = createLazyFileRoute("/painel/relatorio-modulo")({
  component: ClassReport,
});
