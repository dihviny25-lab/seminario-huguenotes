import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { extractYouTubeId } from "@/lib/youtube";
import { requireAnyLogin, requireOwnDiscipline } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { videoLessons } from "@/server/db/schema";

export type VideoLesson = {
  id: string;
  disciplineId: string;
  title: string;
  youtubeUrl: string;
  sequence: number;
};

const disciplineIdSchema = z.object({ disciplineId: z.string().uuid() });

/** Vídeo-aulas de uma disciplina — só o professor dono dela pode gerenciar. */
export const listMyDisciplineVideosFn = createServerFn({ method: "GET" })
  .validator(disciplineIdSchema)
  .handler(async ({ data }): Promise<Array<VideoLesson>> => {
    await requireOwnDiscipline(data.disciplineId);
    return db
      .select()
      .from(videoLessons)
      .where(eq(videoLessons.disciplineId, data.disciplineId))
      .orderBy(asc(videoLessons.sequence));
  });

const createSchema = z.object({
  disciplineId: z.string().uuid(),
  title: z.string().trim().min(1, "Informe um título."),
  youtubeUrl: z
    .string()
    .trim()
    .refine((url) => extractYouTubeId(url) !== null, "Link do YouTube inválido."),
});

export const createVideoLessonFn = createServerFn({ method: "POST" })
  .validator(createSchema)
  .handler(async ({ data }) => {
    await requireOwnDiscipline(data.disciplineId);

    const existing = await db
      .select({ sequence: videoLessons.sequence })
      .from(videoLessons)
      .where(eq(videoLessons.disciplineId, data.disciplineId));
    const nextSequence = existing.reduce((max, v) => Math.max(max, v.sequence), 0) + 1;

    const [row] = await db
      .insert(videoLessons)
      .values({
        disciplineId: data.disciplineId,
        title: data.title,
        youtubeUrl: data.youtubeUrl,
        sequence: nextSequence,
      })
      .returning({ id: videoLessons.id });
    return row;
  });

const deleteSchema = z.object({ disciplineId: z.string().uuid(), videoId: z.string().uuid() });

export const deleteVideoLessonFn = createServerFn({ method: "POST" })
  .validator(deleteSchema)
  .handler(async ({ data }) => {
    await requireOwnDiscipline(data.disciplineId);
    await db.delete(videoLessons).where(eq(videoLessons.id, data.videoId));
  });

/**
 * Todas as vídeo-aulas do currículo, pra montar a biblioteca do portal do
 * aluno — acessível pra qualquer professor ou aluno logado (não é público).
 */
export const listAllVideoLessonsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<VideoLesson>> => {
    await requireAnyLogin();
    return db.select().from(videoLessons).orderBy(asc(videoLessons.sequence));
  },
);
