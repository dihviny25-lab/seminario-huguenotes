import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { ChevronLeft, Loader2, MessageCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { PortalShell } from "@/components/portal/PortalShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { getPublicDisciplinesFn } from "@/functions/schedule";
import { createThreadFn, listDisciplineThreadsFn } from "@/functions/forum";
import { groupBySemester, semesterLabel } from "@/lib/schedule-utils";

function threadsKey(disciplineId: string) {
  return ["forum-threads", disciplineId] as const;
}

/** Fórum — escolhe a disciplina primeiro, depois vê/participa dos tópicos dela. */
export function PortalForum() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: disciplines, isLoading } = useQuery({
    queryKey: ["public-disciplines"],
    queryFn: () => getPublicDisciplinesFn(),
  });

  const semesters = groupBySemester(disciplines ?? []);
  const selected = (disciplines ?? []).find((d) => d.id === selectedId) ?? null;

  return (
    <PortalShell
      title="Fórum"
      description={
        selected
          ? `${selected.discipline} — ${selected.module}`
          : "Escolha uma disciplina para ver ou participar de tópicos."
      }
    >
      {selected ? (
        <div>
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
          >
            <ChevronLeft className="size-4 shrink-0" aria-hidden />
            Escolher outra disciplina
          </button>
          <PortalForumThreadList disciplineId={selected.id} />
        </div>
      ) : isLoading || !disciplines ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-10">
          {semesters.map((semester) => (
            <section key={semester.semester}>
              <h2 className="font-display text-lg font-semibold text-foreground">
                {semesterLabel(semester.semester)}
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {semester.modules.flatMap((module) =>
                  module.disciplines.map((discipline) => (
                    <button
                      key={discipline.id}
                      type="button"
                      onClick={() => setSelectedId(discipline.id)}
                      className="flex animate-in items-start gap-3 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-4 text-left shadow-soft fade-in slide-in-from-top-1 duration-300 transition-colors hover:border-primary/50"
                    >
                      <MessageCircle className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">
                          {discipline.discipline}
                        </span>
                        {discipline.teacher ? (
                          <span className="block text-xs text-muted-foreground">
                            {discipline.teacher}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  )),
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </PortalShell>
  );
}

export function PortalForumThreadList({ disciplineId }: { disciplineId: string }) {
  const { data: threads, isLoading } = useQuery({
    queryKey: threadsKey(disciplineId),
    queryFn: () => listDisciplineThreadsFn({ data: { disciplineId } }),
  });
  const [createOpen, setCreateOpen] = useState(false);

  if (isLoading || !threads) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Novo tópico
        </Button>
      </div>

      {threads.length === 0 ? (
        <p className="animate-in rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft fade-in zoom-in-95 duration-300">
          Nenhum tópico ainda.
        </p>
      ) : (
        <div className="grid gap-3">
          {threads.map((thread) => (
            <Link
              key={thread.id}
              to="/portal/forum/$threadId"
              params={{ threadId: thread.id }}
              className="flex animate-in items-start gap-3 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-4 shadow-soft fade-in slide-in-from-top-1 duration-200 transition-colors hover:border-primary/50"
            >
              <MessageCircle className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">{thread.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {thread.authorName} · {thread.postCount}{" "}
                  {thread.postCount === 1 ? "mensagem" : "mensagens"}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}

      <CreateThreadDialog
        disciplineId={disciplineId}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}

const threadSchema = z.object({
  title: z.string().trim().min(1, "Informe um título."),
  content: z.string().trim().min(1, "Escreva a mensagem inicial."),
});

function CreateThreadDialog({
  disciplineId,
  open,
  onOpenChange,
}: {
  disciplineId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const form = useForm<z.infer<typeof threadSchema>>({
    resolver: zodResolver(threadSchema),
    defaultValues: { title: "", content: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof threadSchema>) =>
      createThreadFn({ data: { disciplineId, ...values } }),
    onSuccess: async (result) => {
      toast.success("Tópico criado.");
      form.reset();
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: threadsKey(disciplineId) });
      await navigate({ to: "/portal/forum/$threadId", params: { threadId: result.threadId } });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível criar o tópico."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo tópico</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Dúvida sobre a aula de hoje" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mensagem</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Escreva aqui…" rows={4} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Criar tópico
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
