import { createFileRoute } from "@tanstack/react-router";

import { AssignmentsHome } from "@/pages/painel/AssignmentsHome";

export const Route = createFileRoute("/painel/tarefas/")({
  component: AssignmentsHome,
});
