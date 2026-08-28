import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/portal/provas/$examId")({
  head: () => ({
    meta: [{ title: "Prova — Seminário Huguenotes" }],
  }),
});
