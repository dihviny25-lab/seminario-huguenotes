# Visão de admin sobre disciplinas de outros professores — Design

## Contexto e objetivo

Hoje, um professor com `role = "admin"` só enxerga o conteúdo (apostilas, slides,
vídeo-aulas, notas, frequência, provas, tarefas) das disciplinas onde ele mesmo é
`disciplines.teacherId` — exatamente como um professor comum. Isso é intencional
(documentado em `src/functions/teacherDashboard.ts`), mas incompleto: admin já
consegue ver todos os professores (`/painel/contas-professores`), todas as
atribuições de disciplina↔professor (`/painel/atribuicoes`, via
`listTeachingAssignmentsFn`) e o boletim de qualquer aluno em todas as
disciplinas (`/painel/relatorio`, via `getStudentReportFn`) — mas não consegue
abrir a disciplina de outro professor e ver o que tem dentro dela, nem o
boletim da turma inteira daquela disciplina.

**Objetivo:** dar a qualquer professor `admin` acesso de **leitura** a todas as
abas de qualquer disciplina, mesmo quando não é o dono — sem nenhuma
capacidade de editar/criar/apagar conteúdo que não seja seu. Editar continua
exclusivo do dono, sem exceção para admin.

## Modelo de acesso

Hoje existem dois modos de acesso a uma disciplina, resolvidos por
`requireAttendanceDiscipline` (`src/server/auth/guard.ts`):

1. **Dono** (`discipline.teacherId === teacherId`) — gerencia tudo.
2. **Atribuição pontual** (professor tem ao menos uma aula com `teacherId`
   apontando pra ele, mas não é o dono) — só frequência daquela aula, sem
   acesso a material/nota/prova/tarefa (decisão já documentada no spec de
   dashboards, Fase 1).

Este design introduz um terceiro modo:

3. **Visão admin** — quando quem pede é `role = "admin"` e não é dono da
   disciplina (independente de ter ou não aula atribuída) — leitura de
   **todas** as abas, sem nenhuma ação de escrita.

Precedência quando mais de um se aplica: **dono sempre vence** (um admin que
também é o professor responsável continua no modo dono, com edição normal).
Abaixo disso, **admin vence atribuição pontual** — um admin com uma aula
avulsa atribuída numa disciplina que não é sua ganha a visão completa
(modo 3), não fica preso ao modo 2.

## Guards (`src/server/auth/guard.ts`)

**Novo:**

```typescript
/**
 * Libera leitura pra dono OU admin — usado pelas listagens de conteúdo
 * (apostila, slides, vídeos, notas, acompanhamento, boletim da turma).
 * Atribuição pontual de aula NÃO entra aqui (mesma regra de hoje: aula
 * avulsa não dá acesso a material/nota/prova).
 */
export async function requireOwnOrAdminDiscipline(disciplineId: string) {
  const teacherId = await requireTeacherId();
  const [discipline] = await db
    .select()
    .from(disciplines)
    .where(eq(disciplines.id, disciplineId))
    .limit(1);
  if (!discipline) throw new Error("Disciplina não encontrada.");
  if (discipline.teacherId === teacherId) return discipline;

  const [teacher] = await db
    .select({ role: teachers.role })
    .from(teachers)
    .where(eq(teachers.id, teacherId))
    .limit(1);
  if (teacher?.role === "admin") return discipline;

  throw new Error("Disciplina não encontrada.");
}
```

**Alterado:** `requireAttendanceDiscipline` ganha a mesma liberação de admin
(dono OU aula atribuída OU admin), já que frequência é o caso mais aberto
hoje e deve continuar sendo pelo menos tão aberto quanto os outros.

**Sem mudança:** `requireOwnDiscipline` (usado por toda mutação — criar,
editar, apagar) continua exigindo posse exata. Nenhuma função de escrita
muda de guard neste trabalho.

## Funções afetadas (troca de guard, sem mudar o formato do retorno)

| Função | Arquivo | Guard hoje | Guard novo |
|---|---|---|---|
| `listMyDisciplineMaterialsFn` | `src/functions/readingMaterials.ts` | `requireOwnDiscipline` | `requireOwnOrAdminDiscipline` |
| `listMyDisciplineSlidesFn` | `src/functions/presentationSlides.ts` | `requireOwnDiscipline` | `requireOwnOrAdminDiscipline` |
| `listMyDisciplineVideosFn` | `src/functions/videoLessons.ts` | `requireOwnDiscipline` | `requireOwnOrAdminDiscipline` |
| `getGradesBoardFn` | `src/functions/grades.ts` | `requireOwnDiscipline` | `requireOwnOrAdminDiscipline` |
| `getDisciplineOverviewFn` (aba Acompanhamento) | `src/functions/dashboard.ts` | `requireOwnDiscipline` | `requireOwnOrAdminDiscipline` |
| `getClassReportFn` (boletim da turma) | `src/functions/report.ts` | `requireOwnDiscipline` | `requireOwnOrAdminDiscipline` |
| `getAttendanceBoardFn` | `src/functions/attendance.ts` | `requireAttendanceDiscipline` | (mesma função, guard estendido) |

Todas as demais funções de criar/editar/apagar/lançar continuam com
`requireOwnDiscipline` ou `requireAssignedLesson`, inalteradas.

## `getMyDisciplineFn` — resolver o modo pro cliente

