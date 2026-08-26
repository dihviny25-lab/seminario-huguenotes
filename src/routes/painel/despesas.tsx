import { createFileRoute, redirect } from "@tanstack/react-router";

import { requireAdminFn } from "@/functions/auth";
import { Expenses } from "@/pages/painel/Expenses";

export const Route = createFileRoute("/painel/despesas")({
  beforeLoad: async () => {
    try {
      await requireAdminFn();
    } catch {
      throw redirect({ to: "/painel" });
    }
  },
  head: () => ({
    meta: [{ title: "Despesas — Seminário Huguenotes" }],
  }),
  component: Expenses,
});
