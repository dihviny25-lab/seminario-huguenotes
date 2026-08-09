import { useMemo } from "react";
import { BookOpen, CalendarRange, Layers, Users } from "lucide-react";

import { PageShell } from "@/components/PageShell";
import { SemesterCard } from "@/components/SemesterCard";
import { StatisticCard } from "@/components/StatisticCard";
import { getScheduleStatistics, groupBySemester } from "@/lib/schedule-utils";
import type { Discipline } from "@/types/schedule";

/** Nota oficial da coordenação sobre a publicação das datas. */
const scheduleNote =
  "Somente o 1º Semestre (2026) possui datas de calendário confirmadas pela coordenação. Os demais permanecem como “A confirmar” até serem publicados.";

/** Página inicial: resumo geral e todos os semestres em cartões. */
export function Dashboard({ disciplines }: { disciplines: Discipline[] }) {
  const semesters = useMemo(() => groupBySemester(disciplines), [disciplines]);
  const statistics = useMemo(() => getScheduleStatistics(disciplines), [disciplines]);

  return (
    <PageShell
      subtitle="Cronograma Acadêmico"
      title="Seminário Huguenotes"
      description="Consulte todos os semestres, módulos e disciplinas do curso em um só lugar, com o andamento das datas confirmadas pela coordenação."
    >
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatisticCard label="Semestres" value={statistics.semesters} icon={CalendarRange} />
        <StatisticCard label="Módulos" value={statistics.modules} icon={Layers} />
        <StatisticCard
          label="Disciplinas"
          value={statistics.disciplines}
          icon={BookOpen}
          hint={`${statistics.lessons} aulas no total`}
        />
        <StatisticCard label="Professores" value={statistics.teachers} icon={Users} />
      </div>

      <div className="mt-6 rounded-lg border border-warning-border/70 bg-gradient-to-br from-warning-soft to-background px-4 py-4 text-sm leading-relaxed text-warning shadow-soft sm:px-5">
        <p className="font-medium">Nota da coordenação</p>
        <p className="mt-1">{scheduleNote}</p>
      </div>

      <div className="mt-10 grid gap-6">
        {semesters.map((semester) => (
          <SemesterCard key={semester.semester} semester={semester} />
        ))}
      </div>
    </PageShell>
  );
}
