import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronLeft } from "lucide-react";

import { PainelShell } from "@/components/painel/PainelShell";
import { Skeleton } from "@/components/ui/skeleton";
import { listMyDisciplinesFn } from "@/functions/disciplines";
import { AssignmentsTab } from "@/pages/painel/AssignmentsTab";

/** Tarefas — escolhe a disciplina primeiro, depois gerencia as tarefas dela. */
export function AssignmentsHome() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: disciplines, isLoading } = useQuery({
    queryKey: ["my-disciplines"],
    queryFn: () => listMyDisciplinesFn(),
  });

  const selected = disciplines?.find((d) => d.id === selectedId) ?? null;

  return (
    <PainelShell
      title="Tarefas"
      description={
        selected
          ? `${selected.discipline} — ${selected.module}`
          : "Escolha uma disciplina para criar ou gerenciar tarefas."
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
          <AssignmentsTab disciplineId={selected.id} />
        </div>
      ) : isLoading || !disciplines ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : disciplines.length === 0 ? (
        <p className="rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft">
          Você ainda não tem disciplinas atribuídas.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {disciplines.map((discipline) => (
            <button
              key={discipline.id}
              type="button"
              onClick={() => setSelectedId(discipline.id)}
              className="flex items-start gap-3 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-4 text-left shadow-soft transition-colors hover:border-primary/50"
            >
              <BookOpen className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">
                  {discipline.discipline}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {discipline.module} · {discipline.term}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </PainelShell>
  );
}
