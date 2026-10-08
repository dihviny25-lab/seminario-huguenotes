import { createServerFn } from "@tanstack/react-start";
import { eq, inArray } from "drizzle-orm";

import { buildTeacherDashboard, computeDisciplineProgress } from "@/lib/teacherDashboard";
import { effectiveTeacherId, isFutureOrToday } from "@/lib/teachingAssignments";
import { isSuperAdminTeacher, requireTeacherId } from "@/server/auth/guard";
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

/**
 * Snapshot completo do dashboard de quem está logado. Professor e admin
 * comum: sempre escopado às próprias disciplinas (ver `getSchoolDashboard`
 * pra saber por quê isso não muda pra admin). super_admin: escopo "escola
 * inteira" — todas as disciplinas, de qualquer professor.
 */
export const getTeacherDashboardFn = createServerFn({ method: "GET" }).handler(async () => {
  const teacherId = await requireTeacherId();
  const today = new Date().toISOString().slice(0, 10);

  if (await isSuperAdminTeacher(teacherId)) {
    return getSchoolDashboard(today);
  }

  const disciplineRows = await db
    .select({
      id: disciplines.id,
      discipline: disciplines.discipline,
      lessons: disciplines.lessons,
    })
    .from(disciplines)
    .where(eq(disciplines.teacherId, teacherId));
  const disciplineIds = disciplineRows.map((d) => d.id);

  // Substituições pontuais aparecem na agenda do professor, mas não tornam a
  // disciplina inteira propriedade dele nem liberam notas/provas/materiais.
  const assignedLessonRows = await db
    .select({
      disciplineId: lessons.disciplineId,
      disciplineName: disciplines.discipline,
      date: lessons.date,
      sequence: lessons.sequence,
    })
    .from(lessons)
    .innerJoin(disciplines, eq(lessons.disciplineId, disciplines.id))
    .where(eq(lessons.teacherId, teacherId));

  // Disciplinas de terceiros onde este professor só tem substituições
  // pontuais — precisam do próprio cálculo de "em andamento", já que elas
  // não entram no `disciplineRows`/`lessonRows` principal (esse é escopado
  // às disciplinas do professor).
  const assignedDisciplineIds = [
    ...new Set(
      assignedLessonRows
        .map((lesson) => lesson.disciplineId)
        .filter((id) => !disciplineIds.includes(id)),
    ),
  ];
  const [assignedDisciplineRows, assignedDisciplineLessonRows] =
    assignedDisciplineIds.length === 0
      ? [[], []]
      : await Promise.all([
          db
            .select({
              id: disciplines.id,
              discipline: disciplines.discipline,
              lessons: disciplines.lessons,
            })
            .from(disciplines)
            .where(inArray(disciplines.id, assignedDisciplineIds)),
          db
            .select({ disciplineId: lessons.disciplineId, givenAt: lessons.givenAt })
            .from(lessons)
            .where(inArray(lessons.disciplineId, assignedDisciplineIds)),
        ]);
  const assignedDisciplineLessonsForProgress = assignedDisciplineLessonRows.map((l) => ({
    disciplineId: l.disciplineId,
    givenAt: l.givenAt ? l.givenAt.toISOString() : null,
  }));
  const assignedDisciplineProgress = new Map(
    assignedDisciplineRows.map((d) => [
      d.id,
      computeDisciplineProgress(d, assignedDisciplineLessonsForProgress),
    ]),
  );

  function addAssignedUpcoming<T extends ReturnType<typeof buildTeacherDashboard>>(
    dashboard: T,
  ): T {
    const extras = assignedLessonRows
      .filter((lesson) => {
        if (disciplineIds.includes(lesson.disciplineId)) return false;
        if (lesson.date === null || !isFutureOrToday(lesson.date, today)) return false;
        const progress = assignedDisciplineProgress.get(lesson.disciplineId);
        return progress ? progress.isStarted && !progress.isEnded : false;
      })
      .map((lesson) => ({
        disciplineId: lesson.disciplineId,
        disciplineName: lesson.disciplineName,
        teacherName: null,
        date: lesson.date!,
        sequence: lesson.sequence,
      }));
    dashboard.upcomingLessons = [...dashboard.upcomingLessons, ...extras]
      .sort((a, b) => a.date.localeCompare(b.date) || a.sequence - b.sequence)
      .slice(0, 5);
    return dashboard;
  }

  const activeStudentRows = await db
    .select({ id: students.id, name: students.name })
    .from(students)
    .where(eq(students.active, true));

  if (disciplineIds.length === 0) {
    return addAssignedUpcoming(
      buildTeacherDashboard({
        scope: "minhas",
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
      }),
    );
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
        teacherId: lessons.teacherId,
        givenAt: lessons.givenAt,
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

  const effectiveLessonRows = lessonRows.filter(
    (lesson) => effectiveTeacherId(lesson.teacherId, teacherId) === teacherId,
  );
  const lessonIds = effectiveLessonRows.map((l) => l.id);
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

  return addAssignedUpcoming(
    buildTeacherDashboard({
      scope: "minhas",
      today,
      disciplines: disciplineRows,
      lessons: effectiveLessonRows.map(({ teacherId: _teacherId, ...lesson }) => ({
        ...lesson,
        givenAt: lesson.givenAt ? lesson.givenAt.toISOString() : null,
      })),
      // Sem o filtro de professor efetivo — ver doc de DashboardInput.allLessons.
      // Uma disciplina cujas aulas dadas foram todas substituídas por outro
      // professor não pode parecer "não iniciada" pra quem é dono dela.
      allLessons: lessonRows.map((lesson) => ({
        disciplineId: lesson.disciplineId,
        givenAt: lesson.givenAt ? lesson.givenAt.toISOString() : null,
      })),
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
    }),
  );
});

/**
 * Mesma forma do dashboard do professor, só que sem filtro de dono — todas
 * as disciplinas da escola, de qualquer professor. Só pra super_admin (ver
 * isSuperAdminTeacher). Mantido separado do caminho "minhas" acima em vez
 * de enfiar um `if` em cada passo: a lógica de substituição pontual
 * (assignedLessonRows/addAssignedUpcoming) não faz sentido aqui — toda
 * disciplina já está incluída, não tem "aula emprestada" pra adicionar.
 */
async function getSchoolDashboard(today: string) {
  const disciplineRows = await db
    .select({
      id: disciplines.id,
      discipline: disciplines.discipline,
      lessons: disciplines.lessons,
      teacherName: teachers.name,
    })
    .from(disciplines)
    .leftJoin(teachers, eq(disciplines.teacherId, teachers.id));
  const disciplineIds = disciplineRows.map((d) => d.id);

  const activeStudentRows = await db
    .select({ id: students.id, name: students.name })
    .from(students)
    .where(eq(students.active, true));

  if (disciplineIds.length === 0) {
    return buildTeacherDashboard({
      scope: "escola",
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

  const [lessonRows, readingMaterialRows, videoLessonRows, assessmentRows, assignmentRows, threadRows] =
    await Promise.all([
      db
        .select({
          id: lessons.id,
          disciplineId: lessons.disciplineId,
          date: lessons.date,
          sequence: lessons.sequence,
          givenAt: lessons.givenAt,
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
    scope: "escola",
    today,
    disciplines: disciplineRows,
    lessons: lessonRows.map((lesson) => ({
      ...lesson,
      givenAt: lesson.givenAt ? lesson.givenAt.toISOString() : null,
    })),
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
}
