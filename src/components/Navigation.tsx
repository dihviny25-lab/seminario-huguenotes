import { Link } from "@tanstack/react-router";
import { GraduationCap, LayoutDashboard } from "lucide-react";

/** Cabeçalho fixo com identidade do seminário e acesso às duas áreas logadas. */
export function Navigation() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <img src="/logo.png" alt="" className="size-9 shrink-0" aria-hidden />
          <span className="min-w-0">
            <span className="block truncate font-display text-sm font-semibold tracking-tight text-foreground">
              Seminário Huguenotes
            </span>
            <span className="hidden text-xs text-muted-foreground sm:block">
              Cronograma Acadêmico
            </span>
          </span>
        </Link>

        <nav aria-label="Navegação principal" className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-foreground sm:inline-block"
          >
            Visão Geral
          </Link>

          <Link
            to="/login-aluno"
            className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent transition-colors hover:border-accent/50 hover:bg-accent-soft/70"
          >
            <GraduationCap className="size-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">Portal do Aluno</span>
          </Link>

          <Link
            to="/painel"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <LayoutDashboard className="size-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">Painel</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
