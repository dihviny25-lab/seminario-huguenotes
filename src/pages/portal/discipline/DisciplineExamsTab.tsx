import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarClock, CheckCircle2, Clock, PlayCircle } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { listDisciplineExamsFn, type AvailableExam } from "@/functions/examAttempts";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function DisciplineExamsTab({ disciplineId }: { disciplineId: string }) {
  const { data: exams, isLoading } = useQuery({
    queryKey: ["discipline-exams", disciplineId],
    queryFn: () => listDisciplineExamsFn({ data: { disciplineId } }),
  });

  if (isLoading || !exams) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (exams.length === 0) {
    return (
      <p className="rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft">
        Nenhuma prova agendada ainda.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {exams.map((exam) => (
        <ExamCard key={exam.id} exam={exam} />
      ))}
    </div>
  );
}

function ExamCard({ exam }: { exam: AvailableExam }) {
  const content = (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border/70 bg-card/70 p-4 shadow-soft transition-colors hover:border-primary/50">
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{exam.title}</p>
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
