import { eq, inArray } from "drizzle-orm";

import { sumCorrectPoints } from "@/lib/scoring";
import { db } from "@/server/db/client";
import {
  examAnswers,
  examAttempts,
  examOptions,
  examQuestions,
  exams,
  grades,
} from "@/server/db/schema";

/**
 * Soma os pontos das respostas corretas de uma tentativa (via
 * `sumCorrectPoints`, `src/lib/scoring.ts`), grava o resultado e escreve a
 * nota em `grades` — mesmo alvo de conflito que `setGradeFn` já usa hoje,
 * por isso a nota aparece sozinha na aba Notas existente. Idempotente: se a
 * tentativa já foi enviada, não recalcula nada.
 */
export async function finalizeExamAttempt(
  attemptId: string,
  options: { autoSubmitted: boolean },
): Promise<void> {
  const [attempt] = await db
    .select()
    .from(examAttempts)
    .where(eq(examAttempts.id, attemptId))
    .limit(1);
  if (!attempt || attempt.submittedAt) return;

  const [exam] = await db.select().from(exams).where(eq(exams.id, attempt.examId)).limit(1);
  if (!exam) return;

  const [answerRows, questionRows] = await Promise.all([
    db
      .select({ optionId: examAnswers.optionId })
      .from(examAnswers)
      .where(eq(examAnswers.attemptId, attemptId)),
    db
      .select({ id: examQuestions.id, points: examQuestions.points })
      .from(examQuestions)
      .where(eq(examQuestions.examId, exam.id)),
  ]);
  const selectedOptionIds = answerRows
    .map((a) => a.optionId)
    .filter((id): id is string => id !== null);
  const questionIds = questionRows.map((q) => q.id);

  const optionRows =
    questionIds.length === 0
      ? []
      : await db
          .select({
            id: examOptions.id,
            questionId: examOptions.questionId,
            isCorrect: examOptions.isCorrect,
          })
          .from(examOptions)
          .where(inArray(examOptions.questionId, questionIds));

  const score = sumCorrectPoints(
    selectedOptionIds,
    optionRows,
    questionRows.map((q) => ({ id: q.id, points: Number(q.points) })),
  );

  await db
    .update(examAttempts)
    .set({ submittedAt: new Date(), score: String(score), autoSubmitted: options.autoSubmitted })
    .where(eq(examAttempts.id, attemptId));

  await db
    .insert(grades)
    .values({ assessmentId: exam.assessmentId, studentId: attempt.studentId, score: String(score) })
    .onConflictDoUpdate({
      target: [grades.assessmentId, grades.studentId],
      set: { score: String(score), updatedAt: new Date() },
    });
}
