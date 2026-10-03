import { eq } from "drizzle-orm";

import { db } from "@/server/db/client";
import { students, studentLessonAccess } from "@/server/db/schema";

/**
 * `null` = aluno comum, sem restrição (currículo inteiro, como sempre foi).
 * `Set<string>` = aluno de matrícula seletiva — só essas aulas.
 */
export async function getStudentAccessibleLessonIds(
  studentId: string,
): Promise<Set<string> | null> {
  const [student] = await db
    .select({ selectiveEnrollment: students.selectiveEnrollment })
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);
  if (!student?.selectiveEnrollment) return null;

  const rows = await db
    .select({ lessonId: studentLessonAccess.lessonId })
    .from(studentLessonAccess)
    .where(eq(studentLessonAccess.studentId, studentId));
  return new Set(rows.map((r) => r.lessonId));
}

/**
 * `lessonId` nulo no conteúdo = material geral da disciplina, sempre visível.
 * Com `accessibleLessonIds` (aluno de matrícula seletiva), só aparece o
 * conteúdo cuja aula está liberada pra ele.
 */
export function isLessonContentVisible(
  lessonId: string | null,
  accessibleLessonIds: Set<string> | null,
): boolean {
  if (accessibleLessonIds === null) return true;
  if (lessonId === null) return true;
  return accessibleLessonIds.has(lessonId);
}
