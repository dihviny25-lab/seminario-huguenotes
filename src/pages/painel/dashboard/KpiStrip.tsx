import { Skeleton } from "@/components/ui/skeleton";
import type { TeacherDashboard } from "@/functions/teacherDashboard";
import { cn } from "@/lib/utils";

const KPIS = [
  { key: "pendingGrading", label: "Correções pendentes", alarm: true },
  { key: "endingDisciplines", label: "Disciplinas encerrando", alarm: false },
  { key: "atRiskStudents", label: "Alunos em risco", alarm: true },
  // Pendência real e acionável desde que existe lessons.given_at: só conta
  // aula passada sem chamada lançada (não mais "zero linhas em attendance",
  // que nunca zerava porque aula 100% presente também não gera linha).
  { key: "lessonsWithoutAttendance", label: "Aulas sem chamada lançada", alarm: true },
] as const;

const SUFFIX = "nas suas disciplinas";

export function KpiStrip({
  counts,
  isLoading,
}: {
  counts: TeacherDashboard["counts"];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((k) => (
          <Skeleton key={k.key} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {KPIS.map((k) => {
        const value = counts[k.key];
        const danger = k.alarm && value > 0;
        return (
          <a
            key={k.key}
            href={`#card-${k.key}`}
            className={cn(
              "rounded-md border border-t-2 border-border/70 bg-card/70 p-4 shadow-soft transition-colors",
              danger ? "border-t-destructive" : "border-t-accent",
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {k.label}
            </p>
            <p className="mt-2 font-display text-2xl font-semibold text-foreground">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{SUFFIX}</p>
          </a>
        );
      })}
    </div>
  );
}
