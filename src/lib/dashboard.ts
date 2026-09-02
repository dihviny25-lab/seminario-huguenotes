/** Janela de "vence em breve" pro alerta de cobrança do topo do portal do aluno. */
export const CHARGE_DUE_SOON_WINDOW_DAYS = 7;

export type ChargeUrgency = "overdue" | "due-soon" | "ok";

export type ChargeUrgencyInput = {
  status: "pending" | "paid" | "canceled";
  /** ISO "YYYY-MM-DD". */
  dueDate: string;
};

/**
 * Urgência de uma cobrança pro alerta do portal. Só `pending` pode ser
 * "overdue"/"due-soon" — `paid` e `canceled` são sempre "ok" (nenhum
 * alerta). Comparação por string ISO, nunca `Date` local — mesmo padrão de
 * `computeCurrentAmount` (`src/lib/payments.ts`).
 */
export function classifyCharge(charge: ChargeUrgencyInput, todayIso: string): ChargeUrgency {
  if (charge.status !== "pending") return "ok";
  if (charge.dueDate < todayIso) return "overdue";
  const daysUntilDue = Math.round(
    (Date.parse(charge.dueDate) - Date.parse(todayIso)) / (1000 * 60 * 60 * 24),
  );
  return daysUntilDue <= CHARGE_DUE_SOON_WINDOW_DAYS ? "due-soon" : "ok";
}

export type ChargeAlertItem = {
  chargeId: string;
  description: string;
  /** String, igual ao `Charge.currentAmount` de `src/functions/payments.ts`. */
  currentAmount: string;
  dueDate: string;
};

export type ChargeAlertInput = ChargeAlertItem & ChargeUrgencyInput;

export type ChargeAlert = { level: "overdue" | "due-soon"; featured: ChargeAlertItem } | null;

/**
 * Alerta de cobrança pro topo do portal: olha as cobranças `pending`,
 * classifica cada uma com `classifyCharge` e escolhe a mais urgente pra
 * destacar. "Vencida" tem prioridade sobre "vence em breve"; dentro do
 * mesmo nível, a de vencimento mais antigo vence a disputa. `null` quando
 * não há nada a dizer (nenhuma pendente, ou todas ainda longe do vencimento).
 */
export function buildChargeAlert(charges: Array<ChargeAlertInput>, todayIso: string): ChargeAlert {
  const urgent = charges
    .map((charge) => ({ charge, urgency: classifyCharge(charge, todayIso) }))
    .filter(
      (c): c is { charge: ChargeAlertInput; urgency: "overdue" | "due-soon" } => c.urgency !== "ok",
    );

  if (urgent.length === 0) return null;

  const overdue = urgent.filter((c) => c.urgency === "overdue");
  const pool = overdue.length > 0 ? overdue : urgent;
  const featured = pool.reduce((oldest, c) =>
    c.charge.dueDate < oldest.charge.dueDate ? c : oldest,
  );

  return {
    level: overdue.length > 0 ? "overdue" : "due-soon",
    featured: {
      chargeId: featured.charge.chargeId,
      description: featured.charge.description,
      currentAmount: featured.charge.currentAmount,
      dueDate: featured.charge.dueDate,
    },
  };
}
