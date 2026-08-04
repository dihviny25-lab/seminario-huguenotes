import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { logoutFn } from "@/functions/auth";

const painelNavItems = [
  { to: "/painel", label: "Painel" },
  { to: "/painel/agenda", label: "Agenda" },
  { to: "/painel/professores", label: "Contas de professores" },
  { to: "/painel/alunos", label: "Alunos" },
  { to: "/painel/relatorio", label: "Relatório" },
  { to: "/painel/pagamentos", label: "Pagamentos" },
] as const;

interface PainelShellProps {
  title: string;
  description?: string;
  children: ReactNode;
}

/** Cabeçalho comum das telas internas (protegidas por login). */
export function PainelShell({ title, description, children }: PainelShellProps) {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    await logoutFn();
    await navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/85 backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <Link to="/painel" className="flex items-center gap-2">
              <img src="/logo.png" alt="" className="size-8 shrink-0" aria-hidden />
              <span className="font-display text-sm font-semibold text-foreground">
                Painel do professor
              </span>
            </Link>
            <nav aria-label="Navegação do painel">
              <ul className="flex items-center gap-1">
                {painelNavItems.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      activeOptions={{ exact: item.to === "/painel" }}
                      className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} disabled={signingOut}>
            <LogOut className="size-4" aria-hidden />
            Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 print:p-0">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground print:hidden">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-pretty leading-relaxed text-muted-foreground print:hidden">
            {description}
          </p>
        ) : null}

        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}
