import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { requireAdminId, requireTeacherId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { students } from "@/server/db/schema";

export type Student = {
  id: string;
  name: string;
  email: string | null;
  active: boolean;
};

export const listStudentsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<Student>> => {
    await requireTeacherId();
    return db
      .select({
        id: students.id,
        name: students.name,
        email: students.email,
        active: students.active,
      })
      .from(students)
      .orderBy(asc(students.name));
  },
);

const createSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Informe um e-mail válido.")
    .optional()
    .or(z.literal("")),
});

export const createStudentFn = createServerFn({ method: "POST" })
  .validator(createSchema)
  .handler(async ({ data }) => {
    await requireAdminId();
    const [row] = await db
      .insert(students)
      .values({ name: data.name, email: data.email || null })
      .returning({ id: students.id });
    return row;
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Informe o nome."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Informe um e-mail válido.")
    .optional()
    .or(z.literal("")),
});

export const updateStudentFn = createServerFn({ method: "POST" })
  .validator(updateSchema)
  .handler(async ({ data }) => {
    await requireAdminId();
    await db
      .update(students)
      .set({ name: data.name, email: data.email || null })
      .where(eq(students.id, data.id));
  });

const setActiveSchema = z.object({ id: z.string().uuid(), active: z.boolean() });

export const setStudentActiveFn = createServerFn({ method: "POST" })
  .validator(setActiveSchema)
  .handler(async ({ data }) => {
    await requireAdminId();
    await db.update(students).set({ active: data.active }).where(eq(students.id, data.id));
  });

const deleteSchema = z.object({ id: z.string().uuid() });

export const deleteStudentFn = createServerFn({ method: "POST" })
  .validator(deleteSchema)
  .handler(async ({ data }) => {
    await requireAdminId();
    await db.delete(students).where(eq(students.id, data.id));
  });

const bulkCreateSchema = z.object({
  students: z.array(
    z.object({
      name: z.string().trim().min(1),
      email: z.string().trim().nullable(),
    }),
  ),
});

export type BulkCreateResult = { created: number; skipped: Array<string> };

/** Importação por planilha: pula quem já existe (mesmo nome, sem diferenciar maiúsculas). */
export const bulkCreateStudentsFn = createServerFn({ method: "POST" })
  .validator(bulkCreateSchema)
  .handler(async ({ data }): Promise<BulkCreateResult> => {
    await requireAdminId();

    const existing = await db.select({ name: students.name }).from(students);
    const existingNames = new Set(existing.map((s) => s.name.trim().toLowerCase()));

    const seenInBatch = new Set<string>();
    const toInsert: Array<{ name: string; email: string | null }> = [];
    const skipped: Array<string> = [];

    for (const row of data.students) {
      const key = row.name.toLowerCase();
      if (existingNames.has(key) || seenInBatch.has(key)) {
        skipped.push(row.name);
        continue;
      }
      seenInBatch.add(key);
      toInsert.push({ name: row.name, email: row.email || null });
    }

    if (toInsert.length > 0) {
      await db.insert(students).values(toInsert);
    }

    return { created: toInsert.length, skipped };
  });
