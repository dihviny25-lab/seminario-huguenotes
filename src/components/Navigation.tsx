import { Link } from "@tanstack/react-router";
import { LayoutGrid, LogIn, Users } from "lucide-react";

/** Itens do menu principal. Adicionar novas seções aqui. */
const navigationItems = [
  { to: "/", label: "Visão Geral", icon: LayoutGrid },
  { to: "/professores", label: "Professores", icon: Users },
  { to: "/painel", label: "Painel", icon: LogIn },
] as const;

/** Cabeçalho fixo com identidade do seminário e navegação principal. */
export function Navigation() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary font-display text-sm font-bold text-primary-foreground">
            SH
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-sm font-semibold tracking-tight text-foreground">
              Seminário Huguenotes
            </span>
            <span className="hidden text-xs text-muted-foreground sm:block">
              Cronograma Acadêmico
            </span>
          </span>
        </Link>

        <nav aria-label="Navegação principal">
          <ul className="flex items-center gap-1 rounded-full border border-border bg-surface p-1">
            {navigationItems.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  activeOptions={{ exact: item.to === "/" }}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
                >
                  <item.icon className="size-4 shrink-0" aria-hidden />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
