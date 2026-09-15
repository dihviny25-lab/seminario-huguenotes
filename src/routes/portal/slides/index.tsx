import { createFileRoute } from "@tanstack/react-router";

import { PortalSlides } from "@/pages/portal/PortalSlides";

export const Route = createFileRoute("/portal/slides/")({
  head: () => ({
    meta: [{ title: "Slides — Seminário Huguenotes" }],
  }),
  component: PortalSlides,
});
