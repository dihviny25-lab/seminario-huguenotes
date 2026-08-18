import { and, eq, inArray } from "drizzle-orm";

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
 * Soma os pontos das respostas corretas de uma tentativa, grava o resultado
 * e escreve a nota em `grades` — mesmo alvo de conflito que `setGradeFn` já
 * usa hoje, por isso a nota aparece sozinha na aba Notas existente.
 * Idempotente: se a tentativa já foi enviada, não recalcula nada.
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

  const answers = await db
    .select({ optionId: examAnswers.optionId })
    .from(examAnswers)
    .where(eq(examAnswers.attemptId, attemptId));
  const selectedOptionIds = answers
    .map((a) => a.optionId)
    .filter((id): id is string => id !== null);

  const correctSelected =
    selectedOptionIds.length === 0
      ? []
      : await db
          .select({ points: examQuestions.points })
          .from(examOptions)
          .innerJoin(examQuestions, eq(examOptions.questionId, examQuestions.id))
          .where(and(inArray(examOptions.id, selectedOptionIds), eq(examOptions.isCorrect, true)));

  const score = correctSelected.reduce((sum, row) => sum + Number(row.points), 0);

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
