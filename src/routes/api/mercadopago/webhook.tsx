import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";

import { db } from "@/server/db/client";
import { charges } from "@/server/db/schema";
import { getPayment, verifyWebhookSignature } from "@/server/payments/mercadopago";
import { decidePaymentWebhook } from "@/server/payments/webhookValidation";

/**
 * Notificação de pagamento do Mercado Pago. O endpoint é público, mas exige
 * assinatura HMAC válida e consulta o pagamento diretamente na API do MP.
 */
export const Route = createFileRoute("/api/mercadopago/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const dataId = url.searchParams.get("data.id");
        const type = url.searchParams.get("type");

        const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
        if (!secret) {
          return new Response("Webhook não configurado.", { status: 500 });
        }

        const valid = await verifyWebhookSignature({
          xSignature: request.headers.get("x-signature"),
          xRequestId: request.headers.get("x-request-id"),
          dataId,
          secret,
        });
        if (!valid) {
          return new Response("Assinatura inválida.", { status: 401 });
        }

        if (type !== "payment" || !dataId) {
          return Response.json({ received: true });
        }

        const payment = await getPayment(dataId);
        if (!payment.externalReference) {
          return Response.json({ received: true });
        }

        const [charge] = await db
          .select({
            status: charges.status,
            fullAmount: charges.fullAmount,
            discountPercent: charges.discountPercent,
            dueDate: charges.dueDate,
            mpPaymentId: charges.mpPaymentId,
          })
          .from(charges)
          .where(eq(charges.id, payment.externalReference))
          .limit(1);

        if (!charge) {
          console.warn(`Webhook MP: cobrança ${payment.externalReference} não encontrada.`);
          return Response.json({ received: true });
        }

        const decision = decidePaymentWebhook(charge, {
          id: payment.id,
          status: payment.status,
          transactionAmount: payment.transactionAmount,
          currencyId: payment.currencyId,
          approvedAt: payment.approvedAt,
        });

        if (decision.action === "mark-paid") {
          // O status pendente também faz parte do WHERE para impedir duas
          // notificações concorrentes de aplicarem a mesma baixa duas vezes.
          await db
            .update(charges)
            .set({
              status: "paid",
              mpPaymentId: payment.id,
              paidAt: payment.approvedAt ? new Date(payment.approvedAt) : new Date(),
              paidAmount: String(decision.paidAmount),
              paidManually: false,
            })
            .where(and(eq(charges.id, payment.externalReference), eq(charges.status, "pending")));
        } else if (decision.action === "ignore") {
          console.warn(`Webhook MP ignorado para ${payment.externalReference}: ${decision.reason}`);
        }

        return Response.json({ received: true });
      },
    },
  },
});
