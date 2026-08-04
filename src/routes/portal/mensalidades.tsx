import { createFileRoute } from "@tanstack/react-router";

import { PortalPayments } from "@/pages/portal/PortalPayments";

export const Route = createFileRoute("/portal/mensalidades")({
  head: () => ({
    meta: [{ title: "Mensalidades — Seminário Huguenotes" }],
  }),
  component: PortalPayments,
});
