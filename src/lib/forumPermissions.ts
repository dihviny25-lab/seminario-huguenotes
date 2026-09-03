export type CanDeleteThreadInput = {
  /** Professor dono da disciplina do tópico (moderação) — ou, no fórum interno da Fase 6, admin. */
  isModerator: boolean;
  /** Quem pede a exclusão é o autor do tópico. */
  isAuthor: boolean;
  /** Respostas no tópico, sem contar a mensagem inicial (que sempre existe). */
  postCount: number;
};

export type CanDeletePostInput = {
  /** A mensagem é a abertura que dá origem ao tópico. */
  isOpeningPost: boolean;
  /** Quem pede a exclusão escreveu a mensagem. */
  isAuthor: boolean;
  /** Professor dono da disciplina do tópico. */
  isModerator: boolean;
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

/**
 * A abertura não pode ser apagada isoladamente, pois ela é a referência
 * usada para distinguir um tópico vazio de uma discussão com respostas.
 * Para removê-la, deve-se apagar o tópico inteiro pelas regras acima.
 */
export function canDeletePost({
  isOpeningPost,
  isAuthor,
  isModerator,
}: CanDeletePostInput): boolean {
  if (isOpeningPost) return false;
  return isAuthor || isModerator;
}
