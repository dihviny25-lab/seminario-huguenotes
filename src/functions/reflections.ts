import { createServerFn } from "@tanstack/react-start";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { REFLECTION_PROMPTS, pickNextPrompt } from "@/lib/reflectionPrompts";
import { requireStudentId, requireTeacherId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { reflectionComments, spiritualReflections, teachers } from "@/server/db/schema";

export type ReflectionComment = {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
};

export type Reflection = {
  id: string;
  prompt: string;
  content: string;
  createdAt: string;
  comments: Array<ReflectionComment>;
};

async function buildReflections(studentId: string): Promise<Array<Reflection>> {
  const rows = await db
    .select()
    .from(spiritualReflections)
    .where(eq(spiritualReflections.studentId, studentId))
    .orderBy(desc(spiritualReflections.createdAt));

  const ids = rows.map((r) => r.id);
  const comments =
    ids.length === 0
      ? []
      : await db
          .select()
          .from(reflectionComments)
          .where(inArray(reflectionComments.reflectionId, ids))
          .orderBy(asc(reflectionComments.createdAt));

  return rows.map((row) => ({
    id: row.id,
    prompt: row.prompt,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    comments: comments
      .filter((c) => c.reflectionId === row.id)
      .map((c) => ({
        id: c.id,
        authorName: c.authorName,
        content: c.content,
        createdAt: c.createdAt.toISOString(),
      })),
  }));
}

/** Próxima pergunta pro aluno — evita repetir as usadas recentemente. */
export const getNextReflectionPromptFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<string> => {
    const studentId = await requireStudentId();
    const recent = await db
      .select({ prompt: spiritualReflections.prompt })
      .from(spiritualReflections)
      .where(eq(spiritualReflections.studentId, studentId))
      .orderBy(desc(spiritualReflections.createdAt))
      .limit(REFLECTION_PROMPTS.length - 1);
    return pickNextPrompt(recent.map((r) => r.prompt));
  },
);

const createReflectionSchema = z.object({
  prompt: z.string().min(1),
  content: z.string().trim().min(1, "Escreva sua reflexão."),
});

export const createReflectionFn = createServerFn({ method: "POST" })
  .validator(createReflectionSchema)
  .handler(async ({ data }) => {
    const studentId = await requireStudentId();
    if (!REFLECTION_PROMPTS.includes(data.prompt)) {
      throw new Error("Pergunta inválida.");
    }
    await db
      .insert(spiritualReflections)
      .values({ studentId, prompt: data.prompt, content: data.content });
  });

/** Reflexões do próprio aluno — portal. */
export const listMyReflectionsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<Reflection>> => {
    const studentId = await requireStudentId();
    return buildReflections(studentId);
  },
);

const studentIdSchema = z.object({ studentId: z.string().uuid() });

/** Reflexões de um aluno — qualquer professor pode ver e comentar (acompanhamento espiritual). */
export const listStudentReflectionsFn = createServerFn({ method: "GET" })
  .validator(studentIdSchema)
  .handler(async ({ data }): Promise<Array<Reflection>> => {
    await requireTeacherId();
    return buildReflections(data.studentId);
  });

const commentSchema = z.object({
  reflectionId: z.string().uuid(),
  content: z.string().trim().min(1, "Escreva um comentário."),
});

export const addReflectionCommentFn = createServerFn({ method: "POST" })
  .validator(commentSchema)
  .handler(async ({ data }) => {
    const teacherId = await requireTeacherId();
    const [teacher] = await db
      .select({ name: teachers.name })
      .from(teachers)
      .where(eq(teachers.id, teacherId))
      .limit(1);

    await db.insert(reflectionComments).values({
      reflectionId: data.reflectionId,
      teacherId,
      authorName: teacher?.name ?? "Professor",
      content: data.content,
    });
  });
