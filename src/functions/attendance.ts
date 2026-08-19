import { createServerFn } from "@tanstack/react-start";
import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { requireOwnDiscipline, requireStudentId } from "@/server/auth/guard";
import { attendance, disciplines, lessons, students } from "@/server/db/schema";
import { db } from "@/server/db/client";

const disciplineIdSchema = z.object({ disciplineId: z.string().uuid() });

export type AttendanceBoard = {
  students: Array<{ id: string; name: string }>;
  lessons: Array<{
    id: string;
    date: string | null;
    sequence: number;
    checkInOpen: boolean;
    checkInToken: string | null;
  }>;
  attendance: Array<{ lessonId: string; studentId: string; present: boolean }>;
};

/** Alunos ativos, aulas e presenças já lançadas — tudo que a grade precisa. */
export const getAttendanceBoardFn = createServerFn({ method: "GET" })
  .validator(disciplineIdSchema)
  .handler(async ({ data }): Promise<AttendanceBoard> => {
    await requireOwnDiscipline(data.disciplineId);

    const [studentRows, lessonRows] = await Promise.all([
      db
        .select({ id: students.id, name: students.name })
        .from(students)
        .where(eq(students.active, true))
        .orderBy(asc(students.name)),
      db
        .select({
          id: lessons.id,
          date: lessons.date,
          sequence: lessons.sequence,
          checkInOpen: lessons.checkInOpen,
          checkInToken: lessons.checkInToken,
        })
        .from(lessons)
        .where(eq(lessons.disciplineId, data.disciplineId))
        .orderBy(asc(lessons.sequence)),
    ]);

    const lessonIds = lessonRows.map((l) => l.id);
    const attendanceRows =
      lessonIds.length === 0
        ? []
        : await db
            .select({
              lessonId: attendance.lessonId,
              studentId: attendance.studentId,
              present: attendance.present,
            })
            .from(attendance)
            .where(inArray(attendance.lessonId, lessonIds));

    return { students: studentRows, lessons: lessonRows, attendance: attendanceRows };
  });

const createLessonSchema = z.object({
  disciplineId: z.string().uuid(),
  date: z.string().optional(),
});

export const createLessonFn = createServerFn({ method: "POST" })
  .validator(createLessonSchema)
  .handler(async ({ data }) => {
    await requireOwnDiscipline(data.disciplineId);
    const existing = await db
      .select({ sequence: lessons.sequence })
      .from(lessons)
      .where(eq(lessons.disciplineId, data.disciplineId));
    const nextSequence = existing.reduce((max, l) => Math.max(max, l.sequence), 0) + 1;

    const [row] = await db
      .insert(lessons)
      .values({ disciplineId: data.disciplineId, date: data.date, sequence: nextSequence })
      .returning({ id: lessons.id });
    return row;
  });

const deleteLessonSchema = z.object({
  disciplineId: z.string().uuid(),
  lessonId: z.string().uuid(),
});

export const deleteLessonFn = createServerFn({ method: "POST" })
  .validator(deleteLessonSchema)
  .handler(async ({ data }) => {
    await requireOwnDiscipline(data.disciplineId);
    await db.delete(lessons).where(eq(lessons.id, data.lessonId));
  });

const setAttendanceSchema = z.object({
  disciplineId: z.string().uuid(),
  lessonId: z.string().uuid(),
  studentId: z.string().uuid(),
  present: z.boolean(),
});

export const setAttendanceFn = createServerFn({ method: "POST" })
  .validator(setAttendanceSchema)
  .handler(async ({ data }) => {
    await requireOwnDiscipline(data.disciplineId);
    await db
      .insert(attendance)
      .values({ lessonId: data.lessonId, studentId: data.studentId, present: data.present })
      .onConflictDoUpdate({
        target: [attendance.lessonId, attendance.studentId],
        set: { present: data.present, updatedAt: new Date() },
      });
  });

const setLessonAttendanceAllSchema = z.object({
  disciplineId: z.string().uuid(),
  lessonId: z.string().uuid(),
  present: z.boolean(),
});

/** Marca presença/falta de todos os alunos ativos numa aula de uma vez ("marcar todos"/"desmarcar todos"). */
export const setLessonAttendanceAllFn = createServerFn({ method: "POST" })
  .validator(setLessonAttendanceAllSchema)
  .handler(async ({ data }) => {
    await requireOwnDiscipline(data.disciplineId);
    const activeStudents = await db
      .select({ id: students.id })
      .from(students)
      .where(eq(students.active, true));

    // Cada aluno é uma linha independente (sem dependência de ordem entre elas),
    // então roda em paralelo — sequencial aqui deixaria "marcar todos" visivelmente lento.
    await Promise.all(
      activeStudents.map((student) =>
        db
          .insert(attendance)
          .values({ lessonId: data.lessonId, studentId: student.id, present: data.present })
          .onConflictDoUpdate({
            target: [attendance.lessonId, attendance.studentId],
            set: { present: data.present, updatedAt: new Date() },
          }),
      ),
    );
  });

const lessonCheckInSchema = z.object({
  disciplineId: z.string().uuid(),
  lessonId: z.string().uuid(),
});

/** Abre a chamada por QR code pra uma aula — gera um token novo e aceita check-ins até ser encerrada. */
export const openLessonCheckInFn = createServerFn({ method: "POST" })
  .validator(lessonCheckInSchema)
  .handler(async ({ data }): Promise<{ token: string }> => {
    await requireOwnDiscipline(data.disciplineId);
    const token = crypto.randomUUID();
    await db
      .update(lessons)
      .set({ checkInOpen: true, checkInToken: token })
      .where(eq(lessons.id, data.lessonId));
    return { token };
  });

export const closeLessonCheckInFn = createServerFn({ method: "POST" })
  .validator(lessonCheckInSchema)
  .handler(async ({ data }) => {
    await requireOwnDiscipline(data.disciplineId);
    await db
      .update(lessons)
      .set({ checkInOpen: false, checkInToken: null })
      .where(eq(lessons.id, data.lessonId));
  });

const checkInSchema = z.object({
  lessonId: z.string().uuid(),
  token: z.string().min(1),
});

export type CheckInResult = { disciplineName: string; lessonLabel: string };

/** O próprio aluno confirma presença escaneando o QR — marca só a presença dele mesmo. */
export const checkInFn = createServerFn({ method: "POST" })
  .validator(checkInSchema)
  .handler(async ({ data }): Promise<CheckInResult> => {
    const studentId = await requireStudentId();

    const [row] = await db
      .select({
        checkInOpen: lessons.checkInOpen,
        checkInToken: lessons.checkInToken,
        sequence: lessons.sequence,
        disciplineName: disciplines.discipline,
      })
      .from(lessons)
      .innerJoin(disciplines, eq(lessons.disciplineId, disciplines.id))
      .where(eq(lessons.id, data.lessonId))
      .limit(1);

    if (!row || !row.checkInOpen || row.checkInToken !== data.token) {
      throw new Error("Chamada não está aberta ou QR code inválido.");
    }

    await db
      .insert(attendance)
      .values({ lessonId: data.lessonId, studentId, present: true })
      .onConflictDoUpdate({
        target: [attendance.lessonId, attendance.studentId],
        set: { present: true, updatedAt: new Date() },
      });

    return { disciplineName: row.disciplineName, lessonLabel: `Aula ${row.sequence}` };
  });
