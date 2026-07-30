import { createFileRoute } from "@tanstack/react-router";

import { ChangePassword } from "@/pages/ChangePassword";

export const Route = createFileRoute("/painel/trocar-senha")({
  head: () => ({
    meta: [{ title: "Trocar senha — Seminário Huguenotes" }],
  }),
  component: ChangePassword,
});
