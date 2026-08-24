import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";

import { requireAdminId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { auditLogs } from "@/server/db/schema";

export type AuditLogEntry = {
  id: string;
  actorType: "teacher" | "student";
  actorName: string;
  action: string;
  description: string;
  createdAt: string;
};

export type AuditSession = {
  actorType: "teacher" | "student";
  actorName: string;
  loginAt: string;
  logoutAt: string | null;
  /** Se não teve logout explícito, é a última ação registrada depois do login (aproximação). */
  lastSeenAt: string;
  durationMinutes: number;
  stillOpen: boolean;
};

const filterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  actorName: z.string().trim().optional(),
});

/** Últimas ações registradas — admin only. */
export const listAuditActionsFn = createServerFn({ method: "GET" })
  .validator(filterSchema)
  .handler(async ({ data }): Promise<Array<AuditLogEntry>> => {
    await requireAdminId();

    const conditions = [];
    if (data.from) conditions.push(gte(auditLogs.createdAt, new Date(data.from)));
    if (data.to) conditions.push(lte(auditLogs.createdAt, new Date(data.to)));

    const rows = await db
      .select()
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(500);

    const filtered = data.actorName
      ? rows.filter((r) => r.actorName.toLowerCase().includes(data.actorName!.toLowerCase()))
      : rows;

    return filtered.map((row) => ({
      id: row.id,
      actorType: row.actorType,
      actorName: row.actorName,
      action: row.action,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
    }));
  });

/**
 * Reconstrói sessões de login/logout casando cada "login" com o próximo
 * "logout" do mesmo ator (nome + tipo). Sem um logout explícito, usa a
 * última ação registrada daquele ator depois do login como "última vez
 * vista" (a sessão pode ter simplesmente expirado sem um clique em "Sair").
 */
export const listAuditSessionsFn = createServerFn({ method: "GET" })
  .validator(filterSchema)
  .handler(async ({ data }): Promise<Array<AuditSession>> => {
    await requireAdminId();

    const conditions = [];
    if (data.from) conditions.push(gte(auditLogs.createdAt, new Date(data.from)));
    if (data.to) conditions.push(lte(auditLogs.createdAt, new Date(data.to)));

    const rows = await db
      .select()
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(auditLogs.createdAt);

    const byActor = new Map<string, Array<(typeof rows)[number]>>();
    for (const row of rows) {
      const key = `${row.actorType}:${row.actorName}`;
      const list = byActor.get(key) ?? [];
      list.push(row);
      byActor.set(key, list);
    }

    const sessions: Array<AuditSession> = [];
    for (const [, actorRows] of byActor) {
      for (let i = 0; i < actorRows.length; i++) {
        const row = actorRows[i];
        if (row.action !== "login") continue;

        // Próximo evento qualquer (logout OU outra ação) depois desse login.
        let logoutAt: Date | null = null;
        let lastSeenAt = row.createdAt;
        for (let j = i + 1; j < actorRows.length; j++) {
          const next = actorRows[j];
          if (next.action === "login") break; // próxima sessão começou
          lastSeenAt = next.createdAt;
          if (next.action === "logout") {
            logoutAt = next.createdAt;
            break;
          }
        }

        const endTime = logoutAt ?? lastSeenAt;
        const durationMinutes = Math.max(
          0,
          Math.round((endTime.getTime() - row.createdAt.getTime()) / 60000),
        );

        sessions.push({
          actorType: row.actorType,
          actorName: row.actorName,
          loginAt: row.createdAt.toISOString(),
          logoutAt: logoutAt ? logoutAt.toISOString() : null,
          lastSeenAt: lastSeenAt.toISOString(),
          durationMinutes,
          stillOpen: logoutAt === null,
        });
      }
    }

    const filtered = data.actorName
      ? sessions.filter((s) => s.actorName.toLowerCase().includes(data.actorName!.toLowerCase()))
      : sessions;

    return filtered.sort((a, b) => (a.loginAt < b.loginAt ? 1 : -1));
  });

/** Nomes distintos que já aparecem no log — alimenta o filtro por pessoa. */
export const listAuditActorNamesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<string>> => {
    await requireAdminId();
    const rows = await db.selectDistinct({ actorName: auditLogs.actorName }).from(auditLogs);
    return rows.map((r) => r.actorName).sort();
  },
);
