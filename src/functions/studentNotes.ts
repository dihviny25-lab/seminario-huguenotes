import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { toDisplayName } from "@/lib/formatName";
import { requireStudentId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { forumPosts, forumThreads, students, studentNotes } from "@/server/db/schema";

export type StudentNote = {
  id: string;
  disciplineId: string;
  kind: "note" | "question";
  title: string | null;
  content: string;
  forumThreadId: string | null;
  createdAt: string;
  updatedAt: string;
};

function toNote(row: typeof studentNotes.$inferSelect): StudentNote {
  return {
    id: row.id,
    disciplineId: row.disciplineId,
    kind: row.kind,
    title: row.title,
    content: row.content,
    forumThreadId: row.forumThreadId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Verifica que a anotação existe e pertence ao aluno logado. */
async function requireOwnNote(noteId: string, studentId: string) {
  const [note] = await db.select().from(studentNotes).where(eq(studentNotes.id, noteId)).limit(1);
  if (!note || note.studentId !== studentId) {
    throw new Error("Anotação não encontrada.");
  }
  return note;
}

const disciplineIdSchema = z.object({ disciplineId: z.string().uuid() });

/** Anotações e dúvidas do aluno numa disciplina — mais recente primeiro. */
export const listMyNotesFn = createServerFn({ method: "GET" })
  .validator(disciplineIdSchema)
  .handler(async ({ data }): Promise<Array<StudentNote>> => {
    const studentId = await requireStudentId();
    const rows = await db
      .select()
      .from(studentNotes)
      .where(eq(studentNotes.studentId, studentId))
      .orderBy(desc(studentNotes.updatedAt));
    return rows.filter((row) => row.disciplineId === data.disciplineId).map(toNote);
  });

const createNoteSchema = z.object({
  disciplineId: z.string().uuid(),
  kind: z.enum(["note", "question"]).default("note"),
  title: z.string().trim().optional(),
  content: z.string().trim().min(1, "Escreva algo antes de salvar."),
});

export const createNoteFn = createServerFn({ method: "POST" })
  .validator(createNoteSchema)
  .handler(async ({ data }) => {
    const studentId = await requireStudentId();
    await db.insert(studentNotes).values({
      studentId,
      disciplineId: data.disciplineId,
      kind: data.kind,
      title: data.title || null,
      content: data.content,
    });
  });

const updateNoteSchema = z.object({
  noteId: z.string().uuid(),
  kind: z.enum(["note", "question"]),
  title: z.string().trim().optional(),
  content: z.string().trim().min(1, "Escreva algo antes de salvar."),
});

export const updateNoteFn = createServerFn({ method: "POST" })
  .validator(updateNoteSchema)
  .handler(async ({ data }) => {
    const studentId = await requireStudentId();
    const note = await requireOwnNote(data.noteId, studentId);
    await db
      .update(studentNotes)
      .set({
        kind: data.kind,
        title: data.title || null,
        content: data.content,
        updatedAt: new Date(),
      })
      .where(eq(studentNotes.id, note.id));
  });

const noteIdSchema = z.object({ noteId: z.string().uuid() });

export const deleteNoteFn = createServerFn({ method: "POST" })
  .validator(noteIdSchema)
  .handler(async ({ data }) => {
    const studentId = await requireStudentId();
    const note = await requireOwnNote(data.noteId, studentId);
    await db.delete(studentNotes).where(eq(studentNotes.id, note.id));
  });

/**
 * Transforma uma dúvida (kind "question") num tópico do fórum da disciplina,
 * visível pra turma toda — a anotação continua existindo, só passa a linkar
 * pro tópico criado.
 */
export const convertNoteToThreadFn = createServerFn({ method: "POST" })
  .validator(noteIdSchema)
  .handler(async ({ data }): Promise<{ threadId: string }> => {
    const studentId = await requireStudentId();
    const note = await requireOwnNote(data.noteId, studentId);
    if (note.kind !== "question") {
      throw new Error("Só dúvidas podem virar tópico no fórum.");
    }
    if (note.forumThreadId) {
      return { threadId: note.forumThreadId };
    }

    const [student] = await db
      .select({ name: students.name })
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);
    const authorName = toDisplayName(student?.name ?? "Aluno");

    const [thread] = await db
      .insert(forumThreads)
      .values({
        disciplineId: note.disciplineId,
        authorRole: "student",
        authorStudentId: studentId,
        authorName,
        title: note.title || "Dúvida",
      })
      .returning({ id: forumThreads.id });

    await db.insert(forumPosts).values({
      threadId: thread.id,
      authorRole: "student",
      authorStudentId: studentId,
      authorName,
      content: note.content,
    });

    await db
      .update(studentNotes)
      .set({ forumThreadId: thread.id })
      .where(eq(studentNotes.id, note.id));

    return { threadId: thread.id };
  });
