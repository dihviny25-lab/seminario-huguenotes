# Pagamento por matéria (aluno avulso) — design

Data: 2026-10-08 (revisado em 2026-10-10)
Status: aprovado (sessão de brainstorming com o dono do produto)

## Contexto e motivação

Hoje o único jeito de cobrar um aluno pela mensalidade é via **modalidade fixa**
(`src/lib/paymentModalities.ts`: Outras Igrejas, Obreiros, IBV/Pastores) — um valor mensal
igual pra todas as disciplinas que o aluno estiver fazendo. Não existe preço nem cobrança
por disciplina individual.

Existe demanda por um aluno que não entra no programa completo, mas quer (ou tem permissão
negociada pra) acompanhar só **uma ou algumas disciplinas específicas**, pagando por cada
uma — "pagamento por matéria". A negociação do valor e de quais disciplinas é sempre feita
numa conversa prévia entre o aluno e a administração, fora do sistema; o aluno nunca escolhe
nem paga nada por autoatendimento.

### O que já existe e NÃO precisa ser refeito

Entre a primeira versão desta spec e esta revisão, a feature **matrícula seletiva**
(`9ab93ff`/`c795287`, issue #100) foi implementada e já cobre inteiramente o lado de
**acesso**:

- `students.selectiveEnrollment` (bool) — já é, na prática, o "aluno avulso": em vez do
  currículo inteiro, ele só vê/participa das aulas liberadas especificamente pra ele.
- `studentLessonAccess` (`studentId`, `lessonId`) — liberação aula a aula, controlada pelo
  admin em **Alunos → ícone de lista** (`src/pages/painel/Students.tsx`, funções em
  `src/functions/studentEnrollment.ts`).
- `getStudentAccessibleLessonIds`/`isLessonContentVisible` (`src/server/enrollment.ts`,
  `src/server/files/access.ts`) já filtram vídeos, apostilas, slides, provas, tarefas,
  frequência, dashboard e feed de calendário — com os 5 achados de segurança da revisão
  automática já corrigidos (arquivo protegido, chamada/QR, entrega de tarefa por ID direto,
  denominador de frequência, exclusão de aula vinculada).

**Decisão:** esta spec não cria nenhum guard novo, nenhuma tabela de acesso nova, nenhum
campo `avulso` novo em `students` — tudo isso já existe e já funciona. O único pedaço que
falta é o **financeiro**: hoje nenhuma cobrança pode ser vinculada a uma disciplina, então
não tem como registrar "o aluno pagou pela matéria X" nem ela aparecer no financeiro/recibo
por disciplina.

## Objetivo

Admin consegue criar uma cobrança vinculada a uma disciplina específica, pro aluno que já
está marcado como `selectiveEnrollment` — mesmo padrão de `assignMaterialToStudentFn`
(cobrar ou doar), só que a cobrança referencia uma disciplina em vez de um material do
catálogo. Essa cobrança passa a aparecer no financeiro/recibo do aluno, descrita como
`"Disciplina: <nome>"`. A liberação de acesso em si continua sendo feita, como já é hoje,
na tela de matrícula seletiva (ação administrativa separada, sem automação entre as duas) —
o que muda é só a existência de um **registro de pagamento** da matéria.

## Decisões

### 1. Um campo novo no schema: `charges.disciplineId`

- `charges.disciplineId: uuid references disciplines.id, onDelete: "set null"` (nullable) —
  paralelo ao `courseMaterialId` que já existe (`schema.ts:364`): presente só quando a
  cobrança é de uma disciplina específica; nulo pra mensalidade, avulsa comum e material.

Nenhuma tabela nova, nenhuma migração de dados, nenhuma mudança em `students`.

### 2. Cobrança de disciplina espelha `assignMaterialToStudentFn`

Nova server function `chargeDisciplineAccessFn` em `src/functions/payments.ts` (mesmo
arquivo de `createChargeFn`/`generateMonthlyChargesFn`), no exato padrão de
`assignMaterialToStudentFn` (`src/functions/materials.ts:112`):

- Entrada: `studentId`, `disciplineId`, `donate: boolean`, e (se não for cortesia) `amount`
  + `dueDate`.
- Valida que o aluno tem `selectiveEnrollment = true` — erro claro
  (`"Esse aluno não é de matrícula seletiva — ative em Alunos antes de cobrar por
  disciplina."`) se não for: cobrança por disciplina só faz sentido pra esse tipo de aluno,
  já que aluno do programa comum não paga por matéria.
- Cria a `charge` com `disciplineId` preenchido, `description` tipo
  `"Disciplina: <nome>"` (igual ao `"Material: <título>"` já usado). Se `donate`, nasce com
  `status: "paid"`, `paidAmount: "0"`, `paidManually: true`, `note: "Disciplina cedida"` —
  mesmo padrão de "material doado" e bolsa integral.
- Auditoria (`logAudit`) com ações novas `"financeiro.disciplina_cobrar"` /
  `"financeiro.disciplina_ceder"`.

Baixa e cancelamento continuam pelos fluxos existentes (`markChargePaidManuallyFn`,
`cancelChargeFn`, já em `src/functions/payments.ts`) — essa cobrança não é um tipo novo de
registro, é uma `charge` normal com um campo extra preenchido. **Nenhuma das duas funções
precisa mudar.**

Função auxiliar `listDisciplinesForChargeFn` (admin, `requireAdminId`) — devolve
`{ id, discipline }` de todas as disciplinas, só pra alimentar o seletor do diálogo abaixo
(mesmo formato simples já usado por `getStudentEnrollmentFn` em `studentEnrollment.ts`).

### 3. UX no painel

Em [Payments.tsx](src/pages/painel/Payments.tsx), novo diálogo "Cobrar disciplina" ao lado
de "Cobrança avulsa" e "Atribuir material" — mesmo layout do `AssignMaterialDialog`
(`Payments.tsx:952`), trocando o seletor de material por um seletor de disciplina e
adicionando o campo de valor (que no material vem fixo do catálogo; aqui é digitado, como
numa cobrança avulsa comum). Se a cobrança falhar porque o aluno não é de matrícula
seletiva, o erro do servidor aparece no toast — sem checagem client-side redundante.

Nenhuma mudança na tela de matrícula seletiva (`Students.tsx`) nem no financeiro
agregado além do que já vem de graça por `disciplineId` ser um campo normal de `charges`
(filtros existentes por `modality`, se quiserem cobrir `disciplineId` depois, ficam de fora
desta entrega — ver "Fora de escopo").

## Fora de escopo

- Qualquer automação entre pagar a cobrança e liberar aulas em `studentLessonAccess` — as
  duas ações continuam manuais e independentes, como o próprio admin descreveu (negociação
  prévia, liberação administrativa).
- Autoatendimento: aluno nunca escolhe nem paga disciplina por conta própria.
- Preço de catálogo por disciplina: valor é sempre digitado na hora (igual cobrança avulsa),
  não um preço fixo cadastrado por disciplina.
- Filtro por disciplina no relatório financeiro agregado (`getFinancialReportFn`) — hoje só
  filtra por `modality`; estender pra `disciplineId` fica pra uma entrega futura, se surgir
  a necessidade.
- Migrar algum aluno existente pra matrícula seletiva como parte desta entrega — já é
  possível hoje, independente desta spec.
