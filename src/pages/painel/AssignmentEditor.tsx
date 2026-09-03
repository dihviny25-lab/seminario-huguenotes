import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useFieldArray, useForm } from "react-hook-form";
import { ArrowLeft, CheckCircle2, Download, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { TableSkeletonRows } from "@/components/TableSkeletonRows";
import {
  addAssignmentQuestionFn,
  deleteAssignmentFn,
  deleteAssignmentQuestionFn,
  getAssignmentByIdFn,
  getAssignmentSubmissionsFn,
  gradeSubmissionFn,
  updateAssignmentFn,
  type AssignmentDetail,
  type SubmissionRow,
} from "@/functions/assignments";

function assignmentKey(assignmentId: string) {
  return ["assignment-detail", assignmentId] as const;
}

function submissionsKey(assignmentId: string) {
  return ["assignment-submissions", assignmentId] as const;
}

export function AssignmentEditor({ assignmentId }: { assignmentId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addQuestionOpen, setAddQuestionOpen] = useState(false);
  const { data: assignment, isLoading } = useQuery({
    queryKey: assignmentKey(assignmentId),
    queryFn: () => getAssignmentByIdFn({ data: { assignmentId } }),
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: () =>
      deleteAssignmentFn({ data: { disciplineId: assignment!.disciplineId, assignmentId } }),
    onSuccess: async () => {
      toast.success("Tarefa apagada.");
      await navigate({
        to: "/painel/disciplinas/$disciplineId",
        params: { disciplineId: assignment!.disciplineId },
      });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível apagar a tarefa."),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: string) =>
      deleteAssignmentQuestionFn({
        data: { disciplineId: assignment!.disciplineId, assignmentId, questionId },
      }),
    onSuccess: async () => {
      toast.success("Pergunta removida.");
      await queryClient.invalidateQueries({ queryKey: assignmentKey(assignmentId) });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível remover."),
  });
  const { data: submissions, isLoading: loadingSubmissions } = useQuery({
    queryKey: submissionsKey(assignmentId),
    queryFn: () => getAssignmentSubmissionsFn({ data: { assignmentId } }),
    refetchInterval: 15_000,
  });

  if (isLoading || !assignment) {
    return (
      <PainelShell title="Carregando…">
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </PainelShell>
    );
  }

  return (
    <PainelShell title={assignment.title} description={assignment.instructions ?? undefined}>
      <div className="mb-6 flex items-center justify-between">
        <Link
          to="/painel/disciplinas/$disciplineId"
          params={{ disciplineId: assignment.disciplineId }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
        >
          <ArrowLeft className="size-4 shrink-0" aria-hidden />
          Voltar para a disciplina
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" aria-hidden />
            Editar tarefa (peso {assignment.weight})
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" aria-hidden />
            Excluir tarefa
          </Button>
        </div>
      </div>

      {assignment.kind === "multiple_choice" ? (
        <>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-foreground">Perguntas</h2>
            {!assignment.locked ? (
              <Button size="sm" onClick={() => setAddQuestionOpen(true)}>
                <Plus className="size-4" aria-hidden />
                Adicionar pergunta
              </Button>
            ) : null}
          </div>
          {assignment.locked ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Pelo menos um aluno já entregou essa tarefa — perguntas e opções não podem mais ser
              editadas.
            </p>
          ) : null}
          {assignment.questions.length === 0 ? (
            <p className="mt-4 rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft">
              Nenhuma pergunta ainda.
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              {assignment.questions.map((question, index) => (
                <div
                  key={question.id}
                  className="animate-in rounded-md border border-border/70 bg-card/70 p-4 shadow-soft fade-in slide-in-from-top-1 duration-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-foreground">
                      {index + 1}. {question.text}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline">
                        {question.points} {Number(question.points) === 1 ? "ponto" : "pontos"}
                      </Badge>
                      {!assignment.locked ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Remover pergunta"
                          onClick={() => deleteQuestionMutation.mutate(question.id)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <ul className="mt-3 grid gap-1.5">
                    {question.options.map((option) => (
                      <li
                        key={option.id}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        {option.isCorrect ? (
                          <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
                        ) : (
                          <span className="size-4 shrink-0" />
                        )}
                        <span className={option.isCorrect ? "text-foreground" : undefined}>
                          {option.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <AddAssignmentQuestionDialog
            disciplineId={assignment.disciplineId}
            assignmentId={assignmentId}
            open={addQuestionOpen}
            onOpenChange={setAddQuestionOpen}
            onAdded={() => queryClient.invalidateQueries({ queryKey: assignmentKey(assignmentId) })}
          />
        </>
      ) : null}

      <h2 className="mt-8 font-display text-lg font-semibold text-foreground">
        {assignment.kind === "multiple_choice" ? "Resultados" : "Entregas"}
      </h2>

      {assignment.kind === "multiple_choice" ? (
        <AssignmentResultsTable submissions={submissions} loading={loadingSubmissions} />
      ) : loadingSubmissions || !submissions ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {submissions.map((row) => (
            <div
              key={row.studentId}
              className="animate-in fade-in slide-in-from-top-1 duration-200"
            >
              <SubmissionCard
                disciplineId={assignment.disciplineId}
                row={row}
                assignmentId={assignmentId}
              />
            </div>
          ))}
        </div>
      )}

      <EditAssignmentDialog
        assignment={assignment}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdated={() => queryClient.invalidateQueries({ queryKey: assignmentKey(assignmentId) })}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{assignment.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso apaga a tarefa, as entregas dos alunos e qualquer nota já lançada nela. Não dá
              pra desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAssignmentMutation.mutate()}
              disabled={deleteAssignmentMutation.isPending}
            >
              {deleteAssignmentMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PainelShell>
  );
}

function EditAssignmentDialog({
  assignment,
  open,
  onOpenChange,
  onUpdated,
}: {
  assignment: AssignmentDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => Promise<unknown>;
}) {
  const [title, setTitle] = useState(assignment.title);
  const [instructions, setInstructions] = useState(assignment.instructions ?? "");
  const [maxScore, setMaxScore] = useState(String(assignment.maxScore));
  const [weight, setWeight] = useState(String(assignment.weight));
  const [dueAt, setDueAt] = useState(assignment.dueAt ? assignment.dueAt.slice(0, 16) : "");

  useEffect(() => {
    setTitle(assignment.title);
    setInstructions(assignment.instructions ?? "");
    setMaxScore(String(assignment.maxScore));
    setWeight(String(assignment.weight));
    setDueAt(assignment.dueAt ? assignment.dueAt.slice(0, 16) : "");
  }, [assignment]);

  const mutation = useMutation({
    mutationFn: () =>
      updateAssignmentFn({
        data: {
          disciplineId: assignment.disciplineId,
          assignmentId: assignment.id,
          title,
          instructions: instructions || undefined,
          maxScore: Number(maxScore),
          weight: Number(weight),
          dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        },
      }),
    onSuccess: async () => {
      toast.success("Tarefa atualizada.");
      onOpenChange(false);
      await onUpdated();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar tarefa</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="assignment-edit-title">Título</Label>
            <Input
              id="assignment-edit-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="assignment-edit-instructions">Instruções (opcional)</Label>
            <Textarea
              id="assignment-edit-instructions"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assignment-edit-maxscore">Nota máxima</Label>
              <Input
                id="assignment-edit-maxscore"
                type="number"
                step="0.1"
                value={maxScore}
                onChange={(event) => setMaxScore(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignment-edit-weight">Peso na média final</Label>
              <Input
                id="assignment-edit-weight"
                type="number"
                step="0.1"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="assignment-edit-due">Prazo (opcional)</Label>
            <Input
              id="assignment-edit-due"
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
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

function SubmissionCard({
  disciplineId,
  assignmentId,
  row,
}: {
  disciplineId: string;
  assignmentId: string;
  row: {
    studentId: string;
    studentName: string;
    submissionId: string | null;
    textContent: string | null;
    fileUrl: string | null;
    fileName: string | null;
    submittedAt: string | null;
    feedback: string | null;
    gradedAt: string | null;
    score: string | null;
  };
}) {
  const queryClient = useQueryClient();
  const [score, setScore] = useState(row.score ?? "");
  const [feedback, setFeedback] = useState(row.feedback ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      gradeSubmissionFn({
        data: {
          disciplineId,
          submissionId: row.submissionId!,
          score: Number(score),
          feedback: feedback || undefined,
        },
      }),
    onSuccess: async () => {
      toast.success("Nota lançada.");
      await queryClient.invalidateQueries({ queryKey: submissionsKey(assignmentId) });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível lançar a nota."),
  });

  const submitted = row.submissionId !== null;

  return (
    <div className="rounded-md border border-border/70 bg-card/70 p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-foreground">{row.studentName}</p>
        {!submitted ? (
          <Badge variant="outline">Não entregou</Badge>
        ) : row.gradedAt ? (
          <Badge>Corrigida — {Number(row.score).toFixed(1)}</Badge>
        ) : (
          <Badge variant="outline">Aguardando correção</Badge>
        )}
      </div>

      {submitted ? (
        <>
          {row.textContent ? (
            <p className="mt-3 whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm text-foreground">
              {row.textContent}
            </p>
          ) : null}
          {row.fileUrl ? (
            <a
              href={row.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <Download className="size-3.5 shrink-0" aria-hidden />
              {row.fileName}
            </a>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            Entregue em{" "}
            {new Date(row.submittedAt!).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
            <div className="space-y-1">
              <Label htmlFor={`score-${row.studentId}`}>Nota</Label>
              <Input
                id={`score-${row.studentId}`}
                type="number"
                step="0.1"
                value={score}
                onChange={(event) => setScore(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`feedback-${row.studentId}`}>Feedback (opcional)</Label>
              <Textarea
                id={`feedback-${row.studentId}`}
                rows={1}
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
              />
            </div>
            <Button
              onClick={() => mutation.mutate()}
              disabled={score.trim().length === 0 || mutation.isPending}
            >
              {mutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Lançar nota
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function AssignmentResultsTable({
  submissions,
  loading,
}: {
  submissions: Array<SubmissionRow> | undefined;
  loading: boolean;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-md border border-border/70 bg-card/70 shadow-soft">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Aluno</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-center">Nota</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading || !submissions ? (
            <TableSkeletonRows columns={3} />
          ) : (
            submissions.map((row) => (
              <TableRow
                key={row.studentId}
                className="animate-in fade-in slide-in-from-top-1 duration-200"
              >
                <TableCell className="font-medium text-foreground">{row.studentName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {row.submissionId === null ? "Não respondeu" : "Respondeu"}
                </TableCell>
                <TableCell className="text-center">
                  {row.score === null ? "—" : Number(row.score).toFixed(1)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

const optionFormSchema = z.object({ text: z.string().trim().min(1, "Informe o texto.") });

const questionFormSchema = z.object({
  text: z.string().trim().min(1, "Informe a pergunta."),
  points: z.coerce.number().positive("Deve ser maior que zero."),
  options: z.array(optionFormSchema).min(2, "Mínimo de 2 opções.").max(6, "Máximo de 6 opções."),
  correctIndex: z.coerce.number().int().min(0),
});

function AddAssignmentQuestionDialog({
  disciplineId,
  assignmentId,
  open,
  onOpenChange,
  onAdded,
}: {
  disciplineId: string;
  assignmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => Promise<unknown>;
}) {
  const form = useForm<z.infer<typeof questionFormSchema>>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      text: "",
      points: 1,
      options: [{ text: "" }, { text: "" }],
      correctIndex: 0,
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "options" });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof questionFormSchema>) =>
      addAssignmentQuestionFn({
        data: {
          disciplineId,
          assignmentId,
          text: values.text,
          points: values.points,
          options: values.options.map((option, index) => ({
            text: option.text,
            isCorrect: index === values.correctIndex,
          })),
        },
      }),
    onSuccess: async () => {
      toast.success("Pergunta adicionada.");
      form.reset({ text: "", points: 1, options: [{ text: "" }, { text: "" }], correctIndex: 0 });
      onOpenChange(false);
      await onAdded();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível adicionar."),
  });

  const correctIndex = form.watch("correctIndex");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova pergunta</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pergunta</FormLabel>
                  <FormControl>
                    <Input placeholder="Qual...?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="points"
              render={({ field }) => (
                <FormItem className="max-w-32">
                  <FormLabel>Pontos</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <Label>Opções (marque a correta)</Label>
              <RadioGroup
                className="mt-2 gap-3"
                value={String(correctIndex)}
                onValueChange={(value) => form.setValue("correctIndex", Number(value))}
              >
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="animate-in flex items-center gap-2 fade-in slide-in-from-top-1 duration-200"
                  >
                    <RadioGroupItem value={String(index)} id={`assignment-option-${field.id}`} />
                    <FormField
                      control={form.control}
                      name={`options.${index}.text`}
                      render={({ field: textField }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input placeholder={`Opção ${index + 1}`} {...textField} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {fields.length > 2 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </RadioGroup>
              {fields.length < 6 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => append({ text: "" })}
                >
                  <Plus className="size-4" aria-hidden />
                  Adicionar opção
                </Button>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Adicionar pergunta
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
