/** Janela de "vence em breve" pro alerta de cobrança do topo do portal do aluno. */
export const CHARGE_DUE_SOON_WINDOW_DAYS = 7;

export type ChargeUrgency = "overdue" | "due-soon" | "ok";

export type ChargeUrgencyInput = {
  status: "pending" | "paid" | "canceled";
  /** ISO "YYYY-MM-DD". */
  dueDate: string;
};

/**
 * Urgência de uma cobrança pro alerta do portal. Só `pending` pode ser
 * "overdue"/"due-soon" — `paid` e `canceled` são sempre "ok" (nenhum
 * alerta). Comparação por string ISO, nunca `Date` local — mesmo padrão de
 * `computeCurrentAmount` (`src/lib/payments.ts`).
 */
export function classifyCharge(charge: ChargeUrgencyInput, todayIso: string): ChargeUrgency {
  if (charge.status !== "pending") return "ok";
  if (charge.dueDate < todayIso) return "overdue";
  const daysUntilDue = Math.round(
    (Date.parse(charge.dueDate) - Date.parse(todayIso)) / (1000 * 60 * 60 * 24),
  );
  return daysUntilDue <= CHARGE_DUE_SOON_WINDOW_DAYS ? "due-soon" : "ok";
}

export type ChargeAlertItem = {
  chargeId: string;
  description: string;
  /** String, igual ao `Charge.currentAmount` de `src/functions/payments.ts`. */
  currentAmount: string;
  dueDate: string;
};

export type ChargeAlertInput = ChargeAlertItem & ChargeUrgencyInput;

export type ChargeAlert = { level: "overdue" | "due-soon"; featured: ChargeAlertItem } | null;

/**
 * Alerta de cobrança pro topo do portal: olha as cobranças `pending`,
 * classifica cada uma com `classifyCharge` e escolhe a mais urgente pra
 * destacar. "Vencida" tem prioridade sobre "vence em breve"; dentro do
 * mesmo nível, a de vencimento mais antigo vence a disputa. `null` quando
 * não há nada a dizer (nenhuma pendente, ou todas ainda longe do vencimento).
 */
export function buildChargeAlert(charges: Array<ChargeAlertInput>, todayIso: string): ChargeAlert {
  const urgent = charges
    .map((charge) => ({ charge, urgency: classifyCharge(charge, todayIso) }))
    .filter(
      (c): c is { charge: ChargeAlertInput; urgency: "overdue" | "due-soon" } => c.urgency !== "ok",
    );

  if (urgent.length === 0) return null;

  const overdue = urgent.filter((c) => c.urgency === "overdue");
  const pool = overdue.length > 0 ? overdue : urgent;
  const featured = pool.reduce((oldest, c) =>
    c.charge.dueDate < oldest.charge.dueDate ? c : oldest,
  );

  return {
    level: overdue.length > 0 ? "overdue" : "due-soon",
    featured: {
      chargeId: featured.charge.chargeId,
      description: featured.charge.description,
      currentAmount: featured.charge.currentAmount,
      dueDate: featured.charge.dueDate,
    },
  };
}

export type LessonForNextPick = {
  id: string;
  disciplineId: string;
  /** ISO "YYYY-MM-DD" ou nula (aula sem data marcada ainda). */
  date: string | null;
};

/**
 * A aula futura mais próxima (`date >= hoje`), ignorando aulas com `date`
 * nula. A aula de hoje ainda conta como "próxima" — a sobreposição com
 * "aula que já aconteceu" (`date <= hoje`, usada na frequência) é
 * deliberada (Global Constraint 8).
 */
export function pickNextLesson<T extends LessonForNextPick>(
  lessons: Array<T>,
  todayIso: string,
): T | null {
  const upcoming = lessons.filter(
    (lesson): lesson is T & { date: string } => lesson.date !== null && lesson.date >= todayIso,
  );
  if (upcoming.length === 0) return null;
  return upcoming.reduce((closest, lesson) => (lesson.date < closest.date ? lesson : closest));
}

