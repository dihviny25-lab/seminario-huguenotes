import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ConfirmEmail } from "@/pages/ConfirmEmail";

const searchSchema = z.object({ token: z.string() });

export const Route = createFileRoute("/confirmar-email")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Confirmar e-mail — Seminário Huguenotes" }],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { token } = Route.useSearch();
  return <ConfirmEmail token={token} />;
}
