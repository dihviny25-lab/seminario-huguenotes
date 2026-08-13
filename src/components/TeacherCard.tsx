import { BookOpen, Clock, GraduationCap, Layers } from "lucide-react";

import { StatusBadge } from "@/components/StatusBadge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { semesterLabel } from "@/lib/schedule-utils";
import type { TeacherSummary } from "@/types/schedule";

interface TeacherCardProps {
  teacher: TeacherSummary;
  /** Abre a lista de disciplinas já expandida (ex.: quando só esse professor está visível). */
  defaultOpen?: boolean;
}

/** Agenda de um professor, em ordem cronológica — recolhível. */
export function TeacherCard({ teacher, defaultOpen }: TeacherCardProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-card to-background/95 shadow-soft">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent via-primary to-transparent" />
      <Accordion type="single" collapsible defaultValue={defaultOpen ? "disciplinas" : undefined}>
        <AccordionItem value="disciplinas" className="border-none">
          <AccordionTrigger className="px-5 py-5 text-left hover:no-underline sm:px-8">
            <div className="flex min-w-0 items-center gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-accent/70 text-accent-foreground shadow-sm">
                <GraduationCap className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  {teacher.name}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {teacher.semesters.map(semesterLabel).join(" · ")} · {teacher.totalDisciplines}{" "}
                  {teacher.totalDisciplines === 1 ? "disciplina" : "disciplinas"} ·{" "}
                  {teacher.totalLessons} {teacher.totalLessons === 1 ? "aula" : "aulas"}
                </p>
              </div>
            </div>
          </AccordionTrigger>

          <AccordionContent className="px-5 pb-2 sm:px-8">
            <ul className="divide-y divide-border/70 border-t border-border/70">
              {teacher.disciplines.map((discipline) => (
                <li key={discipline.id} className="py-4">
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-3">
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
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
