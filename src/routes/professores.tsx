import { createFileRoute } from "@tanstack/react-router";

import { Teachers } from "@/pages/Teachers";

const title = "Professores — Seminário Huguenotes";
const description =
  "Veja a agenda de cada professor do Seminário Huguenotes: disciplinas, horários, número de aulas e situação das datas.";

export const Route = createFileRoute("/professores")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: Teachers,
});
