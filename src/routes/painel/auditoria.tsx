import { createFileRoute, redirect } from "@tanstack/react-router";

import { requireAdminFn } from "@/functions/auth";
import { AuditLog } from "@/pages/painel/AuditLog";

/** Só admin — os demais professores são redirecionados de volta pro painel. */
export const Route = createFileRoute("/painel/auditoria")({
  beforeLoad: async () => {
    try {
      await requireAdminFn();
    } catch {
      throw redirect({ to: "/painel" });
    }
  },
  head: () => ({
    meta: [{ title: "Auditoria — Seminário Huguenotes" }],
  }),
  component: AuditLog,
});
