import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Download } from "lucide-react";
import { toast } from "sonner";

import { PortalShell } from "@/components/portal/PortalShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getMySubmissionFn, submitAssignmentFn } from "@/functions/assignmentSubmissions";
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
        <div className="rounded-md border border-t-2 border-success/50 border-t-success bg-success-soft/40 p-5 shadow-soft">
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
                accept=".pdf,.doc,.docx,image/png,image/jpeg"
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
            {uploading ? "Enviando arquivo…" : alreadySubmitted ? "Reenviar" : "Entregar"}
          </Button>
        </div>
      )}
    </PortalShell>
  );
}
