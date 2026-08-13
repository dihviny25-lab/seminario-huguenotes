import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { PainelShell } from "@/components/painel/PainelShell";
import { TeacherCard } from "@/components/TeacherCard";
import { TeacherFilter } from "@/components/TeacherFilter";
import { getPublicDisciplinesFn } from "@/functions/schedule";
import { getTeacherSummaries } from "@/lib/schedule-utils";

/** Agenda de cada professor: filtro pesquisável e disciplinas em ordem cronológica. */
export function TeachersAgenda() {
  const { data: disciplines, isLoading } = useQuery({
    queryKey: ["public-disciplines"],
    queryFn: () => getPublicDisciplinesFn(),
  });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const allTeachers = useMemo(
    () => (disciplines ? getTeacherSummaries(disciplines) : []),
    [disciplines],
  );

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
    <PainelShell
      title="Agenda dos professores"
      description="Selecione um professor para ver exatamente quais aulas ele ministrará ao longo de todo o seminário, em ordem cronológica."
    >
      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <>
          <div className="rounded-xl border border-border/70 bg-card/70 p-4 shadow-soft sm:p-6">
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
              <TeacherCard
                key={`${teacher.name}-${selected ?? "all"}`}
                teacher={teacher}
                defaultOpen={visibleTeachers.length === 1}
              />
            ))}
          </div>
        </>
      )}
    </PainelShell>
  );
}
