import { createServerFn } from "@tanstack/react-start";
import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { extractYouTubeId } from "@/lib/youtube";
import { requireAnyLogin, requireOwnDiscipline, requireStudentId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { students, videoLessons, videoWatches } from "@/server/db/schema";

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

export type VideoWatchBoard = {
  totalActiveStudents: number;
  videos: Array<VideoLesson & { watchedCount: number; watchedByNames: string[] }>;
};

/** Vídeo-aulas + quantos/quais alunos já assistiram cada uma até o fim. */
export const getMyDisciplineVideoBoardFn = createServerFn({ method: "GET" })
  .validator(disciplineIdSchema)
  .handler(async ({ data }): Promise<VideoWatchBoard> => {
    await requireOwnDiscipline(data.disciplineId);

    const [activeStudents, videoRows] = await Promise.all([
      db.select({ id: students.id }).from(students).where(eq(students.active, true)),
      db
        .select()
        .from(videoLessons)
        .where(eq(videoLessons.disciplineId, data.disciplineId))
        .orderBy(asc(videoLessons.sequence)),
    ]);

    const videoIds = videoRows.map((v) => v.id);
    const watchRows =
      videoIds.length === 0
        ? []
        : await db
            .select({ videoLessonId: videoWatches.videoLessonId, studentName: students.name })
            .from(videoWatches)
            .innerJoin(students, eq(videoWatches.studentId, students.id))
            .where(inArray(videoWatches.videoLessonId, videoIds));

    const namesByVideo = new Map<string, string[]>();
    for (const row of watchRows) {
      const list = namesByVideo.get(row.videoLessonId) ?? [];
      list.push(row.studentName);
      namesByVideo.set(row.videoLessonId, list);
    }

    return {
      totalActiveStudents: activeStudents.length,
      videos: videoRows.map((video) => {
        const names = (namesByVideo.get(video.id) ?? []).sort();
        return { ...video, watchedCount: names.length, watchedByNames: names };
      }),
    };
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

/** Vídeo-aulas de UMA disciplina — pra página do curso no portal (qualquer aluno/professor). */
export const listDisciplineVideoLessonsFn = createServerFn({ method: "GET" })
  .validator(disciplineIdSchema)
  .handler(async ({ data }): Promise<Array<VideoLesson>> => {
    await requireAnyLogin();
    return db
      .select()
      .from(videoLessons)
      .where(eq(videoLessons.disciplineId, data.disciplineId))
      .orderBy(asc(videoLessons.sequence));
  });

/** IDs das vídeo-aulas que o próprio aluno já concluiu. */
export const listMyWatchedVideosFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<string>> => {
    const studentId = await requireStudentId();
    const rows = await db
      .select({ videoLessonId: videoWatches.videoLessonId })
      .from(videoWatches)
      .where(eq(videoWatches.studentId, studentId));
    return rows.map((r) => r.videoLessonId);
  },
);

const markWatchedSchema = z.object({ videoLessonId: z.string().uuid() });

/** Chamado automaticamente pelo player quando o vídeo chega ao fim. Idempotente. */
export const markVideoWatchedFn = createServerFn({ method: "POST" })
  .validator(markWatchedSchema)
  .handler(async ({ data }) => {
    const studentId = await requireStudentId();
    await db
      .insert(videoWatches)
      .values({ videoLessonId: data.videoLessonId, studentId })
      .onConflictDoNothing();
  });
