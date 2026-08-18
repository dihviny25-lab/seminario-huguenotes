const BRAZIL_UTC_OFFSET_MS = 3 * 60 * 60 * 1000; // America/Sao_Paulo, sem horário de verão desde 2019.

/** 23h59min59,999s do dia (horário de Brasília) em que `opensAt` cai. */
export function endOfDayBrazil(opensAt: Date): Date {
  const localShifted = new Date(opensAt.getTime() - BRAZIL_UTC_OFFSET_MS);
  const year = localShifted.getUTCFullYear();
  const month = localShifted.getUTCMonth();
  const day = localShifted.getUTCDate();
  return new Date(Date.UTC(year, month, day, 23, 59, 59, 999) + BRAZIL_UTC_OFFSET_MS);
}

/**
 * Prazo real de uma tentativa: a prova sempre encerra no mesmo dia em que foi
 * publicada (23h59, horário de Brasília), mesmo que o aluno tenha começado
 * tarde — o que vencer primeiro entre isso e a duração individual conta.
 */
export function computeExamDeadline(startedAt: Date, durationMinutes: number, opensAt: Date): Date {
  const byDuration = new Date(startedAt.getTime() + durationMinutes * 60_000);
  const byEndOfDay = endOfDayBrazil(opensAt);
  return byDuration < byEndOfDay ? byDuration : byEndOfDay;
}
