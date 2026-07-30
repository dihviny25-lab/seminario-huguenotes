import { createFileRoute } from "@tanstack/react-router";

import { PainelHome } from "@/pages/painel/PainelHome";

export const Route = createFileRoute("/painel/")({
  head: () => ({
    meta: [{ title: "Painel — Seminário Huguenotes" }],
  }),
  component: PainelHome,
});
