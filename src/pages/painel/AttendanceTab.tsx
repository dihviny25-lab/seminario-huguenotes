import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, QrCode, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  closeLessonCheckInFn,
  createLessonFn,
  deleteLessonFn,
  getAttendanceBoardFn,
  openLessonCheckInFn,
  setAttendanceFn,
  setLessonAttendanceAllFn,
  type AttendanceBoard,
} from "@/functions/attendance";

function attendanceKey(disciplineId: string) {
  return ["attendance-board", disciplineId] as const;
}

function formatLessonLabel(lesson: { date: string | null; sequence: number }): string {
  if (!lesson.date) return `Aula ${lesson.sequence}`;
  const [year, month, day] = lesson.date.split("-");
  return `${day}/${month}`;
}

export function AttendanceTab({ disciplineId }: { disciplineId: string }) {
  const queryClient = useQueryClient();
  const [checkInDialogLessonId, setCheckInDialogLessonId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: attendanceKey(disciplineId),
    queryFn: () => getAttendanceBoardFn({ data: { disciplineId } }),
    refetchInterval: checkInDialogLessonId ? 3000 : false,
  });
  const [newDate, setNewDate] = useState("");

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: attendanceKey(disciplineId) });
  }

  const createLessonMutation = useMutation({
    mutationFn: () => createLessonFn({ data: { disciplineId, date: newDate || undefined } }),
    onSuccess: async () => {
      toast.success("Aula adicionada.");
      setNewDate("");
      await invalidate();
    },
    onError: () => toast.error("Não foi possível adicionar a aula."),
  });

  const startTodayCheckInMutation = useMutation({
    mutationFn: async () => {
      const todayISO = new Date().toISOString().slice(0, 10);
      const existing = data?.lessons.find((lesson) => lesson.date === todayISO);
      if (existing) return existing.id;
      const created = await createLessonFn({ data: { disciplineId, date: todayISO } });
      await invalidate();
      return created.id;
    },
    onSuccess: (lessonId) => setCheckInDialogLessonId(lessonId),
    onError: () => toast.error("Não foi possível iniciar a chamada."),
  });

  const deleteLessonMutation = useMutation({
    mutationFn: (lessonId: string) => deleteLessonFn({ data: { disciplineId, lessonId } }),
    onSuccess: async () => {
      toast.success("Aula removida.");
      await invalidate();
    },
    onError: () => toast.error("Não foi possível remover a aula."),
  });

  const attendanceMutation = useMutation({
    mutationFn: (input: { lessonId: string; studentId: string; present: boolean }) =>
      setAttendanceFn({ data: { disciplineId, ...input } }),
    onSuccess: () => invalidate(),
    onError: () => toast.error("Não foi possível salvar a presença."),
  });

  const attendanceAllMutation = useMutation({
    mutationFn: (input: { lessonId: string; present: boolean }) =>
      setLessonAttendanceAllFn({ data: { disciplineId, ...input } }),
    onSuccess: () => invalidate(),
    onError: () => toast.error("Não foi possível atualizar a presença de todos."),
  });

  if (isLoading || !data) {
    return (
      <div className="overflow-hidden rounded-md border border-border/70 bg-card/70 shadow-soft">
        <div className="flex items-center gap-6 border-b border-border/70 p-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="ml-auto h-4 w-14" />
        </div>
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-6 border-b border-border/70 p-3 last:border-b-0"
          >
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ml-auto h-4 w-8" />
          </div>
        ))}
      </div>
    );
  }

  const presentByKey = new Map(
    data.attendance.map((a) => [`${a.lessonId}:${a.studentId}`, a.present]),
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button
          onClick={() => startTodayCheckInMutation.mutate()}
          disabled={startTodayCheckInMutation.isPending}
        >
          {startTodayCheckInMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <QrCode className="size-4" aria-hidden />
          )}
          {startTodayCheckInMutation.isPending ? "Abrindo…" : "Chamada de hoje"}
        </Button>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={newDate}
            onChange={(event) => setNewDate(event.target.value)}
            className="w-40"
          />
          <Button
            variant="outline"
            onClick={() => createLessonMutation.mutate()}
            disabled={createLessonMutation.isPending}
          >
            {createLessonMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="size-4" aria-hidden />
            )}
            Nova aula
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-border/70 bg-card/70 shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aluno</TableHead>
              {data.lessons.map((lesson) => {
                const presentCount = data.students.filter(
                  (student) => (presentByKey.get(`${lesson.id}:${student.id}`) ?? true) === true,
                ).length;
                const allPresent =
                  data.students.length > 0 && presentCount === data.students.length;
                const nonePresent = presentCount === 0;
                return (
                  <TableHead key={lesson.id} className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Checkbox
                        checked={allPresent ? true : nonePresent ? false : "indeterminate"}
                        title={allPresent ? "Desmarcar todos" : "Marcar todos presentes"}
                        onCheckedChange={() =>
                          attendanceAllMutation.mutate({
                            lessonId: lesson.id,
                            present: !allPresent,
                          })
                        }
                      />
                      <span>{formatLessonLabel(lesson)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        title="Chamada por QR code"
                        onClick={() => setCheckInDialogLessonId(lesson.id)}
                      >
                        <QrCode className="size-3.5" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        title="Remover aula"
                        onClick={() => deleteLessonMutation.mutate(lesson.id)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    </div>
                  </TableHead>
                );
              })}
              <TableHead className="text-center">Faltas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.students.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={data.lessons.length + 2}
                  className="py-6 text-center text-muted-foreground"
                >
                  Nenhum aluno ativo cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              data.students.map((student) => {
                const totalFaltas = data.lessons.filter(
                  (lesson) => presentByKey.get(`${lesson.id}:${student.id}`) === false,
                ).length;

                return (
                  <TableRow
                    key={student.id}
                    className="animate-in fade-in slide-in-from-top-1 duration-200 even:bg-muted/30"
                  >
                    <TableCell className="font-medium text-foreground">{student.name}</TableCell>
                    {data.lessons.map((lesson) => {
                      const key = `${lesson.id}:${student.id}`;
                      // Sem registro = presente por padrão (ninguém marcou falta ainda).
                      const present = presentByKey.get(key) ?? true;
                      return (
                        <TableCell key={lesson.id} className="text-center">
                          <Checkbox
                            checked={present}
                            onCheckedChange={(checked) =>
                              attendanceMutation.mutate({
                                lessonId: lesson.id,
                                studentId: student.id,
                                present: checked === true,
                              })
                            }
                          />
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-medium text-foreground">
                      {totalFaltas}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <LessonCheckInDialog
        disciplineId={disciplineId}
        lesson={data.lessons.find((l) => l.id === checkInDialogLessonId) ?? null}
        attendance={data.attendance}
        onOpenChange={(open) => !open && setCheckInDialogLessonId(null)}
        onChanged={invalidate}
      />
    </div>
  );
}

function LessonCheckInDialog({
  disciplineId,
  lesson,
  attendance,
  onOpenChange,
  onChanged,
}: {
  disciplineId: string;
  lesson: AttendanceBoard["lessons"][number] | null;
  attendance: AttendanceBoard["attendance"];
  onOpenChange: (open: boolean) => void;
  onChanged: () => Promise<unknown>;
}) {
  const openMutation = useMutation({
    mutationFn: (lessonId: string) => openLessonCheckInFn({ data: { disciplineId, lessonId } }),
    onSuccess: async () => {
      await onChanged();
    },
    onError: () => toast.error("Não foi possível abrir a chamada."),
  });

  const closeMutation = useMutation({
    mutationFn: (lessonId: string) => closeLessonCheckInFn({ data: { disciplineId, lessonId } }),
    onSuccess: async () => {
      toast.success("Chamada encerrada.");
      await onChanged();
      onOpenChange(false);
    },
    onError: () => toast.error("Não foi possível encerrar a chamada."),
  });

  // Abre a chamada sozinha assim que o diálogo aparece — sem passo manual extra.
  useEffect(() => {
    if (lesson && !lesson.checkInOpen) {
      openMutation.mutate(lesson.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id]);

  const checkinUrl =
    lesson?.checkInOpen && lesson.checkInToken && typeof window !== "undefined"
      ? `${window.location.origin}/portal/checkin/${lesson.id}?token=${lesson.checkInToken}`
      : null;

  const confirmedCount = lesson
    ? attendance.filter((a) => a.lessonId === lesson.id && a.present).length
    : 0;

  return (
    <Dialog open={lesson !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chamada por QR code</DialogTitle>
        </DialogHeader>
        {checkinUrl ? (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-xl bg-white p-5">
              <QRCodeSVG value={checkinUrl} size={320} />
            </div>
            <p className="text-sm text-muted-foreground">
              {confirmedCount} aluno(s) já confirmaram presença.
            </p>
            <Button
              variant="outline"
              onClick={() => lesson && closeMutation.mutate(lesson.id)}
              disabled={closeMutation.isPending}
            >
              {closeMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              Encerrar chamada
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">Abrindo chamada…</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
