import { createServerFn } from "@tanstack/react-start";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { canDeleteThread } from "@/lib/forumPermissions";
import { logAudit } from "@/server/audit";
import { requireTeacherId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { teachers, teacherForumPosts, teacherForumThreads } from "@/server/db/schema";
import { sendPushToOwner } from "@/server/push";

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

const replyTeacherThreadSchema = z.object({
  threadId: z.string().uuid(),
  content: z.string().trim().min(1, "Escreva uma resposta."),
});

/** Responde no tópico do fórum interno e avisa por push quem já participou (menos quem respondeu). */
export const createTeacherPostFn = createServerFn({ method: "POST" })
  .validator(replyTeacherThreadSchema)
  .handler(async ({ data }) => {
    const teacherId = await requireTeacherId();
    const [teacher] = await db
      .select({ name: teachers.name })
      .from(teachers)
      .where(eq(teachers.id, teacherId))
      .limit(1);
    const authorName = teacher?.name ?? "Professor";

    // Pega quem já participou ANTES de inserir a resposta nova, pra poder
    // avisar todo mundo menos quem acabou de responder (mesmo padrão de
    // replyToThreadFn, src/functions/forum.ts:220-230).
    const previousPosts = await db
      .select({ authorTeacherId: teacherForumPosts.authorTeacherId })
      .from(teacherForumPosts)
      .where(eq(teacherForumPosts.threadId, data.threadId));

    await db.insert(teacherForumPosts).values({
      threadId: data.threadId,
      authorTeacherId: teacherId,
      authorName,
      content: data.content,
    });

    const [thread] = await db
      .select({ title: teacherForumThreads.title })
      .from(teacherForumThreads)
      .where(eq(teacherForumThreads.id, data.threadId))
      .limit(1);
    await logAudit(
      "forum_interno.responder",
      `Respondeu no tópico "${thread?.title ?? data.threadId}" do fórum interno.`,
    );

    const participantIds = new Set(
      previousPosts
        .map((post) => post.authorTeacherId)
        .filter((id): id is string => id !== null && id !== teacherId),
    );
    await Promise.all(
      [...participantIds].map((id) =>
        sendPushToOwner("teacher", id, {
          title: `Nova resposta: ${thread?.title ?? "Fórum interno"}`,
          body: `${authorName}: ${data.content.slice(0, 120)}`,
          url: "/painel/forum-interno",
        }),
      ),
    );
  });

/**
 * Apaga um tópico do fórum interno: admin sempre pode (moderação); o autor
 * só pode se ainda não houver nenhuma resposta — mesma regra de
 * canDeleteThread (Tarefa 3.1), só que "isModerator" aqui é "é admin" em vez
 * de "é dono da disciplina", porque o fórum interno não tem disciplina.
 */
export const deleteTeacherThreadFn = createServerFn({ method: "POST" })
  .validator(teacherThreadIdSchema)
  .handler(async ({ data }) => {
    const teacherId = await requireTeacherId();
    const [teacher] = await db
      .select({ role: teachers.role })
      .from(teachers)
      .where(eq(teachers.id, teacherId))
      .limit(1);
    const isModerator = teacher?.role === "admin";

    const [thread] = await db
      .select()
      .from(teacherForumThreads)
      .where(eq(teacherForumThreads.id, data.threadId))
      .limit(1);
    if (!thread) throw new Error("Tópico não encontrado.");
    const isAuthor = thread.authorTeacherId === teacherId;

    const postRows = await db
      .select({ id: teacherForumPosts.id })
      .from(teacherForumPosts)
      .where(eq(teacherForumPosts.threadId, data.threadId));
    // A mensagem inicial também é uma linha de teacherForumPosts — só conta
    // como "resposta" o que vier depois dela (mesma conta da Tarefa 3.1).
    const postCount = Math.max(0, postRows.length - 1);

    if (!canDeleteThread({ isModerator, isAuthor, postCount })) {
      throw new Error("Só é possível apagar um tópico que ainda não tem respostas.");
    }

    await db.delete(teacherForumThreads).where(eq(teacherForumThreads.id, data.threadId));

    // Auditoria só quando é admin moderando — o próprio autor apagando o
    // tópico vazio é correção trivial (mesma decisão da Tarefa 3.1).
    if (isModerator) {
      await logAudit(
        "forum_interno.apagar_topico",
        `Apagou o tópico "${thread.title}" do fórum interno.`,
      );
    }
  });

const deleteTeacherPostSchema = z.object({ postId: z.string().uuid() });

/** Apaga a própria mensagem, ou qualquer uma se for admin. */
export const deleteTeacherPostFn = createServerFn({ method: "POST" })
  .validator(deleteTeacherPostSchema)
  .handler(async ({ data }) => {
    const teacherId = await requireTeacherId();

    const [post] = await db
      .select()
      .from(teacherForumPosts)
      .where(eq(teacherForumPosts.id, data.postId))
      .limit(1);
    if (!post) return;

    const isAuthor = post.authorTeacherId === teacherId;
    if (!isAuthor) {
      const [teacher] = await db
        .select({ role: teachers.role })
        .from(teachers)
        .where(eq(teachers.id, teacherId))
        .limit(1);
      if (teacher?.role !== "admin") {
        throw new Error("Você só pode apagar a própria mensagem.");
      }
    }

    await db.delete(teacherForumPosts).where(eq(teacherForumPosts.id, data.postId));
  });
