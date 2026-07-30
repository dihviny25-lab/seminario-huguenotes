import { createFileRoute } from "@tanstack/react-router";

import { PortalHome } from "@/pages/portal/PortalHome";

export const Route = createFileRoute("/portal/")({
  head: () => ({
    meta: [{ title: "Minhas notas e faltas — Seminário Huguenotes" }],
  }),
  component: PortalHome,
});
