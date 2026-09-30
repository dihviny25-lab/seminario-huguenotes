import { PdfPageViewer } from "@/components/PdfPageViewer";
import { PrivateFileLink } from "@/components/PrivateFileLink";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrivateFileUrl } from "@/hooks/usePrivateFileUrl";
import { getViewerKind } from "@/lib/documentViewer";

const BOX =
  "animate-in rounded-md border border-border/70 bg-card/70 shadow-soft fade-in duration-300";

/**
 * Leitor embutido, sempre online — nunca oferece download pra quem só
 * precisa ler. PDF e imagem são renderizados no navegador; Word/PowerPoint
 * não têm visualizador confiável, então cai num aviso com link de
 * download só como saída de emergência pra conteúdo enviado antes da
 * política de upload passar a aceitar só PDF/imagem. Registro legado (sem
 * `fileId`) mostra indisponível até a migração manual — nunca embute a
 * URL pública antiga.
 */
export function PrivateDocumentViewer({
  fileId,
  fileUrl,
  fileName,
  className,
}: {
  fileId: string | null;
  fileUrl: string | null;
  fileName: string;
  className?: string;
}) {
  const { url, isLoading } = usePrivateFileUrl(fileId);

  if (!fileId) {
    return (
      <div
        className={`flex h-[50vh] items-center justify-center text-center text-muted-foreground ${BOX} ${className ?? ""}`}
      >
        Arquivo indisponível para migração.
      </div>
    );
  }

  if (isLoading || !url) {
    return <Skeleton className={className ?? "h-[70vh] w-full"} />;
  }

  const kind = getViewerKind(fileName);

  if (kind === "pdf") {
    return <PdfPageViewer fileUrl={url} />;
  }

  if (kind === "image") {
    return (
      <div className={`overflow-auto p-4 ${BOX} ${className ?? ""}`}>
        <img src={url} alt={fileName} className="mx-auto max-w-full" />
      </div>
    );
  }

  return (
    <div
      className={`flex h-[50vh] flex-col items-center justify-center gap-3 text-center ${BOX} ${className ?? ""}`}
    >
      <p className="text-muted-foreground">
        Este arquivo foi enviado em Word/PowerPoint e não tem visualização online — peça pro
        professor reenviar em PDF.
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
