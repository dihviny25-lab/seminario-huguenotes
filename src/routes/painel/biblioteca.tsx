import { createFileRoute } from "@tanstack/react-router";

import { Library } from "@/pages/painel/Library";

export const Route = createFileRoute("/painel/biblioteca")({
  head: () => ({
    meta: [{ title: "Biblioteca virtual — Seminário Huguenotes" }],
  }),
  component: Library,
});
