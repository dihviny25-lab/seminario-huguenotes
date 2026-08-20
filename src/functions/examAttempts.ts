import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";

import { requireStudentId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import {
  assessments,
  disciplines,
  examAnswers,
  examAttempts,
  examOptions,
  examQuestions,
  exams,
} from "@/server/db/schema";
import { finalizeExamAttempt } from "@/server/exams/scoring";
import { computeExamDeadline, endOfDayBrazil } from "@/lib/examSchedule";

const examIdSchema = z.object({ examId: z.string().uuid() });

export type AvailableExam = {
  id: string;
  disciplineName: string;
  title: string;
  durationMinutes: number;
  opensAt: string;
  status: "upcoming" | "available" | "in_progress" | "submitted";
  score: string | null;
  maxScore: string;
};

/** Todas as provas agendadas (de qualquer disciplina) + status da tentativa do próprio aluno. */
export const listAvailableExamsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<AvailableExam>> => {
    const studentId = await requireStudentId();

    const examRows = await db
      .select({
        id: exams.id,
        title: exams.title,
        durationMinutes: exams.durationMinutes,
        opensAt: exams.opensAt,
        disciplineName: disciplines.discipline,
        maxScore: assessments.maxScore,
      })
      .from(exams)
      .innerJoin(disciplines, eq(exams.disciplineId, disciplines.id))
      .innerJoin(assessments, eq(exams.assessmentId, assessments.id))
      .where(isNotNull(exams.opensAt))
      .orderBy(asc(exams.opensAt));

    const examIds = examRows.map((e) => e.id);
    const attemptRows =
      examIds.length === 0
        ? []
        : await db
            .select()
            .from(examAttempts)
            .where(
              and(inArray(examAttempts.examId, examIds), eq(examAttempts.studentId, studentId)),
            );

    const now = new Date();
    return examRows.map((exam) => {
      const attempt = attemptRows.find((a) => a.examId === exam.id);
      const opensAt = exam.opensAt as Date;
      let status: AvailableExam["status"];
      if (attempt?.submittedAt) status = "submitted";
      else if (attempt) status = "in_progress";
      else if (opensAt > now) status = "upcoming";
      else status = "available";

      return {
        id: exam.id,
        title: exam.title,
        durationMinutes: exam.durationMinutes,
        opensAt: opensAt.toISOString(),
        disciplineName: exam.disciplineName,
        status,
        score: attempt?.score ?? null,
        maxScore: exam.maxScore,
      };
    });
  },
);

const disciplineIdSchema = z.object({ disciplineId: z.string().uuid() });

/** Provas de UMA disciplina + status da tentativa do próprio aluno — pra página do curso. */
export const listDisciplineExamsFn = createServerFn({ method: "GET" })
  .validator(disciplineIdSchema)
  .handler(async ({ data }): Promise<Array<AvailableExam>> => {
    const studentId = await requireStudentId();

    const examRows = await db
      .select({
        id: exams.id,
        title: exams.title,
        durationMinutes: exams.durationMinutes,
        opensAt: exams.opensAt,
        disciplineName: disciplines.discipline,
        maxScore: assessments.maxScore,
      })
      .from(exams)
      .innerJoin(disciplines, eq(exams.disciplineId, disciplines.id))
      .innerJoin(assessments, eq(exams.assessmentId, assessments.id))
      .where(and(eq(exams.disciplineId, data.disciplineId), isNotNull(exams.opensAt)))
      .orderBy(asc(exams.opensAt));

    const examIds = examRows.map((e) => e.id);
    const attemptRows =
      examIds.length === 0
        ? []
        : await db
            .select()
            .from(examAttempts)
            .where(
              and(inArray(examAttempts.examId, examIds), eq(examAttempts.studentId, studentId)),
            );

    const now = new Date();
    return examRows.map((exam) => {
      const attempt = attemptRows.find((a) => a.examId === exam.id);
      const opensAt = exam.opensAt as Date;
      let status: AvailableExam["status"];
      if (attempt?.submittedAt) status = "submitted";
      else if (attempt) status = "in_progress";
      else if (opensAt > now) status = "upcoming";
      else status = "available";

      return {
        id: exam.id,
        title: exam.title,
        durationMinutes: exam.durationMinutes,
        opensAt: opensAt.toISOString(),
        disciplineName: exam.disciplineName,
        status,
        score: attempt?.score ?? null,
        maxScore: exam.maxScore,
      };
    });
  });

export type ExamAttemptState = {
  examId: string;
  title: string;
  instructions: string | null;
  startedAt: string;
  deadline: string;
  serverNow: string;
  durationMinutes: number;
  submitted: boolean;
  submittedAt: string | null;
  score: string | null;
  maxScore: string;
  questions: Array<{
    id: string;
    text: string;
    points: string;
    options: Array<{ id: string; text: string }>;
    selectedOptionId: string | null;
  }>;
};

