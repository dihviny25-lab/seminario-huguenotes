import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PainelShell } from "@/components/painel/PainelShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentTeacherFn } from "@/functions/auth";
import {
  createMaterialCommentFn,
  deleteMaterialCommentFn,
  listMaterialCommentsFn,
  listSharedWithMeFn,
} from "@/functions/materialSharing";
import { getEmbeddableViewerUrl } from "@/lib/documentViewer";

function commentsKey(materialId: string) {
  return ["material-comments", materialId] as const;
}

/** Leitor de apostila compartilhada + discussão — mesmo padrão de PortalMaterialReader
 * (PDF embutido sem toolbar) e do painel de comentários de StudentReport (lista + Textarea +
 * botão de responder por item). */
export function SharedMaterialReader({ materialId }: { materialId: string }) {
  const queryClient = useQueryClient();
  const { data: materials, isLoading: loadingMaterial } = useQuery({
    queryKey: ["shared-materials"],
    queryFn: () => listSharedWithMeFn(),
  });
  const material = materials?.find((m) => m.id === materialId);

  // Buscado só pra deixar explícito que a UI não decide exclusão sozinha — quem decide é o
  // servidor (deleteMaterialCommentFn); o botão de apagar usa comment.mine, já calculado por
  // listMaterialCommentsFn.
  useQuery({
    queryKey: ["current-teacher"],
    queryFn: () => getCurrentTeacherFn(),
  });
  const { data: comments, isLoading: loadingComments } = useQuery({
    queryKey: commentsKey(materialId),
    queryFn: () => listMaterialCommentsFn({ data: { materialId } }),
  });
  const [draft, setDraft] = useState("");

  function invalidateComments() {
    return queryClient.invalidateQueries({ queryKey: commentsKey(materialId) });
  }

  const commentMutation = useMutation({
    mutationFn: () => createMaterialCommentFn({ data: { materialId, content: draft } }),
    onSuccess: async () => {
      setDraft("");
      await invalidateComments();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível comentar."),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => deleteMaterialCommentFn({ data: { commentId } }),
    onSuccess: () => invalidateComments(),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível apagar."),
  });

  return (
    <PainelShell
      title={material?.title ?? (loadingMaterial ? "Carregando…" : "Apostila")}
      fullWidth
    >
      <Link
        to="/painel/apostilas-compartilhadas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-4 shrink-0" aria-hidden />
        Voltar pras apostilas compartilhadas
      </Link>

      {loadingMaterial || !material ? (
        <Skeleton className="h-[70vh] w-full" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="overflow-hidden rounded-md border border-border/70 bg-card/70 shadow-soft">
            <iframe
              src={getEmbeddableViewerUrl(material.fileUrl)}
              title={material.title}
              className="h-[70vh] w-full"
            />
          </div>

          <div className="flex flex-col rounded-md border border-border/70 bg-card/70 p-4 shadow-soft">
            <h2 className="font-display text-sm font-semibold text-foreground">Comentários</h2>
            <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
              {loadingComments ? (
                <>
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </>
              ) : comments && comments.length > 0 ? (
                comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="animate-in rounded-md bg-muted/40 p-3 fade-in slide-in-from-top-1 duration-200"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-foreground">{comment.authorName}</p>
                      {comment.mine ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteCommentMutation.mutate(comment.id)}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                          <span className="sr-only">Apagar comentário</span>
                        </Button>
                      ) : null}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                      {comment.content}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>
              )}
            </div>

            <form
              className="mt-3 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (draft.trim().length === 0) return;
                commentMutation.mutate();
              }}
            >
              <Textarea
                placeholder="Comentar…"
                rows={2}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <Button type="submit" size="sm" disabled={commentMutation.isPending}>
                {commentMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Enviar
              </Button>
            </form>
          </div>
        </div>
      )}
    </PainelShell>
  );
}
