# Dashboard do professor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever a home do painel do professor (`/painel`) como um dashboard com faixa de KPIs e cartões de pendências e atividade.

**Architecture:** Uma server function (`getTeacherDashboardFn`) faz auth, decide o escopo (admin = escola inteira; professor = suas disciplinas), carrega tudo em lote e delega a lógica a helpers puros em `src/lib/teacherDashboard.ts`, testados isoladamente. `PainelHome` consome com um `useQuery` só e renderiza `KpiStrip` + um grid de cartões. Sem mudança de schema.

**Tech Stack:** TanStack Start + React 19, TanStack Query v5, Drizzle (Neon Postgres), Tailwind v4, shadcn/ui, lucide-react, date-fns, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-28-dashboard-professor-design.md`

## Global Constraints

- **Sem mudança de schema.** Todos os sinais saem de tabelas existentes.
- **"Aula dada"** = `lessons.date` não nulo E `date <= hoje` (string ISO `YYYY-MM-DD`). Data comparada como string.
- **"Alunos"** = `students.active = true`. Não há vínculo aluno↔disciplina; toda disciplina "tem" todos os alunos ativos.
- **Correção pendente é só de tarefas** (`assignmentSubmissions` com `submittedAt` não nulo e `gradedAt` nulo). Provas auto-corrigem no envio.
- **Constantes reaproveitadas, nunca redefinidas:** `PASSING_AVERAGE` (= 7) de `@/lib/grades`; `MINIMUM_ATTENDANCE_RATIO` (= 0.75) de `@/lib/attendance`. Também de `@/lib/grades`: `computeWeightedAverage`. De `@/lib/attendance`: `countFaltas`.
- **Novas constantes** (em `src/lib/teacherDashboard.ts`): `ENDING_PROGRESS_RATIO = 0.8`, `UPCOMING_LESSONS_LIMIT = 5`, `FORUM_ITEMS_LIMIT = 8`, `AT_RISK_LIMIT = 8`.
- **`progress < 1`** ⇒ disciplina "não encerrada"; `progress >= 1` ⇒ encerrada (excluída de materiais faltando e alunos em risco). `progress` entre `0.8` inclusive e `1` exclusive ⇒ "encerrando".
- **Comparações de risco são estritas:** `média < PASSING_AVERAGE`; `frequência < MINIMUM_ATTENDANCE_RATIO` (exatamente 0.75 NÃO é risco).
- **Motion (painel, lente Emil):** itens de lista que aparecem usam `animate-in fade-in slide-in-from-top-1 duration-200`. Loading = `<Skeleton>` com a forma do conteúdo, nunca spinner. `prefers-reduced-motion` já é global — não reimplementar.
- **Consultas em lote** com `inArray`, nunca N+1 por disciplina.
- **Drizzle:** colunas `numeric` (score, weight) voltam como `string` → `Number(...)`. Colunas `date` voltam como `string`. `timestamp` volta como `Date` → `.toISOString()`.
- **Fluxo de trabalho:** branch dedicada (já em `worktree-feat+dashboard-professor`), PR com `Closes #22`. Nunca commitar na `main`.
- Todo commit termina com: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

## File Structure

