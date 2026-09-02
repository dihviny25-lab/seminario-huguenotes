export type OverviewAssignmentSubmission = {
  assignmentId: string;
  studentId: string;
  /** `assignmentSubmissions.gradedAt` — nulo enquanto a entrega aguarda correção. */
  gradedAt: string | null;
};

export type AssignmentSummary = { submitted: number; total: number; awaitingGrading: number };

/**
 * Resumo de tarefas por aluno: quantas das tarefas da disciplina ele já
 * entregou, e quantas dessas entregas ainda aguardam correção
 * (`gradedAt` nulo). "Total" conta toda tarefa da disciplina — ao
 * contrário de prova, tarefa não tem rascunho/publicação (decisão do
 * spec: toda tarefa criada já é visível ao aluno).
 */
export function summarizeAssignmentsByStudent(
  studentIds: Array<string>,
  totalAssignments: number,
  submissions: Array<OverviewAssignmentSubmission>,
): Map<string, AssignmentSummary> {
  const result = new Map<string, AssignmentSummary>();
  for (const studentId of studentIds) {
    const mySubmissions = submissions.filter((s) => s.studentId === studentId);
    result.set(studentId, {
      submitted: mySubmissions.length,
      total: totalAssignments,
      awaitingGrading: mySubmissions.filter((s) => s.gradedAt === null).length,
    });
  }
  return result;
}

export type OverviewExam = { id: string; opensAt: string | null };
export type OverviewExamAttempt = {
  examId: string;
  studentId: string;
  submittedAt: string | null;
};

export type ExamSummary = { taken: number; total: number };

/**
 * Resumo de provas por aluno. Só entram no "total" as provas já
 * publicadas (`opensAt` não nula, mesmo filtro de `listAvailableExamsFn`)
 * — prova em rascunho é invisível ao aluno e não pode pesar contra ele.
 * "Feita" é `examAttempts.submittedAt` preenchido — hoje toda prova é de
 * múltipla escolha e a nota sai na hora do envio (Fase 1, card 2).
 */
export function summarizeExamsByStudent(
  studentIds: Array<string>,
  exams: Array<OverviewExam>,
  attempts: Array<OverviewExamAttempt>,
): Map<string, ExamSummary> {
  const publishedIds = new Set(exams.filter((e) => e.opensAt !== null).map((e) => e.id));

  const result = new Map<string, ExamSummary>();
  for (const studentId of studentIds) {
    const taken = attempts.filter(
      (a) => a.studentId === studentId && a.submittedAt !== null && publishedIds.has(a.examId),
    ).length;
    result.set(studentId, { taken, total: publishedIds.size });
  }
  return result;
}
