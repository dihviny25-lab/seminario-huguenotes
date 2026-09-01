import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarClock,
  CalendarRange,
  ClipboardCheck,
  ListChecks,
  MessageCircle,
  PackageOpen,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { TeacherDashboard } from "@/functions/teacherDashboard";

import { DashboardCard } from "./DashboardCard";

const ITEM_CLASS =
  "flex animate-in items-start gap-2.5 rounded-md border border-border/70 bg-card/70 p-3 shadow-soft fade-in slide-in-from-top-1 duration-200 transition-colors hover:border-primary/50";

function fmtDate(iso: string): string {
  return format(new Date(`${iso}T00:00:00`), "dd/MM", { locale: ptBR });
}

export function DashboardCards({
  data,
  isLoading,
}: {
  data: TeacherDashboard | undefined;
  isLoading: boolean;
}) {
  const d = data;
  return (
    <>
      <div id="card-pendingGrading">
        <DashboardCard
          title="Correções pendentes"
          icon={ClipboardCheck}
          isLoading={isLoading}
          isEmpty={!d || d.pendingGrading.length === 0}
          emptyLabel="Nenhuma entrega aguardando correção."
        >
          {d?.pendingGrading.map((item) => (
            <Link
              key={item.assignmentId}
              to="/painel/tarefas/$assignmentId"
              params={{ assignmentId: item.assignmentId }}
              className={ITEM_CLASS}
            >
              <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {item.title}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {item.disciplineName}
                  <Badge variant="outline" className="text-[10px]">
                    {item.awaitingCount} {item.awaitingCount === 1 ? "entrega" : "entregas"}
                  </Badge>
                </span>
              </span>
            </Link>
          ))}
        </DashboardCard>
      </div>

      <div id="card-lessonsWithoutAttendance">
        <DashboardCard
          title="Notas e frequência a lançar"
          icon={ListChecks}
          isLoading={isLoading}
          isEmpty={!d || (d.missingGrades.length === 0 && d.missingAttendance.length === 0)}
          emptyLabel="Notas e chamada em dia."
        >
          {d?.missingAttendance.map((item) => (
            <Link
              key={`att-${item.disciplineId}`}
              to="/painel/disciplinas/$disciplineId"
              params={{ disciplineId: item.disciplineId }}
              className={ITEM_CLASS}
            >
              <CalendarRange className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {item.disciplineName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.lessonsWithoutAttendance}{" "}
                  {item.lessonsWithoutAttendance === 1 ? "aula sem chamada" : "aulas sem chamada"}
                </span>
              </span>
            </Link>
          ))}
          {d?.missingGrades.map((item) => (
            <Link
              key={`grade-${item.assessmentId}`}
              to="/painel/disciplinas/$disciplineId"
              params={{ disciplineId: item.disciplineId }}
              className={ITEM_CLASS}
            >
              <ListChecks className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {item.title}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {item.disciplineName}
                  <Badge variant="outline" className="text-[10px]">
                    {item.studentsMissing} sem nota
                  </Badge>
                </span>
              </span>
            </Link>
          ))}
        </DashboardCard>
      </div>

      <div id="card-materialGaps">
        <DashboardCard
          title="Materiais faltando"
          icon={PackageOpen}
          isLoading={isLoading}
          isEmpty={!d || d.materialGaps.length === 0}
          emptyLabel="Materiais em dia nas disciplinas em andamento."
        >
          {d?.materialGaps.map((item) => (
            <Link
              key={item.disciplineId}
              to="/painel/disciplinas/$disciplineId"
              params={{ disciplineId: item.disciplineId }}
              className={ITEM_CLASS}
            >
              <PackageOpen className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {item.disciplineName}
                </span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {item.missingApostila ? (
                    <Badge variant="outline" className="text-[10px]">
                      sem apostila
                    </Badge>
                  ) : null}
                  {item.missingVideos ? (
                    <Badge variant="outline" className="text-[10px]">
                      sem vídeo-aulas
                    </Badge>
                  ) : null}
                  {!item.missingApostila && item.apostilaDeficit >= 1 ? (
                    <span>
                      {item.lessonsGiven} aulas dadas · {item.apostilaCount} apostilas
                    </span>
                  ) : null}
                </span>
              </span>
            </Link>
          ))}
        </DashboardCard>
      </div>

      <div id="card-endingDisciplines">
        <DashboardCard
          title="Disciplinas encerrando"
          icon={CalendarClock}
          isLoading={isLoading}
          isEmpty={!d || d.endingDisciplines.length === 0}
          emptyLabel="Nenhuma disciplina na reta final."
        >
          {d?.endingDisciplines.map((item) => (
            <Link
              key={item.disciplineId}
              to="/painel/disciplinas/$disciplineId"
              params={{ disciplineId: item.disciplineId }}
              className={ITEM_CLASS}
            >
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {item.disciplineName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.lessonsGiven}/{item.lessonsPlanned} aulas
                </span>
              </span>
            </Link>
          ))}
        </DashboardCard>
      </div>

      <div id="card-forum">
        <DashboardCard
          title="Fórum em atividade"
          icon={MessageCircle}
          viewAll={{ to: "/painel/forum" }}
          isLoading={isLoading}
          isEmpty={!d || d.forum.length === 0}
          emptyLabel="Nenhuma conversa recente."
        >
          {d?.forum.map((item) => (
            <Link
              key={item.threadId}
              to="/painel/forum/$threadId"
              params={{ threadId: item.threadId }}
              className={ITEM_CLASS}
            >
              <MessageCircle className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {item.title}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {item.disciplineName}
                  {item.awaitingTeacherReply ? (
                    <Badge
                      variant="outline"
                      className="border-destructive/40 text-[10px] text-destructive"
                    >
                      aguardando resposta
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      {item.postCount} {item.postCount === 1 ? "resposta" : "respostas"}
                    </Badge>
                  )}
                </span>
              </span>
            </Link>
          ))}
        </DashboardCard>
      </div>

      <div id="card-upcomingLessons">
        <DashboardCard
          title="Próximas aulas"
          icon={CalendarRange}
          isLoading={isLoading}
          isEmpty={!d || d.upcomingLessons.length === 0}
          emptyLabel="Nenhuma aula agendada à frente."
        >
          {d?.upcomingLessons.map((item) => (
            <Link
              key={`${item.disciplineId}-${item.sequence}`}
              to="/painel/disciplinas/$disciplineId"
              params={{ disciplineId: item.disciplineId }}
              className={ITEM_CLASS}
            >
              <CalendarRange className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {item.disciplineName}
                </span>
                <span className="text-xs text-muted-foreground">
                  Aula {item.sequence} · {fmtDate(item.date)}
                </span>
              </span>
            </Link>
          ))}
        </DashboardCard>
      </div>

      <div id="card-atRiskStudents">
        <DashboardCard
          title="Alunos em risco"
          icon={AlertTriangle}
          viewAll={{ to: "/painel/relatorio" }}
          isLoading={isLoading}
          isEmpty={!d || d.atRiskStudents.length === 0}
          emptyLabel="Nenhum aluno abaixo do mínimo."
        >
          {d?.atRiskStudents.map((item) => (
            <Link key={item.studentId} to="/painel/relatorio" className={ITEM_CLASS}>
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {item.studentName}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.disciplines
                    .map((x) =>
                      x.reason === "ambos"
                        ? `${x.disciplineName} (nota e frequência)`
                        : x.reason === "media"
                          ? `${x.disciplineName} (nota)`
                          : `${x.disciplineName} (frequência)`,
                    )
                    .join(" · ")}
                </span>
              </span>
            </Link>
          ))}
        </DashboardCard>
      </div>
    </>
  );
}
