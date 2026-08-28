import { createLazyFileRoute } from "@tanstack/react-router";

import { AuditLog } from "@/pages/painel/AuditLog";

export const Route = createLazyFileRoute("/painel/auditoria")({
  component: AuditLog,
});
