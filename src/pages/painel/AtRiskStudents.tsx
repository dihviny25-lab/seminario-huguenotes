import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";

import { PainelShell } from "@/components/painel/PainelShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAtRiskStudentsFn } from "@/functions/teacherDashboard";
import { MINIMUM_ATTENDANCE_RATIO } from "@/lib/attendance";
import { PASSING_AVERAGE } from "@/lib/grades";
import { AtRiskStudentDetails } from "@/pages/painel/dashboard/AtRiskStudentDetails";

export function AtRiskStudents() {
  const { studentId } = useSearch({ from: "/painel/alunos-em-risco" });
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("todos");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["at-risk-students"],
    queryFn: () => getAtRiskStudentsFn(),
    staleTime: 60_000,
  });
  const students = (data?.students ?? []).filter(
    (student) =>
      (!studentId || student.studentId === studentId) &&
      student.studentName.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")) &&
      student.disciplines.some(
        (discipline) =>
          reason === "todos" || discipline.reason === reason || discipline.reason === "ambos",
      ),
  );

  return (
    <PainelShell
      title="Alunos em risco"
      description="Identifique os motivos do alerta e acompanhe cada aluno por disciplina."
    >
      <p className="mb-5 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Alerta quando a média é menor que {PASSING_AVERAGE} ou a frequência é menor que{" "}
        {MINIMUM_ATTENDANCE_RATIO * 100}%, nas disciplinas em andamento. Considera somente as notas
        lançadas e as aulas com chamada concluída. Os valores são parciais, não uma reprovação
        final.
      </p>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-sm font-medium">
          Buscar aluno
          <Input
            className="mt-1"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome do aluno"
          />
        </label>
        <label className="text-sm font-medium">
          Motivo do risco
          <select
            className="mt-1 block h-9 rounded-md border bg-background px-3 text-sm"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          >
            <option value="todos">Todos os motivos</option>
            <option value="media">Notas</option>
            <option value="frequencia">Faltas / frequência</option>
          </select>
        </label>
        {studentId ? (
          <Link to="/painel/alunos-em-risco" search={{}} className="text-sm text-accent underline">
            Ver todos os alunos
          </Link>
        ) : null}
      </div>
      {isLoading ? (
        <p role="status">Carregando alunos em risco…</p>
      ) : isError ? (
        <div role="alert" className="space-y-2">
          <p>Não foi possível carregar os alunos em risco.</p>
          <Button variant="outline" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {students.length} {students.length === 1 ? "aluno encontrado" : "alunos encontrados"}
            {data?.scope === "escola" ? " em toda a escola" : " nas suas disciplinas"}
          </p>
          {students.length === 0 ? (
            <p className="rounded-lg border p-5">
              Nenhum aluno em risco para os filtros selecionados.
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {students.map((student) => (
                <article key={student.studentId} className="min-w-0 rounded-lg border bg-card p-5">
                  <h2 className="break-words font-display text-lg font-semibold">
                    {student.studentName}
                  </h2>
                  <AtRiskStudentDetails student={student} />
                  <div className="mt-4 border-t pt-3">
                    <p className="mb-2 text-xs text-muted-foreground">
                      Consulte o histórico completo e registre o acompanhamento do aluno no boletim.
                    </p>
                    <Link
                      to="/painel/relatorio"
                      search={{ studentId: student.studentId }}
                      className="text-sm font-medium text-accent underline"
                    >
                      Abrir boletim de {student.studentName}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </PainelShell>
  );
}
