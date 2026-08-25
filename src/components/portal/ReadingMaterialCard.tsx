import { Link } from "@tanstack/react-router";
import { BookOpen, Lock } from "lucide-react";

import type { ReadingMaterial } from "@/functions/readingMaterials";

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/** Card de apostila — bloqueado (sem link) se a disciplina ainda não começou. */
export function ReadingMaterialCard({ material }: { material: ReadingMaterial }) {
  const content = (
    <>
      {material.availableAt ? (
        <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      ) : (
        <BookOpen className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">{material.title}</span>
        {material.description ? (
          <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
            {material.description}
          </span>
        ) : null}
        {material.availableAt ? (
          <span className="mt-2 block text-xs text-muted-foreground">
            Disponível a partir de {formatDate(material.availableAt)}
          </span>
        ) : (
          <span className="mt-2 inline-block text-xs font-medium text-accent">Ler online</span>
        )}
      </span>
    </>
  );

  if (material.availableAt) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-border/70 bg-card/40 p-4 opacity-70">
        {content}
      </div>
    );
  }

  return (
    <Link
      to="/portal/apostilas/$materialId"
      params={{ materialId: material.id }}
      className="flex items-start gap-3 rounded-md border border-border/70 bg-card/70 p-4 shadow-soft transition-colors hover:border-primary/50"
    >
      {content}
    </Link>
  );
}
