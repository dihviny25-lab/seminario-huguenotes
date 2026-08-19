import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { requireStudentId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import {
  assessments,
  assignments,
  assignmentSubmissions,
  disciplines,
  grades,
} from "@/server/db/schema";

export type AvailableAssignment = {
  id: string;
  disciplineName: string;
  title: string;
  instructions: string | null;
  dueAt: string | null;
  status: "pending" | "submitted" | "graded";
  score: string | null;
  maxScore: string;
};

/** Todas as tarefas (de qualquer disciplina) + status da entrega do próprio aluno. */
export const listAvailableAssignmentsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<AvailableAssignment>> => {
    const studentId = await requireStudentId();

    const rows = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        instructions: assignments.instructions,
        dueAt: assignments.dueAt,
        assessmentId: assignments.assessmentId,
        disciplineName: disciplines.discipline,
        maxScore: assessments.maxScore,
      })
      .from(assignments)
      .innerJoin(disciplines, eq(assignments.disciplineId, disciplines.id))
      .innerJoin(assessments, eq(assignments.assessmentId, assessments.id))
      .orderBy(asc(assignments.createdAt));

    const ids = rows.map((r) => r.id);
    const [submissionRows, gradeRows] = await Promise.all([
      ids.length === 0
        ? []
        : db
            .select()
            .from(assignmentSubmissions)
            .where(
              and(
                inArray(assignmentSubmissions.assignmentId, ids),
                eq(assignmentSubmissions.studentId, studentId),
              ),
            ),
      db
        .select()
        .from(grades)
        .where(
          and(
            eq(grades.studentId, studentId),
            inArray(
              grades.assessmentId,
              rows.map((r) => r.assessmentId),
            ),
          ),
        ),
    ]);

    return rows.map((row) => {
      const submission = submissionRows.find((s) => s.assignmentId === row.id);
      const grade = gradeRows.find((g) => g.assessmentId === row.assessmentId);
      const status: AvailableAssignment["status"] = grade
        ? "graded"
        : submission
          ? "submitted"
          : "pending";
      return {
        id: row.id,
        disciplineName: row.disciplineName,
        title: row.title,
        instructions: row.instructions,
        dueAt: row.dueAt ? row.dueAt.toISOString() : null,
        status,
        score: grade?.score ?? null,
        maxScore: row.maxScore,
      };
    });
  },
);

export type MySubmission = {
  assignmentId: string;
  title: string;
  instructions: string | null;
  dueAt: string | null;
  textContent: string | null;
  fileUrl: string | null;
  fileName: string | null;
  submittedAt: string | null;
  feedback: string | null;
  score: string | null;
  maxScore: string;
};

const assignmentIdSchema = z.object({ assignmentId: z.string().uuid() });

/** Detalhe da tarefa + entrega própria (se houver), pra tela de envio do aluno. */
export const getMySubmissionFn = createServerFn({ method: "GET" })
  .validator(assignmentIdSchema)
  .handler(async ({ data }): Promise<MySubmission> => {
    const studentId = await requireStudentId();

    const [row] = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        instructions: assignments.instructions,
        dueAt: assignments.dueAt,
        assessmentId: assignments.assessmentId,
        maxScore: assessments.maxScore,
      })
      .from(assignments)
      .innerJoin(assessments, eq(assignments.assessmentId, assessments.id))
      .where(eq(assignments.id, data.assignmentId))
      .limit(1);
    if (!row) throw new Error("Tarefa não encontrada.");

    const [submission] = await db
      .select()
      .from(assignmentSubmissions)
      .where(
        and(
          eq(assignmentSubmissions.assignmentId, data.assignmentId),
          eq(assignmentSubmissions.studentId, studentId),
        ),
      )
      .limit(1);

    const [grade] = await db
      .select({ score: grades.score })
      .from(grades)
      .where(and(eq(grades.assessmentId, row.assessmentId), eq(grades.studentId, studentId)))
      .limit(1);

    return {
      assignmentId: row.id,
      title: row.title,
      instructions: row.instructions,
      dueAt: row.dueAt ? row.dueAt.toISOString() : null,
      textContent: submission?.textContent ?? null,
      fileUrl: submission?.fileUrl ?? null,
      fileName: submission?.fileName ?? null,
      submittedAt: submission?.submittedAt ? submission.submittedAt.toISOString() : null,
      feedback: submission?.feedback ?? null,
      score: grade?.score ?? null,
      maxScore: row.maxScore,
    };
  });

const submitSchema = z
  .object({
    assignmentId: z.string().uuid(),
    textContent: z.string().trim().optional(),
    fileUrl: z.string().trim().url().optional(),
    fileName: z.string().trim().optional(),
  })
  .refine((data) => Boolean(data.textContent) || Boolean(data.fileUrl), {
    message: "Escreva uma resposta ou anexe um arquivo.",
  });

/** Envia (ou reenvia, se ainda não corrigida) a entrega. */
export const submitAssignmentFn = createServerFn({ method: "POST" })
  .validator(submitSchema)
  .handler(async ({ data }) => {
    const studentId = await requireStudentId();

    const [assignment] = await db
      .select({ assessmentId: assignments.assessmentId })
      .from(assignments)
      .where(eq(assignments.id, data.assignmentId))
      .limit(1);
    if (!assignment) throw new Error("Tarefa não encontrada.");

    const [existingGrade] = await db
      .select({ id: grades.id })
      .from(grades)
      .where(and(eq(grades.assessmentId, assignment.assessmentId), eq(grades.studentId, studentId)))
      .limit(1);
    if (existingGrade) {
      throw new Error("Essa tarefa já foi corrigida — não é mais possível reenviar.");
    }

    await db
      .insert(assignmentSubmissions)
      .values({
        assignmentId: data.assignmentId,
        studentId,
        textContent: data.textContent || null,
        fileUrl: data.fileUrl || null,
        fileName: data.fileName || null,
      })
      .onConflictDoUpdate({
        target: [assignmentSubmissions.assignmentId, assignmentSubmissions.studentId],
        set: {
          textContent: data.textContent || null,
          fileUrl: data.fileUrl || null,
          fileName: data.fileName || null,
          submittedAt: new Date(),
        },
      });
  });
