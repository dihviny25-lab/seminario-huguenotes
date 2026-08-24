import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PainelShell } from "@/components/painel/PainelShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  createLibraryBookFn,
  deleteLibraryBookFn,
  listLibraryBooksFn,
  updateLibraryBookFn,
  type LibraryBook,
} from "@/functions/library";
import { uploadFile } from "@/lib/blobUpload";

const LIBRARY_KEY = ["library-books"] as const;

/** Biblioteca virtual — professor sobe livros; aluno só lê online (sem baixar). */
export function Library() {
  const queryClient = useQueryClient();
  const { data: books, isLoading } = useQuery({
    queryKey: LIBRARY_KEY,
    queryFn: () => listLibraryBooksFn(),
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [editBook, setEditBook] = useState<LibraryBook | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (bookId: string) => deleteLibraryBookFn({ data: { bookId } }),
    onSuccess: async () => {
      toast.success("Livro removido.");
      await queryClient.invalidateQueries({ queryKey: LIBRARY_KEY });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível remover."),
  });

  return (
    <PainelShell
      title="Biblioteca virtual"
      description="Livros disponíveis pros alunos lerem online dentro do portal (sem download)."
    >
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Novo livro
        </Button>
      </div>

      {isLoading || !books ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : books.length === 0 ? (
        <p className="rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft">
          Nenhum livro cadastrado ainda.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <div
              key={book.id}
              className="flex items-start gap-3 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-4 shadow-soft"
            >
              <BookOpen className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground">{book.title}</span>
                {book.author ? (
                  <span className="block text-xs text-muted-foreground">{book.author}</span>
                ) : null}
                {book.description ? (
                  <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
                    {book.description}
                  </span>
                ) : null}
                <span className="mt-1 block text-xs text-muted-foreground">
                  Enviado por {book.uploadedByName}
                </span>
              </span>
              <div className="flex shrink-0 flex-col gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Editar"
                  onClick={() => setEditBook(book)}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Excluir"
                  onClick={() => deleteMutation.mutate(book.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateBookDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditBookDialog book={editBook} onOpenChange={(open) => !open && setEditBook(null)} />
    </PainelShell>
  );
}

function EditBookDialog({
  book,
  onOpenChange,
}: {
  book: LibraryBook | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(book?.title ?? "");
  const [author, setAuthor] = useState(book?.author ?? "");
  const [description, setDescription] = useState(book?.description ?? "");

  // O diálogo fica montado o tempo todo — sem isso, o useState acima só pega o
  // valor de `book` na primeira vez que abriu, e editar um livro diferente
  // depois mostraria os dados do livro anterior.
  useEffect(() => {
    if (book) {
      setTitle(book.title);
      setAuthor(book.author ?? "");
      setDescription(book.description ?? "");
    }
  }, [book]);

  const mutation = useMutation({
    mutationFn: () =>
      updateLibraryBookFn({
        data: {
          bookId: book!.id,
          title,
          author: author || undefined,
          description: description || undefined,
        },
      }),
    onSuccess: async () => {
      toast.success("Livro atualizado.");
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: LIBRARY_KEY });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar."),
  });

  return (
    <Dialog open={book !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar livro</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (title.trim().length === 0) return;
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="book-edit-title">Título</Label>
            <Input
              id="book-edit-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="book-edit-author">Autor (opcional)</Label>
            <Input
              id="book-edit-author"
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="book-edit-description">Descrição (opcional)</Label>
            <Textarea
              id="book-edit-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateBookDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  function reset() {
    setTitle("");
    setAuthor("");
    setDescription("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Escolha um arquivo.");
      setUploading(true);
      try {
        const uploaded = await uploadFile(file);
        return createLibraryBookFn({
          data: {
            title,
            author: author || undefined,
            description: description || undefined,
            fileUrl: uploaded.url,
            fileName: uploaded.fileName,
          },
        });
      } finally {
        setUploading(false);
      }
    },
    onSuccess: async () => {
      toast.success("Livro adicionado.");
      reset();
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: LIBRARY_KEY });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível adicionar."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo livro</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (title.trim().length === 0 || !file) return;
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="book-title">Título</Label>
            <Input
              id="book-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="book-author">Autor (opcional)</Label>
            <Input
              id="book-author"
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="book-description">Descrição (opcional)</Label>
            <Textarea
              id="book-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="book-file">Arquivo (PDF)</Label>
            <Input
              id="book-file"
              type="file"
              ref={fileInputRef}
              accept=".pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending || uploading}>
              {uploading ? "Enviando…" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
