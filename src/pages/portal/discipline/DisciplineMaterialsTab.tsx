import { useQuery } from "@tanstack/react-query";

import { ReadingMaterialCard } from "@/components/portal/ReadingMaterialCard";
import { Skeleton } from "@/components/ui/skeleton";
import { listDisciplineMaterialsFn } from "@/functions/readingMaterials";

export function DisciplineMaterialsTab({ disciplineId }: { disciplineId: string }) {
  const { data: materials, isLoading } = useQuery({
    queryKey: ["discipline-materials", disciplineId],
    queryFn: () => listDisciplineMaterialsFn({ data: { disciplineId } }),
  });

  if (isLoading || !materials) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (materials.length === 0) {
    return (
      <p className="animate-in rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft fade-in zoom-in-95 duration-300">
        Nenhum material de leitura cadastrado ainda.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {materials.map((material) => (
        <div key={material.id} className="animate-in fade-in slide-in-from-top-1 duration-200">
          <ReadingMaterialCard material={material} />
        </div>
      ))}
    </div>
  );
}
