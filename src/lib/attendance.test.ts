import { describe, expect, it } from "vitest";

import { countFaltas } from "@/lib/attendance";

describe("countFaltas", () => {
  it("returns 0 when there are no lessons", () => {
    expect(countFaltas([], new Set())).toBe(0);
  });

  it("returns 0 when the student wasn't marked absent in any lesson", () => {
    expect(countFaltas(["l1", "l2", "l3"], new Set())).toBe(0);
  });

  it("counts only the lessons present in the absent set", () => {
    const absent = new Set(["l2"]);
    expect(countFaltas(["l1", "l2", "l3"], absent)).toBe(1);
  });

  it("counts every lesson when the student missed all of them", () => {
    const absent = new Set(["l1", "l2", "l3"]);
    expect(countFaltas(["l1", "l2", "l3"], absent)).toBe(3);
  });

  it("ignores absences that belong to a different discipline's lessons", () => {
    // absentLessonIds pode conter faltas de outras disciplinas — só conta
    // quem também está na lista de aulas passada.
    const absent = new Set(["from-another-discipline"]);
    expect(countFaltas(["l1", "l2"], absent)).toBe(0);
  });
});
