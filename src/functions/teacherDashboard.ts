import { createServerFn } from "@tanstack/react-start";
import { eq, inArray } from "drizzle-orm";

import { buildTeacherDashboard, type DashboardInput } from "@/lib/teacherDashboard";
import { requireTeacherId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import {
  assessments,
  assignmentSubmissions,
  assignments,
  attendance,
  disciplines,
  forumPosts,
  forumThreads,
  grades,
  lessons,
  readingMaterials,
  students,
  teachers,
  videoLessons,
} from "@/server/db/schema";

export type { TeacherDashboard } from "@/lib/teacherDashboard";

/** Snapshot completo do dashboard do professor logado (ou da escola, se admin). */
export const getTeacherDashboardFn = createServerFn({ method: "GET" }).handler(async () => {
  const teacherId = await requireTeacherId();
  const [me] = await db
    .select({ role: teachers.role })
    .from(teachers)
    .where(eq(teachers.id, teacherId))
    .limit(1);
  const isAdmin = me?.role === "admin";
  const scope: DashboardInput["scope"] = isAdmin ? "escola" : "minhas";
  const today = new Date().toISOString().slice(0, 10);

  const disciplineRows = await db
    .select({
      id: disciplines.id,
      discipline: disciplines.discipline,
      lessons: disciplines.lessons,
    })
    .from(disciplines)
    .where(isAdmin ? undefined : eq(disciplines.teacherId, teacherId));
  const disciplineIds = disciplineRows.map((d) => d.id);

  const activeStudentRows = await db
    .select({ id: students.id, name: students.name })
    .from(students)
    .where(eq(students.active, true));

  if (disciplineIds.length === 0) {
    return buildTeacherDashboard({
      scope,
      today,
      disciplines: [],
      lessons: [],
      attendance: [],
      readingMaterials: [],
      videoLessons: [],
      assessments: [],
      grades: [],
      assignments: [],
      submissions: [],
      threads: [],
      posts: [],
      activeStudents: activeStudentRows,
    });
  }

  const [
    lessonRows,
    readingMaterialRows,
    videoLessonRows,
    assessmentRows,
    assignmentRows,
    threadRows,
  ] = await Promise.all([
    db
      .select({
        id: lessons.id,
        disciplineId: lessons.disciplineId,
        date: lessons.date,
        sequence: lessons.sequence,
      })
      .from(lessons)
      .where(inArray(lessons.disciplineId, disciplineIds)),
    db
      .select({ disciplineId: readingMaterials.disciplineId })
      .from(readingMaterials)
      .where(inArray(readingMaterials.disciplineId, disciplineIds)),
    db
      .select({ disciplineId: videoLessons.disciplineId })
      .from(videoLessons)
      .where(inArray(videoLessons.disciplineId, disciplineIds)),
    db
      .select({
        id: assessments.id,
        disciplineId: assessments.disciplineId,
        title: assessments.title,
        weight: assessments.weight,
      })
      .from(assessments)
      .where(inArray(assessments.disciplineId, disciplineIds)),
    db
      .select({
        id: assignments.id,
        disciplineId: assignments.disciplineId,
        title: assignments.title,
      })
      .from(assignments)
      .where(inArray(assignments.disciplineId, disciplineIds)),
    db
      .select({
        id: forumThreads.id,
        disciplineId: forumThreads.disciplineId,
        title: forumThreads.title,
        createdAt: forumThreads.createdAt,
      })
      .from(forumThreads)
      .where(inArray(forumThreads.disciplineId, disciplineIds)),
  ]);

  const lessonIds = lessonRows.map((l) => l.id);
  const assessmentIds = assessmentRows.map((a) => a.id);
  const assignmentIds = assignmentRows.map((a) => a.id);
  const threadIds = threadRows.map((t) => t.id);

  const [attendanceRows, gradeRows, submissionRows, postRows] = await Promise.all([
    lessonIds.length === 0
      ? []
      : db
          .select({
            lessonId: attendance.lessonId,
            studentId: attendance.studentId,
            present: attendance.present,
          })
          .from(attendance)
          .where(inArray(attendance.lessonId, lessonIds)),
    assessmentIds.length === 0
      ? []
      : db
          .select({
            assessmentId: grades.assessmentId,
            studentId: grades.studentId,
            score: grades.score,
          })
          .from(grades)
          .where(inArray(grades.assessmentId, assessmentIds)),
    assignmentIds.length === 0
      ? []
      : db
          .select({
            assignmentId: assignmentSubmissions.assignmentId,
            submittedAt: assignmentSubmissions.submittedAt,
            gradedAt: assignmentSubmissions.gradedAt,
          })
          .from(assignmentSubmissions)
          .where(inArray(assignmentSubmissions.assignmentId, assignmentIds)),
    threadIds.length === 0
      ? []
      : db
          .select({
            threadId: forumPosts.threadId,
            authorRole: forumPosts.authorRole,
            createdAt: forumPosts.createdAt,
          })
          .from(forumPosts)
          .where(inArray(forumPosts.threadId, threadIds)),
  ]);

  return buildTeacherDashboard({
    scope,
    today,
    disciplines: disciplineRows,
    lessons: lessonRows,
    attendance: attendanceRows,
    readingMaterials: readingMaterialRows,
    videoLessons: videoLessonRows,
    assessments: assessmentRows.map((a) => ({ ...a, weight: Number(a.weight) })),
    grades: gradeRows.map((g) => ({ ...g, score: Number(g.score) })),
    assignments: assignmentRows,
    submissions: submissionRows.map((s) => ({
      assignmentId: s.assignmentId,
      submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
      gradedAt: s.gradedAt ? s.gradedAt.toISOString() : null,
    })),
    threads: threadRows.map((t) => ({
      id: t.id,
      disciplineId: t.disciplineId,
      title: t.title,
      createdAt: t.createdAt.toISOString(),
    })),
    posts: postRows.map((p) => ({
      threadId: p.threadId,
      authorRole: p.authorRole,
      createdAt: p.createdAt.toISOString(),
    })),
    activeStudents: activeStudentRows,
  });
});
