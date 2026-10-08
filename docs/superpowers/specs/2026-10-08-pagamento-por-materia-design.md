# Pagamento por matéria (aluno avulso) — design

Data: 2026-10-08
Status: aprovado (sessão de brainstorming com o dono do produto)

## Contexto e motivação

Hoje o único jeito de cobrar um aluno pela mensalidade é via **modalidade fixa**
(`src/lib/paymentModalities.ts`: Outras Igrejas, Obreiros, IBV/Pastores) — um valor mensal
igual pra todas as disciplinas que o aluno estiver fazendo. Não existe tabela de matrícula
no schema: todo aluno `active = true` vê e participa de **todas** as disciplinas do
currículo, sem distinção.

Existe demanda por um aluno que não entra no programa completo, mas quer (ou tem permissão
negociada pra) acompanhar só **uma ou algumas disciplinas específicas**, pagando por cada
uma — "pagamento por matéria". A negociação do valor e de quais disciplinas é sempre feita
numa conversa prévia entre o aluno e a administração, fora do sistema; o aluno nunca escolhe
nem paga nada por autoatendimento. O papel do sistema é: (1) deixar o admin registrar essa
cobrança por disciplina e dar baixa nela do jeito que já dá baixa em qualquer cobrança
avulsa, e (2), a partir da baixa, liberar automaticamente o acesso àquela disciplina para
esse aluno — e só a ela.

## Objetivo

Um aluno pode ser marcado como **avulso** (paga por matéria, não por mensalidade de
programa). Para esse aluno, cada disciplina só fica visível no portal depois que uma
cobrança específica daquela disciplina for dada como paga. Aluno não-avulso continua
exatamente como hoje: vê tudo, sem nenhuma mudança de comportamento.

## Decisões

### 1. Acesso é derivado da cobrança, não uma tabela nova

Considerou-se uma tabela separada (`student_discipline_access`) pra registrar liberações.
Descartada: criaria um segundo estado pra manter sincronizado com o financeiro (o que
acontece se a cobrança for cancelada depois de já ter "liberado"? precisaria revogar nos
dois lugares).

**Decisão:** acesso é 100% derivado de `charges`. Um aluno avulso tem acesso à disciplina
`D` se, e só se, existir uma `charge` dele com `disciplineId = D` e `status = "paid"`. Dar
baixa manual (`markChargePaidManuallyFn`) libera; cancelar (`cancelChargeFn`) revoga —
**nenhuma das duas funções precisa mudar**, o efeito é automático porque a leitura do acesso
sempre olha o estado atual da cobrança.

### 2. Dois campos novos no schema

- `students.avulso: boolean notNull default(false)` — marca o aluno como "paga por
  matéria". Editável pelo admin na tela de edição do aluno, ao lado do campo de bolsa
  (`scholarshipPercent`).
- `charges.disciplineId: uuid references disciplines.id, onDelete: "set null"` (nullable) —
  paralelo ao `courseMaterialId` que já existe: presente só quando a cobrança é de acesso a
  uma disciplina; nulo pra mensalidade e avulsa comum.

Nenhuma tabela nova. `avulso` nasce `false` em todo aluno existente — comportamento atual
preservado por padrão, sem migração de dados.

### 3. Função de liberação espelha `assignMaterialToStudentFn`

Nova server function `chargeDisciplineAccessFn` em `src/functions/payments.ts` (mesmo
arquivo de `createChargeFn`/`generateMonthlyChargesFn` — é uma função de cobrança, não de
currículo), no mesmo padrão de
`assignMaterialToStudentFn` (`src/functions/materials.ts:112`):

- Entrada: `studentId`, `disciplineId`, `donate: boolean`, e (se não for cortesia) `amount`
  + `dueDate`.
- Valida que o aluno é `avulso` (erro claro se não for: cobrança por disciplina só faz
  sentido pra aluno avulso — aluno do programa já vê tudo).
- Cria a `charge` com `disciplineId` preenchido, `description` tipo
  `"Disciplina: <nome>"`, igual ao `"Material: <título>"` já usado. Se `donate`, nasce com
  `status: "paid"`, `paidAmount: "0"`, `paidManually: true`, `note: "Disciplina cedida"` —
  mesmo padrão de "material doado" e bolsa integral.
- Auditoria (`logAudit`) com uma ação nova, ex. `"financeiro.disciplina_cobrar"` /
  `"financeiro.disciplina_ceder"`.