**Novos:**

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/teacherDashboard.ts` | Tipos de entrada (linhas cruas), tipos do payload (`TeacherDashboard` e filhos), constantes, e helpers puros: `computeDisciplineProgress`, `pickEndingDisciplines`, `pickMaterialGaps`, `pickPendingGrading`, `pickMissingGrades`, `pickMissingAttendance`, `pickUpcomingLessons`, `pickForumActivity`, `pickAtRiskStudents`, e o agregador `buildTeacherDashboard`. Nenhum import de `@/server/*` nem de React. |
| `src/lib/teacherDashboard.test.ts` | Testes unitários Vitest de cada helper e do agregador. |
| `src/functions/teacherDashboard.ts` | `getTeacherDashboardFn` (`createServerFn` GET): auth, escopo, cargas em lote, conversões de tipo, chamada a `buildTeacherDashboard`. Reexporta `type TeacherDashboard`. |
| `src/pages/painel/dashboard/DashboardCard.tsx` | Cartão genérico: header (ícone + título + "Ver tudo" opcional), corpo com skeleton/vazio/itens. |
| `src/pages/painel/dashboard/KpiStrip.tsx` | Faixa dos 4 números com rótulo por escopo e realce `destructive` quando > 0. |
| `src/pages/painel/dashboard/cards.tsx` | Os 7 cartões concretos, cada um consumindo o payload já carregado. |

**Modificados:**

| Arquivo | Mudança |
|---|---|
| `src/pages/painel/PainelHome.tsx` | Reescrito: adiciona `useQuery(["teacher-dashboard"])`, renderiza `KpiStrip` + grid de cartões (ou bloco "tudo em dia"). Mantém `NotificationToggle`, os `shortcuts` e a seção "Minhas disciplinas" exatamente como estão. |

---

## Task 1: Lógica pura do dashboard (`src/lib/teacherDashboard.ts`)

**Files:**
- Create: `src/lib/teacherDashboard.ts`
- Test: `src/lib/teacherDashboard.test.ts`

**Interfaces:**
- Consumes: `computeWeightedAverage`, `PASSING_AVERAGE` de `@/lib/grades`; `countFaltas`, `MINIMUM_ATTENDANCE_RATIO` de `@/lib/attendance`.
- Produces (usado pelas Tasks 2, 3 e 4):

```ts
export const ENDING_PROGRESS_RATIO = 0.8;
export const UPCOMING_LESSONS_LIMIT = 5;
export const FORUM_ITEMS_LIMIT = 8;
export const AT_RISK_LIMIT = 8;

export type DashboardInput = {
  scope: "minhas" | "escola";
  today: string; // YYYY-MM-DD
  disciplines: Array<{ id: string; discipline: string; lessons: number | null }>;
  lessons: Array<{ id: string; disciplineId: string; date: string | null; sequence: number }>;
  attendance: Array<{ lessonId: string; studentId: string; present: boolean }>;
  readingMaterials: Array<{ disciplineId: string }>;
  videoLessons: Array<{ disciplineId: string }>;
  assessments: Array<{ id: string; disciplineId: string; title: string; weight: number }>;
  grades: Array<{ assessmentId: string; studentId: string; score: number }>;
  assignments: Array<{ id: string; disciplineId: string; title: string }>;
  submissions: Array<{ assignmentId: string; submittedAt: string | null; gradedAt: string | null }>;
  threads: Array<{ id: string; disciplineId: string; title: string; createdAt: string }>;
  posts: Array<{ threadId: string; authorRole: "teacher" | "student"; createdAt: string }>;
  activeStudents: Array<{ id: string; name: string }>;
};

export type DisciplineProgress = {
  disciplineId: string;
  disciplineName: string;
  lessonsGiven: number;
  lessonsPlanned: number;
  progress: number; // 0..(>1 possível)
  isStarted: boolean; // lessonsGiven >= 1
  isEnded: boolean;   // progress >= 1
};

export type MaterialGap = {
  disciplineId: string; disciplineName: string;
  missingApostila: boolean; missingVideos: boolean;
  lessonsGiven: number; apostilaCount: number; apostilaDeficit: number;
};
export type PendingGradingItem = {
  assignmentId: string; title: string; disciplineName: string;
  awaitingCount: number; oldestSubmittedAt: string;
};
export type MissingGradeItem = {
  assessmentId: string; disciplineId: string; title: string;
  disciplineName: string; studentsMissing: number;
};
export type MissingAttendanceItem = {
  disciplineId: string; disciplineName: string; lessonsWithoutAttendance: number;
};
export type EndingDisciplineItem = {
  disciplineId: string; disciplineName: string;
  lessonsGiven: number; lessonsPlanned: number; progress: number;
};
export type ForumActivityItem = {
  threadId: string; disciplineName: string; title: string;
  lastActivityAt: string; postCount: number; awaitingTeacherReply: boolean;
};
export type UpcomingLessonItem = {
  disciplineId: string; disciplineName: string; date: string; sequence: number;
};
export type AtRiskStudentItem = {
  studentId: string; studentName: string;
  disciplines: Array<{ disciplineName: string; reason: "media" | "frequencia" | "ambos" }>;
};

export type TeacherDashboard = {
  scope: "minhas" | "escola";
  counts: {
    pendingGrading: number;
    endingDisciplines: number;
    atRiskStudents: number;
    lessonsWithoutAttendance: number;
  };
  materialGaps: MaterialGap[];
  pendingGrading: PendingGradingItem[];
  missingGrades: MissingGradeItem[];
  missingAttendance: MissingAttendanceItem[];
  endingDisciplines: EndingDisciplineItem[];
  forum: ForumActivityItem[];
  upcomingLessons: UpcomingLessonItem[];
  atRiskStudents: AtRiskStudentItem[];
};

export function computeDisciplineProgress(
  discipline: { id: string; discipline: string; lessons: number | null },
  lessons: Array<{ disciplineId: string; date: string | null }>,
  today: string,
): DisciplineProgress;

export function pickEndingDisciplines(input: DashboardInput): EndingDisciplineItem[];
export function pickMaterialGaps(input: DashboardInput): MaterialGap[];
export function pickPendingGrading(input: DashboardInput): { items: PendingGradingItem[]; total: number };
export function pickMissingGrades(input: DashboardInput): MissingGradeItem[];
export function pickMissingAttendance(input: DashboardInput): { items: MissingAttendanceItem[]; total: number };
export function pickUpcomingLessons(input: DashboardInput): UpcomingLessonItem[];
export function pickForumActivity(input: DashboardInput): ForumActivityItem[];
export function pickAtRiskStudents(input: DashboardInput): { items: AtRiskStudentItem[]; total: number };
export function buildTeacherDashboard(input: DashboardInput): TeacherDashboard;
```

- [ ] **Step 1: Escrever o arquivo de testes (falhando)**

Criar `src/lib/teacherDashboard.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  buildTeacherDashboard,
  computeDisciplineProgress,
  pickAtRiskStudents,
  pickEndingDisciplines,
  pickForumActivity,
  pickMaterialGaps,
  pickMissingAttendance,
  pickMissingGrades,
  pickPendingGrading,
  pickUpcomingLessons,
  type DashboardInput,
} from "@/lib/teacherDashboard";

const TODAY = "2026-08-28";

function emptyInput(overrides: Partial<DashboardInput> = {}): DashboardInput {
  return {
    scope: "minhas",
    today: TODAY,
    disciplines: [],
    lessons: [],
    attendance: [],
    readingMaterials: [],
    videoLessons: [],
    assessments: [],
    grades: [],
    assignments: [],
    submissions: [],
    threads: [],
    posts: [],
    activeStudents: [],
    ...overrides,
  };
}

// helper: N aulas dadas (datas passadas) + M aulas futuras para uma disciplina
function lessonsFor(
  disciplineId: string,
  given: number,
  future: number,
): DashboardInput["lessons"] {
  const rows: DashboardInput["lessons"] = [];
  for (let i = 0; i < given; i++) {
    rows.push({ id: `${disciplineId}-p${i}`, disciplineId, date: "2026-08-01", sequence: i + 1 });
  }
  for (let i = 0; i < future; i++) {
    rows.push({
      id: `${disciplineId}-f${i}`,
      disciplineId,
      date: "2026-12-01",
      sequence: given + i + 1,
    });
  }
  return rows;
}

describe("computeDisciplineProgress", () => {
  it("usa disciplines.lessons como denominador quando presente", () => {
    const p = computeDisciplineProgress(
      { id: "d1", discipline: "A", lessons: 10 },
      lessonsFor("d1", 8, 0),
      TODAY,
    );
    expect(p).toMatchObject({ lessonsGiven: 8, lessonsPlanned: 10, isStarted: true, isEnded: false });
    expect(p.progress).toBeCloseTo(0.8);
  });

  it("cai para o total de lessons cadastradas quando lessons é null", () => {
    const p = computeDisciplineProgress(
      { id: "d1", discipline: "A", lessons: null },
      lessonsFor("d1", 3, 1), // 4 no total, 3 dadas
      TODAY,
    );
    expect(p.lessonsPlanned).toBe(4);
    expect(p.progress).toBeCloseTo(0.75);
  });

  it("progress = 0 quando não há aulas planejadas", () => {
    const p = computeDisciplineProgress(
      { id: "d1", discipline: "A", lessons: null },
      [],
      TODAY,
    );
    expect(p).toMatchObject({ lessonsGiven: 0, lessonsPlanned: 0, progress: 0, isStarted: false });
  });

  it("isEnded quando progress >= 1", () => {
    const p = computeDisciplineProgress(
      { id: "d1", discipline: "A", lessons: 4 },
      lessonsFor("d1", 4, 0),
      TODAY,
    );
    expect(p).toMatchObject({ progress: 1, isEnded: true });
  });

  it("ignora aulas sem data e aulas futuras na contagem de dadas", () => {
    const p = computeDisciplineProgress(
      { id: "d1", discipline: "A", lessons: 10 },
      [
        { disciplineId: "d1", date: "2026-08-01" },
        { disciplineId: "d1", date: null },
        { disciplineId: "d1", date: "2026-12-31" },
      ],
      TODAY,
    );
    expect(p.lessonsGiven).toBe(1);
  });
});

describe("pickEndingDisciplines", () => {
  const base = emptyInput({
    disciplines: [
      { id: "d80", discipline: "Oitenta", lessons: 10 },
      { id: "d79", discipline: "SetentaNove", lessons: 100 },
      { id: "d100", discipline: "Cem", lessons: 4 },
    ],
    lessons: [
      ...lessonsFor("d80", 8, 2),
      ...lessonsFor("d79", 79, 21),
      ...lessonsFor("d100", 4, 0),
    ],
  });

  it("inclui progress exatamente 0.8, exclui 0.79 e exclui >= 1", () => {
    const out = pickEndingDisciplines(base);
    expect(out.map((d) => d.disciplineId)).toEqual(["d80"]);
  });

  it("ordena por progress desc", () => {
    const input = emptyInput({
      disciplines: [
        { id: "a", discipline: "A", lessons: 10 },
        { id: "b", discipline: "B", lessons: 10 },
      ],
      lessons: [...lessonsFor("a", 8, 2), ...lessonsFor("b", 9, 1)],
    });
    expect(pickEndingDisciplines(input).map((d) => d.disciplineId)).toEqual(["b", "a"]);
  });
});

describe("pickMaterialGaps", () => {
  it("marca sem apostila e sem vídeo, e calcula apostilaDeficit", () => {
    const input = emptyInput({
      disciplines: [{ id: "d1", discipline: "A", lessons: 10 }],
      lessons: lessonsFor("d1", 5, 0),
      readingMaterials: [{ disciplineId: "d1" }, { disciplineId: "d1" }],
      videoLessons: [],
    });
    const [gap] = pickMaterialGaps(input);
    expect(gap).toMatchObject({
      disciplineId: "d1",
      missingApostila: false,
      missingVideos: true,
      lessonsGiven: 5,
      apostilaCount: 2,
      apostilaDeficit: 3,
    });
  });

  it("inclui disciplina totalmente sem material", () => {
    const input = emptyInput({
      disciplines: [{ id: "d1", discipline: "A", lessons: 10 }],
      lessons: lessonsFor("d1", 2, 0),
    });
    const [gap] = pickMaterialGaps(input);
    expect(gap).toMatchObject({ missingApostila: true, missingVideos: true, apostilaDeficit: 2 });
  });

  it("exclui disciplina não iniciada e disciplina encerrada", () => {
    const input = emptyInput({
      disciplines: [
        { id: "naoIniciada", discipline: "NI", lessons: 10 },
        { id: "encerrada", discipline: "E", lessons: 2 },
      ],
      lessons: [...lessonsFor("naoIniciada", 0, 3), ...lessonsFor("encerrada", 2, 0)],
    });
    expect(pickMaterialGaps(input)).toEqual([]);
  });

  it("não inclui disciplina com apostila e vídeo e sem déficit", () => {
    const input = emptyInput({
      disciplines: [{ id: "d1", discipline: "A", lessons: 10 }],
      lessons: lessonsFor("d1", 2, 0),
      readingMaterials: [{ disciplineId: "d1" }, { disciplineId: "d1" }],
      videoLessons: [{ disciplineId: "d1" }],
    });
    expect(pickMaterialGaps(input)).toEqual([]);
  });
});

describe("pickPendingGrading", () => {
  const input = emptyInput({
    disciplines: [{ id: "d1", discipline: "Disc", lessons: 10 }],
    assignments: [
      { id: "a1", disciplineId: "d1", title: "Tarefa 1" },
      { id: "a2", disciplineId: "d1", title: "Tarefa 2" },
    ],
    submissions: [
      { assignmentId: "a1", submittedAt: "2026-08-10T10:00:00.000Z", gradedAt: null },
      { assignmentId: "a1", submittedAt: "2026-08-05T10:00:00.000Z", gradedAt: null },
      { assignmentId: "a1", submittedAt: "2026-08-01T10:00:00.000Z", gradedAt: "2026-08-02T10:00:00.000Z" },
      { assignmentId: "a2", submittedAt: null, gradedAt: null },
      { assignmentId: "a2", submittedAt: "2026-08-20T10:00:00.000Z", gradedAt: null },
    ],
  });

  it("conta só submittedAt != null && gradedAt == null e agrupa por tarefa", () => {
    const { items, total } = pickPendingGrading(input);
    expect(total).toBe(3);
    const a1 = items.find((i) => i.assignmentId === "a1")!;
    expect(a1).toMatchObject({
      awaitingCount: 2,
      oldestSubmittedAt: "2026-08-05T10:00:00.000Z",
      disciplineName: "Disc",
    });
  });

  it("ordena por oldestSubmittedAt asc", () => {
    const { items } = pickPendingGrading(input);
    expect(items.map((i) => i.assignmentId)).toEqual(["a1", "a2"]);
  });
});

describe("pickMissingGrades", () => {
  it("studentsMissing = alunos ativos - studentIds distintos com nota", () => {
    const input = emptyInput({
      disciplines: [{ id: "d1", discipline: "Disc", lessons: 10 }],
      activeStudents: [
        { id: "s1", name: "A" },
        { id: "s2", name: "B" },
        { id: "s3", name: "C" },
      ],
      assessments: [
        { id: "av1", disciplineId: "d1", title: "Prova", weight: 1 },
        { id: "av2", disciplineId: "d1", title: "Completa", weight: 1 },
      ],
      grades: [
        { assessmentId: "av1", studentId: "s1", score: 8 },
        { assessmentId: "av2", studentId: "s1", score: 7 },
        { assessmentId: "av2", studentId: "s2", score: 6 },
        { assessmentId: "av2", studentId: "s3", score: 9 },
      ],
    });
    const out = pickMissingGrades(input);
    expect(out).toEqual([
      { assessmentId: "av1", disciplineId: "d1", title: "Prova", disciplineName: "Disc", studentsMissing: 2 },
    ]);
  });
});

describe("pickMissingAttendance", () => {
  it("conta aulas passadas sem nenhuma linha de attendance, agrupadas por disciplina", () => {
    const input = emptyInput({
      disciplines: [{ id: "d1", discipline: "Disc", lessons: 10 }],
      lessons: [
        { id: "l1", disciplineId: "d1", date: "2026-08-01", sequence: 1 },
        { id: "l2", disciplineId: "d1", date: "2026-08-08", sequence: 2 },
        { id: "l3", disciplineId: "d1", date: "2026-12-01", sequence: 3 }, // futura
      ],
      attendance: [{ lessonId: "l1", studentId: "s1", present: true }],
    });
    const { items, total } = pickMissingAttendance(input);
    expect(total).toBe(1);
    expect(items).toEqual([
      { disciplineId: "d1", disciplineName: "Disc", lessonsWithoutAttendance: 1 },
    ]);
  });
});

describe("pickUpcomingLessons", () => {
  it("pega aulas com date > hoje, ordena asc e corta no limite", () => {
    const input = emptyInput({
      disciplines: [{ id: "d1", discipline: "Disc", lessons: 10 }],
      lessons: [
        { id: "p", disciplineId: "d1", date: "2026-08-01", sequence: 1 },
        { id: "f2", disciplineId: "d1", date: "2026-09-10", sequence: 3 },
        { id: "f1", disciplineId: "d1", date: "2026-09-01", sequence: 2 },
      ],
    });
    const out = pickUpcomingLessons(input);
    expect(out.map((l) => l.date)).toEqual(["2026-09-01", "2026-09-10"]);
    expect(out[0]).toMatchObject({ disciplineId: "d1", disciplineName: "Disc", sequence: 2 });
  });
});

describe("pickForumActivity", () => {
  const input = emptyInput({
    disciplines: [{ id: "d1", discipline: "Disc", lessons: 10 }],
    threads: [
      { id: "t1", disciplineId: "d1", title: "Sem resposta", createdAt: "2026-08-01T10:00:00.000Z" },
      { id: "t2", disciplineId: "d1", title: "Respondido", createdAt: "2026-08-02T10:00:00.000Z" },
    ],
    posts: [
      { threadId: "t1", authorRole: "student", createdAt: "2026-08-01T10:00:00.000Z" },
      { threadId: "t1", authorRole: "student", createdAt: "2026-08-10T10:00:00.000Z" },
      { threadId: "t2", authorRole: "student", createdAt: "2026-08-02T10:00:00.000Z" },
      { threadId: "t2", authorRole: "teacher", createdAt: "2026-08-03T10:00:00.000Z" },
    ],
  });

  it("marca awaitingTeacherReply quando o último post é de aluno", () => {
    const out = pickForumActivity(input);
    expect(out.find((t) => t.threadId === "t1")).toMatchObject({
      awaitingTeacherReply: true,
      postCount: 2,
      lastActivityAt: "2026-08-10T10:00:00.000Z",
      disciplineName: "Disc",
    });
    expect(out.find((t) => t.threadId === "t2")!.awaitingTeacherReply).toBe(false);
  });

  it("ordena os aguardando na frente, depois por lastActivityAt desc", () => {
    expect(pickForumActivity(input).map((t) => t.threadId)).toEqual(["t1", "t2"]);
  });

  it("respeita FORUM_ITEMS_LIMIT", () => {
    const many = emptyInput({
      disciplines: [{ id: "d1", discipline: "D", lessons: 10 }],
      threads: Array.from({ length: 12 }, (_, i) => ({
        id: `t${i}`,
        disciplineId: "d1",
        title: `T${i}`,
        createdAt: `2026-08-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`,
      })),
      posts: Array.from({ length: 12 }, (_, i) => ({
        threadId: `t${i}`,
        authorRole: "teacher" as const,
        createdAt: `2026-08-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`,
      })),
    });
    expect(pickForumActivity(many)).toHaveLength(8);
  });
});

describe("pickAtRiskStudents", () => {
  function riskInput(): DashboardInput {
    return emptyInput({
      disciplines: [{ id: "d1", discipline: "Disc", lessons: 10 }],
      activeStudents: [
        { id: "s1", name: "Ana" },
        { id: "s2", name: "Bia" },
        { id: "s3", name: "Cida" },
      ],
      lessons: [
        { id: "l1", disciplineId: "d1", date: "2026-08-01", sequence: 1 },
        { id: "l2", disciplineId: "d1", date: "2026-08-02", sequence: 2 },
        { id: "l3", disciplineId: "d1", date: "2026-08-03", sequence: 3 },
        { id: "l4", disciplineId: "d1", date: "2026-08-04", sequence: 4 },
      ],
      assessments: [{ id: "av1", disciplineId: "d1", title: "P1", weight: 1 }],
      grades: [
        { assessmentId: "av1", studentId: "s1", score: 5 }, // média baixa
        { assessmentId: "av1", studentId: "s2", score: 9 },
      ],
      attendance: [
        // s2: 1 falta em 4 = 75% presença -> NÃO é risco (estritamente < 0.75)
        { lessonId: "l1", studentId: "s2", present: false },
        { lessonId: "l2", studentId: "s2", present: true },
        { lessonId: "l3", studentId: "s2", present: true },
        { lessonId: "l4", studentId: "s2", present: true },
        // s1: 2 faltas em 4 = 50% -> risco de frequência também
        { lessonId: "l1", studentId: "s1", present: false },
        { lessonId: "l2", studentId: "s1", present: false },
        { lessonId: "l3", studentId: "s1", present: true },
        { lessonId: "l4", studentId: "s1", present: true },
      ],
    });
  }

  it("s1 entra com reason 'ambos'; s2 e s3 não entram", () => {
    const { items, total } = pickAtRiskStudents(riskInput());
    expect(total).toBe(1);
    expect(items).toEqual([
      {
        studentId: "s1",
        studentName: "Ana",
        disciplines: [{ disciplineName: "Disc", reason: "ambos" }],
      },
    ]);
  });

  it("frequência exatamente 0.75 não é risco", () => {
    const input = riskInput();
    input.grades = [{ assessmentId: "av1", studentId: "s2", score: 9 }]; // tira nota baixa de s1
    input.attendance = input.attendance.filter((a) => a.studentId === "s2");
    expect(pickAtRiskStudents(input).items).toEqual([]);
  });

  it("aluno sem nenhuma nota não entra por média", () => {
    const input = riskInput();
    input.grades = [];
    input.attendance = [];
    expect(pickAtRiskStudents(input).items).toEqual([]);
  });

  it("exclui disciplina encerrada e não iniciada", () => {
    const input = riskInput();
    input.disciplines = [{ id: "d1", discipline: "Disc", lessons: 4 }]; // 4 dadas / 4 = encerrada
    expect(pickAtRiskStudents(input).items).toEqual([]);
  });

  it("ordena por nº de disciplinas em risco desc e corta em AT_RISK_LIMIT", () => {
    const disciplines = Array.from({ length: 10 }, (_, i) => ({
      id: `d${i}`,
      discipline: `D${i}`,
      lessons: 10,
    }));
    const lessons = disciplines.flatMap((d) => [
      { id: `${d.id}-l1`, disciplineId: d.id, date: "2026-08-01", sequence: 1 },
    ]);
    const assessments = disciplines.map((d) => ({
      id: `${d.id}-av`,
      disciplineId: d.id,
      title: "P",
      weight: 1,
    }));
    // s1 reprova em todas as 10; s2 reprova só em 1
    const grades = [
      ...assessments.map((a) => ({ assessmentId: a.id, studentId: "s1", score: 1 })),
      { assessmentId: "d0-av", studentId: "s2", score: 1 },
    ];
    const input = emptyInput({
      disciplines,
      lessons,
      assessments,
      grades,
      activeStudents: [
        { id: "s1", name: "Ana" },
        { id: "s2", name: "Bia" },
      ],
    });
    const { items, total } = pickAtRiskStudents(input);
    expect(total).toBe(2);
    expect(items).toHaveLength(2);
    expect(items[0].studentId).toBe("s1");
    expect(items[0].disciplines).toHaveLength(8); // AT_RISK_LIMIT aplicado à lista interna
  });
});

describe("buildTeacherDashboard", () => {
  it("monta counts a partir dos sub-resultados e propaga scope", () => {
    const input = emptyInput({
      scope: "escola",
      disciplines: [{ id: "d1", discipline: "Disc", lessons: 10 }],
      lessons: [
        { id: "l1", disciplineId: "d1", date: "2026-08-01", sequence: 1 },
        { id: "l2", disciplineId: "d1", date: "2026-09-01", sequence: 2 },
      ],
      assignments: [{ id: "a1", disciplineId: "d1", title: "T1" }],
      submissions: [{ assignmentId: "a1", submittedAt: "2026-08-10T10:00:00.000Z", gradedAt: null }],
    });
    const out = buildTeacherDashboard(input);
    expect(out.scope).toBe("escola");
    expect(out.counts).toMatchObject({
      pendingGrading: 1,
      lessonsWithoutAttendance: 1,
      endingDisciplines: 0,
      atRiskStudents: 0,
    });
    expect(out.upcomingLessons).toHaveLength(1);
  });

  it("tudo vazio ⇒ counts zerados e todas as listas vazias", () => {
    const out = buildTeacherDashboard(emptyInput());
    expect(out.counts).toEqual({
      pendingGrading: 0,
      endingDisciplines: 0,
      atRiskStudents: 0,
      lessonsWithoutAttendance: 0,
    });
    for (const key of [
      "materialGaps",
      "pendingGrading",
      "missingGrades",
      "missingAttendance",
      "endingDisciplines",
      "forum",
      "upcomingLessons",
      "atRiskStudents",
    ] as const) {
      expect(out[key]).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- src/lib/teacherDashboard.test.ts`
Expected: FAIL — `Cannot find module '@/lib/teacherDashboard'` / exports indefinidos.

- [ ] **Step 3: Implementar `src/lib/teacherDashboard.ts`**

```ts
import { MINIMUM_ATTENDANCE_RATIO, countFaltas } from "@/lib/attendance";
import { PASSING_AVERAGE, computeWeightedAverage } from "@/lib/grades";

export const ENDING_PROGRESS_RATIO = 0.8;
export const UPCOMING_LESSONS_LIMIT = 5;
export const FORUM_ITEMS_LIMIT = 8;
export const AT_RISK_LIMIT = 8;

export type DashboardInput = {
  scope: "minhas" | "escola";
  today: string;
  disciplines: Array<{ id: string; discipline: string; lessons: number | null }>;
  lessons: Array<{ id: string; disciplineId: string; date: string | null; sequence: number }>;
  attendance: Array<{ lessonId: string; studentId: string; present: boolean }>;
  readingMaterials: Array<{ disciplineId: string }>;
  videoLessons: Array<{ disciplineId: string }>;
  assessments: Array<{ id: string; disciplineId: string; title: string; weight: number }>;
  grades: Array<{ assessmentId: string; studentId: string; score: number }>;
  assignments: Array<{ id: string; disciplineId: string; title: string }>;
  submissions: Array<{ assignmentId: string; submittedAt: string | null; gradedAt: string | null }>;
  threads: Array<{ id: string; disciplineId: string; title: string; createdAt: string }>;
  posts: Array<{ threadId: string; authorRole: "teacher" | "student"; createdAt: string }>;
  activeStudents: Array<{ id: string; name: string }>;
};

export type DisciplineProgress = {
  disciplineId: string;
  disciplineName: string;
  lessonsGiven: number;
  lessonsPlanned: number;
  progress: number;
  isStarted: boolean;
  isEnded: boolean;
};
export type MaterialGap = {
  disciplineId: string;
  disciplineName: string;
  missingApostila: boolean;
  missingVideos: boolean;
  lessonsGiven: number;
  apostilaCount: number;
  apostilaDeficit: number;
};
export type PendingGradingItem = {
  assignmentId: string;
  title: string;
  disciplineName: string;
  awaitingCount: number;
  oldestSubmittedAt: string;
};
export type MissingGradeItem = {
  assessmentId: string;
  disciplineId: string;
  title: string;
  disciplineName: string;
  studentsMissing: number;
};
export type MissingAttendanceItem = {
  disciplineId: string;
  disciplineName: string;
  lessonsWithoutAttendance: number;
};
export type EndingDisciplineItem = {
  disciplineId: string;
  disciplineName: string;
  lessonsGiven: number;
  lessonsPlanned: number;
  progress: number;
};
export type ForumActivityItem = {
  threadId: string;
  disciplineName: string;
  title: string;
  lastActivityAt: string;
  postCount: number;
  awaitingTeacherReply: boolean;
};
export type UpcomingLessonItem = {
  disciplineId: string;
  disciplineName: string;
  date: string;
  sequence: number;
};
export type AtRiskStudentItem = {
  studentId: string;
  studentName: string;
  disciplines: Array<{ disciplineName: string; reason: "media" | "frequencia" | "ambos" }>;
};

export type TeacherDashboard = {
  scope: "minhas" | "escola";
  counts: {
    pendingGrading: number;
    endingDisciplines: number;
    atRiskStudents: number;
    lessonsWithoutAttendance: number;
  };
  materialGaps: MaterialGap[];
  pendingGrading: PendingGradingItem[];
  missingGrades: MissingGradeItem[];
  missingAttendance: MissingAttendanceItem[];
  endingDisciplines: EndingDisciplineItem[];
  forum: ForumActivityItem[];
  upcomingLessons: UpcomingLessonItem[];
  atRiskStudents: AtRiskStudentItem[];
};

/** Aula "dada" = tem data e a data já passou (ou é hoje). */
function isPastLesson(date: string | null, today: string): boolean {
  return date !== null && date <= today;
}

