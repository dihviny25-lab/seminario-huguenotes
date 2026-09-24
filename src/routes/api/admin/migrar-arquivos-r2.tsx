import { createFileRoute } from "@tanstack/react-router";
import { get as getBlob } from "@vercel/blob";
import { eq, isNull } from "drizzle-orm";

import { requireAdminId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { privateFiles } from "@/server/db/schema";
import { putObject } from "@/server/storage/r2";

const R2_KEY_PREFIXES = ["assignment/", "material/", "library/", "video/", "slide/", "migrated/"];

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, "_").slice(-180);
}

/** `true` só pros registros que ainda apontam pro Blob da Vercel (URL completa ou pathname antigo sem prefixo). */
function isStillOnVercelBlob(blobPath: string): boolean {
  return !R2_KEY_PREFIXES.some((prefix) => blobPath.startsWith(prefix));
}

/**
 * Copia, um a um, os objetos que ainda estão no Vercel Blob pro bucket R2 e
 * atualiza `private_files.blob_path` pra nova chave — não apaga nada do
 * Blob original (retenção fica pra depois de confirmar visualmente que a
 * migração deu certo). Idempotente e resumível: só olha registros cujo
 * `blob_path` ainda não tem o formato de chave do R2.
 */
export const Route = createFileRoute("/api/admin/migrar-arquivos-r2")({
  server: {
    handlers: {
      GET: async () => {
        try {
          await requireAdminId();
        } catch {
          return new Response(null, { status: 401 });
        }

        const rows = await db
          .select({
            id: privateFiles.id,
            blobPath: privateFiles.blobPath,
            originalName: privateFiles.originalName,
            ownerType: privateFiles.ownerType,
          })
          .from(privateFiles)
          .where(isNull(privateFiles.deletedAt));

        const pending = rows.filter((row) => isStillOnVercelBlob(row.blobPath));

        const migrated: string[] = [];
        const failed: Array<{ id: string; error: string }> = [];

        for (const row of pending) {
          try {
            const blob = await getBlob(row.blobPath, { access: "public" });
            if (!blob || blob.stream === null) throw new Error("Objeto não encontrado no Blob.");

            const contentLengthHeader = blob.headers.get("content-length");
            const contentLength = contentLengthHeader ? Number(contentLengthHeader) : NaN;
            if (!Number.isFinite(contentLength)) {
              throw new Error("Content-Length ausente na resposta do Blob.");
            }

            const key = `migrated/${row.ownerType}/${row.id}-${sanitizeFileName(row.originalName)}`;

            await putObject({
              key,
              body: blob.stream,
              contentType: blob.blob.contentType || null,
              contentLength,
            });

            await db.update(privateFiles).set({ blobPath: key }).where(eq(privateFiles.id, row.id));
            migrated.push(row.id);
          } catch (error) {
            failed.push({
              id: row.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        return Response.json({
          total: rows.length,
          jaMigrados: rows.length - pending.length,
          migradosAgora: migrated.length,
          falharam: failed,
        });
      },
    },
  },
});
