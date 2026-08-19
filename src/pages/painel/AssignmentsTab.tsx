import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { CalendarClock, FileText, Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { createAssignmentFn, listMyDisciplineAssignmentsFn } from "@/functions/assignments";

function assignmentsKey(disciplineId: string) {
  return ["discipline-assignments", disciplineId] as const;
}

function formatDueAt(iso: string | null): string {
  if (!iso) return "Sem prazo definido";
  return `Até ${new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`;
}

export function AssignmentsTab({ disciplineId }: { disciplineId: string }) {
  const { data: assignments, isLoading } = useQuery({
    queryKey: assignmentsKey(disciplineId),
    queryFn: () => listMyDisciplineAssignmentsFn({ data: { disciplineId } }),
  });
  const [createOpen, setCreateOpen] = useState(false);

  if (isLoading || !assignments) {
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
          Nova tarefa
        </Button>
      </div>

      {assignments.length === 0 ? (
        <p className="rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft">
          Nenhuma tarefa criada ainda.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map((assignment) => (
            <Link
              key={assignment.id}
              to="/painel/tarefas/$assignmentId"
              params={{ assignmentId: assignment.id }}
              className="flex items-start gap-3 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-4 shadow-soft transition-colors hover:border-primary/50"
            >
              <FileText className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">
                  {assignment.title}
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="size-3.5 shrink-0" aria-hidden />
                  {formatDueAt(assignment.dueAt)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {assignment.submittedCount}{" "}
                  {assignment.submittedCount === 1 ? "entrega" : "entregas"} ·{" "}
                  {assignment.gradedCount}{" "}
                  {assignment.gradedCount === 1 ? "corrigida" : "corrigidas"}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}

      <CreateAssignmentDialog
        disciplineId={disciplineId}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}

const assignmentSchema = z.object({
  title: z.string().trim().min(1, "Informe um título."),
  instructions: z.string().trim().optional(),
  maxScore: z.coerce.number().positive("Deve ser maior que zero."),
  weight: z.coerce.number().positive("Deve ser maior que zero."),
  dueAt: z.string().optional(),
});

function CreateAssignmentDialog({
  disciplineId,
  open,
  onOpenChange,
}: {
  disciplineId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const form = useForm<z.infer<typeof assignmentSchema>>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: { title: "", instructions: "", maxScore: 10, weight: 1, dueAt: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof assignmentSchema>) =>
      createAssignmentFn({
        data: {
          disciplineId,
          title: values.title,
          instructions: values.instructions,
          maxScore: values.maxScore,
          weight: values.weight,
          dueAt: values.dueAt ? new Date(values.dueAt).toISOString() : undefined,
        },
      }),
    onSuccess: async (result) => {
      toast.success("Tarefa criada.");
      form.reset();
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: assignmentsKey(disciplineId) });
      await navigate({
        to: "/painel/tarefas/$assignmentId",
        params: { assignmentId: result.assignmentId },
      });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a tarefa."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
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
                    <Input placeholder="Resenha — Módulo 1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="instructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instruções (opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="O que o aluno deve entregar…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="maxScore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nota máxima</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Peso</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="dueAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prazo (opcional)</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                Criar tarefa
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
