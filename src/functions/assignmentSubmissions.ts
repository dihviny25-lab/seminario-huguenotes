import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import { requireStudentId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import {
  assessments,
  assignmentAnswers,
  assignmentOptions,
  assignmentQuestions,
  assignments,
  assignmentSubmissions,
  disciplines,
  grades,
} from "@/server/db/schema";
import { finalizeAssignmentSubmission } from "@/server/assignments/scoring";

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

const disciplineIdSchema = z.object({ disciplineId: z.string().uuid() });

/** Tarefas de UMA disciplina + status da entrega do próprio aluno — pra página do curso. */
export const listDisciplineAssignmentsFn = createServerFn({ method: "GET" })
  .validator(disciplineIdSchema)
  .handler(async ({ data }): Promise<Array<AvailableAssignment>> => {
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
      .where(eq(assignments.disciplineId, data.disciplineId))
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
      rows.length === 0
        ? []
        : db
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
  });

export type MySubmissionQuestion = {
  id: string;
  text: string;
  points: string;
  options: Array<{ id: string; text: string }>;
  selectedOptionId: string | null;
};

export type MySubmission = {
  assignmentId: string;
  kind: "open" | "multiple_choice";
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
  questions: Array<MySubmissionQuestion>;
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
        kind: assignments.kind,
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

    let questions: Array<MySubmissionQuestion> = [];
    if (row.kind === "multiple_choice") {
      const questionRows = await db
        .select()
        .from(assignmentQuestions)
        .where(eq(assignmentQuestions.assignmentId, row.id))
        .orderBy(asc(assignmentQuestions.sequence));
      const questionIds = questionRows.map((q) => q.id);

      const [optionRows, answerRows] = await Promise.all([
        questionIds.length === 0
          ? []
          : db
              .select({
                id: assignmentOptions.id,
                text: assignmentOptions.text,
                questionId: assignmentOptions.questionId,
              })
              .from(assignmentOptions)
              .where(inArray(assignmentOptions.questionId, questionIds))
              .orderBy(asc(assignmentOptions.sequence)),
        submission
          ? db
              .select({
                questionId: assignmentAnswers.questionId,
                optionId: assignmentAnswers.optionId,
              })
              .from(assignmentAnswers)
              .where(eq(assignmentAnswers.submissionId, submission.id))
          : Promise.resolve([]),
      ]);

      questions = questionRows.map((q) => ({
        id: q.id,
        text: q.text,
        points: q.points,
        options: optionRows
          .filter((o) => o.questionId === q.id)
          .map((o) => ({ id: o.id, text: o.text })),
        selectedOptionId: answerRows.find((a) => a.questionId === q.id)?.optionId ?? null,
      }));
    }

    return {
      assignmentId: row.id,
      kind: row.kind,
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
      questions,
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
      .select({
        assessmentId: assignments.assessmentId,
        title: assignments.title,
        kind: assignments.kind,
      })
      .from(assignments)
      .where(eq(assignments.id, data.assignmentId))
      .limit(1);
    if (!assignment) throw new Error("Tarefa não encontrada.");
    if (assignment.kind !== "open") {
      throw new Error("Essa tarefa é de múltipla escolha — responda pelas alternativas.");
    }

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
    await logAudit("tarefa.entregar", `Entregou a tarefa "${assignment.title}".`);
  });

const answerInputSchema = z.object({
  questionId: z.string().uuid(),
  optionId: z.string().uuid(),
});

const submitAnswersSchema = z.object({
  assignmentId: z.string().uuid(),
  answers: z
    .array(answerInputSchema)
    .min(1, "Responda pelo menos uma pergunta.")
    .refine(
      (answers) => new Set(answers.map((a) => a.questionId)).size === answers.length,
      { message: "Cada pergunta só pode ter uma resposta." },
    ),
});

/** Envia as respostas de uma tarefa objetiva — grava e corrige na hora. Envio único. */
export const submitAssignmentAnswersFn = createServerFn({ method: "POST" })
  .validator(submitAnswersSchema)
  .handler(async ({ data }) => {
    const studentId = await requireStudentId();

    const [assignment] = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, data.assignmentId))
      .limit(1);
    if (!assignment) throw new Error("Tarefa não encontrada.");
    if (assignment.kind !== "multiple_choice") {
      throw new Error("Essa tarefa não é de múltipla escolha.");
    }

    const [existing] = await db
      .select({ id: assignmentSubmissions.id })
      .from(assignmentSubmissions)
      .where(
        and(
          eq(assignmentSubmissions.assignmentId, data.assignmentId),
          eq(assignmentSubmissions.studentId, studentId),
        ),
      )
      .limit(1);
    if (existing) {
      throw new Error("Essa tarefa já foi respondida — envio único, sem reenvio.");
    }

    const [submission] = await db
      .insert(assignmentSubmissions)
      .values({ assignmentId: data.assignmentId, studentId })
      .returning({ id: assignmentSubmissions.id });

    await db.insert(assignmentAnswers).values(
      data.answers.map((answer) => ({
        submissionId: submission.id,
        questionId: answer.questionId,
        optionId: answer.optionId,
      })),
    );

    await finalizeAssignmentSubmission(submission.id);
    await logAudit("tarefa.entregar", `Entregou a tarefa objetiva "${assignment.title}".`);
  });
