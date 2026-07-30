import { createFileRoute } from "@tanstack/react-router";

import { Report } from "@/pages/painel/Report";

export const Route = createFileRoute("/painel/relatorio")({
  head: () => ({
    meta: [{ title: "Relatório do aluno — Seminário Huguenotes" }],
  }),
  component: Report,
});
