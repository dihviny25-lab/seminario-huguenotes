import { Link } from "@tanstack/react-router";
import { Users } from "lucide-react";

import { PainelShell } from "@/components/painel/PainelShell";

/** Landing do painel interno — atalhos para as áreas administrativas. */
export function PainelHome() {
  return (
    <PainelShell
      title="Painel do professor"
      description="Área interna para lançar notas, faltas e administrar contas de acesso."
    >
      <Link
        to="/painel/professores"
        className="flex max-w-sm items-center gap-4 rounded-[1.5rem] border border-border/70 bg-card/70 p-5 shadow-soft transition-colors hover:border-primary/50"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Users className="size-5" aria-hidden />
        </span>
        <span>
          <span className="block font-display text-base font-semibold text-foreground">
            Contas de professores
          </span>
          <span className="block text-sm text-muted-foreground">
            Criar, editar e definir senha de acesso dos professores.
          </span>
        </span>
      </Link>
    </PainelShell>
  );
}
