import { describe, expect, it } from "vitest";

import { canReadFileRecord } from "./access";

describe("canReadFileRecord", () => {
  const assignment = { ownerType: "assignment_submission" as const, studentId: "student-a" };

  it("permite a entrega ao próprio aluno", () => {
    expect(canReadFileRecord(assignment, { role: "student", id: "student-a", name: "A" })).toBe(
      true,
    );
  });

  it("nega a entrega a outro aluno", () => {
    expect(canReadFileRecord(assignment, { role: "student", id: "student-b", name: "B" })).toBe(
      false,
    );
  });

  it("permite a entrega a qualquer professor", () => {
    expect(canReadFileRecord(assignment, { role: "teacher", id: "teacher-a", name: "Prof" })).toBe(
      true,
    );
  });

  it("permite material/livro/slide/vídeo a qualquer aluno logado", () => {
    for (const ownerType of [
      "reading_material",
      "library_book",
      "presentation_slide",
      "video_lesson",
    ] as const) {
      expect(
        canReadFileRecord({ ownerType }, { role: "student", id: "student-a", name: "A" }),
      ).toBe(true);
    }
  });
});
