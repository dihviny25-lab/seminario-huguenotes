import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Lock } from "lucide-react";

import { PdfPageViewer } from "@/components/PdfPageViewer";
import { PortalShell } from "@/components/portal/PortalShell";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getPresentationSlideFileFn,
  listAllPresentationSlidesFn,
} from "@/functions/presentationSlides";
import { usePrivateFileUrl } from "@/hooks/usePrivateFileUrl";

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/** Leitor de slide — página a página, só online. */
export function PortalSlideReader({ slideId }: { slideId: string }) {
  const { data: slides, isLoading } = useQuery({
    queryKey: ["all-presentation-slides"],
    queryFn: () => listAllPresentationSlidesFn(),
  });

  const slide = slides?.find((s) => s.id === slideId);
  const {
    data: slideFile,
    isLoading: isFileLoading,
    isError: isFileError,
  } = useQuery({
    queryKey: ["presentation-slide-file", slideId],
    queryFn: () => getPresentationSlideFileFn({ data: { slideId } }),
    enabled: Boolean(slide && !slide.availableAt),
  });
  const resolvedFile = usePrivateFileUrl(slideFile?.fileId);

  return (
    <PortalShell title={slide?.title ?? (isLoading ? "Carregando…" : "Slide")} fullWidth>
      <Link
        to="/portal/slides"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-4 shrink-0" aria-hidden />
        Voltar pros slides
      </Link>

      {isLoading ? (
        <Skeleton className="h-[85vh] w-full" />
      ) : !slide ? (
        <div className="animate-in flex h-[50vh] flex-col items-center justify-center gap-3 rounded-md border border-border/70 bg-card/70 text-center shadow-soft fade-in zoom-in-95 duration-300">
          <p className="text-muted-foreground">Este slide não foi encontrado.</p>
          <Link to="/portal/slides" className="text-sm font-medium text-accent hover:underline">
            Voltar pros slides
          </Link>
        </div>
      ) : slide.availableAt ? (
        <div className="animate-in flex h-[50vh] flex-col items-center justify-center gap-3 rounded-md border border-border/70 bg-card/70 text-center shadow-soft fade-in zoom-in-95 duration-300">
          <Lock className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-muted-foreground">
            Esses slides ficam disponíveis a partir de {formatDate(slide.availableAt)}.
          </p>
        </div>
      ) : isFileLoading || (slideFile?.fileId && resolvedFile.isLoading) ? (
        <Skeleton className="h-[85vh] w-full" />
      ) : isFileError || !slideFile ? (
        <div className="flex h-[50vh] items-center justify-center rounded-md border border-border/70 bg-card/70 text-center shadow-soft">
          <p className="text-muted-foreground">Não foi possível liberar o arquivo deste slide.</p>
        </div>
      ) : !slideFile.fileId || !resolvedFile.url ? (
        <div className="flex h-[50vh] items-center justify-center rounded-md border border-border/70 bg-card/70 text-center shadow-soft">
          <p className="text-muted-foreground">Arquivo indisponível para migração.</p>
        </div>
      ) : (
        <PdfPageViewer fileUrl={resolvedFile.url} />
      )}
    </PortalShell>
  );
}
