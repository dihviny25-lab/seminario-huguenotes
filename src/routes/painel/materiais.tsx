import { createFileRoute, redirect } from "@tanstack/react-router";

import { requireAdminFn } from "@/functions/auth";
import { Materials } from "@/pages/painel/Materials";

/** Só admin — os demais professores são redirecionados de volta pro painel. */
export const Route = createFileRoute("/painel/materiais")({
  beforeLoad: async () => {
    try {
      await requireAdminFn();
    } catch {
      throw redirect({ to: "/painel" });
    }
  },
  head: () => ({
    meta: [{ title: "Materiais — Seminário Huguenotes" }],
  }),
  component: Materials,
});
