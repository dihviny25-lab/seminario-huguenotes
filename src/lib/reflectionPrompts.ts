/** Perguntas de reflexão espiritual — alternam sem repetir até o ciclo completar. */
export const REFLECTION_PROMPTS: Array<string> = [
  "O que Deus tem falado com você através da Palavra nesta semana?",
  "Que área da sua vida você sente que precisa entregar mais a Deus agora?",
  "Como está sua vida de oração ultimamente? Seja honesto(a).",
  "Descreva um momento recente em que você sentiu a presença de Deus de forma especial.",
  "Que pecado ou hábito você tem lutado para vencer?",
  "Como as disciplinas do seminário têm moldado seu caráter?",
  "O que você tem aprendido sobre humildade nesta temporada?",
  "Como está o seu relacionamento com sua família enquanto você estuda?",
  "Que dúvida ou luta espiritual você enfrenta hoje?",
  "Descreva como Deus tem sustentado você nas dificuldades do curso.",
  "O que significa 'vocação pastoral' pra você neste momento da sua vida?",
  "Como você tem cultivado comunhão com outros irmãos no seminário?",
  "Que versículo tem falado mais forte com você recentemente? Por quê?",
  "Em que momento você sentiu Deus te corrigindo nos últimos dias?",
  "Como está seu descanso e cuidado pessoal em meio às responsabilidades?",
  "O que você diria pra si mesmo(a) de um ano atrás, sobre sua caminhada com Deus?",
  "Que medo ou insegurança você tem entregado a Deus ultimamente?",
  "Como você tem lidado com o orgulho ou a comparação com outros alunos?",
  "Descreva uma forma prática que você serviu alguém essa semana.",
  "O que você espera que Deus faça em seu caráter até o fim do curso?",
];

/**
 * Escolhe a próxima pergunta evitando repetir qualquer uma usada nas
 * últimas N-1 reflexões (N = tamanho do banco) — garante passar pelas 20
 * antes de repetir, sem seguir uma ordem fixa e previsível.
 */
export function pickNextPrompt(recentPrompts: Array<string>): string {
  const lookback = recentPrompts.slice(0, REFLECTION_PROMPTS.length - 1);
  const candidates = REFLECTION_PROMPTS.filter((p) => !lookback.includes(p));
  const pool = candidates.length > 0 ? candidates : REFLECTION_PROMPTS;
  return pool[Math.floor(Math.random() * pool.length)];
}
