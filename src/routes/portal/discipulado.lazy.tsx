import { createLazyFileRoute } from "@tanstack/react-router";

import { PortalDiscipleship } from "@/pages/portal/PortalDiscipleship";

export const Route = createLazyFileRoute("/portal/discipulado")({
  component: PortalDiscipleship,
});
