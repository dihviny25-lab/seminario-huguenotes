import { describe, expect, it } from "vitest";

import type { Discipline } from "@/types/schedule";
import {
  compareChronologically,
  getScheduleStatistics,
  getTeacherSummaries,
  groupBySemester,
  semesterLabel,
} from "@/lib/schedule-utils";

function makeDiscipline(
  overrides: Partial<Discipline> &
    Pick<Discipline, "id" | "semester" | "term" | "module" | "discipline" | "status">,
): Discipline {
  return overrides;
}

describe("semesterLabel", () => {
  it("formats the semester number as an ordinal label", () => {
    expect(semesterLabel(1)).toBe("1º Semestre");
    expect(semesterLabel(5)).toBe("5º Semestre");
  });
});

describe("groupBySemester", () => {
  const fixture: Discipline[] = [
    makeDiscipline({
      id: "a",
      semester: 1,
      term: "2026",
      module: "Módulo 1",
      discipline: "A",
      teacher: "Ana",
      lessons: 4,
      status: "confirmed",
    }),
    makeDiscipline({
      id: "b",
      semester: 1,
      term: "2026",
      module: "Módulo 1",
      discipline: "B",
      teacher: "Beto",
      lessons: 3,
      status: "pending",
    }),
    makeDiscipline({
      id: "c",
      semester: 2,
      term: "2027",
      module: "Módulo 2",
      discipline: "C",
      teacher: "Ana",
      lessons: 5,
      status: "pending",
    }),
  ];

  it("groups disciplines into semesters and modules, preserving declaration order", () => {
    const groups = groupBySemester(fixture);

    expect(groups.map((g) => g.semester)).toEqual([1, 2]);
    expect(groups[0].modules.map((m) => m.module)).toEqual(["Módulo 1"]);
    expect(groups[0].modules[0].disciplines.map((d) => d.id)).toEqual(["a", "b"]);
  });

  it("sums lessons at the module and semester level", () => {
    const groups = groupBySemester(fixture);

    expect(groups[0].modules[0].totalLessons).toBe(7);
    expect(groups[0].totalLessons).toBe(7);
    expect(groups[0].totalDisciplines).toBe(2);
    expect(groups[1].totalLessons).toBe(5);
  });

  it("marks a module as confirmed when at least one of its disciplines is confirmed", () => {
    const groups = groupBySemester(fixture);

    expect(groups[0].modules[0].status).toBe("confirmed");
  });

  it("sorts semesters ascending regardless of input order", () => {
    const reversed = [...fixture].reverse();
    const groups = groupBySemester(reversed);

    expect(groups.map((g) => g.semester)).toEqual([1, 2]);
  });
});

describe("getScheduleStatistics", () => {
  const fixture: Discipline[] = [
    makeDiscipline({
      id: "a",
      semester: 1,
      term: "2026",
      module: "Módulo 1",
      discipline: "A",
      teacher: "Ana",
      lessons: 4,
      status: "confirmed",
    }),
    makeDiscipline({
      id: "b",
      semester: 1,
      term: "2026",
      module: "Módulo 1",
      discipline: "B",
      teacher: "Beto",
      lessons: 3,
      status: "pending",
    }),
    makeDiscipline({
      id: "c",
      semester: 2,
      term: "2027",
      module: "Módulo 2",
      discipline: "C",
      status: "pending",
    }),
  ];

  it("counts distinct semesters, modules and teachers, and sums lessons", () => {
    const stats = getScheduleStatistics(fixture);

    expect(stats.semesters).toBe(2);
    expect(stats.modules).toBe(2);
    expect(stats.disciplines).toBe(3);
    expect(stats.teachers).toBe(2);
    expect(stats.lessons).toBe(7);
  });

  it("treats disciplines without a teacher or lessons as zero, not an error", () => {
    const stats = getScheduleStatistics([
      makeDiscipline({
        id: "x",
        semester: 1,
        term: "2026",
        module: "Módulo 1",
        discipline: "X",
        status: "pending",
      }),
    ]);

    expect(stats.teachers).toBe(0);
    expect(stats.lessons).toBe(0);
  });

  it("disambiguates same-named modules across different semesters", () => {
    const stats = getScheduleStatistics([
      makeDiscipline({
        id: "a",
        semester: 1,
        term: "2026",
        module: "Complementar",
        discipline: "A",
        status: "pending",
      }),
      makeDiscipline({
        id: "b",
        semester: 2,
        term: "2027",
        module: "Complementar",
        discipline: "B",
        status: "pending",
      }),
    ]);

    expect(stats.modules).toBe(2);
  });
});

