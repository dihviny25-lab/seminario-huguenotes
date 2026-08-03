import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { studentLogoutFn } from "@/functions/studentAuth";

interface PortalShellProps {
  title: string;
  description?: string;
  children: ReactNode;
}

const portalNavItems = [
  { to: "/portal", label: "Minhas notas" },
  { to: "/portal/videos", label: "Vídeo-aulas" },
] as const;

/** Cabeçalho do portal do aluno — login protegido. */
export function PortalShell({ title, description, children }: PortalShellProps) {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    await studentLogoutFn();
    await navigate({ to: "/login-aluno" });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/85 backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="size-8 shrink-0" aria-hidden />
            <span className="font-display text-sm font-semibold text-foreground">
              Portal do aluno
            </span>
          </div>
          <nav className="flex items-center gap-1">
            {portalNavItems.map((item) => (
              <Button key={item.to} variant="ghost" size="sm" asChild>
                <Link to={item.to} activeProps={{ className: "bg-accent/10 text-accent" }}>
                  {item.label}
                </Link>
              </Button>
            ))}
            <Button variant="ghost" size="sm" onClick={handleLogout} disabled={signingOut}>
              <LogOut className="size-4" aria-hidden />
              Sair
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-24 pt-10 sm:px-6 print:p-0">
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
