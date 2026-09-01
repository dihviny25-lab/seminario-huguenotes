import { MINIMUM_ATTENDANCE_RATIO, countFaltas } from "@/lib/attendance";
import { PASSING_AVERAGE, computeWeightedAverage } from "@/lib/grades";

export const ENDING_PROGRESS_RATIO = 0.8;
export const UPCOMING_LESSONS_LIMIT = 5;
export const FORUM_ITEMS_LIMIT = 8;
export const AT_RISK_LIMIT = 8;
export const PENDING_GRADING_LIMIT = 8;
export const MISSING_GRADES_LIMIT = 8;
export const MISSING_ATTENDANCE_LIMIT = 8;
export const MATERIAL_GAPS_LIMIT = 8;
export const ENDING_DISCIPLINES_LIMIT = 8;

export type DashboardInput = {
  /**
   * Sempre "minhas": este dashboard mostra só as disciplinas do professor
   * logado, mesmo para admin — ver "toda a escola" é outra funcionalidade.
   * Mantido como campo (em vez de removido) para não quebrar o formato do
   * payload; o valor é sempre o mesmo.
   */
  scope: "minhas";
  today: string;
  disciplines: Array<{ id: string; discipline: string; lessons: number | null }>;
  lessons: Array<{
    id: string;
    disciplineId: string;
    date: string | null;
    sequence: number;
    givenAt: string | null;
  }>;
  attendance: Array<{ lessonId: string; studentId: string; present: boolean }>;
  readingMaterials: Array<{ disciplineId: string }>;
  videoLessons: Array<{ disciplineId: string }>;
  assessments: Array<{ id: string; disciplineId: string; title: string; weight: number }>;
  grades: Array<{ assessmentId: string; studentId: string; score: number }>;
  assignments: Array<{ id: string; disciplineId: string; title: string }>;
  submissions: Array<{ assignmentId: string; submittedAt: string | null; gradedAt: string | null }>;
  threads: Array<{ id: string; disciplineId: string; title: string; createdAt: string }>;
  posts: Array<{ threadId: string; authorRole: "teacher" | "student"; createdAt: string }>;
  activeStudents: Array<{ id: string; name: string }>;
};

export type DisciplineProgress = {
  disciplineId: string;
  disciplineName: string;
  lessonsGiven: number;
  lessonsPlanned: number;
  progress: number;
  isStarted: boolean;
  isEnded: boolean;
};
export type MaterialGap = {
  disciplineId: string;
  disciplineName: string;
  missingApostila: boolean;
  missingVideos: boolean;
  lessonsGiven: number;
  apostilaCount: number;
  apostilaDeficit: number;
};
export type PendingGradingItem = {
  assignmentId: string;
  title: string;
  disciplineName: string;
  awaitingCount: number;
  oldestSubmittedAt: string;
};
export type MissingGradeItem = {
  assessmentId: string;
  disciplineId: string;
  title: string;
  disciplineName: string;
  studentsMissing: number;
};
export type MissingAttendanceItem = {
  disciplineId: string;
  disciplineName: string;
  lessonsWithoutAttendance: number;
};
export type EndingDisciplineItem = {
  disciplineId: string;
  disciplineName: string;
  lessonsGiven: number;
  lessonsPlanned: number;
  progress: number;
};
export type ForumActivityItem = {
  threadId: string;
  disciplineName: string;
  title: string;
  lastActivityAt: string;
  postCount: number;
  awaitingTeacherReply: boolean;
};
export type UpcomingLessonItem = {
  disciplineId: string;
  disciplineName: string;
  date: string;
  sequence: number;
};
export type AtRiskStudentItem = {
  studentId: string;
  studentName: string;
  disciplines: Array<{ disciplineName: string; reason: "media" | "frequencia" | "ambos" }>;
};

export type TeacherDashboard = {
  scope: "minhas";
  counts: {
    pendingGrading: number;
    endingDisciplines: number;
    atRiskStudents: number;
    lessonsWithoutAttendance: number;
  };
  materialGaps: MaterialGap[];
  pendingGrading: PendingGradingItem[];
  missingGrades: MissingGradeItem[];
  missingAttendance: MissingAttendanceItem[];
  endingDisciplines: EndingDisciplineItem[];
  forum: ForumActivityItem[];
  upcomingLessons: UpcomingLessonItem[];
  atRiskStudents: AtRiskStudentItem[];
};

