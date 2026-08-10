import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";

import { computeCurrentAmount, getReminderToSend } from "@/lib/payments";
import { db } from "@/server/db/client";
import { charges, students } from "@/server/db/schema";
import { sendEmail } from "@/server/email/resend";

function formatAmount(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Cron diário (configurado em `vercel.json`) — lembrete de mensalidade
 * perto do vencimento ou já vencida. Endpoint público de propósito
 * (quem autentica é o segredo `CRON_SECRET`, não sessão de login), fica
 * fora de `src/routes/painel`/`portal` por isso.
 */
export const Route = createFileRoute("/api/cron/payment-reminders")({
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

        const rows = await db
          .select({ charge: charges, studentName: students.name, studentEmail: students.email })
          .from(charges)
          .innerJoin(students, eq(charges.studentId, students.id))
          .where(eq(charges.status, "pending"));

        const today = todayIso();
        let upcomingSent = 0;
        let overdueSent = 0;

        for (const { charge, studentName, studentEmail } of rows) {
          if (!studentEmail) continue;

          const reminder = getReminderToSend(
            {
              dueDate: charge.dueDate,
              reminderUpcomingSentAt: charge.reminderUpcomingSentAt
                ? charge.reminderUpcomingSentAt.toISOString()
                : null,
              reminderOverdueSentAt: charge.reminderOverdueSentAt
                ? charge.reminderOverdueSentAt.toISOString()
                : null,
            },
            today,
          );
          if (!reminder) continue;

          const amount = computeCurrentAmount(
            {
              fullAmount: Number(charge.fullAmount),
              discountPercent: Number(charge.discountPercent),
              dueDate: charge.dueDate,
            },
            today,
          );
          const siteUrl = process.env.SITE_URL ?? "";
          const paymentUrl = `${siteUrl}/portal/mensalidades`;

          const subject =
            reminder === "upcoming"
              ? "Sua mensalidade está perto de vencer — Seminário Huguenotes"
              : "Sua mensalidade está atrasada — Seminário Huguenotes";
          const html =
            reminder === "upcoming"
              ? `<p>Olá, ${studentName}.</p>
                 <p>Sua cobrança "${charge.description}" vence em ${formatDate(charge.dueDate)},
                 no valor de ${formatAmount(amount)}.</p>
                 <p><a href="${paymentUrl}">Pagar agora</a></p>`
              : `<p>Olá, ${studentName}.</p>
                 <p>Sua cobrança "${charge.description}" venceu em ${formatDate(charge.dueDate)}
                 e ainda não foi paga. Valor atual: ${formatAmount(amount)}.</p>
                 <p><a href="${paymentUrl}">Pagar agora</a></p>`;

          try {
            await sendEmail({ to: studentEmail, subject, html });
          } catch (error) {
            console.error(
              `Falha ao enviar lembrete (${reminder}) da cobrança ${charge.id}:`,
              error,
            );
            continue;
          }

          if (reminder === "upcoming") {
            await db
              .update(charges)
              .set({ reminderUpcomingSentAt: new Date() })
              .where(eq(charges.id, charge.id));
            upcomingSent += 1;
          } else {
            await db
              .update(charges)
              .set({ reminderOverdueSentAt: new Date() })
              .where(eq(charges.id, charge.id));
            overdueSent += 1;
          }
        }

        return Response.json({ upcomingSent, overdueSent });
      },
    },
  },
});
