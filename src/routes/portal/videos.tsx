import { createFileRoute } from "@tanstack/react-router";

import { PortalVideos } from "@/pages/portal/PortalVideos";

export const Route = createFileRoute("/portal/videos")({
  head: () => ({
    meta: [{ title: "Vídeo-aulas — Seminário Huguenotes" }],
  }),
  component: PortalVideos,
});
