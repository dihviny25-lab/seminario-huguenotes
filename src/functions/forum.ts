import { createServerFn } from "@tanstack/react-start";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import { requireAnyIdentity, requireOwnDiscipline } from "@/server/auth/guard";
import { sendPushToOwner } from "@/server/push";
import { db } from "@/server/db/client";
import { disciplines, forumPosts, forumThreads } from "@/server/db/schema";

const disciplineIdSchema = z.object({ disciplineId: z.string().uuid() });

export type ForumThreadSummary = {
  id: string;
  title: string;
  authorName: string;
  authorRole: "teacher" | "student";
  createdAt: string;
  postCount: number;
};

export type RecentForumThread = {
  id: string;
  disciplineId: string;
  disciplineName: string;
  title: string;
  authorName: string;
  authorRole: "teacher" | "student";
  lastActivityAt: string;
  postCount: number;
};

/**
 * Últimos tópicos com atividade, de qualquer disciplina — pro dashboard do
 * portal mostrar o que está "em aberto" sem o aluno precisar entrar
 * disciplina por disciplina procurando.
 */
export const listRecentForumThreadsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<RecentForumThread>> => {
    await requireAnyIdentity();

    const threadRows = await db
      .select({
        id: forumThreads.id,
        disciplineId: forumThreads.disciplineId,
        disciplineName: disciplines.discipline,
        title: forumThreads.title,
        authorName: forumThreads.authorName,
        authorRole: forumThreads.authorRole,
        createdAt: forumThreads.createdAt,
      })
      .from(forumThreads)
      .innerJoin(disciplines, eq(disciplines.id, forumThreads.disciplineId))
      .orderBy(desc(forumThreads.createdAt))
      .limit(50);

    const threadIds = threadRows.map((t) => t.id);
    const postRows =
      threadIds.length === 0
        ? []
        : await db
            .select({ threadId: forumPosts.threadId, createdAt: forumPosts.createdAt })
            .from(forumPosts)
            .where(inArray(forumPosts.threadId, threadIds));

    return threadRows
      .map((thread) => {
        const posts = postRows.filter((p) => p.threadId === thread.id);
        const lastActivityAt = posts.reduce(
          (max, p) => (p.createdAt > max ? p.createdAt : max),
          thread.createdAt,
        );
        return {
          id: thread.id,
          disciplineId: thread.disciplineId,
          disciplineName: thread.disciplineName,
          title: thread.title,
          authorName: thread.authorName,
          authorRole: thread.authorRole,
          lastActivityAt: lastActivityAt.toISOString(),
          postCount: posts.length,
        };
      })
      .sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1))
      .slice(0, 8);
  },
);

/** Tópicos de uma disciplina — qualquer professor ou aluno logado pode ver. */
export const listDisciplineThreadsFn = createServerFn({ method: "GET" })
  .validator(disciplineIdSchema)
  .handler(async ({ data }): Promise<Array<ForumThreadSummary>> => {
    await requireAnyIdentity();

    const threadRows = await db
      .select()
      .from(forumThreads)
      .where(eq(forumThreads.disciplineId, data.disciplineId))
      .orderBy(desc(forumThreads.createdAt));
    const threadIds = threadRows.map((t) => t.id);

    const postRows =
      threadIds.length === 0
        ? []
        : await db
            .select({ threadId: forumPosts.threadId })
            .from(forumPosts)
            .where(inArray(forumPosts.threadId, threadIds));

    return threadRows.map((thread) => ({
      id: thread.id,
      title: thread.title,
      authorName: thread.authorName,
      authorRole: thread.authorRole,
      createdAt: thread.createdAt.toISOString(),
      postCount: postRows.filter((p) => p.threadId === thread.id).length,
    }));
  });

const createThreadSchema = z.object({
  disciplineId: z.string().uuid(),
  title: z.string().trim().min(1, "Informe um título."),
  content: z.string().trim().min(1, "Escreva a mensagem inicial."),
});

/** Cria o tópico já com a primeira mensagem. */
export const createThreadFn = createServerFn({ method: "POST" })
  .validator(createThreadSchema)
  .handler(async ({ data }) => {
    const identity = await requireAnyIdentity();

    const [thread] = await db
      .insert(forumThreads)
      .values({
        disciplineId: data.disciplineId,
        authorRole: identity.role,
        authorTeacherId: identity.role === "teacher" ? identity.id : null,
        authorStudentId: identity.role === "student" ? identity.id : null,
        authorName: identity.name,
        title: data.title,
      })
      .returning({ id: forumThreads.id });

    await db.insert(forumPosts).values({
      threadId: thread.id,
      authorRole: identity.role,
      authorTeacherId: identity.role === "teacher" ? identity.id : null,
      authorStudentId: identity.role === "student" ? identity.id : null,
      authorName: identity.name,
      content: data.content,
    });

    await logAudit("forum.criar_topico", `Criou o tópico "${data.title}" no fórum.`);
    return { threadId: thread.id };
  });

const threadIdSchema = z.object({ threadId: z.string().uuid() });

export type ForumPost = {
  id: string;
  authorName: string;
  authorRole: "teacher" | "student";
  content: string;
  createdAt: string;
  mine: boolean;
};

