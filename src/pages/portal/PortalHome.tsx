import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Download, Printer } from "lucide-react";

import { PortalShell } from "@/components/portal/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMyStudentReportFn } from "@/functions/report";
import type { StudentReportRow } from "@/functions/reportData";
import { MINIMUM_ATTENDANCE_RATIO } from "@/lib/attendance";
import { PASSING_AVERAGE } from "@/lib/grades";
import { cn } from "@/lib/utils";

/** Portal do aluno: só as próprias notas e faltas, em todas as disciplinas. */
export function PortalHome() {
  const { data: report, isLoading } = useQuery({
    queryKey: ["my-student-report"],
    queryFn: () => getMyStudentReportFn(),
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(disciplineId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(disciplineId)) next.delete(disciplineId);
      else next.add(disciplineId);
      return next;
    });
  }

  return (
    <PortalShell
      title={report ? report.student.name : "Minhas notas e faltas"}
      description="Consulte suas notas e faltas em todas as disciplinas do curso."
    >
      {isLoading || !report ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <div className="rounded-md border border-border/70 bg-card/70 p-6 shadow-soft print:border-none print:bg-transparent print:p-0 print:shadow-none">
          <div className="mb-6 flex items-center justify-between print:hidden">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
              Seminário Huguenotes
            </p>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <a href="/portal/pdf">
                  <Download className="size-4" aria-hidden />
                  Baixar PDF
                </a>
              </Button>
              <Button onClick={() => window.print()}>
                <Printer className="size-4" aria-hidden />
                Imprimir
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Semestre</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Disciplina</TableHead>
                <TableHead>Professor</TableHead>
                <TableHead className="text-center">Média</TableHead>
                <TableHead className="text-center">Frequência</TableHead>
                <TableHead className="w-10 print:hidden" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.map((row) => (
                <ReportRow
                  key={row.disciplineId}
                  row={row}
                  expanded={expanded.has(row.disciplineId)}
                  onToggle={() => toggleExpanded(row.disciplineId)}
                />
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={7} className="text-xs text-muted-foreground">
                  Emitido em {new Date().toLocaleDateString("pt-BR")}. Aprovação exige média mínima{" "}
                  {PASSING_AVERAGE.toFixed(1)} e frequência mínima de{" "}
                  {Math.round(MINIMUM_ATTENDANCE_RATIO * 100)}%.
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </PortalShell>
  );
}

function ReportRow({
  row,
  expanded,
  onToggle,
}: {
  row: StudentReportRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const averagePassed = row.average === null ? null : row.average >= PASSING_AVERAGE;
  const attendancePassed =
    row.attendanceRatio === null ? null : row.attendanceRatio >= MINIMUM_ATTENDANCE_RATIO;
  const hasAssessments = row.assessments.length > 0;

  return (
    <>
      <TableRow
        className={cn(hasAssessments && "cursor-pointer")}
        onClick={hasAssessments ? onToggle : undefined}
      >
        <TableCell>{row.semester}º</TableCell>
        <TableCell>{row.module}</TableCell>
        <TableCell className="font-medium text-foreground">{row.discipline}</TableCell>
        <TableCell className="text-muted-foreground">{row.teacherName ?? "—"}</TableCell>
        <TableCell className="text-center">
          {row.average === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span
              className={cn("font-semibold", averagePassed ? "text-success" : "text-destructive")}
            >
              {row.average.toFixed(1)}
            </span>
          )}
        </TableCell>
        <TableCell className="text-center">
          {row.attendanceRatio === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span
              className={cn(
                "font-semibold",
                attendancePassed ? "text-success" : "text-destructive",
              )}
            >
              {Math.round(row.attendanceRatio * 100)}%
            </span>
          )}
        </TableCell>
        <TableCell className="print:hidden">
          {hasAssessments ? (
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                expanded && "rotate-180",
              )}
              aria-hidden
            />
          ) : null}
        </TableCell>
      </TableRow>
      {expanded && hasAssessments ? (
        <TableRow className="print:hidden">
          <TableCell colSpan={7} className="bg-muted/30">
            <div className="flex flex-wrap gap-2 py-1">
              {row.assessments.map((assessment, index) => (
                <Badge key={index} variant="outline" className="font-normal">
                  {assessment.title}:{" "}
                  {assessment.score === null ? "—" : `${assessment.score}/${assessment.maxScore}`}
                </Badge>
              ))}
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}
