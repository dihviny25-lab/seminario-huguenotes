import { createFileRoute } from "@tanstack/react-router";

import { PortalDisciplines } from "@/pages/portal/PortalDisciplines";

export const Route = createFileRoute("/portal/disciplinas/")({
  head: () => ({
    meta: [{ title: "Minhas disciplinas — Seminário Huguenotes" }],
  }),
  component: PortalDisciplines,
});
