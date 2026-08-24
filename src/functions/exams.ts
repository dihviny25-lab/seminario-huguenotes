import { createServerFn } from "@tanstack/react-start";
import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { requireOwnDiscipline } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import {
  assessments,
  examAttempts,
  examOptions,
  examQuestions,
  exams,
  students,
} from "@/server/db/schema";

const disciplineIdSchema = z.object({ disciplineId: z.string().uuid() });
const examIdSchema = z.object({ disciplineId: z.string().uuid(), examId: z.string().uuid() });

/** Garante que a prova pertence à disciplina e devolve o exam. Lança se não achar. */
async function requireExamInDiscipline(examId: string, disciplineId: string) {
  const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
  if (!exam || exam.disciplineId !== disciplineId) {
    throw new Error("Prova não encontrada.");
  }
  return exam;
}

async function recomputeMaxScore(examId: string, assessmentId: string) {
  const questions = await db
    .select({ points: examQuestions.points })
    .from(examQuestions)
    .where(eq(examQuestions.examId, examId));
  const total = questions.reduce((sum, q) => sum + Number(q.points), 0);
  await db
    .update(assessments)
    .set({ maxScore: String(total) })
    .where(eq(assessments.id, assessmentId));
}

export type ExamSummary = {
  id: string;
  title: string;
  durationMinutes: number;
  opensAt: string | null;
  questionCount: number;
  totalPoints: number;
  submittedCount: number;
};

/** Provas de uma disciplina, com contagem de perguntas e de quem já enviou. */
export const listMyDisciplineExamsFn = createServerFn({ method: "GET" })
  .validator(disciplineIdSchema)
  .handler(async ({ data }): Promise<Array<ExamSummary>> => {
    await requireOwnDiscipline(data.disciplineId);

    const examRows = await db
      .select()
      .from(exams)
      .where(eq(exams.disciplineId, data.disciplineId))
      .orderBy(asc(exams.createdAt));
    const examIds = examRows.map((e) => e.id);

    const [questionRows, attemptRows] = await Promise.all([
      examIds.length === 0
        ? []
        : db
            .select({ examId: examQuestions.examId, points: examQuestions.points })
            .from(examQuestions)
            .where(inArray(examQuestions.examId, examIds)),
      examIds.length === 0
        ? []
        : db
            .select({ examId: examAttempts.examId, submittedAt: examAttempts.submittedAt })
            .from(examAttempts)
            .where(inArray(examAttempts.examId, examIds)),
    ]);

    return examRows.map((exam) => {
      const questions = questionRows.filter((q) => q.examId === exam.id);
      const submittedCount = attemptRows.filter(
        (a) => a.examId === exam.id && a.submittedAt !== null,
      ).length;
      return {
        id: exam.id,
        title: exam.title,
        durationMinutes: exam.durationMinutes,
        opensAt: exam.opensAt ? exam.opensAt.toISOString() : null,
        questionCount: questions.length,
        totalPoints: questions.reduce((sum, q) => sum + Number(q.points), 0),
        submittedCount,
      };
    });
  });

const createExamSchema = z.object({
  disciplineId: z.string().uuid(),
  title: z.string().trim().min(1, "Informe um título."),
  instructions: z.string().trim().optional(),
  durationMinutes: z.number().int().positive("Informe quantos minutos de duração."),
  weight: z.number().positive().default(1),
});

/** Cria a prova (rascunho) e a avaliação vinculada na aba Notas, com nota máxima 0 até ter perguntas. */
export const createExamFn = createServerFn({ method: "POST" })
  .validator(createExamSchema)
  .handler(async ({ data }) => {
    await requireOwnDiscipline(data.disciplineId);

    const [assessment] = await db
      .insert(assessments)
      .values({
        disciplineId: data.disciplineId,
        title: data.title,
        maxScore: "0",
        weight: String(data.weight),
      })
      .returning({ id: assessments.id });

    const [exam] = await db
      .insert(exams)
      .values({
        disciplineId: data.disciplineId,
        assessmentId: assessment.id,
        title: data.title,
        instructions: data.instructions || null,
        durationMinutes: data.durationMinutes,
      })
      .returning({ id: exams.id });

    return { examId: exam.id, assessmentId: assessment.id };
  });

const updateExamSchema = z.object({
  disciplineId: z.string().uuid(),
  examId: z.string().uuid(),
  title: z.string().trim().min(1, "Informe um título."),
  instructions: z.string().trim().optional(),
  weight: z.number().positive("Deve ser maior que zero."),
});

/**
 * Edita título, instruções e peso na média final — funciona mesmo com a
 * prova já em andamento/travada, já que isso não muda o conteúdo pra quem
 * já começou a fazer.
 */
