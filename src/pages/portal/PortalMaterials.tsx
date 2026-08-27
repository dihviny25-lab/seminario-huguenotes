import { useQuery } from "@tanstack/react-query";

import { PortalShell } from "@/components/portal/PortalShell";
import { ReadingMaterialCard } from "@/components/portal/ReadingMaterialCard";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicDisciplinesFn } from "@/functions/schedule";
import { listAllReadingMaterialsFn, type ReadingMaterial } from "@/functions/readingMaterials";
import { groupBySemester, semesterLabel } from "@/lib/schedule-utils";

/** Biblioteca de apostilas/materiais de leitura — todas as disciplinas, agrupadas por semestre. */
export function PortalMaterials() {
  const { data: disciplines, isLoading: loadingDisciplines } = useQuery({
    queryKey: ["public-disciplines"],
    queryFn: () => getPublicDisciplinesFn(),
  });
  const { data: materials, isLoading: loadingMaterials } = useQuery({
    queryKey: ["all-reading-materials"],
    queryFn: () => listAllReadingMaterialsFn(),
  });

  const isLoading = loadingDisciplines || loadingMaterials;
  const materialsByDiscipline = new Map<string, Array<ReadingMaterial>>();
  for (const material of materials ?? []) {
    const list = materialsByDiscipline.get(material.disciplineId) ?? [];
    list.push(material);
    materialsByDiscipline.set(material.disciplineId, list);
  }

  const disciplinesWithMaterials = (disciplines ?? []).filter((d) =>
    materialsByDiscipline.has(d.id),
  );
  const semesters = groupBySemester(disciplinesWithMaterials);

  return (
    <PortalShell
      title="Apostilas"
      description="Materiais de leitura disponibilizados pelos professores em cada disciplina."
    >
      {isLoading ? (
        <div className="space-y-10">
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
        <p className="animate-in rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft fade-in zoom-in-95 duration-300">
          Nenhum material de leitura disponível no momento.
        </p>
      ) : (
        <div className="space-y-10">
          {semesters.map((semester) => (
            <section key={semester.semester}>
              <h2 className="font-display text-lg font-semibold text-foreground">
                {semesterLabel(semester.semester)}
              </h2>
              <div className="mt-4 space-y-8">
                {semester.modules.flatMap((module) =>
                  module.disciplines.map((discipline) => {
                    const disciplineMaterials = materialsByDiscipline.get(discipline.id) ?? [];
                    return (
                      <div key={discipline.id}>
                        <h3 className="text-base font-semibold text-foreground">
                          {discipline.discipline}
                        </h3>
                        {discipline.teacher ? (
                          <p className="text-sm text-muted-foreground">{discipline.teacher}</p>
                        ) : null}
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {disciplineMaterials.map((material) => (
                            <div
                              key={material.id}
                              className="animate-in fade-in slide-in-from-top-1 duration-200"
                            >
                              <ReadingMaterialCard material={material} />
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
