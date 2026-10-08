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
 * `lessonId` e `accessibleLessonIds` só importam para `reading_material`/
 * `presentation_slide`/`video_lesson` — o dado do aluno (se restrito por
 * matrícula seletiva) já vem pronto, essa checagem continua pura/sem banco.
 */
export type FileOwnerRecord = {
  ownerType: FileOwnerType;
  studentId?: string | null;
  lessonId?: string | null;
  accessibleLessonIds?: Set<string> | null;
};

/**
 * `lessonId` nulo no conteúdo = material geral da disciplina, sempre
 * visível. Com `accessibleLessonIds` (aluno de matrícula seletiva), só
 * aparece o conteúdo cuja aula está liberada pra ele. Mora aqui (em vez de
 * `@/server/enrollment`, que toca banco) porque este módulo precisa
 * continuar importável sem `DATABASE_URL` — é o que o teste isolado exige.
 */
export function isLessonContentVisible(
  lessonId: string | null,
  accessibleLessonIds: Set<string> | null,
): boolean {
  if (accessibleLessonIds === null) return true;
  if (lessonId === null) return true;
  return accessibleLessonIds.has(lessonId);
}

/**
 * Regra pura de autorização — sem tocar banco, pra dar pra testar isolada.
 * A parte que consulta o banco (`resolveFileOwnerRecord` em
 * `src/server/files/privateFileAccess.ts`) monta o `FileOwnerRecord` e chama
 * esta função.
 *
 * Professor/admin sempre passa (exceto comprovante de pagamento, abaixo) — a
 * tela que chega até aqui já aplicou a permissão de leitura própria dela
 * (ex.: só lista entregas da disciplina que o professor leciona). Aluno só
 * lê entrega de tarefa própria ou comprovante de pagamento próprio; material/
 * slide/vídeo são abertos a qualquer aluno logado, exceto quando o aluno é
 * de matrícula seletiva e o conteúdo está vinculado a uma aula que ele não
 * tem acesso. Livro da biblioteca não tem esse conceito, continua aberto.
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
  if (
    record.ownerType === "reading_material" ||
    record.ownerType === "presentation_slide" ||
    record.ownerType === "video_lesson"
  ) {
    return isLessonContentVisible(record.lessonId ?? null, record.accessibleLessonIds ?? null);
  }
  return true;
}
