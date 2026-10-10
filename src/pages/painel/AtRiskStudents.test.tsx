import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AtRiskStudents } from "./AtRiskStudents";

const search = vi.hoisted(() => ({ studentId: undefined as string | undefined }));
vi.mock("@tanstack/react-router", () => ({
  useSearch: () => search,
  Link: ({
    to,
    search: params,
    children,
    ...props
  }: {
    to: string;
    search?: { studentId?: string };
    children: ReactNode;
  }) => (
    <a href={`${to}${params?.studentId ? `?studentId=${params.studentId}` : ""}`} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/painel/PainelShell", () => ({
  PainelShell: ({ title, children }: { title: string; children: ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));
vi.mock("@/functions/teacherDashboard", () => ({ getAtRiskStudentsFn: vi.fn() }));

function renderPage(students = ["Ana", "Bia"]) {
  const client = new QueryClient();
  client.setQueryData(["at-risk-students"], {
    scope: "escola",
    students: students.map((name, i) => ({
      studentId: `s${i}`,
      studentName: name,
      disciplines: [
        {
          disciplineId: "d1",
          disciplineName: "Teologia",
          teacherName: "João",
          reason: "ambos",
          average: 5,
          totalLessons: 4,
          totalFaltas: 2,
          attendanceRatio: 0.5,
        },
      ],
    })),
  });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <AtRiskStudents />
    </QueryClientProvider>,
  );
  client.clear();
  return html;
}

describe("Alunos em risco", () => {
  beforeEach(() => {
    search.studentId = undefined;
  });

  it("mostra os alunos e abre o boletim com cada aluno selecionado", () => {
    const html = renderPage();
    expect(html).toContain("2 alunos encontrados em toda a escola");
    expect(html).toContain("/painel/relatorio?studentId=s0");
    expect(html).toContain("/painel/relatorio?studentId=s1");
    expect(html).toContain("Os valores são parciais, não uma reprovação final");
  });

  it("o acesso pelo card restringe ao aluno indicado e permite voltar à lista", () => {
    search.studentId = "s1";
    const html = renderPage();
    expect(html).toContain("1 aluno encontrado em toda a escola");
    expect(html).toContain("Abrir boletim de Bia");
    expect(html).not.toContain("Abrir boletim de Ana");
    expect(html).toContain("Ver todos os alunos");
  });

  it("explica quando o aluno já não está em risco", () => {
    search.studentId = "s1";
    expect(renderPage([])).toContain("Nenhum aluno em risco para os filtros selecionados");
  });
});
