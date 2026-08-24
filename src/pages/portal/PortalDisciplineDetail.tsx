import { useQuery } from "@tanstack/react-query";

import { PortalShell } from "@/components/portal/PortalShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getPublicDisciplinesFn } from "@/functions/schedule";
import { DisciplineAssignmentsTab } from "@/pages/portal/discipline/DisciplineAssignmentsTab";
import { DisciplineExamsTab } from "@/pages/portal/discipline/DisciplineExamsTab";
import { DisciplineGradesTab } from "@/pages/portal/discipline/DisciplineGradesTab";
import { DisciplineMaterialsTab } from "@/pages/portal/discipline/DisciplineMaterialsTab";
import { DisciplineNotesTab } from "@/pages/portal/discipline/DisciplineNotesTab";
import { DisciplineVideosTab } from "@/pages/portal/discipline/DisciplineVideosTab";
import { PortalForumThreadList } from "@/pages/portal/PortalForum";

/** Página do curso — tudo de uma disciplina num lugar só (aulas, apostila, tarefas, provas, notas, fórum). */
export function PortalDisciplineDetail({ disciplineId }: { disciplineId: string }) {
  const { data: disciplines, isLoading } = useQuery({
    queryKey: ["public-disciplines"],
    queryFn: () => getPublicDisciplinesFn(),
  });

  const discipline = disciplines?.find((d) => d.id === disciplineId);

  return (
    <PortalShell
      title={discipline?.discipline ?? (isLoading ? "Carregando…" : "Disciplina")}
      description={
        discipline
          ? `${discipline.module} — ${discipline.term}${discipline.teacher ? ` · ${discipline.teacher}` : ""}`
          : undefined
      }
    >
      <Tabs defaultValue="aulas">
        <TabsList>
          <TabsTrigger value="aulas">Aulas</TabsTrigger>
          <TabsTrigger value="apostila">Apostila</TabsTrigger>
          <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
          <TabsTrigger value="provas">Provas</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
          <TabsTrigger value="anotacoes">Anotações</TabsTrigger>
          <TabsTrigger value="forum">Fórum</TabsTrigger>
        </TabsList>
        <TabsContent value="aulas">
          <DisciplineVideosTab disciplineId={disciplineId} />
        </TabsContent>
        <TabsContent value="apostila">
          <DisciplineMaterialsTab disciplineId={disciplineId} />
        </TabsContent>
        <TabsContent value="tarefas">
          <DisciplineAssignmentsTab disciplineId={disciplineId} />
        </TabsContent>
        <TabsContent value="provas">
          <DisciplineExamsTab disciplineId={disciplineId} />
        </TabsContent>
        <TabsContent value="notas">
          <DisciplineGradesTab disciplineId={disciplineId} />
        </TabsContent>
        <TabsContent value="anotacoes">
          <DisciplineNotesTab disciplineId={disciplineId} />
        </TabsContent>
        <TabsContent value="forum">
          <PortalForumThreadList disciplineId={disciplineId} />
        </TabsContent>
      </Tabs>
    </PortalShell>
  );
}
