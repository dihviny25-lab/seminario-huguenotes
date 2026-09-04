export type MaterialAccessInput = {
  /** Quem pede é o professor dono da disciplina da apostila. */
  isOwner: boolean;
  /** Existe uma linha em reading_material_shares pra esse professor+apostila. */
  isSharedWithMe: boolean;
};

/**
 * Quem pode ler e comentar uma apostila: o dono (professor da disciplina) ou
 * um professor com quem ela foi explicitamente compartilhada. Não decide
 * edição — editar a apostila em si continua sendo sempre `requireOwnDiscipline`
 * puro, sem passar por este predicado (compartilhamento nunca dá acesso de
 * escrita ao conteúdo, só a leitura e comentário).
 */
export function canAccessMaterial({ isOwner, isSharedWithMe }: MaterialAccessInput): boolean {
  return isOwner || isSharedWithMe;
}
