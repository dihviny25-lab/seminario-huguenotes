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

  it("permite material/livro/slide/vídeo a qualquer aluno logado (sem restrição)", () => {
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

  it("permite material/slide/vídeo sem aula vinculada mesmo pra aluno de matrícula seletiva", () => {
    for (const ownerType of ["reading_material", "presentation_slide", "video_lesson"] as const) {
      expect(
        canReadFileRecord(
          { ownerType, lessonId: null, accessibleLessonIds: new Set(["lesson-a"]) },
          { role: "student", id: "student-a", name: "A" },
        ),
      ).toBe(true);
    }
  });

  it("permite material/slide/vídeo vinculado a uma aula liberada pro aluno restrito", () => {
    for (const ownerType of ["reading_material", "presentation_slide", "video_lesson"] as const) {
      expect(
        canReadFileRecord(
          { ownerType, lessonId: "lesson-a", accessibleLessonIds: new Set(["lesson-a"]) },
          { role: "student", id: "student-a", name: "A" },
        ),
      ).toBe(true);
    }
  });

  it("nega material/slide/vídeo vinculado a uma aula não liberada pro aluno restrito", () => {
    for (const ownerType of ["reading_material", "presentation_slide", "video_lesson"] as const) {
      expect(
        canReadFileRecord(
          { ownerType, lessonId: "lesson-b", accessibleLessonIds: new Set(["lesson-a"]) },
          { role: "student", id: "student-a", name: "A" },
        ),
      ).toBe(false);
    }
  });

  it("libera material/slide/vídeo restrito pro professor mesmo sem acesso liberado", () => {
    expect(
      canReadFileRecord(
        { ownerType: "video_lesson", lessonId: "lesson-b", accessibleLessonIds: new Set() },
        { role: "teacher", id: "teacher-a", name: "Prof" },
      ),
    ).toBe(true);
  });
});
