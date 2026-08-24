import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import { requireAnyLogin, requireOwnDiscipline } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { readingMaterials } from "@/server/db/schema";

export type ReadingMaterial = {
  id: string;
  disciplineId: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileName: string;
  sequence: number;
};

const disciplineIdSchema = z.object({ disciplineId: z.string().uuid() });

/** Materiais de leitura de uma disciplina — só o professor dono dela gerencia. */
export const listMyDisciplineMaterialsFn = createServerFn({ method: "GET" })
  .validator(disciplineIdSchema)
  .handler(async ({ data }): Promise<Array<ReadingMaterial>> => {
    await requireOwnDiscipline(data.disciplineId);
    return db
      .select()
      .from(readingMaterials)
      .where(eq(readingMaterials.disciplineId, data.disciplineId))
      .orderBy(asc(readingMaterials.sequence));
  });

const createSchema = z.object({
  disciplineId: z.string().uuid(),
  title: z.string().trim().min(1, "Informe um título."),
  description: z.string().trim().optional(),
  fileUrl: z.string().trim().url("URL de arquivo inválida."),
  fileName: z.string().trim().min(1),
});

export const createMaterialFn = createServerFn({ method: "POST" })
  .validator(createSchema)
  .handler(async ({ data }) => {
    const discipline = await requireOwnDiscipline(data.disciplineId);

    const existing = await db
      .select({ sequence: readingMaterials.sequence })
      .from(readingMaterials)
      .where(eq(readingMaterials.disciplineId, data.disciplineId));
    const nextSequence = existing.reduce((max, m) => Math.max(max, m.sequence), 0) + 1;

    const [row] = await db
      .insert(readingMaterials)
      .values({
        disciplineId: data.disciplineId,
        title: data.title,
        description: data.description || null,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        sequence: nextSequence,
      })
      .returning({ id: readingMaterials.id });
    await logAudit(
      "apostila.criar",
      `Adicionou o material "${data.title}" em ${discipline.discipline}.`,
    );
    return row;
  });

const updateSchema = z.object({
  disciplineId: z.string().uuid(),
  materialId: z.string().uuid(),
  title: z.string().trim().min(1, "Informe um título."),
  description: z.string().trim().optional(),
});

export const updateMaterialFn = createServerFn({ method: "POST" })
  .validator(updateSchema)
  .handler(async ({ data }) => {
    const discipline = await requireOwnDiscipline(data.disciplineId);
    await db
      .update(readingMaterials)
      .set({ title: data.title, description: data.description || null })
      .where(eq(readingMaterials.id, data.materialId));
    await logAudit(
      "apostila.editar",
      `Editou o material "${data.title}" em ${discipline.discipline}.`,
    );
  });

const deleteSchema = z.object({ disciplineId: z.string().uuid(), materialId: z.string().uuid() });

export const deleteMaterialFn = createServerFn({ method: "POST" })
  .validator(deleteSchema)
  .handler(async ({ data }) => {
    const discipline = await requireOwnDiscipline(data.disciplineId);
    const [material] = await db
      .select({ title: readingMaterials.title })
      .from(readingMaterials)
      .where(eq(readingMaterials.id, data.materialId))
      .limit(1);
    await db.delete(readingMaterials).where(eq(readingMaterials.id, data.materialId));
    await logAudit(
      "apostila.apagar",
      `Apagou o material "${material?.title ?? data.materialId}" em ${discipline.discipline}.`,
    );
  });

/** Todos os materiais do currículo, pra biblioteca do portal do aluno. */
export const listAllReadingMaterialsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<ReadingMaterial>> => {
    await requireAnyLogin();
    return db.select().from(readingMaterials).orderBy(asc(readingMaterials.sequence));
  },
);

/** Materiais de UMA disciplina — pra página do curso no portal (qualquer aluno/professor). */
export const listDisciplineMaterialsFn = createServerFn({ method: "GET" })
  .validator(disciplineIdSchema)
  .handler(async ({ data }): Promise<Array<ReadingMaterial>> => {
    await requireAnyLogin();
    return db
      .select()
      .from(readingMaterials)
      .where(eq(readingMaterials.disciplineId, data.disciplineId))
      .orderBy(asc(readingMaterials.sequence));
  });
