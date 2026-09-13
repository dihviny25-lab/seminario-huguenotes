import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Loader2, MonitorPlay, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PainelShell } from "@/components/painel/PainelShell";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { listMyMaterialsFn, type MyMaterialItem } from "@/functions/myMaterials";
import { deleteMaterialFn, updateMaterialFn } from "@/functions/readingMaterials";
import { deleteSlideFn, updateSlideFn } from "@/functions/presentationSlides";

const MY_MATERIALS_KEY = ["my-materials"] as const;

function editItem(item: MyMaterialItem, title: string, description: string) {
  return item.kind === "apostila"
    ? updateMaterialFn({
        data: {
          disciplineId: item.disciplineId,
          materialId: item.id,
          title,
          description: description || undefined,
        },
      })
    : updateSlideFn({
        data: {
          disciplineId: item.disciplineId,
          slideId: item.id,
          title,
          description: description || undefined,
        },
      });
}

function deleteItem(item: MyMaterialItem) {
  return item.kind === "apostila"
    ? deleteMaterialFn({ data: { disciplineId: item.disciplineId, materialId: item.id } })
    : deleteSlideFn({ data: { disciplineId: item.disciplineId, slideId: item.id } });
}

export function MyMaterials() {
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useQuery({
    queryKey: MY_MATERIALS_KEY,
    queryFn: () => listMyMaterialsFn(),
  });
  const [editItemState, setEditItemState] = useState<MyMaterialItem | null>(null);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: MY_MATERIALS_KEY });
  }

  const deleteMutation = useMutation({
    mutationFn: (item: MyMaterialItem) => deleteItem(item),
    onSuccess: async () => {
      toast.success("Item removido.");
      await invalidate();
    },
    onError: () => toast.error("Não foi possível remover o item."),
  });

  const groups = new Map<string, Array<MyMaterialItem>>();
  for (const item of items ?? []) {
    const list = groups.get(item.disciplineName) ?? [];
    list.push(item);
    groups.set(item.disciplineName, list);
  }

  return (
    <PainelShell
      title="Minhas Matérias"
      description="Apostilas e slides de todas as suas disciplinas, num lugar só."
    >
      {isLoading || !items ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : groups.size === 0 ? (
        <p className="rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft">
          Nenhuma apostila ou slide cadastrado ainda. Adicione pela aba da disciplina.
        </p>
      ) : (
        <div className="space-y-8">
          {Array.from(groups.entries()).map(([disciplineName, disciplineItems]) => (
            <section key={disciplineName}>
              <h2 className="font-display text-lg font-semibold text-foreground">
                {disciplineName}
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {disciplineItems.map((item) => (
                  <div
                    key={`${item.kind}-${item.id}`}
                    className="animate-in flex items-start gap-3 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-4 shadow-soft fade-in slide-in-from-top-1 duration-200"
                  >
                    {item.kind === "slide" ? (
                      <MonitorPlay className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                    ) : (
                      <BookOpen className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <Badge variant="secondary" className="mb-1">
                        {item.kind === "slide" ? "Slide" : "Apostila"}
                      </Badge>
                      <span className="block truncate font-medium text-foreground">
                        {item.title}
                      </span>
                      {item.description ? (
                        <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      ) : null}
                    </span>
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        onClick={() => setEditItemState(item)}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Excluir"
                        onClick={() => deleteMutation.mutate(item)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <EditMyMaterialDialog
        item={editItemState}
        onOpenChange={(open) => !open && setEditItemState(null)}
        onUpdated={invalidate}
      />
    </PainelShell>
  );
}

function EditMyMaterialDialog({
  item,
  onOpenChange,
  onUpdated,
}: {
  item: MyMaterialItem | null;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => Promise<unknown>;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setDescription(item.description ?? "");
    }
  }, [item]);

  const mutation = useMutation({
    mutationFn: () => editItem(item!, title, description),
    onSuccess: async () => {
      toast.success("Item atualizado.");
      onOpenChange(false);
      await onUpdated();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar."),
  });

  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {item?.kind === "slide" ? "slide" : "material"}</DialogTitle>
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
            <Label htmlFor="my-materials-edit-title">Título</Label>
            <Input
              id="my-materials-edit-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="my-materials-edit-description">Descrição (opcional)</Label>
            <Textarea
              id="my-materials-edit-description"
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
