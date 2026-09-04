# Dashboard do professor — design

Data: 2026-08-28
Status: aprovado para plano

## Problema

A home do painel interno (`/painel`, [src/pages/painel/PainelHome.tsx](../../../src/pages/painel/PainelHome.tsx))
hoje só mostra dois atalhos e a lista "Minhas disciplinas". Nenhum sinal
acionável: o professor não vê o que está pendente (correções, notas, chamada),
quais disciplinas estão acabando, nem a atividade do fórum sem entrar
disciplina por disciplina.

O portal do aluno ([src/pages/portal/PortalHome.tsx](../../../src/pages/portal/PortalHome.tsx))
já tem um dashboard rico (faixa de KPIs + cartões "Próximas tarefas", "Provas
agendadas", "Fórum em atividade"). Este trabalho leva o mesmo padrão para o
lado do professor.

## Objetivo

Reescrever a `PainelHome` como um dashboard: uma faixa de números no topo e um
grid de cartões com pendências e atividade, cada cartão linkando para a tela
onde a ação é resolvida. Manter a lista "Minhas disciplinas" e o
`NotificationToggle` que já existem.

## Não-objetivos

- Nenhuma mudança de schema. Todos os sinais saem das tabelas atuais.
- Nenhum modelo novo de "materiais esperados" / cronograma de aula↔material.
- Nenhuma tela nova de rota — só a `/painel` muda. Cartões linkam para telas
  existentes.
- Nenhuma preferência/configuração de limites por usuário — limites são
  constantes no código.

## Contexto do código

- **Stack:** TanStack Start + React 19, Drizzle (Neon Postgres), TanStack
  Query, Tailwind v4, shadcn/ui, lucide-react, date-fns.
- **Auth:** `createServerFn` + guards em [src/server/auth/guard.ts](../../../src/server/auth/guard.ts)
  (`requireTeacherId`, `requireAdminId`). Papéis: `admin` (vê tudo) e
  `teacher` (vê só as próprias disciplinas via `disciplines.teacherId`).
  `getCurrentTeacherFn` ([src/functions/auth.ts](../../../src/functions/auth.ts))
  devolve `{ id, name, email, role, mustChangePassword }`.
- **Sem matrícula:** não há vínculo aluno↔disciplina. "A turma" de qualquer
  disciplina = todos os `students` com `active = true` (mesma regra usada em
  [src/functions/reportData.ts](../../../src/functions/reportData.ts),
  `getAssignmentSubmissionsFn`, `getExamResultsFn`).
- **"Aula dada":** `lessons.date` não nulo e `<= hoje` (ISO `YYYY-MM-DD`),
  igual a `reportData.ts`. Datas futuras já vêm cadastradas em lote.
- **Provas auto-corrigem:** `submitExamAttemptFn` chama `finalizeExamAttempt`,
  que grava `examAttempts.score` no envio. `score` nulo ⇒ tentativa em
  andamento, não "aguardando correção". Logo, correção pendente é só de
  **tarefas**.
- **Tarefas:** `assignmentSubmissions` com `submittedAt` preenchido e
  `gradedAt` nulo = entrega aguardando correção. `assignments.assessmentId`
  liga à aba Notas.
- **Notas manuais:** `grades` (por `assessment` × `student`). Nota lançada por
  tarefa/prova faz upsert automático; avaliação manual é preenchida na
  `GradesTab`.
- **Fórum:** `forumThreads` / `forumPosts` por disciplina.
  `listRecentForumThreadsFn` já tem a lógica de "última atividade" para o
  portal — este trabalho refaz filtrando pelas disciplinas do professor.
- **Motion:** ver [MOTION.md](../../../MOTION.md). Lente Emil no painel:
  `animate-in fade-in slide-in-from-top-1 duration-200` para itens que
  aparecem; `<Skeleton>` com a forma do conteúdo no loading (nunca spinner
  central); `prefers-reduced-motion` já tratado global em `src/styles.css`.
- **Padrão de consulta:** cargas em lote com `inArray` (ver `reportData.ts`),
  nunca N+1 por disciplina.
- **Constantes existentes:** `PASSING_AVERAGE = 7`
  ([src/lib/grades.ts](../../../src/lib/grades.ts), com
  `computeWeightedAverage`), `MINIMUM_ATTENDANCE_RATIO = 0.75`
  ([src/lib/attendance.ts](../../../src/lib/attendance.ts), com `countFaltas`).

## Arquitetura

Abordagem escolhida: **um endpoint, payload completo**. Uma server function
`getTeacherDashboardFn` faz auth, decide o escopo, carrega tudo em lote, chama
helpers puros e devolve um único payload. A `PainelHome` consome com um
`useQuery` só. Alternativa considerada (um endpoint por cartão, como a
PortalHome) foi descartada: os cartões aqui compartilham a mesma base cara
(minhas disciplinas → aulas, avaliações, entregas, alunos), e recomputá-la 6×
custa mais que o ganho de granularidade; um snapshot único evita cartões de
momentos diferentes.

### Arquivos

**Novos:**

| Arquivo | Papel |
|---|---|
| `src/lib/teacherDashboard.ts` | Helpers **puros** (sem import de `@/server/*`) + constantes + tipos dos sinais. Recebem linhas já carregadas, devolvem os sinais. |
| `src/lib/teacherDashboard.test.ts` | Testes unitários de cada helper (Vitest). |
| `src/functions/teacherDashboard.ts` | `getTeacherDashboardFn` (`createServerFn` GET). Auth + escopo + cargas em lote + chamada dos helpers + montagem do payload. Exporta os tipos do payload. |
| `src/pages/painel/dashboard/DashboardCard.tsx` | Cartão genérico: título + ícone + "Ver tudo" opcional + skeleton + estado vazio. |
| `src/pages/painel/dashboard/KpiStrip.tsx` | Faixa de 4 números. |
| `src/pages/painel/dashboard/cards.tsx` | Os cartões concretos (um componente por sinal), consumindo o payload já carregado. |

**Alterados:**

| Arquivo | Mudança |
|---|---|
| `src/pages/painel/PainelHome.tsx` | Reescrito: um `useQuery(["teacher-dashboard"])`, renderiza `KpiStrip` + grid de cartões + "Minhas disciplinas" (intacta) + `NotificationToggle` (intacto). |

### Fluxo de dados

1. `PainelHome` monta → `useQuery(["teacher-dashboard"], getTeacherDashboardFn)`.
2. `getTeacherDashboardFn`:
   a. `requireTeacherId()`; carrega o próprio `teacher` para saber o `role`.
   b. **Escopo:** `role === "admin"` ⇒ todas as `disciplines`;
      senão ⇒ `disciplines` com `teacherId = eu`. Guarda `scope: "escola" | "minhas"`.
   c. Uma carga em lote por tabela filha, sempre com `inArray(disciplineIds)`:
      `lessons`, `attendance` (das aulas dadas), `readingMaterials`,
      `videoLessons`, `assessments`, `grades` (dos assessments),
      `assignments` + `assignmentSubmissions`, `exams`,
      `forumThreads` + `forumPosts`, e `students` ativos (uma vez).
   d. Passa as linhas para os helpers de `src/lib/teacherDashboard.ts`.
   e. Monta e devolve `TeacherDashboard` (abaixo).
3. `PainelHome` renderiza a partir do payload. Um skeleton só enquanto carrega.

### Tipo do payload (forma alvo — nomes finais no plano)

```ts
type TeacherDashboard = {
  scope: "minhas" | "escola";
  counts: {
    pendingGrading: number;      // Σ entregas de tarefa aguardando correção
    endingDisciplines: number;
    atRiskStudents: number;
    lessonsWithoutAttendance: number;
  };
  materialGaps: Array<{
    disciplineId: string; disciplineName: string;
    missingApostila: boolean; missingVideos: boolean;
    lessonsGiven: number; apostilaCount: number;   // p/ "aulas dadas sem material"
    apostilaDeficit: number;                        // max(0, lessonsGiven - apostilaCount)
  }>;
  pendingGrading: Array<{
    assignmentId: string; title: string; disciplineName: string;
    awaitingCount: number; oldestSubmittedAt: string;
  }>;
  missingGrades: Array<{
    assessmentId: string; disciplineId: string; title: string;
    disciplineName: string; studentsMissing: number;
  }>;
  missingAttendance: Array<{
    disciplineId: string; disciplineName: string; lessonsWithoutAttendance: number;
  }>;
  endingDisciplines: Array<{
    disciplineId: string; disciplineName: string;
    lessonsGiven: number; lessonsPlanned: number; progress: number; // 0..1
  }>;
  forum: Array<{
    threadId: string; disciplineName: string; title: string;
    lastActivityAt: string; postCount: number; awaitingTeacherReply: boolean;
  }>;
  upcomingLessons: Array<{
    disciplineId: string; disciplineName: string; date: string; sequence: number;
  }>;
  atRiskStudents: Array<{
    studentId: string; studentName: string;
    disciplines: Array<{ disciplineName: string; reason: "media" | "frequencia" | "ambos" }>;
  }>;
};
```

## Definição dos sinais

Escopo por papel conforme acima. "Alunos" = `students.active = true`.
"Aula dada" = `lessons.date` não nulo e `<= hoje`.

### 1. Materiais faltando (`materialGaps`)
Para cada disciplina **iniciada** (≥1 aula dada) e **não encerrada**
(`progress < 1`, ver sinal 5):
- `missingApostila` = `count(readingMaterials da disciplina) === 0`.
- `missingVideos` = `count(videoLessons da disciplina) === 0`.
- `apostilaDeficit` = `max(0, lessonsGiven - count(readingMaterials))`.

Entra na lista se `missingApostila || missingVideos || apostilaDeficit >= 1`.
No cartão: nome + tags do que falta ("sem apostila", "sem vídeo-aulas"), e
quando `apostilaDeficit >= 1`, a linha "N aulas dadas · M apostilas" deixando
claro que é comparação de contagem, não vínculo. Link → aba Apostila:
`/painel/disciplinas/$disciplineId`.

### 2. Correções pendentes (`pendingGrading`)
Só tarefas. `assignmentSubmissions` com `submittedAt` não nulo e `gradedAt`
nulo, de `assignments` das disciplinas do escopo. Agrupa por tarefa:
`{ title, disciplineName, awaitingCount, oldestSubmittedAt }`. Ordena por
`oldestSubmittedAt` asc (mais antigas primeiro). `counts.pendingGrading` =
soma de `awaitingCount`. Link → `/painel/tarefas/$assignmentId`.

### 3. Notas não lançadas (`missingGrades`)
Para cada `assessment` das disciplinas do escopo:
`studentsMissing = nº alunos ativos - nº grades distintos por studentId`.
Lista os assessments com `studentsMissing >= 1`:
`{ title, disciplineName, studentsMissing }`. Link → aba Notas da disciplina.

### 4. Frequência não lançada (`missingAttendance`)
Aulas com `date <= hoje` que não têm **nenhuma** linha em `attendance`.
Agrupa por disciplina: `{ disciplineName, lessonsWithoutAttendance }`.
`counts.lessonsWithoutAttendance` = total dessas aulas. Link → aba Frequência.

### 5. Disciplinas encerrando (`endingDisciplines`)
`lessonsPlanned` = `disciplines.lessons` se não nulo, senão
`count(lessons da disciplina)`. `lessonsGiven` = nº de aulas dadas.
`progress = lessonsPlanned > 0 ? lessonsGiven / lessonsPlanned : 0`.
Entra se `ENDING_PROGRESS_RATIO <= progress < 1` (0.8 ≤ progress < 1).
`progress >= 1` conta como **encerrada** (exclui de "materiais faltando" e
"alunos em risco"). Ordena por `progress` desc. Item: "Disciplina X — 9/10
aulas". Link → `/painel/disciplinas/$disciplineId`.

### 6. Fórum em atividade (`forum`)
Threads das disciplinas do escopo. `lastActivityAt` = max entre
`thread.createdAt` e o `createdAt` do último post (mesma lógica de
`listRecentForumThreadsFn`). `awaitingTeacherReply` = o **último** post da
thread tem `authorRole === "student"` (nenhum professor respondeu depois).
Ordena: `awaitingTeacherReply` primeiro, depois `lastActivityAt` desc. Até
`FORUM_ITEMS_LIMIT` (8). Link → `/painel/forum/$threadId`.

### 7. Próximas aulas (`upcomingLessons`)
`lessons` das disciplinas do escopo com `date > hoje`, ordenadas por `date`
asc, até `UPCOMING_LESSONS_LIMIT` (5). Item: disciplina + data (`dd/MM`).
Link → aba Frequência: `/painel/disciplinas/$disciplineId`.

### 8. Alunos em risco (`atRiskStudents`)
Por disciplina **iniciada e não encerrada**, para cada aluno ativo:
- média ponderada via `computeWeightedAverage` (só com ≥1 nota lançada);
  em risco de `media` se `média < PASSING_AVERAGE`.
- frequência = `(aulasDadas - faltas) / aulasDadas` via `countFaltas` (só com
  ≥1 aula dada); em risco de `frequencia` se `< MINIMUM_ATTENDANCE_RATIO`
  (comparação **estrita** — exatamente 0.75 não é risco).
- `reason` = `"ambos"` se os dois, senão o que se aplicar.

Agrupa por aluno com a lista de disciplinas problemáticas. Ordena por nº de
disciplinas em risco desc. Até `AT_RISK_LIMIT` (8). `counts.atRiskStudents` =
nº de alunos distintos em risco (antes do corte de 8). Link →
`/painel/relatorio` (boletim do aluno).

### 9. Faixa de KPIs (`counts`)
Quatro números, cada um linkando para o cartão correspondente:
**Correções pendentes** · **Disciplinas encerrando** · **Alunos em risco** ·
**Aulas sem chamada**. Rótulo: `scope === "escola"` ⇒ "em toda a escola";
senão ⇒ "nas suas disciplinas". Borda superior `border-t-destructive` quando
o número > 0 em correções, risco e chamada; "encerrando" fica sempre
`border-t-accent`.

## Constantes (`src/lib/teacherDashboard.ts`)

```ts
export const ENDING_PROGRESS_RATIO = 0.8;
export const UPCOMING_LESSONS_LIMIT = 5;
export const FORUM_ITEMS_LIMIT = 8;
export const AT_RISK_LIMIT = 8;
```

Reusa `PASSING_AVERAGE` de `@/lib/grades` e `MINIMUM_ATTENDANCE_RATIO` de
`@/lib/attendance` — não redefine.

## Layout (`PainelHome`)

`PainelShell` (título "Painel do professor", descrição ajustada) →
`NotificationToggle` (mantido) → `KpiStrip` (grid `sm:grid-cols-2
lg:grid-cols-4`, stat cards no estilo da PortalHome: `rounded-md border
border-t-2 border-border/70 bg-card/70 p-4 shadow-soft`, número
`font-display text-2xl font-semibold`) → grid de cartões (`gap-4
lg:grid-cols-3`) na ordem: Correções pendentes, Notas e frequência a lançar
(funde sinais 3+4), Materiais faltando (funde 1+2), Disciplinas encerrando,
Fórum em atividade, Próximas aulas, Alunos em risco → `<h2>` "Minhas
disciplinas" + lista atual (código intacto).

`DashboardCard`: header com ícone lucide + título + link "Ver tudo" opcional;
corpo com `space-y-2`; no loading, 2× `<Skeleton className="h-16 w-full">`;
vazio ⇒ frase muted "Tudo em dia por aqui." Itens de lista entram com
`animate-in fade-in slide-in-from-top-1 duration-200`.

Se **todos** os cartões estiverem vazios e todos os `counts` forem 0, no lugar
do grid renderiza um único bloco "Nenhuma pendência — tudo em dia."

Ícones sugeridos: `ClipboardCheck` (correções), `ListChecks` (notas/chamada),
`PackageOpen` (materiais), `CalendarClock` (encerrando), `MessageCircle`
(fórum), `CalendarRange` (próximas aulas), `AlertTriangle` (risco).

## Testes

`src/lib/teacherDashboard.test.ts` (Vitest, `environment: node`, fixtures de
objetos puros — padrão de `src/lib/schedule-utils.test.ts`). Um `describe` por
helper. Casos mínimos:

- **progress/encerrando:** `progress` exatamente 0.8 entra; 0.79 não;
  `>= 1` não entra e marca encerrada; `disciplines.lessons` nulo ⇒ denominador
  = total de `lessons`; `lessonsPlanned === 0` ⇒ `progress = 0`.
- **materiais:** disciplina sem apostila e sem vídeo aparece com as duas tags;
  `apostilaDeficit = max(0, dadas - apostilas)`; disciplina encerrada e
  disciplina não iniciada não aparecem.
- **correções:** só conta `submittedAt != null && gradedAt == null`; ordena
  por `oldestSubmittedAt`; soma bate com `counts.pendingGrading`.
- **notas faltando:** `studentsMissing` conta studentIds distintos; assessment
  com todos com nota não aparece.
- **frequência faltando:** aula futura não conta; aula dada com ≥1 linha de
  attendance não conta.
- **risco:** frequência exatamente 0.75 não é risco (`<` estrito); aluno sem
  nenhuma nota não entra por média; `reason` "ambos" quando média e
  frequência; `counts.atRiskStudents` conta alunos distintos antes do corte.
- **fórum:** último post de aluno ⇒ `awaitingTeacherReply = true`; ordenação
  põe os aguardando na frente; respeita `FORUM_ITEMS_LIMIT`.

A server function `getTeacherDashboardFn` não recebe teste de DB (padrão do
repo — `reportData.ts` não tem). Fica como orquestrador fino.

Verificação: `npm test`, `npm run lint`, `npm run build`.

## Riscos / decisões abertas

- **Custo da consulta:** com escopo admin, carrega todas as disciplinas e
  todos os alunos ativos. É um seminário pequeno (dezenas de alunos), e as
  cargas são em lote com `inArray` — aceitável. Se crescer, dá para paginar
  ou cachear depois.
- **"Aulas dadas sem material" é heurística** (1 apostila por aula). O texto
  do cartão deixa isso explícito; não gera alarme falso silencioso.
- **`counts.pendingGrading` conta entregas, não tarefas** — coerente com o
  rótulo "Correções pendentes" (o professor pensa em nº de trabalhos a
  corrigir).
