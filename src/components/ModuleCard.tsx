import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DisciplineRow } from "@/components/DisciplineRow";
import { StatusBadge } from "@/components/StatusBadge";
import type { ModuleGroup } from "@/types/schedule";

interface ModuleCardProps {
  module: ModuleGroup;
  /** Chave única do item de accordion dentro do semestre. */
  value: string;
}

/** Módulo expansível com suas disciplinas. */
export function ModuleCard({ module, value }: ModuleCardProps) {
  return (
    <AccordionItem value={value} className="border-none">
      <AccordionTrigger className="rounded-md px-2 py-4 text-left transition-colors hover:bg-surface/70 hover:no-underline data-[state=open]:bg-surface/50">
        <div className="grid w-full grid-cols-[minmax(0,1fr)] gap-2 pr-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold text-foreground">
              {module.module}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {module.status === "confirmed" && module.period
                ? module.period
                : "Aguardando definição."}
              {" · "}
              {module.disciplines.length}{" "}
              {module.disciplines.length === 1 ? "disciplina" : "disciplinas"}
              {module.totalLessons > 0 &&
                ` · ${module.totalLessons} ${module.totalLessons === 1 ? "aula" : "aulas"}`}
            </p>
          </div>
          <StatusBadge
            status={module.status}
            period={module.period}
            className="justify-self-start sm:justify-self-end"
          />
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-2 pb-5">
        <ul className="grid gap-3">
          {module.disciplines.map((discipline) => (
            <DisciplineRow key={discipline.id} discipline={discipline} />
          ))}
        </ul>
      </AccordionContent>
    </AccordionItem>
  );
}
