import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Download, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  createMaterialFn,
  deleteMaterialFn,
  listMyDisciplineMaterialsFn,
  updateMaterialFn,
  type ReadingMaterial,
} from "@/functions/readingMaterials";
import { uploadFile } from "@/lib/blobUpload";

function materialsKey(disciplineId: string) {
  return ["discipline-materials", disciplineId] as const;
}

export function ReadingMaterialsTab({ disciplineId }: { disciplineId: string }) {
  const queryClient = useQueryClient();
  const { data: materials, isLoading } = useQuery({
    queryKey: materialsKey(disciplineId),
    queryFn: () => listMyDisciplineMaterialsFn({ data: { disciplineId } }),
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [editMaterial, setEditMaterial] = useState<ReadingMaterial | null>(null);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: materialsKey(disciplineId) });
  }

  const deleteMutation = useMutation({
    mutationFn: (materialId: string) => deleteMaterialFn({ data: { disciplineId, materialId } }),
    onSuccess: async () => {
      toast.success("Material removido.");
      await invalidate();
    },
    onError: () => toast.error("Não foi possível remover o material."),
  });

  if (isLoading || !materials) {
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
          Novo material
        </Button>
      </div>

      {materials.length === 0 ? (
        <p className="rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft">
          Nenhum material de leitura cadastrado ainda.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {materials.map((material) => (
            <div
              key={material.id}
              className="animate-in flex items-start gap-3 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-4 shadow-soft fade-in slide-in-from-top-1 duration-200"
            >
              <BookOpen className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground">{material.title}</span>
                {material.description ? (
                  <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
                    {material.description}
                  </span>
                ) : null}
                <a
                  href={material.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Download className="size-3.5 shrink-0" aria-hidden />
                  {material.fileName}
                </a>
              </span>
              <div className="flex shrink-0 flex-col gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Editar"
                  onClick={() => setEditMaterial(material)}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Excluir"
                  onClick={() => deleteMutation.mutate(material.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateMaterialDialog
        disciplineId={disciplineId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={invalidate}
      />
      <EditMaterialDialog
        disciplineId={disciplineId}
        material={editMaterial}
        onOpenChange={(open) => !open && setEditMaterial(null)}
        onUpdated={invalidate}
      />
    </div>
  );
}

function EditMaterialDialog({
  disciplineId,
  material,
  onOpenChange,
  onUpdated,
}: {
  disciplineId: string;
  material: ReadingMaterial | null;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => Promise<unknown>;
}) {
  const [title, setTitle] = useState(material?.title ?? "");
  const [description, setDescription] = useState(material?.description ?? "");

  // O diálogo fica montado o tempo todo — sem isso, o useState acima só pega o
  // valor de `material` na primeira vez que abriu, e editar um material
  // diferente depois mostraria os dados do material anterior.
  useEffect(() => {
    if (material) {
      setTitle(material.title);
      setDescription(material.description ?? "");
    }
  }, [material]);

  const mutation = useMutation({
    mutationFn: () =>
      updateMaterialFn({
        data: {
          disciplineId,
          materialId: material!.id,
          title,
          description: description || undefined,
        },
      }),
    onSuccess: async () => {
      toast.success("Material atualizado.");
      onOpenChange(false);
      await onUpdated();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar."),
  });

  return (
    <Dialog open={material !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar material</DialogTitle>
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
            <Label htmlFor="material-edit-title">Título</Label>
            <Input
              id="material-edit-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="material-edit-description">Descrição (opcional)</Label>
            <Textarea
              id="material-edit-description"
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

function CreateMaterialDialog({
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
  const [uploading, setUploading] = useState(false);

  function reset() {
    setTitle("");
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
        return createMaterialFn({
          data: {
            disciplineId,
            title,
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
      toast.success("Material adicionado.");
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
          <DialogTitle>Novo material de leitura</DialogTitle>
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
            <Label htmlFor="material-title">Título</Label>
            <Input
              id="material-title"
              placeholder="Capítulo 1 — Introdução"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="material-description">Descrição (opcional)</Label>
            <Textarea
              id="material-description"
              placeholder="Leitura obrigatória para a próxima aula…"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="material-file">Arquivo (PDF, Word ou imagem)</Label>
            <Input
              id="material-file"
              type="file"
              ref={fileInputRef}
              accept=".pdf,.doc,.docx,image/png,image/jpeg"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending || uploading}>
              {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {uploading ? "Enviando…" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