/** Aula "dada" = tem data e a data já passou (ou é hoje). */
function isPastLesson(date: string | null, today: string): boolean {
  return date !== null && date <= today;
}

export function computeDisciplineProgress(
  discipline: { id: string; discipline: string; lessons: number | null },
  lessons: Array<{ disciplineId: string; date: string | null }>,
  today: string,
): DisciplineProgress {
  const mine = lessons.filter((l) => l.disciplineId === discipline.id);
  const lessonsGiven = mine.filter((l) => isPastLesson(l.date, today)).length;
  const lessonsPlanned = discipline.lessons ?? mine.length;
  const progress = lessonsPlanned > 0 ? lessonsGiven / lessonsPlanned : 0;
  return {
    disciplineId: discipline.id,
    disciplineName: discipline.discipline,
    lessonsGiven,
    lessonsPlanned,
    progress,
    isStarted: lessonsGiven >= 1,
    isEnded: progress >= 1,
  };
}

function progressByDiscipline(input: DashboardInput): Map<string, DisciplineProgress> {
  return new Map(
    input.disciplines.map((d) => [d.id, computeDisciplineProgress(d, input.lessons, input.today)]),
  );
}

export function pickEndingDisciplines(input: DashboardInput): EndingDisciplineItem[] {
  return [...progressByDiscipline(input).values()]
    .filter((p) => p.progress >= ENDING_PROGRESS_RATIO && p.progress < 1)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, ENDING_DISCIPLINES_LIMIT)
    .map((p) => ({
      disciplineId: p.disciplineId,
      disciplineName: p.disciplineName,
      lessonsGiven: p.lessonsGiven,
      lessonsPlanned: p.lessonsPlanned,
      progress: p.progress,
    }));
}

export function pickMaterialGaps(input: DashboardInput): MaterialGap[] {
  const progress = progressByDiscipline(input);
  const gaps: MaterialGap[] = [];
  for (const d of input.disciplines) {
    const p = progress.get(d.id)!;
    if (!p.isStarted || p.isEnded) continue;
    const apostilaCount = input.readingMaterials.filter((m) => m.disciplineId === d.id).length;
    const videoCount = input.videoLessons.filter((v) => v.disciplineId === d.id).length;
    const apostilaDeficit = Math.max(0, p.lessonsGiven - apostilaCount);
    const missingApostila = apostilaCount === 0;
    const missingVideos = videoCount === 0;
    if (!missingApostila && !missingVideos && apostilaDeficit < 1) continue;
    gaps.push({
      disciplineId: d.id,
      disciplineName: d.discipline,
      missingApostila,
      missingVideos,
      lessonsGiven: p.lessonsGiven,
      apostilaCount,
      apostilaDeficit,
    });
  }
  return gaps.slice(0, MATERIAL_GAPS_LIMIT);
}

export function pickPendingGrading(input: DashboardInput): {
  items: PendingGradingItem[];
  total: number;
} {
  const disciplineName = new Map(input.disciplines.map((d) => [d.id, d.discipline]));
  const byAssignment = new Map<string, { title: string; disciplineName: string }>();
  for (const a of input.assignments) {
    byAssignment.set(a.id, {
      title: a.title,
      disciplineName: disciplineName.get(a.disciplineId) ?? "",
    });
  }
  const pending = input.submissions.filter((s) => s.submittedAt !== null && s.gradedAt === null);
  const items: PendingGradingItem[] = [];
  for (const [assignmentId, meta] of byAssignment) {
    const mine = pending.filter((s) => s.assignmentId === assignmentId);
    if (mine.length === 0) continue;
    const oldest = mine.reduce(
      (min, s) => (s.submittedAt! < min ? s.submittedAt! : min),
      mine[0].submittedAt!,
    );
    items.push({
      assignmentId,
      title: meta.title,
      disciplineName: meta.disciplineName,
      awaitingCount: mine.length,
      oldestSubmittedAt: oldest,
    });
  }
  items.sort((a, b) =>
    a.oldestSubmittedAt < b.oldestSubmittedAt
      ? -1
      : a.oldestSubmittedAt > b.oldestSubmittedAt
        ? 1
        : 0,
  );
  const total = items.reduce((sum, i) => sum + i.awaitingCount, 0);
  return { items: items.slice(0, PENDING_GRADING_LIMIT), total };
}

