/**
 * Modelo de dados do cronograma acadêmico do Seminário Huguenotes.
 *
 * Toda a aplicação consome exclusivamente estes tipos. Nenhuma tela deve
 * declarar dados próprios — apenas derivá-los de `src/data/schedule.ts`.
 */

/** Situação da data de uma disciplina/módulo. */
export type ScheduleStatus = "confirmed" | "pending";

/** Unidade mínima do cronograma: uma disciplina ministrada num módulo. */
export interface Discipline {
  /** Identificador estável (útil para futuras rotas de detalhe/edição). */
  id: string;
  /** Número do semestre (1 a 5). */
  semester: number;
  /** Ano/turma correspondente ao semestre (ex.: "2026", "2028/2029"). */
  term: string;
  /** Rótulo do módulo, tal como publicado ("Módulo 1", "Módulos 7–8"...). */
  module: string;
  /** Período em texto, quando publicado (ex.: "14/09–05/10"). */
  period?: string;
  /** Nome da disciplina. */
  discipline: string;
  /** Professor responsável (vazio quando ainda não designado). */
  teacher?: string;
  /** Faixa de horário (ex.: "19h00–20h25"). */
  schedule?: string;
  /** Número de aulas previstas. */
  lessons?: number;
  /** Data de início em ISO (yyyy-mm-dd), quando confirmada. */
  startDate?: string;
  /** Data de término em ISO (yyyy-mm-dd), quando confirmada. */
  endDate?: string;
  /** Situação da data. */
  status: ScheduleStatus;
  /** Observações da coordenação. */
  observations?: string;
}

/** Agrupamento de disciplinas por módulo dentro de um semestre. */
export interface ModuleGroup {
  module: string;
  period?: string;
  status: ScheduleStatus;
  disciplines: Discipline[];
  /** Soma das aulas do módulo. */
  totalLessons: number;
}

/** Agrupamento de módulos por semestre. */
export interface SemesterGroup {
  semester: number;
  term: string;
  modules: ModuleGroup[];
  totalLessons: number;
  totalDisciplines: number;
}

/** Visão consolidada da carga de um professor. */
export interface TeacherSummary {
  name: string;
  totalLessons: number;
  totalDisciplines: number;
  semesters: number[];
  disciplines: Discipline[];
}
