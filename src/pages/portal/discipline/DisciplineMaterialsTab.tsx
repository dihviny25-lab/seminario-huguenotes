import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

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
      <p className="rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft">
        Nenhum material de leitura disponível ainda.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {materials.map((material) => (
        <Link
          key={material.id}
          to="/portal/apostilas/$materialId"
          params={{ materialId: material.id }}
          className="flex items-start gap-3 rounded-md border border-border/70 bg-card/70 p-4 shadow-soft transition-colors hover:border-primary/50"
        >
          <BookOpen className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-foreground">{material.title}</span>
            {material.description ? (
              <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
                {material.description}
              </span>
            ) : null}
            <span className="mt-2 inline-block text-xs font-medium text-accent">Ler online</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
