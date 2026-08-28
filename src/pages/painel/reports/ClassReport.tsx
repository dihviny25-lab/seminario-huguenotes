import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookOpen,
  ChevronLeft,
  Download,
  Printer,
  Target,
  Users,
} from "lucide-react";

import { PainelShell } from "@/components/painel/PainelShell";
import { StatisticCard } from "@/components/StatisticCard";
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
import { PASSING_AVERAGE } from "@/lib/grades";

/** Boletim de todos os alunos de uma disciplina — escolhe a disciplina, depois vê/imprime. */
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

  const summary = useMemo(() => {
    if (!report) return null;
    const graded = report.rows.filter((r) => r.average !== null);
    const averages = graded.map((r) => r.average!);
    const classAverage =
      averages.length === 0 ? null : averages.reduce((sum, a) => sum + a, 0) / averages.length;
    const approvedCount = graded.filter((r) => r.average! >= PASSING_AVERAGE).length;
    const approvalRate = graded.length === 0 ? null : (approvedCount / graded.length) * 100;
    const belowAverageCount = graded.filter((r) => r.average! < PASSING_AVERAGE).length;
    return { classAverage, approvalRate, belowAverageCount, gradedCount: graded.length };
  }, [report]);

  return (
    <PainelShell
      title="Relatório por módulo"
      description="Escolha uma disciplina para ver o boletim de todos os alunos dela."
    >
      {!selected ? (
        <div>
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
                  className="flex animate-in items-start gap-3 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-4 text-left shadow-soft fade-in slide-in-from-top-1 duration-200 transition-colors hover:border-primary/50"
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
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-accent print:hidden"
          >
            <ChevronLeft className="size-4 shrink-0" aria-hidden />
            Escolher outra disciplina
          </button>

          {loadingReport || !report || !summary ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-20 w-full" />
                ))}
              </div>
              <div className="space-y-3 rounded-md border border-border/70 bg-card/70 p-6 shadow-soft">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-1/4" />
                <div className="mt-4 space-y-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-8 w-full" />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6 grid grid-cols-2 gap-4 print:hidden lg:grid-cols-4">
                <StatisticCard
                  label="Média da turma"
                  value={summary.classAverage === null ? "—" : summary.classAverage.toFixed(1)}
                  icon={Target}
                />
                <StatisticCard
                  label="Aprovação"
                  value={
                    summary.approvalRate === null ? "—" : `${Math.round(summary.approvalRate)}%`
                  }
                  icon={Users}
                  hint={`${summary.gradedCount} aluno(s) com nota lançada`}
                />
                <StatisticCard
                  label="Abaixo da média"
                  value={summary.belowAverageCount}
                  icon={AlertTriangle}
                />
                <StatisticCard label="Total de alunos" value={report.rows.length} icon={BookOpen} />
              </div>

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
                        <TableRow
                          key={row.studentId}
                          className="animate-in fade-in slide-in-from-top-1 duration-200"
                        >
                          <TableCell className="font-medium text-foreground">
                            {row.studentName}
                          </TableCell>
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
            </>
          )}
        </div>
      )}
    </PainelShell>
  );
}
