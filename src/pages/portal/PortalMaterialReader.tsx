import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Lock } from "lucide-react";

import { PortalShell } from "@/components/portal/PortalShell";
import { Skeleton } from "@/components/ui/skeleton";
import { listAllReadingMaterialsFn } from "@/functions/readingMaterials";

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/** Leitor online da apostila — sem link de download, só o PDF embutido. */
export function PortalMaterialReader({ materialId }: { materialId: string }) {
  const { data: materials, isLoading } = useQuery({
    queryKey: ["all-reading-materials"],
    queryFn: () => listAllReadingMaterialsFn(),
  });

  const material = materials?.find((m) => m.id === materialId);

  return (
    <PortalShell title={material?.title ?? (isLoading ? "Carregando…" : "Apostila")} fullWidth>
      <Link
        to="/portal/apostilas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-4 shrink-0" aria-hidden />
        Voltar pras apostilas
      </Link>

      {isLoading || !material ? (
        <Skeleton className="h-[85vh] w-full" />
      ) : material.availableAt ? (
        <div className="animate-in flex h-[50vh] flex-col items-center justify-center gap-3 rounded-md border border-border/70 bg-card/70 text-center shadow-soft fade-in zoom-in-95 duration-300">
          <Lock className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-muted-foreground">
            Essa apostila fica disponível a partir de {formatDate(material.availableAt)}.
          </p>
        </div>
      ) : (
        <div className="animate-in overflow-hidden rounded-md border border-border/70 bg-card/70 shadow-soft fade-in duration-300">
          <iframe
            src={`${material.fileUrl}#toolbar=0&navpanes=0`}
            title={material.title}
            className="h-[85vh] w-full"
          />
        </div>
      )}
    </PortalShell>
  );
}
