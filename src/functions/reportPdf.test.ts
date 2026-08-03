import { describe, expect, it } from "vitest";

import { renderStudentReportPdf, slugify } from "@/functions/reportPdf";
import type { StudentReportRow } from "@/functions/reportData";

const sampleRows: Array<StudentReportRow> = [
  {
    disciplineId: "d1",
    module: "Módulo 2",
    discipline: "Pentateuco",
    semester: 1,
    term: "2026",
    teacherName: "Diego",
    average: 8.5,
    totalLessons: 5,
    totalFaltas: 1,
    attendanceRatio: 0.8,
    assessments: [{ title: "Prova 1", score: 8.5, maxScore: 10, weight: 1 }],
  },
  {
    disciplineId: "d2",
    module: "Módulo 3",
    discipline: "Cristologia",
    semester: 1,
    term: "2026",
    teacherName: "Diego",
    average: null,
    totalLessons: 0,
    totalFaltas: 0,
    attendanceRatio: null,
    assessments: [],
  },
];

describe("renderStudentReportPdf", () => {
  it("produces a valid, non-empty PDF document", async () => {
    const buffer = await renderStudentReportPdf("Aluno de Teste", sampleRows);

    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("still produces a valid PDF when the student has no disciplines yet", async () => {
    const buffer = await renderStudentReportPdf("Aluno Sem Disciplinas", []);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates a name for use in a filename", () => {
    expect(slugify("Maria da Silva")).toBe("maria-da-silva");
  });

  it("strips accents-adjacent punctuation into hyphen separators", () => {
    expect(slugify("José   Núñez!!")).toBe("jos-n-ez");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  Ana  ")).toBe("ana");
  });
});
