import { createServerFn } from "@tanstack/react-start";
import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import { requireOwnDiscipline } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import {
  assessments,
  assignments,
  assignmentSubmissions,
  grades,
  students,
} from "@/server/db/schema";

const disciplineIdSchema = z.object({ disciplineId: z.string().uuid() });
const assignmentIdSchema = z.object({
  disciplineId: z.string().uuid(),
  assignmentId: z.string().uuid(),
});

async function requireAssignmentInDiscipline(assignmentId: string, disciplineId: string) {
  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, assignmentId))
    .limit(1);
  if (!assignment || assignment.disciplineId !== disciplineId) {
    throw new Error("Tarefa não encontrada.");
  }
  return assignment;
}

export type AssignmentSummary = {
  id: string;
  title: string;
  dueAt: string | null;
  submittedCount: number;
  gradedCount: number;
};

/** Tarefas de uma disciplina, com contagem de entregas e correções. */
export const listMyDisciplineAssignmentsFn = createServerFn({ method: "GET" })
  .validator(disciplineIdSchema)
  .handler(async ({ data }): Promise<Array<AssignmentSummary>> => {
    await requireOwnDiscipline(data.disciplineId);

    const rows = await db
      .select()
      .from(assignments)
      .where(eq(assignments.disciplineId, data.disciplineId))
      .orderBy(asc(assignments.createdAt));
    const ids = rows.map((a) => a.id);

    const submissionRows =
      ids.length === 0
        ? []
        : await db
            .select({
              assignmentId: assignmentSubmissions.assignmentId,
              gradedAt: assignmentSubmissions.gradedAt,
            })
            .from(assignmentSubmissions)
            .where(inArray(assignmentSubmissions.assignmentId, ids));

    return rows.map((assignment) => ({
      id: assignment.id,
      title: assignment.title,
      dueAt: assignment.dueAt ? assignment.dueAt.toISOString() : null,
      submittedCount: submissionRows.filter((s) => s.assignmentId === assignment.id).length,
      gradedCount: submissionRows.filter(
        (s) => s.assignmentId === assignment.id && s.gradedAt !== null,
      ).length,
    }));
  });

const createSchema = z.object({
  disciplineId: z.string().uuid(),
  title: z.string().trim().min(1, "Informe um título."),
  instructions: z.string().trim().optional(),
  weight: z.number().positive().default(1),
  maxScore: z.number().positive().default(10),
  dueAt: z.string().optional(), // ISO — de <input type="datetime-local">
});

/** Cria a tarefa e a avaliação vinculada na aba Notas. */
export const createAssignmentFn = createServerFn({ method: "POST" })
  .validator(createSchema)
  .handler(async ({ data }) => {
    const discipline = await requireOwnDiscipline(data.disciplineId);

    const [assessment] = await db
      .insert(assessments)
      .values({
        disciplineId: data.disciplineId,
        title: data.title,
        maxScore: String(data.maxScore),
        weight: String(data.weight),
      })
      .returning({ id: assessments.id });

    const [assignment] = await db
      .insert(assignments)
      .values({
        disciplineId: data.disciplineId,
        assessmentId: assessment.id,
        title: data.title,
        instructions: data.instructions || null,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
      })
      .returning({ id: assignments.id });

    await logAudit("tarefa.criar", `Criou a tarefa "${data.title}" em ${discipline.discipline}.`);
    return { assignmentId: assignment.id, assessmentId: assessment.id };
  });

const updateAssignmentSchema = z.object({
  disciplineId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  title: z.string().trim().min(1, "Informe um título."),
  instructions: z.string().trim().optional(),
  weight: z.number().positive("Deve ser maior que zero."),
  maxScore: z.number().positive("Deve ser maior que zero."),
  dueAt: z.string().optional(),
});

/** Edita título, instruções, nota máxima, peso na média final e prazo. */
export const updateAssignmentFn = createServerFn({ method: "POST" })
  .validator(updateAssignmentSchema)
  .handler(async ({ data }) => {
    const discipline = await requireOwnDiscipline(data.disciplineId);
    const assignment = await requireAssignmentInDiscipline(data.assignmentId, data.disciplineId);

    await db
      .update(assignments)
      .set({
        title: data.title,
        instructions: data.instructions || null,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
      })
      .where(eq(assignments.id, assignment.id));
    await db
      .update(assessments)
      .set({ title: data.title, weight: String(data.weight), maxScore: String(data.maxScore) })
      .where(eq(assessments.id, assignment.assessmentId));
    await logAudit("tarefa.editar", `Editou a tarefa "${data.title}" em ${discipline.discipline}.`);
  });

/** Apaga a avaliação vinculada — cascateia tarefa, entregas e notas lançadas. */
export const deleteAssignmentFn = createServerFn({ method: "POST" })
  .validator(assignmentIdSchema)
  .handler(async ({ data }) => {
    const discipline = await requireOwnDiscipline(data.disciplineId);
    const assignment = await requireAssignmentInDiscipline(data.assignmentId, data.disciplineId);
    await db.delete(assessments).where(eq(assessments.id, assignment.assessmentId));
    await logAudit(
      "tarefa.apagar",
      `Apagou a tarefa "${assignment.title}" em ${discipline.discipline}.`,
    );
  });

