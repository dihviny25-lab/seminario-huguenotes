import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createAssessmentFn,
  deleteAssessmentFn,
  getGradesBoardFn,
  setGradeFn,
} from "@/functions/grades";
import { computeWeightedAverage } from "@/lib/grades";

function gradesKey(disciplineId: string) {
  return ["grades-board", disciplineId] as const;
}

export function GradesTab({ disciplineId }: { disciplineId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: gradesKey(disciplineId),
    queryFn: () => getGradesBoardFn({ data: { disciplineId } }),
  });
  const [createOpen, setCreateOpen] = useState(false);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: gradesKey(disciplineId) });
  }

  const deleteMutation = useMutation({
    mutationFn: (assessmentId: string) =>
      deleteAssessmentFn({ data: { disciplineId, assessmentId } }),
    onSuccess: async () => {
      toast.success("Avaliação removida.");
      await invalidate();
    },
    onError: () => toast.error("Não foi possível remover a avaliação."),
  });

  const gradeMutation = useMutation({
    mutationFn: (input: { assessmentId: string; studentId: string; score: number }) =>
      setGradeFn({ data: { disciplineId, ...input } }),
    onSuccess: () => invalidate(),
    onError: () => toast.error("Não foi possível salvar a nota."),
  });

  if (isLoading || !data) {
    return <p className="py-6 text-center text-muted-foreground">Carregando…</p>;
  }

  const gradeByKey = new Map(data.grades.map((g) => [`${g.assessmentId}:${g.studentId}`, g.score]));

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Nova avaliação
        </Button>
      </div>

      <div className="overflow-hidden rounded-[1.25rem] border border-border/70 bg-card/70 shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aluno</TableHead>
              {data.assessments.map((a) => (
                <TableHead key={a.id} className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span>
                      {a.title} <span className="text-muted-foreground">/ {a.maxScore}</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      title="Remover avaliação"
                      onClick={() => deleteMutation.mutate(a.id)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                </TableHead>
              ))}
              <TableHead className="text-center">Média</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.students.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={data.assessments.length + 2}
                  className="py-6 text-center text-muted-foreground"
                >
                  Nenhum aluno ativo cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              data.students.map((student) => {
                const scores = data.assessments
                  .map((a) => {
                    const raw = gradeByKey.get(`${a.id}:${student.id}`);
                    return raw === undefined
                      ? null
                      : { score: Number(raw), weight: Number(a.weight) };
                  })
                  .filter((s): s is { score: number; weight: number } => s !== null);
                const avg = computeWeightedAverage(scores);

                return (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium text-foreground">{student.name}</TableCell>
                    {data.assessments.map((a) => {
                      const key = `${a.id}:${student.id}`;
                      const value = gradeByKey.get(key);
                      return (
                        <TableCell key={a.id} className="text-center">
                          <Input
                            type="number"
                            min={0}
                            step="0.1"
                            defaultValue={value ?? ""}
                            className="mx-auto h-8 w-20 text-center"
                            onBlur={(event) => {
                              const parsed = Number(event.target.value);
                              if (event.target.value === "" || Number.isNaN(parsed)) return;
                              gradeMutation.mutate({
                                assessmentId: a.id,
                                studentId: student.id,
                                score: parsed,
                              });
                            }}
                          />
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-medium text-foreground">
                      {avg === null ? "—" : avg.toFixed(1)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <CreateAssessmentDialog
        disciplineId={disciplineId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={invalidate}
      />
    </div>
  );
}

const assessmentSchema = z.object({
  title: z.string().trim().min(1, "Informe um título."),
  maxScore: z.coerce.number().positive("Deve ser maior que zero."),
  weight: z.coerce.number().positive("Deve ser maior que zero."),
});

function CreateAssessmentDialog({
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
  const form = useForm<z.infer<typeof assessmentSchema>>({
    resolver: zodResolver(assessmentSchema),
    defaultValues: { title: "", maxScore: 10, weight: 1 },
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof assessmentSchema>) =>
      createAssessmentFn({ data: { disciplineId, ...values } }),
    onSuccess: async () => {
      toast.success("Avaliação criada.");
      form.reset();
      onOpenChange(false);
      await onCreated();
    },
    onError: () => toast.error("Não foi possível criar a avaliação."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova avaliação</DialogTitle>
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
                    <Input placeholder="Prova 1, Trabalho…" {...field} />
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
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                Criar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
