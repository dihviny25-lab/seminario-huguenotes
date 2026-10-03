import { eq } from "drizzle-orm";

import { db } from "@/server/db/client";
import { students, studentLessonAccess } from "@/server/db/schema";

// Reexportado daqui por conveniência (quem já importava `isLessonContentVisible`
// de `@/server/enrollment` continua funcionando) — mas a definição real mora em
// `@/server/files/access`, que precisa continuar sem tocar banco (ver o
// comentário lá), diferente deste arquivo.
export { isLessonContentVisible } from "@/server/files/access";

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
