# Dashboards do professor e do aluno — design

Data: 2026-08-31
Status: aprovado (sessão de brainstorming com o dono do produto)

## Contexto e motivação

O Cronograma Huguenotes já cobre bem o trabalho operacional do seminário: lançamento de
notas e faltas, provas online com correção automática, tarefas, fórum por disciplina,
vídeo-aulas, cobranças com Mercado Pago, despesas e auditoria. O que falta é a camada de
**leitura rápida**: quando um professor ou um aluno entra no sistema, a primeira tela não
responde "o que eu preciso fazer agora?".

- `src/pages/painel/PainelHome.tsx` (rota `/painel/`) é raso: dois atalhos fixos
  ("Contas de professores" e "Alunos") e a lista de disciplinas do professor logado, via
  `listMyDisciplinesFn` (`src/functions/disciplines.ts`). Nenhuma métrica, nenhum alerta,
  nenhuma pendência. O professor precisa entrar disciplina por disciplina, aba por aba,
  para descobrir que tem tarefa esperando correção.
- `src/pages/portal/PortalHome.tsx` (rota `/portal/`) já está razoável: cards de média
  geral, frequência geral e faltas (a partir de `getMyStudentReportFn` em
  `src/functions/report.ts`, com `MINIMUM_ATTENDANCE_RATIO` de `src/lib/attendance.ts` e
  `PASSING_AVERAGE` de `src/lib/grades.ts`), "Próximas tarefas"
  (`listAvailableAssignmentsFn`), "Provas agendadas" (`listAvailableExamsFn`), "Fórum em
  atividade" (`listRecentForumThreadsFn`) e link para o boletim. Faltam os avisos que o
  aluno mais sente falta: dinheiro, próxima aula e vídeo novo.

Junto disso, o pedido original incluía uma varredura de erros existentes e um conjunto de
melhorias que apareceram na conversa (fórum, acompanhamento por disciplina, tarefas
objetivas, espaços só para professores). Isso não cabe num único PR.

## Objetivo

Entregar, em fases independentes e sequenciáveis, um conjunto de melhorias que:

1. Dá ao professor uma tela inicial com as pendências reais do seu trabalho, com um bloco
   extra de gestão quando ele é admin.
2. Completa a tela inicial do aluno com os avisos financeiros e acadêmicos que hoje ficam
   escondidos em subpáginas.
3. Corrige defeitos encontrados numa auditoria dirigida aos fluxos críticos.
4. Abre caminho para acompanhamento por disciplina, tarefas objetivas auto-corrigidas e
   espaços de colaboração entre professores.

Cada fase vira sua própria issue, branch e pull request, conforme
[CONTRIBUTING.md](../../../CONTRIBUTING.md). Este documento é o guarda-chuva que mantém as
fases coerentes entre si — ele **não** é um plano de implementação; cada fase ganha o seu
quando for iniciada.

## Decisões transversais

Estas decisões valem para todas as fases e não devem ser reabertas fase a fase.

### 1. "Aluno matriculado" significa "aluno ativo"

O schema **não tem tabela de matrícula**. `disciplines` aponta para um professor
(`teacherId`), mas não há vínculo aluno↔disciplina. O código existente já resolveu isso de
uma forma: `getClassReportData` (`src/functions/reportData.ts`) trata **todo aluno com
`students.active = true` como pertencente a toda disciplina**, e o boletim da turma é
montado assim.

**Decisão:** todas as fases seguem exatamente essa convenção. "Alunos da disciplina",
"alunos matriculados" e "minhas disciplinas" (lado aluno) significam, em consulta,
`students.active = true` cruzado com a disciplina em questão. Nenhuma fase deste spec
introduz modelo de matrícula — ver "Fora de escopo".

### 2. Duas funções de agregação no painel, não uma

`getFinancialSummaryFn` (`src/functions/payments.ts`), `listExpensesFn`
(`src/functions/expenses.ts`) e `listAuditActionsFn` (`src/functions/auditLog.ts`) chamam
`requireAdminId()` e **lançam erro** para professor comum. Se o dashboard do professor
fosse uma função só que tentasse agregar tudo, ou ela quebraria para professor comum, ou
precisaria engolir exceções internamente — os dois caminhos são ruins.

**Decisão:** duas server functions separadas.

- `getTeacherDashboardFn` — `requireTeacherId()`, devolve o que todo professor vê.
- `getAdminDashboardFn` — `requireAdminId()`, devolve só o bloco administrativo.

A tela chama a segunda apenas quando `role === "admin"` (o papel já é conhecido no painel;
se não estiver disponível no contexto atual da tela, `getTeacherDashboardFn` passa a
devolver também o campo `role` do professor logado, e a query admin fica condicionada a
ele via `enabled` do TanStack Query). Erro de permissão deixa de ser um caminho normal de
execução.

### 3. Lógica pura em `src/lib/`, consulta em `src/functions/`

Os testes que existem hoje (`src/lib/attendance.test.ts`, `src/lib/grades.test.ts`,
`src/lib/payments.test.ts`, `src/lib/schedule-utils.test.ts`,
`src/server/auth/password.test.ts`, `src/server/payments/mercadopago.test.ts`,
`src/functions/reportPdf.test.ts`) são todos de função pura — o projeto não tem
infraestrutura de teste com banco.