export function computeDisciplineProgress(
  discipline: { id: string; discipline: string; lessons: number | null },
  lessons: Array<{ disciplineId: string; date: string | null }>,
  today: string,
): DisciplineProgress {
  const mine = lessons.filter((l) => l.disciplineId === discipline.id);
  const lessonsGiven = mine.filter((l) => isPastLesson(l.date, today)).length;
  const lessonsPlanned = discipline.lessons ?? mine.length;
  const progress = lessonsPlanned > 0 ? lessonsGiven / lessonsPlanned : 0;
  return {
    disciplineId: discipline.id,
    disciplineName: discipline.discipline,
    lessonsGiven,
    lessonsPlanned,
    progress,
    isStarted: lessonsGiven >= 1,
    isEnded: progress >= 1,
  };
}

function progressByDiscipline(input: DashboardInput): Map<string, DisciplineProgress> {
  return new Map(
    input.disciplines.map((d) => [d.id, computeDisciplineProgress(d, input.lessons, input.today)]),
  );
}

export function pickEndingDisciplines(input: DashboardInput): EndingDisciplineItem[] {
  return [...progressByDiscipline(input).values()]
    .filter((p) => p.progress >= ENDING_PROGRESS_RATIO && p.progress < 1)
    .sort((a, b) => b.progress - a.progress)
    .map((p) => ({
      disciplineId: p.disciplineId,
      disciplineName: p.disciplineName,
      lessonsGiven: p.lessonsGiven,
      lessonsPlanned: p.lessonsPlanned,
      progress: p.progress,
    }));
}

