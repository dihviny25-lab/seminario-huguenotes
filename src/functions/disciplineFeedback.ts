import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDisciplineCompletion, summarizeDisciplineFeedback } from "@/lib/disciplineFeedback";
import { requireOwnDiscipline, requireStudentId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { disciplineFeedback, disciplines, lessons } from "@/server/db/schema";
import { getStudentAccessibleLessonIds } from "@/server/enrollment";

const disciplineIdSchema = z.object({ disciplineId: z.string().uuid() });

export const disciplineFeedbackSchema = z.object({
  disciplineId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  likedMost: z.string().trim().min(3).max(1000),
  couldImprove: z.string().trim().min(3).max(1000),
  additionalComments: z.string().trim().max(1000).optional(),
});

async function getCompletion(disciplineId: string) {
  const [discipline, lessonRows] = await Promise.all([
    db
      .select({ id: disciplines.id, lessons: disciplines.lessons })
      .from(disciplines)
      .where(eq(disciplines.id, disciplineId))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select({ givenAt: lessons.givenAt })
      .from(lessons)
      .where(eq(lessons.disciplineId, disciplineId)),
  ]);

  if (!discipline) throw new Error("Disciplina não encontrada.");
  return getDisciplineCompletion(discipline.lessons, lessonRows);
}

async function requireStudentDisciplineAccess(studentId: string, disciplineId: string) {
  const accessibleLessonIds = await getStudentAccessibleLessonIds(studentId);
  if (accessibleLessonIds === null) return;

  const lessonRows = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.disciplineId, disciplineId));
  if (!lessonRows.some((lesson) => accessibleLessonIds.has(lesson.id))) {
    throw new Error("Disciplina não encontrada.");
  }
}

export const getMyDisciplineFeedbackFn = createServerFn({ method: "GET" })
  .validator(disciplineIdSchema)
  .handler(async ({ data }) => {
    const studentId = await requireStudentId();
    await requireStudentDisciplineAccess(studentId, data.disciplineId);
    const [completion, feedback] = await Promise.all([
      getCompletion(data.disciplineId),
      db
        .select({
          rating: disciplineFeedback.rating,
          likedMost: disciplineFeedback.likedMost,
          couldImprove: disciplineFeedback.couldImprove,
          additionalComments: disciplineFeedback.additionalComments,
          updatedAt: disciplineFeedback.updatedAt,
        })
        .from(disciplineFeedback)
        .where(
          and(
            eq(disciplineFeedback.disciplineId, data.disciplineId),
            eq(disciplineFeedback.studentId, studentId),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);

    return { completion, feedback };
  });

export const saveMyDisciplineFeedbackFn = createServerFn({ method: "POST" })
  .validator(disciplineFeedbackSchema)
  .handler(async ({ data }) => {
    const studentId = await requireStudentId();
    await requireStudentDisciplineAccess(studentId, data.disciplineId);
    const completion = await getCompletion(data.disciplineId);
    if (!completion.isCompleted) {
      throw new Error("A avaliação será liberada quando a disciplina for encerrada.");
    }

    const additionalComments = data.additionalComments || null;
    const [saved] = await db
      .insert(disciplineFeedback)
      .values({
        disciplineId: data.disciplineId,
        studentId,
        rating: data.rating,
        likedMost: data.likedMost,
        couldImprove: data.couldImprove,
        additionalComments,
      })
      .onConflictDoUpdate({
        target: [disciplineFeedback.disciplineId, disciplineFeedback.studentId],
        set: {
          rating: data.rating,
          likedMost: data.likedMost,
          couldImprove: data.couldImprove,
          additionalComments,
          updatedAt: new Date(),
        },
      })
      .returning({ id: disciplineFeedback.id });

    return saved;
  });

export const getDisciplineFeedbackSummaryFn = createServerFn({ method: "GET" })
  .validator(disciplineIdSchema)
  .handler(async ({ data }) => {
    await requireOwnDiscipline(data.disciplineId);
    const [completion, answers] = await Promise.all([
      getCompletion(data.disciplineId),
      db
        .select({
          rating: disciplineFeedback.rating,
          likedMost: disciplineFeedback.likedMost,
          couldImprove: disciplineFeedback.couldImprove,
          additionalComments: disciplineFeedback.additionalComments,
        })
        .from(disciplineFeedback)
        .where(eq(disciplineFeedback.disciplineId, data.disciplineId))
        .orderBy(asc(disciplineFeedback.createdAt)),
    ]);

    return { completion, ...summarizeDisciplineFeedback(answers) };
  });
