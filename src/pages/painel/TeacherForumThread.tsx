import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentTeacherFn } from "@/functions/auth";
import {
  createTeacherPostFn,
  deleteTeacherPostFn,
  deleteTeacherThreadFn,
  getTeacherThreadFn,
} from "@/functions/teacherForum";
import { canDeleteThread } from "@/lib/forumPermissions";

import { teacherThreadsKey } from "./TeacherForumHome";

function teacherThreadKey(threadId: string) {
  return ["teacher-forum-thread", threadId] as const;
}

export function TeacherForumThread({ threadId }: { threadId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useQuery({
    queryKey: ["current-teacher"],
    queryFn: () => getCurrentTeacherFn(),
  });
  const {
    data: thread,
    error: threadError,
    isError,
    isLoading,
  } = useQuery({
    queryKey: teacherThreadKey(threadId),
    queryFn: () => getTeacherThreadFn({ data: { threadId } }),
  });
  const [reply, setReply] = useState("");
  const [deleteThreadOpen, setDeleteThreadOpen] = useState(false);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: teacherThreadKey(threadId) });
  }

  const replyMutation = useMutation({
    mutationFn: () => createTeacherPostFn({ data: { threadId, content: reply } }),
    onSuccess: async () => {
      setReply("");
      await invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível responder."),
  });

  const deletePostMutation = useMutation({
    mutationFn: (postId: string) => deleteTeacherPostFn({ data: { postId } }),
    onSuccess: () => invalidate(),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível apagar."),
  });

  const deleteThreadMutation = useMutation({
    mutationFn: () => deleteTeacherThreadFn({ data: { threadId } }),
    onSuccess: async () => {
      toast.success("Tópico apagado.");
      await queryClient.invalidateQueries({ queryKey: teacherThreadsKey });
      await navigate({ to: "/painel/forum-interno" });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível apagar o tópico."),
  });

  const isModerator = me?.role === "admin";
  const canDelete =
    thread !== undefined &&
    canDeleteThread({
      isModerator,
      isAuthor: thread.mine,
      postCount: Math.max(0, thread.posts.length - 1),
    });

  return (
    <PainelShell title={thread?.title ?? (isError ? "Tópico indisponível" : "Carregando…")}>
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : isError || !thread ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6">
          <h2 className="font-semibold text-foreground">Não foi possível abrir este tópico</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {threadError instanceof Error
              ? threadError.message
              : "O tópico pode ter sido apagado ou o endereço é inválido."}
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/painel/forum-interno">Voltar para o fórum interno</Link>
          </Button>
        </div>
      ) : (
        <div>
          <div className="mb-6 flex items-center justify-between">
            <Link
              to="/painel/forum-interno"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
            >
              <ArrowLeft className="size-4 shrink-0" aria-hidden />
              Voltar para o fórum interno
            </Link>
            {canDelete ? (
              <Button variant="ghost" size="sm" onClick={() => setDeleteThreadOpen(true)}>
                <Trash2 className="size-4" aria-hidden />
                Apagar tópico
              </Button>
            ) : null}
          </div>

          <div className="grid gap-3">
            {thread.posts.map((post) => (
              <div
                key={post.id}
                className="rounded-md border border-border/70 bg-card/70 p-4 shadow-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{post.authorName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(post.createdAt).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  {!post.isInitial && (post.mine || isModerator) ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => deletePostMutation.mutate(post.id)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                      <span className="sr-only">Apagar mensagem</span>
                    </Button>
                  ) : null}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{post.content}</p>
              </div>
            ))}
          </div>

          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (reply.trim().length === 0) return;
              replyMutation.mutate();
            }}
          >
            <Textarea
              placeholder="Escreva uma resposta…"
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              rows={3}
            />
            <Button type="submit" disabled={replyMutation.isPending} className="self-end">
              Responder
            </Button>
          </form>

          <AlertDialog open={deleteThreadOpen} onOpenChange={setDeleteThreadOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apagar tópico?</AlertDialogTitle>
                <AlertDialogDescription>
                  Todas as mensagens desse tópico serão apagadas. Essa ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteThreadMutation.mutate()}>
                  Apagar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </PainelShell>
  );
}