export const updateExamFn = createServerFn({ method: "POST" })
  .validator(updateExamSchema)
  .handler(async ({ data }) => {
    await requireOwnDiscipline(data.disciplineId);
    const exam = await requireExamInDiscipline(data.examId, data.disciplineId);

    await db
      .update(exams)
      .set({ title: data.title, instructions: data.instructions || null })
      .where(eq(exams.id, exam.id));
    await db
      .update(assessments)
      .set({ title: data.title, weight: String(data.weight) })
      .where(eq(assessments.id, exam.assessmentId));
  });

const deleteExamSchema = examIdSchema;

/** Apaga a avaliação vinculada — cascateia prova, perguntas, tentativas e notas lançadas. */
export const deleteExamFn = createServerFn({ method: "POST" })
  .validator(deleteExamSchema)
  .handler(async ({ data }) => {
    await requireOwnDiscipline(data.disciplineId);
    const exam = await requireExamInDiscipline(data.examId, data.disciplineId);
    await db.delete(assessments).where(eq(assessments.id, exam.assessmentId));
  });

export type ExamQuestionDetail = {
  id: string;
  text: string;
  points: string;
  sequence: number;
  options: Array<{ id: string; text: string; isCorrect: boolean; sequence: number }>;
};

export type ExamDetail = {
  id: string;
  disciplineId: string;
  title: string;
  instructions: string | null;
  durationMinutes: number;
  opensAt: string | null;
  locked: boolean;
  weight: number;
  questions: Array<ExamQuestionDetail>;
};

