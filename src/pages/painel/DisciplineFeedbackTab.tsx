import { useQuery } from "@tanstack/react-query";
import { LockKeyhole, MessageSquareText, Star } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { getDisciplineFeedbackSummaryFn } from "@/functions/disciplineFeedback";

const ratings = [5, 4, 3, 2, 1] as const;
const ascendingRatings = [1, 2, 3, 4, 5] as const;

export function DisciplineFeedbackTab({ disciplineId }: { disciplineId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["discipline-feedback-summary", disciplineId],
    queryFn: () => getDisciplineFeedbackSummaryFn({ data: { disciplineId } }),
  });

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-48" />
        <Skeleton className="h-48 lg:col-span-2" />
      </div>
    );
  }

  if (!data.completion.isCompleted) {
    return (
      <Card className="mx-auto max-w-2xl text-center">
        <CardHeader>
          <div className="mx-auto rounded-full bg-muted p-3 text-muted-foreground">
            <LockKeyhole className="size-6" aria-hidden />
          </div>
          <CardTitle>A pesquisa ainda não foi liberada</CardTitle>
          <CardDescription>
            {data.completion.lessonsGiven} de {data.completion.lessonsPlanned} aulas previstas foram
            dadas. Os alunos poderão responder ao término da disciplina.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (data.responseCount === 0) {
    return (
      <Card className="mx-auto max-w-2xl text-center">
        <CardHeader>
          <div className="mx-auto rounded-full bg-primary/10 p-3 text-primary">
            <MessageSquareText className="size-6" aria-hidden />
          </div>
          <CardTitle>Aguardando respostas</CardTitle>
          <CardDescription>
            A avaliação já está aberta, mas nenhum aluno respondeu até agora.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avaliação geral</CardDescription>
            <CardTitle className="flex items-end gap-2 text-4xl">
              {data.averageRating?.toFixed(1)}
              <span className="mb-1 text-base font-normal text-muted-foreground">de 5</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex gap-1 text-amber-500" aria-hidden>
              {ascendingRatings.map((rating) => (
                <Star
                  key={rating}
                  className={`size-5 ${rating <= Math.round(data.averageRating ?? 0) ? "fill-current" : ""}`}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {data.responseCount}{" "}
              {data.responseCount === 1 ? "resposta anônima" : "respostas anônimas"}
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Distribuição das avaliações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ratings.map((rating) => {
              const count = data.distribution[rating];
              const percent = (count / data.responseCount) * 100;
              return (
                <div
                  key={rating}
                  className="grid grid-cols-[3rem_1fr_2rem] items-center gap-3 text-sm"
                >
                  <span>{rating} ★</span>
                  <Progress value={percent} aria-label={`${rating} estrelas: ${count} respostas`} />
                  <span className="text-right text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="anonymous-comments-title">
        <div className="mb-3">
          <h2 id="anonymous-comments-title" className="font-semibold">
            Comentários dos alunos
          </h2>
          <p className="text-sm text-muted-foreground">
            As respostas são exibidas sem identificação do aluno.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {data.comments.map((comment, index) => (
            <Card key={index}>
              <CardHeader className="pb-3">
                <CardDescription>Resposta anônima {index + 1}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <h3 className="mb-1 font-medium text-foreground">O que mais gostou</h3>
                  <p className="whitespace-pre-wrap text-muted-foreground">{comment.likedMost}</p>
                </div>
                <div>
                  <h3 className="mb-1 font-medium text-foreground">O que pode melhorar</h3>
                  <p className="whitespace-pre-wrap text-muted-foreground">
                    {comment.couldImprove}
                  </p>
                </div>
                {comment.additionalComments ? (
                  <div>
                    <h3 className="mb-1 font-medium text-foreground">Outro comentário</h3>
                    <p className="whitespace-pre-wrap text-muted-foreground">
                      {comment.additionalComments}
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
