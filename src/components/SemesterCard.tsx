import { Accordion } from "@/components/ui/accordion";
import { ModuleCard } from "@/components/ModuleCard";
import { semesterLabel } from "@/lib/schedule-utils";
import type { SemesterGroup } from "@/types/schedule";

interface SemesterCardProps {
  semester: SemesterGroup;
}

/** Cartão de um semestre contendo seus módulos expansíveis. */
export function SemesterCard({ semester }: SemesterCardProps) {
  const defaultOpen = semester.modules
    .filter((m) => m.status === "confirmed")
    .map((m) => `${semester.semester}-${m.module}`);

  return (
    <section
      aria-labelledby={`semestre-${semester.semester}`}
      className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-gradient-to-b from-card to-background/95 p-5 shadow-soft sm:p-8"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-accent to-transparent" />
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border/70 pb-5">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 font-display text-lg font-semibold text-primary-foreground shadow-sm">
            {semester.semester}
          </span>
          <div className="min-w-0">
            <h3
              id={`semestre-${semester.semester}`}
              className="truncate font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
            >
              {semesterLabel(semester.semester)}
            </h3>
            <p className="text-sm text-muted-foreground">Turma {semester.term}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-surface/80 px-3 py-2 text-right text-sm text-muted-foreground">
          <p className="font-semibold tabular-nums text-foreground">{semester.totalLessons}</p>
          <p>aulas</p>
        </div>
      </header>

      <Accordion type="multiple" defaultValue={defaultOpen} className="mt-5 grid gap-3">
        {semester.modules.map((module) => (
          <ModuleCard
            key={module.module}
            module={module}
            value={`${semester.semester}-${module.module}`}
          />
        ))}
      </Accordion>
    </section>
  );
}
