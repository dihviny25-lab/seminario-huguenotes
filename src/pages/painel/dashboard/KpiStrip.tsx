import { Skeleton } from "@/components/ui/skeleton";
import type { TeacherDashboard } from "@/functions/teacherDashboard";
import { cn } from "@/lib/utils";

const KPIS = [
  { key: "pendingGrading", label: "Correções pendentes", alarm: true },
  { key: "endingDisciplines", label: "Disciplinas encerrando", alarm: false },
  { key: "atRiskStudents", label: "Alunos em risco", alarm: true },
  { key: "lessonsWithoutAttendance", label: "Aulas sem chamada", alarm: true },
] as const;

export function KpiStrip({
  scope,
  counts,
  isLoading,
}: {
  scope: TeacherDashboard["scope"];
  counts: TeacherDashboard["counts"];
  isLoading: boolean;
}) {
  const suffix = scope === "escola" ? "em toda a escola" : "nas suas disciplinas";

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
            <p className="mt-1 text-xs text-muted-foreground">{suffix}</p>
          </a>
        );
      })}
    </div>
  );
}
