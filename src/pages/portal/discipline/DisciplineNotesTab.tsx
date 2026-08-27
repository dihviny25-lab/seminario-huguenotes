import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  HelpCircle,
  Loader2,
  MessageSquare,
  NotebookPen,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  convertNoteToThreadFn,
  createNoteFn,
  deleteNoteFn,
  listMyNotesFn,
  updateNoteFn,
  type StudentNote,
} from "@/functions/studentNotes";

function notesKey(disciplineId: string) {
  return ["student-notes", disciplineId] as const;
}

export function DisciplineNotesTab({ disciplineId }: { disciplineId: string }) {
  const queryClient = useQueryClient();
  const { data: notes, isLoading } = useQuery({
    queryKey: notesKey(disciplineId),
    queryFn: () => listMyNotesFn({ data: { disciplineId } }),
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [editNote, setEditNote] = useState<StudentNote | null>(null);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: notesKey(disciplineId) });
  }

  const deleteMutation = useMutation({
    mutationFn: (noteId: string) => deleteNoteFn({ data: { noteId } }),
    onSuccess: async () => {
      toast.success("Anotação removida.");
      await invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível remover."),
  });

  const convertMutation = useMutation({
    mutationFn: (noteId: string) => convertNoteToThreadFn({ data: { noteId } }),
    onSuccess: async () => {
      toast.success("Dúvida publicada no fórum.");
      await invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível publicar."),
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Só você vê suas anotações — nem os professores têm acesso. Já uma dúvida pode ser
          publicada no fórum quando você quiser.
        </p>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Nova
        </Button>
      </div>

      {isLoading || !notes ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <p className="animate-in rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft fade-in zoom-in-95 duration-300">
          Nenhuma anotação ainda. Que tal começar uma agora?
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className={
                "flex animate-in items-start gap-3 rounded-md border border-t-2 bg-card/70 p-4 shadow-soft fade-in slide-in-from-top-1 duration-200 " +
                (note.kind === "question"
                  ? "border-border/70 border-t-primary"
                  : "border-border/70 border-t-accent")
              }
            >
              {note.kind === "question" ? (
                <HelpCircle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              ) : (
                <NotebookPen className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  {note.kind === "question" ? <Badge variant="outline">Dúvida</Badge> : null}
                  {note.title ? (
                    <span className="truncate font-medium text-foreground">{note.title}</span>
                  ) : null}
                </span>
                <span className="mt-1 block whitespace-pre-wrap text-sm text-muted-foreground">
                  {note.content}
                </span>
                <span className="mt-2 block text-xs text-muted-foreground">
                  Atualizado em{" "}
                  {new Date(note.updatedAt).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
                {note.kind === "question" ? (
                  note.forumThreadId ? (
                    <Link
                      to="/portal/forum/$threadId"
                      params={{ threadId: note.forumThreadId }}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <MessageSquare className="size-3.5 shrink-0" aria-hidden />
                      Ver no fórum
                    </Link>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => convertMutation.mutate(note.id)}
                      disabled={convertMutation.isPending}
                    >
                      {convertMutation.isPending && convertMutation.variables === note.id ? (
                        <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
                      ) : (
                        <MessageSquare className="size-3.5 shrink-0" aria-hidden />
                      )}
                      Publicar no fórum
                    </Button>
                  )
                ) : null}
              </span>
              <div className="flex shrink-0 flex-col gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Editar"
                  onClick={() => setEditNote(note)}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Excluir"
                  onClick={() => deleteMutation.mutate(note.id)}
                  disabled={deleteMutation.isPending && deleteMutation.variables === note.id}
                >
                  {deleteMutation.isPending && deleteMutation.variables === note.id ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="size-4" aria-hidden />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateNoteDialog
        disciplineId={disciplineId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={invalidate}
      />
      <EditNoteDialog
        note={editNote}
        onOpenChange={(open) => !open && setEditNote(null)}
        onUpdated={invalidate}
      />
    </div>
  );
}

function CreateNoteDialog({
  disciplineId,
  open,
  onOpenChange,
  onCreated,
}: {
  disciplineId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<unknown>;
}) {
  const [kind, setKind] = useState<"note" | "question">("note");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  function reset() {
    setKind("note");
    setTitle("");
    setContent("");
  }

  const mutation = useMutation({
    mutationFn: () =>
      createNoteFn({ data: { disciplineId, kind, title: title || undefined, content } }),
    onSuccess: async () => {
      toast.success(kind === "question" ? "Dúvida criada." : "Anotação criada.");
      reset();
      onOpenChange(false);
      await onCreated();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível criar."),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova anotação</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (content.trim().length === 0) return;
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label>Tipo</Label>
            <RadioGroup
              value={kind}
              onValueChange={(value) => setKind(value as "note" | "question")}
              className="flex gap-4"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="note" />
                Anotação pessoal
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="question" />
                Dúvida
              </label>
            </RadioGroup>
            {kind === "question" ? (
              <p className="text-xs text-muted-foreground">
                Fica privada até você decidir publicar no fórum da disciplina.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="note-title">Título (opcional)</Label>
            <Input
              id="note-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note-content">{kind === "question" ? "Sua dúvida" : "Anotação"}</Label>
            <Textarea
              id="note-content"
              rows={6}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditNoteDialog({
  note,
  onOpenChange,
  onUpdated,
}: {
  note: StudentNote | null;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => Promise<unknown>;
}) {
  const [kind, setKind] = useState<"note" | "question">(note?.kind ?? "note");
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");

  // O diálogo fica montado o tempo todo (só o conteúdo visual entra/sai) — sem isso,
  // o useState acima só pega o valor de `note` da primeira vez que abriu, e reabrir
  // pra editar uma anotação diferente mostraria os dados da anterior.
  useEffect(() => {
    if (note) {
      setKind(note.kind);
      setTitle(note.title ?? "");
      setContent(note.content);
    }
  }, [note]);

  const mutation = useMutation({
    mutationFn: () =>
      updateNoteFn({ data: { noteId: note!.id, kind, title: title || undefined, content } }),
    onSuccess: async () => {
      toast.success("Anotação atualizada.");
      onOpenChange(false);
      await onUpdated();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar."),
  });

  return (
    <Dialog open={note !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar anotação</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (content.trim().length === 0) return;
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label>Tipo</Label>
            <RadioGroup
              value={kind}
              onValueChange={(value) => setKind(value as "note" | "question")}
              className="flex gap-4"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="note" />
                Anotação pessoal
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="question" />
                Dúvida
              </label>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note-edit-title">Título (opcional)</Label>
            <Input
              id="note-edit-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note-edit-content">Anotação</Label>
            <Textarea
              id="note-edit-content"
              rows={6}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
