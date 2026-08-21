import { createFileRoute } from "@tanstack/react-router";

import { ClassReport } from "@/pages/painel/reports/ClassReport";

export const Route = createFileRoute("/painel/relatorio-modulo")({
  head: () => ({
    meta: [{ title: "Relatório por módulo — Seminário Huguenotes" }],
  }),
  component: ClassReport,
});
