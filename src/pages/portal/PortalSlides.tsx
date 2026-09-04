import { useQuery } from "@tanstack/react-query";

import { ContentTypeToggle } from "@/components/portal/ContentTypeToggle";
import { PortalShell } from "@/components/portal/PortalShell";
import { SlideCard } from "@/components/portal/SlideCard";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicDisciplinesFn } from "@/functions/schedule";
import {
  listAllPresentationSlidesFn,
  type PresentationSlide,
} from "@/functions/presentationSlides";
import { groupBySemester, semesterLabel } from "@/lib/schedule-utils";

/** Biblioteca de slides — todas as disciplinas, agrupadas por semestre. */
export function PortalSlides() {
  const { data: disciplines, isLoading: loadingDisciplines } = useQuery({
    queryKey: ["public-disciplines"],
    queryFn: () => getPublicDisciplinesFn(),
  });
  const { data: slides, isLoading: loadingSlides } = useQuery({
    queryKey: ["all-presentation-slides"],
    queryFn: () => listAllPresentationSlidesFn(),
  });

  const isLoading = loadingDisciplines || loadingSlides;
  const slidesByDiscipline = new Map<string, Array<PresentationSlide>>();
  for (const slide of slides ?? []) {
    const list = slidesByDiscipline.get(slide.disciplineId) ?? [];
    list.push(slide);
    slidesByDiscipline.set(slide.disciplineId, list);
  }

  const disciplinesWithSlides = (disciplines ?? []).filter((d) => slidesByDiscipline.has(d.id));
  const semesters = groupBySemester(disciplinesWithSlides);

  return (
    <PortalShell
      title="Slides"
      description="Apresentações disponibilizadas pelos professores em cada disciplina."
    >
      <ContentTypeToggle active="slides" />

      {isLoading ? (
        <div className="mt-8 space-y-10">
          {Array.from({ length: 2 }).map((_, sectionIndex) => (
            <div key={sectionIndex}>
              <Skeleton className="h-5 w-32" />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 2 }).map((_, cardIndex) => (
                  <Skeleton key={cardIndex} className="h-16 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : semesters.length === 0 ? (
        <p className="animate-in mt-8 rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft fade-in zoom-in-95 duration-300">
          Nenhum slide disponível no momento.
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          {semesters.map((semester) => (
            <section key={semester.semester}>
              <h2 className="font-display text-lg font-semibold text-foreground">
                {semesterLabel(semester.semester)}
              </h2>
              <div className="mt-4 space-y-8">
                {semester.modules.flatMap((module) =>
                  module.disciplines.map((discipline) => {
                    const disciplineSlides = slidesByDiscipline.get(discipline.id) ?? [];
                    return (
                      <div key={discipline.id}>
                        <h3 className="text-base font-semibold text-foreground">
                          {discipline.discipline}
                        </h3>
                        {discipline.teacher ? (
                          <p className="text-sm text-muted-foreground">{discipline.teacher}</p>
                        ) : null}
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {disciplineSlides.map((slide) => (
                            <div
                              key={slide.id}
                              className="animate-in fade-in slide-in-from-top-1 duration-200"
                            >
                              <SlideCard slide={slide} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }),
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
