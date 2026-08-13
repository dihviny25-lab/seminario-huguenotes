import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, QrCode, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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

  if (isLoading || !data) {
    return <p className="py-6 text-center text-muted-foreground">Carregando…</p>;
  }

  const presentByKey = new Map(
    data.attendance.map((a) => [`${a.lessonId}:${a.studentId}`, a.present]),
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-end gap-2">
        <Input
          type="date"
          value={newDate}
          onChange={(event) => setNewDate(event.target.value)}
          className="w-40"
        />
        <Button
          onClick={() => createLessonMutation.mutate()}
          disabled={createLessonMutation.isPending}
        >
          <Plus className="size-4" aria-hidden />
          Nova aula
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border border-border/70 bg-card/70 shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aluno</TableHead>
              {data.lessons.map((lesson) => (
                <TableHead key={lesson.id} className="text-center">
                  <div className="flex items-center justify-center gap-1">
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
              ))}
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
                  <TableRow key={student.id} className="even:bg-muted/30">
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
    },
    onError: () => toast.error("Não foi possível encerrar a chamada."),
  });

  const checkinUrl =
    lesson?.checkInOpen && lesson.checkInToken && typeof window !== "undefined"
      ? `${window.location.origin}/portal/checkin/${lesson.id}?token=${lesson.checkInToken}`
      : null;

  const confirmedCount = lesson
    ? attendance.filter((a) => a.lessonId === lesson.id && a.present).length
    : 0;

  return (
    <Dialog open={lesson !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chamada por QR code</DialogTitle>
        </DialogHeader>
        {checkinUrl ? (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-xl bg-white p-4">
              <QRCodeSVG value={checkinUrl} size={220} />
            </div>
            <p className="text-sm text-muted-foreground">
              {confirmedCount} aluno(s) já confirmaram presença.
            </p>
            <Button
              variant="outline"
              onClick={() => lesson && closeMutation.mutate(lesson.id)}
              disabled={closeMutation.isPending}
            >
              Encerrar chamada
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <p className="text-center text-sm text-muted-foreground">
              Abra a chamada pra gerar o QR code — os alunos confirmam presença escaneando com o
              celular, já logados no portal.
            </p>
            <Button
              onClick={() => lesson && openMutation.mutate(lesson.id)}
              disabled={openMutation.isPending}
            >
              Iniciar chamada por QR code
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
