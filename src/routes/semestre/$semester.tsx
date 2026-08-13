import { createFileRoute } from "@tanstack/react-router";

import { SemesterDetail } from "@/pages/SemesterDetail";
import { getPublicDisciplinesFn } from "@/functions/schedule";

export const Route = createFileRoute("/semestre/$semester")({
  loader: () => getPublicDisciplinesFn(),
  head: ({ params }) => {
    const title = `${params.semester}º Semestre — Seminário Huguenotes`;
    const description = `Módulos, disciplinas e horários do ${params.semester}º semestre do Seminário Huguenotes.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { semester } = Route.useParams();
  const disciplines = Route.useLoaderData();
  return <SemesterDetail disciplines={disciplines} semester={Number(semester)} />;
}
