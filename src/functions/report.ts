import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { requireTeacherId } from "@/server/auth/guard";
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
};

export type StudentReport = {
  student: { id: string; name: string };
  rows: Array<StudentReportRow>;
};

const reportSchema = z.object({ studentId: z.string().uuid() });

/**
 * Consolida notas e faltas do aluno em todas as disciplinas do currículo —
 * usado só para gerar o relatório impresso, por isso não fica restrito às
 * disciplinas do professor logado (qualquer professor pode imprimir).
 */
export const getStudentReportFn = createServerFn({ method: "GET" })
  .validator(reportSchema)
  .handler(async ({ data }): Promise<StudentReport> => {
    await requireTeacherId();

    const [student] = await db
      .select({ id: students.id, name: students.name })
      .from(students)
      .where(eq(students.id, data.studentId))
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
          weight: assessments.weight,
        })
        .from(assessments)
        .where(inArray(assessments.disciplineId, disciplineIds)),
      db
        .select({ id: lessons.id, disciplineId: lessons.disciplineId })
        .from(lessons)
        .where(inArray(lessons.disciplineId, disciplineIds)),
    ]);

    const assessmentIds = assessmentRows.map((a) => a.id);
    const lessonIds = lessonRows.map((l) => l.id);

    const [studentGrades, studentAttendance] = await Promise.all([
      assessmentIds.length === 0
        ? []
        : db
            .select({ assessmentId: grades.assessmentId, score: grades.score })
            .from(grades)
            .where(
              and(
                inArray(grades.assessmentId, assessmentIds),
                eq(grades.studentId, data.studentId),
              ),
            ),
      lessonIds.length === 0
        ? []
        : db
            .select({ lessonId: attendance.lessonId, present: attendance.present })
            .from(attendance)
            .where(
              and(
                inArray(attendance.lessonId, lessonIds),
                eq(attendance.studentId, data.studentId),
              ),
            ),
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
      const totalWeight = scored.reduce((sum, s) => sum + s.weight, 0);
      const average =
        scored.length === 0 || totalWeight === 0
          ? null
          : scored.reduce((sum, s) => sum + s.score * s.weight, 0) / totalWeight;

      const disciplineLessons = lessonRows.filter((l) => l.disciplineId === discipline.id);
      const totalFaltas = disciplineLessons.filter((l) => absentLessonIds.has(l.id)).length;

      return {
        disciplineId: discipline.id,
        module: discipline.module,
        discipline: discipline.discipline,
        semester: discipline.semester,
        term: discipline.term,
        teacherName: discipline.teacherName,
        average,
        totalLessons: disciplineLessons.length,
        totalFaltas,
      };
    });

    return { student, rows };
  });
