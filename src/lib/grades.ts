/** Nota mínima da média para ser considerado aprovado. */
export const PASSING_AVERAGE = 7;

export type WeightedScore = { score: number; weight: number };

/**
 * Média ponderada das notas lançadas. `null` quando não há nenhuma nota
 * ainda, ou quando a soma dos pesos é zero (evita divisão por zero).
 */
export function computeWeightedAverage(scores: Array<WeightedScore>): number | null {
  if (scores.length === 0) return null;
  const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight === 0) return null;
  return scores.reduce((sum, s) => sum + s.score * s.weight, 0) / totalWeight;
}
