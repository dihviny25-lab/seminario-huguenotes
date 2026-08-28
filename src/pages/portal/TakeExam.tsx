import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  saveExamAnswerFn,
  startExamAttemptFn,
  submitExamAttemptFn,
} from "@/functions/examAttempts";
import { getCurrentStudentFn } from "@/functions/studentAuth";
import { cn } from "@/lib/utils";

function examAttemptKey(examId: string) {
  return ["exam-attempt", examId] as const;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Tela de fazer a prova — sem a sidebar do portal, de propósito, pra reduzir distração. */
export function TakeExam({ examId }: { examId: string }) {
  const queryClient = useQueryClient();
  const [pledgeAccepted, setPledgeAccepted] = useState(false);

  const {
    data: attempt,
    isLoading,
    error,
  } = useQuery({
    queryKey: examAttemptKey(examId),
    queryFn: () => startExamAttemptFn({ data: { examId } }),
    retry: false,
    enabled: pledgeAccepted,
  });

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [seededExamId, setSeededExamId] = useState<string | null>(null);
  if (attempt && seededExamId !== examId) {
    // Semeia as respostas locais só uma vez por prova (não sobrescreve cliques em andamento).
    const initial: Record<string, string> = {};
    for (const question of attempt.questions) {
      if (question.selectedOptionId) initial[question.id] = question.selectedOptionId;
    }
    setAnswers(initial);
    setSeededExamId(examId);
  }

  const saveAnswerMutation = useMutation({
    mutationFn: (input: { questionId: string; optionId: string }) =>
      saveExamAnswerFn({ data: { examId, ...input } }),
  });

  const submitMutation = useMutation({
    mutationFn: (autoSubmitted: boolean) =>
      submitExamAttemptFn({ data: { examId, autoSubmitted } }),
    onSuccess: (result) => {
      queryClient.setQueryData(examAttemptKey(examId), result);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a prova."),
  });

  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  useEffect(() => {
    if (!attempt || attempt.submitted) return;
    const deadline = new Date(attempt.deadline).getTime();

    const tick = () => {
      const left = deadline - Date.now();
      setRemainingMs(left);
      if (left <= 0) {
        submitMutation.mutate(true);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt?.examId, attempt?.submitted, attempt?.deadline]);

  function selectOption(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    saveAnswerMutation.mutate({ questionId, optionId });
  }

  if (!pledgeAccepted) {
    return <PledgeScreen onConfirm={() => setPledgeAccepted(true)} />;
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center sm:px-6">
        <p className="text-muted-foreground">
          {error instanceof Error ? error.message : "Não foi possível abrir esta prova."}
        </p>
        <Link
          to="/portal/provas"
          className="mt-4 inline-block text-sm font-medium text-accent hover:underline"
        >
          Voltar para Provas
        </Link>
      </div>
    );
  }

  if (attempt.submitted) {
    return (
      <div className="animate-in mx-auto max-w-2xl px-4 py-16 text-center fade-in zoom-in-95 duration-300 sm:px-6">
        <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden />
        <h1 className="mt-4 font-display text-2xl font-semibold text-foreground">Prova enviada</h1>
        <p className="mt-2 text-muted-foreground">{attempt.title}</p>
        <p className="mt-4 font-display text-4xl font-semibold text-foreground">
          {attempt.score === null ? "—" : Number(attempt.score).toFixed(1)}
          <span className="text-lg text-muted-foreground">
            {" "}
            / {Number(attempt.maxScore).toFixed(1)}
          </span>
        </p>
        <Link
          to="/portal/provas"
          className="mt-6 inline-block text-sm font-medium text-accent hover:underline"
        >
          Voltar para Provas
        </Link>
      </div>
    );
  }

  const isLow = remainingMs !== null && remainingMs < 2 * 60_000;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3 sm:px-6">
          <p className="min-w-0 truncate font-display text-sm font-semibold text-foreground">
            {attempt.title}
          </p>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-semibold tabular-nums",
              isLow
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-border/70 bg-card text-foreground",
            )}
          >
            <Clock className="size-3.5 shrink-0" aria-hidden />
            {remainingMs === null ? "--:--" : formatCountdown(remainingMs)}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-24 pt-8 sm:px-6">
        {attempt.instructions ? (
          <p className="mb-6 text-pretty leading-relaxed text-muted-foreground">
            {attempt.instructions}
          </p>
        ) : null}

        <div className="grid gap-4">
          {attempt.questions.map((question, index) => (
            <div
              key={question.id}
              className="animate-in rounded-md border border-border/70 bg-card/70 p-4 shadow-soft fade-in slide-in-from-top-1 duration-200"
            >
              <p className="font-medium text-foreground">
                {index + 1}. {question.text}
              </p>
              <RadioGroup
                className="mt-3 gap-2.5"
                value={answers[question.id] ?? ""}
                onValueChange={(value) => selectOption(question.id, value)}
              >
                {question.options.map((option) => (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground"
                  >
                    <RadioGroupItem value={option.id} />
                    {option.text}
                  </label>
                ))}
              </RadioGroup>
            </div>
          ))}
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className="mt-8 w-full" disabled={submitMutation.isPending}>
              {submitMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              Finalizar prova
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Finalizar prova?</AlertDialogTitle>
              <AlertDialogDescription>
                Depois de enviar, não é possível mudar as respostas.{" "}
                {attempt.questions.some((q) => !answers[q.id])
                  ? "Você tem pergunta(s) sem resposta."
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => submitMutation.mutate(false)}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Enviar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}

function PledgeScreen({ onConfirm }: { onConfirm: () => void }) {
  const [name, setName] = useState("");
  const isValid = name.trim().split(/\s+/).filter(Boolean).length >= 2;

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary px-4 py-10 text-primary-foreground">
      <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-2 duration-500">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.28em] text-accent">
          Antes de começar
        </p>
        <h1 className="mt-3 text-balance text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Um compromisso diante de Deus
        </h1>
        <p className="mt-5 text-pretty leading-relaxed text-primary-foreground/85">
          Você está prestes a fazer uma avaliação. Mais do que uma nota, isso é uma oportunidade de
          honrar a Deus com a verdade — o Espírito Santo conhece o seu coração e vê tudo o que você
          faz, mesmo quando ninguém mais está olhando.
        </p>
        <p className="mt-4 text-pretty leading-relaxed text-primary-foreground/85">
          Ao escrever seu nome abaixo, você declara diante Dele que vai responder sozinho(a), sem
          consultar nenhum material, pessoa ou meio externo, e que tudo o que marcar será, de fato,
          o que você sabe e aprendeu.
        </p>

        <div className="mt-8 rounded-lg border border-primary-foreground/15 bg-primary-foreground/5 p-5">
          <label
            htmlFor="pledge-name"
            className="block text-sm font-medium text-primary-foreground"
          >
            Escreva seu nome completo para confirmar
          </label>
          <Input
            id="pledge-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Seu nome completo"
            className="mt-2 border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/40"
            autoComplete="off"
          />
        </div>

        <Button
          onClick={onConfirm}
          disabled={!isValid}
          className="mt-6 w-full bg-accent text-accent-foreground hover:bg-accent/90"
        >
          Declaro, e começo a prova
        </Button>
      </div>
    </div>
  );
}