async function buildExamDetail(exam: typeof exams.$inferSelect): Promise<ExamDetail> {
  const [questionRows, hasAttempts, assessmentRow] = await Promise.all([
    db
      .select()
      .from(examQuestions)
      .where(eq(examQuestions.examId, exam.id))
      .orderBy(asc(examQuestions.sequence)),
    db.select({ id: examAttempts.id }).from(examAttempts).where(eq(examAttempts.examId, exam.id)),
    db
      .select({ weight: assessments.weight })
      .from(assessments)
      .where(eq(assessments.id, exam.assessmentId))
      .limit(1),
  ]);

  const questionIds = questionRows.map((q) => q.id);
  const optionRows =
    questionIds.length === 0
      ? []
      : await db
          .select()
          .from(examOptions)
          .where(inArray(examOptions.questionId, questionIds))
          .orderBy(asc(examOptions.sequence));

  return {
    id: exam.id,
    disciplineId: exam.disciplineId,
    title: exam.title,
    instructions: exam.instructions,
    durationMinutes: exam.durationMinutes,
    opensAt: exam.opensAt ? exam.opensAt.toISOString() : null,
    locked: hasAttempts.length > 0,
    weight: Number(assessmentRow[0]?.weight ?? 1),
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

/** Detalhe completo da prova pro professor editar (inclui qual opção é a certa). */
export const getExamDetailFn = createServerFn({ method: "GET" })
  .validator(examIdSchema)
  .handler(async ({ data }): Promise<ExamDetail> => {
    await requireOwnDiscipline(data.disciplineId);
    const exam = await requireExamInDiscipline(data.examId, data.disciplineId);
    return buildExamDetail(exam);
  });

const examIdOnlySchema = z.object({ examId: z.string().uuid() });

/**
 * Mesma coisa que getExamDetailFn, mas descobre a disciplina sozinho a
 * partir da prova — usado pela rota do editor, que só tem o examId na URL.
 */
export const getExamByIdFn = createServerFn({ method: "GET" })
  .validator(examIdOnlySchema)
  .handler(async ({ data }): Promise<ExamDetail> => {
    const [exam] = await db.select().from(exams).where(eq(exams.id, data.examId)).limit(1);
    if (!exam) throw new Error("Prova não encontrada.");
    await requireOwnDiscipline(exam.disciplineId);
    return buildExamDetail(exam);
  });

const optionInputSchema = z.object({
  text: z.string().trim().min(1, "Informe o texto da opção."),
  isCorrect: z.boolean(),
});

const questionInputSchema = z.object({
  disciplineId: z.string().uuid(),
  examId: z.string().uuid(),
  text: z.string().trim().min(1, "Informe o texto da pergunta."),
  points: z.number().positive().default(1),
  options: z
    .array(optionInputSchema)
    .min(2, "A pergunta precisa de pelo menos 2 opções.")
    .max(6, "No máximo 6 opções por pergunta."),
});

function assertExactlyOneCorrect(options: Array<{ isCorrect: boolean }>) {
  const correctCount = options.filter((o) => o.isCorrect).length;
  if (correctCount !== 1) {
    throw new Error("Marque exatamente uma opção como correta.");
  }
}

/** Adiciona pergunta + opções — bloqueado se a prova já tiver alguma tentativa. */
export const addExamQuestionFn = createServerFn({ method: "POST" })
  .validator(questionInputSchema)
  .handler(async ({ data }) => {
    await requireOwnDiscipline(data.disciplineId);
    const exam = await requireExamInDiscipline(data.examId, data.disciplineId);
    assertExactlyOneCorrect(data.options);

    const hasAttempts = await db
      .select({ id: examAttempts.id })
      .from(examAttempts)
      .where(eq(examAttempts.examId, exam.id))
      .limit(1);
    if (hasAttempts.length > 0) {
      throw new Error("Não é possível editar perguntas depois que a prova começou a ser feita.");
    }

    const existing = await db
      .select({ sequence: examQuestions.sequence })
      .from(examQuestions)
      .where(eq(examQuestions.examId, exam.id));
    const nextSequence = existing.reduce((max, q) => Math.max(max, q.sequence), 0) + 1;

    const [question] = await db
      .insert(examQuestions)
      .values({
        examId: exam.id,
        text: data.text,
        points: String(data.points),
        sequence: nextSequence,
      })
      .returning({ id: examQuestions.id });

    await db.insert(examOptions).values(
      data.options.map((option, index) => ({
        questionId: question.id,
        text: option.text,
        isCorrect: option.isCorrect,
        sequence: index + 1,
      })),
    );

    await recomputeMaxScore(exam.id, exam.assessmentId);
    return { id: question.id };
  });

const deleteQuestionSchema = z.object({
  disciplineId: z.string().uuid(),
  examId: z.string().uuid(),
  questionId: z.string().uuid(),
});

/** Remove a pergunta — bloqueado se a prova já tiver alguma tentativa. */
export const deleteExamQuestionFn = createServerFn({ method: "POST" })
  .validator(deleteQuestionSchema)
  .handler(async ({ data }) => {
    await requireOwnDiscipline(data.disciplineId);
    const exam = await requireExamInDiscipline(data.examId, data.disciplineId);

    const hasAttempts = await db
      .select({ id: examAttempts.id })
      .from(examAttempts)
      .where(eq(examAttempts.examId, exam.id))
      .limit(1);
    if (hasAttempts.length > 0) {
      throw new Error("Não é possível editar perguntas depois que a prova começou a ser feita.");
    }

    await db.delete(examQuestions).where(eq(examQuestions.id, data.questionId));
    await recomputeMaxScore(exam.id, exam.assessmentId);
  });

const scheduleExamSchema = z.object({
  disciplineId: z.string().uuid(),
  examId: z.string().uuid(),
  opensAt: z.string(), // ISO — convertido a partir de um <input type="datetime-local">
});

/** Agenda a prova: a partir de opensAt, ela fica visível e trava perguntas/opções. */
export const scheduleExamFn = createServerFn({ method: "POST" })
  .validator(scheduleExamSchema)
  .handler(async ({ data }) => {
    await requireOwnDiscipline(data.disciplineId);
    const exam = await requireExamInDiscipline(data.examId, data.disciplineId);

    const questionRows = await db
      .select({ id: examQuestions.id })
      .from(examQuestions)
      .where(eq(examQuestions.examId, exam.id));
    if (questionRows.length === 0) {
      throw new Error("Adicione ao menos uma pergunta antes de agendar.");
    }

    await db
      .update(exams)
      .set({ opensAt: new Date(data.opensAt) })
      .where(eq(exams.id, exam.id));
  });

export type ExamResultRow = {
  studentId: string;
  studentName: string;
  status: "not_started" | "in_progress" | "submitted";
  startedAt: string | null;
  submittedAt: string | null;
  autoSubmitted: boolean;
  score: string | null;
};

/** Alunos ativos + status da tentativa de cada um nessa prova. */
export const getExamResultsFn = createServerFn({ method: "GET" })
  .validator(examIdSchema)
  .handler(async ({ data }): Promise<Array<ExamResultRow>> => {
    await requireOwnDiscipline(data.disciplineId);
    const exam = await requireExamInDiscipline(data.examId, data.disciplineId);

    const [studentRows, attemptRows] = await Promise.all([
      db
        .select({ id: students.id, name: students.name })
        .from(students)
        .where(eq(students.active, true))
        .orderBy(asc(students.name)),
      db.select().from(examAttempts).where(eq(examAttempts.examId, exam.id)),
    ]);

    return studentRows.map((student) => {
      const attempt = attemptRows.find((a) => a.studentId === student.id);
      const status: ExamResultRow["status"] = !attempt
        ? "not_started"
        : attempt.submittedAt
          ? "submitted"
          : "in_progress";
      return {
        studentId: student.id,
        studentName: student.name,
        status,
        startedAt: attempt ? attempt.startedAt.toISOString() : null,
        submittedAt: attempt?.submittedAt ? attempt.submittedAt.toISOString() : null,
        autoSubmitted: attempt?.autoSubmitted ?? false,
        score: attempt?.score ?? null,
      };
    });
  });
