import { createFileRoute } from "@tanstack/react-router";

import { TeacherForumHome } from "@/pages/painel/TeacherForumHome";

export const Route = createFileRoute("/painel/forum-interno/")({
  component: TeacherForumHome,
});
