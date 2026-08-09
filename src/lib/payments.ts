export type MonthlyChargePeriod = {
  /** "YYYY-MM". */
  period: string;
  /** ISO "YYYY-MM-DD". */
  dueDate: string;
};

/**
 * Gera `months` períodos mensais consecutivos a partir de `startPeriod`
 * ("YYYY-MM"), com vencimento no `dueDay` de cada mês (dias além do fim do
 * mês são ajustados pro último dia real, ex.: dueDay 31 em fevereiro vira 28/29).
 */
export function computeMonthlySeries(
  startPeriod: string,
  months: number,
  dueDay: number,
): Array<MonthlyChargePeriod> {
  const [startYear, startMonth] = startPeriod.split("-").map(Number);

  const result: Array<MonthlyChargePeriod> = [];
  for (let i = 0; i < months; i++) {
    const monthIndex = startMonth - 1 + i;
    const year = startYear + Math.floor(monthIndex / 12);
    const month = ((monthIndex % 12) + 12) % 12;

    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const day = Math.min(dueDay, lastDayOfMonth);

    const period = `${year}-${String(month + 1).padStart(2, "0")}`;
    const dueDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    result.push({ period, dueDate });
  }

  return result;
}

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** Formata "YYYY-MM" como "Mês/Ano" (ex.: "2026-09" → "Setembro/2026"). */
export function formatPeriodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]}/${year}`;
}

/** Valor com o desconto por pontualidade aplicado. */
export function computeDiscountedAmount(fullAmount: number, discountPercent: number): number {
  return fullAmount * (1 - discountPercent / 100);
}

export type CurrentAmountInput = {
  fullAmount: number;
  discountPercent: number;
  /** ISO "YYYY-MM-DD". */
  dueDate: string;
};

/**
 * Valor a cobrar hoje: com desconto se ainda dentro do prazo (até o
 * vencimento, inclusive), valor cheio se já venceu. Comparação de string
 * ISO é segura lexicograficamente (mesmo padrão de `compareChronologically`
 * em schedule-utils.ts).
 */
export function computeCurrentAmount(charge: CurrentAmountInput, todayIso: string): number {
  return todayIso <= charge.dueDate
    ? computeDiscountedAmount(charge.fullAmount, charge.discountPercent)
    : charge.fullAmount;
}
