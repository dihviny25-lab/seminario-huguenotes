import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

import { PainelShell } from "@/components/painel/PainelShell";
import { Skeleton } from "@/components/ui/skeleton";
import { listSharedWithMeFn } from "@/functions/materialSharing";

/** Apostilas que outros professores compartilharam comigo — só leitura e comentário. */
export function SharedMaterials() {
  const { data: materials, isLoading } = useQuery({
    queryKey: ["shared-materials"],
    queryFn: () => listSharedWithMeFn(),
  });

  return (
    <PainelShell
      title="Apostilas compartilhadas"
      description="Materiais que outros professores compartilharam com você — leitura e comentário."
    >
      {isLoading || !materials ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : materials.length === 0 ? (
        <p className="rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft">
          Nenhuma apostila compartilhada com você ainda.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {materials.map((material) => (
            <Link
              key={material.id}
              to="/painel/apostilas-compartilhadas/$materialId"
              params={{ materialId: material.id }}
              className="animate-in flex items-start gap-3 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-4 shadow-soft fade-in slide-in-from-top-1 duration-200 transition-colors hover:border-primary/50"
            >
              <BookOpen className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground">{material.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {material.disciplineName} · compartilhado por {material.sharedByName}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </PainelShell>
  );
}
