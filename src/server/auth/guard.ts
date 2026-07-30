import { eq } from "drizzle-orm";

import { db } from "@/server/db/client";
import { disciplines, teachers } from "@/server/db/schema";

import { readAppSession } from "./session";
import { readAppStudentSession } from "./studentSession";

/** Garante que existe um professor logado; lança erro caso contrário. */
export async function requireTeacherId(): Promise<string> {
  const session = await readAppSession();
  const teacherId = session.data.teacherId;
  if (!teacherId) {
    throw new Error("UNAUTHORIZED");
  }
  return teacherId;
}

/**
 * Garante que o professor logado é admin (acesso completo). Não-admins só
 * visualizam professores/alunos e editam o próprio perfil.
 */
export async function requireAdminId(): Promise<string> {
  const teacherId = await requireTeacherId();
  const [teacher] = await db
    .select({ role: teachers.role })
    .from(teachers)
    .where(eq(teachers.id, teacherId))
    .limit(1);
  if (teacher?.role !== "admin") {
    throw new Error("Só administradores podem fazer isso.");
  }
  return teacherId;
}

/**
 * Permite se o professor logado é admin OU se é o próprio alvo da ação —
 * usado para "editar meu próprio perfil" sem precisar ser admin.
 */
export async function requireAdminOrSelf(targetTeacherId: string): Promise<string> {
  const teacherId = await requireTeacherId();
  if (teacherId === targetTeacherId) return teacherId;

  const [teacher] = await db
    .select({ role: teachers.role })
    .from(teachers)
    .where(eq(teachers.id, teacherId))
    .limit(1);
  if (teacher?.role !== "admin") {
    throw new Error("Você só pode editar o seu próprio perfil.");
  }
  return teacherId;
}

/** Garante que existe um aluno logado (portal do aluno); lança erro caso contrário. */
export async function requireStudentId(): Promise<string> {
  const session = await readAppStudentSession();
  const studentId = session.data.studentId;
  if (!studentId) {
    throw new Error("UNAUTHORIZED");
  }
  return studentId;
}

/**
 * Garante que a disciplina existe e pertence ao professor logado — cada
 * professor só lança notas/faltas nas disciplinas que ele mesmo ministra.
 */
export async function requireOwnDiscipline(disciplineId: string) {
  const teacherId = await requireTeacherId();
  const [discipline] = await db
    .select()
    .from(disciplines)
    .where(eq(disciplines.id, disciplineId))
    .limit(1);

  if (!discipline || discipline.teacherId !== teacherId) {
    throw new Error("Disciplina não encontrada.");
  }
  return discipline;
}
