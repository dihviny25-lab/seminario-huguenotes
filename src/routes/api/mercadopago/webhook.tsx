import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";

import { db } from "@/server/db/client";
import { charges } from "@/server/db/schema";
import { getPayment, verifyWebhookSignature } from "@/server/payments/mercadopago";

/**
 * Notificação de pagamento do Mercado Pago — endpoint público de propósito
 * (quem autentica é a assinatura HMAC do header `x-signature`, não sessão de
 * login). Fica fora de `src/routes/painel` e `src/routes/portal`, então
 * nenhum guard de sessão se aplica aqui.
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
        if (payment.status === "approved" && payment.externalReference) {
          await db
            .update(charges)
            .set({
              status: "paid",
              mpPaymentId: dataId,
              paidAt: new Date(),
              paidAmount: String(payment.transactionAmount),
              paidManually: false,
            })
            .where(eq(charges.id, payment.externalReference));
        }

        return Response.json({ received: true });
      },
    },
  },
});
