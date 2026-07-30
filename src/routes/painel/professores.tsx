import { createFileRoute } from "@tanstack/react-router";

import { TeacherAccounts } from "@/pages/painel/TeacherAccounts";

export const Route = createFileRoute("/painel/professores")({
  head: () => ({
    meta: [{ title: "Contas de professores — Seminário Huguenotes" }],
  }),
  component: TeacherAccounts,
});
