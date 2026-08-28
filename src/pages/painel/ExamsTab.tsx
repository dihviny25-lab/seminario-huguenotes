import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { CalendarClock, ClipboardList, Loader2, Plus } from "lucide-react";
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
import { createExamFn, listMyDisciplineExamsFn } from "@/functions/exams";

function examsKey(disciplineId: string) {
  return ["discipline-exams", disciplineId] as const;
}

function formatOpensAt(iso: string | null): string {
  if (!iso) return "Rascunho";
  const date = new Date(iso);
  const isFuture = date.getTime() > Date.now();
  const formatted = date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  return isFuture ? `Agendada · ${formatted}` : `Aberta desde ${formatted}`;
}

export function ExamsTab({ disciplineId }: { disciplineId: string }) {
  const { data: exams, isLoading } = useQuery({
    queryKey: examsKey(disciplineId),
    queryFn: () => listMyDisciplineExamsFn({ data: { disciplineId } }),
  });
  const [createOpen, setCreateOpen] = useState(false);

  if (isLoading || !exams) {
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
          Nova prova
        </Button>
      </div>

      {exams.length === 0 ? (
        <p className="rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft">
          Nenhuma prova criada ainda.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam) => (
            <Link
              key={exam.id}
              to="/painel/provas/$examId"
              params={{ examId: exam.id }}
              className="flex animate-in items-start gap-3 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-4 shadow-soft fade-in slide-in-from-top-1 duration-200 transition-colors hover:border-primary/50"
            >
              <ClipboardList className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">{exam.title}</span>
                <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="size-3.5 shrink-0" aria-hidden />
                  {formatOpensAt(exam.opensAt)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {exam.questionCount} {exam.questionCount === 1 ? "pergunta" : "perguntas"} ·{" "}
                  {exam.submittedCount} {exam.submittedCount === 1 ? "envio" : "envios"}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}

      <CreateExamDialog
        disciplineId={disciplineId}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}

const examSchema = z.object({
  title: z.string().trim().min(1, "Informe um título."),
  instructions: z.string().trim().optional(),
  durationMinutes: z.coerce.number().int().positive("Informe quantos minutos de duração."),
  weight: z.coerce.number().positive("Deve ser maior que zero."),
});

function CreateExamDialog({
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
  const form = useForm<z.infer<typeof examSchema>>({
    resolver: zodResolver(examSchema),
    defaultValues: { title: "", instructions: "", durationMinutes: 60, weight: 1 },
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof examSchema>) =>
      createExamFn({ data: { disciplineId, ...values } }),
    onSuccess: async (result) => {
      toast.success("Prova criada — agora adicione as perguntas.");
      form.reset();
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: examsKey(disciplineId) });
      await navigate({ to: "/painel/provas/$examId", params: { examId: result.examId } });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a prova."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova prova</DialogTitle>
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
                    <Input placeholder="Prova 1 — Módulo 1" {...field} />
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
                    <Textarea placeholder="Leia cada pergunta com atenção…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="durationMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duração (minutos)</FormLabel>
                    <FormControl>
                      <Input type="number" step="1" {...field} />
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
            <p className="text-xs text-muted-foreground">
              A duração conta a partir do momento em que cada aluno clica em "Iniciar" — não é um
              horário fixo igual pra todo mundo.
            </p>
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Criar e adicionar perguntas
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
