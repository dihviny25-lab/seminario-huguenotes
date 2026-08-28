import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/painel/relatorio-modulo")({
  head: () => ({
    meta: [{ title: "Relatório por módulo — Seminário Huguenotes" }],
  }),
});
