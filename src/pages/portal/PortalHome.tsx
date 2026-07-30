import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";

import { PortalShell } from "@/components/portal/PortalShell";
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

/** Portal do aluno: só as próprias notas e faltas, em todas as disciplinas. */
export function PortalHome() {
  const { data: report, isLoading } = useQuery({
    queryKey: ["my-student-report"],
    queryFn: () => getMyStudentReportFn(),
  });

  return (
    <PortalShell
      title={report ? report.student.name : "Minhas notas e faltas"}
      description="Consulte suas notas e faltas em todas as disciplinas do curso."
    >
      {isLoading || !report ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <div className="rounded-[1.25rem] border border-border/70 bg-card/70 p-6 shadow-soft print:border-none print:bg-transparent print:p-0 print:shadow-none">
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
                <TableHead className="text-center">Faltas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.map((row) => (
                <TableRow key={row.disciplineId}>
                  <TableCell>{row.semester}º</TableCell>
                  <TableCell>{row.module}</TableCell>
                  <TableCell className="font-medium text-foreground">{row.discipline}</TableCell>
                  <TableCell className="text-muted-foreground">{row.teacherName ?? "—"}</TableCell>
                  <TableCell className="text-center">
                    {row.average === null ? "—" : row.average.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.totalLessons === 0 ? "—" : row.totalFaltas}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={6} className="text-xs text-muted-foreground">
                  Emitido em {new Date().toLocaleDateString("pt-BR")}.
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </PortalShell>
  );
}