/**
 * Assessments com alunos sem nota, restrito a disciplinas "em andamento"
 * (já iniciadas e ainda não encerradas — mesmo critério de progress usado
 * por pickEndingDisciplines/pickMaterialGaps), pra não empilhar pendências
 * de disciplinas que nem começaram ou que já acabaram.
 */
export function pickMissingGrades(input: DashboardInput): MissingGradeItem[] {
  const active = input.activeStudents.length;
  const disciplineName = new Map(input.disciplines.map((d) => [d.id, d.discipline]));
  const progress = progressByDiscipline(input);
  const out: MissingGradeItem[] = [];
  for (const a of input.assessments) {
    const p = progress.get(a.disciplineId);
    if (!p || p.progress <= 0 || p.progress >= 1) continue;
    const distinct = new Set(
      input.grades.filter((g) => g.assessmentId === a.id).map((g) => g.studentId),
    ).size;
    const studentsMissing = active - distinct;
    if (studentsMissing < 1) continue;
    out.push({
      assessmentId: a.id,
      disciplineId: a.disciplineId,
      title: a.title,
      disciplineName: disciplineName.get(a.disciplineId) ?? "",
      studentsMissing,
    });
  }
  return out.slice(0, MISSING_GRADES_LIMIT);
}

/**
 * Aula "sem chamada" = já passou (date <= hoje) e o professor ainda não
 * lançou a chamada como realizada (givenAt === null). Antes usava "zero
 * linhas em attendance", que nunca zerava (aula 100% presente também não
 * gera linha em attendance); givenAt é o sinal real e acionável — some
 * assim que o professor clica em "Lançar chamada".
 */
export function pickMissingAttendance(input: DashboardInput): {
  items: MissingAttendanceItem[];
  total: number;
} {
  const items: MissingAttendanceItem[] = [];
  let total = 0;
  for (const d of input.disciplines) {
    const missing = input.lessons.filter(
      (l) => l.disciplineId === d.id && isPastLesson(l.date, input.today) && l.givenAt === null,
    ).length;
    if (missing < 1) continue;
    total += missing;
    items.push({
      disciplineId: d.id,
      disciplineName: d.discipline,
      lessonsWithoutAttendance: missing,
    });
  }
  return { items: items.slice(0, MISSING_ATTENDANCE_LIMIT), total };
}

export function pickUpcomingLessons(input: DashboardInput): UpcomingLessonItem[] {
  const disciplineName = new Map(input.disciplines.map((d) => [d.id, d.discipline]));
  return input.lessons
    .filter((l) => l.date !== null && l.date > input.today)
    .sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : a.sequence - b.sequence))
    .slice(0, UPCOMING_LESSONS_LIMIT)
    .map((l) => ({
      disciplineId: l.disciplineId,
      disciplineName: disciplineName.get(l.disciplineId) ?? "",
      date: l.date!,
      sequence: l.sequence,
    }));
}

export function pickForumActivity(input: DashboardInput): ForumActivityItem[] {
  const disciplineName = new Map(input.disciplines.map((d) => [d.id, d.discipline]));
  return input.threads
    .map((thread) => {
      const posts = input.posts
        .filter((p) => p.threadId === thread.id)
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
      const last = posts[posts.length - 1];
      const lastActivityAt =
        last && last.createdAt > thread.createdAt ? last.createdAt : thread.createdAt;
      return {
        threadId: thread.id,
        disciplineName: disciplineName.get(thread.disciplineId) ?? "",
        title: thread.title,
        lastActivityAt,
        postCount: posts.length,
        awaitingTeacherReply: last ? last.authorRole === "student" : false,
      };
    })
    .sort((a, b) => {
      if (a.awaitingTeacherReply !== b.awaitingTeacherReply) return a.awaitingTeacherReply ? -1 : 1;
      return a.lastActivityAt < b.lastActivityAt ? 1 : a.lastActivityAt > b.lastActivityAt ? -1 : 0;
    })
    .slice(0, FORUM_ITEMS_LIMIT);
}