export function pickMaterialGaps(input: DashboardInput): MaterialGap[] {
  const progress = progressByDiscipline(input);
  const gaps: MaterialGap[] = [];
  for (const d of input.disciplines) {
    const p = progress.get(d.id)!;
    if (!p.isStarted || p.isEnded) continue;
    const apostilaCount = input.readingMaterials.filter((m) => m.disciplineId === d.id).length;
    const videoCount = input.videoLessons.filter((v) => v.disciplineId === d.id).length;
    const apostilaDeficit = Math.max(0, p.lessonsGiven - apostilaCount);
    const missingApostila = apostilaCount === 0;
    const missingVideos = videoCount === 0;
    if (!missingApostila && !missingVideos && apostilaDeficit < 1) continue;
    gaps.push({
      disciplineId: d.id,
      disciplineName: d.discipline,
      missingApostila,
      missingVideos,
      lessonsGiven: p.lessonsGiven,
      apostilaCount,
      apostilaDeficit,
    });
  }
  return gaps;
}

export function pickPendingGrading(input: DashboardInput): {
  items: PendingGradingItem[];
  total: number;
} {
  const disciplineName = new Map(input.disciplines.map((d) => [d.id, d.discipline]));
  const byAssignment = new Map<string, { title: string; disciplineName: string }>();
  for (const a of input.assignments) {
    byAssignment.set(a.id, {
      title: a.title,
      disciplineName: disciplineName.get(a.disciplineId) ?? "",
    });
  }
  const pending = input.submissions.filter((s) => s.submittedAt !== null && s.gradedAt === null);
  const items: PendingGradingItem[] = [];
  for (const [assignmentId, meta] of byAssignment) {
    const mine = pending.filter((s) => s.assignmentId === assignmentId);
    if (mine.length === 0) continue;
    const oldest = mine.reduce(
      (min, s) => (s.submittedAt! < min ? s.submittedAt! : min),
      mine[0].submittedAt!,
    );
    items.push({
      assignmentId,
      title: meta.title,
      disciplineName: meta.disciplineName,
      awaitingCount: mine.length,
      oldestSubmittedAt: oldest,
    });
  }
  items.sort((a, b) => (a.oldestSubmittedAt < b.oldestSubmittedAt ? -1 : 1));
  return { items, total: items.reduce((sum, i) => sum + i.awaitingCount, 0) };
}

