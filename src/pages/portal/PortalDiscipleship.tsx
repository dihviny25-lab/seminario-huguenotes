import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartHandshake, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PortalShell } from "@/components/portal/PortalShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  createReflectionFn,
  getNextReflectionPromptFn,
  listMyReflectionsFn,
} from "@/functions/reflections";

const REFLECTIONS_KEY = ["my-reflections"] as const;
const PROMPT_KEY = ["next-reflection-prompt"] as const;

/** Acompanhamento espiritual — reflexões guiadas, visíveis pra equipe de professores. */
export function PortalDiscipleship() {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");

  const { data: prompt, isLoading: loadingPrompt } = useQuery({
    queryKey: PROMPT_KEY,
    queryFn: () => getNextReflectionPromptFn(),
  });
  const { data: reflections, isLoading: loadingReflections } = useQuery({
    queryKey: REFLECTIONS_KEY,
    queryFn: () => listMyReflectionsFn(),
  });

  const mutation = useMutation({
    mutationFn: () => createReflectionFn({ data: { prompt: prompt!, content } }),
    onSuccess: async () => {
      toast.success("Reflexão enviada.");
      setContent("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: REFLECTIONS_KEY }),
        queryClient.invalidateQueries({ queryKey: PROMPT_KEY }),
      ]);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar."),
  });

  return (
    <PortalShell
      title="Discipulado"
      description="Um espaço pra refletir sobre sua caminhada com Deus — a equipe de professores acompanha e pode responder."
    >
      <div className="rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-6 shadow-soft">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <HeartHandshake className="size-5 shrink-0 text-accent" aria-hidden />
          Reflexão de hoje
        </h2>
        {loadingPrompt || !prompt ? (
          <Skeleton className="mt-3 h-5 w-3/4" />
        ) : (
          <p className="mt-3 text-pretty text-base font-medium text-foreground">{prompt}</p>
        )}
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (content.trim().length === 0 || !prompt) return;
            mutation.mutate();
          }}
        >
          <Textarea
            placeholder="Escreva sua reflexão aqui…"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={5}
          />
          <Button type="submit" disabled={mutation.isPending || !prompt} className="self-end">
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Enviar reflexão
          </Button>
        </form>
      </div>

      <div className="mt-8">
        <h2 className="font-display text-lg font-semibold text-foreground">Suas reflexões</h2>
        <div className="mt-4 space-y-4">
          {loadingReflections ? (
            <>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </>
          ) : reflections && reflections.length > 0 ? (
            reflections.map((reflection) => (
              <div
                key={reflection.id}
                className="animate-in rounded-md border border-border/70 bg-card/70 p-4 shadow-soft fade-in slide-in-from-top-1 duration-300"
              >
                <p className="text-sm font-medium text-accent">{reflection.prompt}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                  {reflection.content}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(reflection.createdAt).toLocaleDateString("pt-BR", {
                    dateStyle: "long",
                  })}
                </p>
                {reflection.comments.length > 0 ? (
                  <div className="mt-3 space-y-2 border-t border-border/70 pt-3">
                    {reflection.comments.map((comment) => (
                      <div key={comment.id} className="rounded-md bg-muted/40 p-3">
                        <p className="text-xs font-medium text-foreground">{comment.authorName}</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                          {comment.content}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <p className="animate-in rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft fade-in zoom-in-95 duration-300">
              Nenhuma reflexão registrada ainda.
            </p>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
