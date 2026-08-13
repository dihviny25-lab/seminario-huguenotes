import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";

import { PainelShell } from "@/components/painel/PainelShell";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { listStudentsFn } from "@/functions/students";
import { getStudentReportFn } from "@/functions/report";

/** Busca de aluno + relatório consolidado de notas/faltas, pronto pra imprimir. */
export function Report() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: () => listStudentsFn(),
  });

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const active = (students ?? []).filter((s) => s.active);
    if (!term) return active;
    return active.filter((s) => s.name.toLowerCase().includes(term));
  }, [students, query]);

  const { data: report, isLoading } = useQuery({
    queryKey: ["student-report", selectedId],
    queryFn: () => getStudentReportFn({ data: { studentId: selectedId! } }),
    enabled: selectedId !== null,
  });

  return (
    <PainelShell
      title="Relatório do aluno"
      description="Busque um aluno para ver e imprimir o boletim consolidado de notas e faltas."
    >
      <div className="print:hidden">
        <Input
          placeholder="Buscar aluno pelo nome…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="max-w-sm"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {filtered.map((student) => (
            <Button
              key={student.id}
              type="button"
              variant={selectedId === student.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedId(student.id)}
            >
              {student.name}
            </Button>
          ))}
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum aluno encontrado.</p>
          ) : null}
        </div>
      </div>

      {!selectedId ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Busque um aluno acima pra ver e imprimir o relatório dele.
        </p>
      ) : null}

      {selectedId && (
        <div className="mt-8">
          {isLoading || !report ? (
            <p className="text-muted-foreground">Carregando relatório…</p>
          ) : (
            <div className="rounded-md border border-border/70 bg-card/70 p-6 shadow-soft print:border-none print:bg-transparent print:p-0 print:shadow-none">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
                    Seminário Huguenotes
                  </p>
                  <h2 className="font-display text-2xl font-semibold text-foreground">
                    {report.student.name}
                  </h2>
                </div>
                <div className="flex gap-2 print:hidden">
                  <Button variant="outline" asChild>
                    <a href={`/painel/relatorio/${report.student.id}/pdf`}>
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
                      <TableCell className="font-medium text-foreground">
                        {row.discipline}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.teacherName ?? "—"}
                      </TableCell>
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
        </div>
      )}
    </PainelShell>
  );
}
