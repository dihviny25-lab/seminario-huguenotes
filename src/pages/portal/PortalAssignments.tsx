import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarClock, CheckCircle2, FileEdit } from "lucide-react";

import { PortalShell } from "@/components/portal/PortalShell";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listAvailableAssignmentsFn,
  type AvailableAssignment,
} from "@/functions/assignmentSubmissions";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const sections: Array<{ status: AvailableAssignment["status"]; title: string }> = [
  { status: "pending", title: "Pendentes" },
  { status: "submitted", title: "Aguardando correção" },
  { status: "graded", title: "Corrigidas" },
];

/** Lista de tarefas — de todas as disciplinas — com o status da entrega do próprio aluno. */
export function PortalAssignments() {
  const { data: assignments, isLoading } = useQuery({
    queryKey: ["available-assignments"],
    queryFn: () => listAvailableAssignmentsFn(),
  });

  return (
    <PortalShell title="Tarefas" description="Tarefas criadas pelos professores, por disciplina.">
      {isLoading || !assignments ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : assignments.length === 0 ? (
        <p className="animate-in rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft fade-in zoom-in-95 duration-300">
          Nenhuma tarefa no momento.
        </p>
      ) : (
        <div className="space-y-8">
          {sections.map(({ status, title }) => {
            const items = assignments.filter((a) => a.status === status);
            if (items.length === 0) return null;
            return (
              <section key={status}>
                <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
                <div className="mt-3 grid gap-3">
                  {items.map((assignment) => (
                    <AssignmentCard key={assignment.id} assignment={assignment} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </PortalShell>
  );
}

function AssignmentCard({ assignment }: { assignment: AvailableAssignment }) {
  return (
    <Link
      to="/portal/tarefas/$assignmentId"
      params={{ assignmentId: assignment.id }}
      className="flex animate-in items-center justify-between gap-4 rounded-md border border-border/70 bg-card/70 p-4 shadow-soft fade-in slide-in-from-top-1 duration-200 transition-colors hover:border-primary/50"
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{assignment.title}</p>
        <p className="text-sm text-muted-foreground">{assignment.disciplineName}</p>
        {assignment.dueAt ? (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5 shrink-0" aria-hidden />
            Prazo: {formatDate(assignment.dueAt)}
          </p>
        ) : null}
      </div>
      {assignment.status === "graded" ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 font-display text-lg font-semibold text-success">
          <CheckCircle2 className="size-5 shrink-0" aria-hidden />
          {Number(assignment.score).toFixed(1)}/{Number(assignment.maxScore).toFixed(1)}
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-accent">
          <FileEdit className="size-4 shrink-0" aria-hidden />
          {assignment.status === "pending" ? "Entregar" : "Ver entrega"}
        </span>
      )}
    </Link>
  );
}
