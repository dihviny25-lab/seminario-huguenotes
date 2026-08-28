import { useQuery } from "@tanstack/react-query";

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
import { getMyStudentReportFn } from "@/functions/report";

export function DisciplineGradesTab({ disciplineId }: { disciplineId: string }) {
  const { data: report, isLoading } = useQuery({
    queryKey: ["my-student-report"],
    queryFn: () => getMyStudentReportFn(),
  });

  if (isLoading || !report) {
    return <Skeleton className="h-48 w-full" />;
  }

  const row = report.rows.find((r) => r.disciplineId === disciplineId);
  if (!row) {
    return (
      <p className="animate-in rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft fade-in zoom-in-95 duration-300">
        Nenhuma nota lançada ainda.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border/70 bg-card/70 shadow-soft">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Avaliação</TableHead>
            <TableHead className="text-center">Nota</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {row.assessments.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={2}
                className="animate-in py-6 text-center text-muted-foreground fade-in zoom-in-95 duration-300"
              >
                Nenhuma avaliação lançada ainda.
              </TableCell>
            </TableRow>
          ) : (
            row.assessments.map((assessment) => (
              <TableRow
                key={assessment.title}
                className="animate-in fade-in slide-in-from-top-1 duration-200"
              >
                <TableCell className="font-medium text-foreground">{assessment.title}</TableCell>
                <TableCell className="text-center">
                  {assessment.score === null
                    ? "—"
                    : `${assessment.score.toFixed(1)}/${assessment.maxScore.toFixed(1)}`}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="font-semibold text-foreground">Média</TableCell>
            <TableCell className="text-center font-semibold text-foreground">
              {row.average === null ? "—" : row.average.toFixed(1)}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="text-muted-foreground">Faltas</TableCell>
            <TableCell className="text-center text-muted-foreground">
              {row.totalLessons === 0 ? "—" : `${row.totalFaltas} de ${row.totalLessons} aulas`}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
