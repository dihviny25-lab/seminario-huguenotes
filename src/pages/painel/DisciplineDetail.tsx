import { useQuery } from "@tanstack/react-query";

import { PainelShell } from "@/components/painel/PainelShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMyDisciplineFn } from "@/functions/disciplines";
import { AttendanceTab } from "@/pages/painel/AttendanceTab";
import { GradesTab } from "@/pages/painel/GradesTab";

export function DisciplineDetail({ disciplineId }: { disciplineId: string }) {
  const { data: discipline, isLoading } = useQuery({
    queryKey: ["my-discipline", disciplineId],
    queryFn: () => getMyDisciplineFn({ data: { disciplineId } }),
  });

  return (
    <PainelShell
      title={discipline?.discipline ?? (isLoading ? "Carregando…" : "Disciplina")}
      description={discipline ? `${discipline.module} — ${discipline.term}` : undefined}
    >
      <Tabs defaultValue="notas">
        <TabsList>
          <TabsTrigger value="notas">Notas</TabsTrigger>
          <TabsTrigger value="frequencia">Frequência</TabsTrigger>
        </TabsList>
        <TabsContent value="notas">
          <GradesTab disciplineId={disciplineId} />
        </TabsContent>
        <TabsContent value="frequencia">
          <AttendanceTab disciplineId={disciplineId} />
        </TabsContent>
      </Tabs>
    </PainelShell>
  );
}
