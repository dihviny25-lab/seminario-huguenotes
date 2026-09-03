import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PortalShell } from "@/components/portal/PortalShell";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  getMySubmissionFn,
  submitAssignmentAnswersFn,
  submitAssignmentFn,
} from "@/functions/assignmentSubmissions";
import { uploadFile } from "@/lib/blobUpload";

function submissionKey(assignmentId: string) {
  return ["my-submission", assignmentId] as const;
}

export function PortalAssignmentDetail({ assignmentId }: { assignmentId: string }) {
  const queryClient = useQueryClient();
  const { data: submission, isLoading } = useQuery({
    queryKey: submissionKey(assignmentId),
    queryFn: () => getMySubmissionFn({ data: { assignmentId } }),
  });
  const [textContent, setTextContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const submitAnswersMutation = useMutation({
    mutationFn: () =>
      submitAssignmentAnswersFn({
        data: {
          assignmentId,
          answers: Object.entries(answers).map(([questionId, optionId]) => ({
            questionId,
            optionId,
          })),
        },
      }),
    onSuccess: async () => {
      toast.success("Respostas enviadas.");
      await queryClient.invalidateQueries({ queryKey: submissionKey(assignmentId) });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar."),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      let uploaded: { url: string; fileName: string } | null = null;
      if (file) {
        setUploading(true);
        try {
          uploaded = await uploadFile(file);
        } finally {
          setUploading(false);
        }
      }
      return submitAssignmentFn({
        data: {
          assignmentId,
          textContent: textContent || undefined,
          fileUrl: uploaded?.url,
          fileName: uploaded?.fileName,
        },
      });
    },
    onSuccess: async () => {
      toast.success("Entrega enviada.");
      await queryClient.invalidateQueries({ queryKey: submissionKey(assignmentId) });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar."),
  });

  if (isLoading || !submission) {
    return (
      <PortalShell title="Carregando…">
        <Skeleton className="h-40 w-full" />
      </PortalShell>
    );
  }

  const isGraded = submission.score !== null;
  const alreadySubmitted = submission.submittedAt !== null;

  return (
    <PortalShell title={submission.title} description={submission.instructions ?? undefined}>
      <Link
        to="/portal/tarefas"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-4 shrink-0" aria-hidden />
        Voltar para tarefas
      </Link>

      {isGraded ? (
        <div className="animate-in rounded-md border border-t-2 border-success/50 border-t-success bg-success-soft/40 p-5 shadow-soft fade-in zoom-in-95 duration-300">
          <p className="inline-flex items-center gap-2 font-display text-2xl font-semibold text-success">
            <CheckCircle2 className="size-6 shrink-0" aria-hidden />
            {Number(submission.score).toFixed(1)}/{Number(submission.maxScore).toFixed(1)}
          </p>
          {submission.feedback ? (
            <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
              {submission.feedback}
            </p>
          ) : null}
          <p className="mt-4 text-xs text-muted-foreground">Sua entrega já foi corrigida.</p>
          {submission.fileUrl ? (
            <a
              href={submission.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Download className="size-3.5 shrink-0" aria-hidden />
              {submission.fileName}
            </a>
          ) : null}
          {submission.textContent ? (
            <p className="mt-2 whitespace-pre-wrap rounded-md bg-background/60 p-3 text-sm text-foreground">
              {submission.textContent}
            </p>
          ) : null}
        </div>
      ) : submission.kind === "multiple_choice" ? (
        <div className="rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-5 shadow-soft">
          <div className="grid gap-4">
            {submission.questions.map((question, index) => (
              <div
                key={question.id}
                className="animate-in rounded-md border border-border/70 bg-card/40 p-4 fade-in slide-in-from-top-1 duration-200"
              >
                <p className="font-medium text-foreground">
                  {index + 1}. {question.text}
                </p>
                <RadioGroup
                  className="mt-3 gap-2.5"
                  value={answers[question.id] ?? ""}
                  onValueChange={(value) =>
                    setAnswers((prev) => ({ ...prev, [question.id]: value }))
                  }
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
              <Button className="mt-6" disabled={submitAnswersMutation.isPending}>
                {submitAnswersMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Entregar respostas
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Entregar respostas?</AlertDialogTitle>
                <AlertDialogDescription>
                  A nota sai na hora e não dá pra reenviar depois.{" "}
                  {submission.questions.some((q) => !answers[q.id])
                    ? "Você tem pergunta(s) sem resposta."
                    : ""}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => submitAnswersMutation.mutate()}
                  disabled={submitAnswersMutation.isPending}
                >
                  {submitAnswersMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : null}
                  Enviar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : (
        <div className="rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-5 shadow-soft">
          {alreadySubmitted ? (
            <p className="mb-4 text-sm text-muted-foreground">
              Você já entregou essa tarefa — pode reenviar enquanto ela não for corrigida.
            </p>
          ) : null}
          <Tabs defaultValue={submission.fileUrl ? "arquivo" : "texto"}>
            <TabsList>
              <TabsTrigger value="texto">Texto</TabsTrigger>
              <TabsTrigger value="arquivo">Arquivo</TabsTrigger>
            </TabsList>
            <TabsContent value="texto" className="mt-4">
              <Textarea
                placeholder="Escreva sua resposta aqui…"
                rows={8}
                defaultValue={submission.textContent ?? ""}
                onChange={(event) => setTextContent(event.target.value)}
              />
            </TabsContent>
            <TabsContent value="arquivo" className="mt-4">
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,image/png,image/jpeg"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              {submission.fileUrl ? (
                <a
                  href={submission.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Download className="size-3.5 shrink-0" aria-hidden />
                  Arquivo já enviado: {submission.fileName}
                </a>
              ) : null}
            </TabsContent>
          </Tabs>

          <Button
            className="mt-4"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || uploading}
          >
            {mutation.isPending || uploading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            {uploading ? "Enviando arquivo…" : alreadySubmitted ? "Reenviar" : "Entregar"}
          </Button>
        </div>
      )}
    </PortalShell>
  );
}
