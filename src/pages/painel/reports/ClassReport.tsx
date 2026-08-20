import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronLeft, Download, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listMyDisciplinesFn } from "@/functions/disciplines";
import { getClassReportFn } from "@/functions/report";

/** Boletim da turma inteira de uma disciplina — escolhe a disciplina, depois vê/imprime. */
export function ClassReport() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: disciplines, isLoading: loadingDisciplines } = useQuery({
    queryKey: ["my-disciplines"],
    queryFn: () => listMyDisciplinesFn(),
  });

  const selected = disciplines?.find((d) => d.id === selectedId) ?? null;

  const { data: report, isLoading: loadingReport } = useQuery({
    queryKey: ["class-report", selectedId],
    queryFn: () => getClassReportFn({ data: { disciplineId: selectedId! } }),
    enabled: selectedId !== null,
  });

  if (!selected) {
    return (
      <div>
        <p className="mb-4 text-sm text-muted-foreground">
          Escolha uma disciplina pra ver o boletim da turma inteira.
        </p>
        {loadingDisciplines || !disciplines ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full" />
            ))}
          </div>
        ) : disciplines.length === 0 ? (
          <p className="rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft">
            Você ainda não tem disciplinas atribuídas.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {disciplines.map((discipline) => (
              <button
                key={discipline.id}
                type="button"
                onClick={() => setSelectedId(discipline.id)}
                className="flex items-start gap-3 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-4 text-left shadow-soft transition-colors hover:border-primary/50"
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
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setSelectedId(null)}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-accent print:hidden"
      >
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        Escolher outra disciplina
      </button>

      {loadingReport || !report ? (
        <p className="text-muted-foreground">Carregando relatório…</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border/70 bg-card/70 p-6 shadow-soft print:border-none print:bg-transparent print:p-0 print:shadow-none">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
                Seminário Huguenotes
              </p>
              <h2 className="font-display text-2xl font-semibold text-foreground">
                {report.discipline.discipline}
              </h2>
              <p className="text-sm text-muted-foreground">
                {report.discipline.module} · {report.discipline.term}
              </p>
            </div>
            <div className="flex gap-2 print:hidden">
              <Button variant="outline" asChild>
                <a href={`/painel/relatorio/turma/${report.discipline.id}/pdf`}>
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
                <TableHead>Aluno</TableHead>
                {report.assessments.map((assessment) => (
                  <TableHead key={assessment.id} className="text-center">
                    {assessment.title}
                  </TableHead>
                ))}
                <TableHead className="text-center">Média</TableHead>
                <TableHead className="text-center">Faltas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={report.assessments.length + 3}
                    className="py-6 text-center text-muted-foreground"
                  >
                    Nenhum aluno ativo cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                report.rows.map((row) => (
                  <TableRow key={row.studentId}>
                    <TableCell className="font-medium text-foreground">{row.studentName}</TableCell>
                    {row.scores.map((score) => (
                      <TableCell key={score.assessmentId} className="text-center">
                        {score.score === null ? "—" : score.score.toFixed(1)}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-medium text-foreground">
                      {row.average === null ? "—" : row.average.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.totalLessons === 0 ? "—" : row.totalFaltas}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell
                  colSpan={report.assessments.length + 3}
                  className="text-xs text-muted-foreground"
                >
                  Emitido em {new Date().toLocaleDateString("pt-BR")}.
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </div>
  );
}
