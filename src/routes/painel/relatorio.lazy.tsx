import { createLazyFileRoute } from "@tanstack/react-router";

import { StudentReport } from "@/pages/painel/reports/StudentReport";

export const Route = createLazyFileRoute("/painel/relatorio")({
  component: StudentReport,
});
