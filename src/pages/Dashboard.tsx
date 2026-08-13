import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  CalendarRange,
  GraduationCap,
  LayoutDashboard,
  Layers,
  Users,
} from "lucide-react";

import { BackToTopButton } from "@/components/BackToTopButton";
import { Navigation } from "@/components/Navigation";
import { SemesterCard } from "@/components/SemesterCard";
import { getScheduleStatistics, groupBySemester } from "@/lib/schedule-utils";
import type { Discipline } from "@/types/schedule";

/** Nota oficial da coordenação sobre a publicação das datas. */
const scheduleNote =
  "Somente o 1º Semestre (2026) possui datas de calendário confirmadas pela coordenação. Os demais permanecem como “A confirmar” até serem publicados.";

const statItems = [
  { key: "semesters", label: "Semestres", icon: CalendarRange },
  { key: "modules", label: "Módulos", icon: Layers },
  { key: "disciplines", label: "Disciplinas", icon: BookOpen },
  { key: "teachers", label: "Professores", icon: Users },
] as const;

/** Landing page pública: apresentação, indicadores e acesso por semestre. */
export function Dashboard({ disciplines }: { disciplines: Discipline[] }) {
  const semesters = useMemo(() => groupBySemester(disciplines), [disciplines]);
  const statistics = useMemo(() => getScheduleStatistics(disciplines), [disciplines]);

  return (
    <div className="min-h-screen">
      <Navigation />

      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-accent/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full bg-primary-foreground/5 blur-3xl"
          aria-hidden
        />

        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-24 pt-16 sm:px-6 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-center lg:gap-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">
              Cronograma acadêmico · Turma 2026
            </p>
            <h1 className="mt-4 text-balance font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              Seu caminho teológico, semestre a semestre.
            </h1>
            <p className="mt-5 max-w-xl text-pretty leading-relaxed text-primary-foreground/80">
              Acompanhe todos os módulos, disciplinas, professores e horários do curso — organizados
              por semestre, com as datas confirmadas pela coordenação.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#semestres"
                className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition-colors hover:bg-accent/90"
              >
                Ver semestres
                <ArrowRight className="size-4 shrink-0" aria-hidden />
              </a>
              <a
                href="#acesso"
                className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/25 px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/10"
              >
                Já tenho login
              </a>
            </div>
          </div>

          <div className="relative aspect-4/5 overflow-hidden rounded-3xl border border-primary-foreground/15 shadow-2xl">
            <img
              src="/hero-estudantes.png"
              alt="Alunos do seminário estudando juntos, com Bíblias abertas, em uma biblioteca"
              className="size-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/40 via-transparent to-transparent" />
          </div>
        </div>
      </section>

      <div className="relative mx-auto -mt-12 max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70 shadow-soft lg:grid-cols-4">
          {statItems.map(({ key, label, icon: Icon }) => (
            <div key={key} className="bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="size-3.5 shrink-0 text-accent" aria-hidden />
                <p className="truncate text-xs font-semibold uppercase tracking-[0.14em]">
                  {label}
                </p>
              </div>
              <p className="mt-2 font-display text-3xl font-semibold tabular-nums tracking-tight text-foreground">
                {statistics[key]}
              </p>
            </div>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6">
        <section id="acesso" className="scroll-mt-24">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            Já faz parte da turma?
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground">
            Acesse sua área
          </h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Link
              to="/login-aluno"
              className="group flex items-start gap-4 rounded-2xl border border-accent/30 bg-accent-soft/50 p-6 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-accent/60 hover:shadow-lg"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground shadow-sm">
                <GraduationCap className="size-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-xl font-semibold tracking-tight text-foreground">
                  Portal do Aluno
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Notas, frequência, boletim e mensalidades.
                </p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                  Entrar
                  <ArrowRight
                    className="size-4 shrink-0 transition-transform group-hover:translate-x-1"
                    aria-hidden
                  />
                </span>
              </div>
            </Link>

            <Link
              to="/painel"
              className="group flex items-start gap-4 rounded-2xl border border-primary/20 bg-primary p-6 text-primary-foreground shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary-foreground/15 text-primary-foreground shadow-sm">
                <LayoutDashboard className="size-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-xl font-semibold tracking-tight text-primary-foreground">
                  Painel do Professor
                </h3>
                <p className="mt-1 text-sm text-primary-foreground/70">
                  Lançamento de notas, presença e gestão acadêmica.
                </p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                  Entrar
                  <ArrowRight
                    className="size-4 shrink-0 transition-transform group-hover:translate-x-1"
                    aria-hidden
                  />
                </span>
              </div>
            </Link>
          </div>
        </section>

        <div className="mt-10 rounded-lg border border-warning-border/70 bg-gradient-to-br from-warning-soft to-background px-4 py-4 text-sm leading-relaxed text-warning shadow-soft sm:px-5">
          <p className="font-medium">Nota da coordenação</p>
          <p className="mt-1">{scheduleNote}</p>
        </div>

        <section className="mt-16 grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-14">
          <div className="order-2 lg:order-1">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
              Formação teológica séria
            </p>
            <h2 className="mt-3 text-balance font-display text-3xl font-semibold tracking-tight text-foreground">
              Um currículo pensado para formar pregadores fiéis.
            </h2>
            <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
              Cada disciplina foi organizada em módulos progressivos, com professores dedicados e
              uma grade pensada para equilibrar teologia sistemática, línguas originais e prática
              pastoral.
            </p>
          </div>
          <div className="order-1 aspect-3/2 overflow-hidden rounded-3xl border border-border/70 shadow-soft lg:order-2">
            <img
              src="/curriculo-estudante.png"
              alt="Aluno anotando à mão ao lado de uma Bíblia aberta sobre uma mesa de madeira"
              className="size-full object-cover"
            />
          </div>
        </section>

        <section id="semestres" className="mt-20 scroll-mt-24">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
              Grade completa
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground">
              Escolha um semestre
            </h2>
            <p className="mt-2 text-muted-foreground">
              Clique em um card para ver os módulos, disciplinas e horários completos.
            </p>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {semesters.map((semester) => (
              <SemesterCard key={semester.semester} semester={semester} />
            ))}
          </div>
        </section>
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
