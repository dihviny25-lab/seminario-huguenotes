import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { deletePostFn, deleteThreadFn, getThreadFn, replyToThreadFn } from "@/functions/forum";
import { canDeletePost, canDeleteThread } from "@/lib/forumPermissions";

export function threadKey(threadId: string) {
  return ["forum-thread", threadId] as const;
}

export function ForumThreadView({
  threadId,
  backTo,
  backLabel,
  canModerateThread,
  moderateAllPosts,
  afterDeleteThreadTo,
}: {
  threadId: string;
  backTo: string;
  backLabel: string;
  canModerateThread: boolean;
  moderateAllPosts: boolean;
  afterDeleteThreadTo: string;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: thread, isLoading } = useQuery({
    queryKey: threadKey(threadId),
    queryFn: () => getThreadFn({ data: { threadId } }),
  });
  const [reply, setReply] = useState("");
  const [deleteThreadOpen, setDeleteThreadOpen] = useState(false);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: threadKey(threadId) });
  }

  const replyMutation = useMutation({
    mutationFn: () => replyToThreadFn({ data: { threadId, content: reply } }),
    onSuccess: async () => {
      setReply("");
      await invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível responder."),
  });

  const deletePostMutation = useMutation({
    mutationFn: (postId: string) => deletePostFn({ data: { postId } }),
    onSuccess: () => invalidate(),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível apagar."),
  });

  const deleteThreadMutation = useMutation({
    mutationFn: () => deleteThreadFn({ data: { threadId } }),
    onSuccess: async () => {
      toast.success("Tópico apagado.");
      await navigate({ to: afterDeleteThreadTo });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível apagar o tópico."),
  });

  if (isLoading || !thread) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const canDelete =
    thread !== undefined &&
    canDeleteThread({
      isModerator: canModerateThread,
      isAuthor: thread.mine,
      postCount: Math.max(0, thread.posts.length - 1),
    });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
        >
          <ArrowLeft className="size-4 shrink-0" aria-hidden />
          {backLabel}
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
                <p className="text-sm font-medium text-foreground">
                  {post.authorName}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {post.authorRole === "teacher" ? "Professor" : "Aluno"}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(post.createdAt).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              {canDeletePost({
                isOpeningPost: post.isOpeningPost,
                isAuthor: post.mine,
                isModerator: moderateAllPosts,
              }) ? (
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
  );
}
