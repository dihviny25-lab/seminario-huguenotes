import { useQuery } from "@tanstack/react-query";

import { PortalShell } from "@/components/portal/PortalShell";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicDisciplinesFn } from "@/functions/schedule";
import { listAllVideoLessonsFn, type VideoLesson } from "@/functions/videoLessons";
import { groupBySemester, semesterLabel } from "@/lib/schedule-utils";
import { youtubeEmbedUrl, extractYouTubeId } from "@/lib/youtube";

/** Biblioteca de vídeo-aulas — todas as disciplinas que têm vídeo, agrupadas por semestre. */
export function PortalVideos() {
  const { data: disciplines, isLoading: loadingDisciplines } = useQuery({
    queryKey: ["public-disciplines"],
    queryFn: () => getPublicDisciplinesFn(),
  });
  const { data: videos, isLoading: loadingVideos } = useQuery({
    queryKey: ["all-video-lessons"],
    queryFn: () => listAllVideoLessonsFn(),
  });

  const isLoading = loadingDisciplines || loadingVideos;
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
                          {disciplineVideos.map((video) => {
                            const youtubeId = extractYouTubeId(video.youtubeUrl);
                            if (!youtubeId) return null;
                            return (
                              <div
                                key={video.id}
                                className="overflow-hidden rounded-md border border-border/70 bg-card/70 shadow-soft"
                              >
                                <div className="aspect-video w-full">
                                  <iframe
                                    src={youtubeEmbedUrl(youtubeId)}
                                    title={video.title}
                                    className="size-full"
                                    allowFullScreen
                                    loading="lazy"
                                  />
                                </div>
                                <p className="p-3 text-sm font-medium text-foreground">
                                  {video.title}
                                </p>
                              </div>
                            );
                          })}
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
