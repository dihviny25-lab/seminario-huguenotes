import { describe, expect, it } from "vitest";

import { decidePaymentWebhook } from "./webhookValidation";

const baseCharge = {
  status: "pending" as const,
  fullAmount: "250.00",
  discountPercent: "20",
  dueDate: "2026-09-10",
  mpPaymentId: null,
};

function payment(overrides: Partial<Parameters<typeof decidePaymentWebhook>[1]> = {}) {
  return {
    id: "pay_1",
    status: "approved",
    transactionAmount: 200,
    currencyId: "BRL",
    approvedAt: "2026-09-05T12:00:00-03:00",
    ...overrides,
  };
}

describe("decidePaymentWebhook", () => {
  it("aceita valor com desconto antes do vencimento", () => {
    expect(decidePaymentWebhook(baseCharge, payment())).toEqual({
      action: "mark-paid",
      paidAmount: 200,
    });
  });

  it("rejeita pagamento parcial", () => {
    expect(decidePaymentWebhook(baseCharge, payment({ transactionAmount: 20 }))).toMatchObject({
      action: "ignore",
    });
  });

  it("exige valor cheio após vencimento", () => {
    expect(
      decidePaymentWebhook(
        baseCharge,
        payment({ transactionAmount: 250, approvedAt: "2026-09-11T08:00:00-03:00" }),
      ),
    ).toEqual({ action: "mark-paid", paidAmount: 250 });
  });

  it("é idempotente para o mesmo pagamento", () => {
    expect(
      decidePaymentWebhook({ ...baseCharge, status: "paid", mpPaymentId: "pay_1" }, payment()),
    ).toEqual({ action: "already-processed" });
  });

  it("não sobrescreve cobrança paga por outro pagamento", () => {
    expect(
      decidePaymentWebhook({ ...baseCharge, status: "paid", mpPaymentId: "pay_old" }, payment()),
    ).toMatchObject({ action: "ignore" });
  });
});
