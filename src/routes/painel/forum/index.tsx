import { createFileRoute } from "@tanstack/react-router";

import { ForumHome } from "@/pages/painel/ForumHome";

export const Route = createFileRoute("/painel/forum/")({
  component: ForumHome,
});
