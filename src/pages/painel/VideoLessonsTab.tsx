import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { CheckCircle2, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createVideoLessonFn,
  deleteVideoLessonFn,
  getMyDisciplineVideoBoardFn,
} from "@/functions/videoLessons";
import { cn } from "@/lib/utils";
import { extractYouTubeId, youtubeThumbnailUrl } from "@/lib/youtube";

function videosKey(disciplineId: string) {
  return ["discipline-videos", disciplineId] as const;
}

export function VideoLessonsTab({ disciplineId }: { disciplineId: string }) {
  const queryClient = useQueryClient();
  const { data: board, isLoading } = useQuery({
    queryKey: videosKey(disciplineId),
    queryFn: () => getMyDisciplineVideoBoardFn({ data: { disciplineId } }),
  });
  const [createOpen, setCreateOpen] = useState(false);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: videosKey(disciplineId) });
  }

  const deleteMutation = useMutation({
    mutationFn: (videoId: string) => deleteVideoLessonFn({ data: { disciplineId, videoId } }),
    onSuccess: async () => {
      toast.success("Vídeo removido.");
      await invalidate();
    },
    onError: () => toast.error("Não foi possível remover o vídeo."),
  });

  if (isLoading || !board) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-md border border-border/70 bg-card/70 shadow-soft"
          >
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className="p-3">
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Nova vídeo-aula
        </Button>
      </div>

      {board.videos.length === 0 ? (
        <p className="rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft">
          Nenhuma vídeo-aula cadastrada ainda.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {board.videos.map((video) => {
            const youtubeId = extractYouTubeId(video.youtubeUrl);
            return (
              <div
                key={video.id}
                className="overflow-hidden rounded-md border border-border/70 bg-card/70 shadow-soft"
              >
                {youtubeId ? (
                  <a href={video.youtubeUrl} target="_blank" rel="noreferrer" className="block">
                    <img
                      src={youtubeThumbnailUrl(youtubeId)}
                      alt=""
                      className="aspect-video w-full object-cover"
                    />
                  </a>
                ) : null}
                <div className="flex items-center justify-between gap-2 p-3">
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">
                    {video.title}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Excluir"
                    onClick={() => deleteMutation.mutate(video.id)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
                <div className="border-t border-border/70 px-3 py-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        disabled={video.watchedCount === 0}
                        className={cn(
                          "inline-flex items-center gap-1.5 text-xs font-medium",
                          video.watchedCount > 0
                            ? "cursor-pointer text-success hover:underline"
                            : "cursor-default text-muted-foreground",
                        )}
                      >
                        {video.watchedCount > 0 ? (
                          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
                        ) : (
                          <Users className="size-3.5 shrink-0" aria-hidden />
                        )}
                        {video.watchedCount} de {board.totalActiveStudents} assistiram
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64" align="start">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Assistiram até o fim
                      </p>
                      <ul className="space-y-1 text-sm text-foreground">
                        {video.watchedByNames.map((name) => (
                          <li key={name}>{name}</li>
                        ))}
                      </ul>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateVideoDialog
        disciplineId={disciplineId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={invalidate}
      />
    </div>
  );
}

const videoSchema = z.object({
  title: z.string().trim().min(1, "Informe um título."),
  youtubeUrl: z
    .string()
    .trim()
    .refine((url) => extractYouTubeId(url) !== null, "Cole um link válido do YouTube."),
});

function CreateVideoDialog({
  disciplineId,
  open,
  onOpenChange,
  onCreated,
}: {
  disciplineId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<unknown>;
}) {
  const form = useForm<z.infer<typeof videoSchema>>({
    resolver: zodResolver(videoSchema),
    defaultValues: { title: "", youtubeUrl: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof videoSchema>) =>
      createVideoLessonFn({ data: { disciplineId, ...values } }),
    onSuccess: async () => {
      toast.success("Vídeo-aula adicionada.");
      form.reset();
      onOpenChange(false);
      await onCreated();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível adicionar."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova vídeo-aula</DialogTitle>
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
                    <Input placeholder="Aula 1 — Introdução" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="youtubeUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link do YouTube</FormLabel>
                  <FormControl>
                    <Input placeholder="https://www.youtube.com/watch?v=..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                Adicionar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
