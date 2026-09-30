import { useEffect, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Maximize, Minimize } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

/**
 * Visualizador de PDF página a página, renderizado em canvas (react-pdf) —
 * nunca um `<iframe>`/visualizador nativo do navegador, que em vários
 * celulares não exibe o PDF embutido e cai direto pro download. Usado
 * pelo leitor de slides, apostila e livro da biblioteca.
 */
export function PdfPageViewer({ fileUrl }: { fileUrl: string }) {
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
    <div
      ref={setContainer}
      className="animate-in mx-auto flex max-w-7xl flex-col items-center gap-4 rounded-md border border-border/70 bg-card/70 p-4 shadow-soft fade-in duration-300"
    >
      {loadError ? (
        <div className="flex h-[70vh] flex-col items-center justify-center gap-3 text-center">
          <AlertTriangle className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-muted-foreground">Não foi possível carregar este arquivo.</p>
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
          file={fileUrl}
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
          Página {current} de {numPages || "…"}
        </span>
        <Button
          variant="outline"
          size="icon"
          disabled={numPages < 1 || loadError || current >= numPages}
          onClick={() => setCurrent((page) => Math.min(numPages, page + 1))}
          title="Próxima"
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
  );
}
