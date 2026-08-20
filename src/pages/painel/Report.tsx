import { useQuery } from "@tanstack/react-query";

import { PainelShell } from "@/components/painel/PainelShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentTeacherFn } from "@/functions/auth";
import { ClassReport } from "@/pages/painel/reports/ClassReport";
import { FinancialReport } from "@/pages/painel/reports/FinancialReport";
import { StudentReport } from "@/pages/painel/reports/StudentReport";

/** Relatórios: por aluno, por turma, e financeiro (admin). */
export function Report() {
  const { data: me } = useQuery({
    queryKey: ["current-teacher"],
    queryFn: () => getCurrentTeacherFn(),
  });

  return (
    <PainelShell
      title="Relatório"
      description="Boletins por aluno, por turma, e (pra admin) relatório financeiro por período."
    >
      <Tabs defaultValue="aluno">
        <TabsList className="print:hidden">
          <TabsTrigger value="aluno">Aluno</TabsTrigger>
          <TabsTrigger value="turma">Turma</TabsTrigger>
          {me?.role === "admin" ? <TabsTrigger value="financeiro">Financeiro</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="aluno">
          <StudentReport />
        </TabsContent>
        <TabsContent value="turma">
          <ClassReport />
        </TabsContent>
        {me?.role === "admin" ? (
          <TabsContent value="financeiro">
            <FinancialReport />
          </TabsContent>
        ) : null}
      </Tabs>
    </PainelShell>
  );
}
