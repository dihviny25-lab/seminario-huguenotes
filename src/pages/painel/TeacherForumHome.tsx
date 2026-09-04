import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { Loader2, MessagesSquare, Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { PainelShell } from "@/components/painel/PainelShell";
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
import { createTeacherThreadFn, listTeacherThreadsFn } from "@/functions/teacherForum";

export const teacherThreadsKey = ["teacher-forum-threads"] as const;

/** Fórum interno — só professores e admins veem esta tela e o link na navegação. */
export function TeacherForumHome() {
  const { data: threads, isLoading } = useQuery({
    queryKey: teacherThreadsKey,
    queryFn: () => listTeacherThreadsFn(),
  });
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <PainelShell
      title="Fórum interno"
      description="Espaço de dúvidas e coordenação só entre professores — alunos não têm acesso."
    >
      {isLoading || !threads ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div>
          <div className="mb-4 flex justify-end">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Novo tópico
            </Button>
          </div>

          {threads.length === 0 ? (
            <p className="rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft">
              Nenhum tópico ainda.
            </p>
          ) : (
            <div className="grid gap-3">
              {threads.map((thread) => (
                <Link
                  key={thread.id}
                  to="/painel/forum-interno/$threadId"
                  params={{ threadId: thread.id }}
                  className="flex animate-in items-start gap-3 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-4 shadow-soft fade-in slide-in-from-top-1 duration-200 transition-colors hover:border-primary/50"
                >
                  <MessagesSquare className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">
                      {thread.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {thread.authorName} · {thread.postCount}{" "}
                      {thread.postCount === 1 ? "mensagem" : "mensagens"}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}

          <CreateTeacherThreadDialog open={createOpen} onOpenChange={setCreateOpen} />
        </div>
      )}
    </PainelShell>
  );
}

const threadSchema = z.object({
  title: z.string().trim().min(1, "Informe um título."),
  content: z.string().trim().min(1, "Escreva a mensagem inicial."),
});

function CreateTeacherThreadDialog({
  open,
  onOpenChange,
}: {
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
    mutationFn: (values: z.infer<typeof threadSchema>) => createTeacherThreadFn({ data: values }),
    onSuccess: async (result) => {
      toast.success("Tópico criado.");
      form.reset();
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: teacherThreadsKey });
      await navigate({
        to: "/painel/forum-interno/$threadId",
        params: { threadId: result.threadId },
      });
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
                    <Input placeholder="Combinado de datas de prova" {...field} />
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
