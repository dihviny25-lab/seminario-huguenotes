import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";

import { requireStudentId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { students } from "@/server/db/schema";

function getSiteUrl(): string {
  const url = process.env.SITE_URL;
  if (!url) throw new Error("SITE_URL não configurada.");
  return url;
}

function buildFeedUrl(token: string): string {
  return `${getSiteUrl()}/agenda.ics?token=${token}`;
}

/** Devolve o link do feed de calendário do aluno, gerando o token na primeira vez. */
export const getMyCalendarLinkFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ url: string }> => {
    const studentId = await requireStudentId();
    const [student] = await db
      .select({ calendarToken: students.calendarToken })
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);

    let token = student?.calendarToken;
    if (!token) {
      token = crypto.randomUUID();
      await db.update(students).set({ calendarToken: token }).where(eq(students.id, studentId));
    }

    return { url: buildFeedUrl(token) };
  },
);

/** Gera um link novo (invalida o antigo) — útil se o aluno acha que o link vazou. */
export const regenerateMyCalendarLinkFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ url: string }> => {
    const studentId = await requireStudentId();
    const token = crypto.randomUUID();
    await db.update(students).set({ calendarToken: token }).where(eq(students.id, studentId));
    return { url: buildFeedUrl(token) };
  },
);
