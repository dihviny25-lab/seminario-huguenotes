import { createFileRoute } from "@tanstack/react-router";

import { PortalForum } from "@/pages/portal/PortalForum";

export const Route = createFileRoute("/portal/forum/")({
  head: () => ({
    meta: [{ title: "Fórum — Seminário Huguenotes" }],
  }),
  component: PortalForum,
});
