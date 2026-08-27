import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { PainelShell } from "@/components/painel/PainelShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeletonRows } from "@/components/TableSkeletonRows";
import {
  createCourseMaterialFn,
  deleteCourseMaterialFn,
  listCourseMaterialsFn,
  updateCourseMaterialFn,
  type CourseMaterial,
} from "@/functions/materials";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatAmount(amount: string | number): string {
  return Number(amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const MATERIALS_KEY = ["course-materials"] as const;

/** Catálogo de livros/materiais que podem ser cobrados (ou doados) do aluno em Pagamentos. */
export function Materials() {
  const queryClient = useQueryClient();
  const { data: materials, isLoading } = useQuery({
    queryKey: MATERIALS_KEY,
    queryFn: () => listCourseMaterialsFn(),
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CourseMaterial | null>(null);
  const [deleting, setDeleting] = useState<CourseMaterial | null>(null);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: MATERIALS_KEY });
  }

  const deleteMutation = useMutation({
    mutationFn: (materialId: string) => deleteCourseMaterialFn({ data: { materialId } }),
    onSuccess: async () => {
      toast.success("Material removido do catálogo.");
      setDeleting(null);
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível remover.")),
  });

  return (
    <PainelShell
      title="Materiais"
      description="Catálogo de livros e materiais que podem ser cobrados (ou doados) de um aluno em Pagamentos."
    >
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Novo material
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border border-border/70 bg-card/70 shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows columns={4} />
            ) : materials && materials.length > 0 ? (
              materials.map((material) => (
                <TableRow
                  key={material.id}
                  className="animate-in fade-in slide-in-from-top-1 duration-200"
                >
                  <TableCell className="font-medium text-foreground">{material.title}</TableCell>
                  <TableCell>{formatAmount(material.price)}</TableCell>
                  <TableCell>
                    <Badge variant={material.active ? "default" : "secondary"}>
                      {material.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        onClick={() => setEditing(material)}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Remover"
                        onClick={() => setDeleting(material)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  Nenhum material cadastrado ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CreateMaterialDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={invalidate} />
      <EditMaterialDialog
        material={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={invalidate}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover "{deleting?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso remove o material do catálogo. Cobranças já geradas a partir dele continuam
              existindo normalmente, só deixam de referenciar o catálogo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PainelShell>
  );
}

const materialSchema = z.object({
  title: z.string().trim().min(1, "Informe o título."),
  price: z.coerce.number().positive("O valor precisa ser maior que zero."),
});

function CreateMaterialDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<unknown>;
}) {
  const form = useForm<z.infer<typeof materialSchema>>({
    resolver: zodResolver(materialSchema),
    defaultValues: { title: "", price: 0 },
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof materialSchema>) =>
      createCourseMaterialFn({ data: values }),
    onSuccess: async () => {
      toast.success("Material adicionado ao catálogo.");
      form.reset();
      onOpenChange(false);
      await onCreated();
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível criar.")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo material</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex.: Apostila de Teologia Sistemática" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preço (R$)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Criar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const editMaterialSchema = materialSchema.extend({ active: z.boolean() });

function EditMaterialDialog({
  material,
  onOpenChange,
  onSaved,
}: {
  material: CourseMaterial | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<unknown>;
}) {
  const form = useForm<z.infer<typeof editMaterialSchema>>({
    resolver: zodResolver(editMaterialSchema),
    values: material
      ? { title: material.title, price: Number(material.price), active: material.active }
      : { title: "", price: 0, active: true },
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof editMaterialSchema>) =>
      updateCourseMaterialFn({ data: { materialId: material!.id, ...values } }),
    onSuccess: async () => {
      toast.success("Material atualizado.");
      onOpenChange(false);
      await onSaved();
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível salvar.")),
  });

  return (
    <Dialog open={material !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar material</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preço (R$)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border border-border/70 p-3">
                  <FormLabel className="mb-0">Disponível pra cobrar/doar</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                {mutation.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
