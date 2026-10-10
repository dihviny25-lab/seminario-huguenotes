import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, LockKeyhole, Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  getMyDisciplineFeedbackFn,
  saveMyDisciplineFeedbackFn,
} from "@/functions/disciplineFeedback";

const ratingLabels = ["Muito ruim", "Ruim", "Regular", "Boa", "Excelente"] as const;

function feedbackKey(disciplineId: string) {
  return ["my-discipline-feedback", disciplineId] as const;
}

type SavedFeedback = NonNullable<Awaited<ReturnType<typeof getMyDisciplineFeedbackFn>>["feedback"]>;

function FeedbackForm({
  disciplineId,
  savedFeedback,
}: {
  disciplineId: string;
  savedFeedback: SavedFeedback | null;
}) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(savedFeedback?.rating ?? 0);
  const [likedMost, setLikedMost] = useState(savedFeedback?.likedMost ?? "");
  const [couldImprove, setCouldImprove] = useState(savedFeedback?.couldImprove ?? "");
  const [additionalComments, setAdditionalComments] = useState(
    savedFeedback?.additionalComments ?? "",
  );

  const mutation = useMutation({
    mutationFn: () =>
      saveMyDisciplineFeedbackFn({
        data: { disciplineId, rating, likedMost, couldImprove, additionalComments },
      }),
    onSuccess: async () => {
      toast.success(savedFeedback ? "Avaliação atualizada." : "Avaliação enviada. Obrigado!");
      await queryClient.invalidateQueries({ queryKey: feedbackKey(disciplineId) });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a avaliação."),
  });

  const canSubmit = rating >= 1 && likedMost.trim().length >= 3 && couldImprove.trim().length >= 3;

  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2 text-primary">
            <Star className="size-5" aria-hidden />
          </div>
          <div>
            <CardTitle>{savedFeedback ? "Sua avaliação" : "Conte como foi a disciplina"}</CardTitle>
            <CardDescription className="mt-1">
              Sua opinião ajuda a melhorar as próximas turmas. Professores e administração veem as
              respostas sem o seu nome.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Como você avalia a disciplina?</legend>
            <div className="grid grid-cols-5 gap-2" aria-label="Nota geral de 1 a 5">
              {ratingLabels.map((label, index) => {
                const value = index + 1;
                const selected = rating === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`${value} de 5: ${label}`}
                    onClick={() => setRating(value)}
                    className={`rounded-lg border px-2 py-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted"
                    }`}
                  >
                    <span className="block text-lg font-semibold">{value}</span>
                    <span className="hidden text-xs sm:block">{label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="feedback-liked">O que você mais gostou?</Label>
            <Textarea
              id="feedback-liked"
              value={likedMost}
              maxLength={1000}
              required
              onChange={(event) => setLikedMost(event.target.value)}
              placeholder="Conte o que funcionou bem nas aulas, no conteúdo ou na forma de ensinar."
              className="min-h-28"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-improve">O que poderia melhorar?</Label>
            <Textarea
              id="feedback-improve"
              value={couldImprove}
              maxLength={1000}
              required
              onChange={(event) => setCouldImprove(event.target.value)}
              placeholder="Dê uma sugestão prática para as próximas turmas."
              className="min-h-28"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-comments">Outro comentário (opcional)</Label>
            <Textarea
              id="feedback-comments"
              value={additionalComments}
              maxLength={1000}
              onChange={(event) => setAdditionalComments(event.target.value)}
              placeholder="Use este espaço se quiser acrescentar algo."
              className="min-h-24"
            />
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <LockKeyhole className="size-3.5" aria-hidden />
              Resposta anônima para professores e administração
            </p>
            <Button type="submit" disabled={!canSubmit || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {savedFeedback ? "Salvar alterações" : "Enviar avaliação"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function DisciplineFeedbackTab({ disciplineId }: { disciplineId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: feedbackKey(disciplineId),
    queryFn: () => getMyDisciplineFeedbackFn({ data: { disciplineId } }),
  });

  if (isLoading || !data) return <Skeleton className="mx-auto h-80 max-w-3xl" />;

  if (!data.completion.isCompleted) {
    const percent =
      data.completion.lessonsPlanned > 0
        ? Math.min((data.completion.lessonsGiven / data.completion.lessonsPlanned) * 100, 100)
        : 0;
    return (
      <Card className="mx-auto max-w-2xl text-center">
        <CardHeader>
          <div className="mx-auto rounded-full bg-muted p-3 text-muted-foreground">
            <LockKeyhole className="size-6" aria-hidden />
          </div>
          <CardTitle>A avaliação abre no fim da disciplina</CardTitle>
          <CardDescription>
            Ela será liberada quando todas as aulas previstas tiverem sido dadas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Progresso</span>
            <span>
              {data.completion.lessonsGiven} de {data.completion.lessonsPlanned} aulas
            </span>
          </div>
          <Progress value={percent} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {data.feedback ? (
        <p className="mx-auto flex max-w-3xl items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-4" aria-hidden />
          Sua avaliação já foi enviada e pode ser atualizada.
        </p>
      ) : null}
      <FeedbackForm
        key={data.feedback?.updatedAt?.toString() ?? "new"}
        disciplineId={disciplineId}
        savedFeedback={data.feedback}
      />
    </div>
  );
}
