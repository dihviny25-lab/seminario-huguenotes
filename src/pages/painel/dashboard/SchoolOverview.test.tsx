import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { SchoolOverview as SchoolOverviewData } from "@/lib/teacherDashboard";
import { SchoolOverview } from "./SchoolOverview";

const overview: SchoolOverviewData = {
  totals: { activeStudents: 24, teachers: 6, disciplines: 2, lessonsGiven: 18 },
  riskDistribution: { onTrack: 18, gradeOnly: 2, attendanceOnly: 3, both: 1 },
  disciplineMetrics: [
    {
      disciplineId: "d1",
      disciplineName: "Introdução à Teologia",
      teacherName: "João",
      average: 7.45,
      attendancePercent: 82.5,
      progressPercent: 60,
      lessonsGiven: 6,
      lessonsPlanned: 10,
    },
    {
      disciplineId: "d2",
      disciplineName: "História da Igreja",
      teacherName: null,
      average: null,
      attendancePercent: null,
      progressPercent: 0,
      lessonsGiven: 0,
      lessonsPlanned: 8,
    },
  ],
};

describe("SchoolOverview", () => {
  it("mostra totais, critérios de risco e uma tabela acessível com valores exatos", () => {
    const html = renderToStaticMarkup(<SchoolOverview overview={overview} />);
    for (const text of [
      "Visão geral da escola",
      "Alunos",
      "Matrículas ativas",
      "Docentes",
      "Vinculados a disciplinas",
      "Situação dos alunos",
      "Risco por nota",
      "Risco por frequência",
      "Introdução à Teologia",
      "7,45",
      "82,5%",
      "6/10",
      "Sem notas",
      "Sem chamadas",
      "Sem professor",
    ]) {
      expect(html).toContain(text);
    }
    expect(html).toContain("Valores de média, frequência e progresso por disciplina");
  });

  it("explica estados vazios", () => {
    const html = renderToStaticMarkup(
      <SchoolOverview
        overview={{
          totals: { activeStudents: 0, teachers: 0, disciplines: 0, lessonsGiven: 0 },
          riskDistribution: { onTrack: 0, gradeOnly: 0, attendanceOnly: 0, both: 0 },
          disciplineMetrics: [],
        }}
      />,
    );
    expect(html).toContain("Nenhum aluno ativo para analisar");
    expect(html).toContain("Nenhuma disciplina cadastrada");
  });
});