export function pickMissingGrades(input: DashboardInput): MissingGradeItem[] {
  const active = input.activeStudents.length;
  const disciplineName = new Map(input.disciplines.map((d) => [d.id, d.discipline]));
  const out: MissingGradeItem[] = [];
  for (const a of input.assessments) {
    const distinct = new Set(
      input.grades.filter((g) => g.assessmentId === a.id).map((g) => g.studentId),
    ).size;
    const studentsMissing = active - distinct;
    if (studentsMissing < 1) continue;
    out.push({
      assessmentId: a.id,
      disciplineId: a.disciplineId,
      title: a.title,
      disciplineName: disciplineName.get(a.disciplineId) ?? "",
      studentsMissing,
    });
  }
  return out;
}

export function pickMissingAttendance(input: DashboardInput): {
  items: MissingAttendanceItem[];
  total: number;
} {
  const withAttendance = new Set(input.attendance.map((a) => a.lessonId));
  const items: MissingAttendanceItem[] = [];
  let total = 0;
  for (const d of input.disciplines) {
    const missing = input.lessons.filter(
      (l) =>
        l.disciplineId === d.id &&
        isPastLesson(l.date, input.today) &&
        !withAttendance.has(l.id),
    ).length;
    if (missing < 1) continue;
    total += missing;
    items.push({
      disciplineId: d.id,
      disciplineName: d.discipline,
      lessonsWithoutAttendance: missing,
    });
  }
  return { items, total };
}

export function pickUpcomingLessons(input: DashboardInput): UpcomingLessonItem[] {
  const disciplineName = new Map(input.disciplines.map((d) => [d.id, d.discipline]));
  return input.lessons
    .filter((l) => l.date !== null && l.date > input.today)
    .sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : a.sequence - b.sequence))
    .slice(0, UPCOMING_LESSONS_LIMIT)
    .map((l) => ({
      disciplineId: l.disciplineId,
      disciplineName: disciplineName.get(l.disciplineId) ?? "",
      date: l.date!,
      sequence: l.sequence,
    }));
}

export function pickForumActivity(input: DashboardInput): ForumActivityItem[] {
  const disciplineName = new Map(input.disciplines.map((d) => [d.id, d.discipline]));
  return input.threads
    .map((thread) => {
      const posts = input.posts
        .filter((p) => p.threadId === thread.id)
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
      const last = posts[posts.length - 1];
      const lastActivityAt = last && last.createdAt > thread.createdAt ? last.createdAt : thread.createdAt;
      return {
        threadId: thread.id,
        disciplineName: disciplineName.get(thread.disciplineId) ?? "",
        title: thread.title,
        lastActivityAt,
        postCount: posts.length,
        awaitingTeacherReply: last ? last.authorRole === "student" : false,
      };
    })
    .sort((a, b) => {
      if (a.awaitingTeacherReply !== b.awaitingTeacherReply) return a.awaitingTeacherReply ? -1 : 1;
      return a.lastActivityAt < b.lastActivityAt ? 1 : -1;
    })
    .slice(0, FORUM_ITEMS_LIMIT);
}

export function pickAtRiskStudents(input: DashboardInput): {
  items: AtRiskStudentItem[];
  total: number;
} {
  const progress = progressByDiscipline(input);
  const absentByStudent = new Map<string, Set<string>>();
  for (const a of input.attendance) {
    if (a.present) continue;
    if (!absentByStudent.has(a.studentId)) absentByStudent.set(a.studentId, new Set());
    absentByStudent.get(a.studentId)!.add(a.lessonId);
  }

  const byStudent = new Map<string, AtRiskStudentItem>();
  for (const d of input.disciplines) {
    const p = progress.get(d.id)!;
    if (!p.isStarted || p.isEnded) continue;
    const disciplineAssessments = input.assessments.filter((a) => a.disciplineId === d.id);
    const pastLessonIds = input.lessons
      .filter((l) => l.disciplineId === d.id && isPastLesson(l.date, input.today))
      .map((l) => l.id);

    for (const student of input.activeStudents) {
      const scored = disciplineAssessments
        .map((a) => {
          const g = input.grades.find(
            (row) => row.assessmentId === a.id && row.studentId === student.id,
          );
          return g ? { score: g.score, weight: a.weight } : null;
        })
        .filter((x): x is { score: number; weight: number } => x !== null);
      const average = computeWeightedAverage(scored);
      const atRiskMedia = average !== null && average < PASSING_AVERAGE;

      const absent = absentByStudent.get(student.id) ?? new Set<string>();
      const faltas = countFaltas(pastLessonIds, absent);
      const ratio = pastLessonIds.length > 0 ? (pastLessonIds.length - faltas) / pastLessonIds.length : null;
      const atRiskFreq = ratio !== null && ratio < MINIMUM_ATTENDANCE_RATIO;

      if (!atRiskMedia && !atRiskFreq) continue;
      const reason: "media" | "frequencia" | "ambos" =
        atRiskMedia && atRiskFreq ? "ambos" : atRiskMedia ? "media" : "frequencia";
      if (!byStudent.has(student.id)) {
        byStudent.set(student.id, {
          studentId: student.id,
          studentName: student.name,
          disciplines: [],
        });
      }
      byStudent.get(student.id)!.disciplines.push({ disciplineName: d.discipline, reason });
    }
  }

  const all = [...byStudent.values()].sort(
    (a, b) => b.disciplines.length - a.disciplines.length,
  );
  const items = all.slice(0, AT_RISK_LIMIT).map((s) => ({
    ...s,
    disciplines: s.disciplines.slice(0, AT_RISK_LIMIT),
  }));
  return { items, total: all.length };
}

