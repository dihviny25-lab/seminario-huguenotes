import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpen, Download } from "lucide-react";

import { PortalShell } from "@/components/portal/PortalShell";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicDisciplinesFn } from "@/functions/schedule";
import { getMyStudentReportFn } from "@/functions/report";
import type { StudentReportRow } from "@/functions/reportData";
import { MINIMUM_ATTENDANCE_RATIO } from "@/lib/attendance";
import { PASSING_AVERAGE } from "@/lib/grades";
import { groupBySemester, semesterLabel } from "@/lib/schedule-utils";
import { cn } from "@/lib/utils";

const ALL_SEMESTERS = "all";

/** Portal do aluno: notas e faltas por disciplina, em cards agrupados por semestre. */
export function PortalGrades() {
  const { data: disciplines, isLoading: loadingDisciplines } = useQuery({
    queryKey: ["public-disciplines"],
    queryFn: () => getPublicDisciplinesFn(),
  });
  const { data: report, isLoading: loadingReport } = useQuery({
    queryKey: ["my-student-report"],
    queryFn: () => getMyStudentReportFn(),
  });
  const [pdfSemester, setPdfSemester] = useState(ALL_SEMESTERS);

  const rowByDiscipline = useMemo(
    () => new Map((report?.rows ?? []).map((row) => [row.disciplineId, row])),
    [report],
  );
  const semesters = groupBySemester(disciplines ?? []);
  const availableSemesters = [...new Set((disciplines ?? []).map((d) => d.semester))].sort(
    (a, b) => a - b,
  );

  const isLoading = loadingDisciplines || loadingReport;

  return (
    <PortalShell
      title="Minhas notas"
      description="Notas e frequência de cada disciplina — clique numa disciplina pra ver o detalhe."
    >
      {isLoading ? (
        <div className="space-y-10">
          {Array.from({ length: 2 }).map((_, sectionIndex) => (
            <div key={sectionIndex}>
              <Skeleton className="h-5 w-32" />
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, cardIndex) => (
                  <Skeleton key={cardIndex} className="h-20 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-10">
          {semesters.map((semester) => (
            <section key={semester.semester}>
              <h2 className="font-display text-lg font-semibold text-foreground">
                {semesterLabel(semester.semester)}
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {semester.modules.flatMap((module) =>
                  module.disciplines.map((discipline) => (
                    <DisciplineCard
                      key={discipline.id}
                      disciplineId={discipline.id}
                      name={discipline.discipline}
                      teacher={discipline.teacher}
                      row={rowByDiscipline.get(discipline.id)}
                    />
                  )),
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="mt-12 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-5 shadow-soft">
        <h2 className="font-display text-lg font-semibold text-foreground">Gerar boletim</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Baixe o boletim em PDF de um semestre específico ou do curso completo.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Select value={pdfSemester} onValueChange={setPdfSemester}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SEMESTERS}>Curso completo</SelectItem>
              {availableSemesters.map((semester) => (
                <SelectItem key={semester} value={String(semester)}>
                  {semester}º Semestre
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild>
            <a
              href={
                pdfSemester === ALL_SEMESTERS
                  ? "/portal/pdf"
                  : `/portal/pdf?semester=${pdfSemester}`
              }
            >
              <Download className="size-4" aria-hidden />
              Baixar PDF
            </a>
          </Button>
        </div>
      </div>
    </PortalShell>
  );
}

function DisciplineCard({
  disciplineId,
  name,
  teacher,
  row,
}: {
  disciplineId: string;
  name: string;
  teacher?: string;
  row: StudentReportRow | undefined;
}) {
  const averagePassed = row && row.average !== null ? row.average >= PASSING_AVERAGE : null;
  const attendancePassed =
    row && row.attendanceRatio !== null ? row.attendanceRatio >= MINIMUM_ATTENDANCE_RATIO : null;

  return (
    <Link
      to="/portal/disciplinas/$disciplineId"
      params={{ disciplineId }}
      className="flex items-start gap-3 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-4 shadow-soft transition-colors hover:border-primary/50"
    >
      <BookOpen className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">{name}</span>
        {teacher ? <span className="block text-xs text-muted-foreground">{teacher}</span> : null}
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="text-muted-foreground">
            Média:{" "}
            <span
              className={cn(
                "font-semibold",
                averagePassed === null
                  ? "text-muted-foreground"
                  : averagePassed
                    ? "text-success"
                    : "text-destructive",
              )}
            >
              {!row || row.average === null ? "—" : row.average.toFixed(1)}
            </span>
          </span>
          <span className="text-muted-foreground">
            Frequência:{" "}
            <span
              className={cn(
                "font-semibold",
                attendancePassed === null
                  ? "text-muted-foreground"
                  : attendancePassed
                    ? "text-success"
                    : "text-destructive",
              )}
            >
              {!row || row.attendanceRatio === null
                ? "—"
                : `${Math.round(row.attendanceRatio * 100)}%`}
            </span>
          </span>
        </span>
      </span>
    </Link>
  );
}
