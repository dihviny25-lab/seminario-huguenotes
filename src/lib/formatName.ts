/** Nomes ficam salvos em CAIXA ALTA (cadastro administrativo) — aqui é só exibição amigável. */
export function toDisplayName(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

/** Primeiro nome, em exibição amigável (ex.: saudações). */
export function toDisplayFirstName(fullName: string): string {
  return toDisplayName(fullName).split(" ")[0];
}
