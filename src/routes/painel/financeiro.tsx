import { createFileRoute, redirect } from "@tanstack/react-router";

import { requireAdminFn } from "@/functions/auth";
import { Financial } from "@/pages/painel/Financial";

/** Só admin — os demais professores são redirecionados de volta pro painel. */
export const Route = createFileRoute("/painel/financeiro")({
  beforeLoad: async () => {
    try {
      await requireAdminFn();
    } catch {
      throw redirect({ to: "/painel" });
    }
  },
  head: () => ({
    meta: [{ title: "Financeiro — Seminário Huguenotes" }],
  }),
  component: Financial,
});
