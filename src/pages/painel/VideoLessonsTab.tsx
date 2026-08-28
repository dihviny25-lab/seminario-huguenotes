import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createVideoLessonFn,
  deleteVideoLessonFn,
  getMyDisciplineVideoBoardFn,
} from "@/functions/videoLessons";
import { uploadFile } from "@/lib/blobUpload";
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
            const youtubeId =
              video.source === "youtube" && video.youtubeUrl
                ? extractYouTubeId(video.youtubeUrl)
                : null;
            return (
              <div
                key={video.id}
                className="animate-in overflow-hidden rounded-md border border-border/70 bg-card/70 shadow-soft fade-in slide-in-from-top-1 duration-200"
              >
                {video.source === "upload" && video.fileUrl ? (
                  <video src={video.fileUrl} controls className="aspect-video w-full bg-black" />
                ) : youtubeId ? (
                  <a href={video.youtubeUrl!} target="_blank" rel="noreferrer" className="block">
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  function reset() {
    setTitle("");
    setYoutubeUrl("");
    setFile(null);
    setUploadProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const mutation = useMutation({
    mutationFn: async (source: "youtube" | "upload") => {
      if (source === "youtube") {
        return createVideoLessonFn({ data: { disciplineId, title, source, youtubeUrl } });
      }
      if (!file) throw new Error("Escolha um arquivo de vídeo.");
      setUploadProgress(0);
      try {
        const uploaded = await uploadFile(file, setUploadProgress);
        return createVideoLessonFn({
          data: { disciplineId, title, source, fileUrl: uploaded.url },
        });
      } finally {
        setUploadProgress(null);
      }
    },
    onSuccess: async () => {
      toast.success("Vídeo-aula adicionada.");
      reset();
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

        <div className="space-y-2">
          <Label htmlFor="video-title">Título</Label>
          <Input
            id="video-title"
            placeholder="Aula 1 — Introdução"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <Tabs defaultValue="youtube" className="mt-2">
          <TabsList>
            <TabsTrigger value="youtube">Link do YouTube</TabsTrigger>
            <TabsTrigger value="upload">Enviar arquivo</TabsTrigger>
          </TabsList>

          <TabsContent value="youtube" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="video-youtube-url">Link do YouTube</Label>
              <Input
                id="video-youtube-url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(event) => setYoutubeUrl(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                onClick={() => mutation.mutate("youtube")}
                disabled={
                  mutation.isPending ||
                  title.trim().length === 0 ||
                  extractYouTubeId(youtubeUrl) === null
                }
              >
                {mutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Adicionar
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="upload" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="video-file">Arquivo de vídeo (MP4, WebM ou MOV)</Label>
              <Input
                id="video-file"
                type="file"
                ref={fileInputRef}
                accept="video/mp4,video/webm,video/quicktime"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Vídeos podem ser grandes — o envio pode demorar dependendo da sua internet.
              </p>
            </div>
            {uploadProgress !== null ? (
              <div className="space-y-1">
                <Progress value={uploadProgress} />
                <p className="text-xs text-muted-foreground">
                  Enviando… {Math.round(uploadProgress)}%
                </p>
              </div>
            ) : null}
            <DialogFooter>
              <Button
                onClick={() => mutation.mutate("upload")}
                disabled={mutation.isPending || title.trim().length === 0 || !file}
              >
                {mutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                {mutation.isPending ? "Enviando…" : "Adicionar"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
