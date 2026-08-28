import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  FileCheck2,
  ListChecks,
  MessageCircle,
  PlayCircle,
  type LucideIcon,
} from "lucide-react";

import { PortalShell } from "@/components/portal/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { listAvailableAssignmentsFn } from "@/functions/assignmentSubmissions";
import { listAvailableExamsFn } from "@/functions/examAttempts";
import { listRecentForumThreadsFn } from "@/functions/forum";
import { getMyStudentReportFn } from "@/functions/report";
import { getCurrentStudentFn } from "@/functions/studentAuth";
import { MINIMUM_ATTENDANCE_RATIO } from "@/lib/attendance";
import { toDisplayFirstName } from "@/lib/formatName";
import { PASSING_AVERAGE } from "@/lib/grades";
import { cn } from "@/lib/utils";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Início do portal — visão geral: resumo, próximas tarefas, provas agendadas e fórum em atividade. */
export function PortalHome() {
  const { data: student } = useQuery({
    queryKey: ["current-student"],
    queryFn: () => getCurrentStudentFn(),
  });
  const { data: report, isLoading: loadingReport } = useQuery({
    queryKey: ["my-student-report"],
    queryFn: () => getMyStudentReportFn(),
  });
  const { data: assignments, isLoading: loadingAssignments } = useQuery({
    queryKey: ["available-assignments"],
    queryFn: () => listAvailableAssignmentsFn(),
  });
  const { data: exams, isLoading: loadingExams } = useQuery({
    queryKey: ["available-exams"],
    queryFn: () => listAvailableExamsFn(),
  });
  const { data: threads, isLoading: loadingThreads } = useQuery({
    queryKey: ["recent-forum-threads"],
    queryFn: () => listRecentForumThreadsFn(),
  });

  const summary = useMemo(() => {
    const rows = report?.rows ?? [];
    const withAverage = rows.filter((r) => r.average !== null);
    const generalAverage =
      withAverage.length === 0
        ? null
        : withAverage.reduce((sum, r) => sum + (r.average ?? 0), 0) / withAverage.length;
    const totalLessons = rows.reduce((sum, r) => sum + r.totalLessons, 0);
    const totalFaltas = rows.reduce((sum, r) => sum + r.totalFaltas, 0);
    const attendanceRatio = totalLessons === 0 ? null : 1 - totalFaltas / totalLessons;
    const lowAttendance = rows.filter(
      (r) => r.attendanceRatio !== null && r.attendanceRatio < MINIMUM_ATTENDANCE_RATIO,
    );
    return { generalAverage, totalFaltas, attendanceRatio, lowAttendance };
  }, [report]);

  const upcomingAssignments = useMemo(
    () =>
      (assignments ?? [])
        .filter((a) => a.status === "pending")
        .sort((a, b) => {
          if (!a.dueAt) return 1;
          if (!b.dueAt) return -1;
          return a.dueAt.localeCompare(b.dueAt);
        })
        .slice(0, 5),
    [assignments],
  );

  const upcomingExams = useMemo(
    () =>
      (exams ?? [])
        .filter((e) => e.status !== "submitted")
        .sort((a, b) => a.opensAt.localeCompare(b.opensAt))
        .slice(0, 5),
    [exams],
  );

  return (
    <PortalShell
      title={student ? `Olá, ${toDisplayFirstName(student.name)}` : "Início"}
      description="Resumo do que precisa da sua atenção agora."
    >
      {loadingReport ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-4 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Média geral
            </p>
            <p className="mt-2 font-display text-2xl font-semibold text-foreground">
              {summary.generalAverage === null ? "—" : summary.generalAverage.toFixed(1)}
            </p>
          </div>
          <div className="rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-4 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Frequência geral
            </p>
            <p className="mt-2 font-display text-2xl font-semibold text-foreground">
              {summary.attendanceRatio === null
                ? "—"
                : `${Math.round(summary.attendanceRatio * 100)}%`}
            </p>
          </div>
          <div
            className={cn(
              "rounded-md border border-t-2 bg-card/70 p-4 shadow-soft",
              summary.lowAttendance.length > 0
                ? "border-border/70 border-t-destructive"
                : "border-border/70 border-t-accent",
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Faltas no total
            </p>
            <p className="mt-2 font-display text-2xl font-semibold text-foreground">
              {summary.totalFaltas}
            </p>
            {summary.lowAttendance.length > 0 ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                {summary.lowAttendance.length === 1
                  ? "1 disciplina abaixo do mínimo"
                  : `${summary.lowAttendance.length} disciplinas abaixo do mínimo`}
              </p>
            ) : null}
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <DashboardCard
          title="Próximas tarefas"
          icon={ListChecks}
          viewAllTo="/portal/tarefas"
          loading={loadingAssignments}
          emptyLabel="Nenhuma tarefa pendente."
        >
          {upcomingAssignments.map((assignment) => (
            <Link
              key={assignment.id}
              to="/portal/tarefas/$assignmentId"
              params={{ assignmentId: assignment.id }}
              className="flex animate-in items-start gap-2.5 rounded-md border border-border/70 bg-card/70 p-3 shadow-soft fade-in slide-in-from-top-1 duration-200 transition-colors hover:border-primary/50"
            >
              <ListChecks className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {assignment.title}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {assignment.disciplineName}
                </span>
                {assignment.dueAt ? (
                  <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarClock className="size-3 shrink-0" aria-hidden />
                    Prazo: {formatDateTime(assignment.dueAt)}
                  </span>
                ) : null}
              </span>
            </Link>
          ))}
        </DashboardCard>

        <DashboardCard
          title="Provas agendadas"
          icon={FileCheck2}
          viewAllTo="/portal/provas"
          loading={loadingExams}
          emptyLabel="Nenhuma prova agendada no momento."
        >
          {upcomingExams.map((exam) => (
            <Link
              key={exam.id}
              to="/portal/provas/$examId"
              params={{ examId: exam.id }}
              className="flex animate-in items-start gap-2.5 rounded-md border border-border/70 bg-card/70 p-3 shadow-soft fade-in slide-in-from-top-1 duration-200 transition-colors hover:border-primary/50"
            >
              <FileCheck2 className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {exam.title}
                </span>
                <span className="block text-xs text-muted-foreground">{exam.disciplineName}</span>
                <span className="mt-1 flex items-center gap-1 text-xs">
                  {exam.status === "available" || exam.status === "in_progress" ? (
                    <span className="flex items-center gap-1 font-medium text-accent">
                      <PlayCircle className="size-3 shrink-0" aria-hidden />
                      {exam.status === "in_progress" ? "Continuar" : "Disponível agora"}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <CalendarClock className="size-3 shrink-0" aria-hidden />
                      {formatDateTime(exam.opensAt)}
                    </span>
                  )}
                </span>
              </span>
            </Link>
          ))}
        </DashboardCard>

        <DashboardCard
          title="Fórum em atividade"
          icon={MessageCircle}
          viewAllTo="/portal/forum"
          loading={loadingThreads}
          emptyLabel="Nenhuma conversa por aqui ainda."
        >
          {(threads ?? []).map((thread) => (
            <Link
              key={thread.id}
              to="/portal/forum/$threadId"
              params={{ threadId: thread.id }}
              className="flex animate-in items-start gap-2.5 rounded-md border border-border/70 bg-card/70 p-3 shadow-soft fade-in slide-in-from-top-1 duration-200 transition-colors hover:border-primary/50"
            >
              <MessageCircle className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {thread.title}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {thread.disciplineName}
                  <Badge variant="outline" className="text-[10px]">
                    {thread.postCount} {thread.postCount === 1 ? "resposta" : "respostas"}
                  </Badge>
                </span>
              </span>
            </Link>
          ))}
        </DashboardCard>
      </div>

      <div className="mt-8 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-4 shadow-soft">
        <Link
          to="/portal/notas"
          className="flex items-center gap-2.5 text-sm font-medium text-foreground hover:text-accent"
        >
          <ClipboardList className="size-4 shrink-0 text-accent" aria-hidden />
          Ver boletim completo (notas e frequência por disciplina)
        </Link>
      </div>
    </PortalShell>
  );
}

function DashboardCard({
  title,
  icon: Icon,
  viewAllTo,
  loading,
  emptyLabel,
  children,
}: {
  title: string;
  icon: LucideIcon;
  viewAllTo: string;
  loading: boolean;
  emptyLabel: string;
  children: ReactNode;
}) {
  const hasContent = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-foreground">
          <Icon className="size-4 shrink-0 text-accent" aria-hidden />
          {title}
        </h2>
        <Link
          to={viewAllTo}
          className="text-xs font-medium text-muted-foreground hover:text-accent"
        >
          Ver tudo
        </Link>
      </div>
      <div className="space-y-2">
        {loading ? (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        ) : hasContent ? (
          children
        ) : (
          <p className="rounded-md border border-border/70 bg-card/40 p-4 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </p>
        )}
      </div>
    </div>
  );
}
