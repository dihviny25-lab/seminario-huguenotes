import { createFileRoute } from "@tanstack/react-router";

import { PortalAccount } from "@/pages/portal/PortalAccount";

export const Route = createFileRoute("/portal/conta")({
  head: () => ({
    meta: [{ title: "Minha conta — Seminário Huguenotes" }],
  }),
  component: PortalAccount,
});
