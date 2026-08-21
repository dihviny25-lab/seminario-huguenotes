import { createFileRoute } from "@tanstack/react-router";

import { PortalLibrary } from "@/pages/portal/PortalLibrary";

export const Route = createFileRoute("/portal/biblioteca/")({
  head: () => ({
    meta: [{ title: "Biblioteca — Seminário Huguenotes" }],
  }),
  component: PortalLibrary,
});
