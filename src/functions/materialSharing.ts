import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import { requireOwnDiscipline } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { readingMaterialShares, readingMaterials, teachers } from "@/server/db/schema";

/**
 * Resolve o material e confirma que quem pede é o dono da disciplina dele —
 * mesmo padrão de updateMaterialFn/deleteMaterialFn
 * (src/functions/readingMaterials.ts), reaproveitado aqui porque
 * readingMaterials não tem teacherId próprio: o dono é sempre o professor
 * dono da disciplina.
 */
async function requireOwnMaterial(materialId: string) {
  const [material] = await db
    .select()
    .from(readingMaterials)
    .where(eq(readingMaterials.id, materialId))
    .limit(1);
  if (!material) throw new Error("Material não encontrado.");
  const discipline = await requireOwnDiscipline(material.disciplineId);
  return { material, discipline };
}

const shareSchema = z.object({ materialId: z.string().uuid(), teacherId: z.string().uuid() });

/** Compartilha a apostila com um professor específico — leitura e comentário, nunca edição. */
export const shareMaterialFn = createServerFn({ method: "POST" })
  .validator(shareSchema)
  .handler(async ({ data }) => {
    const { material, discipline } = await requireOwnMaterial(data.materialId);
    if (data.teacherId === discipline.teacherId) {
      throw new Error("Você já é o dono deste material.");
    }

    await db
      .insert(readingMaterialShares)
      .values({
        readingMaterialId: data.materialId,
        teacherId: data.teacherId,
        sharedById: discipline.teacherId,
      })
      .onConflictDoNothing({
        target: [readingMaterialShares.readingMaterialId, readingMaterialShares.teacherId],
      });

    await logAudit(
      "apostila.compartilhar",
      `Compartilhou o material "${material.title}" com outro professor.`,
    );
  });

/** Remove o compartilhamento — o professor perde o acesso de leitura/comentário na hora. */
export const unshareMaterialFn = createServerFn({ method: "POST" })
  .validator(shareSchema)
  .handler(async ({ data }) => {
    const { material } = await requireOwnMaterial(data.materialId);

    await db
      .delete(readingMaterialShares)
      .where(
        and(
          eq(readingMaterialShares.readingMaterialId, data.materialId),
          eq(readingMaterialShares.teacherId, data.teacherId),
        ),
      );

    await logAudit(
      "apostila.descompartilhar",
      `Removeu o compartilhamento do material "${material.title}" com um professor.`,
    );
  });

export type MaterialShare = { teacherId: string; teacherName: string };

const materialIdSchema = z.object({ materialId: z.string().uuid() });

/** Professores com quem esta apostila já foi compartilhada — pro diálogo de compartilhar. */
export const listMaterialSharesFn = createServerFn({ method: "GET" })
  .validator(materialIdSchema)
  .handler(async ({ data }): Promise<Array<MaterialShare>> => {
    await requireOwnMaterial(data.materialId);

    return db
      .select({ teacherId: readingMaterialShares.teacherId, teacherName: teachers.name })
      .from(readingMaterialShares)
      .innerJoin(teachers, eq(teachers.id, readingMaterialShares.teacherId))
      .where(eq(readingMaterialShares.readingMaterialId, data.materialId))
      .orderBy(asc(teachers.name));
  });
