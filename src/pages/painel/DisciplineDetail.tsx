import { useQuery } from "@tanstack/react-query";

import { PainelShell } from "@/components/painel/PainelShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMyDisciplineFn } from "@/functions/disciplines";
import { AttendanceTab } from "@/pages/painel/AttendanceTab";
import { DisciplineOverviewTab } from "@/pages/painel/DisciplineOverviewTab";
import { GradesTab } from "@/pages/painel/GradesTab";
import { ReadingMaterialsTab } from "@/pages/painel/ReadingMaterialsTab";
import { VideoLessonsTab } from "@/pages/painel/VideoLessonsTab";

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
      <Tabs defaultValue="acompanhamento">
        <TabsList>
          <TabsTrigger value="acompanhamento">Acompanhamento</TabsTrigger>
          <TabsTrigger value="frequencia">Frequência</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
          <TabsTrigger value="videos">Vídeo-aulas</TabsTrigger>
          <TabsTrigger value="apostila">Apostila</TabsTrigger>
        </TabsList>
        <TabsContent value="acompanhamento">
          <DisciplineOverviewTab disciplineId={disciplineId} />
        </TabsContent>
        <TabsContent value="frequencia">
          <AttendanceTab disciplineId={disciplineId} />
        </TabsContent>
        <TabsContent value="notas">
          <GradesTab disciplineId={disciplineId} />
        </TabsContent>
        <TabsContent value="videos">
          <VideoLessonsTab disciplineId={disciplineId} />
        </TabsContent>
        <TabsContent value="apostila">
          <ReadingMaterialsTab disciplineId={disciplineId} />
        </TabsContent>
      </Tabs>
    </PainelShell>
  );
}
