import { createFileRoute } from "@tanstack/react-router";

import { StudentReport } from "@/pages/painel/reports/StudentReport";

export const Route = createFileRoute("/painel/relatorio")({
  head: () => ({
    meta: [{ title: "Boletim do aluno — Seminário Huguenotes" }],
  }),
  component: StudentReport,
});
