import { eq } from "drizzle-orm";

import { db } from "@/server/db/client";
import { disciplines } from "@/server/db/schema";

import { readAppSession } from "./session";

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
