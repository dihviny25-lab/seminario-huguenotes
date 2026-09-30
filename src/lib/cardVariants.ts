import { cn } from "@/lib/utils";

export type CardVariant = "clickable" | "passive" | "success" | "warning" | "destructive";

// A cor da borda superior carrega significado, não decora: dourado é "isso
// leva a algum lugar" (link/card clicável), sem cor é "só informativo", e as
// cores de status (sucesso/aviso/erro) nunca aparecem fora desse uso.
const VARIANT_ACCENT: Record<CardVariant, string> = {
  clickable: "border-t-2 border-t-accent",
  passive: "",
  success: "border-t-2 border-t-success",
  warning: "border-t-2 border-t-warning",
  destructive: "border-t-2 border-t-destructive",
};

/** Só a borda superior que carrega o significado do papel — compõe com o resto do seu recipiente. */
export function cardAccent(variant: CardVariant): string {
  return VARIANT_ACCENT[variant];
}

/** Recipiente padrão do app (canto, fundo, sombra) + a borda superior do papel escolhido. */
export function cardVariant(variant: CardVariant, className?: string): string {
  return cn(
    "rounded-md border border-border/70 bg-card/70 p-4 shadow-soft",
    cardAccent(variant),
    className,
  );
}
