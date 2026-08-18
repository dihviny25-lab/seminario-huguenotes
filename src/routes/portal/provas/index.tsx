import { createFileRoute } from "@tanstack/react-router";

import { PortalExams } from "@/pages/portal/PortalExams";

export const Route = createFileRoute("/portal/provas/")({
  head: () => ({
    meta: [{ title: "Provas — Seminário Huguenotes" }],
  }),
  component: PortalExams,
});
