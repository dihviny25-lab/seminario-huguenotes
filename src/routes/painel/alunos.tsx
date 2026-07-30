import { createFileRoute } from "@tanstack/react-router";

import { Students } from "@/pages/painel/Students";

export const Route = createFileRoute("/painel/alunos")({
  head: () => ({
    meta: [{ title: "Alunos — Seminário Huguenotes" }],
  }),
  component: Students,
});