export function buildTeacherDashboard(input: DashboardInput): TeacherDashboard {
  const pendingGrading = pickPendingGrading(input);
  const missingAttendance = pickMissingAttendance(input);
  const endingDisciplines = pickEndingDisciplines(input);
  const atRiskStudents = pickAtRiskStudents(input);
  return {
    scope: input.scope,
    counts: {
      pendingGrading: pendingGrading.total,
      endingDisciplines: endingDisciplines.length,
      atRiskStudents: atRiskStudents.total,
      lessonsWithoutAttendance: missingAttendance.total,
    },
    materialGaps: pickMaterialGaps(input),
    pendingGrading: pendingGrading.items,
    missingGrades: pickMissingGrades(input),
    missingAttendance: missingAttendance.items,
    endingDisciplines,
    forum: pickForumActivity(input),
    upcomingLessons: pickUpcomingLessons(input),
    atRiskStudents: atRiskStudents.items,
  };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- src/lib/teacherDashboard.test.ts`
Expected: PASS (todos os `describe` verdes).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/lib/teacherDashboard.ts src/lib/teacherDashboard.test.ts
git commit -m "$(cat <<'EOF'
Lógica pura do dashboard do professor + testes

Helpers puros para os sinais do dashboard (materiais faltando, correções
pendentes, notas/frequência a lançar, disciplinas encerrando, fórum,
próximas aulas, alunos em risco) e o agregador buildTeacherDashboard.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Server function (`src/functions/teacherDashboard.ts`)

**Files:**
- Create: `src/functions/teacherDashboard.ts`

**Interfaces:**
- Consumes: `buildTeacherDashboard`, `type DashboardInput`, `type TeacherDashboard` de `@/lib/teacherDashboard`. `requireTeacherId` de `@/server/auth/guard`. `db` de `@/server/db/client`. Tabelas de `@/server/db/schema`: `teachers`, `disciplines`, `lessons`, `attendance`, `readingMaterials`, `videoLessons`, `assessments`, `grades`, `assignments`, `assignmentSubmissions`, `forumThreads`, `forumPosts`, `students`.
- Produces (usado pelas Tasks 3 e 4):
  - `getTeacherDashboardFn` — `createServerFn({ method: "GET" })`, sem validator, retorna `Promise<TeacherDashboard>`.
  - `export type { TeacherDashboard } from "@/lib/teacherDashboard";`

- [ ] **Step 1: Implementar o arquivo**

```ts
import { createServerFn } from "@tanstack/react-start";
import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { buildTeacherDashboard, type DashboardInput } from "@/lib/teacherDashboard";
import { requireTeacherId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import {
  assessments,
  assignmentSubmissions,
  assignments,
  attendance,
  disciplines,
  forumPosts,
  forumThreads,
  grades,
  lessons,
  readingMaterials,
  students,
  teachers,
  videoLessons,
} from "@/server/db/schema";

export type { TeacherDashboard } from "@/lib/teacherDashboard";

/** Snapshot completo do dashboard do professor logado (ou da escola, se admin). */
export const getTeacherDashboardFn = createServerFn({ method: "GET" }).handler(async () => {
  const teacherId = await requireTeacherId();
  const [me] = await db
    .select({ role: teachers.role })
    .from(teachers)
    .where(eq(teachers.id, teacherId))
    .limit(1);
  const isAdmin = me?.role === "admin";
  const scope: DashboardInput["scope"] = isAdmin ? "escola" : "minhas";
  const today = new Date().toISOString().slice(0, 10);

  const disciplineRows = await db
    .select({ id: disciplines.id, discipline: disciplines.discipline, lessons: disciplines.lessons })
    .from(disciplines)
    .where(isAdmin ? undefined : eq(disciplines.teacherId, teacherId));
  const disciplineIds = disciplineRows.map((d) => d.id);

  const activeStudentRows = await db
    .select({ id: students.id, name: students.name })
    .from(students)
    .where(eq(students.active, true));

  if (disciplineIds.length === 0) {
    return buildTeacherDashboard({
      scope,
      today,
      disciplines: [],
      lessons: [],
      attendance: [],
      readingMaterials: [],
      videoLessons: [],
      assessments: [],
      grades: [],
      assignments: [],
      submissions: [],
      threads: [],
      posts: [],
      activeStudents: activeStudentRows,
    });
  }

  const [
    lessonRows,
    readingMaterialRows,
    videoLessonRows,
    assessmentRows,
    assignmentRows,
    threadRows,
  ] = await Promise.all([
    db
      .select({
        id: lessons.id,
        disciplineId: lessons.disciplineId,
        date: lessons.date,
        sequence: lessons.sequence,
      })
      .from(lessons)
      .where(inArray(lessons.disciplineId, disciplineIds)),
    db
      .select({ disciplineId: readingMaterials.disciplineId })
      .from(readingMaterials)
      .where(inArray(readingMaterials.disciplineId, disciplineIds)),
    db
      .select({ disciplineId: videoLessons.disciplineId })
      .from(videoLessons)
      .where(inArray(videoLessons.disciplineId, disciplineIds)),
    db
      .select({
        id: assessments.id,
        disciplineId: assessments.disciplineId,
        title: assessments.title,
        weight: assessments.weight,
      })
      .from(assessments)
      .where(inArray(assessments.disciplineId, disciplineIds)),
    db
      .select({
        id: assignments.id,
        disciplineId: assignments.disciplineId,
        title: assignments.title,
      })
      .from(assignments)
      .where(inArray(assignments.disciplineId, disciplineIds)),
    db
      .select({
        id: forumThreads.id,
        disciplineId: forumThreads.disciplineId,
        title: forumThreads.title,
        createdAt: forumThreads.createdAt,
      })
      .from(forumThreads)
      .where(inArray(forumThreads.disciplineId, disciplineIds)),
  ]);

  const lessonIds = lessonRows.map((l) => l.id);
  const assessmentIds = assessmentRows.map((a) => a.id);
  const assignmentIds = assignmentRows.map((a) => a.id);
  const threadIds = threadRows.map((t) => t.id);

  const [attendanceRows, gradeRows, submissionRows, postRows] = await Promise.all([
    lessonIds.length === 0
      ? []
      : db
          .select({
            lessonId: attendance.lessonId,
            studentId: attendance.studentId,
            present: attendance.present,
          })
          .from(attendance)
          .where(inArray(attendance.lessonId, lessonIds)),
    assessmentIds.length === 0
      ? []
      : db
          .select({
            assessmentId: grades.assessmentId,
            studentId: grades.studentId,
            score: grades.score,
          })
          .from(grades)
          .where(inArray(grades.assessmentId, assessmentIds)),
    assignmentIds.length === 0
      ? []
      : db
          .select({
            assignmentId: assignmentSubmissions.assignmentId,
            submittedAt: assignmentSubmissions.submittedAt,
            gradedAt: assignmentSubmissions.gradedAt,
          })
          .from(assignmentSubmissions)
          .where(inArray(assignmentSubmissions.assignmentId, assignmentIds)),
    threadIds.length === 0
      ? []
      : db
          .select({
            threadId: forumPosts.threadId,
            authorRole: forumPosts.authorRole,
            createdAt: forumPosts.createdAt,
          })
          .from(forumPosts)
          .where(inArray(forumPosts.threadId, threadIds)),
  ]);

  return buildTeacherDashboard({
    scope,
    today,
    disciplines: disciplineRows,
    lessons: lessonRows,
    attendance: attendanceRows,
    readingMaterials: readingMaterialRows,
    videoLessons: videoLessonRows,
    assessments: assessmentRows.map((a) => ({ ...a, weight: Number(a.weight) })),
    grades: gradeRows.map((g) => ({ ...g, score: Number(g.score) })),
    assignments: assignmentRows,
    submissions: submissionRows.map((s) => ({
      assignmentId: s.assignmentId,
      submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
      gradedAt: s.gradedAt ? s.gradedAt.toISOString() : null,
    })),
    threads: threadRows.map((t) => ({
      id: t.id,
      disciplineId: t.disciplineId,
      title: t.title,
      createdAt: t.createdAt.toISOString(),
    })),
    posts: postRows.map((p) => ({
      threadId: p.threadId,
      authorRole: p.authorRole,
      createdAt: p.createdAt.toISOString(),
    })),
    activeStudents: activeStudentRows,
  });
});
```

Notas de implementação:
- `where(isAdmin ? undefined : eq(...))` — o Drizzle aceita `undefined` como "sem filtro". Se o typecheck reclamar, trocar por dois ramos completos de query.
- `submittedAt`/`gradedAt`/`createdAt` são `timestamp` → `Date | null` no Drizzle; converter com `.toISOString()`.
- `isNotNull` está importado para uso opcional; se não for usado, remover o import para não sujar o lint.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros. Se `where(... ? undefined : ...)` falhar no tipo, dividir em dois branches de query completos e re-rodar.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: sem erros novos no arquivo (remover imports não usados se acusado).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build conclui sem erro (o import de `@/server/*` só pode existir em módulo server-only; `src/functions/*` é server-only — padrão já usado por `report.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/functions/teacherDashboard.ts
git commit -m "$(cat <<'EOF'
Server function getTeacherDashboardFn

Auth + escopo (admin = escola, professor = próprias disciplinas) + cargas
em lote + montagem do payload via buildTeacherDashboard.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Componentes do dashboard (`src/pages/painel/dashboard/`)

**Files:**
- Create: `src/pages/painel/dashboard/DashboardCard.tsx`
- Create: `src/pages/painel/dashboard/KpiStrip.tsx`
- Create: `src/pages/painel/dashboard/cards.tsx`

**Interfaces:**
- Consumes: `type TeacherDashboard` de `@/functions/teacherDashboard`. `Skeleton` de `@/components/ui/skeleton`. `Badge` de `@/components/ui/badge`. `Link` de `@tanstack/react-router`. Ícones de `lucide-react`. `cn` de `@/lib/utils`. `format` de `date-fns` + `ptBR` de `date-fns/locale` para datas.
- Produces (usado pela Task 4):
  - `DashboardCard` — props `{ title: string; icon: LucideIcon; viewAll?: { to: string; params?: Record<string,string> }; isLoading: boolean; isEmpty: boolean; emptyLabel: string; children: ReactNode }`.
  - `KpiStrip` — props `{ scope: TeacherDashboard["scope"]; counts: TeacherDashboard["counts"]; isLoading: boolean }`.
  - `DashboardCards` — props `{ data: TeacherDashboard | undefined; isLoading: boolean }`. Renderiza os 7 cartões dentro de um `<>` (o grid é responsabilidade do pai).

- [ ] **Step 1: `DashboardCard.tsx`**

```tsx
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

export function DashboardCard({
  title,
  icon: Icon,
  viewAll,
  isLoading,
  isEmpty,
  emptyLabel,
  children,
}: {
  title: string;
  icon: LucideIcon;
  viewAll?: { to: string; params?: Record<string, string> };
  isLoading: boolean;
  isEmpty: boolean;
  emptyLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-foreground">
          <Icon className="size-4 shrink-0 text-accent" aria-hidden />
          {title}
        </h2>
        {viewAll ? (
          <Link
            to={viewAll.to}
            params={viewAll.params}
            className="text-xs font-medium text-muted-foreground hover:text-accent"
          >
            Ver tudo
          </Link>
        ) : null}
      </div>
      <div className="space-y-2">
        {isLoading ? (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        ) : isEmpty ? (
          <p className="rounded-md border border-border/70 bg-card/40 p-4 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `KpiStrip.tsx`**

```tsx
import { Link } from "@tanstack/react-router";

import { Skeleton } from "@/components/ui/skeleton";
import type { TeacherDashboard } from "@/functions/teacherDashboard";
import { cn } from "@/lib/utils";

const KPIS = [
  { key: "pendingGrading", label: "Correções pendentes", alarm: true },
  { key: "endingDisciplines", label: "Disciplinas encerrando", alarm: false },
  { key: "atRiskStudents", label: "Alunos em risco", alarm: true },
  { key: "lessonsWithoutAttendance", label: "Aulas sem chamada", alarm: true },
] as const;

export function KpiStrip({
  scope,
  counts,
  isLoading,
}: {
  scope: TeacherDashboard["scope"];
  counts: TeacherDashboard["counts"];
  isLoading: boolean;
}) {
  const suffix = scope === "escola" ? "em toda a escola" : "nas suas disciplinas";

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((k) => (
          <Skeleton key={k.key} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {KPIS.map((k) => {
        const value = counts[k.key];
        const danger = k.alarm && value > 0;
        return (
          <a
            key={k.key}
            href={`#card-${k.key}`}
            className={cn(
              "rounded-md border border-t-2 border-border/70 bg-card/70 p-4 shadow-soft transition-colors",
              danger ? "border-t-destructive" : "border-t-accent",
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {k.label}
            </p>
            <p className="mt-2 font-display text-2xl font-semibold text-foreground">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{suffix}</p>
          </a>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: `cards.tsx`**

```tsx
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarClock,
  CalendarRange,
  ClipboardCheck,
  ListChecks,
  MessageCircle,
  PackageOpen,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { TeacherDashboard } from "@/functions/teacherDashboard";

import { DashboardCard } from "./DashboardCard";

const ITEM_CLASS =
  "flex animate-in items-start gap-2.5 rounded-md border border-border/70 bg-card/70 p-3 shadow-soft fade-in slide-in-from-top-1 duration-200 transition-colors hover:border-primary/50";

function fmtDate(iso: string): string {
  return format(new Date(`${iso}T00:00:00`), "dd/MM", { locale: ptBR });
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function DashboardCards({
  data,
  isLoading,
}: {
  data: TeacherDashboard | undefined;
  isLoading: boolean;
}) {
  const d = data;
  return (
    <>
      <div id="card-pendingGrading">
        <DashboardCard
          title="Correções pendentes"
          icon={ClipboardCheck}
          isLoading={isLoading}
          isEmpty={!d || d.pendingGrading.length === 0}
          emptyLabel="Nenhuma entrega aguardando correção."
        >
          {d?.pendingGrading.map((item) => (
            <Link
              key={item.assignmentId}
              to="/painel/tarefas/$assignmentId"
              params={{ assignmentId: item.assignmentId }}
              className={ITEM_CLASS}
            >
              <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {item.title}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {item.disciplineName}
                  <Badge variant="outline" className="text-[10px]">
                    {item.awaitingCount}{" "}
                    {item.awaitingCount === 1 ? "entrega" : "entregas"}
                  </Badge>
                </span>
              </span>
            </Link>
          ))}
        </DashboardCard>
      </div>

      <div id="card-lessonsWithoutAttendance">
        <DashboardCard
          title="Notas e frequência a lançar"
          icon={ListChecks}
          isLoading={isLoading}
          isEmpty={!d || (d.missingGrades.length === 0 && d.missingAttendance.length === 0)}
          emptyLabel="Notas e chamada em dia."
        >
          {d?.missingAttendance.map((item) => (
            <Link
              key={`att-${item.disciplineId}`}
              to="/painel/disciplinas/$disciplineId"
              params={{ disciplineId: item.disciplineId }}
              className={ITEM_CLASS}
            >
              <CalendarRange className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {item.disciplineName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.lessonsWithoutAttendance}{" "}
                  {item.lessonsWithoutAttendance === 1 ? "aula sem chamada" : "aulas sem chamada"}
                </span>
              </span>
            </Link>
          ))}
          {d?.missingGrades.map((item) => (
            <Link
              key={`grade-${item.assessmentId}`}
              to="/painel/disciplinas/$disciplineId"
              params={{ disciplineId: item.disciplineId }}
              className={ITEM_CLASS}
            >
              <ListChecks className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {item.title}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {item.disciplineName}
                  <Badge variant="outline" className="text-[10px]">
                    {item.studentsMissing} sem nota
                  </Badge>
                </span>
              </span>
            </Link>
          ))}
        </DashboardCard>
      </div>

      <div id="card-materialGaps">
        <DashboardCard
          title="Materiais faltando"
          icon={PackageOpen}
          isLoading={isLoading}
          isEmpty={!d || d.materialGaps.length === 0}
          emptyLabel="Materiais em dia nas disciplinas em andamento."
        >
          {d?.materialGaps.map((item) => (
            <Link
              key={item.disciplineId}
              to="/painel/disciplinas/$disciplineId"
              params={{ disciplineId: item.disciplineId }}
              className={ITEM_CLASS}
            >
              <PackageOpen className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {item.disciplineName}
                </span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {item.missingApostila ? (
                    <Badge variant="outline" className="text-[10px]">
                      sem apostila
                    </Badge>
                  ) : null}
                  {item.missingVideos ? (
                    <Badge variant="outline" className="text-[10px]">
                      sem vídeo-aulas
                    </Badge>
                  ) : null}
                  {!item.missingApostila && item.apostilaDeficit >= 1 ? (
                    <span>
                      {item.lessonsGiven} aulas dadas · {item.apostilaCount} apostilas
                    </span>
                  ) : null}
                </span>
              </span>
            </Link>
          ))}
        </DashboardCard>
      </div>

      <div id="card-endingDisciplines">
        <DashboardCard
          title="Disciplinas encerrando"
          icon={CalendarClock}
          isLoading={isLoading}
          isEmpty={!d || d.endingDisciplines.length === 0}
          emptyLabel="Nenhuma disciplina na reta final."
        >
          {d?.endingDisciplines.map((item) => (
            <Link
              key={item.disciplineId}
              to="/painel/disciplinas/$disciplineId"
              params={{ disciplineId: item.disciplineId }}
              className={ITEM_CLASS}
            >
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {item.disciplineName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.lessonsGiven}/{item.lessonsPlanned} aulas
                </span>
              </span>
            </Link>
          ))}
        </DashboardCard>
      </div>

      <div id="card-forum">
        <DashboardCard
          title="Fórum em atividade"
          icon={MessageCircle}
          viewAll={{ to: "/painel/forum" }}
          isLoading={isLoading}
          isEmpty={!d || d.forum.length === 0}
          emptyLabel="Nenhuma conversa recente."
        >
          {d?.forum.map((item) => (
            <Link
              key={item.threadId}
              to="/painel/forum/$threadId"
              params={{ threadId: item.threadId }}
              className={ITEM_CLASS}
            >
              <MessageCircle className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {item.title}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {item.disciplineName}
                  {item.awaitingTeacherReply ? (
                    <Badge variant="outline" className="border-destructive/40 text-[10px] text-destructive">
                      aguardando resposta
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      {item.postCount} {item.postCount === 1 ? "resposta" : "respostas"}
                    </Badge>
                  )}
                </span>
              </span>
            </Link>
          ))}
        </DashboardCard>
      </div>

      <div id="card-upcomingLessons">
        <DashboardCard
          title="Próximas aulas"
          icon={CalendarRange}
          isLoading={isLoading}
          isEmpty={!d || d.upcomingLessons.length === 0}
          emptyLabel="Nenhuma aula agendada à frente."
        >
          {d?.upcomingLessons.map((item) => (
            <Link
              key={`${item.disciplineId}-${item.sequence}`}
              to="/painel/disciplinas/$disciplineId"
              params={{ disciplineId: item.disciplineId }}
              className={ITEM_CLASS}
            >
              <CalendarRange className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {item.disciplineName}
                </span>
                <span className="text-xs text-muted-foreground">
                  Aula {item.sequence} · {fmtDate(item.date)}
                </span>
              </span>
            </Link>
          ))}
        </DashboardCard>
      </div>

      <div id="card-atRiskStudents">
        <DashboardCard
          title="Alunos em risco"
          icon={AlertTriangle}
          viewAll={{ to: "/painel/relatorio" }}
          isLoading={isLoading}
          isEmpty={!d || d.atRiskStudents.length === 0}
          emptyLabel="Nenhum aluno abaixo do mínimo."
        >
          {d?.atRiskStudents.map((item) => (
            <Link key={item.studentId} to="/painel/relatorio" className={ITEM_CLASS}>
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {item.studentName}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.disciplines
                    .map((x) =>
                      x.reason === "ambos"
                        ? `${x.disciplineName} (nota e frequência)`
                        : x.reason === "media"
                          ? `${x.disciplineName} (nota)`
                          : `${x.disciplineName} (frequência)`,
                    )
                    .join(" · ")}
                </span>
              </span>
            </Link>
          ))}
        </DashboardCard>
      </div>
    </>
  );
}
```

Nota: `fmtDateTime` pode acabar não sendo usado — se o lint acusar, remover. Deixado apenas se necessário para datas de fórum; a versão acima não usa data no fórum, então **remover `fmtDateTime` antes do commit** se não houver uso.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros. Conferir os nomes de rota (`to="/painel/tarefas/$assignmentId"`, `"/painel/forum"`, `"/painel/forum/$threadId"`, `"/painel/disciplinas/$disciplineId"`, `"/painel/relatorio"`) contra `src/routeTree.gen.ts`; todos já existem.

- [ ] **Step 5: Commit**

```bash
git add src/pages/painel/dashboard/
git commit -m "$(cat <<'EOF'
Componentes do dashboard do professor

DashboardCard genérico, KpiStrip e os 7 cartões de sinais.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Integrar na `PainelHome`

**Files:**
- Modify: `src/pages/painel/PainelHome.tsx`

**Interfaces:**
- Consumes: `getTeacherDashboardFn` de `@/functions/teacherDashboard`; `KpiStrip`, `DashboardCards` de `@/pages/painel/dashboard/*`; tudo que a `PainelHome` já importa.

- [ ] **Step 1: Reescrever o componente**

Substituir o conteúdo de `src/pages/painel/PainelHome.tsx` por:

```tsx
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpen, GraduationCap, Users } from "lucide-react";

import { NotificationToggle } from "@/components/NotificationToggle";
import { PainelShell } from "@/components/painel/PainelShell";
import { Skeleton } from "@/components/ui/skeleton";
import { getTeacherDashboardFn } from "@/functions/teacherDashboard";
import { listMyDisciplinesFn } from "@/functions/disciplines";
import { DashboardCards } from "@/pages/painel/dashboard/cards";
import { KpiStrip } from "@/pages/painel/dashboard/KpiStrip";

const shortcuts = [
  {
    to: "/painel/professores",
    icon: Users,
    title: "Contas de professores",
    description: "Criar, editar e definir senha de acesso dos professores.",
  },
  {
    to: "/painel/alunos",
    icon: GraduationCap,
    title: "Alunos",
    description: "Cadastrar e gerenciar os alunos do seminário.",
  },
] as const;

/** Landing do painel interno — dashboard de pendências + atalhos + disciplinas do professor. */
export function PainelHome() {
  const { data: dashboard, isLoading: loadingDashboard } = useQuery({
    queryKey: ["teacher-dashboard"],
    queryFn: () => getTeacherDashboardFn(),
  });
  const { data: disciplines, isLoading } = useQuery({
    queryKey: ["my-disciplines"],
    queryFn: () => listMyDisciplinesFn(),
  });

  const allClear =
    !loadingDashboard &&
    dashboard !== undefined &&
    dashboard.counts.pendingGrading === 0 &&
    dashboard.counts.endingDisciplines === 0 &&
    dashboard.counts.atRiskStudents === 0 &&
    dashboard.counts.lessonsWithoutAttendance === 0 &&
    dashboard.materialGaps.length === 0 &&
    dashboard.pendingGrading.length === 0 &&
    dashboard.missingGrades.length === 0 &&
    dashboard.missingAttendance.length === 0 &&
    dashboard.endingDisciplines.length === 0 &&
    dashboard.forum.length === 0 &&
    dashboard.upcomingLessons.length === 0 &&
    dashboard.atRiskStudents.length === 0;

  return (
    <PainelShell
      title="Painel do professor"
      description="O que precisa da sua atenção agora: correções, notas, chamada, materiais e fórum."
    >
      <div className="mb-4">
        <NotificationToggle />
      </div>

      <KpiStrip
        scope={dashboard?.scope ?? "minhas"}
        counts={
          dashboard?.counts ?? {
            pendingGrading: 0,
            endingDisciplines: 0,
            atRiskStudents: 0,
            lessonsWithoutAttendance: 0,
          }
        }
        isLoading={loadingDashboard}
      />

      {allClear ? (
        <p className="mt-8 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-6 text-center text-sm text-muted-foreground shadow-soft">
          Nenhuma pendência — tudo em dia.
        </p>
      ) : (
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <DashboardCards data={dashboard} isLoading={loadingDashboard} />
        </div>
      )}

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {shortcuts.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-start gap-3 rounded-lg border border-t-2 border-border/70 border-t-accent bg-card/70 p-5 shadow-soft transition-colors hover:border-primary/50"
          >
            <item.icon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
            <span>
              <span className="block font-display text-base font-semibold text-foreground">
                {item.title}
              </span>
              <span className="block text-sm text-muted-foreground">{item.description}</span>
            </span>
          </Link>
        ))}
      </div>

      <h2 className="mt-10 font-display text-xl font-semibold tracking-tight text-foreground">
        Minhas disciplinas
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Lance notas e faltas nas disciplinas que você ministra.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="flex items-start gap-3 rounded-md border border-t-2 border-border/70 border-t-border bg-card/70 p-4 shadow-soft"
            >
              <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))
        ) : disciplines && disciplines.length > 0 ? (
          disciplines.map((discipline) => (
            <Link
              key={discipline.id}
              to="/painel/disciplinas/$disciplineId"
              params={{ disciplineId: discipline.id }}
              className="flex items-start gap-3 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-4 shadow-soft transition-colors animate-in fade-in slide-in-from-top-1 duration-200 hover:border-primary/50"
            >
              <BookOpen className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">
                  {discipline.discipline}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {discipline.module} · {discipline.term}
                </span>
              </span>
            </Link>
          ))
        ) : (
          <p className="text-muted-foreground">
            Nenhuma disciplina atribuída a você ainda — peça para outro professor te vincular em
            "Contas de professores" ou verifique se seu login está associado à disciplina certa.
          </p>
        )}
      </div>
    </PainelShell>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 3: Rodar toda a suíte de testes**

