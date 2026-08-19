import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";

import { PainelShell } from "@/components/painel/PainelShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  getAssignmentByIdFn,
  getAssignmentSubmissionsFn,
  gradeSubmissionFn,
} from "@/functions/assignments";

function assignmentKey(assignmentId: string) {
  return ["assignment-detail", assignmentId] as const;
}

function submissionsKey(assignmentId: string) {
  return ["assignment-submissions", assignmentId] as const;
}

export function AssignmentEditor({ assignmentId }: { assignmentId: string }) {
  const { data: assignment, isLoading } = useQuery({
    queryKey: assignmentKey(assignmentId),
    queryFn: () => getAssignmentByIdFn({ data: { assignmentId } }),
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
      <Link
        to="/painel/disciplinas/$disciplineId"
        params={{ disciplineId: assignment.disciplineId }}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-4 shrink-0" aria-hidden />
        Voltar para a disciplina
      </Link>

      <h2 className="font-display text-lg font-semibold text-foreground">Entregas</h2>

      {loadingSubmissions || !submissions ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {submissions.map((row) => (
            <SubmissionCard
              key={row.studentId}
              disciplineId={assignment.disciplineId}
              row={row}
              assignmentId={assignmentId}
            />
          ))}
        </div>
      )}
    </PainelShell>
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
              Lançar nota
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
