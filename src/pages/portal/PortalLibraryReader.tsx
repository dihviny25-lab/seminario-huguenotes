import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { PortalShell } from "@/components/portal/PortalShell";
import { Skeleton } from "@/components/ui/skeleton";
import { listLibraryBooksFn } from "@/functions/library";

/** Leitor online — sem link de download, só o PDF embutido pra leitura na hora. */
export function PortalLibraryReader({ bookId }: { bookId: string }) {
  const { data: books, isLoading } = useQuery({
    queryKey: ["library-books"],
    queryFn: () => listLibraryBooksFn(),
  });

  const book = books?.find((b) => b.id === bookId);

  return (
    <PortalShell title={book?.title ?? (isLoading ? "Carregando…" : "Livro")}>
      <Link
        to="/portal/biblioteca"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-4 shrink-0" aria-hidden />
        Voltar pra biblioteca
      </Link>

      {isLoading || !book ? (
        <Skeleton className="h-[80vh] w-full" />
      ) : (
        <div className="overflow-hidden rounded-md border border-border/70 bg-card/70 shadow-soft">
          <iframe
            src={`${book.fileUrl}#toolbar=0&navpanes=0`}
            title={book.title}
            className="h-[80vh] w-full"
          />
        </div>
      )}
    </PortalShell>
  );
}
