import { useQuery } from "@tanstack/react-query";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listDisciplineLessonsFn } from "@/functions/attendance";

const NONE_VALUE = "__nenhuma__";

function formatLessonLabel(lesson: { sequence: number; date: string | null }): string {
  if (!lesson.date) return `Aula ${lesson.sequence}`;
  const [, month, day] = lesson.date.split("-");
  return `Aula ${lesson.sequence} — ${day}/${month}`;
}

/**
 * Seletor opcional "qual aula" ao criar/editar conteúdo (material, vídeo,
 * prova, tarefa, slide) — sem aula escolhida, o conteúdo é geral da
 * disciplina e sempre visível. Com aula, só aparece pra quem tem acesso a
 * ela (alunos de matrícula seletiva).
 */
export function LessonSelect({
  disciplineId,
  value,
  onChange,
}: {
  disciplineId: string;
  value: string | undefined;
  onChange: (lessonId: string | undefined) => void;
}) {
  const { data } = useQuery({
    queryKey: ["discipline-lessons-picker", disciplineId],
    queryFn: () => listDisciplineLessonsFn({ data: { disciplineId } }),
  });

  return (
    <Select
      value={value ?? NONE_VALUE}
      onValueChange={(next) => onChange(next === NONE_VALUE ? undefined : next)}
    >
      <SelectTrigger>
        <SelectValue placeholder="Conteúdo geral (nenhuma aula)" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>Conteúdo geral (nenhuma aula)</SelectItem>
        {(data ?? []).map((lesson) => (
          <SelectItem key={lesson.id} value={lesson.id}>
            {formatLessonLabel(lesson)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
