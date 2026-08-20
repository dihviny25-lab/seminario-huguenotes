import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  listDisciplineVideoLessonsFn,
  listMyWatchedVideosFn,
  markVideoWatchedFn,
  type VideoLesson,
} from "@/functions/videoLessons";
import { useYouTubeCompletion } from "@/lib/useYouTubeCompletion";
import { cn } from "@/lib/utils";
import { extractYouTubeId, youtubeEmbedUrl } from "@/lib/youtube";

const WATCHED_KEY = ["my-watched-videos"] as const;

export function DisciplineVideosTab({ disciplineId }: { disciplineId: string }) {
  const queryClient = useQueryClient();
  const { data: videos, isLoading } = useQuery({
    queryKey: ["discipline-video-lessons", disciplineId],
    queryFn: () => listDisciplineVideoLessonsFn({ data: { disciplineId } }),
  });
  const { data: watchedIds } = useQuery({
    queryKey: WATCHED_KEY,
    queryFn: () => listMyWatchedVideosFn(),
  });

  const markWatchedMutation = useMutation({
    mutationFn: (videoLessonId: string) => markVideoWatchedFn({ data: { videoLessonId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WATCHED_KEY }),
  });

  const watchedSet = new Set(watchedIds ?? []);

  if (isLoading || !videos) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="aspect-video w-full" />
        ))}
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <p className="rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft">
        Nenhuma vídeo-aula disponível ainda.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          watched={watchedSet.has(video.id)}
          onWatched={() => markWatchedMutation.mutate(video.id)}
        />
      ))}
    </div>
  );
}

function VideoCard({
  video,
  watched,
  onWatched,
}: {
  video: VideoLesson;
  watched: boolean;
  onWatched: () => void;
}) {
  const iframeRef = useYouTubeCompletion(onWatched);
  const youtubeId = extractYouTubeId(video.youtubeUrl);
  if (!youtubeId) return null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border shadow-soft transition-colors",
        watched ? "border-success/50 bg-success-soft/40" : "border-border/70 bg-card/70",
      )}
    >
      <div className="aspect-video w-full">
        <iframe
          ref={iframeRef}
          src={youtubeEmbedUrl(youtubeId, { trackCompletion: true })}
          title={video.title}
          className="size-full"
          allowFullScreen
          allow="autoplay; encrypted-media"
          loading="lazy"
        />
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <p className="min-w-0 truncate text-sm font-medium text-foreground">{video.title}</p>
        {watched ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-success">
            <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
            Assistido
          </span>
        ) : null}
      </div>
    </div>
  );
}
