import { createFileRoute, redirect } from "@tanstack/react-router";

import { requireAdminFn } from "@/functions/auth";
import { TeachingAssignments } from "@/pages/painel/TeachingAssignments";

export const Route = createFileRoute("/painel/atribuicoes")({
  beforeLoad: async () => {
    try {
      await requireAdminFn();
    } catch {
      throw redirect({ to: "/painel" });
    }
  },
  head: () => ({
    meta: [{ title: "Atribuição de professores — Seminário Huguenotes" }],
  }),
  component: TeachingAssignments,
});