describe("getTeacherSummaries", () => {
  const fixture: Discipline[] = [
    makeDiscipline({
      id: "a",
      semester: 1,
      term: "2026",
      module: "Módulo 1",
      discipline: "A",
      teacher: "Ana",
      lessons: 4,
      startDate: "2026-09-14",
      status: "confirmed",
    }),
    makeDiscipline({
      id: "b",
      semester: 1,
      term: "2026",
      module: "Módulo 1",
      discipline: "B",
      teacher: "Beto",
      lessons: 8,
      startDate: "2026-08-01",
      status: "confirmed",
    }),
    makeDiscipline({
      id: "c",
      semester: 2,
      term: "2027",
      module: "Módulo 2",
      discipline: "C",
      teacher: "Ana",
      lessons: 5,
      startDate: "2027-03-01",
      status: "pending",
    }),
    makeDiscipline({
      id: "d",
      semester: 3,
      term: "2027",
      module: "Módulo 3",
      discipline: "D",
      status: "pending",
    }),
  ];

  it("ignores disciplines with no teacher assigned", () => {
    const summaries = getTeacherSummaries(fixture);

    expect(summaries.map((t) => t.name)).not.toContain(undefined);
    expect(summaries.every((t) => t.name)).toBe(true);
  });

  it("aggregates lessons, discipline count and distinct semesters per teacher", () => {
    const summaries = getTeacherSummaries(fixture);
    const ana = summaries.find((t) => t.name === "Ana")!;

    expect(ana.totalLessons).toBe(9);
    expect(ana.totalDisciplines).toBe(2);
    expect(ana.semesters).toEqual([1, 2]);
  });

  it("orders teachers by total lessons descending, then by name", () => {
    const summaries = getTeacherSummaries(fixture);

    // Ana: 4 (a) + 5 (c) = 9 lessons; Beto: 8 (b) lessons.
    expect(summaries.map((t) => t.name)).toEqual(["Ana", "Beto"]);
  });

  it("orders each teacher's own disciplines chronologically by start date", () => {
    const summaries = getTeacherSummaries(fixture);
    const ana = summaries.find((t) => t.name === "Ana")!;

    expect(ana.disciplines.map((d) => d.id)).toEqual(["a", "c"]);
  });
});

describe("compareChronologically", () => {
  it("orders two dated disciplines by their start date", () => {
    const earlier = makeDiscipline({
      id: "a",
      semester: 1,
      term: "2026",
      module: "M",
      discipline: "A",
      startDate: "2026-01-01",
      status: "confirmed",
    });
    const later = makeDiscipline({
      id: "b",
      semester: 1,
      term: "2026",
      module: "M",
      discipline: "B",
      startDate: "2026-06-01",
      status: "confirmed",
    });

    expect(compareChronologically(earlier, later)).toBeLessThan(0);
    expect(compareChronologically(later, earlier)).toBeGreaterThan(0);
  });

  it("puts a dated discipline before an undated one", () => {
    const dated = makeDiscipline({
      id: "a",
      semester: 1,
      term: "2026",
      module: "M",
      discipline: "A",
      startDate: "2026-01-01",
      status: "confirmed",
    });
    const undated = makeDiscipline({
      id: "b",
      semester: 2,
      term: "2027",
      module: "M",
      discipline: "B",
      status: "pending",
    });

    expect(compareChronologically(dated, undated)).toBeLessThan(0);
    expect(compareChronologically(undated, dated)).toBeGreaterThan(0);
  });

  it("treats two undated disciplines in the same semester as equal (no tie-break)", () => {
    // Sem data e mesmo semestre, a ordem de exibição já vem do `source`
    // (ordenado por sortOrder no banco) — compareChronologically só precisa
    // não desfazer essa ordem, então retorna 0 (sort estável preserva).
    const a = makeDiscipline({
      id: "a",
      semester: 2,
      term: "2027",
      module: "M",
      discipline: "A",
      status: "pending",
    });
    const b = makeDiscipline({
      id: "b",
      semester: 2,
      term: "2027",
      module: "M",
      discipline: "B",
      status: "pending",
    });

    expect(compareChronologically(a, b)).toBe(0);
    expect(compareChronologically(b, a)).toBe(0);
  });
});
