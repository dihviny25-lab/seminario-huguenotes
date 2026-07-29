import { Clock, User } from "lucide-react";

import type { Discipline } from "@/types/schedule";

interface DisciplineRowProps {
  discipline: Discipline;
  /** Oculta o professor quando a lista já está filtrada por ele. */
  hideTeacher?: boolean;
}

/** Linha de disciplina em formato de cartão leve (sem tabela). */
export function DisciplineRow({ discipline, hideTeacher }: DisciplineRowProps) {
  return (
    <li className="group rounded-[1.1rem] border border-border/70 bg-card/90 p-4 transition-all duration-200 hover:border-accent/60 hover:shadow-soft sm:p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:justify-between">
        <h4 className="min-w-0 text-balance font-medium leading-snug text-foreground">
          {discipline.discipline}
        </h4>
        {typeof discipline.lessons === "number" && (
          <span className="shrink-0 rounded-md bg-secondary px-2 py-1 text-xs font-semibold tabular-nums text-secondary-foreground">
            {discipline.lessons} {discipline.lessons === 1 ? "aula" : "aulas"}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
        {!hideTeacher && discipline.teacher && (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <User className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{discipline.teacher}</span>
          </span>
        )}
        {discipline.schedule && (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5 shrink-0" aria-hidden />
            <span className="tabular-nums">{discipline.schedule}</span>
          </span>
        )}
      </div>

      {discipline.observations && (
        <p className="mt-3 border-l-2 border-accent/40 pl-3 text-sm leading-relaxed text-muted-foreground">
          {discipline.observations}
        </p>
      )}
    </li>
  );
}
