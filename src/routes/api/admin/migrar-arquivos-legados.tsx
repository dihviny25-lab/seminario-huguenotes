import { createFileRoute } from "@tanstack/react-router";
import { put } from "@vercel/blob";
import { and, eq, isNull, isNotNull } from "drizzle-orm";

import { requireAdminId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import {
  assignmentSubmissions,
  libraryBooks,
  presentationSlides,
  readingMaterials,
  videoLessons,
} from "@/server/db/schema";
import type { FileOwnerType } from "@/server/files/access";
import { registerPrivateFile } from "@/server/files/privateFileAccess";

type LegacyRow = { id: string; fileUrl: string; fileName: string };

/**
 * Migra pro Blob privado os arquivos enviados antes da Task 1 de LGPD
 * (access: "public" → "private"). Idempotente e resumível: só olha linhas
 * com `file_id` nulo, então rodar de novo depois de uma falha parcial só
 * retoma de onde parou — nunca reprocessa o que já migrou. Não apaga o
 * blob público antigo (fica pra revisão administrativa separada).
 */
async function migrateOwnerType(
  ownerType: FileOwnerType,
  rows: LegacyRow[],
  onFileId: (id: string, fileId: string) => Promise<void>,
): Promise<{ migrated: string[]; failed: Array<{ id: string; error: string }> }> {
  const migrated: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const row of rows) {
    try {
      const response = await fetch(row.fileUrl);
      if (!response.ok || !response.body) {
        throw new Error(`download falhou: ${response.status}`);
      }
      const safeName = row.fileName.replace(/[/\\]/g, "_");
      const pathname = `migrated/${ownerType}/${row.id}-${safeName}`;
      const blob = await put(pathname, response.body, {
        access: "private",
        contentType: response.headers.get("content-type") ?? undefined,
        addRandomSuffix: false,
      });
      const fileId = await registerPrivateFile({
        pathname: blob.pathname,
        originalName: row.fileName,
        contentType: blob.contentType,
        ownerType,
        ownerId: row.id,
      });
      await onFileId(row.id, fileId);
      migrated.push(row.id);
    } catch (error) {
      failed.push({ id: row.id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { migrated, failed };
}

export const Route = createFileRoute("/api/admin/migrar-arquivos-legados")({
  server: {
    handlers: {
      GET: async () => {
        try {
          await requireAdminId();
        } catch {
          return new Response(null, { status: 401 });
        }

        const [materials, books, slides, submissions, videos] = await Promise.all([
          db
            .select({
              id: readingMaterials.id,
              fileUrl: readingMaterials.fileUrl,
              fileName: readingMaterials.fileName,
            })
            .from(readingMaterials)
            .where(isNull(readingMaterials.fileId)),
          db
            .select({
              id: libraryBooks.id,
              fileUrl: libraryBooks.fileUrl,
              fileName: libraryBooks.fileName,
            })
            .from(libraryBooks)
            .where(isNull(libraryBooks.fileId)),
          db
            .select({
              id: presentationSlides.id,
              fileUrl: presentationSlides.fileUrl,
              fileName: presentationSlides.fileName,
            })
            .from(presentationSlides)
            .where(isNull(presentationSlides.fileId)),
          db
            .select({
              id: assignmentSubmissions.id,
              fileUrl: assignmentSubmissions.fileUrl,
              fileName: assignmentSubmissions.fileName,
            })
            .from(assignmentSubmissions)
            .where(
              and(isNull(assignmentSubmissions.fileId), isNotNull(assignmentSubmissions.fileUrl)),
            ),
          db
            .select({
              id: videoLessons.id,
              fileUrl: videoLessons.fileUrl,
              fileName: videoLessons.title,
            })
            .from(videoLessons)
            .where(
              and(
                isNull(videoLessons.fileId),
                eq(videoLessons.source, "upload"),
                isNotNull(videoLessons.fileUrl),
              ),
            ),
        ]);

        const results = {
          reading_material: await migrateOwnerType(
            "reading_material",
            materials as LegacyRow[],
            async (id, fileId) =>
              void (await db
                .update(readingMaterials)
                .set({ fileId })
                .where(eq(readingMaterials.id, id))),
          ),
          library_book: await migrateOwnerType(
            "library_book",
            books as LegacyRow[],
            async (id, fileId) =>
              void (await db.update(libraryBooks).set({ fileId }).where(eq(libraryBooks.id, id))),
          ),
          presentation_slide: await migrateOwnerType(
            "presentation_slide",
            slides as LegacyRow[],
            async (id, fileId) =>
              void (await db
                .update(presentationSlides)
                .set({ fileId })
                .where(eq(presentationSlides.id, id))),
          ),
          assignment_submission: await migrateOwnerType(
            "assignment_submission",
            submissions as LegacyRow[],
            async (id, fileId) =>
              void (await db
                .update(assignmentSubmissions)
                .set({ fileId })
                .where(eq(assignmentSubmissions.id, id))),
          ),
          video_lesson: await migrateOwnerType(
            "video_lesson",
            videos as LegacyRow[],
            async (id, fileId) =>
              void (await db.update(videoLessons).set({ fileId }).where(eq(videoLessons.id, id))),
          ),
        };

        return Response.json(results);
      },
    },
  },
});
