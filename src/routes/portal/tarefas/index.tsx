import { createFileRoute } from "@tanstack/react-router";

import { PortalAssignments } from "@/pages/portal/PortalAssignments";

export const Route = createFileRoute("/portal/tarefas/")({
  head: () => ({
    meta: [{ title: "Tarefas — Seminário Huguenotes" }],
  }),
  component: PortalAssignments,
});
