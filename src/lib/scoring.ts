export type ScoringOption = { id: string; questionId: string; isCorrect: boolean };
export type ScoringQuestion = { id: string; points: number };

/**
 * Soma os pontos de cada pergunta cuja opção selecionada é a correta.
 * Função pura reaproveitada pela correção de provas (`finalizeExamAttempt`,
 * `src/server/exams/scoring.ts`) e de tarefas objetivas
 * (`finalizeAssignmentSubmission`, `src/server/assignments/scoring.ts`) —
 * as duas têm exatamente a mesma regra: uma opção correta por pergunta, nota
 * é a soma dos pontos das perguntas acertadas. Pergunta sem resposta ou
 * resposta errada simplesmente não soma nada — não há desconto.
 */
export function sumCorrectPoints(
  selectedOptionIds: Array<string>,
  options: Array<ScoringOption>,
  questions: Array<ScoringQuestion>,
): number {
  const selected = new Set(selectedOptionIds);
  return options
    .filter((option) => option.isCorrect && selected.has(option.id))
    .reduce((sum, option) => {
      const question = questions.find((q) => q.id === option.questionId);
      return sum + (question?.points ?? 0);
    }, 0);
}
