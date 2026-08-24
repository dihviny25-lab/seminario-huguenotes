import { eq } from "drizzle-orm";

import { readAppSession } from "@/server/auth/session";
import { readAppStudentSession } from "@/server/auth/studentSession";
import { db } from "@/server/db/client";
import { auditLogs, students, teachers } from "@/server/db/schema";

type Actor = { actorType: "teacher" | "student"; actorId: string; actorName: string };

async function resolveActor(): Promise<Actor | null> {
  const [teacherSession, studentSession] = await Promise.all([
    readAppSession(),
    readAppStudentSession(),
  ]);

  if (teacherSession.data.teacherId) {
    const [teacher] = await db
      .select({ name: teachers.name })
      .from(teachers)
      .where(eq(teachers.id, teacherSession.data.teacherId))
      .limit(1);
    return {
      actorType: "teacher",
      actorId: teacherSession.data.teacherId,
      actorName: teacher?.name ?? "Professor",
    };
  }

  if (studentSession.data.studentId) {
    const [student] = await db
      .select({ name: students.name })
      .from(students)
      .where(eq(students.id, studentSession.data.studentId))
      .limit(1);
    return {
      actorType: "student",
      actorId: studentSession.data.studentId,
      actorName: student?.name ?? "Aluno",
    };
  }

  return null;
}

/**
 * Registra uma ação no log de auditoria (login/logout/ações do dia a dia).
 * Nunca lança erro — uma falha aqui não pode derrubar a ação principal que
 * está sendo auditada.
 */
export async function logAudit(action: string, description: string): Promise<void> {
  try {
    const actor = await resolveActor();
    if (!actor) return;
    await db.insert(auditLogs).values({
      actorType: actor.actorType,
      actorId: actor.actorId,
      actorName: actor.actorName,
      action,
      description,
    });
  } catch {
    // Falha ao auditar não pode quebrar a ação que estava sendo registrada.
  }
}
