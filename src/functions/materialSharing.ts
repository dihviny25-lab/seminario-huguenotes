import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { canAccessMaterial } from "@/lib/materialAccess";
import { logAudit } from "@/server/audit";
import { requireOwnDiscipline, requireTeacherId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import {
  disciplines,
  readingMaterialComments,
  readingMaterialShares,
  readingMaterials,
  teachers,
} from "@/server/db/schema";

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

/** Dono de uma apostila = dono da disciplina dela. Nulo se a disciplina ficou sem professor. */
async function getMaterialOwnerId(materialId: string): Promise<string | null> {
  const [row] = await db
    .select({ teacherId: disciplines.teacherId })
    .from(readingMaterials)
    .innerJoin(disciplines, eq(disciplines.id, readingMaterials.disciplineId))
    .where(eq(readingMaterials.id, materialId))
    .limit(1);
  return row?.teacherId ?? null;
}

async function resolveMaterialAccess(materialId: string, teacherId: string) {
  const [ownerId, shareRows] = await Promise.all([
    getMaterialOwnerId(materialId),
    db
      .select({ id: readingMaterialShares.id })
      .from(readingMaterialShares)
      .where(
        and(
          eq(readingMaterialShares.readingMaterialId, materialId),
          eq(readingMaterialShares.teacherId, teacherId),
        ),
      )
      .limit(1),
  ]);
  return { isOwner: ownerId === teacherId, isSharedWithMe: shareRows.length > 0 };
}

export type SharedMaterial = {
  id: string;
  disciplineId: string;
  disciplineName: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileName: string;
  sharedByName: string;
  /** Quando o compartilhamento foi feito (não a criação da apostila). */
  sharedAt: string;
};

/** Apostilas que outros professores compartilharam comigo — leitura e comentário. */
export const listSharedWithMeFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<SharedMaterial>> => {
    const teacherId = await requireTeacherId();

    const shareRows = await db
      .select({
        materialId: readingMaterialShares.readingMaterialId,
        sharedById: readingMaterialShares.sharedById,
        createdAt: readingMaterialShares.createdAt,
      })
      .from(readingMaterialShares)
      .where(eq(readingMaterialShares.teacherId, teacherId));
    if (shareRows.length === 0) return [];

    const materialIds = shareRows.map((s) => s.materialId);
    const sharedByIds = shareRows
      .map((s) => s.sharedById)
      .filter((id): id is string => id !== null);

    const [materialRows, sharedByRows] = await Promise.all([
      db
        .select({
          id: readingMaterials.id,
          disciplineId: readingMaterials.disciplineId,
          disciplineName: disciplines.discipline,
          title: readingMaterials.title,
          description: readingMaterials.description,
          fileUrl: readingMaterials.fileUrl,
          fileName: readingMaterials.fileName,
        })
        .from(readingMaterials)
        .innerJoin(disciplines, eq(disciplines.id, readingMaterials.disciplineId))
        .where(inArray(readingMaterials.id, materialIds)),
      sharedByIds.length === 0
        ? []
        : db
            .select({ id: teachers.id, name: teachers.name })
            .from(teachers)
            .where(inArray(teachers.id, sharedByIds)),
    ]);

    return shareRows.map((share) => {
      const material = materialRows.find((m) => m.id === share.materialId);
      const sharedBy = sharedByRows.find((t) => t.id === share.sharedById);
      return {
        id: share.materialId,
        disciplineId: material?.disciplineId ?? "",
        disciplineName: material?.disciplineName ?? "",
        title: material?.title ?? "",
        description: material?.description ?? null,
        fileUrl: material?.fileUrl ?? "",
        fileName: material?.fileName ?? "",
        sharedByName: sharedBy?.name ?? "Professor",
        sharedAt: share.createdAt.toISOString(),
      };
    });
  },
);

export type MaterialComment = {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
  mine: boolean;
};

/** Comentários da apostila — só quem tem acesso (dono ou compartilhado) pode ver. */
export const listMaterialCommentsFn = createServerFn({ method: "GET" })
  .validator(materialIdSchema)
  .handler(async ({ data }): Promise<Array<MaterialComment>> => {
    const teacherId = await requireTeacherId();
    const access = await resolveMaterialAccess(data.materialId, teacherId);
    if (!canAccessMaterial(access)) {
      throw new Error("Você não tem acesso a este material.");
    }

    const rows = await db
      .select()
      .from(readingMaterialComments)
      .where(eq(readingMaterialComments.readingMaterialId, data.materialId))
      .orderBy(asc(readingMaterialComments.createdAt));

    return rows.map((row) => ({
      id: row.id,
      authorName: row.authorName,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      mine: row.teacherId === teacherId,
    }));
  });

const createCommentSchema = z.object({
  materialId: z.string().uuid(),
  content: z.string().trim().min(1, "Escreva um comentário."),
});

/** Comenta a apostila — só quem tem acesso (dono ou compartilhado) pode comentar. */
export const createMaterialCommentFn = createServerFn({ method: "POST" })
  .validator(createCommentSchema)
  .handler(async ({ data }) => {
    const teacherId = await requireTeacherId();
    const access = await resolveMaterialAccess(data.materialId, teacherId);
    if (!canAccessMaterial(access)) {
      throw new Error("Você não tem acesso a este material.");
    }

    const [teacher] = await db
      .select({ name: teachers.name })
      .from(teachers)
      .where(eq(teachers.id, teacherId))
      .limit(1);

    await db.insert(readingMaterialComments).values({
      readingMaterialId: data.materialId,
      teacherId,
      authorName: teacher?.name ?? "Professor",
      content: data.content,
    });
  });

const deleteCommentSchema = z.object({ commentId: z.string().uuid() });

/** O autor apaga o próprio comentário; o dono da apostila apaga qualquer um, como moderação. */
export const deleteMaterialCommentFn = createServerFn({ method: "POST" })
  .validator(deleteCommentSchema)
  .handler(async ({ data }) => {
    const teacherId = await requireTeacherId();

    const [comment] = await db
      .select()
      .from(readingMaterialComments)
      .where(eq(readingMaterialComments.id, data.commentId))
      .limit(1);
    if (!comment) return;

    const isAuthor = comment.teacherId === teacherId;
    if (!isAuthor) {
      const ownerId = await getMaterialOwnerId(comment.readingMaterialId);
      if (ownerId !== teacherId) {
        throw new Error("Você só pode apagar o próprio comentário.");
      }
    }

    await db.delete(readingMaterialComments).where(eq(readingMaterialComments.id, data.commentId));
  });
