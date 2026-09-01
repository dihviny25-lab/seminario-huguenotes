/**
 * Situação em que o aluno aparece quando o botão de WhatsApp é oferecido.
 * `generic` = sem mensagem pronta (abre a conversa em branco).
 *
 * `lowAttendance`, `lowGrade` e `missingAssignment` ainda não têm chamador nesta
 * entrega — ficam prontos para as Fases 1/2/4 da spec de dashboards
 * (docs/superpowers/specs/2026-08-31-dashboards-professor-aluno-design.md).
 */
export type WhatsappContext =
  | { kind: "generic" }
  | { kind: "overdue"; amount: number; daysOverdue: number }
  | { kind: "lowAttendance"; discipline: string }
  | { kind: "lowGrade"; discipline: string; average: number }
  | { kind: "missingAssignment"; title: string };

/** Primeiro nome com inicial maiúscula, a partir do nome completo (que vem em CAIXA ALTA no banco). */
export function firstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? "";
  if (first.length === 0) return "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function money(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Texto pré-preenchido para a conversa. `generic` retorna undefined (sem texto).
 * Os demais retornam um texto curto e cordial com o primeiro nome do aluno.
 */
export function messageFor(context: WhatsappContext, studentFullName: string): string | undefined {
  const nome = firstName(studentFullName);

  switch (context.kind) {
    case "generic":
      return undefined;
    case "overdue":
      return (
        `Olá, ${nome}! Tudo bem? Passando pra lembrar da mensalidade do seminário, ` +
        `que está com ${context.daysOverdue} dia(s) de atraso (R$ ${money(context.amount)}). ` +
        `Qualquer dificuldade, me avisa que a gente resolve juntos. 🙏`
      );
    case "lowAttendance":
      return (
        `Olá, ${nome}! Notamos algumas faltas suas em ${context.discipline}. ` +
        `Está tudo bem? Se precisar de ajuda pra acompanhar o conteúdo, conta com a gente.`
      );
    case "lowGrade":
      return (
        `Olá, ${nome}! Queremos te ajudar a melhorar em ${context.discipline} ` +
        `(sua média está em ${context.average.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}). ` +
        `Vamos combinar um horário pra conversar sobre o conteúdo?`
      );
    case "missingAssignment":
      return (
        `Olá, ${nome}! Vi que a tarefa "${context.title}" ainda não foi entregue. ` +
        `Precisa de mais prazo ou de alguma ajuda?`
      );
  }
}
