import { Link } from "@tanstack/react-router";
import { Lock, MonitorPlay } from "lucide-react";

import type { PresentationSlide } from "@/functions/presentationSlides";

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/** Card de slide — bloqueado (sem link) se a disciplina ainda não começou. */
export function SlideCard({ slide }: { slide: PresentationSlide }) {
  const content = (
    <>
      {slide.availableAt ? (
        <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      ) : (
        <MonitorPlay className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">{slide.title}</span>
        {slide.description ? (
          <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
            {slide.description}
          </span>
        ) : null}
        {slide.availableAt ? (
          <span className="mt-2 block text-xs text-muted-foreground">
            Disponível a partir de {formatDate(slide.availableAt)}
          </span>
        ) : (
          <span className="mt-2 inline-block text-xs font-medium text-accent">Ver slides</span>
        )}
      </span>
    </>
  );

  if (slide.availableAt) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-border/70 bg-card/40 p-4 opacity-70">
        {content}
      </div>
    );
  }

  return (
    <Link
      to="/portal/slides/$slideId"
      params={{ slideId: slide.id }}
      className="flex items-start gap-3 rounded-md border border-border/70 bg-card/70 p-4 shadow-soft transition-colors hover:border-primary/50"
    >
      {content}
    </Link>
  );
}
