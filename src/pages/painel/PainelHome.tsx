import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpen, GraduationCap, Users } from "lucide-react";

import { NotificationToggle } from "@/components/NotificationToggle";
import { PainelShell } from "@/components/painel/PainelShell";
import { Skeleton } from "@/components/ui/skeleton";
import { getTeacherDashboardFn } from "@/functions/teacherDashboard";
import { listMyDisciplinesFn } from "@/functions/disciplines";
import { DashboardCards } from "@/pages/painel/dashboard/cards";
import { KpiStrip } from "@/pages/painel/dashboard/KpiStrip";

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

/** Landing do painel interno — dashboard de pendências + atalhos + disciplinas do professor. */
export function PainelHome() {
  const { data: dashboard, isLoading: loadingDashboard } = useQuery({
    queryKey: ["teacher-dashboard"],
    queryFn: () => getTeacherDashboardFn(),
  });
  const { data: disciplines, isLoading } = useQuery({
    queryKey: ["my-disciplines"],
    queryFn: () => listMyDisciplinesFn(),
  });

  const allClear =
    !loadingDashboard &&
    dashboard !== undefined &&
    dashboard.counts.pendingGrading === 0 &&
    dashboard.counts.endingDisciplines === 0 &&
    dashboard.counts.atRiskStudents === 0 &&
    dashboard.counts.lessonsWithoutAttendance === 0 &&
    dashboard.materialGaps.length === 0 &&
    dashboard.pendingGrading.length === 0 &&
    dashboard.missingGrades.length === 0 &&
    dashboard.missingAttendance.length === 0 &&
    dashboard.endingDisciplines.length === 0 &&
    dashboard.forum.length === 0 &&
    dashboard.upcomingLessons.length === 0 &&
    dashboard.atRiskStudents.length === 0;

  return (
    <PainelShell
      title="Painel do professor"
      description="O que precisa da sua atenção agora: correções, notas, chamada, materiais e fórum."
    >
      <div className="mb-4">
        <NotificationToggle />
      </div>

      <KpiStrip
        scope={dashboard?.scope ?? "minhas"}
        counts={
          dashboard?.counts ?? {
            pendingGrading: 0,
            endingDisciplines: 0,
            atRiskStudents: 0,
            lessonsWithoutAttendance: 0,
          }
        }
        isLoading={loadingDashboard}
      />

      {allClear ? (
        <p className="mt-8 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-6 text-center text-sm text-muted-foreground shadow-soft">
          Nenhuma pendência — tudo em dia.
        </p>
      ) : (
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <DashboardCards data={dashboard} isLoading={loadingDashboard} />
        </div>
      )}

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {shortcuts.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-start gap-3 rounded-lg border border-t-2 border-border/70 border-t-accent bg-card/70 p-5 shadow-soft transition-colors hover:border-primary/50"
          >
            <item.icon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
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
          Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="flex items-start gap-3 rounded-md border border-t-2 border-border/70 border-t-border bg-card/70 p-4 shadow-soft"
            >
              <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))
        ) : disciplines && disciplines.length > 0 ? (
          disciplines.map((discipline) => (
            <Link
              key={discipline.id}
              to="/painel/disciplinas/$disciplineId"
              params={{ disciplineId: discipline.id }}
              className="flex items-start gap-3 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-4 shadow-soft transition-colors animate-in fade-in slide-in-from-top-1 duration-200 hover:border-primary/50"
            >
              <BookOpen className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
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
