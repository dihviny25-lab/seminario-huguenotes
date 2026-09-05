import { and, eq } from "drizzle-orm";

import { toDisplayName } from "@/lib/formatName";
import { db } from "@/server/db/client";
import { disciplines, lessons, students, teachers } from "@/server/db/schema";

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
 * Garante que existe uma sessão válida — de professor OU de aluno. Usado
 * pra conteúdo que os dois públicos podem ver (ex.: vídeo-aulas), mas que
 * não é público pra qualquer visitante.
 */
export async function requireAnyLogin(): Promise<void> {
  const [teacherSession, studentSession] = await Promise.all([
    readAppSession(),
    readAppStudentSession(),
  ]);
  if (!teacherSession.data.teacherId && !studentSession.data.studentId) {
    throw new Error("UNAUTHORIZED");
  }
}

export type AnyIdentity =
  | { role: "teacher"; id: string; name: string }
  | { role: "student"; id: string; name: string };

/**
 * Garante que existe uma sessão válida (professor OU aluno) e devolve quem
 * é — usado por conteúdo que os dois públicos podem criar (ex.: fórum),
 * onde a autoria precisa ser registrada.
 */
export async function requireAnyIdentity(): Promise<AnyIdentity> {
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
      role: "teacher",
      id: teacherSession.data.teacherId,
      name: teacher?.name ?? "Professor",
    };
  }

  if (studentSession.data.studentId) {
    const [student] = await db
      .select({ name: students.name })
      .from(students)
      .where(eq(students.id, studentSession.data.studentId))
      .limit(1);
    return {
      role: "student",
      id: studentSession.data.studentId,
      name: toDisplayName(student?.name ?? "Aluno"),
    };
  }

  throw new Error("UNAUTHORIZED");
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

/**
 * Autoriza ações limitadas a uma aula para seu professor efetivo: o override,
 * quando existe, ou o professor responsável pela disciplina por herança.
 * Também confirma que lessonId pertence à disciplineId informada.
 */
export async function requireAssignedLesson(disciplineId: string, lessonId: string) {
  const teacherId = await requireTeacherId();
  const [row] = await db
    .select({
      lesson: lessons,
      discipline: disciplines,
    })
    .from(lessons)
    .innerJoin(disciplines, eq(lessons.disciplineId, disciplines.id))
    .where(eq(lessons.id, lessonId))
    .limit(1);

  if (
    !row ||
    row.lesson.disciplineId !== disciplineId ||
    (row.lesson.teacherId ?? row.discipline.teacherId) !== teacherId
  ) {
    throw new Error("Aula não encontrada.");
  }
  return row;
}

/**
 * Autoriza a grade de chamada para o responsável padrão da disciplina ou um
 * professor com ao menos uma aula atribuída nela. O consumidor ainda deve
 * filtrar as aulas pelo professor efetivo antes de devolvê-las ao cliente.
 */
export async function requireAttendanceDiscipline(disciplineId: string) {
  const teacherId = await requireTeacherId();
  const [discipline] = await db
    .select()
    .from(disciplines)
    .where(eq(disciplines.id, disciplineId))
    .limit(1);

  if (!discipline) throw new Error("Disciplina não encontrada.");
  if (discipline.teacherId === teacherId) return { discipline, teacherId };

  const [assignedLesson] = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(and(eq(lessons.disciplineId, disciplineId), eq(lessons.teacherId, teacherId)))
    .limit(1);
  if (!assignedLesson) throw new Error("Disciplina não encontrada.");

  return { discipline, teacherId };
}
