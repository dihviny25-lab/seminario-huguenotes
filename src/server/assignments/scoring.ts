import { eq, inArray } from "drizzle-orm";

import { sumCorrectPoints } from "@/lib/scoring";
import { db } from "@/server/db/client";
import {
  assignmentAnswers,
  assignmentOptions,
  assignmentQuestions,
  assignments,
  assignmentSubmissions,
  grades,
} from "@/server/db/schema";

/**
 * Corrige automaticamente uma entrega de tarefa objetiva: soma os pontos das
 * respostas certas com `sumCorrectPoints` (mesma função pura da correção de
 * provas), marca `gradedAt` na própria entrega e faz o upsert em `grades`
 * pelo `assignments.assessmentId` — o mesmo caminho que `gradeSubmissionFn`
 * usa na correção manual de tarefa aberta. Idempotente: se a entrega já foi
 * corrigida, não recalcula.
 */
export async function finalizeAssignmentSubmission(submissionId: string): Promise<void> {
  const [submission] = await db
    .select()
    .from(assignmentSubmissions)
    .where(eq(assignmentSubmissions.id, submissionId))
    .limit(1);
  if (!submission || submission.gradedAt) return;

  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, submission.assignmentId))
    .limit(1);
  if (!assignment) return;

  const [answerRows, questionRows] = await Promise.all([
    db
      .select({ optionId: assignmentAnswers.optionId })
      .from(assignmentAnswers)
      .where(eq(assignmentAnswers.submissionId, submissionId)),
    db
      .select({ id: assignmentQuestions.id, points: assignmentQuestions.points })
      .from(assignmentQuestions)
      .where(eq(assignmentQuestions.assignmentId, assignment.id)),
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
            id: assignmentOptions.id,
            questionId: assignmentOptions.questionId,
            isCorrect: assignmentOptions.isCorrect,
          })
          .from(assignmentOptions)
          .where(inArray(assignmentOptions.questionId, questionIds));

  const score = sumCorrectPoints(
    selectedOptionIds,
    optionRows,
    questionRows.map((q) => ({ id: q.id, points: Number(q.points) })),
  );

  await db
    .update(assignmentSubmissions)
    .set({ gradedAt: new Date() })
    .where(eq(assignmentSubmissions.id, submissionId));

  await db
    .insert(grades)
    .values({
      assessmentId: assignment.assessmentId,
      studentId: submission.studentId,
      score: String(score),
    })
    .onConflictDoUpdate({
      target: [grades.assessmentId, grades.studentId],
      set: { score: String(score), updatedAt: new Date() },
    });
}
