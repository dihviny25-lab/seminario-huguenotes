import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/painel/relatorio")({
  head: () => ({
    meta: [{ title: "Boletim do aluno — Seminário Huguenotes" }],
  }),
});
