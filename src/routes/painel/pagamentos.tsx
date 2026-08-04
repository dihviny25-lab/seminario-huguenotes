import { createFileRoute } from "@tanstack/react-router";

import { Payments } from "@/pages/painel/Payments";

export const Route = createFileRoute("/painel/pagamentos")({
  head: () => ({
    meta: [{ title: "Pagamentos — Seminário Huguenotes" }],
  }),
  component: Payments,
});
