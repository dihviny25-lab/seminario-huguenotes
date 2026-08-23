import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";

import { PortalShell } from "@/components/portal/PortalShell";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicDisciplinesFn } from "@/functions/schedule";
import {
  listAllVideoLessonsFn,
  listMyWatchedVideosFn,
  markVideoWatchedFn,
  type VideoLesson,
} from "@/functions/videoLessons";
import { groupBySemester, semesterLabel } from "@/lib/schedule-utils";
import { cn } from "@/lib/utils";
import { useYouTubeCompletion } from "@/lib/useYouTubeCompletion";
import { youtubeEmbedUrl, extractYouTubeId } from "@/lib/youtube";

const WATCHED_KEY = ["my-watched-videos"] as const;

/** Biblioteca de vídeo-aulas — todas as disciplinas que têm vídeo, agrupadas por semestre. */
export function PortalVideos() {
  const queryClient = useQueryClient();
  const { data: disciplines, isLoading: loadingDisciplines } = useQuery({
    queryKey: ["public-disciplines"],
    queryFn: () => getPublicDisciplinesFn(),
  });
  const { data: videos, isLoading: loadingVideos } = useQuery({
    queryKey: ["all-video-lessons"],
    queryFn: () => listAllVideoLessonsFn(),
  });
  const { data: watchedIds } = useQuery({
    queryKey: WATCHED_KEY,
    queryFn: () => listMyWatchedVideosFn(),
  });

  const markWatchedMutation = useMutation({
    mutationFn: (videoLessonId: string) => markVideoWatchedFn({ data: { videoLessonId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WATCHED_KEY }),
  });

  const isLoading = loadingDisciplines || loadingVideos;
  const watchedSet = new Set(watchedIds ?? []);
  const videosByDiscipline = new Map<string, Array<VideoLesson>>();
  for (const video of videos ?? []) {
    const list = videosByDiscipline.get(video.disciplineId) ?? [];
    list.push(video);
    videosByDiscipline.set(video.disciplineId, list);
  }

  const disciplinesWithVideos = (disciplines ?? []).filter((d) => videosByDiscipline.has(d.id));
  const semesters = groupBySemester(disciplinesWithVideos);

  return (
    <PortalShell
      title="Vídeo-aulas"
      description="Assista às vídeo-aulas disponibilizadas pelos professores em cada disciplina."
    >
      {isLoading ? (
        <div className="space-y-10">
          {Array.from({ length: 2 }).map((_, sectionIndex) => (
            <div key={sectionIndex}>
              <Skeleton className="h-5 w-32" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 2 }).map((_, cardIndex) => (
                  <div
                    key={cardIndex}
                    className="overflow-hidden rounded-md border border-border/70 bg-card/70 shadow-soft"
                  >
                    <Skeleton className="aspect-video w-full rounded-none" />
                    <div className="p-3">
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : semesters.length === 0 ? (
        <p className="rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft">
          Nenhuma vídeo-aula disponível no momento.
        </p>
      ) : (
        <div className="space-y-10">
          {semesters.map((semester) => (
            <section key={semester.semester}>
              <h2 className="font-display text-lg font-semibold text-foreground">
                {semesterLabel(semester.semester)}
              </h2>
              <div className="mt-4 space-y-8">
                {semester.modules.flatMap((module) =>
                  module.disciplines.map((discipline) => {
                    const disciplineVideos = videosByDiscipline.get(discipline.id) ?? [];
                    return (
                      <div key={discipline.id}>
                        <h3 className="text-base font-semibold text-foreground">
                          {discipline.discipline}
                        </h3>
                        {discipline.teacher ? (
                          <p className="text-sm text-muted-foreground">{discipline.teacher}</p>
                        ) : null}
                        <div className="mt-3 grid gap-4 sm:grid-cols-2">
                          {disciplineVideos.map((video) => (
                            <VideoCard
                              key={video.id}
                              video={video}
                              watched={watchedSet.has(video.id)}
                              onWatched={() => markWatchedMutation.mutate(video.id)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  }),
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </PortalShell>
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

  const containerClass = cn(
    "overflow-hidden rounded-md border shadow-soft transition-colors",
    watched ? "border-success/50 bg-success-soft/40" : "border-border/70 bg-card/70",
  );
  const footer = (
    <div className="flex items-center justify-between gap-2 p-3">
      <p className="min-w-0 truncate text-sm font-medium text-foreground">{video.title}</p>
      {watched ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-success">
          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
          Assistido
        </span>
      ) : null}
    </div>
  );

  if (video.source === "upload") {
    if (!video.fileUrl) return null;
    return (
      <div className={containerClass}>
        <video
          src={video.fileUrl}
          controls
          className="aspect-video w-full bg-black"
          onEnded={onWatched}
        />
        {footer}
      </div>
    );
  }

  const youtubeId = video.youtubeUrl ? extractYouTubeId(video.youtubeUrl) : null;
  if (!youtubeId) return null;

  return (
    <div className={containerClass}>
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
      {footer}
    </div>
  );
}
