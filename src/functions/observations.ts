import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { requireTeacherId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { studentObservations, teachers } from "@/server/db/schema";

const studentIdSchema = z.object({ studentId: z.string().uuid() });

export type StudentObservation = {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
  mine: boolean;
};

/** Lista as observações de um aluno, mais recentes primeiro. Qualquer professor logado pode ver. */
export const listStudentObservationsFn = createServerFn({ method: "GET" })
  .validator(studentIdSchema)
  .handler(async ({ data }): Promise<Array<StudentObservation>> => {
    const teacherId = await requireTeacherId();
    const rows = await db
      .select()
      .from(studentObservations)
      .where(eq(studentObservations.studentId, data.studentId))
      .orderBy(desc(studentObservations.createdAt));

    return rows.map((row) => ({
      id: row.id,
      authorName: row.authorName,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      mine: row.teacherId === teacherId,
    }));
  });

const createSchema = z.object({
  studentId: z.string().uuid(),
  content: z.string().trim().min(1, "Escreva a observação."),
});

export const createObservationFn = createServerFn({ method: "POST" })
  .validator(createSchema)
  .handler(async ({ data }) => {
    const teacherId = await requireTeacherId();
    const [teacher] = await db
      .select({ name: teachers.name })
      .from(teachers)
      .where(eq(teachers.id, teacherId))
      .limit(1);

    await db.insert(studentObservations).values({
      studentId: data.studentId,
      teacherId,
      authorName: teacher?.name ?? "Professor",
      content: data.content,
    });
  });

const deleteSchema = z.object({ id: z.string().uuid() });

/** Só quem escreveu pode apagar a própria observação. */
export const deleteObservationFn = createServerFn({ method: "POST" })
  .validator(deleteSchema)
  .handler(async ({ data }) => {
    const teacherId = await requireTeacherId();
    const [observation] = await db
      .select()
      .from(studentObservations)
      .where(eq(studentObservations.id, data.id))
      .limit(1);
    if (!observation) return;
    if (observation.teacherId !== teacherId) {
      throw new Error("Você só pode apagar observações que você mesmo escreveu.");
    }
    await db.delete(studentObservations).where(eq(studentObservations.id, data.id));
  });
