import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useFieldArray, useForm } from "react-hook-form";
import { ArrowLeft, CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

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
import {
  addExamQuestionFn,
  deleteExamQuestionFn,
  getExamByIdFn,
  getExamResultsFn,
  scheduleExamFn,
  updateExamFn,
  type ExamDetail,
} from "@/functions/exams";

function examKey(examId: string) {
  return ["exam-detail", examId] as const;
}

const statusLabel: Record<string, string> = {
  not_started: "Não iniciou",
  in_progress: "Em andamento",
  submitted: "Enviou",
};

export function ExamEditor({ examId }: { examId: string }) {
  const queryClient = useQueryClient();
  const { data: exam, isLoading } = useQuery({
    queryKey: examKey(examId),
    queryFn: () => getExamByIdFn({ data: { examId } }),
  });
  const [addQuestionOpen, setAddQuestionOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: examKey(examId) });
  }

  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: string) =>
      deleteExamQuestionFn({ data: { disciplineId: exam!.disciplineId, examId, questionId } }),
    onSuccess: async () => {
      toast.success("Pergunta removida.");
      await invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível remover."),
  });

  if (isLoading || !exam) {
    return (
      <PainelShell title="Carregando…">
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </PainelShell>
    );
  }

  const isScheduled = exam.opensAt !== null;

  return (
    <PainelShell
      title={exam.title}
      description={
        exam.instructions ??
        `${exam.durationMinutes} minutos de duração, a partir do início de cada aluno.`
      }
    >
      <div className="mb-6 flex items-center justify-between">
        <Link
          to="/painel/disciplinas/$disciplineId"
          params={{ disciplineId: exam.disciplineId }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
        >
          <ArrowLeft className="size-4 shrink-0" aria-hidden />
          Voltar para a disciplina
        </Link>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="size-4" aria-hidden />
          Editar prova ({exam.weight === 1 ? "peso 1" : `peso ${exam.weight}`})
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-foreground">Perguntas</h2>
        {!exam.locked ? (
          <Button size="sm" onClick={() => setAddQuestionOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Adicionar pergunta
          </Button>
        ) : null}
      </div>

      {exam.locked ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Pelo menos um aluno já começou essa prova — perguntas e opções não podem mais ser
          editadas.
        </p>
      ) : null}

      {exam.questions.length === 0 ? (
        <p className="mt-4 rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft">
          Nenhuma pergunta ainda.
        </p>
      ) : (
        <div className="mt-4 grid gap-3">
          {exam.questions.map((question, index) => (
            <div
              key={question.id}
              className="rounded-md border border-border/70 bg-card/70 p-4 shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-foreground">
                  {index + 1}. {question.text}
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline">
                    {question.points} {Number(question.points) === 1 ? "ponto" : "pontos"}
                  </Badge>
                  {!exam.locked ? (
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

      {isScheduled ? (
        <ExamResults examId={examId} exam={exam} />
      ) : (
        <ScheduleExamCard disciplineId={exam.disciplineId} examId={examId} exam={exam} />
      )}

      <AddQuestionDialog
        disciplineId={exam.disciplineId}
        examId={examId}
        open={addQuestionOpen}
        onOpenChange={setAddQuestionOpen}
        onAdded={invalidate}
      />
      <EditExamDialog
        disciplineId={exam.disciplineId}
        examId={examId}
        exam={exam}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdated={invalidate}
      />
    </PainelShell>
  );
}

const editExamSchema = z.object({
  title: z.string().trim().min(1, "Informe um título."),
  instructions: z.string().trim().optional(),
  weight: z.coerce.number().positive("Deve ser maior que zero."),
});

function EditExamDialog({
  disciplineId,
  examId,
  exam,
  open,
  onOpenChange,
  onUpdated,
}: {
  disciplineId: string;
  examId: string;
  exam: ExamDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => Promise<unknown>;
}) {
  const form = useForm<z.infer<typeof editExamSchema>>({
    resolver: zodResolver(editExamSchema),
    values: {
      title: exam.title,
      instructions: exam.instructions ?? "",
      weight: exam.weight,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof editExamSchema>) =>
      updateExamFn({ data: { disciplineId, examId, ...values } }),
    onSuccess: async () => {
      toast.success("Prova atualizada.");
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
          <DialogTitle>Editar prova</DialogTitle>
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
              name="instructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instruções (opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="weight"
              render={({ field }) => (
                <FormItem className="max-w-32">
                  <FormLabel>Peso na média final</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleExamCard({
  disciplineId,
  examId,
  exam,
}: {
  disciplineId: string;
  examId: string;
  exam: ExamDetail;
}) {
  const queryClient = useQueryClient();
  const [opensAt, setOpensAt] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      scheduleExamFn({ data: { disciplineId, examId, opensAt: new Date(opensAt).toISOString() } }),
    onSuccess: async () => {
      toast.success("Prova agendada.");
      await queryClient.invalidateQueries({ queryKey: examKey(examId) });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível agendar."),
  });

  return (
    <div className="mt-8 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-5 shadow-soft">
      <h2 className="font-display text-lg font-semibold text-foreground">Agendar prova</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A partir dessa data e hora, a prova fica visível pros alunos no portal e as perguntas
        travam.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          type="datetime-local"
          value={opensAt}
          onChange={(event) => setOpensAt(event.target.value)}
          className="w-64"
        />
        <Button
          onClick={() => mutation.mutate()}
          disabled={!opensAt || exam.questions.length === 0 || mutation.isPending}
        >
          Agendar
        </Button>
      </div>
      {exam.questions.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Adicione ao menos uma pergunta antes de agendar.
        </p>
      ) : null}
    </div>
  );
}

function ExamResults({ examId, exam }: { examId: string; exam: ExamDetail }) {
  const { data: results, isLoading } = useQuery({
    queryKey: ["exam-results", examId],
    queryFn: () => getExamResultsFn({ data: { disciplineId: exam.disciplineId, examId } }),
    refetchInterval: 10_000,
  });

  const totalPoints = exam.questions.reduce((sum, q) => sum + Number(q.points), 0);

  return (
    <div className="mt-8">
      <h2 className="font-display text-lg font-semibold text-foreground">Resultados</h2>
      <div className="mt-3 overflow-hidden rounded-md border border-border/70 bg-card/70 shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aluno</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Nota</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading || !results ? (
              <TableRow>
                <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : (
              results.map((row) => (
                <TableRow key={row.studentId} className="even:bg-muted/30">
                  <TableCell className="font-medium text-foreground">{row.studentName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {statusLabel[row.status]}
                    {row.autoSubmitted ? " (tempo esgotado)" : ""}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.score === null ? "—" : `${Number(row.score).toFixed(1)}/${totalPoints}`}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
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

function AddQuestionDialog({
  disciplineId,
  examId,
  open,
  onOpenChange,
  onAdded,
}: {
  disciplineId: string;
  examId: string;
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
      addExamQuestionFn({
        data: {
          disciplineId,
          examId,
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
                  <div key={field.id} className="flex items-center gap-2">
                    <RadioGroupItem value={String(index)} id={`option-${field.id}`} />
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
                Adicionar pergunta
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
