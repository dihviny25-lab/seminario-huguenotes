import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";

import { effectiveTeacherId, isFutureOrToday } from "@/lib/teachingAssignments";
import { logAudit } from "@/server/audit";
import { requireAdminId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { disciplines, lessons, teachers } from "@/server/db/schema";

const nullableTeacherId = z.string().uuid().nullable();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.");

function ensureFutureDate(date: string) {
  if (!isFutureOrToday(date))
    throw new Error("A aula deve ser planejada para hoje ou uma data futura.");
}

async function findTeacher(teacherId: string | null) {
  if (teacherId === null) return null;
  const [teacher] = await db
    .select({ id: teachers.id, name: teachers.name })
    .from(teachers)
    .where(eq(teachers.id, teacherId))
    .limit(1);
  if (!teacher) throw new Error("Professor não encontrado.");
  return teacher;
}

async function findDiscipline(disciplineId: string) {
  const [discipline] = await db
    .select({ id: disciplines.id, name: disciplines.discipline, teacherId: disciplines.teacherId })
    .from(disciplines)
    .where(eq(disciplines.id, disciplineId))
    .limit(1);
  if (!discipline) throw new Error("Disciplina não encontrada.");
  return discipline;
}

async function findEditableLesson(lessonId: string) {
  const [lesson] = await db
    .select({
      id: lessons.id,
      disciplineId: lessons.disciplineId,
      date: lessons.date,
      sequence: lessons.sequence,
      teacherId: lessons.teacherId,
      givenAt: lessons.givenAt,
    })
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!lesson) throw new Error("Aula não encontrada.");
  if (lesson.givenAt !== null) throw new Error("Uma aula já ministrada não pode ser alterada.");
  return lesson;
}

export type TeachingAssignments = {
  teachers: Array<{ id: string; name: string }>;
  disciplines: Array<{
    id: string;
    semester: number;
    term: string;
    module: string;
    discipline: string;
    teacherId: string | null;
    teacherName: string | null;
    lessons: Array<{
      id: string;
      date: string | null;
      sequence: number;
      teacherId: string | null;
      teacherName: string | null;
      effectiveTeacherId: string | null;
      effectiveTeacherName: string | null;
      givenAt: string | null;
    }>;
  }>;
};

/** Visão administrativa completa, incluindo herança do professor padrão. */
export const listTeachingAssignmentsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<TeachingAssignments> => {
    await requireAdminId();
    const [teacherRows, disciplineRows, lessonRows] = await Promise.all([
      db
        .select({ id: teachers.id, name: teachers.name })
        .from(teachers)
        .orderBy(asc(teachers.name)),
      db
        .select({
          id: disciplines.id,
          semester: disciplines.semester,
          term: disciplines.term,
          module: disciplines.module,
          discipline: disciplines.discipline,
          teacherId: disciplines.teacherId,
        })
        .from(disciplines)
        .orderBy(asc(disciplines.sortOrder)),
      db
        .select({
          id: lessons.id,
          disciplineId: lessons.disciplineId,
          date: lessons.date,
          sequence: lessons.sequence,
          teacherId: lessons.teacherId,
          givenAt: lessons.givenAt,
        })
        .from(lessons)
        .orderBy(asc(lessons.sequence)),
    ]);

    const teacherNames = new Map(teacherRows.map((teacher) => [teacher.id, teacher.name]));
    return {
      teachers: teacherRows,
      disciplines: disciplineRows.map((discipline) => ({
        ...discipline,
        teacherName: discipline.teacherId ? (teacherNames.get(discipline.teacherId) ?? null) : null,
        lessons: lessonRows
          .filter((lesson) => lesson.disciplineId === discipline.id)
          .map((lesson) => {
            const resolvedTeacherId = effectiveTeacherId(lesson.teacherId, discipline.teacherId);
            return {
              id: lesson.id,
              date: lesson.date,
              sequence: lesson.sequence,
              teacherId: lesson.teacherId,
              teacherName: lesson.teacherId ? (teacherNames.get(lesson.teacherId) ?? null) : null,
              effectiveTeacherId: resolvedTeacherId,
              effectiveTeacherName: resolvedTeacherId
                ? (teacherNames.get(resolvedTeacherId) ?? null)
                : null,
              givenAt: lesson.givenAt?.toISOString() ?? null,
            };
          }),
      })),
    };
  },
);

