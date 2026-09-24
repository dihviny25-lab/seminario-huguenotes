import { eq } from "drizzle-orm";

import type { AnyIdentity } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { assignmentSubmissions, privateFiles } from "@/server/db/schema";

import { canReadFileRecord, type FileOwnerRecord, type FileOwnerType } from "./access";

/**
 * Registra um arquivo (recém-subido) como dono de `ownerType`/`ownerId` e
 * devolve o `id` do registro em `private_files`, pra a chamadora gravar em
 * `fileId` na tabela dona. `pathname` é a chave do objeto no bucket R2.
 * Sempre cria um registro novo (não faz upsert) — numa reedição, o
 * registro antigo fica órfão até uma rotina de retenção (fora do escopo
 * desta tarefa); nunca apagamos objeto em lote aqui.
 */
export async function registerPrivateFile(input: {
  pathname: string;
  originalName: string;
  contentType: string | null;
  ownerType: FileOwnerType;
  ownerId: string;
}): Promise<string> {
  const [row] = await db
    .insert(privateFiles)
    .values({
      blobPath: input.pathname,
      originalName: input.originalName,
      contentType: input.contentType,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
    })
    .returning({ id: privateFiles.id });
  return row.id;
}

async function resolveFileOwnerRecord(
  ownerType: FileOwnerType,
  ownerId: string,
): Promise<FileOwnerRecord | null> {
  if (ownerType === "assignment_submission") {
    const [row] = await db
      .select({ studentId: assignmentSubmissions.studentId })
      .from(assignmentSubmissions)
      .where(eq(assignmentSubmissions.id, ownerId))
      .limit(1);
    if (!row) return null;
    return { ownerType, studentId: row.studentId };
  }
  // reading_material, library_book, presentation_slide, video_lesson: não
  // precisam de dado extra do dono — canReadFileRecord já libera qualquer
  // identidade autenticada para esses tipos.
  return { ownerType };
}

export type PrivateFileRow = {
  id: string;
  blobPath: string;
  originalName: string;
  contentType: string | null;
  ownerType: FileOwnerType;
  ownerId: string;
};

export async function loadPrivateFile(fileId: string): Promise<PrivateFileRow | null> {
  const [row] = await db
    .select({
      id: privateFiles.id,
      blobPath: privateFiles.blobPath,
      originalName: privateFiles.originalName,
      contentType: privateFiles.contentType,
      ownerType: privateFiles.ownerType,
      ownerId: privateFiles.ownerId,
      deletedAt: privateFiles.deletedAt,
    })
    .from(privateFiles)
    .where(eq(privateFiles.id, fileId))
    .limit(1);
  if (!row || row.deletedAt) return null;
  return row;
}

/**
 * Decisão completa: carrega o registro de `private_files`, resolve o dono e
 * aplica `canReadFileRecord`. Arquivo inexistente, apagado ou sem permissão
 * resultam todos em `false` — sem diferença observável pra quem chama.
 */
export async function canReadPrivateFile(input: {
  fileId: string;
  identity: AnyIdentity;
}): Promise<boolean> {
  const file = await loadPrivateFile(input.fileId);
  if (!file) return false;
  const record = await resolveFileOwnerRecord(file.ownerType, file.ownerId);
  if (!record) return false;
  return canReadFileRecord(record, input.identity);
}