Run: `npm test`
Expected: PASS (nenhuma regressão; os testes da Task 1 continuam verdes).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build conclui sem erro.

- [ ] **Step 5: Commit**

```bash
git add src/pages/painel/PainelHome.tsx
git commit -m "$(cat <<'EOF'
PainelHome vira dashboard do professor

Faixa de KPIs + grid de cartões (correções, notas/chamada, materiais,
disciplinas encerrando, fórum, próximas aulas, alunos em risco), com bloco
"tudo em dia" quando não há pendências. Atalhos e "Minhas disciplinas"
mantidos.

Closes #22

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**1. Cobertura do spec:**
- Materiais faltando (sinais 1+2) → Task 1 `pickMaterialGaps`, Task 3 cartão "Materiais faltando". ✔
- Correções pendentes (sinal 2) → `pickPendingGrading` + cartão. ✔
- Notas não lançadas (sinal 3) → `pickMissingGrades` + cartão "Notas e frequência a lançar". ✔
- Frequência não lançada (sinal 4) → `pickMissingAttendance` + mesmo cartão. ✔
- Disciplinas encerrando (sinal 5) → `pickEndingDisciplines` + cartão. ✔
- Fórum (sinal 6) → `pickForumActivity` + cartão com "aguardando resposta". ✔
- Próximas aulas (sinal 7) → `pickUpcomingLessons` + cartão. ✔
- Alunos em risco (sinal 8) → `pickAtRiskStudents` + cartão. ✔
- Faixa de KPIs (sinal 9) → `buildTeacherDashboard.counts` + `KpiStrip` com rótulo por escopo e realce destructive. ✔
- Escopo admin vs professor → Task 2 (`isAdmin` decide filtro + `scope`). ✔
- Layout: `NotificationToggle` + `KpiStrip` + grid `lg:grid-cols-3` + "Minhas disciplinas" intacta + bloco "tudo em dia". ✔
- Constantes reaproveitadas / novas → Task 1 Global Constraints. ✔
- Testes conforme a lista do spec → Task 1 Step 1 cobre progress 0.8/0.79/≥1, denominador fallback, `lessonsPlanned===0`, apostilaDeficit, exclusão de encerrada/não iniciada, `submittedAt/gradedAt`, studentIds distintos, aula futura/ com attendance, frequência 0.75 estrita, aluno sem nota, `reason` "ambos", contagem distinta antes do corte, último post de aluno, ordenação, `FORUM_ITEMS_LIMIT`. ✔

**2. Placeholder scan:** Sem "TBD"/"TODO". Código completo em todos os steps. Dois pontos de "remover se o lint acusar" (`isNotNull` na Task 2, `fmtDateTime` na Task 3) são instruções concretas, não placeholders.

**3. Consistência de tipos:** `DashboardInput`, `TeacherDashboard` e filhos definidos na Task 1 e reexportados na Task 2; Tasks 3 e 4 consomem `TeacherDashboard` de `@/functions/teacherDashboard`. Assinaturas dos helpers idênticas entre o bloco Interfaces e a implementação. `pickPendingGrading`/`pickMissingAttendance`/`pickAtRiskStudents` retornam `{ items, total }`; `buildTeacherDashboard` usa `.items`/`.total` — consistente. IDs de âncora do `KpiStrip` (`#card-pendingGrading`, `#card-lessonsWithoutAttendance`, `#card-atRiskStudents`) batem com os `id=` das `<div>` na Task 3; `endingDisciplines` também (`#card-endingDisciplines`). Nota: o KPI `endingDisciplines` não tem `alarm`, âncora aponta para `#card-endingDisciplines` que existe. ✔
