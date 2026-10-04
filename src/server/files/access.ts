import type { AnyIdentity } from "@/server/auth/guard";

export type FileOwnerType =
  | "assignment_submission"
  | "reading_material"
  | "library_book"
  | "presentation_slide"
  | "video_lesson"
  | "payment_proof";

/**
 * Fato resolvido sobre o dono de um arquivo privado, já carregado do banco —
 * o suficiente pra decidir se `identity` pode ler o arquivo. `studentId` só
 * é preenchido (e só importa) para `assignment_submission`/`payment_proof`.
 */
export type FileOwnerRecord = {
  ownerType: FileOwnerType;
  studentId?: string | null;
};

/**
 * Regra pura de autorização — sem tocar banco, pra dar pra testar isolada.
 * A parte que consulta o banco (`resolveFileOwnerRecord` em
 * `src/server/files/privateFileAccess.ts`) monta o `FileOwnerRecord` e chama
 * esta função.
 *
 * Professor/admin sempre passa (exceto comprovante de pagamento, abaixo) — a
 * tela que chega até aqui já aplicou a permissão de leitura própria dela
 * (ex.: só lista entregas da disciplina que o professor leciona). Aluno só
 * lê entrega de tarefa própria ou comprovante de pagamento próprio; os
 * demais tipos (material, livro, slide, vídeo) já são abertos a qualquer
 * aluno logado nas telas atuais, então não criamos restrição nova aqui.
 *
 * Comprovante de pagamento é dado financeiro sensível: só o próprio aluno
 * dono da cobrança ou um professor com papel de admin (validação é tarefa do
 * Financeiro/secretaria) pode ler — um professor comum não entra, mesmo que
 * a tela que lista cobranças do aluno não seja exclusiva de admin.
 */
export function canReadFileRecord(record: FileOwnerRecord, identity: AnyIdentity): boolean {
  if (record.ownerType === "payment_proof") {
    if (identity.role === "teacher") return identity.isAdmin;
    return record.studentId === identity.id;
  }
  if (identity.role === "teacher") return true;
  if (record.ownerType === "assignment_submission") {
    return record.studentId === identity.id;
  }
  return true;
}
