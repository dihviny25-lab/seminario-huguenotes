import { and, asc, eq, inArray } from "drizzle-orm";

import { countFaltas } from "@/lib/attendance";
import { computeWeightedAverage } from "@/lib/grades";
import { db } from "@/server/db/client";
import {
  assessments,
  attendance,
  disciplines,
  grades,
  lessons,
  students,
  teachers,
} from "@/server/db/schema";

export type ClassReportAssessment = { id: string; title: string; maxScore: number };

export type ClassReportRow = {
  studentId: string;
  studentName: string;
  scores: Array<{ assessmentId: string; score: number | null }>;
  average: number | null;
  totalLessons: number;
  totalFaltas: number;
};

export type ClassReport = {
  discipline: { id: string; discipline: string; module: string; term: string };
  assessments: Array<ClassReportAssessment>;
  rows: Array<ClassReportRow>;
};

/**
 * Notas e faltas de TODOS os alunos ativos numa disciplina — o "boletim da
 * turma" que espelha a mesma disciplina/módulo/faltas usada em GradesTab e
 * AttendanceTab, só que consolidado numa tabela só, pronto pra imprimir.
 * Função pura de dados — mesma ressalva de `getStudentReportData` (só
 * importar de handlers server-only).
 */
export async function getClassReportData(disciplineId: string): Promise<ClassReport> {
  const [discipline] = await db
    .select({
      id: disciplines.id,
      discipline: disciplines.discipline,
      module: disciplines.module,
      term: disciplines.term,
    })
    .from(disciplines)
    .where(eq(disciplines.id, disciplineId))
    .limit(1);
  if (!discipline) throw new Error("Disciplina não encontrada.");

  const [studentRows, assessmentRows, lessonRows] = await Promise.all([
    db
      .select({ id: students.id, name: students.name })
      .from(students)
      .where(eq(students.active, true))
      .orderBy(asc(students.name)),
    db
      .select({
        id: assessments.id,
        title: assessments.title,
        maxScore: assessments.maxScore,
        weight: assessments.weight,
      })
      .from(assessments)
      .where(eq(assessments.disciplineId, disciplineId))
      .orderBy(asc(assessments.createdAt)),
    db
      .select({ id: lessons.id, givenAt: lessons.givenAt })
      .from(lessons)
      .where(eq(lessons.disciplineId, disciplineId)),
  ]);

  // Mesma regra do boletim individual: só conta aula com chamada lançada.
  const pastLessonRows = lessonRows.filter((l) => l.givenAt !== null);

  const assessmentIds = assessmentRows.map((a) => a.id);
  const lessonIds = pastLessonRows.map((l) => l.id);
  const studentIds = studentRows.map((s) => s.id);

  const [gradeRows, attendanceRows] = await Promise.all([
    assessmentIds.length === 0 || studentIds.length === 0
      ? []
      : db
          .select({
            assessmentId: grades.assessmentId,
            studentId: grades.studentId,
            score: grades.score,
          })
          .from(grades)
          .where(
            and(inArray(grades.assessmentId, assessmentIds), inArray(grades.studentId, studentIds)),
          ),
    lessonIds.length === 0 || studentIds.length === 0
      ? []
      : db
          .select({
            lessonId: attendance.lessonId,
            studentId: attendance.studentId,
            present: attendance.present,
          })
          .from(attendance)
          .where(
            and(inArray(attendance.lessonId, lessonIds), inArray(attendance.studentId, studentIds)),
          ),
  ]);

  const assessmentWeightById = new Map(assessmentRows.map((a) => [a.id, Number(a.weight)]));

  const rows: Array<ClassReportRow> = studentRows.map((student) => {
    const scoreByAssessment = new Map(
      gradeRows.filter((g) => g.studentId === student.id).map((g) => [g.assessmentId, g.score]),
    );
    const scores = assessmentRows.map((a) => {
      const raw = scoreByAssessment.get(a.id);
      return { assessmentId: a.id, score: raw === undefined ? null : Number(raw) };
    });
    const weighted = scores
      .filter((s): s is { assessmentId: string; score: number } => s.score !== null)
      .map((s) => ({ score: s.score, weight: assessmentWeightById.get(s.assessmentId) ?? 1 }));
    const average = computeWeightedAverage(weighted);

    const absentLessonIds = new Set(
      attendanceRows
        .filter((a) => a.studentId === student.id && a.present === false)
        .map((a) => a.lessonId),
    );
    const totalFaltas = countFaltas(lessonIds, absentLessonIds);

    return {
      studentId: student.id,
      studentName: student.name,
      scores,
      average,
      totalLessons: lessonIds.length,
      totalFaltas,
    };
  });

  return {
    discipline,
    assessments: assessmentRows.map((a) => ({
      id: a.id,
      title: a.title,
      maxScore: Number(a.maxScore),
    })),
    rows,
  };
}

export type StudentAssessmentScore = {
  title: string;
  score: number | null;
  maxScore: number;
  weight: number;
};

