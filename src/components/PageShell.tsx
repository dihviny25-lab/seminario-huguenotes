import type { ReactNode } from "react";

import { BackToTopButton } from "@/components/BackToTopButton";
import { Navigation } from "@/components/Navigation";

interface PageShellProps {
  title: string;
  subtitle: string;
  description?: string;
  children: ReactNode;
}

/** Estrutura comum das páginas: cabeçalho fixo, cabeçalho editorial e conteúdo. */
export function PageShell({ title, subtitle, description, children }: PageShellProps) {
  return (
    <div className="min-h-screen">
      <Navigation />

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 sm:pt-16">
        <section className="relative isolate overflow-hidden rounded-[2rem] border border-border/80 bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-soft sm:p-8">
          <div className="absolute -right-8 top-0 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-10 left-0 h-24 w-24 rounded-full bg-accent/10 blur-2xl" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
              {subtitle}
            </p>
            <h1 className="mt-3 text-balance font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              {title}
            </h1>
            {description && (
              <p className="mt-4 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </section>

        {children}
      </main>

      <footer className="border-t border-border py-8">
        <p className="mx-auto max-w-6xl px-4 text-sm text-muted-foreground sm:px-6">
          Seminário Huguenotes — Cronograma acadêmico oficial da coordenação.
        </p>
      </footer>

      <BackToTopButton />
    </div>
  );
}
