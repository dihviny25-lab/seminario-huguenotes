import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AtRiskStudentItem } from "@/lib/teacherDashboard";
import { AtRiskStudentDetails } from "./AtRiskStudentDetails";

const student: AtRiskStudentItem = {
  studentId: "s1",
  studentName: "Ana",
  disciplines: [
    {
      disciplineId: "d1",
      disciplineName: "Teologia",
      teacherName: "Professor João",
      reason: "ambos",
      average: 5.75,
      totalLessons: 4,
      totalFaltas: 2,
      attendanceRatio: 0.5,
    },
  ],
};

describe("AtRiskStudentDetails", () => {
  it("explica os dois riscos com valores atuais, mínimos e professor", () => {
    const html = renderToStaticMarkup(<AtRiskStudentDetails student={student} />);
    for (const text of [
      "Teologia",
      "Professor João",
      "Nota e frequência abaixo do mínimo",
      "Média atual: 5,75 · mínimo 7,0",
      "2 faltas em 4 aulas",
      "frequência 50% (mínimo 75%)",
    ]) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain("truncate");
  });

  it("distingue risco por frequência de ausência de notas e usa falta no singular", () => {
    const html = renderToStaticMarkup(
      <AtRiskStudentDetails
        student={{
          ...student,
          disciplines: [
            {
              ...student.disciplines[0],
              reason: "frequencia",
              average: null,
              totalFaltas: 1,
              totalLessons: 3,
              attendanceRatio: 2 / 3,
            },
          ],
        }}
      />,
    );
    expect(html).toContain("Frequência abaixo do mínimo");
    expect(html).toContain("Sem notas lançadas");
    expect(html).toContain("1 falta em 3 aulas");
    expect(html).toContain("66,67%");
    expect(html).not.toContain("Média atual: 0");
  });
});
