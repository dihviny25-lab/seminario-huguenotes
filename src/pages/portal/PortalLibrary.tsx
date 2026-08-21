import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpen, Search } from "lucide-react";

import { PortalShell } from "@/components/portal/PortalShell";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { listLibraryBooksFn } from "@/functions/library";

/** Biblioteca virtual — livros pra ler online dentro do portal (sem download). */
export function PortalLibrary() {
  const { data: books, isLoading } = useQuery({
    queryKey: ["library-books"],
    queryFn: () => listLibraryBooksFn(),
  });
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!books) return [];
    const term = search.trim().toLowerCase();
    if (term.length === 0) return books;
    return books.filter(
      (book) =>
        book.title.toLowerCase().includes(term) || (book.author ?? "").toLowerCase().includes(term),
    );
  }, [books, search]);

  return (
    <PortalShell title="Biblioteca" description="Livros disponíveis pra ler online, sem download.">
      <div className="relative mb-6 print:hidden">
        <Search
          className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          placeholder="Buscar por título ou autor…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading || !books ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft">
          {books.length === 0 ? "Nenhum livro disponível ainda." : "Nenhum livro encontrado."}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((book) => (
            <Link
              key={book.id}
              to="/portal/biblioteca/$bookId"
              params={{ bookId: book.id }}
              className="flex items-start gap-3 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-4 shadow-soft transition-colors hover:border-primary/50"
            >
              <BookOpen className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">{book.title}</span>
                {book.author ? (
                  <span className="block text-xs text-muted-foreground">{book.author}</span>
                ) : null}
                <span className="mt-2 inline-block text-xs font-medium text-accent">
                  Ler online
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
