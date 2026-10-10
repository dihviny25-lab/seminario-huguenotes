import { Badge } from "@/components/ui/badge";
import { MINIMUM_ATTENDANCE_RATIO } from "@/lib/attendance";
import { PASSING_AVERAGE } from "@/lib/grades";
import type { AtRiskStudentItem } from "@/lib/teacherDashboard";
import { cn } from "@/lib/utils";

const numberFormat = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});
const percentFormat = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 2,
});

const reasonLabels = {
  media: "Nota abaixo do mínimo",
  frequencia: "Frequência abaixo do mínimo",
  ambos: "Nota e frequência abaixo do mínimo",
};

export function AtRiskStudentDetails({ student }: { student: AtRiskStudentItem }) {
  return (
    <ul className="mt-2 space-y-3 text-xs text-muted-foreground">
      {student.disciplines.map((discipline) => (
        <li key={discipline.disciplineId} className="space-y-1 break-words">
          <p className="font-medium text-foreground">{discipline.disciplineName}</p>
          {discipline.teacherName ? <p>Professor: {discipline.teacherName}</p> : null}
          <Badge
            variant="outline"
            className="h-auto whitespace-normal border-destructive/40 text-destructive"
          >
            {reasonLabels[discipline.reason]}
          </Badge>
          <p className={cn(discipline.reason !== "frequencia" && "font-medium text-destructive")}>
            {discipline.average === null
              ? "Sem notas lançadas"
              : `Média atual: ${numberFormat.format(discipline.average)} · mínimo ${numberFormat.format(PASSING_AVERAGE)}`}
          </p>
          <p className={cn(discipline.reason !== "media" && "font-medium text-destructive")}>
            {discipline.totalFaltas} {discipline.totalFaltas === 1 ? "falta" : "faltas"} em{" "}
            {discipline.totalLessons} {discipline.totalLessons === 1 ? "aula" : "aulas"}
            {discipline.attendanceRatio === null
              ? " · frequência ainda não disponível"
              : ` · frequência ${percentFormat.format(discipline.attendanceRatio)} (mínimo ${percentFormat.format(MINIMUM_ATTENDANCE_RATIO)})`}
          </p>
        </li>
      ))}
    </ul>
  );
}
