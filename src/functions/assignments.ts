import { createServerFn } from "@tanstack/react-start";
import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import { requireOwnDiscipline } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import {
  assessments,
  assignmentOptions,
  assignments,
  assignmentQuestions,
  assignmentSubmissions,
  grades,
  students,
} from "@/server/db/schema";
import { sendPushToOwner } from "@/server/push";

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
  kind: z.enum(["open", "multiple_choice"]).default("open"),
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
        maxScore: data.kind === "multiple_choice" ? "0" : String(data.maxScore),
        weight: String(data.weight),
      })
      .returning({ id: assessments.id });

    const [assignment] = await db
      .insert(assignments)
      .values({
        disciplineId: data.disciplineId,
        assessmentId: assessment.id,
        kind: data.kind,
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

export type AssignmentQuestionDetail = {
  id: string;
  text: string;
  points: string;
  sequence: number;
  options: Array<{ id: string; text: string; isCorrect: boolean; sequence: number }>;
};

export type AssignmentDetail = {
  id: string;
  disciplineId: string;
  kind: "open" | "multiple_choice";
  title: string;
  instructions: string | null;
  dueAt: string | null;
  weight: number;
  maxScore: number;
  /** true quando pelo menos um aluno já entregou — só importa pra "multiple_choice"
   * (trava edição de perguntas), mesma regra de `ExamDetail.locked`. */
  locked: boolean;
  questions: Array<AssignmentQuestionDetail>;
};

async function recomputeAssignmentMaxScore(assignmentId: string, assessmentId: string) {
  const questions = await db
    .select({ points: assignmentQuestions.points })
    .from(assignmentQuestions)
    .where(eq(assignmentQuestions.assignmentId, assignmentId));
  const total = questions.reduce((sum, q) => sum + Number(q.points), 0);
  await db
    .update(assessments)
    .set({ maxScore: String(total) })
    .where(eq(assessments.id, assessmentId));
}

async function buildAssignmentDetail(
  assignment: typeof assignments.$inferSelect,
): Promise<AssignmentDetail> {
  const [questionRows, submissionRows, assessmentRow] = await Promise.all([
    assignment.kind === "multiple_choice"
      ? db
          .select()
          .from(assignmentQuestions)
          .where(eq(assignmentQuestions.assignmentId, assignment.id))
          .orderBy(asc(assignmentQuestions.sequence))
      : Promise.resolve([] as Array<typeof assignmentQuestions.$inferSelect>),
    db
      .select({ id: assignmentSubmissions.id })
      .from(assignmentSubmissions)
      .where(eq(assignmentSubmissions.assignmentId, assignment.id)),
    db
      .select({ weight: assessments.weight, maxScore: assessments.maxScore })
      .from(assessments)
      .where(eq(assessments.id, assignment.assessmentId))
      .limit(1),
  ]);

  const questionIds = questionRows.map((q) => q.id);
  const optionRows =
    questionIds.length === 0
      ? []
      : await db
          .select()
          .from(assignmentOptions)
          .where(inArray(assignmentOptions.questionId, questionIds))
          .orderBy(asc(assignmentOptions.sequence));

  return {
    id: assignment.id,
    disciplineId: assignment.disciplineId,
    kind: assignment.kind,
    title: assignment.title,
    instructions: assignment.instructions,
    dueAt: assignment.dueAt ? assignment.dueAt.toISOString() : null,
    weight: Number(assessmentRow[0]?.weight ?? 1),
    maxScore: Number(assessmentRow[0]?.maxScore ?? 10),
    locked: submissionRows.length > 0,
    questions: questionRows.map((q) => ({
      id: q.id,
      text: q.text,
      points: q.points,
      sequence: q.sequence,
      options: optionRows
        .filter((o) => o.questionId === q.id)
        .map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect, sequence: o.sequence })),
    })),
  };
}

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
    return buildAssignmentDetail(assignment);
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
    await sendPushToOwner("student", submission.studentId, {
      title: "Nota lançada",
      body: `Sua tarefa "${assignment.title}" foi corrigida — nota ${data.score}.`,
      url: "/portal",
    });
  });

const optionInputSchema = z.object({
  text: z.string().trim().min(1, "Informe o texto da opção."),
  isCorrect: z.boolean(),
});

const questionInputSchema = z.object({
  disciplineId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  text: z.string().trim().min(1, "Informe o texto da pergunta."),
  points: z.number().positive().default(1),
  options: z
    .array(optionInputSchema)
    .min(2, "A pergunta precisa de pelo menos 2 opções.")
    .max(6, "No máximo 6 opções por pergunta."),
});

function assertExactlyOneCorrect(options: Array<{ isCorrect: boolean }>) {
  if (options.filter((o) => o.isCorrect).length !== 1) {
    throw new Error("Marque exatamente uma opção como correta.");
  }
}

/** Adiciona pergunta + opções a uma tarefa objetiva — bloqueado se algum aluno já entregou. */
export const addAssignmentQuestionFn = createServerFn({ method: "POST" })
  .validator(questionInputSchema)
  .handler(async ({ data }) => {
    await requireOwnDiscipline(data.disciplineId);
    const assignment = await requireAssignmentInDiscipline(data.assignmentId, data.disciplineId);
    if (assignment.kind !== "multiple_choice") {
      throw new Error("Só é possível adicionar perguntas a uma tarefa de múltipla escolha.");
    }
    assertExactlyOneCorrect(data.options);

    const hasSubmissions = await db
      .select({ id: assignmentSubmissions.id })
      .from(assignmentSubmissions)
      .where(eq(assignmentSubmissions.assignmentId, assignment.id))
      .limit(1);
    if (hasSubmissions.length > 0) {
      throw new Error("Não é possível editar perguntas depois que algum aluno já entregou.");
    }

    const existing = await db
      .select({ sequence: assignmentQuestions.sequence })
      .from(assignmentQuestions)
      .where(eq(assignmentQuestions.assignmentId, assignment.id));
    const nextSequence = existing.reduce((max, q) => Math.max(max, q.sequence), 0) + 1;

    const [question] = await db
      .insert(assignmentQuestions)
      .values({
        assignmentId: assignment.id,
        text: data.text,
        points: String(data.points),
        sequence: nextSequence,
      })
      .returning({ id: assignmentQuestions.id });

    await db.insert(assignmentOptions).values(
      data.options.map((option, index) => ({
        questionId: question.id,
        text: option.text,
        isCorrect: option.isCorrect,
        sequence: index + 1,
      })),
    );

    await recomputeAssignmentMaxScore(assignment.id, assignment.assessmentId);
    return { id: question.id };
  });

const deleteQuestionSchema = z.object({
  disciplineId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  questionId: z.string().uuid(),
});

/** Remove a pergunta — bloqueado se algum aluno já entregou. */
export const deleteAssignmentQuestionFn = createServerFn({ method: "POST" })
  .validator(deleteQuestionSchema)
  .handler(async ({ data }) => {
    await requireOwnDiscipline(data.disciplineId);
    const assignment = await requireAssignmentInDiscipline(data.assignmentId, data.disciplineId);

    const hasSubmissions = await db
      .select({ id: assignmentSubmissions.id })
      .from(assignmentSubmissions)
      .where(eq(assignmentSubmissions.assignmentId, assignment.id))
      .limit(1);
    if (hasSubmissions.length > 0) {
      throw new Error("Não é possível editar perguntas depois que algum aluno já entregou.");
    }

    await db.delete(assignmentQuestions).where(eq(assignmentQuestions.id, data.questionId));
    await recomputeAssignmentMaxScore(assignment.id, assignment.assessmentId);
  });
