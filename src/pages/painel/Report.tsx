import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown, Download, Printer } from "lucide-react";

import { PainelShell } from "@/components/painel/PainelShell";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  const [comboOpen, setComboOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: () => listStudentsFn(),
  });

  const activeStudents = useMemo(() => (students ?? []).filter((s) => s.active), [students]);
  const selectedStudent = activeStudents.find((s) => s.id === selectedId) ?? null;

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
        <Popover open={comboOpen} onOpenChange={setComboOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={comboOpen}
              className="w-full justify-between sm:max-w-sm"
            >
              <span className="truncate">
                {selectedStudent ? selectedStudent.name : "Buscar aluno pelo nome…"}
              </span>
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar aluno…" />
              <CommandList>
                <CommandEmpty>Nenhum aluno encontrado.</CommandEmpty>
                <CommandGroup>
                  {activeStudents.map((student) => (
                    <CommandItem
                      key={student.id}
                      value={student.name}
                      onSelect={() => {
                        setSelectedId(student.id);
                        setComboOpen(false);
                      }}
                    >
                      {student.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
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
