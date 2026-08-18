import { createFileRoute } from "@tanstack/react-router";
import { eq, isNull } from "drizzle-orm";

import { computeExamDeadline } from "@/lib/examSchedule";
import { db } from "@/server/db/client";
import { examAttempts, exams } from "@/server/db/schema";
import { finalizeExamAttempt } from "@/server/exams/scoring";

/**
 * Cron diário (configurado em `vercel.json`) — rede de segurança: fecha
 * sozinho qualquer tentativa de prova "esquecida em andamento" (aluno
 * fechou a aba, caiu a internet, nunca voltou), pra nunca ficar sem nota
 * lançada. Mesmo padrão de autenticação por CRON_SECRET do
 * payment-reminders.tsx.
 */
export const Route = createFileRoute("/api/cron/finalize-expired-exams")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) {
          return new Response("CRON_SECRET não configurado.", { status: 500 });
        }
        const authHeader = request.headers.get("authorization");
        if (authHeader !== `Bearer ${secret}`) {
          return new Response("Não autorizado.", { status: 401 });
        }

        const pending = await db
          .select({ attempt: examAttempts, exam: exams })
          .from(examAttempts)
          .innerJoin(exams, eq(examAttempts.examId, exams.id))
          .where(isNull(examAttempts.submittedAt));

        let finalized = 0;
        const now = Date.now();

        for (const { attempt, exam } of pending) {
          if (!exam.opensAt) continue;
          const deadline = computeExamDeadline(
            attempt.startedAt,
            exam.durationMinutes,
            exam.opensAt,
          );
          if (now > deadline.getTime()) {
            await finalizeExamAttempt(attempt.id, { autoSubmitted: true });
            finalized += 1;
          }
        }

        return Response.json({ finalized });
      },
    },
  },
});
