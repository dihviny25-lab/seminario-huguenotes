import { PrivateFileLink } from "@/components/PrivateFileLink";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrivateFileUrl } from "@/hooks/usePrivateFileUrl";
import { getEmbeddableViewerUrl, isEmbeddableInline } from "@/lib/documentViewer";

/**
 * Leitor embutido (PDF sem toolbar). Word/PowerPoint não têm visualizador
 * nativo confiável e o blob agora é privado — em vez de embutir, oferece
 * download autorizado. Registro legado (sem `fileId`) mostra indisponível
 * até a migração manual — nunca embute a URL pública antiga.
 */
export function PrivateDocumentViewer({
  fileId,
  fileUrl,
  fileName,
  title,
  className,
}: {
  fileId: string | null;
  fileUrl: string | null;
  fileName: string;
  title: string;
  className?: string;
}) {
  const { url, isLoading } = usePrivateFileUrl(fileId);

  if (!fileId) {
    return (
      <div
        className={`flex h-[50vh] items-center justify-center text-center text-muted-foreground ${className ?? ""}`}
      >
        Arquivo indisponível para migração.
      </div>
    );
  }

  if (isLoading || !url) {
    return <Skeleton className={className ?? "h-[70vh] w-full"} />;
  }

  if (!isEmbeddableInline(fileName)) {
    return (
      <div
        className={`flex h-[50vh] flex-col items-center justify-center gap-3 text-center ${className ?? ""}`}
      >
        <p className="text-muted-foreground">
          Este formato não tem visualização embutida — baixe o arquivo pra abrir.
        </p>
        <PrivateFileLink
          fileId={fileId}
          fileUrl={fileUrl}
          fileName={fileName}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        />
      </div>
    );
  }

  return <iframe src={getEmbeddableViewerUrl(url)} title={title} className={className} />;
}
