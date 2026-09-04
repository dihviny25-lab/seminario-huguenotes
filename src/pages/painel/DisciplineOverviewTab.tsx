import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDisciplineOverviewFn } from "@/functions/dashboard";
import { MINIMUM_ATTENDANCE_RATIO } from "@/lib/attendance";
import { PASSING_AVERAGE } from "@/lib/grades";
import { cn } from "@/lib/utils";

type SortKey = "name" | "average" | "attendance";

export function DisciplineOverviewTab({ disciplineId }: { disciplineId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["discipline-overview", disciplineId],
    queryFn: () => getDisciplineOverviewFn({ data: { disciplineId } }),
  });
  const [sortKey, setSortKey] = useState<SortKey>("name");

  // Ordenação crescente em média/frequência: o professor acha rápido quem
  // está em risco (pior primeiro). Aluno sem nota/frequência (`null`) fica
  // por último, não primeiro — não é "o pior", é "ainda sem dado".
  const rows = useMemo(() => {
    if (!data) return [];
    const copy = [...data.rows];
    if (sortKey === "average") {
      return copy.sort((a, b) => (a.average ?? Infinity) - (b.average ?? Infinity));
    }
    if (sortKey === "attendance") {
      return copy.sort((a, b) => (a.attendanceRatio ?? Infinity) - (b.attendanceRatio ?? Infinity));
    }
    return copy.sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [data, sortKey]);

  if (isLoading || !data) {
    return (
      <div className="overflow-hidden rounded-md border border-border/70 bg-card/70 shadow-soft">
        <div className="flex items-center gap-6 border-b border-border/70 p-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="ml-auto h-4 w-16" />
        </div>
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-6 border-b border-border/70 p-3 last:border-b-0"
          >
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ml-auto h-4 w-24" />
          </div>
        ))}
      </div>
    );
  }

  function SortableHead({ label, sortableKey }: { label: string; sortableKey: SortKey }) {
    return (
      <TableHead className="text-center">
        <button
          type="button"
          onClick={() => setSortKey(sortableKey)}
          className={cn(
            "inline-flex items-center gap-1 transition-colors hover:text-foreground",
            sortKey === sortableKey && "text-foreground",
          )}
        >
          {label}
          <ArrowUpDown className="size-3" aria-hidden />
        </button>
      </TableHead>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border/70 bg-card/70 shadow-soft">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead label="Aluno" sortableKey="name" />
            <SortableHead label="Média" sortableKey="average" />
            <SortableHead label="Frequência" sortableKey="attendance" />
            <TableHead className="text-center">Tarefas</TableHead>
            <TableHead className="text-center">Provas</TableHead>
            <TableHead className="text-center">Vídeos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                Nenhum aluno ativo cadastrado.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const belowAverage = row.average !== null && row.average < PASSING_AVERAGE;
              const belowAttendance =
                row.attendanceRatio !== null && row.attendanceRatio < MINIMUM_ATTENDANCE_RATIO;
              return (
                <TableRow
                  key={row.studentId}
                  className="animate-in fade-in slide-in-from-top-1 duration-200"
                >
                  <TableCell className="font-medium text-foreground">{row.studentName}</TableCell>
                  <TableCell
                    className={cn("text-center", belowAverage && "font-medium text-destructive")}
                  >
                    {row.average === null ? "—" : row.average.toFixed(1)}
                  </TableCell>
                  <TableCell
                    className={cn("text-center", belowAttendance && "font-medium text-destructive")}
                  >
                    {row.attendanceRatio === null
                      ? "—"
                      : `${Math.round(row.attendanceRatio * 100)}%`}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.assignmentsSubmitted}/{row.assignmentsTotal}
                    {row.assignmentsAwaitingGrading > 0 ? (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({row.assignmentsAwaitingGrading} p/ corrigir)
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.examsTaken}/{row.examsTotal}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.videosWatched}/{row.videosTotal}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
