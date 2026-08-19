import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, Download, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PainelShell } from "@/components/painel/PainelShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { listStudentsFn } from "@/functions/students";
import { getStudentReportFn } from "@/functions/report";
import {
  createObservationFn,
  deleteObservationFn,
  listStudentObservationsFn,
} from "@/functions/observations";

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

          <div className="mt-6 print:hidden">
            <ObservationsSection studentId={selectedId} />
          </div>
        </div>
      )}
    </PainelShell>
  );
}

function ObservationsSection({ studentId }: { studentId: string }) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const observationsKey = ["student-observations", studentId] as const;
  const { data: observations, isLoading } = useQuery({
    queryKey: observationsKey,
    queryFn: () => listStudentObservationsFn({ data: { studentId } }),
  });

  const createMutation = useMutation({
    mutationFn: () => createObservationFn({ data: { studentId, content } }),
    onSuccess: async () => {
      setContent("");
      await queryClient.invalidateQueries({ queryKey: observationsKey });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteObservationFn({ data: { id } }),
    onSuccess: async () => {
      setDeleteId(null);
      await queryClient.invalidateQueries({ queryKey: observationsKey });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível apagar."),
  });

  return (
    <div className="rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-6 shadow-soft">
      <h3 className="font-display text-lg font-semibold text-foreground">Observações</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Anotações da equipe de professores sobre este aluno — visíveis para todos, editáveis só por
        quem escreveu.
      </p>

      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (content.trim().length === 0) return;
          createMutation.mutate();
        }}
      >
        <Textarea
          placeholder="Escreva uma observação sobre o aluno…"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={3}
        />
        <Button type="submit" disabled={createMutation.isPending} className="self-end">
          Adicionar observação
        </Button>
      </form>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        ) : observations && observations.length > 0 ? (
          observations.map((observation) => (
            <div
              key={observation.id}
              className="rounded-md border border-border/70 bg-background/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{observation.authorName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(observation.createdAt).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                {observation.mine && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteId(observation.id)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    <span className="sr-only">Apagar observação</span>
                  </Button>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                {observation.content}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma observação registrada ainda.</p>
        )}
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar observação?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
