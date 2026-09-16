import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, MonitorPlay, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  createSlideFn,
  deleteSlideFn,
  listMyDisciplineSlidesFn,
  updateSlideFn,
  type PresentationSlide,
} from "@/functions/presentationSlides";
import { uploadFile } from "@/lib/blobUpload";

function slidesKey(disciplineId: string) {
  return ["discipline-slides", disciplineId] as const;
}

export function SlidesTab({ disciplineId }: { disciplineId: string }) {
  const queryClient = useQueryClient();
  const { data: slides, isLoading } = useQuery({
    queryKey: slidesKey(disciplineId),
    queryFn: () => listMyDisciplineSlidesFn({ data: { disciplineId } }),
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [editSlide, setEditSlide] = useState<PresentationSlide | null>(null);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: slidesKey(disciplineId) });
  }

  const deleteMutation = useMutation({
    mutationFn: (slideId: string) => deleteSlideFn({ data: { disciplineId, slideId } }),
    onSuccess: async () => {
      toast.success("Slide removido.");
      await invalidate();
    },
    onError: () => toast.error("Não foi possível remover o slide."),
  });

  if (isLoading || !slides) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-md border border-t-2 border-border/70 border-t-border bg-card/70 p-4 shadow-soft"
          >
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Novo slide
        </Button>
      </div>

      {slides.length === 0 ? (
        <p className="rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft">
          Nenhum slide cadastrado ainda.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {slides.map((slide) => (
            <div
              key={slide.id}
              className="animate-in flex items-start gap-3 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-4 shadow-soft fade-in slide-in-from-top-1 duration-200"
            >
              <MonitorPlay className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground">{slide.title}</span>
                {slide.description ? (
                  <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
                    {slide.description}
                  </span>
                ) : null}
                <a
                  href={slide.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Download className="size-3.5 shrink-0" aria-hidden />
                  {slide.fileName}
                </a>
              </span>
              <div className="flex shrink-0 flex-col gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Editar"
                  onClick={() => setEditSlide(slide)}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Excluir"
                  onClick={() => deleteMutation.mutate(slide.id)}
                  disabled={deleteMutation.isPending && deleteMutation.variables === slide.id}
                >
                  {deleteMutation.isPending && deleteMutation.variables === slide.id ? (
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

      <CreateSlideDialog
        disciplineId={disciplineId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={invalidate}
      />
      <EditSlideDialog
        disciplineId={disciplineId}
        slide={editSlide}
        onOpenChange={(open) => !open && setEditSlide(null)}
        onUpdated={invalidate}
      />
    </div>
  );
}

function EditSlideDialog({
  disciplineId,
  slide,
  onOpenChange,
  onUpdated,
}: {
  disciplineId: string;
  slide: PresentationSlide | null;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => Promise<unknown>;
}) {
  const [title, setTitle] = useState(slide?.title ?? "");
  const [description, setDescription] = useState(slide?.description ?? "");

  useEffect(() => {
    if (slide) {
      setTitle(slide.title);
      setDescription(slide.description ?? "");
    }
  }, [slide]);

  const mutation = useMutation({
    mutationFn: () =>
      updateSlideFn({
        data: {
          disciplineId,
          slideId: slide!.id,
          title,
          description: description || undefined,
        },
      }),
    onSuccess: async () => {
      toast.success("Slide atualizado.");
      onOpenChange(false);
      await onUpdated();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar."),
  });

  return (
    <Dialog open={slide !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar slide</DialogTitle>
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
            <Label htmlFor="slide-edit-title">Título</Label>
            <Input
              id="slide-edit-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slide-edit-description">Descrição (opcional)</Label>
            <Textarea
              id="slide-edit-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
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

function CreateSlideDialog({
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  function reset() {
    setTitle("");
    setDescription("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Escolha um arquivo.");
      setUploadProgress(0);
      try {
        const uploaded = await uploadFile(file, "slide", setUploadProgress);
        return createSlideFn({
          data: {
            disciplineId,
            title,
            description: description || undefined,
            fileUrl: uploaded.url,
            fileName: uploaded.fileName,
          },
        });
      } finally {
        setUploadProgress(null);
      }
    },
    onSuccess: async () => {
      toast.success("Slide adicionado.");
      reset();
      onOpenChange(false);
      await onCreated();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível adicionar."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo slide</DialogTitle>
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
            <Label htmlFor="slide-title">Título</Label>
            <Input
              id="slide-title"
              placeholder="Aula 1 — Introdução"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slide-description">Descrição (opcional)</Label>
            <Textarea
              id="slide-description"
              placeholder="Apresentação usada em sala…"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slide-file">Arquivo (PDF)</Label>
            <Input
              id="slide-file"
              type="file"
              ref={fileInputRef}
              accept="application/pdf,.pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              disabled={uploadProgress !== null}
              required
            />
            {uploadProgress !== null ? (
              <div className="space-y-1">
                <Progress value={uploadProgress} />
                <p className="text-xs text-muted-foreground">
                  Enviando… {Math.round(uploadProgress)}%
                </p>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending || uploadProgress !== null}>
              {uploadProgress !== null ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              {uploadProgress !== null ? "Enviando…" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
