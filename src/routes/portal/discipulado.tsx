import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/portal/discipulado")({
  head: () => ({
    meta: [{ title: "Discipulado — Seminário Huguenotes" }],
  }),
});
