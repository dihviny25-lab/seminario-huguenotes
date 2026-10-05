import { createFileRoute } from "@tanstack/react-router";
import { get as getBlob } from "@vercel/blob";
import { eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import { requireAdminId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { privateFiles } from "@/server/db/schema";
import { isStillOnVercelBlob, putObject } from "@/server/storage/r2";

// Confirmação textual explícita — evita que um clique/replay acidental (ou um
// scanner batendo em rotas admin) dispare a migração sem intenção humana.
const CONFIRM_TEXT = "MIGRAR";
// Lote pequeno de propósito: cada chamada é rápida, o dano de uma falha fica
// contido, e o histórico em audit_logs mostra o progresso passo a passo em
// vez de um resultado monolítico difícil de auditar depois.
const BATCH_LIMIT = 10;

const requestSchema = z.object({ confirm: z.literal(CONFIRM_TEXT) });

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, "_").slice(-180);
}

/**
 * Copia, um lote por vez (no máximo `BATCH_LIMIT`), os objetos que ainda
 * estão no Vercel Blob pro bucket R2 e atualiza `private_files.blob_path`
 * pra nova chave — não apaga nada do Blob original (retenção fica pra
 * depois de confirmar visualmente que a migração deu certo). Idempotente e
 * resumível: só olha registros cujo `blob_path` ainda não tem o formato de
 * chave do R2; chamadas repetidas avançam o restante aos poucos.
 *
 * `POST` explícito (nunca `GET` — essa chamada muda dado) com confirmação
 * textual no corpo e um registro persistente em `audit_logs` por lote, pra
 * ter um diário auditável do que foi migrado, quando e com que resultado.
 */
export const Route = createFileRoute("/api/admin/migrar-arquivos-r2")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await requireAdminId();
        } catch {
          return new Response(null, { status: 401 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          body = null;
        }
        const parsed = requestSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            {
              error: `Confirmação ausente ou incorreta. Envie { "confirm": "${CONFIRM_TEXT}" } no corpo da requisição.`,
            },
            { status: 400 },
          );
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
        const batch = pending.slice(0, BATCH_LIMIT);

        const migrated: string[] = [];
        const failed: Array<{ id: string; error: string }> = [];

        for (const row of batch) {
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

        const remaining = pending.length - batch.length;
        await logAudit(
          "storage.migrar_r2_lote",
          `Migração Blob→R2: lote de ${batch.length} processado (${migrated.length} migrados, ${failed.length} falharam), ${remaining} ainda pendentes.` +
            (failed.length > 0
              ? ` Falhas: ${failed.map((f) => `${f.id} (${f.error})`).join("; ")}`
              : ""),
        );

        return Response.json({
          total: rows.length,
          jaMigrados: rows.length - pending.length,
          pendentesAntesDoLote: pending.length,
          migradosNesteLote: migrated.length,
          falharam: failed,
          restantes: remaining,
        });
      },
    },
  },
});