**Decisão:** toda regra de negócio nova (escolha da próxima aula, classificação de
cobrança em "vencida / vence em breve / em dia", limiar de frequência baixa, permissão de
apagar tópico, correção de tarefa objetiva) é escrita como **função pura** em
`src/lib/`, recebendo linhas já carregadas, e é ela que ganha teste unitário. A server
function fica responsável só por autenticar, consultar e chamar a função pura. Isso
mantém o padrão do repositório e torna a exigência de "testes para as novas funções de
agregação e permissão" cumprível de verdade.

### 4. Agregação em memória

`reportData.ts` e `getFinancialSummaryFn` já carregam as linhas e agregam em JavaScript,
com o comentário explícito de que o volume é pequeno (um seminário, dezenas de alunos).

**Decisão:** as novas agregações seguem o mesmo estilo — poucas queries amplas com
`inArray` sobre os ids das disciplinas do professor, agregação em memória. Nada de SQL
agregado sofisticado nem de views materializadas.

### 5. Mudanças de schema via `db:push`

O projeto usa `drizzle-kit push` (`npm run db:push`, `drizzle.config.ts` com
`out: "./src/server/db/migrations"`), e não há migrações versionadas commitadas.

**Decisão:** as fases com schema novo (5, 6, 7) alteram `src/server/db/schema.ts` e são
aplicadas com `npm run db:push`. Todas as colunas novas em tabelas existentes entram com
`default` compatível com as linhas antigas, para que o push seja não destrutivo.

### 6. Idioma e convenções de código

Toda a UI, mensagens de erro e comentários novos em português, seguindo o padrão do
repositório. Componentes de UI vêm de `src/components/ui` (shadcn/Radix já instalado);
animações seguem [MOTION.md](../../../MOTION.md).

## Visão geral das fases

| Fase | Tema | Porte | Schema novo? |
|------|------|-------|--------------|
| 0 | Auditoria de erros do sistema | médio | não |
| 1 | Dashboard do professor | grande | não |
| 2 | Dashboard do aluno | pequeno | não |
| 3 | Aluno apaga o próprio tópico sem respostas | muito pequeno | não |
| 4 | Painel de acompanhamento por disciplina | médio | não |
| 5 | Tarefas de múltipla escolha | grande | sim |
| 6 | Fórum interno de professores | médio | sim |
| 7 | Compartilhamento de apostilas entre professores | médio | sim |

### Ordem de execução e dependências

```
        ┌──────────────┐
        │   Fase 0     │  auditoria (independente)
        │  auditoria   │
        └──────────────┘
                ║ (em paralelo)
        ┌──────────────┐
        │   Fase 1     │  dashboard do professor
        │  painel      │
        └──────┬───────┘
               │
      ┌────────┴────────┐
      ▼                 ▼
┌───────────┐    ┌───────────┐
│  Fase 2   │    │  Fase 3   │   (Fase 3 pode ir junto da 1:
│  portal   │    │  fórum    │    mexe no mesmo widget)
└─────┬─────┘    └─────┬─────┘
      └────────┬───────┘
               ▼
        ┌──────────────┐
        │   Fase 4     │  acompanhamento por disciplina
        └──────┬───────┘
               ▼
        ┌──────────────┐
        │   Fase 5     │  tarefas de múltipla escolha
        └──────┬───────┘
               ▼
      ┌────────┴────────┐
      ▼                 ▼
┌───────────┐    ┌───────────┐
│  Fase 6   │    │  Fase 7   │  independentes entre si
│  fórum    │    │ apostilas │  (sem dependência técnica
│  interno  │    │compartilh.│   das fases anteriores)
└───────────┘    └───────────┘
```

Leitura das setas: seta significa "melhor fazer depois", não "impossível antes". As únicas
dependências técnicas duras são: Fase 3 toca o mesmo widget de fórum que a Fase 1, e a
Fase 4 reaproveita helpers puros criados na Fase 1. Fases 6 e 7 poderiam, na prática, ser
puxadas para frente se houver urgência; ficam no fim por prioridade, não por bloqueio.

---

## Fase 0 — Auditoria de erros do sistema

### Objetivo

Varredura dirigida dos fluxos críticos, produzindo um relatório de achados. Correções
triviais e sem risco entram no próprio PR da auditoria; achados maiores viram issues
novas e **não** são corrigidos nesta fase.

### Escopo da varredura

Seis fluxos, nesta ordem de prioridade:

1. **Autenticação e sessão** — `src/server/auth/session.ts`, `studentSession.ts`,
   `guard.ts`, `src/functions/auth.ts`, `studentAuth.ts`, `passwordReset.ts`. Pontos de
   atenção: expiração e rotação de sessão, tokens de reset (uso único, expiração de 1h),
   token de e-mail separado do de senha, `calendarToken` (token longo, sem expiração, que
   dá acesso ao feed `.ics`), e se toda server function sensível chama de fato um
   `require*`.
2. **Pagamentos** — `src/server/payments/mercadopago.ts`, `src/functions/payments.ts`.
   Pontos: idempotência do webhook (pagamento notificado duas vezes não pode duplicar
   baixa), consistência entre `status`, `paidAt`, `paidAmount` e `paidManually`, cálculo
   de desconto por pontualidade (`discountPercent`), e a chave de unicidade da geração
   mensal (`period` no formato `YYYY-MM`).
3. **Notas e frequência** — `src/lib/grades.ts`, `src/lib/attendance.ts`,
   `src/functions/reportData.ts`, `grades.ts`, `attendance.ts`. Pontos: média ponderada
   com peso zero, aula com `date` nula (hoje filtrada como "ainda não aconteceu"),
   disciplina sem nenhuma aula lançada gerando 100% de frequência aparente, e comparação
   de data por string ISO com fuso.
