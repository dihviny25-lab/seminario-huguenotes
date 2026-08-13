import { useMemo } from "react";

import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Accordion } from "@/components/ui/accordion";
import { ModuleCard } from "@/components/ModuleCard";
import { groupBySemester, semesterLabel } from "@/lib/schedule-utils";
import type { Discipline } from "@/types/schedule";

/** Página de detalhe de um semestre: seus módulos e disciplinas. */
export function SemesterDetail({
  disciplines,
  semester,
}: {
  disciplines: Discipline[];
  semester: number;
}) {
  const group = useMemo(
    () => groupBySemester(disciplines).find((s) => s.semester === semester),
    [disciplines, semester],
  );

  if (!group) {
    return (
      <PageShell
        subtitle="Cronograma Acadêmico"
        title="Semestre não encontrado"
        backLink={{ to: "/", label: "Voltar para todos os semestres" }}
      >
        <p className="mt-8 text-muted-foreground">
          Esse semestre ainda não está cadastrado no cronograma.
        </p>
      </PageShell>
    );
  }

  const confirmed = group.modules.some((m) => m.status === "confirmed");
  const defaultOpen = group.modules
    .filter((m) => m.status === "confirmed")
    .map((m) => `${group.semester}-${m.module}`);

  return (
    <PageShell
      subtitle={`Turma ${group.term}`}
      title={semesterLabel(group.semester)}
      description={`${group.modules.length} ${group.modules.length === 1 ? "módulo" : "módulos"} · ${group.totalDisciplines} ${group.totalDisciplines === 1 ? "disciplina" : "disciplinas"} · ${group.totalLessons} aulas no total.`}
      backLink={{ to: "/", label: "Voltar para todos os semestres" }}
    >
      <div className="mt-5">
        <StatusBadge status={confirmed ? "confirmed" : "pending"} />
      </div>

      <Accordion
        type="multiple"
        defaultValue={defaultOpen}
        className="mt-8 divide-y divide-border/70 rounded-2xl border border-border/70 bg-card px-2 shadow-soft sm:px-4"
      >
        {group.modules.map((module) => (
          <ModuleCard
            key={module.module}
            module={module}
            value={`${group.semester}-${module.module}`}
          />
        ))}
      </Accordion>
    </PageShell>
  );
}
