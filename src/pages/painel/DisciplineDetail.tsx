import { useQuery } from "@tanstack/react-query";

import { PainelShell } from "@/components/painel/PainelShell";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMyDisciplineFn } from "@/functions/disciplines";
import { AttendanceTab } from "@/pages/painel/AttendanceTab";
import { DisciplineOverviewTab } from "@/pages/painel/DisciplineOverviewTab";
import { GradesTab } from "@/pages/painel/GradesTab";
import { ReadingMaterialsTab } from "@/pages/painel/ReadingMaterialsTab";
import { SlidesTab } from "@/pages/painel/SlidesTab";
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
      {isLoading ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-28" />
          </div>
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <Tabs
          key={discipline?.canManageDiscipline === true ? "owner" : "assigned"}
          defaultValue={discipline?.canManageDiscipline === true ? "acompanhamento" : "frequencia"}
        >
          <TabsList>
            {discipline?.canManageDiscipline === true ? (
              <TabsTrigger value="acompanhamento">Acompanhamento</TabsTrigger>
            ) : null}
            <TabsTrigger value="frequencia">Frequência</TabsTrigger>
            {discipline?.canManageDiscipline === true ? (
              <>
                <TabsTrigger value="notas">Notas</TabsTrigger>
                <TabsTrigger value="videos">Vídeo-aulas</TabsTrigger>
                <TabsTrigger value="apostila">Apostila</TabsTrigger>
                <TabsTrigger value="slides">Slides</TabsTrigger>
              </>
            ) : null}
          </TabsList>
          {discipline?.canManageDiscipline === true ? (
            <TabsContent value="acompanhamento">
              <DisciplineOverviewTab disciplineId={disciplineId} />
            </TabsContent>
          ) : null}
          <TabsContent value="frequencia">
            <AttendanceTab
              disciplineId={disciplineId}
              canManageDiscipline={discipline?.canManageDiscipline === true}
            />
          </TabsContent>
          {discipline?.canManageDiscipline === true ? (
            <>
              <TabsContent value="notas">
                <GradesTab disciplineId={disciplineId} />
              </TabsContent>
              <TabsContent value="videos">
                <VideoLessonsTab disciplineId={disciplineId} />
              </TabsContent>
              <TabsContent value="apostila">
                <ReadingMaterialsTab disciplineId={disciplineId} />
              </TabsContent>
              <TabsContent value="slides">
                <SlidesTab disciplineId={disciplineId} />
              </TabsContent>
            </>
          ) : null}
        </Tabs>
      )}
    </PainelShell>
  );
}
