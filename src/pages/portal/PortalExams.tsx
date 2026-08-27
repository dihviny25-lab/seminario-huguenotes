import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarClock, CheckCircle2, Clock, PlayCircle } from "lucide-react";

import { PortalShell } from "@/components/portal/PortalShell";
import { Skeleton } from "@/components/ui/skeleton";
import { listAvailableExamsFn, type AvailableExam } from "@/functions/examAttempts";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const sections: Array<{ status: AvailableExam["status"]; title: string }> = [
  { status: "available", title: "Disponível agora" },
  { status: "in_progress", title: "Em andamento" },
  { status: "upcoming", title: "Agendada" },
  { status: "submitted", title: "Concluída" },
];

/** Lista de provas — de todas as disciplinas — com o status da tentativa do próprio aluno. */
export function PortalExams() {
  const { data: exams, isLoading } = useQuery({
    queryKey: ["available-exams"],
    queryFn: () => listAvailableExamsFn(),
  });

  return (
    <PortalShell title="Provas" description="Provas agendadas pelos professores, por disciplina.">
      {isLoading || !exams ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : exams.length === 0 ? (
        <p className="animate-in rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft fade-in zoom-in-95 duration-300">
          Nenhuma prova agendada no momento.
        </p>
      ) : (
        <div className="space-y-8">
          {sections.map(({ status, title }) => {
            const items = exams.filter((e) => e.status === status);
            if (items.length === 0) return null;
            return (
              <section key={status}>
                <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
                <div className="mt-3 grid gap-3">
                  {items.map((exam) => (
                    <ExamCard key={exam.id} exam={exam} />
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

function ExamCard({ exam }: { exam: AvailableExam }) {
  const content = (
    <div className="flex animate-in items-center justify-between gap-4 rounded-md border border-border/70 bg-card/70 p-4 shadow-soft fade-in slide-in-from-top-1 duration-200 transition-colors hover:border-primary/50">
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{exam.title}</p>
        <p className="text-sm text-muted-foreground">{exam.disciplineName}</p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          {exam.status === "upcoming" ? (
            <>
              <CalendarClock className="size-3.5 shrink-0" aria-hidden />
              Disponível a partir de {formatDate(exam.opensAt)}
            </>
          ) : (
            <>
              <Clock className="size-3.5 shrink-0" aria-hidden />
              {exam.durationMinutes} minutos
            </>
          )}
        </p>
      </div>
      {exam.status === "submitted" ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 font-display text-lg font-semibold text-success">
          <CheckCircle2 className="size-5 shrink-0" aria-hidden />
          {Number(exam.score).toFixed(1)}/{Number(exam.maxScore).toFixed(1)}
        </span>
      ) : exam.status === "available" || exam.status === "in_progress" ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-accent">
          <PlayCircle className="size-4 shrink-0" aria-hidden />
          {exam.status === "available" ? "Iniciar" : "Continuar"}
        </span>
      ) : null}
    </div>
  );

  if (exam.status === "upcoming") return content;

  return (
    <Link to="/portal/provas/$examId" params={{ examId: exam.id }} className="block">
      {content}
    </Link>
  );
}
