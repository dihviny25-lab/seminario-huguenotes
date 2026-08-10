import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ResetPassword } from "@/pages/ResetPassword";

const searchSchema = z.object({ token: z.string() });

export const Route = createFileRoute("/redefinir-senha-aluno")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Redefinir senha — Seminário Huguenotes" }],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { token } = Route.useSearch();
  return <ResetPassword audience="student" token={token} />;
}
