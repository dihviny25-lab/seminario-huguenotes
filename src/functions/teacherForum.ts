import { createServerFn } from "@tanstack/react-start";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import { requireTeacherId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { teachers, teacherForumPosts, teacherForumThreads } from "@/server/db/schema";

export type TeacherForumThreadSummary = {
  id: string;
  title: string;
  authorName: string;
  createdAt: string;
  postCount: number;
};

/** Todos os tópicos do fórum interno, mais recentes primeiro. Só professor/admin. */
export const listTeacherThreadsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<TeacherForumThreadSummary>> => {
    await requireTeacherId();

    const threadRows = await db
      .select()
      .from(teacherForumThreads)
      .orderBy(desc(teacherForumThreads.createdAt));
    const threadIds = threadRows.map((t) => t.id);

    const postRows =
      threadIds.length === 0
        ? []
        : await db
            .select({ threadId: teacherForumPosts.threadId })
            .from(teacherForumPosts)
            .where(inArray(teacherForumPosts.threadId, threadIds));

    return threadRows.map((thread) => ({
      id: thread.id,
      title: thread.title,
      authorName: thread.authorName,
      createdAt: thread.createdAt.toISOString(),
      postCount: postRows.filter((p) => p.threadId === thread.id).length,
    }));
  },
);

const createTeacherThreadSchema = z.object({
  title: z.string().trim().min(1, "Informe um título."),
  content: z.string().trim().min(1, "Escreva a mensagem inicial."),
});

/** Cria o tópico do fórum interno já com a primeira mensagem. */
export const createTeacherThreadFn = createServerFn({ method: "POST" })
  .validator(createTeacherThreadSchema)
  .handler(async ({ data }) => {
    const teacherId = await requireTeacherId();
    const [teacher] = await db
      .select({ name: teachers.name })
      .from(teachers)
      .where(eq(teachers.id, teacherId))
      .limit(1);
    const authorName = teacher?.name ?? "Professor";

    const [thread] = await db
      .insert(teacherForumThreads)
      .values({ authorTeacherId: teacherId, authorName, title: data.title })
      .returning({ id: teacherForumThreads.id });

    await db.insert(teacherForumPosts).values({
      threadId: thread.id,
      authorTeacherId: teacherId,
      authorName,
      content: data.content,
    });

    await logAudit(
      "forum_interno.criar_topico",
      `Criou o tópico "${data.title}" no fórum interno.`,
    );
    return { threadId: thread.id };
  });

const teacherThreadIdSchema = z.object({ threadId: z.string().uuid() });

export type TeacherForumPost = {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
  mine: boolean;
};

export type TeacherForumThreadDetail = {
  id: string;
  title: string;
  /** O tópico foi criado por quem está logado agora — mesma ideia de ForumThreadDetail.mine. */
  mine: boolean;
  posts: Array<TeacherForumPost>;
};

/** Tópico do fórum interno + todas as mensagens, em ordem cronológica. */
export const getTeacherThreadFn = createServerFn({ method: "GET" })
  .validator(teacherThreadIdSchema)
  .handler(async ({ data }): Promise<TeacherForumThreadDetail> => {
    const teacherId = await requireTeacherId();

    const [thread] = await db
      .select()
      .from(teacherForumThreads)
      .where(eq(teacherForumThreads.id, data.threadId))
      .limit(1);
    if (!thread) throw new Error("Tópico não encontrado.");

    const postRows = await db
      .select()
      .from(teacherForumPosts)
      .where(eq(teacherForumPosts.threadId, data.threadId))
      .orderBy(asc(teacherForumPosts.createdAt));

    return {
      id: thread.id,
      title: thread.title,
      mine: thread.authorTeacherId === teacherId,
      posts: postRows.map((post) => ({
        id: post.id,
        authorName: post.authorName,
        content: post.content,
        createdAt: post.createdAt.toISOString(),
        mine: post.authorTeacherId === teacherId,
      })),
    };
  });
