import { createLazyFileRoute } from "@tanstack/react-router";
import { AtRiskStudents } from "@/pages/painel/AtRiskStudents";

export const Route = createLazyFileRoute("/painel/alunos-em-risco")({ component: AtRiskStudents });
