import { createFileRoute } from "@tanstack/react-router";

import { StudentLogin } from "@/pages/StudentLogin";

export const Route = createFileRoute("/login-aluno")({
  head: () => ({
    meta: [{ title: "Portal do aluno — Seminário Huguenotes" }],
  }),
  component: StudentLogin,
});
