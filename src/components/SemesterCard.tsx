import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { StatusBadge } from "@/components/StatusBadge";
import { semesterLabel } from "@/lib/schedule-utils";
import type { SemesterGroup } from "@/types/schedule";

interface SemesterCardProps {
  semester: SemesterGroup;
}

/** Cartão compacto de semestre na landing — leva à página de detalhe. */
export function SemesterCard({ semester }: SemesterCardProps) {
  const confirmed = semester.modules.some((m) => m.status === "confirmed");

  return (
    <Link
      to="/semestre/$semester"
      params={{ semester: String(semester.semester) }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card p-6 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-accent/60 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-primary/80 font-display text-xl font-semibold text-primary-foreground shadow-sm">
          {semester.semester}
        </span>
        <StatusBadge status={confirmed ? "confirmed" : "pending"} />
      </div>

      <h3 className="mt-5 font-display text-2xl font-semibold tracking-tight text-foreground">
        {semesterLabel(semester.semester)}
      </h3>
      <p className="text-sm text-muted-foreground">Turma {semester.term}</p>

      <p className="mt-4 text-sm text-muted-foreground">
        {semester.modules.length} {semester.modules.length === 1 ? "módulo" : "módulos"} ·{" "}
        {semester.totalDisciplines} {semester.totalDisciplines === 1 ? "disciplina" : "disciplinas"}
      </p>

      <div className="mt-6 flex items-center gap-1.5 text-sm font-medium text-accent">
        Ver grade completa
        <ArrowRight
          className="size-4 shrink-0 transition-transform group-hover:translate-x-1"
          aria-hidden
        />
      </div>
    </Link>
  );
}
