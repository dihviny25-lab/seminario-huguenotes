import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import { requireAnyLogin, requireOwnDiscipline } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { disciplines, readingMaterials } from "@/server/db/schema";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export type ReadingMaterial = {
  id: string;
  disciplineId: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileName: string;
  sequence: number;
  /** null = disponível já (ou disciplina sem data de início definida). */
  availableAt: string | null;
};

const disciplineIdSchema = z.object({ disciplineId: z.string().uuid() });

/** Materiais de leitura de uma disciplina — só o professor dono dela gerencia. */
export const listMyDisciplineMaterialsFn = createServerFn({ method: "GET" })
  .validator(disciplineIdSchema)
  .handler(async ({ data }): Promise<Array<ReadingMaterial>> => {
    await requireOwnDiscipline(data.disciplineId);
    const rows = await db
      .select()
      .from(readingMaterials)
      .where(eq(readingMaterials.disciplineId, data.disciplineId))
      .orderBy(asc(readingMaterials.sequence));
    // Visão do professor gerenciando o conteúdo — sempre "disponível", o
    // bloqueio por data é só pro lado do aluno lendo.
    return rows.map((row) => ({ ...row, availableAt: null }));
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

function selectMaterialColumns() {
  return {
    id: readingMaterials.id,
    disciplineId: readingMaterials.disciplineId,
    title: readingMaterials.title,
    description: readingMaterials.description,
    fileUrl: readingMaterials.fileUrl,
    fileName: readingMaterials.fileName,
    sequence: readingMaterials.sequence,
    startDate: disciplines.startDate,
  };
}

function withAvailability(
  row: Omit<ReadingMaterial, "availableAt"> & { startDate: string | null },
): ReadingMaterial {
  const { startDate, ...material } = row;
  const available = startDate === null || startDate <= todayIso();
  return { ...material, availableAt: available ? null : startDate };
}

/**
 * Todos os materiais do currículo, pra biblioteca do portal do aluno —
 * aparecem todos, mas os de disciplinas que ainda não começaram vêm
 * marcados com `availableAt` (o cliente mostra bloqueado até essa data).
 */
export const listAllReadingMaterialsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<ReadingMaterial>> => {
    await requireAnyLogin();
    const rows = await db
      .select(selectMaterialColumns())
      .from(readingMaterials)
      .innerJoin(disciplines, eq(disciplines.id, readingMaterials.disciplineId))
      .orderBy(asc(readingMaterials.sequence));
    return rows.map(withAvailability);
  },
);

/** Materiais de UMA disciplina — pra página do curso no portal (qualquer aluno/professor). */
export const listDisciplineMaterialsFn = createServerFn({ method: "GET" })
  .validator(disciplineIdSchema)
  .handler(async ({ data }): Promise<Array<ReadingMaterial>> => {
    await requireAnyLogin();
    const rows = await db
      .select(selectMaterialColumns())
      .from(readingMaterials)
      .innerJoin(disciplines, eq(disciplines.id, readingMaterials.disciplineId))
      .where(eq(readingMaterials.disciplineId, data.disciplineId))
      .orderBy(asc(readingMaterials.sequence));
    return rows.map(withAvailability);
  });
