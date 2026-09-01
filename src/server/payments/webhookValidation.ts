import { computeCurrentAmount } from "@/lib/payments";

export type ChargeForWebhook = {
  status: "pending" | "paid" | "canceled";
  fullAmount: string | number;
  discountPercent: string | number;
  dueDate: string;
  mpPaymentId: string | null;
};

export type PaymentForWebhook = {
  id: string;
  status: string;
  transactionAmount: number;
  currencyId: string | null;
  approvedAt: string | null;
};

export type WebhookDecision =
  | { action: "ignore"; reason: string }
  | { action: "already-processed" }
  | { action: "mark-paid"; paidAmount: number };

function paymentDateIso(approvedAt: string | null): string {
  return approvedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
}

export function decidePaymentWebhook(
  charge: ChargeForWebhook,
  payment: PaymentForWebhook,
): WebhookDecision {
  if (payment.status !== "approved") {
    return { action: "ignore", reason: "Pagamento ainda não aprovado." };
  }

  if (payment.currencyId && payment.currencyId !== "BRL") {
    return { action: "ignore", reason: "Moeda do pagamento incompatível." };
  }

  if (charge.status === "paid") {
    if (charge.mpPaymentId === payment.id) return { action: "already-processed" };
    return { action: "ignore", reason: "Cobrança já paga por outro pagamento." };
  }

  if (charge.status !== "pending") {
    return { action: "ignore", reason: "Cobrança não está pendente." };
  }

  const expectedAmount = computeCurrentAmount(
    {
      fullAmount: Number(charge.fullAmount),
      discountPercent: Number(charge.discountPercent),
      dueDate: charge.dueDate,
    },
    paymentDateIso(payment.approvedAt),
  );

  // Comparação em centavos evita diferença de ponto flutuante e impede que
  // um pagamento parcial quite a cobrança inteira.
  const expectedCents = Math.round(expectedAmount * 100);
  const receivedCents = Math.round(payment.transactionAmount * 100);
  if (expectedCents !== receivedCents) {
    return { action: "ignore", reason: "Valor recebido não corresponde à cobrança." };
  }

  return { action: "mark-paid", paidAmount: payment.transactionAmount };
}
