import { useQuery } from "@tanstack/react-query";

import { SlideCard } from "@/components/portal/SlideCard";
import { Skeleton } from "@/components/ui/skeleton";
import { listDisciplinePresentationSlidesFn } from "@/functions/presentationSlides";

export function DisciplineSlidesTab({ disciplineId }: { disciplineId: string }) {
  const { data: slides, isLoading } = useQuery({
    queryKey: ["discipline-slides", disciplineId],
    queryFn: () => listDisciplinePresentationSlidesFn({ data: { disciplineId } }),
  });

  if (isLoading || !slides) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <p className="animate-in rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft fade-in zoom-in-95 duration-300">
        Nenhum slide cadastrado ainda.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {slides.map((slide) => (
        <div key={slide.id} className="animate-in fade-in slide-in-from-top-1 duration-200">
          <SlideCard slide={slide} />
        </div>
      ))}
    </div>
  );
}