export const updateDisciplineTeacherFn = createServerFn({ method: "POST" })
  .validator(z.object({ disciplineId: z.string().uuid(), teacherId: nullableTeacherId }))
  .handler(async ({ data }) => {
    await requireAdminId();
    const [discipline, teacher] = await Promise.all([
      findDiscipline(data.disciplineId),
      findTeacher(data.teacherId),
    ]);
    if (discipline.teacherId === data.teacherId) return;
    const previousTeacher = await findTeacher(discipline.teacherId);
    await db.transaction(async (tx) => {
      // Uma troca do padrão não pode reescrever implicitamente o professor
      // efetivo de aulas já ministradas. Congela nelas o padrão anterior.
      if (discipline.teacherId !== null) {
        await tx
          .update(lessons)
          .set({ teacherId: discipline.teacherId })
          .where(
            and(
              eq(lessons.disciplineId, data.disciplineId),
              isNotNull(lessons.givenAt),
              isNull(lessons.teacherId),
            ),
          );
      }
      await tx
        .update(disciplines)
        .set({ teacherId: data.teacherId })
        .where(eq(disciplines.id, data.disciplineId));
    });
    await logAudit(
      "disciplina.professor_alterado",
      `Alterou o professor padrão de ${discipline.name}: ${previousTeacher?.name ?? "não atribuído"} → ${teacher?.name ?? "não atribuído"}.`,
    );
  });

export const createPlannedLessonFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      disciplineId: z.string().uuid(),
      date: isoDate,
      teacherId: nullableTeacherId.optional().default(null),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdminId();
    ensureFutureDate(data.date);
    const [discipline] = await Promise.all([
      findDiscipline(data.disciplineId),
      findTeacher(data.teacherId),
    ]);
    const existing = await db
      .select({ sequence: lessons.sequence })
      .from(lessons)
      .where(eq(lessons.disciplineId, data.disciplineId));
    const sequence = existing.reduce((max, lesson) => Math.max(max, lesson.sequence), 0) + 1;
    const [lesson] = await db
      .insert(lessons)
      .values({
        disciplineId: data.disciplineId,
        date: data.date,
        sequence,
        teacherId: data.teacherId,
      })
      .returning({ id: lessons.id, sequence: lessons.sequence });
    await logAudit("aula.planejar", `Planejou a aula ${sequence} de ${discipline.name}.`);
    return lesson;
  });

export const updatePlannedLessonFn = createServerFn({ method: "POST" })
  .validator(z.object({ lessonId: z.string().uuid(), date: isoDate }))
  .handler(async ({ data }) => {
    await requireAdminId();
    ensureFutureDate(data.date);
    const lesson = await findEditableLesson(data.lessonId);
    if (lesson.date === data.date) return;
    await db.update(lessons).set({ date: data.date }).where(eq(lessons.id, data.lessonId));
    await logAudit(
      "aula.reagendar",
      `Reagendou a aula ${lesson.sequence} de ${lesson.date ?? "sem data"} para ${data.date}.`,
    );
  });

export const setLessonTeacherFn = createServerFn({ method: "POST" })
  .validator(z.object({ lessonId: z.string().uuid(), teacherId: nullableTeacherId }))
  .handler(async ({ data }) => {
    await requireAdminId();
    const [lesson, teacher] = await Promise.all([
      findEditableLesson(data.lessonId),
      findTeacher(data.teacherId),
    ]);
    if (lesson.teacherId === data.teacherId) return;
    const previousTeacher = await findTeacher(lesson.teacherId);
    await db
      .update(lessons)
      .set({ teacherId: data.teacherId })
      .where(eq(lessons.id, data.lessonId));
    const discipline = await findDiscipline(lesson.disciplineId);
    await logAudit(
      data.teacherId === null ? "aula.professor_restaurado" : "aula.professor_atribuido",
      data.teacherId === null
        ? `Restaurou o professor padrão na aula ${lesson.sequence} de ${discipline.name} (antes: ${previousTeacher?.name ?? "não atribuído"}).`
        : `Alterou o professor da aula ${lesson.sequence} de ${discipline.name}: ${previousTeacher?.name ?? "padrão da disciplina"} → ${teacher?.name}.`,
    );
  });
