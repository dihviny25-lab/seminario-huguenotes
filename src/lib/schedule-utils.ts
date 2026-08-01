import type { Discipline, ModuleGroup, SemesterGroup, TeacherSummary } from "@/types/schedule";

/**
 * Funções puras de derivação do cronograma — recebem sempre o array de
 * disciplinas (hoje vindo do banco via `getPublicDisciplinesFn`).
 */

/** Rótulo textual do semestre (ex.: "1º Semestre"). */
export function semesterLabel(semester: number): string {
  return `${semester}º Semestre`;
}

/** Agrupa as disciplinas em semestres → módulos, preservando a ordem original. */
export function groupBySemester(source: Discipline[]): SemesterGroup[] {
  const semesters = new Map<number, SemesterGroup>();

  for (const item of source) {
    let semester = semesters.get(item.semester);
    if (!semester) {
      semester = {
        semester: item.semester,
        term: item.term,
        modules: [],
        totalLessons: 0,
        totalDisciplines: 0,
      };
      semesters.set(item.semester, semester);
    }

    let group: ModuleGroup | undefined = semester.modules.find((m) => m.module === item.module);
    if (!group) {
      group = {
        module: item.module,
        period: item.period,
        status: item.status,
        disciplines: [],
        totalLessons: 0,
      };
      semester.modules.push(group);
    }

    // Um módulo é considerado confirmado quando ao menos uma disciplina tem data.
    if (item.status === "confirmed") {
      group.status = "confirmed";
      group.period = group.period ?? item.period;
    }

    group.disciplines.push(item);
    group.totalLessons += item.lessons ?? 0;
    semester.totalLessons += item.lessons ?? 0;
    semester.totalDisciplines += 1;
  }

  return [...semesters.values()].sort((a, b) => a.semester - b.semester);
}

/** Lista de professores com sua carga consolidada, ordenada por nº de aulas. */
export function getTeacherSummaries(source: Discipline[]): TeacherSummary[] {
  const teachers = new Map<string, TeacherSummary>();

  for (const item of source) {
    if (!item.teacher) continue;
    let teacher = teachers.get(item.teacher);
    if (!teacher) {
      teacher = {
        name: item.teacher,
        totalLessons: 0,
        totalDisciplines: 0,
        semesters: [],
        disciplines: [],
      };
      teachers.set(item.teacher, teacher);
    }
    teacher.totalLessons += item.lessons ?? 0;
    teacher.totalDisciplines += 1;
    teacher.disciplines.push(item);
    if (!teacher.semesters.includes(item.semester)) {
      teacher.semesters.push(item.semester);
    }
  }

  for (const teacher of teachers.values()) {
    teacher.semesters.sort((a, b) => a - b);
    teacher.disciplines.sort(compareChronologically);
  }

  return [...teachers.values()].sort(
    (a, b) => b.totalLessons - a.totalLessons || a.name.localeCompare(b.name),
  );
}

/**
 * Ordenação cronológica: datas confirmadas primeiro (pela data real),
 * depois por semestre. Sem data e mesmo semestre: mantém a ordem em que
 * chegou (sort é estável, e o array já chega ordenado pelo `sortOrder`
 * do banco), por isso não há critério de desempate explícito aqui.
 */
export function compareChronologically(a: Discipline, b: Discipline): number {
  if (a.startDate && b.startDate) return a.startDate.localeCompare(b.startDate);
  if (a.startDate) return -1;
  if (b.startDate) return 1;
  if (a.semester !== b.semester) return a.semester - b.semester;
  return 0;
}

/** Estatísticas gerais exibidas no topo do dashboard. */
export function getScheduleStatistics(source: Discipline[]) {
  const modules = new Set(source.map((d) => `${d.semester}:${d.module}`));
  const teachers = new Set(source.map((d) => d.teacher).filter((t): t is string => Boolean(t)));
  const semesters = new Set(source.map((d) => d.semester));

  return {
    semesters: semesters.size,
    modules: modules.size,
    disciplines: source.length,
    teachers: teachers.size,
    lessons: source.reduce((total, d) => total + (d.lessons ?? 0), 0),
  };
}