export type StudentReportRow = {
  disciplineId: string;
  module: string;
  discipline: string;
  semester: number;
  term: string;
  teacherName: string | null;
  average: number | null;
  totalLessons: number;
  totalFaltas: number;
  /** Fração de aulas presentes (0 a 1); `null` quando não há aulas lançadas. */
  attendanceRatio: number | null;
  assessments: Array<StudentAssessmentScore>;
};

export type StudentReport = {
  student: { id: string; name: string };
  rows: Array<StudentReportRow>;
};

/**
 * Consolida notas e faltas do aluno em todas as disciplinas do currículo.
 * Função pura de dados (sem checagem de auth) — só deve ser importada de
 * dentro de handlers server-only (createServerFn / server routes), nunca
 * de um componente de página, senão o bundle do client tenta arrastar
 * `@/server/db/*` junto.
 */
export async function getStudentReportData(studentId: string): Promise<StudentReport> {
  const [student] = await db
    .select({ id: students.id, name: students.name })
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);
  if (!student) throw new Error("Aluno não encontrado.");

  const disciplineRows = await db
    .select({
      id: disciplines.id,
      module: disciplines.module,
      discipline: disciplines.discipline,
      semester: disciplines.semester,
      term: disciplines.term,
      teacherName: teachers.name,
    })
    .from(disciplines)
    .leftJoin(teachers, eq(disciplines.teacherId, teachers.id))
    .orderBy(asc(disciplines.semester));

  const disciplineIds = disciplineRows.map((d) => d.id);
  if (disciplineIds.length === 0) return { student, rows: [] };

  const [assessmentRows, lessonRows] = await Promise.all([
    db
      .select({
        id: assessments.id,
        disciplineId: assessments.disciplineId,
        title: assessments.title,
        maxScore: assessments.maxScore,
        weight: assessments.weight,
      })
      .from(assessments)
      .where(inArray(assessments.disciplineId, disciplineIds))
      .orderBy(asc(assessments.createdAt)),
    db
      .select({ id: lessons.id, disciplineId: lessons.disciplineId, givenAt: lessons.givenAt })
      .from(lessons)
      .where(inArray(lessons.disciplineId, disciplineIds)),
  ]);

  // Só conta aula com chamada lançada — sem isso, disciplinas futuras (cujas datas já
  // foram todas cadastradas de uma vez) apareciam com 100% de frequência antes mesmo de começar.
  const pastLessonRows = lessonRows.filter((l) => l.givenAt !== null);

  const assessmentIds = assessmentRows.map((a) => a.id);
  const lessonIds = pastLessonRows.map((l) => l.id);

  const [studentGrades, studentAttendance] = await Promise.all([
    assessmentIds.length === 0
      ? []
      : db
          .select({ assessmentId: grades.assessmentId, score: grades.score })
          .from(grades)
          .where(and(inArray(grades.assessmentId, assessmentIds), eq(grades.studentId, studentId))),
    lessonIds.length === 0
      ? []
      : db
          .select({ lessonId: attendance.lessonId, present: attendance.present })
          .from(attendance)
          .where(and(inArray(attendance.lessonId, lessonIds), eq(attendance.studentId, studentId))),
  ]);

  const scoreByAssessment = new Map(studentGrades.map((g) => [g.assessmentId, g.score]));
  const absentLessonIds = new Set(
    studentAttendance.filter((a) => a.present === false).map((a) => a.lessonId),
  );

  const rows: Array<StudentReportRow> = disciplineRows.map((discipline) => {
    const disciplineAssessments = assessmentRows.filter((a) => a.disciplineId === discipline.id);
    const scored = disciplineAssessments
      .map((a) => {
        const score = scoreByAssessment.get(a.id);
        return score === undefined ? null : { score: Number(score), weight: Number(a.weight) };
      })
      .filter((s): s is { score: number; weight: number } => s !== null);
    const average = computeWeightedAverage(scored);

    const assessmentScores: Array<StudentAssessmentScore> = disciplineAssessments.map((a) => {
      const rawScore = scoreByAssessment.get(a.id);
      return {
        title: a.title,
        score: rawScore === undefined ? null : Number(rawScore),
        maxScore: Number(a.maxScore),
        weight: Number(a.weight),
      };
    });

    const disciplineLessons = pastLessonRows.filter((l) => l.disciplineId === discipline.id);
    const totalFaltas = countFaltas(
      disciplineLessons.map((l) => l.id),
      absentLessonIds,
    );
    const totalLessons = disciplineLessons.length;
    const attendanceRatio = totalLessons === 0 ? null : (totalLessons - totalFaltas) / totalLessons;

    return {
      disciplineId: discipline.id,
      module: discipline.module,
      discipline: discipline.discipline,
      semester: discipline.semester,
      term: discipline.term,
      teacherName: discipline.teacherName,
      average,
      totalLessons,
      totalFaltas,
      attendanceRatio,
      assessments: assessmentScores,
    };
  });

  return { student, rows };
}
