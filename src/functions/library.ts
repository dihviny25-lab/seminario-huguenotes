import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { requireAdminOrSelf, requireAnyLogin, requireTeacherId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { libraryBooks, teachers } from "@/server/db/schema";

export type LibraryBook = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  fileUrl: string;
  fileName: string;
  uploadedByName: string;
  createdAt: string;
};

/** Biblioteca virtual — qualquer professor ou aluno logado pode ver a lista. */
export const listLibraryBooksFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<LibraryBook>> => {
    await requireAnyLogin();
    const rows = await db.select().from(libraryBooks).orderBy(asc(libraryBooks.title));
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      author: row.author,
      description: row.description,
      fileUrl: row.fileUrl,
      fileName: row.fileName,
      uploadedByName: row.uploadedByName,
      createdAt: row.createdAt.toISOString(),
    }));
  },
);

const createSchema = z.object({
  title: z.string().trim().min(1, "Informe o título."),
  author: z.string().trim().optional(),
  description: z.string().trim().optional(),
  fileUrl: z.string().trim().url("URL de arquivo inválida."),
  fileName: z.string().trim().min(1),
});

export const createLibraryBookFn = createServerFn({ method: "POST" })
  .validator(createSchema)
  .handler(async ({ data }) => {
    const teacherId = await requireTeacherId();
    const [teacher] = await db
      .select({ name: teachers.name })
      .from(teachers)
      .where(eq(teachers.id, teacherId))
      .limit(1);

    const [row] = await db
      .insert(libraryBooks)
      .values({
        title: data.title,
        author: data.author || null,
        description: data.description || null,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        uploadedById: teacherId,
        uploadedByName: teacher?.name ?? "Professor",
      })
      .returning({ id: libraryBooks.id });
    return row;
  });

const deleteSchema = z.object({ bookId: z.string().uuid() });

/** Só quem subiu o livro (ou admin) pode apagar. */
export const deleteLibraryBookFn = createServerFn({ method: "POST" })
  .validator(deleteSchema)
  .handler(async ({ data }) => {
    const [book] = await db
      .select()
      .from(libraryBooks)
      .where(eq(libraryBooks.id, data.bookId))
      .limit(1);
    if (!book) return;

    await requireAdminOrSelf(book.uploadedById ?? "");
    await db.delete(libraryBooks).where(eq(libraryBooks.id, data.bookId));
  });
