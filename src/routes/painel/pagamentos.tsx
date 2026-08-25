import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { Payments } from "@/pages/painel/Payments";

const searchSchema = z.object({ studentId: z.string().uuid().optional() });

export const Route = createFileRoute("/painel/pagamentos")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Pagamentos — Seminário Huguenotes" }],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { studentId } = Route.useSearch();
  return <Payments initialStudentId={studentId} />;
}
