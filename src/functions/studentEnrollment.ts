import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import { requireAdminId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { disciplines, lessons, students, studentLessonAccess } from "@/server/db/schema";

const studentIdSchema = z.object({ studentId: z.string().uuid() });

export type StudentLessonAccessDiscipline = {
  id: string;
  discipline: string;
  semester: number;
  term: string;
  lessons: Array<{ id: string; sequence: number; date: string | null; granted: boolean }>;
};

export type StudentEnrollment = {
  selectiveEnrollment: boolean;
  disciplines: Array<StudentLessonAccessDiscipline>;
};

/** Matrícula seletiva do aluno + todo o currículo, marcando quais aulas já estão liberadas. */
export const getStudentEnrollmentFn = createServerFn({ method: "GET" })
  .validator(studentIdSchema)
  .handler(async ({ data }): Promise<StudentEnrollment> => {
    await requireAdminId();

    const [student] = await db
      .select({ selectiveEnrollment: students.selectiveEnrollment })
      .from(students)
      .where(eq(students.id, data.studentId))
      .limit(1);
    if (!student) throw new Error("Aluno não encontrado.");

    const [disciplineRows, lessonRows, grantedRows] = await Promise.all([
      db
        .select({
          id: disciplines.id,
          discipline: disciplines.discipline,
          semester: disciplines.semester,
          term: disciplines.term,
        })
        .from(disciplines)
        .orderBy(asc(disciplines.sortOrder)),
      db
        .select({
          id: lessons.id,
          disciplineId: lessons.disciplineId,
          sequence: lessons.sequence,
          date: lessons.date,
        })
        .from(lessons)
        .orderBy(asc(lessons.sequence)),
      db
        .select({ lessonId: studentLessonAccess.lessonId })
        .from(studentLessonAccess)
        .where(eq(studentLessonAccess.studentId, data.studentId)),
    ]);

    const grantedSet = new Set(grantedRows.map((r) => r.lessonId));

    return {
      selectiveEnrollment: student.selectiveEnrollment,
      disciplines: disciplineRows
        .map((discipline) => ({
          ...discipline,
          lessons: lessonRows
            .filter((l) => l.disciplineId === discipline.id)
            .map((l) => ({
              id: l.id,
              sequence: l.sequence,
              date: l.date,
              granted: grantedSet.has(l.id),
            })),
        }))
        .filter((discipline) => discipline.lessons.length > 0),
    };
  });

const setSelectiveSchema = z.object({ studentId: z.string().uuid(), enabled: z.boolean() });

/** Liga/desliga a matrícula seletiva. Desligar não apaga as aulas já atribuídas (fica pronto se religar). */
export const setSelectiveEnrollmentFn = createServerFn({ method: "POST" })
  .validator(setSelectiveSchema)
  .handler(async ({ data }) => {
    await requireAdminId();
    const [student] = await db
      .select({ name: students.name })
      .from(students)
      .where(eq(students.id, data.studentId))
      .limit(1);
    if (!student) throw new Error("Aluno não encontrado.");

    await db
      .update(students)
      .set({ selectiveEnrollment: data.enabled })
      .where(eq(students.id, data.studentId));
    await logAudit(
      "aluno.matricula_seletiva",
      `${data.enabled ? "Ativou" : "Desativou"} a matrícula seletiva de ${student.name}.`,
    );
  });

const setLessonAccessSchema = z.object({
  studentId: z.string().uuid(),
  lessonId: z.string().uuid(),
  granted: z.boolean(),
});

/** Libera/revoga uma aula específica — chamado aula a aula, conforme o curso anda. */
export const setStudentLessonAccessFn = createServerFn({ method: "POST" })
  .validator(setLessonAccessSchema)
  .handler(async ({ data }) => {
    await requireAdminId();

    if (data.granted) {
      await db
        .insert(studentLessonAccess)
        .values({ studentId: data.studentId, lessonId: data.lessonId })
        .onConflictDoNothing();
    } else {
      await db
        .delete(studentLessonAccess)
        .where(
          and(
            eq(studentLessonAccess.studentId, data.studentId),
            eq(studentLessonAccess.lessonId, data.lessonId),
          ),
        );
    }
  });
