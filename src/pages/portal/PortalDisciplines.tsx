import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

import { PortalShell } from "@/components/portal/PortalShell";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicDisciplinesFn } from "@/functions/schedule";
import { groupBySemester, semesterLabel } from "@/lib/schedule-utils";

/** "Minhas disciplinas" — cada card leva pra página do curso daquela disciplina. */
export function PortalDisciplines() {
  const { data: disciplines, isLoading } = useQuery({
    queryKey: ["public-disciplines"],
    queryFn: () => getPublicDisciplinesFn(),
  });

  const semesters = groupBySemester(disciplines ?? []);

  return (
    <PortalShell
      title="Minhas disciplinas"
      description="Cada disciplina reúne aulas, apostila, tarefas, provas, notas e fórum num lugar só."
    >
      {isLoading || !disciplines ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-10">
          {semesters.map((semester) => (
            <section key={semester.semester}>
              <h2 className="font-display text-lg font-semibold text-foreground">
                {semesterLabel(semester.semester)}
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {semester.modules.flatMap((module) =>
                  module.disciplines.map((discipline) => (
                    <Link
                      key={discipline.id}
                      to="/portal/disciplinas/$disciplineId"
                      params={{ disciplineId: discipline.id }}
                      className="flex items-start gap-3 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-4 shadow-soft transition-colors hover:border-primary/50"
                    >
                      <BookOpen className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">
                          {discipline.discipline}
                        </span>
                        {discipline.teacher ? (
                          <span className="block text-xs text-muted-foreground">
                            {discipline.teacher}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  )),
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