export type VideoLessonForPortal = {
  id: string;
  disciplineId: string;
  title: string;
  /** ISO, `videoLessons.createdAt` — usado só pra ordenar, não exibido. */
  createdAt: string;
};

/**
 * Vídeo-aulas que o aluno ainda não concluiu, mais recentes primeiro,
 * limitadas a `limit`. `watchedVideoLessonIds` vem das linhas de
 * `video_watches` do próprio aluno (mesmo dado de `listMyWatchedVideosFn`).
 */
export function selectUnwatchedVideos<T extends VideoLessonForPortal>(
  videos: Array<T>,
  watchedVideoLessonIds: Array<string>,
  limit = 5,
): Array<T> {
  const watched = new Set(watchedVideoLessonIds);
  return videos
    .filter((video) => !watched.has(video.id))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);
}

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

export type OverviewVideoWatch = { videoId: string; studentId: string };

export type VideoSummary = { watched: number; total: number };

/** Resumo de vídeo-aulas assistidas por aluno, dentre as vídeo-aulas da disciplina. */
export function summarizeVideosByStudent(
  studentIds: Array<string>,
  videoIds: Array<string>,
  watches: Array<OverviewVideoWatch>,
): Map<string, VideoSummary> {
  const total = videoIds.length;
  const result = new Map<string, VideoSummary>();
  for (const studentId of studentIds) {
    const watched = new Set(watches.filter((w) => w.studentId === studentId).map((w) => w.videoId))
      .size;
    result.set(studentId, { watched, total });
  }
  return result;
}

export type DisciplineOverviewClassRow = {
  studentId: string;
  studentName: string;
  average: number | null;
  totalLessons: number;
  totalFaltas: number;
};

export type DisciplineOverviewRow = {
  studentId: string;
  studentName: string;
  average: number | null;
  /** Fração de aulas presentes (0 a 1); `null` quando a disciplina não tem aula lançada. */
  attendanceRatio: number | null;
  assignmentsSubmitted: number;
  assignmentsTotal: number;
  assignmentsAwaitingGrading: number;
  examsTaken: number;
  examsTotal: number;
  videosWatched: number;
  videosTotal: number;
};

/**
 * Junta nota e frequência (já calculadas por `getClassReportData`, uma
 * linha por aluno ativo) com os resumos de tarefas, provas e vídeos numa
 * única linha por aluno, pronta pra tabela de acompanhamento. Mesma
 * fórmula de frequência de `getStudentReportData` (`reportData.ts:281`):
 * `null` — nunca 100% falso — quando a disciplina ainda não tem nenhuma
 * aula lançada.
 */
export function buildDisciplineOverview(
  classRows: Array<DisciplineOverviewClassRow>,
  assignmentSummaries: Map<string, AssignmentSummary>,
  examSummaries: Map<string, ExamSummary>,
  videoSummaries: Map<string, VideoSummary>,
): Array<DisciplineOverviewRow> {
  return classRows.map((row) => {
    const attendanceRatio =
      row.totalLessons === 0 ? null : (row.totalLessons - row.totalFaltas) / row.totalLessons;
    const assignments = assignmentSummaries.get(row.studentId) ?? {
      submitted: 0,
      total: 0,
      awaitingGrading: 0,
    };
    const exams = examSummaries.get(row.studentId) ?? { taken: 0, total: 0 };
    const videos = videoSummaries.get(row.studentId) ?? { watched: 0, total: 0 };

    return {
      studentId: row.studentId,
      studentName: row.studentName,
      average: row.average,
      attendanceRatio,
      assignmentsSubmitted: assignments.submitted,
      assignmentsTotal: assignments.total,
      assignmentsAwaitingGrading: assignments.awaitingGrading,
      examsTaken: exams.taken,
      examsTotal: exams.total,
      videosWatched: videos.watched,
      videosTotal: videos.total,
    };
  });
}
