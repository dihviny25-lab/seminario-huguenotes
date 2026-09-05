import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Loader2, Pencil, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";

import { PainelShell } from "@/components/painel/PainelShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createPlannedLessonFn,
  listTeachingAssignmentsFn,
  setLessonTeacherFn,
  updateDisciplineTeacherFn,
  updatePlannedLessonFn,
  type TeachingAssignments as TeachingAssignmentsData,
} from "@/functions/teachingAssignments";

const QUERY_KEY = ["teaching-assignments"] as const;
const ALL = "__all__";
const NONE = "__none__";

type Discipline = TeachingAssignmentsData["disciplines"][number];
type Lesson = Discipline["lessons"][number];

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatDate(value: string | null) {
  if (!value) return "Sem data";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

const today = new Date().toISOString().slice(0, 10);

function TeacherSelect({
  value,
  teachers,
  onChange,
  disabled,
  noneLabel,
}: {
  value: string | null;
  teachers: TeachingAssignmentsData["teachers"];
  onChange: (teacherId: string | null) => void;
  disabled?: boolean;
  noneLabel: string;
}) {
  return (
    <Select
      value={value ?? NONE}
      onValueChange={(next) => onChange(next === NONE ? null : next)}
      disabled={disabled}
    >
      <SelectTrigger aria-label="Selecionar professor" className="min-w-52">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{noneLabel}</SelectItem>
        {teachers.map((teacher) => (
          <SelectItem key={teacher.id} value={teacher.id}>
            {teacher.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TeachingAssignments() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => listTeachingAssignmentsFn(),
  });
  const [term, setTerm] = useState(ALL);
  const [semester, setSemester] = useState(ALL);
  const [module, setModule] = useState(ALL);
  const [lessonDisciplineId, setLessonDisciplineId] = useState(ALL);
  const [newLessonOpen, setNewLessonOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);

  const options = useMemo(() => {
    const disciplines = data?.disciplines ?? [];
    const terms = [...new Set(disciplines.map((item) => item.term))];
    const semesters = [
      ...new Set(
        disciplines
          .filter((item) => term === ALL || item.term === term)
          .map((item) => item.semester),
      ),
    ].sort((a, b) => a - b);
    const modules = [
      ...new Set(
        disciplines
          .filter((item) => term === ALL || item.term === term)
          .filter((item) => semester === ALL || String(item.semester) === semester)
          .map((item) => item.module),
      ),
    ];
    return { terms, semesters, modules };
  }, [data?.disciplines, term, semester]);

  const filtered = useMemo(
    () =>
      (data?.disciplines ?? [])
        .filter((item) => term === ALL || item.term === term)
        .filter((item) => semester === ALL || String(item.semester) === semester)
        .filter((item) => module === ALL || item.module === module),
    [data?.disciplines, module, semester, term],
  );

  const selectedLessonDiscipline =
    filtered.find((item) => item.id === lessonDisciplineId) ?? filtered[0] ?? null;

  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ["public-disciplines"] }),
      queryClient.invalidateQueries({ queryKey: ["teacher-dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["my-disciplines"] }),
    ]);
  }

  const disciplineMutation = useMutation({
    mutationFn: (input: { disciplineId: string; teacherId: string | null }) =>
      updateDisciplineTeacherFn({ data: input }),
    onSuccess: async () => {
      toast.success("Professor responsável atualizado.");
      await invalidate();
    },
    onError: (error) => toast.error(message(error, "Não foi possível atualizar a disciplina.")),
  });

  const lessonTeacherMutation = useMutation({
    mutationFn: (input: { lessonId: string; teacherId: string | null }) =>
      setLessonTeacherFn({ data: input }),
    onSuccess: async () => {
      toast.success("Professor da aula atualizado.");
      await invalidate();
    },
    onError: (error) => toast.error(message(error, "Não foi possível atualizar a aula.")),
  });

  function changeTerm(value: string) {
    setTerm(value);
    setSemester(ALL);
    setModule(ALL);
    setLessonDisciplineId(ALL);
  }

  function changeSemester(value: string) {
    setSemester(value);
    setModule(ALL);
    setLessonDisciplineId(ALL);
  }

  return (
    <PainelShell
      title="Atribuição de professores"
      description="Defina o professor responsável por cada disciplina e substitutos para aulas futuras."
    >
      {isLoading ? (
        <LoadingState />
      ) : isError || !data ? (
        <div className="rounded-md border border-destructive/40 bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">Não foi possível carregar as atribuições.</p>
          <Button className="mt-4" variant="outline" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <>
          <Filters
            term={term}
            semester={semester}
            module={module}
            terms={options.terms}
            semesters={options.semesters}
            modules={options.modules}
            onTermChange={changeTerm}
            onSemesterChange={changeSemester}
            onModuleChange={(value) => {
              setModule(value);
              setLessonDisciplineId(ALL);
            }}
          />

          <Tabs defaultValue="disciplinas" className="mt-6">
            <TabsList className="grid w-full grid-cols-2 sm:w-auto">
              <TabsTrigger value="disciplinas">Por disciplina</TabsTrigger>
              <TabsTrigger value="aulas">Por aula</TabsTrigger>
            </TabsList>
            <TabsContent value="disciplinas" className="mt-4">
              <DisciplineAssignments
                disciplines={filtered}
                teachers={data.teachers}
                pending={disciplineMutation.isPending}
                onChange={(disciplineId, teacherId) =>
                  disciplineMutation.mutate({ disciplineId, teacherId })
                }
              />
            </TabsContent>
            <TabsContent value="aulas" className="mt-4">
              <LessonAssignments
                disciplines={filtered}
                selected={selectedLessonDiscipline}
                selectedId={selectedLessonDiscipline?.id ?? ALL}
                teachers={data.teachers}
                pending={lessonTeacherMutation.isPending}
                onSelect={setLessonDisciplineId}
                onTeacherChange={(lessonId, teacherId) =>
                  lessonTeacherMutation.mutate({ lessonId, teacherId })
                }
                onCreate={() => setNewLessonOpen(true)}
                onEdit={setEditingLesson}
              />
            </TabsContent>
          </Tabs>

          {selectedLessonDiscipline ? (
            <LessonDialog
              open={newLessonOpen}
              title={`Nova aula — ${selectedLessonDiscipline.discipline}`}
              teachers={data.teachers}
              onOpenChange={setNewLessonOpen}
              onSaved={invalidate}
              disciplineId={selectedLessonDiscipline.id}
            />
          ) : null}
          {editingLesson ? (
            <LessonDialog
              open
              title={`Editar aula ${editingLesson.sequence}`}
              teachers={data.teachers}
              onOpenChange={(open) => !open && setEditingLesson(null)}
              onSaved={invalidate}
              lesson={editingLesson}
            />
          ) : null}
        </>
      )}
    </PainelShell>
  );
}

function Filters({
  term,
  semester,
  module,
  terms,
  semesters,
  modules,
  onTermChange,
  onSemesterChange,
  onModuleChange,
}: {
  term: string;
  semester: string;
  module: string;
  terms: string[];
  semesters: number[];
  modules: string[];
  onTermChange: (value: string) => void;
  onSemesterChange: (value: string) => void;
  onModuleChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-4 rounded-xl border border-border/70 bg-card/70 p-4 shadow-soft sm:grid-cols-3">
      <FilterSelect label="Turma/ano" value={term} onChange={onTermChange}>
        {terms.map((value) => (
          <SelectItem key={value} value={value}>
            {value}
          </SelectItem>
        ))}
      </FilterSelect>
      <FilterSelect label="Semestre" value={semester} onChange={onSemesterChange}>
        {semesters.map((value) => (
          <SelectItem key={value} value={String(value)}>
            {value}º semestre
          </SelectItem>
        ))}
      </FilterSelect>
      <FilterSelect label="Módulo" value={module} onChange={onModuleChange}>
        {modules.map((value) => (
          <SelectItem key={value} value={value}>
            {value}
          </SelectItem>
        ))}
      </FilterSelect>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos</SelectItem>
          {children}
        </SelectContent>
      </Select>
    </div>
  );
}

function DisciplineAssignments({
  disciplines,
  teachers,
  pending,
  onChange,
}: {
  disciplines: Discipline[];
  teachers: TeachingAssignmentsData["teachers"];
  pending: boolean;
  onChange: (disciplineId: string, teacherId: string | null) => void;
}) {
  if (disciplines.length === 0) return <EmptyState text="Nenhuma disciplina encontrada." />;
  return (
    <div className="grid gap-3">
      {disciplines.map((discipline) => (
        <article
          key={discipline.id}
          className="grid gap-4 rounded-lg border border-border/70 bg-card/70 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
        >
          <div className="min-w-0">
            <h2 className="font-medium text-foreground">{discipline.discipline}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {discipline.term} · {discipline.semester}º semestre · {discipline.module} ·{" "}
              {discipline.lessons.length} aulas
            </p>
            {!discipline.teacherId ? (
              <Badge variant="destructive" className="mt-2">
                Sem professor
              </Badge>
            ) : null}
          </div>
          <TeacherSelect
            value={discipline.teacherId}
            teachers={teachers}
            noneLabel="Sem professor"
            disabled={pending}
            onChange={(teacherId) => onChange(discipline.id, teacherId)}
          />
        </article>
      ))}
    </div>
  );
}

function LessonAssignments({
  disciplines,
  selected,
  selectedId,
  teachers,
  pending,
  onSelect,
  onTeacherChange,
  onCreate,
  onEdit,
}: {
  disciplines: Discipline[];
  selected: Discipline | null;
  selectedId: string;
  teachers: TeachingAssignmentsData["teachers"];
  pending: boolean;
  onSelect: (id: string) => void;
  onTeacherChange: (lessonId: string, teacherId: string | null) => void;
  onCreate: () => void;
  onEdit: (lesson: Lesson) => void;
}) {
  if (!selected) return <EmptyState text="Nenhuma disciplina encontrada para planejar aulas." />;
  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5 sm:min-w-80">
          <Label>Disciplina</Label>
          <Select value={selectedId} onValueChange={onSelect}>
            <SelectTrigger aria-label="Disciplina">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {disciplines.map((discipline) => (
                <SelectItem key={discipline.id} value={discipline.id}>
                  {discipline.discipline}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={onCreate}>
          <CalendarPlus className="size-4" aria-hidden />
          Nova aula futura
        </Button>
      </div>
      {selected.lessons.length === 0 ? (
        <EmptyState text="Nenhuma aula planejada para esta disciplina." />
      ) : (
        <div className="grid gap-3">
          {selected.lessons.map((lesson) => {
            const given = lesson.givenAt !== null;
            return (
              <article
                key={lesson.id}
                className="grid gap-4 rounded-lg border border-border/70 bg-card/70 p-4 lg:grid-cols-[1fr_auto] lg:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">Aula {lesson.sequence}</h3>
                    <Badge variant={given ? "secondary" : "outline"}>
                      {given ? "Realizada" : "Planejada"}
                    </Badge>
                    {lesson.teacherId ? (
                      <Badge>Substituição</Badge>
                    ) : (
                      <Badge variant="outline">Professor padrão</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDate(lesson.date)} · Professor efetivo:{" "}
                    {lesson.effectiveTeacherName ?? "Não atribuído"}
                  </p>
                  {given ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Aulas realizadas não podem ser alteradas.
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <TeacherSelect
                    value={lesson.teacherId}
                    teachers={teachers}
                    noneLabel={`Usar padrão (${selected.teacherName ?? "sem professor"})`}
                    disabled={given || pending}
                    onChange={(teacherId) => onTeacherChange(lesson.id, teacherId)}
                  />
                  <Button variant="outline" onClick={() => onEdit(lesson)} disabled={given}>
                    <Pencil className="size-4" aria-hidden />
                    Editar data
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LessonDialog({
  open,
  title,
  teachers,
  onOpenChange,
  onSaved,
  disciplineId,
  lesson,
}: {
  open: boolean;
  title: string;
  teachers: TeachingAssignmentsData["teachers"];
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<unknown>;
  disciplineId?: string;
  lesson?: Lesson;
}) {
  const [date, setDate] = useState(lesson?.date ?? "");
  const [teacherId, setTeacherId] = useState<string | null>(lesson?.teacherId ?? null);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!date) throw new Error("Informe a data da aula.");
      if (lesson) {
        await updatePlannedLessonFn({ data: { lessonId: lesson.id, date } });
        if (teacherId !== lesson.teacherId) {
          await setLessonTeacherFn({ data: { lessonId: lesson.id, teacherId } });
        }
        return;
      }
      if (!disciplineId) throw new Error("Disciplina não encontrada.");
      await createPlannedLessonFn({ data: { disciplineId, date, teacherId } });
    },
    onSuccess: async () => {
      toast.success(lesson ? "Aula atualizada." : "Aula futura criada.");
      onOpenChange(false);
      await onSaved();
    },
    onError: (error) => toast.error(message(error, "Não foi possível salvar a aula.")),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="planned-lesson-date">Data</Label>
            <Input
              id="planned-lesson-date"
              type="date"
              min={today}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Professor substituto (opcional)</Label>
            <TeacherSelect
              value={teacherId}
              teachers={teachers}
              noneLabel="Usar professor padrão"
              onChange={setTeacherId}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !date}>
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <UserRoundCheck className="size-4" aria-hidden />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full" />
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-24 w-full" />
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}