async function buildAttemptState(examId: string, studentId: string): Promise<ExamAttemptState> {
  const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
  if (!exam) throw new Error("Prova não encontrada.");

  const [assessment] = await db
    .select({ maxScore: assessments.maxScore })
    .from(assessments)
    .where(eq(assessments.id, exam.assessmentId))
    .limit(1);

  const [attempt] = await db
    .select()
    .from(examAttempts)
    .where(and(eq(examAttempts.examId, examId), eq(examAttempts.studentId, studentId)))
    .limit(1);
  if (!attempt) throw new Error("Você ainda não iniciou esta prova.");

  const questionRows = await db
    .select()
    .from(examQuestions)
    .where(eq(examQuestions.examId, examId))
    .orderBy(asc(examQuestions.sequence));
  const questionIds = questionRows.map((q) => q.id);

  const [optionRows, answerRows] = await Promise.all([
    questionIds.length === 0
      ? []
      : db
          .select({
            id: examOptions.id,
            text: examOptions.text,
            questionId: examOptions.questionId,
          })
          .from(examOptions)
          .where(inArray(examOptions.questionId, questionIds))
          .orderBy(asc(examOptions.sequence)),
    db
      .select({ questionId: examAnswers.questionId, optionId: examAnswers.optionId })
      .from(examAnswers)
      .where(eq(examAnswers.attemptId, attempt.id)),
  ]);

  const deadline = computeExamDeadline(attempt.startedAt, exam.durationMinutes, exam.opensAt!);

  return {
    examId: exam.id,
    title: exam.title,
    instructions: exam.instructions,
    startedAt: attempt.startedAt.toISOString(),
    deadline: deadline.toISOString(),
    serverNow: new Date().toISOString(),
    durationMinutes: exam.durationMinutes,
    submitted: attempt.submittedAt !== null,
    submittedAt: attempt.submittedAt ? attempt.submittedAt.toISOString() : null,
    score: attempt.score,
    maxScore: assessment?.maxScore ?? "0",
    questions: questionRows.map((q) => ({
      id: q.id,
      text: q.text,
      points: q.points,
      options: optionRows
        .filter((o) => o.questionId === q.id)
        .map((o) => ({ id: o.id, text: o.text })),
      selectedOptionId: answerRows.find((a) => a.questionId === q.id)?.optionId ?? null,
    })),
  };
}

/** Inicia (ou retoma) a tentativa do aluno — o relógio começa a contar aqui, no servidor. */
export const startExamAttemptFn = createServerFn({ method: "POST" })
  .validator(examIdSchema)
  .handler(async ({ data }): Promise<ExamAttemptState> => {
    const studentId = await requireStudentId();
    const [exam] = await db.select().from(exams).where(eq(exams.id, data.examId)).limit(1);
    if (!exam) throw new Error("Prova não encontrada.");
    if (!exam.opensAt || exam.opensAt > new Date()) {
      throw new Error("Essa prova ainda não está disponível.");
    }

    const [existing] = await db
      .select()
      .from(examAttempts)
      .where(and(eq(examAttempts.examId, data.examId), eq(examAttempts.studentId, studentId)))
      .limit(1);
    // Já enviada: não é erro, só devolve o resultado (revisitar a prova depois de terminar).
    if (!existing && Date.now() > endOfDayBrazil(exam.opensAt).getTime()) {
      throw new Error(
        "Essa prova já encerrou — ela só ficava disponível no dia em que foi aberta.",
      );
    }
    if (!existing) {
      await db.insert(examAttempts).values({ examId: data.examId, studentId });
    }

    return buildAttemptState(data.examId, studentId);
  });

/** Resincroniza o estado da tentativa em andamento (ex.: ao voltar o foco na aba). */
export const getExamAttemptStateFn = createServerFn({ method: "GET" })
  .validator(examIdSchema)
  .handler(async ({ data }): Promise<ExamAttemptState> => {
    const studentId = await requireStudentId();
    return buildAttemptState(data.examId, studentId);
  });

const saveAnswerSchema = z.object({
  examId: z.string().uuid(),
  questionId: z.string().uuid(),
  optionId: z.string().uuid(),
});

/** Salva a resposta assim que o aluno clica — não espera o "Finalizar". */
export const saveExamAnswerFn = createServerFn({ method: "POST" })
  .validator(saveAnswerSchema)
  .handler(async ({ data }) => {
    const studentId = await requireStudentId();
    const [exam] = await db.select().from(exams).where(eq(exams.id, data.examId)).limit(1);
    if (!exam) throw new Error("Prova não encontrada.");

    const [attempt] = await db
      .select()
      .from(examAttempts)
      .where(and(eq(examAttempts.examId, data.examId), eq(examAttempts.studentId, studentId)))
      .limit(1);
    if (!attempt || attempt.submittedAt) return;

    // Tolerância de 5s pra latência de rede — depois disso, ignora silenciosamente.
    const deadline = computeExamDeadline(attempt.startedAt, exam.durationMinutes, exam.opensAt!);
    if (Date.now() > deadline.getTime() + 5000) return;

    await db
      .insert(examAnswers)
      .values({ attemptId: attempt.id, questionId: data.questionId, optionId: data.optionId })
      .onConflictDoUpdate({
        target: [examAnswers.attemptId, examAnswers.questionId],
        set: { optionId: data.optionId, answeredAt: new Date() },
      });
  });

const submitSchema = z.object({ examId: z.string().uuid(), autoSubmitted: z.boolean().optional() });

/** Finaliza a tentativa e devolve o resultado. Idempotente. */
export const submitExamAttemptFn = createServerFn({ method: "POST" })
  .validator(submitSchema)
  .handler(async ({ data }): Promise<ExamAttemptState> => {
    const studentId = await requireStudentId();
    const [attempt] = await db
      .select()
      .from(examAttempts)
      .where(and(eq(examAttempts.examId, data.examId), eq(examAttempts.studentId, studentId)))
      .limit(1);
    if (!attempt) throw new Error("Você ainda não iniciou esta prova.");

    await finalizeExamAttempt(attempt.id, { autoSubmitted: data.autoSubmitted ?? false });
    return buildAttemptState(data.examId, studentId);
  });
