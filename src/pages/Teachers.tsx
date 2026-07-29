import { useMemo, useState } from "react";

import { PageShell } from "@/components/PageShell";
import { TeacherCard } from "@/components/TeacherCard";
import { TeacherFilter } from "@/components/TeacherFilter";
import { getTeacherSummaries } from "@/lib/schedule-utils";

/** Página "Por Professor": filtro pesquisável e agenda cronológica. */
export function Teachers() {
  const allTeachers = useMemo(() => getTeacherSummaries(), []);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const filteredTeachers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return allTeachers;
    return allTeachers.filter((teacher) => teacher.name.toLowerCase().includes(term));
  }, [allTeachers, query]);

  const visibleTeachers = useMemo(
    () =>
      selected ? filteredTeachers.filter((teacher) => teacher.name === selected) : filteredTeachers,
    [filteredTeachers, selected],
  );

  return (
    <PageShell
      subtitle="Por Professor"
      title="Agenda dos professores"
      description="Selecione um professor para ver exatamente quais aulas ele ministrará ao longo de todo o seminário, em ordem cronológica."
    >
      <div className="mt-8 rounded-[1.75rem] border border-border/70 bg-card/70 p-4 shadow-soft sm:p-6">
        <TeacherFilter
          teachers={filteredTeachers}
          query={query}
          onQueryChange={setQuery}
          selected={selected}
          onSelect={setSelected}
        />
      </div>

      <div className="mt-8 grid gap-6">
        {visibleTeachers.map((teacher) => (
          <TeacherCard key={teacher.name} teacher={teacher} />
        ))}
      </div>
    </PageShell>
  );
}
