/**
 * Monta um link wa.me a partir de um número de telefone brasileiro digitado de
 * qualquer forma (com/sem +55, com/sem 0 na frente, com espaços, traços ou
 * parênteses). Retorna null quando não dá pra formar um número confiável.
 *
 * A normalização só acontece aqui — o número é guardado no banco como o usuário
 * digitou.
 */
export function toWhatsappLink(phone: string | null | undefined, message?: string): string | null {
  let digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);

  let normalized: string | null = null;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    normalized = digits;
  } else if (digits.length === 10 || digits.length === 11) {
    normalized = `55${digits}`;
  }

  if (normalized === null) return null;

  const base = `https://wa.me/${normalized}`;
  const text = message?.trim();
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