export type AssignmentDetail = {
  id: string;
  disciplineId: string;
  title: string;
  instructions: string | null;
  dueAt: string | null;
  weight: number;
  maxScore: number;
};

/** Detalhe da tarefa, resolvendo a disciplina sozinho a partir do assignmentId (rota do editor). */
export const getAssignmentByIdFn = createServerFn({ method: "GET" })
  .validator(z.object({ assignmentId: z.string().uuid() }))
  .handler(async ({ data }): Promise<AssignmentDetail> => {
    const [assignment] = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, data.assignmentId))
      .limit(1);
    if (!assignment) throw new Error("Tarefa não encontrada.");
    await requireOwnDiscipline(assignment.disciplineId);

    const [assessment] = await db
      .select({ weight: assessments.weight, maxScore: assessments.maxScore })
      .from(assessments)
      .where(eq(assessments.id, assignment.assessmentId))
      .limit(1);

    return {
      id: assignment.id,
      disciplineId: assignment.disciplineId,
      title: assignment.title,
      instructions: assignment.instructions,
      dueAt: assignment.dueAt ? assignment.dueAt.toISOString() : null,
      weight: Number(assessment?.weight ?? 1),
      maxScore: Number(assessment?.maxScore ?? 10),
    };
  });

export type SubmissionRow = {
  studentId: string;
  studentName: string;
  submissionId: string | null;
  textContent: string | null;
  fileUrl: string | null;
  fileName: string | null;
  submittedAt: string | null;
  feedback: string | null;
  gradedAt: string | null;
  score: string | null;
};

/** Alunos ativos + entrega (se houver) + nota já lançada em Notas. */
export const getAssignmentSubmissionsFn = createServerFn({ method: "GET" })
  .validator(z.object({ assignmentId: z.string().uuid() }))
  .handler(async ({ data }): Promise<Array<SubmissionRow>> => {
    const [assignment] = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, data.assignmentId))
      .limit(1);
    if (!assignment) throw new Error("Tarefa não encontrada.");
    await requireOwnDiscipline(assignment.disciplineId);

    const [studentRows, submissionRows, gradeRows] = await Promise.all([
      db
        .select({ id: students.id, name: students.name })
        .from(students)
        .where(eq(students.active, true))
        .orderBy(asc(students.name)),
      db
        .select()
        .from(assignmentSubmissions)
        .where(eq(assignmentSubmissions.assignmentId, data.assignmentId)),
      db.select().from(grades).where(eq(grades.assessmentId, assignment.assessmentId)),
    ]);

    return studentRows.map((student) => {
      const submission = submissionRows.find((s) => s.studentId === student.id);
      const grade = gradeRows.find((g) => g.studentId === student.id);
      return {
        studentId: student.id,
        studentName: student.name,
        submissionId: submission?.id ?? null,
        textContent: submission?.textContent ?? null,
        fileUrl: submission?.fileUrl ?? null,
        fileName: submission?.fileName ?? null,
        submittedAt: submission?.submittedAt ? submission.submittedAt.toISOString() : null,
        feedback: submission?.feedback ?? null,
        gradedAt: submission?.gradedAt ? submission.gradedAt.toISOString() : null,
        score: grade?.score ?? null,
      };
    });
  });

const gradeSchema = z.object({
  disciplineId: z.string().uuid(),
  submissionId: z.string().uuid(),
  score: z.number().min(0),
  feedback: z.string().trim().optional(),
});

/** Lança a nota da entrega — grava na própria submissão E faz o upsert em Notas. */
export const gradeSubmissionFn = createServerFn({ method: "POST" })
  .validator(gradeSchema)
  .handler(async ({ data }) => {
    await requireOwnDiscipline(data.disciplineId);

    const [submission] = await db
      .select()
      .from(assignmentSubmissions)
      .where(eq(assignmentSubmissions.id, data.submissionId))
      .limit(1);
    if (!submission) throw new Error("Entrega não encontrada.");

    const [assignment] = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, submission.assignmentId))
      .limit(1);
    if (!assignment || assignment.disciplineId !== data.disciplineId) {
      throw new Error("Tarefa não encontrada.");
    }

    await db
      .update(assignmentSubmissions)
      .set({ feedback: data.feedback || null, gradedAt: new Date() })
      .where(eq(assignmentSubmissions.id, data.submissionId));

    await db
      .insert(grades)
      .values({
        assessmentId: assignment.assessmentId,
        studentId: submission.studentId,
        score: String(data.score),
      })
      .onConflictDoUpdate({
        target: [grades.assessmentId, grades.studentId],
        set: { score: String(data.score), updatedAt: new Date() },
      });

    const [student] = await db
      .select({ name: students.name })
      .from(students)
      .where(eq(students.id, submission.studentId))
      .limit(1);
    await logAudit(
      "tarefa.corrigir",
      `Corrigiu a entrega de ${student?.name ?? "aluno"} em "${assignment.title}" (nota ${data.score}).`,
    );
  });