export function pickAtRiskStudents(input: DashboardInput): {
  items: AtRiskStudentItem[];
  total: number;
} {
  const progress = progressByDiscipline(input);
  const absentByStudent = new Map<string, Set<string>>();
  for (const a of input.attendance) {
    if (a.present) continue;
    if (!absentByStudent.has(a.studentId)) absentByStudent.set(a.studentId, new Set());
    absentByStudent.get(a.studentId)!.add(a.lessonId);
  }

  // Índice O(1) por "assessmentId:studentId" — evita varrer input.grades inteiro
  // dentro do laço mais interno (disciplina × aluno × avaliação).
  const gradeByKey = new Map<string, number>();
  for (const g of input.grades) {
    gradeByKey.set(`${g.assessmentId}:${g.studentId}`, g.score);
  }

  const byStudent = new Map<string, AtRiskStudentItem>();
  for (const d of input.disciplines) {
    const p = progress.get(d.id)!;
    if (!p.isStarted || p.isEnded) continue;
    const disciplineAssessments = input.assessments.filter((a) => a.disciplineId === d.id);
    const pastLessonIds = input.lessons
      .filter((l) => l.disciplineId === d.id && isPastLesson(l.date, input.today))
      .map((l) => l.id);

    for (const student of input.activeStudents) {
      const scored = disciplineAssessments
        .map((a) => {
          const score = gradeByKey.get(`${a.id}:${student.id}`);
          return score !== undefined ? { score, weight: a.weight } : null;
        })
        .filter((x): x is { score: number; weight: number } => x !== null);
      const average = computeWeightedAverage(scored);
      const atRiskMedia = average !== null && average < PASSING_AVERAGE;

      const absent = absentByStudent.get(student.id) ?? new Set<string>();
      const faltas = countFaltas(pastLessonIds, absent);
      const ratio =
        pastLessonIds.length > 0 ? (pastLessonIds.length - faltas) / pastLessonIds.length : null;
      const atRiskFreq = ratio !== null && ratio < MINIMUM_ATTENDANCE_RATIO;

      if (!atRiskMedia && !atRiskFreq) continue;
      const reason: "media" | "frequencia" | "ambos" =
        atRiskMedia && atRiskFreq ? "ambos" : atRiskMedia ? "media" : "frequencia";
      if (!byStudent.has(student.id)) {
        byStudent.set(student.id, {
          studentId: student.id,
          studentName: student.name,
          disciplines: [],
        });
      }
      byStudent.get(student.id)!.disciplines.push({ disciplineName: d.discipline, reason });
    }
  }

  const all = [...byStudent.values()].sort((a, b) => b.disciplines.length - a.disciplines.length);
  const items = all.slice(0, AT_RISK_LIMIT).map((s) => ({
    ...s,
    disciplines: s.disciplines.slice(0, AT_RISK_LIMIT),
  }));
  return { items, total: all.length };
}

export function buildTeacherDashboard(input: DashboardInput): TeacherDashboard {
  const pendingGrading = pickPendingGrading(input);
  const missingAttendance = pickMissingAttendance(input);
  const endingDisciplines = pickEndingDisciplines(input);
  const atRiskStudents = pickAtRiskStudents(input);
  return {
    scope: input.scope,
    counts: {
      pendingGrading: pendingGrading.total,
      endingDisciplines: endingDisciplines.length,
      atRiskStudents: atRiskStudents.total,
      lessonsWithoutAttendance: missingAttendance.total,
    },
    materialGaps: pickMaterialGaps(input),
    pendingGrading: pendingGrading.items,
    missingGrades: pickMissingGrades(input),
    missingAttendance: missingAttendance.items,
    endingDisciplines,
    forum: pickForumActivity(input),
    upcomingLessons: pickUpcomingLessons(input),
    atRiskStudents: atRiskStudents.items,
  };
}