4. **Correção de provas** — `src/server/exams/scoring.ts`, `src/functions/examAttempts.ts`.
   Pontos: idempotência de `finalizeExamAttempt` (já protegida por `submittedAt`),
   fechamento por tempo esgotado versus clique manual, tentativa iniciada e nunca
   enviada, e a escrita da nota em `grades` conflitando com `setGradeFn`.
5. **Geração de PDF** — `src/functions/reportPdf.tsx`, `receiptPdf.tsx`. Pontos: nomes
   longos, acentuação, aluno sem nenhuma nota, disciplina sem avaliações.
6. **Push notifications** — `src/server/push.ts`, `src/functions/pushSubscriptions.ts`,
   `src/lib/pushClient.ts`. Pontos: inscrição expirada/revogada sem limpeza,
   envio duplicado para o mesmo dono e falha de push derrubando a operação principal
   (ex.: postar no fórum falhar porque a notificação falhou).

### Critério de "trivial"

Corrige-se no próprio PR o que for: mudança em um único arquivo, sem alteração de schema,
sem mudança de contrato de função exportada, e coberto por (ou passível de) um teste
unitário puro. Todo o resto vira issue com o rótulo `bug` e uma reprodução descrita.

### Entregáveis

- Relatório dos achados na descrição da issue/PR da auditoria, agrupado pelos seis fluxos,
  cada achado com severidade (alta/média/baixa) e destino (corrigido aqui / issue #N).
- Correções triviais aplicadas, cada uma com teste quando houver função pura envolvida.
- Issues abertas para o restante.

### Critério de pronto

Os seis fluxos foram percorridos, cada achado tem destino registrado, `npm run test` e
`npm run lint` passam, e nenhum achado ficou sem issue ou sem correção.

### Riscos e observações

- Risco de a fase virar refatoração ampla. Mitigação: o critério de "trivial" acima é
  fechado; na dúvida, abre-se issue.
- A auditoria pode encontrar defeitos justamente nos dados que a Fase 1 vai exibir
  (frequência, notas). Por isso as duas fases rodam em paralelo mas em branches separadas,
  e a Fase 1 assume o comportamento **atual** dos helpers — se a Fase 0 mudar uma regra,
  ela ajusta os testes que quebrarem.

---

## Fase 1 — Dashboard do professor

### Objetivo

Transformar `/painel/` na tela de pendências do professor, usando exclusivamente dados que
já existem no banco.

### Dados e funções

**Novo:**

- `src/functions/dashboard.ts`
  - `getTeacherDashboardFn` — `requireTeacherId()`. Devolve `{ role, disciplines,
    pendingSubmissions, examAlerts, nextLessons, lowAttendance }`.
  - `getAdminDashboardFn` — `requireAdminId()`. Devolve `{ financial, counts, recentAudit,
    monthExpenses }`.
- `src/lib/dashboard.ts` — helpers puros e seus testes:
  - `pickNextLesson(lessons, today)` — a aula futura mais próxima, ignorando `date` nula.
  - `computeAttendanceRatios(lessonIds, attendanceRows)` — razão de presença por aluno.
  - `selectLowAttendance(ratios, threshold)` — quem está abaixo do limiar.
- `src/components/painel/dashboard/` — um componente por card, para não inchar
  `PainelHome.tsx`.

**Reaproveitado:** `listMyDisciplinesFn`, `listRecentForumThreadsFn`,
`getFinancialSummaryFn`, `listExpensesFn`, `listAuditActionsFn`, `MINIMUM_ATTENDANCE_RATIO`,
`PainelShell`, `Skeleton`.

**Tabelas lidas:** `disciplines`, `assignments`, `assignmentSubmissions`, `exams`,
`examAttempts`, `lessons`, `attendance`, `students`, `teachers`, `forumThreads`,
`forumPosts`, `charges`, `expenses`, `auditLogs`.

### Cards para todo professor

Todos escopados às disciplinas onde `disciplines.teacherId = <professor logado>`.

1. **Tarefas para corrigir** — linhas de `assignmentSubmissions` com `gradedAt IS NULL`,
   cujo `assignment.disciplineId` está entre as disciplinas do professor. Mostra
   disciplina, título da tarefa, quantidade pendente e a data da submissão mais antiga.
   Link para a tarefa.
2. **Provas com nota pendente** — hoje **todas** as provas são de múltipla escolha
   (`examQuestions` só tem alternativas em `examOptions`; `examAnswers` guarda apenas
   `optionId`) e `finalizeExamAttempt` grava a nota na hora do envio. Logo, não existe
   correção manual de prova no sistema atual. **Decisão:** o card é de *anomalia*, não de
   fila de trabalho, e lista duas situações: (a) tentativa com `submittedAt` preenchido e
   `score` nulo — indica falha na correção automática; (b) tentativa com `startedAt`
   antigo, `submittedAt` nulo e prazo (`durationMinutes`) já vencido — tentativa
   abandonada/travada. Em operação normal o card fica vazio e é omitido da tela. Se um dia
   existirem questões dissertativas (fora do escopo deste spec), este é o card que passa a
   receber a fila de correção manual.
3. **Próxima aula por disciplina** — de `lessons`, para cada disciplina do professor, a
   aula com `date` não nula mais próxima de hoje no futuro (`pickNextLesson`). Disciplina
   sem aula futura aparece com "sem aula agendada". Ordenado por data.
4. **Alunos com frequência baixa** — por disciplina do professor: aulas passadas
   (`date` não nula e `<= hoje`, mesma regra de `reportData.ts`), presença de cada aluno
   ativo, razão abaixo de `MINIMUM_ATTENDANCE_RATIO`. Disciplina sem nenhuma aula passada
   é **omitida** (não gera "0% de frequência" falso). Mostra aluno, disciplina e a razão
   em porcentagem, ordenado do pior para o melhor, limitado a 10 linhas com link para a
   aba de frequência.
5. **Fórum em atividade** — reaproveita `listRecentForumThreadsFn` como está. A função já
   usa `requireAnyIdentity()` e **já devolve tópicos de todas as disciplinas**, sem filtro
   por professor — que é exatamente o comportamento desejado. Nenhuma mudança de backend;
   só o widget novo no painel, no mesmo formato do que o portal já usa.

### Bloco extra para admin

Renderizado só quando `role === "admin"`, alimentado por `getAdminDashboardFn`:

- **Financeiro e inadimplência** — `getFinancialSummaryFn` (recebido no mês, pendente a
  vencer, vencido). Link para `/painel/financeiro`.
- **Totais de cadastro** — contagem de `students` com `active = true` e de `teachers`
  ativos. Duas consultas simples de contagem dentro de `getAdminDashboardFn`.
- **Últimas ações** — cinco entradas mais recentes de `auditLogs` via `listAuditActionsFn`,
  com link para `/painel/auditoria`.
- **Despesas do mês** — soma das linhas de `listExpensesFn` cuja `date` cai no mês
  corrente, com link para `/painel/despesas`.

### Decisões técnicas

- **Duas queries no cliente**, com chaves `["teacher-dashboard"]` e `["admin-dashboard"]`,
  a segunda com `enabled: role === "admin"`.
- **Estado de carregamento** com `Skeleton`, no padrão que `PainelHome` já usa.
- **Card vazio some.** Nenhum card renderiza um "nada aqui" quando não há dado — a tela
  precisa mostrar pendência, não ruído. Se todos os cards estiverem vazios, aparece uma
  única linha de "Nada pendente por aqui." acima das disciplinas.
- **Atalhos preservados.** Os dois atalhos atuais ("Contas de professores", "Alunos") e a
  lista "Minhas disciplinas" continuam na tela, abaixo dos cards de pendência.
- **Limites de lista.** Cada card mostra no máximo 5 itens (10 no de frequência) com link
  "ver todos" para a tela correspondente.

### Critério de pronto

Os cinco cards de professor e os quatro blocos de admin renderizam com dados reais;
`getTeacherDashboardFn` não lança para professor comum; `src/lib/dashboard.ts` tem testes
cobrindo aula com data nula, disciplina sem aulas passadas, empate de datas e limiar de
frequência exatamente igual a `MINIMUM_ATTENDANCE_RATIO` (que **não** conta como baixa);
verificação manual feita logado como professor comum e como admin; `npm run test`,
`npm run lint` e `npm run build` passam.

### Riscos e observações

- Muitas consultas numa tela só. Mitigação: uma query por tabela com `inArray` sobre os
  ids das disciplinas, disparadas em `Promise.all`, agregação em memória.
- Professor sem nenhuma disciplina atribuída: todos os cards vazios. O texto atual de
  "nenhuma disciplina atribuída" continua sendo a mensagem principal nesse caso.
- O card de provas fica vazio enquanto o sistema estiver saudável — isso é esperado e está
  documentado acima, não é sinal de bug. A Fase 5 **não** o preenche: tarefa objetiva é
  corrigida na hora e já nasce com `gradedAt`.

---

## Fase 2 — Dashboard do aluno

### Objetivo

Completar `/portal/` com os três avisos que faltam, sem redesenhar o que já funciona.

### Dados e funções

**Novo:**

- `src/functions/dashboard.ts` ganha `getStudentDashboardFn` — `requireStudentId()`,
  devolvendo `{ chargeAlert, nextLesson, unwatchedVideos }`.
- `src/lib/dashboard.ts` ganha `classifyCharge(charge, today)`, puro, devolvendo
  `"overdue" | "due-soon" | "ok"`.

**Reaproveitado:** `listMyChargesFn` (`src/functions/payments.ts`), `pickNextLesson` da
Fase 1, `listMyWatchedVideosFn` / `listAllVideoLessonsFn` (`src/functions/videoLessons.ts`),
os componentes de card já usados em `PortalHome`.

**Tabelas lidas:** `charges`, `lessons`, `disciplines`, `videoLessons`, `videoWatches`.

### Adições à tela

1. **Alerta de cobrança** — no topo, acima dos cards de média/frequência, só quando há
   algo a dizer. Considera as cobranças do aluno com `status = "pending"`:
   - `dueDate < hoje` → alerta vermelho "cobrança vencida", com a mais antiga em destaque.
   - `dueDate` entre hoje e hoje+7 dias → alerta âmbar "vence em breve".
   - nenhuma das duas → nenhum alerta é renderizado.
   Sempre com botão "Pagar" apontando para `/portal/pagamentos`. **Decisão:** a janela de
   "vence em breve" é de **7 dias**, fixa em constante exportada de `src/lib/dashboard.ts`.
   Cobranças `canceled` e `paid` são ignoradas.
2. **Próxima aula** — a aula com `date` não nula mais próxima no futuro, entre todas as
   disciplinas (todo aluno ativo pertence a todas, conforme decisão transversal 1),
   mostrando data e nome da disciplina. Reusa `pickNextLesson`. Sem aula futura, o card
   não é renderizado.
3. **Vídeo-aulas novas** — vídeos de `videoLessons` sem linha correspondente em
   `videoWatches` para o aluno logado, ordenados do mais recente para o mais antigo,
   limitados a 5, com link para `/portal/videos`. Sem pendência, o card não é renderizado.

### Decisões técnicas

- Uma única query nova no cliente (`["student-dashboard"]`), somada às que `PortalHome` já
  faz. Não se mexe nas queries existentes.
- Mesma regra da Fase 1: card sem conteúdo não aparece. O portal já tem bastante coisa na
  tela; cards vazios só empurrariam o conteúdo útil para baixo.
- O alerta de cobrança é o único elemento que entra **acima** dos cards existentes; os
  outros dois entram após "Provas agendadas" e antes de "Fórum em atividade".

### Critério de pronto

Os três elementos aparecem e desaparecem corretamente conforme o estado do aluno;
`classifyCharge` tem teste cobrindo vencida, vence hoje, vence no 7º dia, vence no 8º dia,
paga e cancelada; verificação manual com um aluno em dia e um aluno inadimplente;
`npm run test`, `npm run lint` e `npm run build` passam.

### Riscos e observações

- Cuidado com fuso na comparação de datas: `charges.dueDate` e `lessons.date` são colunas
  `date` (string `YYYY-MM-DD`). `classifyCharge` e `pickNextLesson` comparam **strings
  ISO**, como o resto do projeto já faz — nunca convertendo para `Date` local.
- O alerta é informativo; nenhuma tela é bloqueada por inadimplência nesta fase.

---

## Fase 3 — Aluno apaga o próprio tópico sem respostas

### Objetivo

Fechar uma lacuna de simetria no fórum: o aluno já pode apagar a própria mensagem, mas não
o próprio tópico criado por engano.

### Situação atual

- `deleteThreadFn` (`src/functions/forum.ts`, ~linha 274) chama `requireOwnDiscipline` —
  só o professor dono da disciplina apaga tópicos, como moderação.
- `deletePostFn` (~linha 293) permite apagar a própria mensagem, ou qualquer uma se quem
  pede é o professor dono da disciplina.

### Mudança

`deleteThreadFn` passa a usar `requireAnyIdentity()` e a decidir por uma função pura nova
em `src/lib/forumPermissions.ts`. **Decisão:** a assinatura é deliberadamente genérica —
recebe três booleanos/números já resolvidos pelo chamador, sem conhecer disciplina nem
enum de papel — para que a Fase 6 possa reusá-la no fórum interno, que não tem disciplina:

```
canDeleteThread({ isModerator, isAuthor, postCount }) -> boolean
```

Regras, nesta ordem:

1. `isModerator` → pode sempre. No fórum por disciplina, `isModerator` é "professor logado
   é o dono da disciplina do tópico" (moderação, comportamento atual preservado).
2. `isAuthor && postCount === 0` → pode. `isAuthor` é resolvido pelo chamador comparando
   `authorRole` com `authorStudentId`/`authorTeacherId` contra a identidade logada.
3. Caso contrário → não pode, com a mensagem "Só é possível apagar um tópico que ainda não
   tem respostas."

A contagem de posts é feita na mesma transação lógica da exclusão (consulta imediatamente
antes do `delete`), aceitando a corrida rara em que uma resposta chega no intervalo — o
custo de apagar um tópico com uma resposta recém-criada é baixo e não justifica bloqueio.

**Decisão:** a auditoria (`logAudit`) continua sendo registrada apenas quando quem apaga é
professor, como hoje. Exclusão do próprio tópico vazio por aluno é operação de correção
trivial e não polui o log administrativo.

Na UI, `src/pages/portal/PortalForumThread.tsx` (e a listagem em `PortalForum.tsx`) passa a
mostrar o botão de apagar quando o tópico é do aluno logado e não tem respostas. A regra da
UI espelha a mesma função pura, mas a decisão que vale é a do servidor.

### Critério de pronto

`canDeleteThread` tem teste cobrindo as quatro combinações (dono/não dono, com/sem
respostas) e o caso do professor moderador; a rota do professor continua funcionando como
antes; verificação manual como aluno criando e apagando um tópico vazio, e falhando ao
tentar apagar um tópico com resposta.

### Riscos e observações

- Regressão de moderação é o risco principal: o teste do caso "professor dono apaga tópico
  alheio com respostas" é obrigatório.
- Pode ser entregue no mesmo PR da Fase 1, já que ambos tocam a área de fórum — mas
  continua sendo sua própria issue.

---

## Fase 4 — Painel de acompanhamento por disciplina

### Objetivo

Dar ao professor, numa tabela só, a visão de todos os alunos de uma disciplina: como estão
em nota, tarefas, provas e vídeos. Hoje esses dados estão espalhados por `GradesTab`,
`AttendanceTab`, `AssignmentsTab`, `ExamsTab` e `VideoLessonsTab`.

### Dados e funções

**Novo:**

- Aba "Acompanhamento" em `src/pages/painel/DisciplineDetail.tsx`, primeira aba da tela.
- `getDisciplineOverviewFn` em `src/functions/dashboard.ts` —
  `requireOwnDiscipline(disciplineId)`, devolvendo uma linha por aluno ativo.
- Helper puro `buildDisciplineOverview(...)` em `src/lib/dashboard.ts`, que recebe as
  linhas cruas e monta a tabela.

**Reaproveitado:** `getClassReportData` (`src/functions/reportData.ts`) para nota média e
faltas — evita reimplementar média ponderada e a regra de "aula que já aconteceu";
`computeAttendanceRatios` (criada na Fase 1, e a razão pela qual a Fase 4 vem depois dela);
`computeWeightedAverage`, `countFaltas`, `MINIMUM_ATTENDANCE_RATIO`, `PASSING_AVERAGE`.

**Tabelas lidas:** `students`, `assessments`, `grades`, `lessons`, `attendance`,
`assignments`, `assignmentSubmissions`, `exams`, `examAttempts`, `videoLessons`,
`videoWatches`.

### Colunas da tabela

| Coluna | Conteúdo |
|--------|----------|
| Aluno | nome (via `toDisplayName`) |
| Média | média ponderada da disciplina, com destaque abaixo de `PASSING_AVERAGE` |
| Frequência | presenças/aulas passadas em %, com destaque abaixo de `MINIMUM_ATTENDANCE_RATIO` |
| Tarefas | `entregues/total`, com marcação de quantas aguardam correção |
| Provas | `feitas/total`, considerando `examAttempts.submittedAt` preenchido |
| Vídeos | `assistidos/total` |

Ordenação padrão por nome. Ordenação alternativa por média e por frequência (crescente),
para o professor achar rápido quem está em risco. Sem paginação — o volume é de dezenas de
alunos.

**Decisão:** "total" de tarefas e provas conta apenas o que já está **publicado** para o
aluno: tarefas todas contam; provas só contam quando `opensAt` não é nulo (prova em
rascunho é invisível ao aluno e não deve pesar contra ele).

### Critério de pronto

A aba renderiza todos os alunos ativos com as seis colunas; os números batem com o que as
abas existentes mostram para dois ou três alunos conferidos manualmente;
`buildDisciplineOverview` tem teste cobrindo aluno sem nenhuma nota, disciplina sem aulas
passadas, prova em rascunho não contando no total e disciplina sem vídeos; `npm run test`,
`npm run lint` e `npm run build` passam.

### Riscos e observações

- É a fase com mais consultas simultâneas. Mitigação: `Promise.all` com uma query por
  tabela filtrada pela disciplina, agregação em memória.
- Depende da decisão transversal 1 (todo aluno ativo é da disciplina). Se um dia existir
  matrícula real, esta é a tela que mais muda.

---

## Fase 5 — Tarefas de múltipla escolha com correção automática

### Objetivo

Permitir que uma tarefa seja objetiva e se corrija sozinha, no mesmo motor que as provas já
usam.

### Mudanças de schema

Em `src/server/db/schema.ts`:

```
assignmentKind = pgEnum("assignment_kind", ["open", "multiple_choice"])

assignments.kind: assignmentKind, notNull, default "open"

assignment_questions   — id, assignmentId (cascade), text, points (numeric 5,2, default "1"),
                         sequence, createdAt
assignment_options     — id, questionId (cascade), text, isCorrect (bool, default false),
                         sequence
assignment_answers     — id, submissionId (cascade), questionId (cascade),
                         optionId (set null), answeredAt
                         unique(submissionId, questionId)
```

Espelha exatamente `exam_questions` / `exam_options` / `exam_answers`. O default `"open"`
mantém toda tarefa existente funcionando sem migração de dados.

**Decisão:** as respostas do aluno ficam em `assignment_answers`, penduradas na
`assignmentSubmissions` que já existe — a submissão continua sendo o registro central, com
`submittedAt`, `gradedAt` e `feedback` inalterados. Não se cria um equivalente de
`examAttempts`, porque tarefa não tem cronômetro nem janela de abertura.

### Motor de correção

`src/server/exams/scoring.ts` tem `finalizeExamAttempt`, que hoje faz três coisas
acopladas: soma pontos, atualiza a tentativa e grava em `grades`.

**Decisão:** extrair a soma para uma função pura reutilizável em `src/lib/scoring.ts`:

```
sumCorrectPoints(selectedOptionIds, options, questions) -> number
```

`finalizeExamAttempt` passa a chamá-la (comportamento idêntico, coberto pelos testes
existentes), e a submissão de tarefa objetiva ganha `finalizeAssignmentSubmission` em
`src/server/assignments/scoring.ts`, que usa a mesma função pura e grava em `grades` pelo
`assignments.assessmentId` — o mesmo caminho que a prova usa. Ao corrigir automaticamente,
`gradedAt` é preenchido, de modo que a tarefa objetiva **não** aparece na fila de correção
da Fase 1.

### Mudanças de UI

- `src/pages/painel/AssignmentEditor.tsx` — escolha do tipo na criação (depois de criada,
  o tipo é imutável; trocar significa apagar e recriar), e, quando "múltipla escolha", o
  editor de questões e alternativas no mesmo formato de `ExamEditor.tsx`.
- `src/pages/portal/PortalAssignmentDetail.tsx` — quando a tarefa é objetiva, mostra as
  questões com `RadioGroup` em vez do campo de texto/upload; ao enviar, grava as respostas
  e a nota sai na hora.
- `src/pages/painel/AssignmentsTab.tsx` — indica o tipo da tarefa na listagem.

**Decisão:** uma questão tem exatamente uma alternativa correta (mesma regra das provas
hoje). Envio único, sem tentativa múltipla, como já vale para tarefas abertas.

### Critério de pronto

É possível criar uma tarefa objetiva, respondê-la como aluno e ver a nota lançada
automaticamente na aba Notas; tarefas abertas existentes continuam idênticas;
`sumCorrectPoints` tem testes próprios e os testes de `finalizeExamAttempt` continuam
verdes; `npm run db:push` aplica o schema sem erro; `npm run test`, `npm run lint` e
`npm run build` passam.

### Riscos e observações

- Maior risco do spec: mexe no motor de correção que já está em produção. Mitigação: a
  extração para `sumCorrectPoints` é refatoração pura, sem mudança de comportamento, e é
  a primeira coisa feita e validada no PR.
- `assignments.assessmentId` é `notNull` e `unique` — toda tarefa já tem avaliação
  vinculada, então a gravação da nota reaproveita o caminho existente sem mudança.

---

## Fase 6 — Fórum interno de professores

### Objetivo

Um espaço de dúvidas e coordenação visível apenas para professores e admins, sem alunos.

### Schema

```
teacher_forum_threads — id, title, authorTeacherId (set null), authorName, createdAt
teacher_forum_posts   — id, threadId (cascade), authorTeacherId (set null), authorName,
                        content, createdAt
```

**Decisão:** sem `disciplineId`. O fórum interno é do corpo docente, não de uma disciplina
— o assunto é o próprio funcionamento do seminário. `authorName` é desnormalizado como já é
feito em `forumThreads`/`forumPosts`, para o histórico sobreviver à exclusão da conta.

### Funções e rota

- `src/functions/teacherForum.ts` — `listTeacherThreadsFn`, `getTeacherThreadFn`,
  `createTeacherThreadFn`, `createTeacherPostFn`, `deleteTeacherThreadFn`,
  `deleteTeacherPostFn`. **Toda** função chama `requireTeacherId()` — nunca
  `requireAnyIdentity()`, que deixaria aluno entrar.
- Rota `/painel/forum-interno`, com `src/pages/painel/TeacherForumHome.tsx` e
  `TeacherForumThread.tsx`, no padrão visual de `ForumHome.tsx` / `ForumThread.tsx`.
- Atalho no menu do painel.

**Decisão de permissão de exclusão:** o autor apaga o próprio post; o autor apaga o próprio
tópico se não houver respostas; admin apaga qualquer coisa, com registro em `auditLogs`.
Tudo isso é a mesma regra da Fase 3, reusando `canDeleteThread` com
`isModerator: <professor logado é admin>` — motivo pelo qual aquela função foi definida sem
referência a disciplina.

**Decisão sobre notificações:** o fórum interno **notifica por push** os participantes de um
tópico quando chega resposta, reusando `sendPushToOwner("teacher", ...)` exatamente como
`src/functions/forum.ts` já faz. É o mesmo mecanismo, sem código novo de infraestrutura.

### Critério de pronto

Professor comum e admin acessam `/painel/forum-interno`, criam tópico, respondem e apagam
conforme as regras; aluno logado no portal recebe `UNAUTHORIZED` ao chamar qualquer função
do módulo; as regras de exclusão têm teste; `npm run db:push` aplica o schema;
`npm run test`, `npm run lint` e `npm run build` passam.

### Riscos e observações

- Risco de vazamento: um único `requireAnyIdentity()` esquecido abriria o fórum para
  alunos. Por isso a revisão do PR deve conferir função por função.

---

## Fase 7 — Compartilhamento de apostilas entre professores

### Objetivo

Um professor pode disponibilizar sua apostila/material para outros professores e discutir o
conteúdo com eles.

### Schema

```
reading_material_shares   — id, readingMaterialId (cascade), teacherId (cascade),
                            sharedById (set null), createdAt
                            unique(readingMaterialId, teacherId)

reading_material_comments — id, readingMaterialId (cascade), teacherId (set null),
                            authorName, content, createdAt
```

`reading_material_comments` segue o formato de `reflectionComments`
(`src/server/db/schema.ts` ~439): `teacherId` anulável mais `authorName` desnormalizado.

**Decisão:** o compartilhamento é **explícito e nominal** — o dono escolhe com quais
professores compartilha, não existe modo "visível para todos". Isso mantém o controle com
quem produziu o material e evita transformar a área em biblioteca pública, que é papel de
`libraryBooks`.

**Decisão:** o alvo do compartilhamento é `readingMaterials` (apostilas de leitura por
disciplina, `src/functions/readingMaterials.ts`), não `courseMaterials` — este último é
catálogo de materiais **cobráveis** do aluno, com preço, e não tem conteúdo para
compartilhar.

**Decisão:** compartilhamento dá acesso **de leitura e comentário**, nunca de edição. Só o
dono edita a apostila. Isso evita conflito de edição concorrente, que este spec não trata.

### Funções e UI

- `src/functions/materialSharing.ts` — `shareMaterialFn`, `unshareMaterialFn`,
  `listSharedWithMeFn`, `listMaterialSharesFn`, `listMaterialCommentsFn`,
  `createMaterialCommentFn`, `deleteMaterialCommentFn`. Todas com `requireTeacherId()`;
  as de escrita sobre o compartilhamento exigem também ser o dono da disciplina da apostila
  (`requireOwnDiscipline`).
- Em `src/pages/painel/ReadingMaterialsTab.tsx`: botão "Compartilhar" abrindo diálogo com a
  lista de professores (via `listTeacherAccountsFn`) e alternância por professor.
- Seção "Apostilas compartilhadas comigo" em `src/pages/painel/Materials.tsx`, listando o
  resultado de `listSharedWithMeFn`.
- Painel de comentários ao lado do leitor da apostila, no padrão de `reflectionComments`.

### Critério de pronto

Professor A compartilha uma apostila com o professor B; B a vê em "compartilhadas comigo",
lê e comenta; um professor C não vê nada; a exclusão do compartilhamento remove o acesso;
as regras de permissão têm teste; `npm run db:push` aplica o schema; `npm run test`,
`npm run lint` e `npm run build` passam.

### Riscos e observações

- A discussão por material é muito parecida com o fórum interno da Fase 6. São mantidas
  separadas de propósito: comentário de apostila é contextual ao material e morre com ele
  (`cascade`); o fórum interno é conversa geral e persistente. Unificar as duas resultaria
  numa abstração que serve mal aos dois casos.

---

## Estratégia de testes

### O que ganha teste automatizado

Toda função pura nova, em `src/lib/` ou `src/server/`, com o arquivo `.test.ts` ao lado —
o padrão que `attendance.test.ts`, `grades.test.ts`, `payments.test.ts` e
`password.test.ts` já seguem. Concretamente:

| Fase | Alvo de teste |
|------|----------------|
| 0 | teste de regressão para cada correção trivial que envolva função pura |
| 1 | `pickNextLesson`, `computeAttendanceRatios`, `selectLowAttendance` |
| 2 | `classifyCharge` |
| 3 | `canDeleteThread` |
| 4 | `buildDisciplineOverview` |
| 5 | `sumCorrectPoints`, mais os testes existentes de `finalizeExamAttempt` mantidos verdes |
| 6 | regra de exclusão do fórum interno (reuso de `canDeleteThread`) |
| 7 | predicado de acesso à apostila compartilhada |

Casos de borda obrigatórios, porque são exatamente onde o sistema erra hoje: lista vazia,
`date` nula, disciplina sem aulas passadas, peso total zero na média, valor exatamente no
limiar (`ratio === MINIMUM_ATTENDANCE_RATIO` **não** é frequência baixa; média
`=== PASSING_AVERAGE` **é** aprovação), e comparação de datas sempre por string ISO.

### O que é verificado manualmente

As telas. O projeto **não tem** teste E2E e este spec **não introduz** framework de E2E —
seria uma dependência nova de peso desproporcional ao tamanho da equipe.

Roteiro manual, executado com `npm run dev` antes de abrir cada PR de fase que mexe em UI:

1. **Professor comum** — entrar em `/painel/`, conferir que os cards aparecem só com dados
   das próprias disciplinas, que nenhum bloco de admin aparece e que o console não tem
   erro de permissão.
2. **Admin** — entrar em `/painel/`, conferir os quatro blocos administrativos e os links.
3. **Aluno em dia** — entrar em `/portal/`, conferir que não há alerta de cobrança.
4. **Aluno inadimplente** — conferir o alerta vermelho e o botão "Pagar".
5. **Estado vazio** — professor sem disciplina e aluno sem nenhuma pendência: a tela não
   pode quebrar nem ficar cheia de caixas vazias.

### Portões de cada PR

`npm run test`, `npm run lint` e `npm run build` verdes, mais o roteiro manual da fase.
Nenhuma fase é considerada pronta com esses comandos falhando.

## Fora de escopo

Explicitamente **não** incluídos neste spec, para evitar ampliação silenciosa:

- **Modelo de matrícula aluno↔disciplina.** O sistema continua tratando todo aluno ativo
  como pertencente a todas as disciplinas (decisão transversal 1). Introduzir matrícula é
  um projeto próprio, com migração de dados e revisão de boletim, frequência e cobrança.
- **Questões dissertativas em provas.** O card de "provas com nota pendente" da Fase 1 é
  preparado para recebê-las, mas o tipo de questão não é criado aqui.
- **Testes E2E / de integração com banco.** Nenhum framework novo.
- **Notificações por e-mail dos dashboards.** Push já existe e é reusado onde faz sentido
  (Fase 6); e-mail continua restrito ao que `src/server/email/resend.ts` já cobre.
- **Personalização do dashboard pelo usuário** (escolher/reordenar cards). Layout fixo.
- **Correção das falhas maiores encontradas na Fase 0.** A auditoria abre issues; a
  correção de cada uma é trabalho próprio, com sua issue e seu PR.
- **Redesenho visual do painel ou do portal.** As fases adicionam conteúdo dentro da
  linguagem visual existente (`PainelShell`, componentes de `src/components/ui`,
  animações conforme `MOTION.md`).
- **Edição colaborativa de apostilas.** A Fase 7 dá leitura e comentário, nunca edição
  compartilhada.
- **Relatórios ou exportações novas em PDF/planilha.** Os dashboards são de tela.

## Entrega

Cada fase segue [CONTRIBUTING.md](../../../CONTRIBUTING.md): issue no GitHub com o rótulo
apropriado (`bug` para a Fase 0, `enhancement` para as demais), branch a partir da `main`
(`feat/dashboard-professor`, `feat/dashboard-aluno`, `fix/auditoria-fluxos-criticos`, etc.),
pull request com `Closes #<número>`, merge para a `main` disparando o deploy. Nada é
commitado direto na `main`.

Antes de iniciar cada fase, escreve-se o plano de implementação dela a partir da seção
correspondente deste documento.