`src/functions/disciplines.ts`. Hoje devolve `canManageDiscipline: boolean`
(baseado só em posse). Passa a devolver um campo `access` que descreve o
modo, calculado assim:

```typescript
export const getMyDisciplineFn = createServerFn({ method: "GET" })
  .validator(disciplineIdSchema)
  .handler(async ({ data }) => {
    const { discipline, teacherId } = await requireAttendanceDiscipline(data.disciplineId);
    const isOwner = discipline.teacherId === teacherId;

    let access: "owner" | "assigned" | "admin" = "assigned";
    if (isOwner) {
      access = "owner";
    } else {
      const [teacher] = await db
        .select({ role: teachers.role })
        .from(teachers)
        .where(eq(teachers.id, teacherId))
        .limit(1);
      if (teacher?.role === "admin") access = "admin";
    }

    return {
      id: discipline.id,
      semester: discipline.semester,
      term: discipline.term,
      module: discipline.module,
      discipline: discipline.discipline,
      access,
    };
  });
```

`canManageDiscipline` sai do tipo de retorno — os dois lugares que o
consomem (`DisciplineDetail.tsx`, `AttendanceTab` via prop) passam a derivar
`isOwner = access === "owner"` e `showFullTabs = access !== "assigned"`.

## UI

**`src/pages/painel/DisciplineDetail.tsx`** — troca toda checagem
`discipline?.canManageDiscipline !== false` por
`discipline?.access !== "assigned"` (mostra as abas Acompanhamento, Notas,
Vídeos, Apostila, Slides pra `"owner"` e `"admin"`, só frequência pra
`"assigned"`, igual hoje). Cada aba passa a receber um prop novo:

```typescript
const canManage = discipline?.access === "owner";
```

**`ReadingMaterialsTab`, `SlidesTab`, `VideoLessonsTab`, `GradesTab`** — cada
uma ganha `canManage: boolean` na assinatura (hoje só recebem
`disciplineId`). Quando `false`: esconde o botão "Novo material"/"Novo
slide"/"Nova vídeo-aula"/edição de nota e os ícones de editar/apagar/
compartilhar em cada linha — a lista em si (dados) continua vindo da mesma
query, sem nenhuma mudança de layout além de esconder controles. Mesmo
padrão que `AttendanceTab` já usa com `canManageDiscipline` hoje — só
generalizado pro nome novo e pras outras quatro abas.

**`src/pages/painel/TeachingAssignments.tsx`** — cada linha de disciplina
ganha um link "Ver conteúdo" (ícone de olho, por exemplo) apontando pra
`/painel/disciplinas/$disciplineId` — a mesma rota que o professor dono já
usa. Não precisa de mudança de rota nem de novo componente de página; o
`access: "admin"` resolvido no servidor já entrega a visão certa.

## Erros e casos de borda

- Disciplina inexistente ou aluno tentando entrar (não é professor): mesma
  mensagem genérica de hoje, `"Disciplina não encontrada."` — não revela se
  a disciplina existe pra quem não tem nenhum vínculo com ela (mesmo padrão
  de privacidade já usado no resto do guard).
- Professor comum (não admin, não dono, sem aula atribuída) continua
  recebendo o erro de sempre — nenhuma regra fica mais aberta pra ele.
- Admin que é dono da própria disciplina: `access` resolve pra `"owner"`,
  comportamento idêntico ao atual, zero mudança percebida.

## Fora de escopo (decidido explicitamente)

- Admin **não** pode editar/criar/apagar conteúdo de disciplina alheia —
  só leitura, em nenhuma tela.
- Nenhuma tela nova é criada — reaproveita `DisciplineDetail.tsx` e as abas
  existentes, só com controles escondidos.
- Redesign visual da home do portal do aluno (discutido na mesma sessão,
  print de referência) é uma tarefa completamente separada, sem relação
  com este design — ver `[[project_portal_home_redesign_referencia]]` na
  memória do projeto.

## Critério de pronto

- Admin abre a disciplina de outro professor pela tela de Atribuições de
  ensino e vê todas as abas (Acompanhamento, Frequência, Notas, Vídeos,
  Apostila, Slides) com dados reais, sem nenhum botão de criar/editar/
  apagar/compartilhar visível.
- Professor comum (não admin) continua sem conseguir abrir disciplina que
  não é sua nem tem aula atribuída — mesmo erro de hoje.
- Admin que é dono de uma disciplina continua vendo o modo de edição normal
  nela (comportamento inalterado).
- `getClassReportFn` (boletim da turma) funciona pra admin em qualquer
  disciplina.
- `npm run typecheck`, `npm run lint`, `npm test` e `npm run build` passam.

## Riscos e observações

- Superfície de mudança é ampla em número de arquivos (7 funções de leitura
  + 4 componentes de aba + 1 guard novo + 1 guard estendido + a tela de
  atribuições), mas cada mudança individual é mecânica (trocar guard, ou
  esconder JSX condicionalmente) — baixo risco técnico por unidade, o
  cuidado principal é não esquecer nenhum dos 7 pontos de leitura na tabela
  acima.
- Testar manualmente logado como admin (numa disciplina alheia) e como
  professor comum (numa disciplina alheia, esperando continuar bloqueado) é
  essencial — é fácil a mudança de guard vazar mais do que deveria se um
  dos sete pontos for esquecido.
