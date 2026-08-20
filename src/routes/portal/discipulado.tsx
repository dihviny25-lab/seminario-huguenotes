import { createFileRoute } from "@tanstack/react-router";

import { PortalDiscipleship } from "@/pages/portal/PortalDiscipleship";

export const Route = createFileRoute("/portal/discipulado")({
  head: () => ({
    meta: [{ title: "Discipulado — Seminário Huguenotes" }],
  }),
  component: PortalDiscipleship,
});
