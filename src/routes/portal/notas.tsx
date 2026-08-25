import { createFileRoute } from "@tanstack/react-router";

import { PortalGrades } from "@/pages/portal/PortalGrades";

export const Route = createFileRoute("/portal/notas")({
  head: () => ({
    meta: [{ title: "Minhas notas e faltas — Seminário Huguenotes" }],
  }),
  component: PortalGrades,
});
