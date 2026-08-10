import { createFileRoute } from "@tanstack/react-router";

import { ForgotPassword } from "@/pages/ForgotPassword";

export const Route = createFileRoute("/esqueci-senha-aluno")({
  head: () => ({
    meta: [{ title: "Esqueci minha senha — Seminário Huguenotes" }],
  }),
  component: () => <ForgotPassword audience="student" />,
});
