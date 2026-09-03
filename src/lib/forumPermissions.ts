export type CanDeleteThreadInput = {
  /** Professor dono da disciplina do tópico (moderação) — ou, no fórum interno da Fase 6, admin. */
  isModerator: boolean;
  /** Quem pede a exclusão é o autor do tópico. */
  isAuthor: boolean;
  /** Respostas no tópico, sem contar a mensagem inicial (que sempre existe). */
  postCount: number;
};

/**
 * Quem pode apagar um tópico de fórum. Moderador sempre pode; o próprio
 * autor só pode se ainda não houver nenhuma resposta — apagar um tópico
 * criado por engano não deve depender de moderação, mas uma discussão já
 * em andamento não pode sumir por decisão unilateral do autor.
 */
export function canDeleteThread({
  isModerator,
  isAuthor,
  postCount,
}: CanDeleteThreadInput): boolean {
  if (isModerator) return true;
  return isAuthor && postCount === 0;
}
