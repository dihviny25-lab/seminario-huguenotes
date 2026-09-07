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
      <div className="grid grid-cols-2 divide-x divide-y divide-border/70 overflow-hidden rounded-md border border-border/70 bg-card/70 shadow-soft lg:grid-cols-4 lg:divide-y-0">
        {KPIS.map((k) => (
          <div key={k.key} className="p-4">
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-border/70 overflow-hidden rounded-md border border-border/70 bg-card/70 shadow-soft lg:grid-cols-4 lg:divide-y-0">
      {KPIS.map((k) => {
        const value = counts[k.key];
        const danger = k.alarm && value > 0;
        return (
          <a
            key={k.key}
            href={`#card-${k.key}`}
            className="p-4 transition-colors hover:bg-muted/40"
          >
            <p className="text-sm text-muted-foreground">{k.label}</p>
            <p
              className={cn(
                "mt-2 font-display text-2xl font-semibold",
                danger ? "text-destructive" : "text-foreground",
              )}
            >
              {value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{SUFFIX}</p>
          </a>
        );
      })}
    </div>
  );
}
