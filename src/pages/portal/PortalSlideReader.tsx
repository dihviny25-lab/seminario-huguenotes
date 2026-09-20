import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Lock,
  Maximize,
  Minimize,
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";

import { Button } from "@/components/ui/button";
import { PortalShell } from "@/components/portal/PortalShell";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getPresentationSlideFileFn,
  listAllPresentationSlidesFn,
} from "@/functions/presentationSlides";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/** Leitor de slide — página a página, controlado pela nossa UI (nunca pelo iframe do visualizador). */
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

  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [current, setCurrent] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [documentKey, setDocumentKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const element = container;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(Math.min(width, 1280));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [container]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement !== null);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (numPages < 1 || loadError) return;
      if (event.key === "ArrowLeft") setCurrent((page) => Math.max(1, page - 1));
      if (event.key === "ArrowRight") setCurrent((page) => Math.min(numPages, page + 1));
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [numPages, loadError]);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (container) {
      container.requestFullscreen().catch(() => {});
    }
  }

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
      ) : isFileLoading ? (
        <Skeleton className="h-[85vh] w-full" />
      ) : isFileError || !slideFile ? (
        <div className="flex h-[50vh] items-center justify-center rounded-md border border-border/70 bg-card/70 text-center shadow-soft">
          <p className="text-muted-foreground">Não foi possível liberar o arquivo deste slide.</p>
        </div>
      ) : (
        <div
          ref={setContainer}
          className="animate-in mx-auto flex max-w-7xl flex-col items-center gap-4 rounded-md border border-border/70 bg-card/70 p-4 shadow-soft fade-in duration-300"
        >
          {loadError ? (
            <div className="flex h-[70vh] flex-col items-center justify-center gap-3 text-center">
              <AlertTriangle className="size-8 text-muted-foreground" aria-hidden />
              <p className="text-muted-foreground">Não foi possível carregar este slide.</p>
              <Button
                variant="outline"
                onClick={() => {
                  setLoadError(false);
                  setDocumentKey((key) => key + 1);
                }}
              >
                Tentar de novo
              </Button>
            </div>
          ) : (
            <Document
              key={documentKey}
              file={slideFile.fileUrl}
              onLoadSuccess={({ numPages: total }) => {
                setNumPages(total);
                setCurrent(1);
              }}
              onLoadError={() => setLoadError(true)}
              loading={<Skeleton className="h-[70vh] w-full" />}
            >
              <Page
                pageNumber={current}
                width={containerWidth || undefined}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>
          )}

          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              disabled={numPages < 1 || loadError || current <= 1}
              onClick={() => setCurrent((page) => Math.max(1, page - 1))}
              title="Anterior"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <span className="text-sm text-muted-foreground">
              Slide {current} de {numPages || "…"}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={numPages < 1 || loadError || current >= numPages}
              onClick={() => setCurrent((page) => Math.min(numPages, page + 1))}
              title="Próximo"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Button>
            <Button variant="outline" size="icon" onClick={toggleFullscreen} title="Tela cheia">
              {isFullscreen ? (
                <Minimize className="size-4" aria-hidden />
              ) : (
                <Maximize className="size-4" aria-hidden />
              )}
            </Button>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
