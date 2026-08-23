import { createFileRoute } from "@tanstack/react-router";

import { PortalMaterials } from "@/pages/portal/PortalMaterials";

export const Route = createFileRoute("/portal/apostilas/")({
  head: () => ({
    meta: [{ title: "Apostilas — Seminário Huguenotes" }],
  }),
  component: PortalMaterials,
});
