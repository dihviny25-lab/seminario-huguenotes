import { createServerFn } from "@tanstack/react-start";
import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { requireOwnDiscipline } from "@/server/auth/guard";
import { attendance, lessons, students } from "@/server/db/schema";
import { db } from "@/server/db/client";

const disciplineIdSchema = z.object({ disciplineId: z.string().uuid() });

export type AttendanceBoard = {
  students: Array<{ id: string; name: string }>;
  lessons: Array<{ id: string; date: string | null; sequence: number }>;
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
        .select({ id: lessons.id, date: lessons.date, sequence: lessons.sequence })
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
