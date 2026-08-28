import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarCheck,
  ChevronsUpDown,
  Download,
  GraduationCap,
  Loader2,
  Printer,
  ShieldCheck,
  Target,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { PainelShell } from "@/components/painel/PainelShell";
import { StatisticCard } from "@/components/StatisticCard";
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
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  createObservationFn,
  deleteObservationFn,
  listStudentObservationsFn,
} from "@/functions/observations";
import { addReflectionCommentFn, listStudentReflectionsFn } from "@/functions/reflections";
import { getStudentReportFn } from "@/functions/report";
import { listStudentsFn } from "@/functions/students";
import { MINIMUM_ATTENDANCE_RATIO } from "@/lib/attendance";
import { PASSING_AVERAGE } from "@/lib/grades";

/** Busca de aluno + relatório consolidado de notas/faltas, com filtro por semestre. */
export function StudentReport() {
  const [comboOpen, setComboOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [semesterFilter, setSemesterFilter] = useState<string>("all");

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

  const semesters = useMemo(
    () => [...new Set((report?.rows ?? []).map((r) => r.semester))].sort((a, b) => a - b),
    [report],
  );
  const filteredRows = useMemo(() => {
    if (!report) return [];
    if (semesterFilter === "all") return report.rows;
    return report.rows.filter((row) => row.semester === Number(semesterFilter));
  }, [report, semesterFilter]);

  const summary = useMemo(() => {
    const graded = filteredRows.filter((r) => r.average !== null);
    const averages = graded.map((r) => r.average!);
    const generalAverage =
      averages.length === 0 ? null : averages.reduce((sum, a) => sum + a, 0) / averages.length;

    const withAttendance = filteredRows.filter((r) => r.attendanceRatio !== null);
    const ratios = withAttendance.map((r) => r.attendanceRatio!);
    const generalAttendance =
      ratios.length === 0 ? null : ratios.reduce((sum, r) => sum + r, 0) / ratios.length;

    const situationOk =
      (generalAverage === null || generalAverage >= PASSING_AVERAGE) &&
      (generalAttendance === null || generalAttendance >= MINIMUM_ATTENDANCE_RATIO);

    return { generalAverage, generalAttendance, gradedCount: graded.length, situationOk };
  }, [filteredRows]);

  return (
    <PainelShell
      title="Boletim do aluno"
      description="Busque um aluno para ver e imprimir o boletim consolidado de notas e faltas."
    >
      <div className="flex flex-wrap items-center gap-3 print:hidden">
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

        {selectedId && semesters.length > 1 ? (
          <Select value={semesterFilter} onValueChange={setSemesterFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Semestre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Curso completo</SelectItem>
              {semesters.map((semester) => (
                <SelectItem key={semester} value={String(semester)}>
                  {semester}º Semestre
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {!selectedId ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Busque um aluno acima pra ver e imprimir o relatório dele.
        </p>
      ) : null}

      {selectedId && (
        <div className="mt-8">
          {isLoading || !report ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-20 w-full" />
                ))}
              </div>
              <div className="space-y-3 rounded-md border border-border/70 bg-card/70 p-6 shadow-soft">
                <Skeleton className="h-6 w-1/3" />
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
                  label="Média geral"
                  value={summary.generalAverage === null ? "—" : summary.generalAverage.toFixed(1)}
                  icon={Target}
                  hint={`${summary.gradedCount} disciplina(s) com nota`}
                />
                <StatisticCard
                  label="Frequência geral"
                  value={
                    summary.generalAttendance === null
                      ? "—"
                      : `${Math.round(summary.generalAttendance * 100)}%`
                  }
                  icon={CalendarCheck}
                />
                <StatisticCard
                  label="Disciplinas"
                  value={filteredRows.length}
                  icon={GraduationCap}
                />
                <StatisticCard
                  label="Situação"
                  value={summary.situationOk ? "Em dia" : "Atenção"}
                  icon={ShieldCheck}
                />
              </div>

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
                    {filteredRows.map((row) => (
                      <TableRow
                        key={row.disciplineId}
                        className="animate-in fade-in slide-in-from-top-1 duration-200"
                      >
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
            </>
          )}

          <div className="mt-6 space-y-6 print:hidden">
            <DiscipleshipSection studentId={selectedId} />
            <ObservationsSection studentId={selectedId} />
          </div>
        </div>
      )}
    </PainelShell>
  );
}

function DiscipleshipSection({ studentId }: { studentId: string }) {
  const queryClient = useQueryClient();
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const reflectionsKey = ["student-reflections", studentId] as const;
  const { data: reflections, isLoading } = useQuery({
    queryKey: reflectionsKey,
    queryFn: () => listStudentReflectionsFn({ data: { studentId } }),
  });

  const commentMutation = useMutation({
    mutationFn: ({ reflectionId, content }: { reflectionId: string; content: string }) =>
      addReflectionCommentFn({ data: { reflectionId, content } }),
    onSuccess: async (_data, variables) => {
      setCommentDrafts((prev) => ({ ...prev, [variables.reflectionId]: "" }));
      await queryClient.invalidateQueries({ queryKey: reflectionsKey });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível comentar."),
  });

  return (
    <div className="rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-6 shadow-soft">
      <h3 className="font-display text-lg font-semibold text-foreground">Discipulado</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Reflexões espirituais que o próprio aluno registrou — qualquer professor pode responder.
      </p>

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </>
        ) : reflections && reflections.length > 0 ? (
          reflections.map((reflection) => (
            <div
              key={reflection.id}
              className="animate-in rounded-md border border-border/70 bg-background/60 p-4 fade-in slide-in-from-top-1 duration-200"
            >
              <p className="text-sm font-medium text-accent">{reflection.prompt}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                {reflection.content}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(reflection.createdAt).toLocaleDateString("pt-BR", { dateStyle: "long" })}
              </p>

              {reflection.comments.length > 0 ? (
                <div className="mt-3 space-y-2 border-t border-border/70 pt-3">
                  {reflection.comments.map((comment) => (
                    <div key={comment.id} className="rounded-md bg-muted/40 p-3">
                      <p className="text-xs font-medium text-foreground">{comment.authorName}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                        {comment.content}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

              <form
                className="mt-3 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const content = (commentDrafts[reflection.id] ?? "").trim();
                  if (content.length === 0) return;
                  commentMutation.mutate({ reflectionId: reflection.id, content });
                }}
              >
                <Textarea
                  placeholder="Responder…"
                  rows={1}
                  value={commentDrafts[reflection.id] ?? ""}
                  onChange={(event) =>
                    setCommentDrafts((prev) => ({ ...prev, [reflection.id]: event.target.value }))
                  }
                />
                <Button type="submit" size="sm" disabled={commentMutation.isPending}>
                  {commentMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : null}
                  Responder
                </Button>
              </form>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma reflexão registrada ainda.</p>
        )}
      </div>
    </div>
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
          {createMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : null}
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
              className="animate-in rounded-md border border-border/70 bg-background/60 p-4 fade-in slide-in-from-top-1 duration-200"
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
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
