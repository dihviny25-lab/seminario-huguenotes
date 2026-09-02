import { and, eq, inArray } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  buildDisciplineOverview,
  summarizeAssignmentsByStudent,
  summarizeExamsByStudent,
  summarizeVideosByStudent,
} from "@/lib/dashboard";
import type { DisciplineOverviewRow } from "@/lib/dashboard";
import { getClassReportData } from "@/functions/reportData";
import { requireOwnDiscipline } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import {
  assignments,
  assignmentSubmissions,
  examAttempts,
  exams,
  videoLessons,
  videoWatches,
} from "@/server/db/schema";

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
