import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { CheckIn } from "@/pages/portal/CheckIn";

const searchSchema = z.object({ token: z.string() });

export const Route = createFileRoute("/portal/checkin/$lessonId")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Chamada — Seminário Huguenotes" }],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { lessonId } = Route.useParams();
  const { token } = Route.useSearch();
  return <CheckIn lessonId={lessonId} token={token} />;
}
