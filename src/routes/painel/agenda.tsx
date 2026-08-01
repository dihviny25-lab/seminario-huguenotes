import { createFileRoute } from "@tanstack/react-router";

import { TeachersAgenda } from "@/pages/painel/TeachersAgenda";

export const Route = createFileRoute("/painel/agenda")({
  head: () => ({
    meta: [{ title: "Agenda dos professores — Seminário Huguenotes" }],
  }),
  component: TeachersAgenda,
});
