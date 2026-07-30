import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpen, GraduationCap, Users } from "lucide-react";

import { PainelShell } from "@/components/painel/PainelShell";
import { listMyDisciplinesFn } from "@/functions/disciplines";

const shortcuts = [
  {
    to: "/painel/professores",
    icon: Users,
    title: "Contas de professores",
    description: "Criar, editar e definir senha de acesso dos professores.",
  },
  {
    to: "/painel/alunos",
    icon: GraduationCap,
    title: "Alunos",
    description: "Cadastrar e gerenciar os alunos do seminário.",
  },
] as const;

/** Landing do painel interno — atalhos + disciplinas do professor logado. */
export function PainelHome() {
  const { data: disciplines, isLoading } = useQuery({
    queryKey: ["my-disciplines"],
    queryFn: () => listMyDisciplinesFn(),
  });

  return (
    <PainelShell
      title="Painel do professor"
      description="Área interna para lançar notas, faltas e administrar contas de acesso."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {shortcuts.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-4 rounded-[1.5rem] border border-border/70 bg-card/70 p-5 shadow-soft transition-colors hover:border-primary/50"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <item.icon className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block font-display text-base font-semibold text-foreground">
                {item.title}
              </span>
              <span className="block text-sm text-muted-foreground">{item.description}</span>
            </span>
          </Link>
        ))}
      </div>

      <h2 className="mt-10 font-display text-xl font-semibold tracking-tight text-foreground">
        Minhas disciplinas
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Lance notas e faltas nas disciplinas que você ministra.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : disciplines && disciplines.length > 0 ? (
          disciplines.map((discipline) => (
            <Link
              key={discipline.id}
              to="/painel/disciplinas/$disciplineId"
              params={{ disciplineId: discipline.id }}
              className="flex items-center gap-3 rounded-[1.25rem] border border-border/70 bg-card/70 p-4 shadow-soft transition-colors hover:border-primary/50"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
                <BookOpen className="size-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">
                  {discipline.discipline}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {discipline.module} · {discipline.term}
                </span>
              </span>
            </Link>
          ))
        ) : (
          <p className="text-muted-foreground">
            Nenhuma disciplina atribuída a você ainda — peça para outro professor te vincular em
            "Contas de professores" ou verifique se seu login está associado à disciplina certa.
          </p>
        )}
      </div>
    </PainelShell>
  );
}
