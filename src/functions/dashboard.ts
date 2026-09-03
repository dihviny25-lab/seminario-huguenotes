import { and, eq, inArray } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getClassReportData } from "@/functions/reportData";
import { listMyChargesFn } from "@/functions/payments";
import { listMyWatchedVideosFn } from "@/functions/videoLessons";
import type { ChargeAlert, DisciplineOverviewRow } from "@/lib/dashboard";
import {
  buildChargeAlert,
  buildDisciplineOverview,
  pickNextLesson,
  selectUnwatchedVideos,
  summarizeAssignmentsByStudent,
  summarizeExamsByStudent,
  summarizeVideosByStudent,
} from "@/lib/dashboard";
import { requireOwnDiscipline, requireStudentId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import {
  assignments,
  assignmentSubmissions,
  disciplines,
  examAttempts,
  exams,
  lessons,
  videoLessons,
  videoWatches,
} from "@/server/db/schema";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export type StudentNextLesson = {
  id: string;
  disciplineId: string;
  disciplineName: string;
  date: string;
};

export type StudentUnwatchedVideo = {
  id: string;
  disciplineId: string;
  disciplineName: string;
  title: string;
};

export type StudentDashboard = {
  chargeAlert: ChargeAlert;
  nextLesson: StudentNextLesson | null;
  unwatchedVideos: Array<StudentUnwatchedVideo>;
};

/** Avisos do topo do portal do aluno: cobrança, próxima aula, vídeos novos. */
export const getStudentDashboardFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<StudentDashboard> => {
    await requireStudentId();
    const today = todayIso();

    const [myCharges, watchedIds, lessonRows, videoRows] = await Promise.all([
      listMyChargesFn(),
      listMyWatchedVideosFn(),
      db
        .select({
          id: lessons.id,
          disciplineId: lessons.disciplineId,
          disciplineName: disciplines.discipline,
          date: lessons.date,
        })
        .from(lessons)
        .innerJoin(disciplines, eq(disciplines.id, lessons.disciplineId)),
      db
        .select({
          id: videoLessons.id,
          disciplineId: videoLessons.disciplineId,
          disciplineName: disciplines.discipline,
          title: videoLessons.title,
          createdAt: videoLessons.createdAt,
        })
        .from(videoLessons)
        .innerJoin(disciplines, eq(disciplines.id, videoLessons.disciplineId)),
    ]);

    const chargeAlert = buildChargeAlert(
      myCharges.map((c) => ({
        chargeId: c.id,
        description: c.description,
        currentAmount: c.currentAmount,
        dueDate: c.dueDate,
        status: c.status,
      })),
      today,
    );

    const next = pickNextLesson(lessonRows, today);
    const nextLesson: StudentNextLesson | null = next
      ? {
          id: next.id,
          disciplineId: next.disciplineId,
          disciplineName: next.disciplineName,
          date: next.date!,
        }
      : null;

    const unwatchedVideos = selectUnwatchedVideos(
      videoRows.map((v) => ({ ...v, createdAt: v.createdAt.toISOString() })),
      watchedIds,
    ).map(({ id, disciplineId, disciplineName, title }) => ({
      id,
      disciplineId,
      disciplineName,
      title,
    }));

    return { chargeAlert, nextLesson, unwatchedVideos };
  },
);

const disciplineIdSchema = z.object({ disciplineId: z.string().uuid() });

export type DisciplineOverview = {
  discipline: { id: string; discipline: string; module: string; term: string };
  rows: Array<DisciplineOverviewRow>;
};

/**
 * Painel de acompanhamento da disciplina: nota, frequência, tarefas,
 * provas e vídeos de cada aluno ativo, numa tabela só.
 */
export const getDisciplineOverviewFn = createServerFn({ method: "GET" })
  .validator(disciplineIdSchema)
  .handler(async ({ data }): Promise<DisciplineOverview> => {
    await requireOwnDiscipline(data.disciplineId);

    const classReport = await getClassReportData(data.disciplineId);
    const studentIds = classReport.rows.map((r) => r.studentId);

    const [assignmentRows, examRows, videoRows] = await Promise.all([
      db
        .select({ id: assignments.id })
        .from(assignments)
        .where(eq(assignments.disciplineId, data.disciplineId)),
      db
        .select({ id: exams.id, opensAt: exams.opensAt })
        .from(exams)
        .where(eq(exams.disciplineId, data.disciplineId)),
      db
        .select({ id: videoLessons.id })
        .from(videoLessons)
        .where(eq(videoLessons.disciplineId, data.disciplineId)),
    ]);

    const assignmentIds = assignmentRows.map((a) => a.id);
    const examIds = examRows.map((e) => e.id);
    const videoIds = videoRows.map((v) => v.id);

    const [submissionRows, attemptRows, watchRows] = await Promise.all([
      assignmentIds.length === 0 || studentIds.length === 0
        ? []
        : db
            .select({
              assignmentId: assignmentSubmissions.assignmentId,
              studentId: assignmentSubmissions.studentId,
              gradedAt: assignmentSubmissions.gradedAt,
            })
            .from(assignmentSubmissions)
            .where(
              and(
                inArray(assignmentSubmissions.assignmentId, assignmentIds),
                inArray(assignmentSubmissions.studentId, studentIds),
              ),
            ),
      examIds.length === 0 || studentIds.length === 0
        ? []
        : db
            .select({
              examId: examAttempts.examId,
              studentId: examAttempts.studentId,
              submittedAt: examAttempts.submittedAt,
            })
            .from(examAttempts)
            .where(
              and(
                inArray(examAttempts.examId, examIds),
                inArray(examAttempts.studentId, studentIds),
              ),
            ),
      videoIds.length === 0 || studentIds.length === 0
        ? []
        : db
            .select({ videoId: videoWatches.videoLessonId, studentId: videoWatches.studentId })
            .from(videoWatches)
            .where(
              and(
                inArray(videoWatches.videoLessonId, videoIds),
                inArray(videoWatches.studentId, studentIds),
              ),
            ),
    ]);

    const assignmentSummaries = summarizeAssignmentsByStudent(
      studentIds,
      assignmentRows.length,
      submissionRows.map((s) => ({
        ...s,
        gradedAt: s.gradedAt ? s.gradedAt.toISOString() : null,
      })),
    );
    const examSummaries = summarizeExamsByStudent(
      studentIds,
      examRows.map((e) => ({ id: e.id, opensAt: e.opensAt ? e.opensAt.toISOString() : null })),
      attemptRows.map((a) => ({
        ...a,
        submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
      })),
    );
    const videoSummaries = summarizeVideosByStudent(studentIds, videoIds, watchRows);

    const rows = buildDisciplineOverview(
      classReport.rows.map((r) => ({
        studentId: r.studentId,
        studentName: r.studentName,
        average: r.average,
        totalLessons: r.totalLessons,
        totalFaltas: r.totalFaltas,
      })),
      assignmentSummaries,
      examSummaries,
      videoSummaries,
    );

    return { discipline: classReport.discipline, rows };
  });