export type ForumThreadDetail = {
  id: string;
  disciplineId: string;
  title: string;
  posts: Array<ForumPost>;
};

/** Tópico + todas as mensagens, em ordem cronológica. */
export const getThreadFn = createServerFn({ method: "GET" })
  .validator(threadIdSchema)
  .handler(async ({ data }): Promise<ForumThreadDetail> => {
    const identity = await requireAnyIdentity();

    const [thread] = await db
      .select()
      .from(forumThreads)
      .where(eq(forumThreads.id, data.threadId))
      .limit(1);
    if (!thread) throw new Error("Tópico não encontrado.");

    const postRows = await db
      .select()
      .from(forumPosts)
      .where(eq(forumPosts.threadId, data.threadId))
      .orderBy(asc(forumPosts.createdAt));

    return {
      id: thread.id,
      disciplineId: thread.disciplineId,
      title: thread.title,
      posts: postRows.map((post) => ({
        id: post.id,
        authorName: post.authorName,
        authorRole: post.authorRole,
        content: post.content,
        createdAt: post.createdAt.toISOString(),
        mine:
          (identity.role === "teacher" && post.authorTeacherId === identity.id) ||
          (identity.role === "student" && post.authorStudentId === identity.id),
      })),
    };
  });

const replySchema = z.object({
  threadId: z.string().uuid(),
  content: z.string().trim().min(1, "Escreva uma resposta."),
});

export const replyToThreadFn = createServerFn({ method: "POST" })
  .validator(replySchema)
  .handler(async ({ data }) => {
    const identity = await requireAnyIdentity();

    // Pega quem já participou ANTES de inserir a resposta nova, pra poder
    // avisar todo mundo menos quem acabou de responder.
    const previousPosts = await db
      .select({
        authorRole: forumPosts.authorRole,
        authorTeacherId: forumPosts.authorTeacherId,
        authorStudentId: forumPosts.authorStudentId,
      })
      .from(forumPosts)
      .where(eq(forumPosts.threadId, data.threadId));

    await db.insert(forumPosts).values({
      threadId: data.threadId,
      authorRole: identity.role,
      authorTeacherId: identity.role === "teacher" ? identity.id : null,
      authorStudentId: identity.role === "student" ? identity.id : null,
      authorName: identity.name,
      content: data.content,
    });
    const [thread] = await db
      .select({ title: forumThreads.title })
      .from(forumThreads)
      .where(eq(forumThreads.id, data.threadId))
      .limit(1);
    await logAudit(
      "forum.responder",
      `Respondeu no tópico "${thread?.title ?? data.threadId}" do fórum.`,
    );

    const participants = new Map<string, { type: "teacher" | "student"; id: string }>();
    for (const post of previousPosts) {
      const id = post.authorRole === "teacher" ? post.authorTeacherId : post.authorStudentId;
      if (!id) continue;
      if (post.authorRole === identity.role && id === identity.id) continue; // não notifica quem respondeu
      participants.set(`${post.authorRole}:${id}`, { type: post.authorRole, id });
    }
    await Promise.all(
      [...participants.values()].map((participant) =>
        sendPushToOwner(participant.type, participant.id, {
          title: `Nova resposta: ${thread?.title ?? "Fórum"}`,
          body: `${identity.name}: ${data.content.slice(0, 120)}`,
          url: participant.type === "teacher" ? "/painel/forum" : "/portal/forum",
        }),
      ),
    );
  });

const deleteThreadSchema = z.object({
  disciplineId: z.string().uuid(),
  threadId: z.string().uuid(),
});

/** Professor apaga qualquer tópico da própria disciplina (moderação). */
export const deleteThreadFn = createServerFn({ method: "POST" })
  .validator(deleteThreadSchema)
  .handler(async ({ data }) => {
    await requireOwnDiscipline(data.disciplineId);
    const [thread] = await db
      .select({ title: forumThreads.title })
      .from(forumThreads)
      .where(eq(forumThreads.id, data.threadId))
      .limit(1);
    await db.delete(forumThreads).where(eq(forumThreads.id, data.threadId));
    await logAudit(
      "forum.apagar_topico",
      `Apagou o tópico "${thread?.title ?? data.threadId}" do fórum.`,
    );
  });

const deletePostSchema = z.object({ postId: z.string().uuid() });

/** Apaga a própria mensagem, OU qualquer uma se for o professor dono da disciplina. */
export const deletePostFn = createServerFn({ method: "POST" })
  .validator(deletePostSchema)
  .handler(async ({ data }) => {
    const identity = await requireAnyIdentity();

    const [post] = await db
      .select()
      .from(forumPosts)
      .where(eq(forumPosts.id, data.postId))
      .limit(1);
    if (!post) return;

    const isAuthor =
      (identity.role === "teacher" && post.authorTeacherId === identity.id) ||
      (identity.role === "student" && post.authorStudentId === identity.id);

    if (!isAuthor) {
      const [thread] = await db
        .select({ disciplineId: forumThreads.disciplineId })
        .from(forumThreads)
        .where(eq(forumThreads.id, post.threadId))
        .limit(1);
      if (!thread) throw new Error("Tópico não encontrado.");
      await requireOwnDiscipline(thread.disciplineId);
    }

    await db.delete(forumPosts).where(eq(forumPosts.id, data.postId));
  });
