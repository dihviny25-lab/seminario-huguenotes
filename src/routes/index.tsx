import { createFileRoute } from "@tanstack/react-router";

import { Dashboard } from "@/pages/Dashboard";
import { getPublicDisciplinesFn } from "@/functions/schedule";

const title = "Seminário Huguenotes — Cronograma Acadêmico";
const description =
  "Cronograma acadêmico completo do Seminário Huguenotes: 5 semestres, módulos, disciplinas, professores e horários.";

export const Route = createFileRoute("/")({
  loader: () => getPublicDisciplinesFn(),
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const disciplines = Route.useLoaderData();
  return <Dashboard disciplines={disciplines} />;
}
