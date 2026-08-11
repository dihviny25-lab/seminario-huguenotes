import { BookOpen, Clock, GraduationCap, Layers } from "lucide-react";

import { StatusBadge } from "@/components/StatusBadge";
import { semesterLabel } from "@/lib/schedule-utils";
import type { TeacherSummary } from "@/types/schedule";

interface TeacherCardProps {
  teacher: TeacherSummary;
}

/** Agenda completa de um professor, em ordem cronológica. */
export function TeacherCard({ teacher }: TeacherCardProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-card to-background/95 p-5 shadow-soft sm:p-8">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent via-primary to-transparent" />
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border/70 pb-5">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-accent/70 text-accent-foreground shadow-sm">
            <GraduationCap className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {teacher.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {teacher.semesters.map(semesterLabel).join(" · ")}
            </p>
          </div>
        </div>
        <dl className="flex shrink-0 gap-5 rounded-2xl border border-border/70 bg-surface/70 px-3 py-2 text-right text-sm">
          <div>
            <dt className="text-muted-foreground">Disciplinas</dt>
            <dd className="font-display text-lg font-semibold tabular-nums text-foreground">
              {teacher.totalDisciplines}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Aulas</dt>
            <dd className="font-display text-lg font-semibold tabular-nums text-foreground">
              {teacher.totalLessons}
            </dd>
          </div>
        </dl>
      </header>

      <ol className="mt-5 grid gap-3">
        {teacher.disciplines.map((discipline) => (
          <li
            key={discipline.id}
            className="rounded-md border border-border/70 bg-gradient-to-r from-surface to-card/70 p-4 transition-all duration-200 hover:border-accent/60 hover:shadow-soft sm:p-5"
          >
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div className="min-w-0">
                <p className="text-balance font-medium leading-snug text-foreground">
                  {discipline.discipline}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Layers className="size-3.5 shrink-0" aria-hidden />
                    {semesterLabel(discipline.semester)} · {discipline.module}
                  </span>
                  {discipline.schedule && (
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <Clock className="size-3.5 shrink-0" aria-hidden />
                      {discipline.schedule}
                    </span>
                  )}
                  {typeof discipline.lessons === "number" && (
                    <span className="inline-flex items-center gap-1.5">
                      <BookOpen className="size-3.5 shrink-0" aria-hidden />
                      {discipline.lessons} {discipline.lessons === 1 ? "aula" : "aulas"}
                    </span>
                  )}
                </div>
              </div>
              <StatusBadge
                status={discipline.status}
                period={discipline.period}
                className="justify-self-start sm:justify-self-end"
              />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