Baixa e cancelamento continuam pelos fluxos existentes (`markChargePaidManuallyFn`,
`cancelChargeFn`) — essa cobrança não é um tipo novo de registro, é uma `charge` normal com
um campo extra preenchido.

### 4. Guard central + checagem em toda leitura por disciplina

Dois guards novos em `src/server/auth/guard.ts`, no mesmo padrão de `requireOwnDiscipline`
(que já existe pro professor):

- **`requireStudentDisciplineAccess(disciplineId)`** — chama `requireStudentId()`, busca
  `students.avulso`; se `false`, libera; se `true`, confirma que existe `charge` paga com
  esse `disciplineId` para esse aluno. Lança `"Disciplina não encontrada."` (mesma mensagem
  que o guard do professor usa) se não tiver acesso — não revela que a disciplina existe.
- **`getAccessibleDisciplineIds(studentId)`** — devolve `"all"` (aluno não-avulso) ou o
  `Set<string>` de IDs liberados (aluno avulso). Usado onde a tela agrega várias disciplinas
  de uma vez, em vez de buscar uma só.

Cobertura completa — toda função chamada pelo portal do aluno que lê algo amarrado a uma
`disciplineId` passa a checar um dos dois guards:

| Superfície | Arquivo | Guard |
|---|---|---|
| Lista "Minhas disciplinas" | `src/routes/portal/disciplinas/index.tsx` (via função que lista) | `getAccessibleDisciplineIds` |
| Detalhe de uma disciplina | `src/routes/portal/disciplinas/$disciplineId.tsx` | `requireStudentDisciplineAccess` |
| Vídeo-aulas | `src/functions/videoLessons.ts` | ambos (lista + item) |
| Apostilas | `src/functions/readingMaterials.ts` | ambos |
| Slides | `src/functions/presentationSlides.ts` | ambos |
| Tarefas | `src/functions/assignments.ts`, `assignmentSubmissions.ts` | ambos |
| Provas | `src/functions/exams.ts`, `examAttempts.ts` | ambos |
| Notas | `src/functions/grades.ts` | `getAccessibleDisciplineIds` |
| Frequência | `src/functions/attendance.ts` | `requireStudentDisciplineAccess` |
| Fórum por disciplina | funções de `forumThreads`/`forumPosts` | ambos |
| Anotações do aluno | `src/functions/studentNotes.ts` | `requireStudentDisciplineAccess` |
| Dashboard (próxima aula, vídeo novo) | `src/functions/dashboard.ts` | `getAccessibleDisciplineIds` |
| Feed de calendário (.ics) | `src/functions/calendarFeed.ts` | `getAccessibleDisciplineIds` |
| Relatório/boletim do aluno | `src/functions/report.ts` | `getAccessibleDisciplineIds` |

Fora dessa lista por não serem amarrados a disciplina (continuam exatamente como hoje, sem
checagem): mensalidades/financeiro do próprio aluno, biblioteca virtual (`libraryBooks`),
catálogo de materiais cobráveis (`courseMaterials`), reflexões espirituais
(`spiritualReflections`), discipulado, fórum de professores.

### 5. UX no painel e no portal

- **Painel (admin):** checkbox "Avulso (paga por matéria)" na edição do aluno. Em
  [Payments.tsx](src/pages/painel/Payments.tsx), nova ação "Liberar disciplina" ao lado de
  "Cobrança avulsa" e "Atribuir material" — só com sentido quando o aluno é avulso (demais
  casos, UI pode ocultar ou a função recusa com mensagem clara).
- **Portal (aluno avulso):** `/portal/disciplinas` só lista as disciplinas já liberadas —
  nenhum "bloqueado, fale com a secretaria" nem botão de comprar: a liberação é sempre
  administrativa, combinada fora do sistema. Acesso direto por URL a uma disciplina não
  liberada dá o mesmo erro "Disciplina não encontrada" usado em qualquer disciplina
  inexistente.

## Fora de escopo

- Autoatendimento: aluno nunca escolhe nem paga disciplina por conta própria (mesmo padrão
  de mensalidade manual — isso já existe via `selfScheduleMyChargesFn`, mas não se aplica
  aqui).
- Preço de catálogo por disciplina: valor é sempre digitado na hora (igual cobrança avulsa),
  não um preço fixo cadastrado por disciplina.
- Acesso parcial dentro de uma disciplina (ex.: só os vídeos, sem as provas): granularidade
  é sempre a disciplina inteira.
- Migrar algum aluno existente para avulso como parte desta entrega — fica a critério do
  admin, depois que a função existir.
