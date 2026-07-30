import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  createLessonFn,
  deleteLessonFn,
  getAttendanceBoardFn,
  setAttendanceFn,
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
  const { data, isLoading } = useQuery({
    queryKey: attendanceKey(disciplineId),
    queryFn: () => getAttendanceBoardFn({ data: { disciplineId } }),
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

      <div className="overflow-hidden rounded-[1.25rem] border border-border/70 bg-card/70 shadow-soft">
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
                  <TableRow key={student.id}>
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
    </div>
  );
}
