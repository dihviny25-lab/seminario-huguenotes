# Dashboards do professor e do aluno — plano de implementação

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development`
> (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa a tarefa.
> Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** entregar, em 8 fases independentes, os dashboards de pendências do professor e do
aluno, mais as melhorias de fórum, acompanhamento por disciplina, tarefas objetivas e
compartilhamento entre professores descritas no spec.

**Arquitetura:** toda regra de negócio nova nasce como função pura em `src/lib/` (recebendo linhas
já carregadas) com teste Vitest ao lado; as `createServerFn` em `src/functions/` só autenticam,
consultam o banco com poucas queries amplas (`inArray`) e chamam a função pura; a agregação é
sempre em memória, no mesmo estilo de `src/functions/reportData.ts`. A UI consome as server
functions via TanStack Query e vive em componentes pequenos, um por card.

**Tech Stack:** TanStack Start (server functions) + TanStack Router + TanStack Query, React 19,
Drizzle ORM sobre Neon Postgres, Zod, Vitest, Tailwind 4 + shadcn/Radix (`src/components/ui`),
lucide-react.

**Spec:** `docs/superpowers/specs/2026-08-31-dashboards-professor-aluno-design.md` — leia junto
com este plano; ele é a autoridade sobre *o que* construir.

> **Status deste documento (2026-09-01):** só a **Fase 0** (auditoria de erros do sistema) está
> detalhada em tarefas abaixo. As Fases 2-7 ainda precisam ser escritas nesta mesma estrutura
> (uma seção `## Fase N` com tarefas `### Tarefa N.M` no padrão desta) antes de serem executadas.
>
> **A Fase 1 (dashboard do professor) não precisa mais ser planejada aqui** — foi implementada
> de forma independente, em paralelo, no branch `worktree-feat+dashboard-professor`
> (worktree em `.claude/worktrees/feat+dashboard-professor`, spec própria em
> `docs/superpowers/specs/2026-08-28-dashboard-professor-design.md`, plano próprio em
> `docs/superpowers/plans/2026-08-28-dashboard-professor.md`). As 4 tasks desse plano foram
> concluídas, revisadas (por task + revisão final de branch inteira + 1 rodada de correção) e o
> PR está aberto: https://github.com/dihviny25-lab/seminario-huguenotes/pull/27 (issue #22).
> Pendência conhecida documentada no PR: `pickEndingDisciplines` não preserva a contagem real
> acima de 8 disciplinas encerrando ao mesmo tempo (achado importante, parked, correção rápida
> de acompanhamento sugerida).

## Ordem de execução

```
Fase 0 (auditoria)  ║ em paralelo ║  Fase 1 (painel do professor)
                                        │
                            ┌───────────┴───────────┐
                            ▼                       ▼
                     Fase 2 (portal)         Fase 3 (apagar tópico)
                            └───────────┬───────────┘
                                        ▼
                                Fase 4 (acompanhamento)
                                        ▼
                                Fase 5 (tarefas objetivas)
                            ┌───────────┴───────────┐
                            ▼                       ▼
                   Fase 6 (fórum interno)   Fase 7 (apostilas)
```

Cada fase vira sua própria issue, branch e pull request, conforme
[CONTRIBUTING.md](../../../CONTRIBUTING.md) — `Closes #<número>` na descrição do PR, nada
commitado direto na `main`.

## Global Constraints

Valem para **todas** as tarefas deste plano. Os requisitos de cada tarefa incluem esta seção
implicitamente.

1. **"Aluno matriculado" = `students.active = true`.** Não existe tabela de matrícula
   aluno↔disciplina. Como já faz `getClassReportData` (`src/functions/reportData.ts`), todo aluno
   ativo pertence a toda disciplina. Nenhuma tarefa introduz modelo de matrícula.
2. **Duas funções de agregação no painel, nunca uma.** `getTeacherDashboardFn` usa
   `requireTeacherId()` e devolve o que todo professor vê; `getAdminDashboardFn` usa
   `requireAdminId()` e devolve só o bloco administrativo. A tela só chama a segunda quando
   `role === "admin"` (via `enabled` do TanStack Query). Erro de permissão nunca é caminho normal
   de execução.
3. **Lógica pura em `src/lib/`, consulta em `src/functions/`.** Toda regra nova (próxima aula,
   classificação de cobrança, limiar de frequência, permissão de apagar tópico, correção
   objetiva, acesso a apostila compartilhada) é função pura em `src/lib/`, recebendo linhas já
   carregadas — e é ela que ganha teste. `src/functions/*` só autentica, consulta e chama a pura.
4. **Nomenclatura.** Server functions terminam em `Fn` e são `createServerFn({ method: "GET" | "POST" })`
   com `.validator(zodSchema)` quando recebem parâmetro. Funções puras têm nome de verbo
   (`pickNextLesson`, `classifyCharge`, `buildDisciplineOverview`). Tipos exportados em
   PascalCase no mesmo arquivo da função.
5. **Guards.** `requireTeacherId()`, `requireAdminId()`, `requireStudentId()`,
   `requireAnyIdentity()`, `requireOwnDiscipline(disciplineId)` — todos de `@/server/auth/guard`.
   **Toda** server function nova chama um guard como primeira instrução do handler. Nunca use
   `requireAnyIdentity()` onde o conteúdo é só de professor.
6. **Agregação em memória.** Poucas queries amplas com `inArray` sobre os ids das disciplinas,
   disparadas em `Promise.all`, agregação em JavaScript. Nada de SQL agregado nem view
   materializada. Sempre guarde as queries com `ids.length === 0 ? [] : db.select()…` — `inArray`
   com lista vazia quebra.
7. **Datas são strings ISO.** `lessons.date`, `charges.dueDate` e `expenses.date` são colunas
   `date` (`"YYYY-MM-DD"`). Comparação é sempre lexicográfica entre strings — nunca converter
   para `Date` local. O "hoje" do servidor é `new Date().toISOString().slice(0, 10)`, repetido
   como helper local `todayIso()` no arquivo que precisa (padrão já usado em
   `src/functions/payments.ts:36` e `src/functions/readingMaterials.ts:10`).
8. **"Aula que já aconteceu" vs. "próxima aula".** Para frequência, aula passada é
   `date !== null && date <= hoje` (regra existente de `reportData.ts`, não mude). Para "próxima
   aula", `pickNextLesson` considera `date !== null && date >= hoje` — a aula de hoje ainda
   aparece na agenda. A sobreposição no dia de hoje é deliberada.
9. **Limiares.** `MINIMUM_ATTENDANCE_RATIO` (`@/lib/attendance`, 0.75) e `PASSING_AVERAGE`
   (`@/lib/grades`, 7). `ratio === MINIMUM_ATTENDANCE_RATIO` **não** é frequência baixa;
   `average === PASSING_AVERAGE` **é** aprovação.
10. **Card vazio some.** Nenhum card de dashboard renderiza estado "nada aqui". No painel, se
    todos os cards estiverem vazios, aparece uma única linha "Nada pendente por aqui.".
11. **Mudanças de schema via `db:push`.** Fases 5, 6 e 7 alteram `src/server/db/schema.ts` e
    aplicam com `npm run db:push`. Toda coluna nova em tabela existente entra com `default`
    compatível com as linhas antigas. Não há migrações versionadas commitadas.
12. **Idioma.** UI, mensagens de erro e comentários de código em **português**. Descrições de
    teste (`describe`/`it`) em **inglês**, seguindo o padrão dos testes existentes
    (`src/lib/attendance.test.ts`, `src/lib/payments.test.ts`, `src/server/auth/password.test.ts`).
13. **Testes — só na Fase 0.** Vitest, arquivo `.test.ts` ao lado do arquivo testado, importando
    pelo alias `@/…`. Rodar um arquivo só: `npx vitest run src/lib/dashboard.test.ts`. Casos de
    borda obrigatórios em toda função pura: lista vazia, `date` nula, disciplina sem aulas
    passadas, peso total zero, valor exatamente no limiar.
    > **Atualizado em 2026-09-01:** a partir da Fase 2, o usuário pediu para **não** escrever
    > testes automatizados sem pedir explicitamente — foco em implementação funcionando primeiro.
    > As tarefas da Fase 2 em diante NÃO incluem passo de escrever `.test.ts`; verificação é via
    > `npm run lint` + `npm run build` + roteiro manual. A estrutura de função pura em `src/lib/`
    > continua (item 3) — só fica testável depois, se/quando pedido. A Fase 0 (já escrita) e a
    > Fase 1 (já implementada em PR separado) mantêm os testes que já têm.
14. **`src/lib/` nunca importa `src/server/`.** O `importProtection` do `vite.config.ts` quebra o
    build do cliente se um arquivo de client importar `**/server/**`. Funções puras recebem dados
    por parâmetro, sempre.
15. **UI.** Componentes de `src/components/ui` (shadcn/Radix já instalado), `PainelShell` /
    `PortalShell` como casca, `Skeleton` para carregamento, ícones `lucide-react`, animações
    conforme [MOTION.md](../../../MOTION.md) (`animate-in fade-in slide-in-from-top-1 duration-200`,
    o padrão já usado em `PortalHome.tsx`).
16. **Portões de cada PR.** `npm run test`, `npm run lint` e `npm run build` verdes, mais o
    roteiro manual da fase (§ "Roteiro manual" no fim deste plano). Nenhuma fase é dada como
    pronta com esses comandos falhando.
17. **Commits frequentes.** Cada tarefa termina em commit próprio, mensagem curta em português no
    formato `tipo: descrição` (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`).

---

## Fase 0 — Auditoria de erros do sistema

Varredura dirigida de seis fluxos críticos. **Correção trivial** (um único arquivo, sem mudança de
schema, sem mudança de contrato de função exportada, coberta por teste unitário puro) entra neste
PR; todo o resto vira issue `bug` com reprodução descrita e **não** é corrigido aqui.

O relatório vive em `docs/superpowers/audits/2026-08-31-auditoria-fluxos-criticos.md` e o seu
conteúdo é copiado para a descrição da issue/PR da fase.

### Tarefa 0.1 — Documento de achados + fluxo 1 (autenticação e sessão)

**Arquivos:**
- Criar: `docs/superpowers/audits/2026-08-31-auditoria-fluxos-criticos.md`
- Ler: `src/server/auth/session.ts`, `src/server/auth/studentSession.ts`,
  `src/server/auth/guard.ts`, `src/functions/auth.ts`, `src/functions/studentAuth.ts`,
  `src/functions/passwordReset.ts`
- Modificar (só se houver correção trivial): o arquivo do achado
- Test (só se houver correção trivial em função pura): `.test.ts` ao lado

**Interfaces:**
- Consome: nada.
- Produz: o arquivo de achados com a estrutura de seções que as tarefas 0.2–0.6 preenchem.

- [ ] **Passo 1: Criar o documento de achados com o esqueleto das seis seções**

```markdown
# Auditoria dos fluxos críticos — 2026-08-31

Cada achado: `severidade (alta/média/baixa)` · `destino (corrigido aqui / issue #N)` ·
reprodução em uma frase.

## 1. Autenticação e sessão
## 2. Pagamentos
## 3. Notas e frequência
## 4. Correção de provas
## 5. Geração de PDF
## 6. Push notifications
```

- [ ] **Passo 2: Percorrer os arquivos do fluxo 1 procurando estes pontos**

Pontos de atenção, um a um:
- expiração e rotação da sessão de professor e de aluno (`session.ts`, `studentSession.ts`);
- token de reset: uso único e expiração de 1h (`teachers.resetToken`, `students.resetToken`,
  `resetTokenExpiresAt`);
- token de verificação de e-mail separado do de senha (`students.emailVerificationToken`) —
  pedir um não pode invalidar o outro;
- `students.calendarToken` — token longo sem expiração que dá acesso ao feed `.ics`
  (`src/routes/agenda[.]ics.tsx`): confirmar que não vaza dado além da agenda;
- **toda** server function sensível chama de fato um `require*` como primeira instrução. Varra com
  `rg "createServerFn" -A 6 src/functions` e confira função por função.

- [ ] **Passo 3: Registrar cada achado na seção 1 do documento**

Formato de cada linha: `- **[alta] Sessão de aluno não é rotacionada no login** — destino: issue.
Repro: logar, copiar cookie, trocar de senha, cookie antigo continua válido.`

- [ ] **Passo 4: Aplicar as correções triviais deste fluxo, cada uma com teste**

Só o que cabe no critério de trivial. Se a correção envolve função pura, escreva primeiro o teste
que falha, no padrão de `src/server/auth/password.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { funcaoCorrigida } from "@/server/auth/arquivo";

describe("funcaoCorrigida", () => {
  it("rejects an expired token", () => {
    expect(funcaoCorrigida({ expiresAt: "2020-01-01T00:00:00.000Z" }, "2026-08-31T00:00:00.000Z")).toBe(false);
  });
});
```

- [ ] **Passo 5: Rodar os testes**

Run: `npm run test`
Expected: PASS (todos os arquivos, inclusive os pré-existentes)

- [ ] **Passo 6: Commit**

```bash
git add docs/superpowers/audits/2026-08-31-auditoria-fluxos-criticos.md src/server/auth src/functions
git commit -m "docs: registra achados da auditoria de autenticação e sessão"
```

### Tarefa 0.2 — Fluxo 2: pagamentos

**Arquivos:**
- Modificar: `docs/superpowers/audits/2026-08-31-auditoria-fluxos-criticos.md` (seção 2)
- Ler: `src/server/payments/mercadopago.ts`, `src/functions/payments.ts`,
  `src/routes/api/` (webhook), `src/lib/payments.ts`
- Test (se houver correção trivial): `src/lib/payments.test.ts`

**Interfaces:**
- Consome: o documento criado na Tarefa 0.1.
- Produz: seção 2 preenchida.

- [ ] **Passo 1: Percorrer os pontos de atenção do fluxo**

- idempotência do webhook: pagamento notificado duas vezes não pode duplicar baixa nem somar
  `paidAmount` duas vezes;
- consistência entre `charges.status`, `paidAt`, `paidAmount` e `paidManually` em cada caminho
  (pago pelo site, baixa manual, desfazer pagamento em `src/functions/payments.ts:480+`);
- desconto por pontualidade: `computeCurrentAmount` usa `todayIso <= dueDate`; confira se o valor
  gravado em `paidAmount` é o mesmo que foi cobrado na preference;
- unicidade da geração mensal: `charges.period` no formato `"YYYY-MM"` — confira se existe
  proteção contra gerar o mesmo período duas vezes para o mesmo aluno.

- [ ] **Passo 2: Registrar os achados na seção 2, com severidade e destino**

- [ ] **Passo 3: Aplicar correções triviais, com teste de regressão em `src/lib/payments.test.ts`**

```ts
it("keeps the full amount when the due date has already passed", () => {
  expect(
    computeCurrentAmount({ fullAmount: 250, discountPercent: 20, dueDate: "2026-08-10" }, "2026-08-11"),
  ).toBe(250);
});
```

- [ ] **Passo 4: Rodar os testes**

Run: `npm run test`
Expected: PASS

- [ ] **Passo 5: Commit**

```bash
git add docs/superpowers/audits/2026-08-31-auditoria-fluxos-criticos.md src/lib/payments.test.ts src/functions/payments.ts src/server/payments
git commit -m "docs: registra achados da auditoria de pagamentos"
```

### Tarefa 0.3 — Fluxo 3: notas e frequência

**Arquivos:**
- Modificar: `docs/superpowers/audits/2026-08-31-auditoria-fluxos-criticos.md` (seção 3)
- Ler: `src/lib/grades.ts`, `src/lib/attendance.ts`, `src/functions/reportData.ts`,
  `src/functions/grades.ts`, `src/functions/attendance.ts`
- Test (se houver correção trivial): `src/lib/grades.test.ts`, `src/lib/attendance.test.ts`

**Interfaces:**
- Consome: o documento criado na Tarefa 0.1.
- Produz: seção 3 preenchida. **Atenção:** a Fase 1 assume o comportamento *atual* destes
  helpers; se esta tarefa mudar uma regra, a Fase 1 ajusta os testes que quebrarem.

- [ ] **Passo 1: Percorrer os pontos de atenção**

- `computeWeightedAverage` com peso total zero (hoje devolve `null` — confirme que nenhum chamador
  trata `null` como 0);
- aula com `date` nula: hoje é filtrada como "ainda não aconteceu" (`reportData.ts:77` e `:232`) —
  confira se algum outro lugar conta essas aulas;
- disciplina sem nenhuma aula lançada gerando frequência aparente de 100%
  (`attendanceRatio` é `null` quando `totalLessons === 0` em `reportData.ts:283` — confira os
  consumidores, inclusive `PortalHome.tsx:64`, que usa `1 - totalFaltas / totalLessons`);
- comparação de data por string ISO com fuso: procure qualquer `new Date(dateString)` sobre coluna
  `date` (`rg "new Date\(" src/functions src/lib`).

- [ ] **Passo 2: Registrar os achados na seção 3**

- [ ] **Passo 3: Aplicar correções triviais, com teste de regressão**

- [ ] **Passo 4: Rodar os testes**

Run: `npm run test`
Expected: PASS

- [ ] **Passo 5: Commit**

```bash
git add docs/superpowers/audits/2026-08-31-auditoria-fluxos-criticos.md src/lib src/functions
git commit -m "docs: registra achados da auditoria de notas e frequência"
```

### Tarefa 0.4 — Fluxo 4: correção de provas

**Arquivos:**
- Modificar: `docs/superpowers/audits/2026-08-31-auditoria-fluxos-criticos.md` (seção 4)
- Ler: `src/server/exams/scoring.ts`, `src/functions/examAttempts.ts`, `src/functions/exams.ts`
- Test (se houver correção trivial em função pura): `.test.ts` ao lado

**Interfaces:**
- Consome: o documento criado na Tarefa 0.1.
- Produz: seção 4 preenchida. Achados aqui informam a Fase 5, que mexe neste motor.

- [ ] **Passo 1: Percorrer os pontos de atenção**

- idempotência de `finalizeExamAttempt` (protegida por `if (!attempt || attempt.submittedAt) return;`
  — confirme que todos os caminhos passam por ela);
- fechamento por tempo esgotado (`autoSubmitted`) versus clique manual: quem calcula o prazo a
  partir de `startedAt` + `durationMinutes`, e se o cliente consegue burlar;
- tentativa iniciada e nunca enviada: fica com `submittedAt` nulo para sempre e sem nota;
- a escrita em `grades` (`onConflictDoUpdate`) conflitando com `setGradeFn`: uma correção manual
  posterior é sobrescrita? o contrário?

- [ ] **Passo 2: Registrar os achados na seção 4**

- [ ] **Passo 3: Aplicar correções triviais, com teste**

- [ ] **Passo 4: Rodar os testes**

Run: `npm run test`
Expected: PASS

- [ ] **Passo 5: Commit**

```bash
git add docs/superpowers/audits/2026-08-31-auditoria-fluxos-criticos.md src/server/exams src/functions/examAttempts.ts
git commit -m "docs: registra achados da auditoria de correção de provas"
```

### Tarefa 0.5 — Fluxo 5: geração de PDF

**Arquivos:**
- Modificar: `docs/superpowers/audits/2026-08-31-auditoria-fluxos-criticos.md` (seção 5)
- Ler: `src/functions/reportPdf.tsx`, `src/functions/receiptPdf.tsx`
- Test: `src/functions/reportPdf.test.ts`

**Interfaces:**
- Consome: o documento criado na Tarefa 0.1.
- Produz: seção 5 preenchida.

- [ ] **Passo 1: Percorrer os pontos de atenção**

Nomes longos (quebra de layout/`slugify`), acentuação, aluno sem nenhuma nota (`average === null`),
disciplina sem avaliações (array vazio de colunas).

- [ ] **Passo 2: Escrever teste de regressão para cada caso que hoje falha**

No padrão de `src/functions/reportPdf.test.ts`, que já monta `Array<StudentReportRow>` na mão:

```ts
it("renders a student with no grades at all", async () => {
  const rows: Array<StudentReportRow> = [
    { ...sampleRows[0], average: null, assessments: [] },
  ];
  await expect(
    renderStudentReportPdf({ student: { id: "s1", name: "Maria" }, rows }),
  ).resolves.toBeDefined();
});
```

- [ ] **Passo 3: Rodar o teste para ver falhar (quando houver defeito real)**

Run: `npx vitest run src/functions/reportPdf.test.ts`
Expected: FAIL no caso reproduzido — ou PASS, e então o achado é registrado como "não reproduz".

- [ ] **Passo 4: Corrigir se for trivial; senão, abrir issue e reverter o teste para `it.skip`
      com o número da issue no comentário**

- [ ] **Passo 5: Rodar os testes e commitar**

```bash
npm run test
git add docs/superpowers/audits/2026-08-31-auditoria-fluxos-criticos.md src/functions/reportPdf.test.ts src/functions/reportPdf.tsx src/functions/receiptPdf.tsx
git commit -m "docs: registra achados da auditoria de geração de PDF"
```

### Tarefa 0.6 — Fluxo 6: push notifications

**Arquivos:**
- Modificar: `docs/superpowers/audits/2026-08-31-auditoria-fluxos-criticos.md` (seção 6)
- Ler: `src/server/push.ts`, `src/functions/pushSubscriptions.ts`, `src/lib/pushClient.ts`,
  `src/functions/forum.ts:257-265`

**Interfaces:**
- Consome: o documento criado na Tarefa 0.1.
- Produz: seção 6 preenchida. A Fase 6 reusa `sendPushToOwner("teacher", …)` — achados aqui valem
  para lá também.

- [ ] **Passo 1: Percorrer os pontos de atenção**

- inscrição expirada/revogada (HTTP 404/410 do endpoint) sem limpeza da linha em
  `push_subscriptions`;
- envio duplicado para o mesmo dono (o mesmo professor com várias inscrições é esperado; o mesmo
  *endpoint* duas vezes não é);
- falha de push derrubando a operação principal: em `replyToThreadFn` o `Promise.all` dos envios
  está **fora** de try/catch — se um `sendPushToOwner` rejeitar, a resposta do fórum já foi
  gravada mas a server function estoura para o usuário.

- [ ] **Passo 2: Registrar os achados na seção 6**

- [ ] **Passo 3: Aplicar correções triviais**

A blindagem do push contra derrubar a operação principal é candidata natural a trivial (um arquivo,
sem mudança de contrato):

```ts
// Push é acessório: falha de notificação não pode derrubar a operação que já foi gravada.
await Promise.allSettled(
  [...participants.values()].map((participant) => sendPushToOwner(/* … */)),
);
```

- [ ] **Passo 4: Rodar os testes**

Run: `npm run test`
Expected: PASS

- [ ] **Passo 5: Commit**

```bash
git add docs/superpowers/audits/2026-08-31-auditoria-fluxos-criticos.md src/server/push.ts src/functions
git commit -m "fix: push não derruba mais a operação principal no fórum"
```

### Tarefa 0.7 — Fechar a auditoria: issues, revisão e portões

**Arquivos:**
- Modificar: `docs/superpowers/audits/2026-08-31-auditoria-fluxos-criticos.md`

**Interfaces:**
- Consome: as seis seções preenchidas pelas tarefas 0.1–0.6.
- Produz: nenhum código; o documento fechado, pronto para virar a descrição do PR.

- [ ] **Passo 1: Abrir uma issue por achado não trivial**

```bash
gh issue create --title "Título curto do achado" --body "Fluxo: pagamentos

Reprodução:
1. …
2. …

Comportamento esperado: …
Comportamento atual: …

Encontrado na auditoria dos fluxos críticos (Fase 0)." --label bug
```

- [ ] **Passo 2: Preencher o campo `destino` de cada achado com `issue #N` ou `corrigido aqui`**

Nenhum achado pode ficar sem destino — esse é o critério de pronto da fase.

- [ ] **Passo 3: Rodar os portões**

Run: `npm run test && npm run lint && npm run build`
Expected: os três PASS

- [ ] **Passo 4: Commit**

```bash
git add docs/superpowers/audits/2026-08-31-auditoria-fluxos-criticos.md
git commit -m "docs: fecha o relatório da auditoria dos fluxos críticos"
```

---

## Fase 2 — Dashboard do aluno

Completa `/portal/` (`src/pages/portal/PortalHome.tsx`) com os três avisos que hoje ficam
escondidos em subpáginas: cobrança pendente/vencida, próxima aula e vídeo-aulas novas.
Depende da Fase 1 já estar mergeada — reaproveita `pickNextLesson` de `src/lib/dashboard.ts`,
criado lá.

### Tarefa 2.1 — Lógica pura: alerta de cobrança

**Arquivos:**
- Criar (ou complementar, se a Fase 1 já criou o arquivo com `pickNextLesson` e outros
  helpers): `src/lib/dashboard.ts`
- Ler: `src/lib/payments.ts` (estilo de função pura + `computeCurrentAmount`), `src/functions/payments.ts`
  (`Charge`, `listMyChargesFn`, `todayIso()` local)

**Interfaces:**
- Consome: nada (função pura, recebe linhas já carregadas).
- Produz: `CHARGE_DUE_SOON_WINDOW_DAYS`, `classifyCharge(charge, todayIso)` e
  `buildChargeAlert(charges, todayIso)`, usados pela Tarefa 2.4.

- [ ] **Passo 1: Escrever `classifyCharge` e a janela de "vence em breve"**

```ts
/** Janela de "vence em breve" pro alerta de cobrança do topo do portal do aluno. */
export const CHARGE_DUE_SOON_WINDOW_DAYS = 7;

export type ChargeUrgency = "overdue" | "due-soon" | "ok";

export type ChargeUrgencyInput = {
  status: "pending" | "paid" | "canceled";
  /** ISO "YYYY-MM-DD". */
  dueDate: string;
};

/**
 * Urgência de uma cobrança pro alerta do portal. Só `pending` pode ser
 * "overdue"/"due-soon" — `paid` e `canceled` são sempre "ok" (nenhum
 * alerta). Comparação por string ISO, nunca `Date` local — mesmo padrão de
 * `computeCurrentAmount` (`src/lib/payments.ts`).
 */
export function classifyCharge(charge: ChargeUrgencyInput, todayIso: string): ChargeUrgency {
  if (charge.status !== "pending") return "ok";
  if (charge.dueDate < todayIso) return "overdue";
  const daysUntilDue = Math.round(
    (Date.parse(charge.dueDate) - Date.parse(todayIso)) / (1000 * 60 * 60 * 24),
  );
  return daysUntilDue <= CHARGE_DUE_SOON_WINDOW_DAYS ? "due-soon" : "ok";
}
```

- [ ] **Passo 2: Escrever `buildChargeAlert`, que escolhe a cobrança em destaque**

```ts
export type ChargeAlertItem = {
  chargeId: string;
  description: string;
  /** String, igual ao `Charge.currentAmount` de `src/functions/payments.ts`. */
  currentAmount: string;
  dueDate: string;
};

export type ChargeAlertInput = ChargeAlertItem & ChargeUrgencyInput;

export type ChargeAlert = { level: "overdue" | "due-soon"; featured: ChargeAlertItem } | null;

/**
 * Alerta de cobrança pro topo do portal: olha as cobranças `pending`,
 * classifica cada uma com `classifyCharge` e escolhe a mais urgente pra
 * destacar. "Vencida" tem prioridade sobre "vence em breve"; dentro do
 * mesmo nível, a de vencimento mais antigo vence a disputa. `null` quando
 * não há nada a dizer (nenhuma pendente, ou todas ainda longe do vencimento).
 */
export function buildChargeAlert(
  charges: Array<ChargeAlertInput>,
  todayIso: string,
): ChargeAlert {
  const urgent = charges
    .map((charge) => ({ charge, urgency: classifyCharge(charge, todayIso) }))
    .filter((c): c is { charge: ChargeAlertInput; urgency: "overdue" | "due-soon" } =>
      c.urgency !== "ok",
    );

  if (urgent.length === 0) return null;

  const overdue = urgent.filter((c) => c.urgency === "overdue");
  const pool = overdue.length > 0 ? overdue : urgent;
  const featured = pool.reduce((oldest, c) =>
    c.charge.dueDate < oldest.charge.dueDate ? c : oldest,
  );

  return {
    level: overdue.length > 0 ? "overdue" : "due-soon",
    featured: {
      chargeId: featured.charge.chargeId,
      description: featured.charge.description,
      currentAmount: featured.charge.currentAmount,
      dueDate: featured.charge.dueDate,
    },
  };
}
```

- [ ] **Passo 3: Checar o arquivo**

Run: `npx eslint src/lib/dashboard.ts && npx tsc --noEmit`
Expected: PASS, sem erros.

- [ ] **Passo 4: Commit**

```bash
git add src/lib/dashboard.ts
git commit -m "feat: adiciona classificação e alerta de cobrança em src/lib/dashboard.ts"
```

### Tarefa 2.2 — Lógica pura: próxima aula do aluno

Reaproveita `pickNextLesson` da Fase 1 — o aluno pertence a todas as disciplinas (decisão
transversal 1), então a "próxima aula" do portal é a mesma função aplicada sobre **todas**
as aulas do currículo de uma vez, não por disciplina.

**Arquivos:**
- Ler: `src/lib/dashboard.ts` (deve já ter `pickNextLesson`, criada na Fase 1)
- Modificar `src/lib/dashboard.ts` **só se** o Passo 1 não encontrar a função (esta fase
  sendo executada antes do merge da Fase 1)

**Interfaces:**
- Consome: nada novo.
- Produz: garante `pickNextLesson<T extends { id: string; disciplineId: string; date: string | null }>(lessons: Array<T>, todayIso: string): T | null`
  disponível pra Tarefa 2.4.

- [ ] **Passo 1: Conferir se a função já existe**

Run: `rg "export function pickNextLesson" src/lib/dashboard.ts`
Expected: uma linha encontrada. Se encontrou, **pule pro Passo 3** — nada a fazer aqui além
de conferir a assinatura acima bate com o uso da Tarefa 2.4.

- [ ] **Passo 2: Implementar (só se o Passo 1 não encontrou nada)**

```ts
export type LessonForNextPick = {
  id: string;
  disciplineId: string;
  /** ISO "YYYY-MM-DD" ou nula (aula sem data marcada ainda). */
  date: string | null;
};

/**
 * A aula futura mais próxima (`date >= hoje`), ignorando aulas com `date`
 * nula. A aula de hoje ainda conta como "próxima" — a sobreposição com
 * "aula que já aconteceu" (`date <= hoje`, usada na frequência) é
 * deliberada (Global Constraint 8).
 */
export function pickNextLesson<T extends LessonForNextPick>(
  lessons: Array<T>,
  todayIso: string,
): T | null {
  const upcoming = lessons.filter(
    (lesson): lesson is T & { date: string } => lesson.date !== null && lesson.date >= todayIso,
  );
  if (upcoming.length === 0) return null;
  return upcoming.reduce((closest, lesson) => (lesson.date < closest.date ? lesson : closest));
}
```

- [ ] **Passo 3: Checar o arquivo**

Run: `npx eslint src/lib/dashboard.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Passo 4: Commit (só se o Passo 2 alterou o arquivo)**

```bash
git add src/lib/dashboard.ts
git commit -m "feat: garante pickNextLesson disponível pro portal do aluno"
```

### Tarefa 2.3 — Lógica pura: vídeo-aulas novas não assistidas

**Arquivos:**
- Modificar: `src/lib/dashboard.ts`
- Ler: `src/server/db/schema.ts` (`videoLessons`, `videoWatches`), `src/functions/videoLessons.ts`
  (`listMyWatchedVideosFn`, `VideoLesson` — note que esse tipo **não** expõe `createdAt`,
  por isso a Tarefa 2.4 consulta `videoLessons` direto em vez de reaproveitar
  `listAllVideoLessonsFn`)

**Interfaces:**
- Consome: nada novo.
- Produz: `selectUnwatchedVideos(videos, watchedVideoLessonIds, limit?)`, usada pela
  Tarefa 2.4.

- [ ] **Passo 1: Escrever a função**

```ts
export type VideoLessonForPortal = {
  id: string;
  disciplineId: string;
  title: string;
  /** ISO, `videoLessons.createdAt` — usado só pra ordenar, não exibido. */
  createdAt: string;
};

/**
 * Vídeo-aulas que o aluno ainda não concluiu, mais recentes primeiro,
 * limitadas a `limit`. `watchedVideoLessonIds` vem das linhas de
 * `video_watches` do próprio aluno (mesmo dado de `listMyWatchedVideosFn`).
 */
export function selectUnwatchedVideos<T extends VideoLessonForPortal>(
  videos: Array<T>,
  watchedVideoLessonIds: Array<string>,
  limit = 5,
): Array<T> {
  const watched = new Set(watchedVideoLessonIds);
  return videos
    .filter((video) => !watched.has(video.id))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);
}
```

- [ ] **Passo 2: Checar o arquivo**

Run: `npx eslint src/lib/dashboard.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Passo 3: Commit**

```bash
git add src/lib/dashboard.ts
git commit -m "feat: adiciona seleção de vídeo-aulas novas em src/lib/dashboard.ts"
```

### Tarefa 2.4 — Server function: `getStudentDashboardFn`

**Arquivos:**
- Criar (ou complementar, se a Fase 1 já criou o arquivo com `getTeacherDashboardFn` /
  `getAdminDashboardFn`): `src/functions/dashboard.ts`
- Ler: `src/functions/payments.ts` (`listMyChargesFn`, tipo `Charge`), `src/functions/videoLessons.ts`
  (`listMyWatchedVideosFn`), `src/server/auth/guard.ts` (`requireStudentId`),
  `src/server/db/schema.ts` (`lessons`, `disciplines`, `videoLessons`, `videoWatches`),
  `src/lib/dashboard.ts` (Tarefas 2.1–2.3)

**Interfaces:**
- Consome: `buildChargeAlert`, `pickNextLesson`, `selectUnwatchedVideos` de
  `src/lib/dashboard.ts`; `listMyChargesFn` de `src/functions/payments.ts`.
- Produz: `getStudentDashboardFn` — `requireStudentId()`, devolve
  `{ chargeAlert, nextLesson, unwatchedVideos }`, consumido pela Tarefa 2.5.

- [ ] **Passo 1: Escrever a server function**

Reaproveita `listMyChargesFn()` direto (já resolve `currentAmount` com desconto/vencimento —
reimplementar essa conta aqui duplicaria `computeCurrentAmount`). Aulas e vídeos são
consultados direto: aulas porque não existe hoje uma função "todas as aulas do currículo", e
vídeos porque `listAllVideoLessonsFn` não expõe `createdAt` (Tarefa 2.3). Sem `disciplineId`
pra filtrar — todo aluno ativo pertence a todas as disciplinas (decisão transversal 1), então
as tabelas são lidas por inteiro, do mesmo jeito que `reportData.ts` já faz.

```ts
import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";

import { buildChargeAlert, pickNextLesson, selectUnwatchedVideos } from "@/lib/dashboard";
import type { ChargeAlert } from "@/lib/dashboard";
import { listMyChargesFn } from "@/functions/payments";
import { listMyWatchedVideosFn } from "@/functions/videoLessons";
import { requireStudentId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { disciplines, lessons, videoLessons } from "@/server/db/schema";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export type StudentNextLesson = {
  id: string;
  disciplineId: string;
  disciplineName: string;
  date: string;
};

export type StudentUnwatchedVideo = {
  id: string;
  disciplineId: string;
  disciplineName: string;
  title: string;
};

export type StudentDashboard = {
  chargeAlert: ChargeAlert;
  nextLesson: StudentNextLesson | null;
  unwatchedVideos: Array<StudentUnwatchedVideo>;
};

/** Avisos do topo do portal do aluno: cobrança, próxima aula, vídeos novos. */
export const getStudentDashboardFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<StudentDashboard> => {
    const studentId = await requireStudentId();
    const today = todayIso();

    const [myCharges, watchedIds, lessonRows, videoRows] = await Promise.all([
      listMyChargesFn(),
      listMyWatchedVideosFn(),
      db
        .select({
          id: lessons.id,
          disciplineId: lessons.disciplineId,
          disciplineName: disciplines.discipline,
          date: lessons.date,
        })
        .from(lessons)
        .innerJoin(disciplines, eq(disciplines.id, lessons.disciplineId)),
      db
        .select({
          id: videoLessons.id,
          disciplineId: videoLessons.disciplineId,
          disciplineName: disciplines.discipline,
          title: videoLessons.title,
          createdAt: videoLessons.createdAt,
        })
        .from(videoLessons)
        .innerJoin(disciplines, eq(disciplines.id, videoLessons.disciplineId)),
    ]);

    const chargeAlert = buildChargeAlert(
      myCharges.map((c) => ({
        chargeId: c.id,
        description: c.description,
        currentAmount: c.currentAmount,
        dueDate: c.dueDate,
        status: c.status,
      })),
      today,
    );

    const next = pickNextLesson(lessonRows, today);
    const nextLesson: StudentNextLesson | null = next
      ? {
          id: next.id,
          disciplineId: next.disciplineId,
          disciplineName: next.disciplineName,
          date: next.date!,
        }
      : null;

    const unwatchedVideos = selectUnwatchedVideos(
      videoRows.map((v) => ({ ...v, createdAt: v.createdAt.toISOString() })),
      watchedIds,
    ).map(({ id, disciplineId, disciplineName, title }) => ({
      id,
      disciplineId,
      disciplineName,
      title,
    }));

    return { chargeAlert, nextLesson, unwatchedVideos };
  },
);
```

- [ ] **Passo 2: Checar o arquivo**

Run: `npx eslint src/functions/dashboard.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Passo 3: Commit**

```bash
git add src/functions/dashboard.ts
git commit -m "feat: adiciona getStudentDashboardFn"
```

### Tarefa 2.5 — Integrar os três avisos em `PortalHome.tsx`

**Arquivos:**
- Modificar: `src/pages/portal/PortalHome.tsx`
- Ler: `src/components/ui/alert.tsx` (`Alert`/`AlertTitle`/`AlertDescription` — só tem
  variantes `default`/`destructive`; "vence em breve" usa classe própria, não há variante
  âmbar pronta), `src/pages/portal/PortalPayments.tsx:21` (`formatAmount`, padrão de
  formatação de moeda a repetir aqui)

**Interfaces:**
- Consome: `getStudentDashboardFn` da Tarefa 2.4.
- Produz: nada (fim da fase — UI consumindo o dado agregado).

- [ ] **Passo 1: Query nova, sem tocar nas existentes**

Em `PortalHome.tsx`, adicionar ao lado das outras `useQuery`:

```tsx
import { getStudentDashboardFn } from "@/functions/dashboard";
// ...
const { data: dashboard } = useQuery({
  queryKey: ["student-dashboard"],
  queryFn: () => getStudentDashboardFn(),
});
```

- [ ] **Passo 2: Alerta de cobrança, acima do grid de média/frequência/faltas**

Adicionar `formatAmount`/`formatDate` locais (mesmo padrão de `PortalPayments.tsx`) e o
bloco condicional logo no início do `<PortalShell>`, antes do `{loadingReport ? ... }`:

```tsx
{dashboard?.chargeAlert ? (
  <Alert
    variant={dashboard.chargeAlert.level === "overdue" ? "destructive" : "default"}
    className={cn(
      "mb-6 animate-in fade-in slide-in-from-top-1 duration-200",
      dashboard.chargeAlert.level === "due-soon" &&
        "border-amber-500/50 text-amber-700 dark:border-amber-500 dark:text-amber-400 [&>svg]:text-amber-600",
    )}
  >
    <AlertTriangle className="size-4" aria-hidden />
    <AlertTitle>
      {dashboard.chargeAlert.level === "overdue" ? "Cobrança vencida" : "Cobrança vence em breve"}
    </AlertTitle>
    <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
      <span>
        {dashboard.chargeAlert.featured.description} —{" "}
        {formatAmount(dashboard.chargeAlert.featured.currentAmount)}, vencimento{" "}
        {formatDate(dashboard.chargeAlert.featured.dueDate)}
      </span>
      <Button asChild size="sm">
        <Link to="/portal/pagamentos">Pagar</Link>
      </Button>
    </AlertDescription>
  </Alert>
) : null}
```

Import `Alert, AlertTitle, AlertDescription` de `@/components/ui/alert` e `Button` de
`@/components/ui/button`.

- [ ] **Passo 3: Cards de "Próxima aula" e "Vídeo-aulas novas"**

Entram no mesmo grid `lg:grid-cols-3`, depois do card "Provas agendadas" e antes de "Fórum
em atividade" (a grid já quebra linha sozinha com 5 itens). Reaproveita o componente
`DashboardCard` já existente no arquivo:

```tsx
<DashboardCard
  title="Próxima aula"
  icon={CalendarClock}
  viewAllTo="/portal/disciplinas"
  loading={!dashboard}
  emptyLabel="Nenhuma aula agendada no momento."
>
  {dashboard?.nextLesson ? (
    <Link
      to="/portal/disciplinas/$disciplineId"
      params={{ disciplineId: dashboard.nextLesson.disciplineId }}
      className="flex animate-in items-start gap-2.5 rounded-md border border-border/70 bg-card/70 p-3 shadow-soft fade-in slide-in-from-top-1 duration-200 transition-colors hover:border-primary/50"
    >
      <CalendarClock className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {dashboard.nextLesson.disciplineName}
        </span>
        <span className="block text-xs text-muted-foreground">
          {formatDate(dashboard.nextLesson.date)}
        </span>
      </span>
    </Link>
  ) : null}
</DashboardCard>

<DashboardCard
  title="Vídeo-aulas novas"
  icon={Video}
  viewAllTo="/portal/videos"
  loading={!dashboard}
  emptyLabel="Nenhuma vídeo-aula nova."
>
  {(dashboard?.unwatchedVideos ?? []).map((video) => (
    <Link
      key={video.id}
      to="/portal/videos"
      className="flex animate-in items-start gap-2.5 rounded-md border border-border/70 bg-card/70 p-3 shadow-soft fade-in slide-in-from-top-1 duration-200 transition-colors hover:border-primary/50"
    >
      <Video className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{video.title}</span>
        <span className="block text-xs text-muted-foreground">{video.disciplineName}</span>
      </span>
    </Link>
  ))}
</DashboardCard>
```

Import `Video` de `lucide-react` (já importa `CalendarClock`). "Card vazio some" (Global
Constraint 10) já é garantido pelo próprio `DashboardCard` — não é preciso lógica extra.

- [ ] **Passo 4: Checar o arquivo e o roteiro manual**

Run: `npx eslint src/pages/portal/PortalHome.tsx && npx tsc --noEmit`
Expected: PASS.

Rodar `npm run dev`, logar como aluno em dia (nenhum alerta), depois como aluno com cobrança
vencida e com cobrança vencendo em 3 dias (alerta vermelho e âmbar, respectivamente,
botão "Pagar" funcionando); conferir "Próxima aula" e "Vídeo-aulas novas" aparecendo e
sumindo conforme o estado, sem quebrar quando tudo está vazio.

- [ ] **Passo 5: Build final da fase**

Run: `npm run build`
Expected: PASS.

- [ ] **Passo 6: Commit**

```bash
git add src/pages/portal/PortalHome.tsx
git commit -m "feat: mostra cobrança, próxima aula e vídeos novos na home do portal"
```

---

## Fase 3 — Aluno apaga o próprio tópico sem respostas

Fecha uma lacuna de simetria no fórum: o aluno já pode apagar a própria mensagem
(`deletePostFn`), mas não o próprio tópico criado por engano. `deleteThreadFn`
(`src/functions/forum.ts:274`) hoje só permite ao professor dono da disciplina (moderação).

### Tarefa 3.1 — Permissão de exclusão (função pura + servidor)

**Arquivos:**
- Criar: `src/lib/forumPermissions.ts`
- Modificar: `src/functions/forum.ts` (`deleteThreadFn`, `getThreadFn`, `ForumThreadDetail`)
- Ler: `src/server/db/schema.ts` (`forumThreads`, `forumPosts`, `disciplines`),
  `src/server/auth/guard.ts` (`requireAnyIdentity`)

**Interfaces:**
- Consome: nada externo.
- Produz: `canDeleteThread({ isModerator, isAuthor, postCount })`, reaproveitada pela
  Tarefa 3.2 na UI (e, mais adiante, pela Fase 6 no fórum interno — por isso a assinatura é
  genérica, sem falar de disciplina); `ForumThreadDetail.mine`, novo campo consumido pela
  Tarefa 3.2.

- [ ] **Passo 1: Escrever a função pura**

```ts
export type CanDeleteThreadInput = {
  /** Professor dono da disciplina do tópico (moderação) — ou, no fórum interno da Fase 6, admin. */
  isModerator: boolean;
  /** Quem pede a exclusão é o autor do tópico. */
  isAuthor: boolean;
  /** Respostas no tópico, sem contar a mensagem inicial (que sempre existe). */
  postCount: number;
};

/**
 * Quem pode apagar um tópico de fórum. Moderador sempre pode; o próprio
 * autor só pode se ainda não houver nenhuma resposta — apagar um tópico
 * criado por engano não deve depender de moderação, mas uma discussão já
 * em andamento não pode sumir por decisão unilateral do autor.
 */
export function canDeleteThread({
  isModerator,
  isAuthor,
  postCount,
}: CanDeleteThreadInput): boolean {
  if (isModerator) return true;
  return isAuthor && postCount === 0;
}
```

- [ ] **Passo 2: Trocar a permissão de `deleteThreadFn`**

Hoje o schema recebe `disciplineId` só pra alimentar `requireOwnDiscipline` — mas nada
confere que aquele tópico é mesmo daquela disciplina. Trocar por buscar o tópico (e a
disciplina dele) a partir do `threadId`, no mesmo padrão de `deletePostFn`, que já não
depende de o cliente informar a disciplina:

```ts
import { canDeleteThread } from "@/lib/forumPermissions";
// ...
const deleteThreadSchema = z.object({ threadId: z.string().uuid() });

/**
 * Apaga um tópico: o professor dono da disciplina sempre pode (moderação);
 * o autor (professor ou aluno) só pode se ainda não houver nenhuma
 * resposta. A contagem de posts é feita imediatamente antes do delete,
 * aceitando a corrida rara em que uma resposta chega no meio do caminho —
 * o custo de apagar um tópico com uma resposta recém-criada é baixo.
 */
export const deleteThreadFn = createServerFn({ method: "POST" })
  .validator(deleteThreadSchema)
  .handler(async ({ data }) => {
    const identity = await requireAnyIdentity();

    const [thread] = await db
      .select()
      .from(forumThreads)
      .where(eq(forumThreads.id, data.threadId))
      .limit(1);
    if (!thread) throw new Error("Tópico não encontrado.");

    const [discipline] = await db
      .select({ teacherId: disciplines.teacherId })
      .from(disciplines)
      .where(eq(disciplines.id, thread.disciplineId))
      .limit(1);
    const isModerator = identity.role === "teacher" && discipline?.teacherId === identity.id;
    const isAuthor =
      (identity.role === "teacher" && thread.authorTeacherId === identity.id) ||
      (identity.role === "student" && thread.authorStudentId === identity.id);

    const postRows = await db
      .select({ id: forumPosts.id })
      .from(forumPosts)
      .where(eq(forumPosts.threadId, data.threadId));
    // A mensagem inicial do tópico também é uma linha de forumPosts — só
    // conta como "resposta" o que vier depois dela.
    const postCount = Math.max(0, postRows.length - 1);

    if (!canDeleteThread({ isModerator, isAuthor, postCount })) {
      throw new Error("Só é possível apagar um tópico que ainda não tem respostas.");
    }

    await db.delete(forumThreads).where(eq(forumThreads.id, data.threadId));

    // Auditoria só quando é o professor moderando — o aluno apagando o
    // próprio tópico vazio é correção trivial, não polui o log administrativo.
    if (isModerator) {
      await logAudit("forum.apagar_topico", `Apagou o tópico "${thread.title}" do fórum.`);
    }
  });
```

Não precisa mais importar `requireOwnDiscipline` neste arquivo, a menos que outra função no
mesmo arquivo ainda o use (`deletePostFn` usa — manter o import).

- [ ] **Passo 3: Expor `mine` em `getThreadFn`**

`ForumThreadDetail` ganha o campo, calculado com a mesma lógica já usada pra `post.mine`:

```ts
export type ForumThreadDetail = {
  id: string;
  disciplineId: string;
  title: string;
  /** O tópico foi criado por quem está logado agora. */
  mine: boolean;
  posts: Array<ForumPost>;
};
```

E no handler de `getThreadFn`, no `return`:

```ts
return {
  id: thread.id,
  disciplineId: thread.disciplineId,
  title: thread.title,
  mine:
    (identity.role === "teacher" && thread.authorTeacherId === identity.id) ||
    (identity.role === "student" && thread.authorStudentId === identity.id),
  posts: postRows.map((post) => ({ /* ...like antes... */ })),
};
```

- [ ] **Passo 4: Checar o arquivo**

Run: `npx eslint src/lib/forumPermissions.ts src/functions/forum.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Passo 5: Commit**

```bash
git add src/lib/forumPermissions.ts src/functions/forum.ts
git commit -m "feat: aluno pode apagar o próprio tópico do fórum sem respostas"
```

### Tarefa 3.2 — Botão de apagar no `ForumThreadView`

`ForumThreadView` (`src/components/forum/ForumThreadView.tsx`) já é compartilhado entre
`src/pages/painel/ForumThread.tsx` (`canModerateThread` sempre `true`) e
`src/pages/portal/PortalForumThread.tsx` (`canModerateThread` sempre `false`, porque aluno
nunca modera). Não é preciso mexer nessas duas páginas — só no componente compartilhado, que
passa a decidir a visibilidade do botão com a mesma regra do servidor.

**Arquivos:**
- Modificar: `src/components/forum/ForumThreadView.tsx`
- Ler: `src/pages/portal/PortalForumThread.tsx`, `src/pages/painel/ForumThread.tsx` (conferir
  que nenhum dos dois precisa mudar)

**Interfaces:**
- Consome: `canDeleteThread` (Tarefa 3.1), `ForumThreadDetail.mine` (Tarefa 3.1).
- Produz: nada (fim da fase).

- [ ] **Passo 1: Calcular `canDelete` e trocar a condição do botão**

```tsx
import { canDeleteThread } from "@/lib/forumPermissions";
// ...
const canDelete =
  thread !== undefined &&
  canDeleteThread({
    isModerator: canModerateThread,
    isAuthor: thread.mine,
    postCount: Math.max(0, thread.posts.length - 1),
  });
```

Trocar a condição do botão de `{canModerateThread ? (...) : null}` para `{canDelete ? (...) : null}`.

- [ ] **Passo 2: Ajustar a mutation — o schema não pede mais `disciplineId`**

```tsx
const deleteThreadMutation = useMutation({
  mutationFn: () => deleteThreadFn({ data: { threadId } }),
  // ...resto igual
});
```

- [ ] **Passo 3: Checar o arquivo**

Run: `npx eslint src/components/forum/ForumThreadView.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Passo 4: Roteiro manual e build final da fase**

Como professor: continuar conseguindo apagar qualquer tópico da própria disciplina, mesmo
com respostas (moderação preservada). Como aluno: criar um tópico, ver o botão "Apagar
tópico", apagar com sucesso; responder ao próprio tópico (ou receber uma resposta) e conferir
que o botão some.

Run: `npm run build`
Expected: PASS.

- [ ] **Passo 5: Commit**

```bash
git add src/components/forum/ForumThreadView.tsx
git commit -m "feat: mostra o botão de apagar tópico pro aluno dono sem respostas"
```

---

## Fase 4 — Painel de acompanhamento por disciplina

Nova aba "Acompanhamento" em `src/pages/painel/DisciplineDetail.tsx` (primeira aba, antes de
"Frequência"), consolidando numa tabela só, por aluno ativo (Global Constraint 1), o que hoje
está espalhado entre `GradesTab`, `AttendanceTab` e `VideoLessonsTab`: nota atual, status de
tarefas, status de provas e vídeos assistidos.

**Descobertas de leitura do código real que mudam o que o spec havia previsto:**
- `getClassReportData` (`src/functions/reportData.ts:40`) já resolve nota média (via
  `computeWeightedAverage`) e faltas por aluno ativo — a regra de "aula que já aconteceu" que
  ela usa de fato é `lessons.givenAt !== null` (chamada lançada), não `lessons.date <= hoje`.
  Esta fase só **reaproveita** `getClassReportData` como está; não reimplementa nem discute essa
  regra.
- `assignmentSubmissions` já tem a coluna `gradedAt` (`src/server/db/schema.ts:393`) — "aguarda
  correção" é simplesmente `gradedAt IS NULL` numa entrega existente. Não é preciso cruzar com
  `grades`/`assessmentId` como o spec sugeria.
- Não existem `AssignmentsTab`/`ExamsTab` dentro de `DisciplineDetail.tsx` hoje (só
  `AttendanceTab`, `GradesTab`, `VideoLessonsTab`, `ReadingMaterialsTab`) — a aba nova entra ao
  lado dessas quatro, não substitui nenhuma.

### Tarefa 4.1 — Lógica pura: resumo de tarefas e provas por aluno

**Arquivos:**
- Criar (ou complementar, se as Fases 1/2 já criaram o arquivo com `pickNextLesson` e outros
  helpers): `src/lib/dashboard.ts`
- Ler: `src/functions/assignmentSubmissions.ts` (`submitAssignmentFn` — confirma que
  `assignmentSubmissions.gradedAt` só é preenchido em outro fluxo, nunca no envio),
  `src/functions/examAttempts.ts` (`listAvailableExamsFn` — mesmo filtro `isNotNull(exams.opensAt)`
  a replicar aqui), `src/server/db/schema.ts` (`assignments`, `assignmentSubmissions`, `exams`,
  `examAttempts`)

**Interfaces:**
- Consome: nada (funções puras, recebem linhas já carregadas).
- Produz: `summarizeAssignmentsByStudent` e `summarizeExamsByStudent`, usadas pela Tarefa 4.2.

- [ ] **Passo 1: Escrever `summarizeAssignmentsByStudent`**

```ts
export type OverviewAssignmentSubmission = {
  assignmentId: string;
  studentId: string;
  /** `assignmentSubmissions.gradedAt` — nulo enquanto a entrega aguarda correção. */
  gradedAt: string | null;
};

export type AssignmentSummary = { submitted: number; total: number; awaitingGrading: number };

/**
 * Resumo de tarefas por aluno: quantas das tarefas da disciplina ele já
 * entregou, e quantas dessas entregas ainda aguardam correção
 * (`gradedAt` nulo). "Total" conta toda tarefa da disciplina — ao
 * contrário de prova, tarefa não tem rascunho/publicação (decisão do
 * spec: toda tarefa criada já é visível ao aluno).
 */
export function summarizeAssignmentsByStudent(
  studentIds: Array<string>,
  totalAssignments: number,
  submissions: Array<OverviewAssignmentSubmission>,
): Map<string, AssignmentSummary> {
  const result = new Map<string, AssignmentSummary>();
  for (const studentId of studentIds) {
    const mySubmissions = submissions.filter((s) => s.studentId === studentId);
    result.set(studentId, {
      submitted: mySubmissions.length,
      total: totalAssignments,
      awaitingGrading: mySubmissions.filter((s) => s.gradedAt === null).length,
    });
  }
  return result;
}
```

- [ ] **Passo 2: Escrever `summarizeExamsByStudent`**

```ts
export type OverviewExam = { id: string; opensAt: string | null };
export type OverviewExamAttempt = {
  examId: string;
  studentId: string;
  submittedAt: string | null;
};

export type ExamSummary = { taken: number; total: number };

/**
 * Resumo de provas por aluno. Só entram no "total" as provas já
 * publicadas (`opensAt` não nula, mesmo filtro de `listAvailableExamsFn`)
 * — prova em rascunho é invisível ao aluno e não pode pesar contra ele.
 * "Feita" é `examAttempts.submittedAt` preenchido — hoje toda prova é de
 * múltipla escolha e a nota sai na hora do envio (Fase 1, card 2).
 */
export function summarizeExamsByStudent(
  studentIds: Array<string>,
  exams: Array<OverviewExam>,
  attempts: Array<OverviewExamAttempt>,
): Map<string, ExamSummary> {
  const publishedIds = new Set(exams.filter((e) => e.opensAt !== null).map((e) => e.id));

  const result = new Map<string, ExamSummary>();
  for (const studentId of studentIds) {
    const taken = attempts.filter(
      (a) => a.studentId === studentId && a.submittedAt !== null && publishedIds.has(a.examId),
    ).length;
    result.set(studentId, { taken, total: publishedIds.size });
  }
  return result;
}
```

- [ ] **Passo 3: Checar o arquivo**

Run: `npx eslint src/lib/dashboard.ts && npx tsc --noEmit`
Expected: PASS, sem erros.

- [ ] **Passo 4: Commit**

```bash
git add src/lib/dashboard.ts
git commit -m "feat: adiciona resumo de tarefas e provas por aluno em src/lib/dashboard.ts"
```

### Tarefa 4.2 — Lógica pura: resumo de vídeos e montagem da linha final

**Arquivos:**
- Modificar: `src/lib/dashboard.ts`
- Ler: `src/functions/reportData.ts` (`ClassReportRow` — `studentId`, `studentName`, `average`,
  `totalLessons`, `totalFaltas`; a razão de frequência é recalculada aqui com a mesma fórmula de
  `reportData.ts:281`, já que `ClassReportRow` não expõe `attendanceRatio` pronto)

**Interfaces:**
- Consome: `AssignmentSummary`, `ExamSummary` da Tarefa 4.1.
- Produz: `summarizeVideosByStudent` e `buildDisciplineOverview`, usadas pela Tarefa 4.3.

- [ ] **Passo 1: Escrever `summarizeVideosByStudent`**

```ts
export type OverviewVideoWatch = { videoId: string; studentId: string };

export type VideoSummary = { watched: number; total: number };

/** Resumo de vídeo-aulas assistidas por aluno, dentre as vídeo-aulas da disciplina. */
export function summarizeVideosByStudent(
  studentIds: Array<string>,
  videoIds: Array<string>,
  watches: Array<OverviewVideoWatch>,
): Map<string, VideoSummary> {
  const total = videoIds.length;
  const result = new Map<string, VideoSummary>();
  for (const studentId of studentIds) {
    const watched = new Set(
      watches.filter((w) => w.studentId === studentId).map((w) => w.videoId),
    ).size;
    result.set(studentId, { watched, total });
  }
  return result;
}
```

- [ ] **Passo 2: Escrever `buildDisciplineOverview`, que monta a linha final de cada aluno**

```ts
export type DisciplineOverviewClassRow = {
  studentId: string;
  studentName: string;
  average: number | null;
  totalLessons: number;
  totalFaltas: number;
};

export type DisciplineOverviewRow = {
  studentId: string;
  studentName: string;
  average: number | null;
  /** Fração de aulas presentes (0 a 1); `null` quando a disciplina não tem aula lançada. */
  attendanceRatio: number | null;
  assignmentsSubmitted: number;
  assignmentsTotal: number;
  assignmentsAwaitingGrading: number;
  examsTaken: number;
  examsTotal: number;
  videosWatched: number;
  videosTotal: number;
};

/**
 * Junta nota e frequência (já calculadas por `getClassReportData`, uma
 * linha por aluno ativo) com os resumos de tarefas, provas e vídeos numa
 * única linha por aluno, pronta pra tabela de acompanhamento. Mesma
 * fórmula de frequência de `getStudentReportData` (`reportData.ts:281`):
 * `null` — nunca 100% falso — quando a disciplina ainda não tem nenhuma
 * aula lançada.
 */
export function buildDisciplineOverview(
  classRows: Array<DisciplineOverviewClassRow>,
  assignmentSummaries: Map<string, AssignmentSummary>,
  examSummaries: Map<string, ExamSummary>,
  videoSummaries: Map<string, VideoSummary>,
): Array<DisciplineOverviewRow> {
  return classRows.map((row) => {
    const attendanceRatio =
      row.totalLessons === 0 ? null : (row.totalLessons - row.totalFaltas) / row.totalLessons;
    const assignments = assignmentSummaries.get(row.studentId) ?? {
      submitted: 0,
      total: 0,
      awaitingGrading: 0,
    };
    const exams = examSummaries.get(row.studentId) ?? { taken: 0, total: 0 };
    const videos = videoSummaries.get(row.studentId) ?? { watched: 0, total: 0 };

    return {
      studentId: row.studentId,
      studentName: row.studentName,
      average: row.average,
      attendanceRatio,
      assignmentsSubmitted: assignments.submitted,
      assignmentsTotal: assignments.total,
      assignmentsAwaitingGrading: assignments.awaitingGrading,
      examsTaken: exams.taken,
      examsTotal: exams.total,
      videosWatched: videos.watched,
      videosTotal: videos.total,
    };
  });
}
```

- [ ] **Passo 3: Checar o arquivo**

Run: `npx eslint src/lib/dashboard.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Passo 4: Commit**

```bash
git add src/lib/dashboard.ts
git commit -m "feat: adiciona buildDisciplineOverview em src/lib/dashboard.ts"
```

### Tarefa 4.3 — Server function: `getDisciplineOverviewFn`

**Arquivos:**
- Criar (ou complementar, se as Fases 1/2 já criaram o arquivo com `getTeacherDashboardFn` /
  `getStudentDashboardFn`): `src/functions/dashboard.ts`
- Ler: `src/functions/reportData.ts` (`getClassReportData`, `ClassReport`, `ClassReportRow`),
  `src/functions/report.ts` (`getClassReportFn` — mesmo padrão de guard + chamada direta a usar
  aqui), `src/server/auth/guard.ts` (`requireOwnDiscipline`), `src/server/db/schema.ts`
  (`assignments`, `assignmentSubmissions`, `exams`, `examAttempts`, `videoLessons`,
  `videoWatches`), `src/lib/dashboard.ts` (Tarefas 4.1–4.2)

**Interfaces:**
- Consome: `getClassReportData` de `src/functions/reportData.ts`;
  `summarizeAssignmentsByStudent`, `summarizeExamsByStudent`, `summarizeVideosByStudent`,
  `buildDisciplineOverview` de `src/lib/dashboard.ts`.
- Produz: `getDisciplineOverviewFn` — `requireOwnDiscipline(disciplineId)`, devolve
  `{ discipline, rows }`, consumido pela Tarefa 4.4.

- [ ] **Passo 1: Escrever a server function**

Reaproveita `getClassReportData` inteiro (nota, faltas, disciplina) em vez de reconsultar
`grades`/`attendance`/`lessons` do zero. As outras quatro tabelas (`assignments`,
`assignmentSubmissions`, `exams`, `examAttempts`, `videoLessons`, `videoWatches`) são
consultadas com `inArray` sobre os ids da disciplina e dos alunos ativos, em `Promise.all`,
seguindo o Global Constraint 6 — sempre guardando `inArray` com lista vazia.

```ts
import { and, eq, inArray } from "drizzle-orm";
// ...(mantém os imports já existentes no arquivo, se a Fase 1/2 já criou)
import {
  buildDisciplineOverview,
  summarizeAssignmentsByStudent,
  summarizeExamsByStudent,
  summarizeVideosByStudent,
} from "@/lib/dashboard";
import type { DisciplineOverviewRow } from "@/lib/dashboard";
import { getClassReportData } from "@/functions/reportData";
import { requireOwnDiscipline } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import {
  assignments,
  assignmentSubmissions,
  examAttempts,
  exams,
  videoLessons,
  videoWatches,
} from "@/server/db/schema";

const disciplineIdSchema = z.object({ disciplineId: z.string().uuid() });

export type DisciplineOverview = {
  discipline: { id: string; discipline: string; module: string; term: string };
  rows: Array<DisciplineOverviewRow>;
};

/**
 * Painel de acompanhamento da disciplina: nota, frequência, tarefas,
 * provas e vídeos de cada aluno ativo, numa tabela só.
 */
export const getDisciplineOverviewFn = createServerFn({ method: "GET" })
  .validator(disciplineIdSchema)
  .handler(async ({ data }): Promise<DisciplineOverview> => {
    await requireOwnDiscipline(data.disciplineId);

    const classReport = await getClassReportData(data.disciplineId);
    const studentIds = classReport.rows.map((r) => r.studentId);

    const [assignmentRows, examRows, videoRows] = await Promise.all([
      db
        .select({ id: assignments.id })
        .from(assignments)
        .where(eq(assignments.disciplineId, data.disciplineId)),
      db
        .select({ id: exams.id, opensAt: exams.opensAt })
        .from(exams)
        .where(eq(exams.disciplineId, data.disciplineId)),
      db
        .select({ id: videoLessons.id })
        .from(videoLessons)
        .where(eq(videoLessons.disciplineId, data.disciplineId)),
    ]);

    const assignmentIds = assignmentRows.map((a) => a.id);
    const examIds = examRows.map((e) => e.id);
    const videoIds = videoRows.map((v) => v.id);

    const [submissionRows, attemptRows, watchRows] = await Promise.all([
      assignmentIds.length === 0 || studentIds.length === 0
        ? []
        : db
            .select({
              assignmentId: assignmentSubmissions.assignmentId,
              studentId: assignmentSubmissions.studentId,
              gradedAt: assignmentSubmissions.gradedAt,
            })
            .from(assignmentSubmissions)
            .where(
              and(
                inArray(assignmentSubmissions.assignmentId, assignmentIds),
                inArray(assignmentSubmissions.studentId, studentIds),
              ),
            ),
      examIds.length === 0 || studentIds.length === 0
        ? []
        : db
            .select({
              examId: examAttempts.examId,
              studentId: examAttempts.studentId,
              submittedAt: examAttempts.submittedAt,
            })
            .from(examAttempts)
            .where(
              and(
                inArray(examAttempts.examId, examIds),
                inArray(examAttempts.studentId, studentIds),
              ),
            ),
      videoIds.length === 0 || studentIds.length === 0
        ? []
        : db
            .select({ videoId: videoWatches.videoLessonId, studentId: videoWatches.studentId })
            .from(videoWatches)
            .where(
              and(
                inArray(videoWatches.videoLessonId, videoIds),
                inArray(videoWatches.studentId, studentIds),
              ),
            ),
    ]);

    const assignmentSummaries = summarizeAssignmentsByStudent(
      studentIds,
      assignmentRows.length,
      submissionRows.map((s) => ({
        ...s,
        gradedAt: s.gradedAt ? s.gradedAt.toISOString() : null,
      })),
    );
    const examSummaries = summarizeExamsByStudent(
      studentIds,
      examRows.map((e) => ({ id: e.id, opensAt: e.opensAt ? e.opensAt.toISOString() : null })),
      attemptRows.map((a) => ({
        ...a,
        submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
      })),
    );
    const videoSummaries = summarizeVideosByStudent(studentIds, videoIds, watchRows);

    const rows = buildDisciplineOverview(
      classReport.rows.map((r) => ({
        studentId: r.studentId,
        studentName: r.studentName,
        average: r.average,
        totalLessons: r.totalLessons,
        totalFaltas: r.totalFaltas,
      })),
      assignmentSummaries,
      examSummaries,
      videoSummaries,
    );

    return { discipline: classReport.discipline, rows };
  });
```

Se o arquivo já existir (Fases 1/2 mergeadas antes), o `createServerFn` do `@tanstack/react-start`
e o `z` do `zod` já estão importados — não duplicar o import.

- [ ] **Passo 2: Checar o arquivo**

Run: `npx eslint src/functions/dashboard.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Passo 3: Commit**

```bash
git add src/functions/dashboard.ts
git commit -m "feat: adiciona getDisciplineOverviewFn"
```

### Tarefa 4.4 — UI: aba "Acompanhamento" em `DisciplineDetail.tsx`

**Arquivos:**
- Criar: `src/pages/painel/DisciplineOverviewTab.tsx`
- Modificar: `src/pages/painel/DisciplineDetail.tsx`
- Ler: `src/pages/painel/reports/ClassReport.tsx` (padrão de tabela com `Table`/`TableHeader`/
  `TableRow` e destaque de linha abaixo do limiar), `src/pages/painel/GradesTab.tsx` (padrão de
  skeleton de tabela), `src/lib/utils.ts` (`cn`)

**Interfaces:**
- Consome: `getDisciplineOverviewFn` da Tarefa 4.3.
- Produz: nada (fim da fase — UI consumindo o dado agregado).

- [ ] **Passo 1: Criar o componente da aba, com ordenação por nome/média/frequência**

```tsx
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDisciplineOverviewFn } from "@/functions/dashboard";
import { MINIMUM_ATTENDANCE_RATIO } from "@/lib/attendance";
import { PASSING_AVERAGE } from "@/lib/grades";
import { cn } from "@/lib/utils";

type SortKey = "name" | "average" | "attendance";

export function DisciplineOverviewTab({ disciplineId }: { disciplineId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["discipline-overview", disciplineId],
    queryFn: () => getDisciplineOverviewFn({ data: { disciplineId } }),
  });
  const [sortKey, setSortKey] = useState<SortKey>("name");

  // Ordenação crescente em média/frequência: o professor acha rápido quem
  // está em risco (pior primeiro). Aluno sem nota/frequência (`null`) fica
  // por último, não primeiro — não é "o pior", é "ainda sem dado".
  const rows = useMemo(() => {
    if (!data) return [];
    const copy = [...data.rows];
    if (sortKey === "average") {
      return copy.sort((a, b) => (a.average ?? Infinity) - (b.average ?? Infinity));
    }
    if (sortKey === "attendance") {
      return copy.sort(
        (a, b) => (a.attendanceRatio ?? Infinity) - (b.attendanceRatio ?? Infinity),
      );
    }
    return copy.sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [data, sortKey]);

  if (isLoading || !data) {
    return (
      <div className="overflow-hidden rounded-md border border-border/70 bg-card/70 shadow-soft">
        <div className="flex items-center gap-6 border-b border-border/70 p-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="ml-auto h-4 w-16" />
        </div>
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-6 border-b border-border/70 p-3 last:border-b-0"
          >
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ml-auto h-4 w-24" />
          </div>
        ))}
      </div>
    );
  }

  function SortableHead({ label, sortableKey }: { label: string; sortableKey: SortKey }) {
    return (
      <TableHead className="text-center">
        <button
          type="button"
          onClick={() => setSortKey(sortableKey)}
          className={cn(
            "inline-flex items-center gap-1 transition-colors hover:text-foreground",
            sortKey === sortableKey && "text-foreground",
          )}
        >
          {label}
          <ArrowUpDown className="size-3" aria-hidden />
        </button>
      </TableHead>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border/70 bg-card/70 shadow-soft">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead label="Aluno" sortableKey="name" />
            <SortableHead label="Média" sortableKey="average" />
            <SortableHead label="Frequência" sortableKey="attendance" />
            <TableHead className="text-center">Tarefas</TableHead>
            <TableHead className="text-center">Provas</TableHead>
            <TableHead className="text-center">Vídeos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                Nenhum aluno ativo cadastrado.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const belowAverage = row.average !== null && row.average < PASSING_AVERAGE;
              const belowAttendance =
                row.attendanceRatio !== null && row.attendanceRatio < MINIMUM_ATTENDANCE_RATIO;
              return (
                <TableRow
                  key={row.studentId}
                  className="animate-in fade-in slide-in-from-top-1 duration-200"
                >
                  <TableCell className="font-medium text-foreground">{row.studentName}</TableCell>
                  <TableCell
                    className={cn("text-center", belowAverage && "font-medium text-destructive")}
                  >
                    {row.average === null ? "—" : row.average.toFixed(1)}
                  </TableCell>
                  <TableCell
                    className={cn("text-center", belowAttendance && "font-medium text-destructive")}
                  >
                    {row.attendanceRatio === null
                      ? "—"
                      : `${Math.round(row.attendanceRatio * 100)}%`}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.assignmentsSubmitted}/{row.assignmentsTotal}
                    {row.assignmentsAwaitingGrading > 0 ? (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({row.assignmentsAwaitingGrading} p/ corrigir)
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.examsTaken}/{row.examsTotal}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.videosWatched}/{row.videosTotal}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Passo 2: Integrar a aba em `DisciplineDetail.tsx`, como primeira aba**

```tsx
import { DisciplineOverviewTab } from "@/pages/painel/DisciplineOverviewTab";
// ...
<Tabs defaultValue="acompanhamento">
  <TabsList>
    <TabsTrigger value="acompanhamento">Acompanhamento</TabsTrigger>
    <TabsTrigger value="frequencia">Frequência</TabsTrigger>
    <TabsTrigger value="notas">Notas</TabsTrigger>
    <TabsTrigger value="videos">Vídeo-aulas</TabsTrigger>
    <TabsTrigger value="apostila">Apostila</TabsTrigger>
  </TabsList>
  <TabsContent value="acompanhamento">
    <DisciplineOverviewTab disciplineId={disciplineId} />
  </TabsContent>
  <TabsContent value="frequencia">
    <AttendanceTab disciplineId={disciplineId} />
  </TabsContent>
  {/* ...resto igual */}
</Tabs>
```

- [ ] **Passo 3: Checar os arquivos**

Run: `npx eslint src/pages/painel/DisciplineOverviewTab.tsx src/pages/painel/DisciplineDetail.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Passo 4: Roteiro manual**

Rodar `npm run dev`, entrar como professor numa disciplina com alunos, tarefas, provas e vídeos
variados. Conferir: a aba "Acompanhamento" abre primeiro; os números de cada aluno batem com o
que `GradesTab`/`AttendanceTab`/`VideoLessonsTab` mostram pra dois ou três alunos escolhidos à
mão; aluno abaixo de `PASSING_AVERAGE` ou de `MINIMUM_ATTENDANCE_RATIO` aparece destacado;
clicar em "Média" e "Frequência" reordena a tabela com o pior caso no topo; disciplina sem
tarefa/prova/vídeo mostra "0/0" sem quebrar; disciplina sem nenhuma aula lançada mostra "—" na
frequência (nunca "100%").

- [ ] **Passo 5: Build final da fase**

Run: `npm run build`
Expected: PASS.

- [ ] **Passo 6: Commit**

```bash
git add src/pages/painel/DisciplineOverviewTab.tsx src/pages/painel/DisciplineDetail.tsx
git commit -m "feat: adiciona aba de acompanhamento por disciplina"
```

---

## Fase 5 — Tarefas de múltipla escolha com correção automática

Espelha, em `assignments`/`assignmentSubmissions`, o mecanismo de correção automática que
`exams`/`examQuestions`/`examOptions`/`examAttempts`/`examAnswers` já têm
(`src/server/exams/scoring.ts`). Tarefa continua podendo ser texto/arquivo (`kind = "open"`,
comportamento atual, inalterado) ou de múltipla escolha (`kind = "multiple_choice"`, nova): o
professor cadastra perguntas com alternativas (uma correta cada, mesma regra das provas), o aluno
responde de uma vez só — sem cronômetro nem janela de abertura, ao contrário de prova — e a nota
sai na hora, gravada em `grades` pelo mesmo `assignments.assessmentId` que a correção manual já
usa.

**Descobertas de leitura do código real que confirmam o desenho do spec:**
- `finalizeExamAttempt` (`src/server/exams/scoring.ts:19-64`) já faz exatamente o que a Fase 5
  precisa generalizar: soma pontos das opções corretas selecionadas, grava `submittedAt`+`score`
  na tentativa e faz upsert em `grades`. A soma (linhas 41-50) é a parte pura a extrair.
- `addExamQuestionFn`/`deleteExamQuestionFn` (`src/functions/exams.ts:291-360`) já implementam o
  padrão "trava quando alguém já respondeu" (via `hasAttempts`) e "uma opção correta por
  pergunta" (`assertExactlyOneCorrect`) — Tarefa 5.3 espelha os dois, trocando `examAttempts` por
  `assignmentSubmissions` como sinal de travamento.
- `assignments.assessmentId` já é `notNull().unique()` (`schema.ts:368-371`) — toda tarefa já tem
  avaliação vinculada, então a gravação da nota reaproveita o caminho existente
  (`grades.assessmentId`/`grades.studentId`, `onConflictDoUpdate`) sem mudança nenhuma nele.
- `submitAssignmentFn` (`src/functions/assignmentSubmissions.ts:251-291`) só bloqueia reenvio
  quando já existe nota em `grades` — não existe hoje um "envio único" explícito. Como a tarefa
  objetiva grava a nota no mesmo golpe do envio, o bloqueio de reenvio já nasce pronto sem
  precisar de lógica nova: a Tarefa 5.4 cria uma função de envio separada
  (`submitAssignmentAnswersFn`) que primeiro confere se já existe entrega.

### Tarefa 5.1 — Schema: tipo de tarefa, perguntas, opções e respostas objetivas

**Arquivos:**
- Modificar: `src/server/db/schema.ts`
- Ler: as tabelas `exams`/`examQuestions`/`examOptions`/`examAnswers` (linhas 195-271) e
  `assignments`/`assignmentSubmissions` (linhas 363-396) no mesmo arquivo — o padrão de colunas a
  copiar

**Interfaces:**
- Consome: nada.
- Produz: enum `assignmentKind`, coluna `assignments.kind`, tabelas `assignmentQuestions`,
  `assignmentOptions`, `assignmentAnswers` — usadas por todas as tarefas seguintes desta fase.

- [ ] **Passo 1: Adicionar o enum `assignmentKind`, junto dos outros enums do topo do arquivo**

```ts
export const assignmentKind = pgEnum("assignment_kind", ["open", "multiple_choice"]);
```

Colocar logo depois de `export const pushOwnerType = pgEnum(...)` (linha 35).

- [ ] **Passo 2: Adicionar a coluna `kind` em `assignments`**

Na definição de `assignments` (linhas 363-376), adicionar a coluna logo depois de `assessmentId`:

```ts
export const assignments = pgTable("assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  disciplineId: uuid("discipline_id")
    .notNull()
    .references(() => disciplines.id, { onDelete: "cascade" }),
  assessmentId: uuid("assessment_id")
    .notNull()
    .unique()
    .references(() => assessments.id, { onDelete: "cascade" }),
  // "open" (texto/arquivo, como sempre foi) ou "multiple_choice" (corrigida
  // sozinha, igual prova). Imutável depois de criada — trocar o tipo
  // significa apagar e recriar a tarefa.
  kind: assignmentKind("kind").notNull().default("open"),
  title: text("title").notNull(),
  instructions: text("instructions"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

O `default("open")` é o que faz o `db:push` ser não destrutivo (Global Constraint 11) — toda
tarefa já existente vira `"open"` automaticamente, sem migração de dados.

- [ ] **Passo 3: Adicionar as três tabelas novas, logo depois de `assignmentSubmissions`**

Espelham exatamente `examQuestions`/`examOptions`/`examAnswers`, trocando a origem
(`assignmentId` em vez de `examId`) e o destino da resposta (`submissionId` de
`assignmentSubmissions`, que já existe e continua sendo o registro central da entrega — não se
cria um equivalente de `examAttempts`, porque tarefa não tem cronômetro nem `opensAt`):

```ts
export const assignmentQuestions = pgTable("assignment_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  assignmentId: uuid("assignment_id")
    .notNull()
    .references(() => assignments.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  points: numeric("points", { precision: 5, scale: 2 }).notNull().default("1"),
  sequence: integer("sequence").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assignmentOptions = pgTable("assignment_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionId: uuid("question_id")
    .notNull()
    .references(() => assignmentQuestions.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
  sequence: integer("sequence").notNull(),
});

export const assignmentAnswers = pgTable(
  "assignment_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => assignmentSubmissions.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => assignmentQuestions.id, { onDelete: "cascade" }),
    optionId: uuid("option_id").references(() => assignmentOptions.id, { onDelete: "set null" }),
    answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.submissionId, table.questionId)],
);
```

- [ ] **Passo 4: Checar o arquivo**

Run: `npx eslint src/server/db/schema.ts && npx tsc --noEmit`
Expected: PASS, sem erros.

- [ ] **Passo 5: Aplicar o schema no banco**

Run: `npm run db:push`
Expected: o `drizzle-kit push` lista as mudanças (1 enum novo, 1 coluna nova em `assignments`
com default, 3 tabelas novas) e aplica sem pedir nenhuma confirmação destrutiva — é tudo
aditivo. Se o terminal pedir confirmação, responder afirmativamente ("Yes, I want to execute
all statements" / criar tabela). Conferir depois, com um cliente Postgres ou `psql`, que uma
linha de `assignments` já existente ganhou `kind = 'open'`.

- [ ] **Passo 6: Commit**

```bash
git add src/server/db/schema.ts
git commit -m "feat: adiciona schema de tarefas de múltipla escolha"
```

### Tarefa 5.2 — Lógica pura: generalizar a soma de pontos da correção automática

Extrai a parte pura de `finalizeExamAttempt` para `src/lib/scoring.ts`, sem mudar nenhum
comportamento — é a primeira coisa validada no PR, porque mexe no motor que já está em produção
(maior risco da fase, conforme o spec).

**Arquivos:**
- Criar: `src/lib/scoring.ts`
- Modificar: `src/server/exams/scoring.ts` (`finalizeExamAttempt`)
- Ler: `src/server/exams/scoring.ts` inteiro (lógica atual a extrair)

**Interfaces:**
- Consome: nada (função pura).
- Produz: `sumCorrectPoints(selectedOptionIds, options, questions)`, consumida por
  `finalizeExamAttempt` (já existente, refatorado aqui) e por `finalizeAssignmentSubmission`
  (Tarefa 5.4, nova).

- [ ] **Passo 1: Escrever `sumCorrectPoints` em `src/lib/scoring.ts`**

```ts
export type ScoringOption = { id: string; questionId: string; isCorrect: boolean };
export type ScoringQuestion = { id: string; points: number };

/**
 * Soma os pontos de cada pergunta cuja opção selecionada é a correta.
 * Função pura reaproveitada pela correção de provas (`finalizeExamAttempt`,
 * `src/server/exams/scoring.ts`) e de tarefas objetivas
 * (`finalizeAssignmentSubmission`, `src/server/assignments/scoring.ts`) —
 * as duas têm exatamente a mesma regra: uma opção correta por pergunta, nota
 * é a soma dos pontos das perguntas acertadas. Pergunta sem resposta ou
 * resposta errada simplesmente não soma nada — não há desconto.
 */
export function sumCorrectPoints(
  selectedOptionIds: Array<string>,
  options: Array<ScoringOption>,
  questions: Array<ScoringQuestion>,
): number {
  const selected = new Set(selectedOptionIds);
  return options
    .filter((option) => option.isCorrect && selected.has(option.id))
    .reduce((sum, option) => {
      const question = questions.find((q) => q.id === option.questionId);
      return sum + (question?.points ?? 0);
    }, 0);
}
```

- [ ] **Passo 2: Refatorar `finalizeExamAttempt` para usar a função pura**

Troca a query que já filtrava `isCorrect = true AND id IN (...)` diretamente no banco por duas
queries mais largas (todas as opções/perguntas da prova) seguidas da soma em memória — mesmo
estilo de agregação do resto do projeto (Global Constraint 6), e o que torna a função
reaproveitável: o resultado final é idêntico, só muda onde o filtro acontece.

```ts
import { eq, inArray } from "drizzle-orm";

import { sumCorrectPoints } from "@/lib/scoring";
import { db } from "@/server/db/client";
import {
  examAnswers,
  examAttempts,
  examOptions,
  examQuestions,
  exams,
  grades,
} from "@/server/db/schema";

/**
 * Soma os pontos das respostas corretas de uma tentativa (via
 * `sumCorrectPoints`, `src/lib/scoring.ts`), grava o resultado e escreve a
 * nota em `grades` — mesmo alvo de conflito que `setGradeFn` já usa hoje,
 * por isso a nota aparece sozinha na aba Notas existente. Idempotente: se a
 * tentativa já foi enviada, não recalcula nada.
 */
export async function finalizeExamAttempt(
  attemptId: string,
  options: { autoSubmitted: boolean },
): Promise<void> {
  const [attempt] = await db
    .select()
    .from(examAttempts)
    .where(eq(examAttempts.id, attemptId))
    .limit(1);
  if (!attempt || attempt.submittedAt) return;

  const [exam] = await db.select().from(exams).where(eq(exams.id, attempt.examId)).limit(1);
  if (!exam) return;

  const [answerRows, questionRows] = await Promise.all([
    db
      .select({ optionId: examAnswers.optionId })
      .from(examAnswers)
      .where(eq(examAnswers.attemptId, attemptId)),
    db
      .select({ id: examQuestions.id, points: examQuestions.points })
      .from(examQuestions)
      .where(eq(examQuestions.examId, exam.id)),
  ]);
  const selectedOptionIds = answerRows
    .map((a) => a.optionId)
    .filter((id): id is string => id !== null);
  const questionIds = questionRows.map((q) => q.id);

  const optionRows =
    questionIds.length === 0
      ? []
      : await db
          .select({ id: examOptions.id, questionId: examOptions.questionId, isCorrect: examOptions.isCorrect })
          .from(examOptions)
          .where(inArray(examOptions.questionId, questionIds));

  const score = sumCorrectPoints(
    selectedOptionIds,
    optionRows,
    questionRows.map((q) => ({ id: q.id, points: Number(q.points) })),
  );

  await db
    .update(examAttempts)
    .set({ submittedAt: new Date(), score: String(score), autoSubmitted: options.autoSubmitted })
    .where(eq(examAttempts.id, attemptId));

  await db
    .insert(grades)
    .values({ assessmentId: exam.assessmentId, studentId: attempt.studentId, score: String(score) })
    .onConflictDoUpdate({
      target: [grades.assessmentId, grades.studentId],
      set: { score: String(score), updatedAt: new Date() },
    });
}
```

Note que `and` deixa de ser usado neste arquivo (a query de opções não filtra mais por
`isCorrect`/`inArray` combinados) — remover do import se o linter acusar.

- [ ] **Passo 3: Checar os arquivos**

Run: `npx eslint src/lib/scoring.ts src/server/exams/scoring.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Passo 4: Roteiro manual de regressão (sem Vitest novo, conforme Global Constraint 13)**

Rodar `npm run dev`, fazer uma prova existente como aluno (acertando algumas perguntas e errando
outras) e conferir que a nota final bate exatamente com o que batia antes da refatoração —
comparar com o valor que já está lançado em Notas para outro aluno que já tinha feito a mesma
prova antes deste PR.

- [ ] **Passo 5: Commit**

```bash
git add src/lib/scoring.ts src/server/exams/scoring.ts
git commit -m "refactor: extrai sumCorrectPoints de finalizeExamAttempt para src/lib/scoring.ts"
```

### Tarefa 5.3 — Server functions: perguntas e opções da tarefa objetiva (professor)

**Arquivos:**
- Modificar: `src/functions/assignments.ts`
- Ler: `src/functions/exams.ts` (`recomputeMaxScore`, `assertExactlyOneCorrect`,
  `addExamQuestionFn`, `deleteExamQuestionFn`, `buildExamDetail`, `getExamByIdFn` — o padrão
  inteiro a espelhar), `src/server/db/schema.ts` (`assignmentQuestions`, `assignmentOptions`,
  criadas na Tarefa 5.1)

**Interfaces:**
- Consome: `assignmentQuestions`, `assignmentOptions` de `src/server/db/schema.ts`.
- Produz: `createAssignmentFn` ganha o parâmetro `kind`; `AssignmentDetail` ganha `kind`,
  `locked` e `questions`; `addAssignmentQuestionFn` e `deleteAssignmentQuestionFn`, novas,
  consumidas pela Tarefa 5.5.

- [ ] **Passo 1: `kind` na criação da tarefa**

Tarefa de múltipla escolha nasce com nota máxima 0, igual prova — ela sobe conforme as
perguntas são cadastradas (`recomputeAssignmentMaxScore`, Passo 3). Tarefa aberta continua
recebendo a nota máxima informada pelo professor, exatamente como hoje.

```ts
const createSchema = z.object({
  disciplineId: z.string().uuid(),
  kind: z.enum(["open", "multiple_choice"]).default("open"),
  title: z.string().trim().min(1, "Informe um título."),
  instructions: z.string().trim().optional(),
  weight: z.number().positive().default(1),
  maxScore: z.number().positive().default(10),
  dueAt: z.string().optional(), // ISO — de <input type="datetime-local">
});

/** Cria a tarefa e a avaliação vinculada na aba Notas. */
export const createAssignmentFn = createServerFn({ method: "POST" })
  .validator(createSchema)
  .handler(async ({ data }) => {
    const discipline = await requireOwnDiscipline(data.disciplineId);

    const [assessment] = await db
      .insert(assessments)
      .values({
        disciplineId: data.disciplineId,
        title: data.title,
        maxScore: data.kind === "multiple_choice" ? "0" : String(data.maxScore),
        weight: String(data.weight),
      })
      .returning({ id: assessments.id });

    const [assignment] = await db
      .insert(assignments)
      .values({
        disciplineId: data.disciplineId,
        assessmentId: assessment.id,
        kind: data.kind,
        title: data.title,
        instructions: data.instructions || null,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
      })
      .returning({ id: assignments.id });

    await logAudit("tarefa.criar", `Criou a tarefa "${data.title}" em ${discipline.discipline}.`);
    return { assignmentId: assignment.id, assessmentId: assessment.id };
  });
```

- [ ] **Passo 2: `AssignmentDetail` ganha `kind`, `locked` e `questions`**

```ts
export type AssignmentQuestionDetail = {
  id: string;
  text: string;
  points: string;
  sequence: number;
  options: Array<{ id: string; text: string; isCorrect: boolean; sequence: number }>;
};

export type AssignmentDetail = {
  id: string;
  disciplineId: string;
  kind: "open" | "multiple_choice";
  title: string;
  instructions: string | null;
  dueAt: string | null;
  weight: number;
  maxScore: number;
  /** true quando pelo menos um aluno já entregou — só importa pra "multiple_choice"
   * (trava edição de perguntas), mesma regra de `ExamDetail.locked`. */
  locked: boolean;
  questions: Array<AssignmentQuestionDetail>;
};
```

- [ ] **Passo 3: `buildAssignmentDetail` + `recomputeAssignmentMaxScore`, e trocar o corpo de
      `getAssignmentByIdFn` para usá-los**

```ts
import { assignmentOptions, assignmentQuestions } from "@/server/db/schema";
// ...(mantém os imports já existentes; asc, eq, inArray já vêm de "drizzle-orm")

async function recomputeAssignmentMaxScore(assignmentId: string, assessmentId: string) {
  const questions = await db
    .select({ points: assignmentQuestions.points })
    .from(assignmentQuestions)
    .where(eq(assignmentQuestions.assignmentId, assignmentId));
  const total = questions.reduce((sum, q) => sum + Number(q.points), 0);
  await db.update(assessments).set({ maxScore: String(total) }).where(eq(assessments.id, assessmentId));
}

async function buildAssignmentDetail(
  assignment: typeof assignments.$inferSelect,
): Promise<AssignmentDetail> {
  const [questionRows, submissionRows, assessmentRow] = await Promise.all([
    assignment.kind === "multiple_choice"
      ? db
          .select()
          .from(assignmentQuestions)
          .where(eq(assignmentQuestions.assignmentId, assignment.id))
          .orderBy(asc(assignmentQuestions.sequence))
      : Promise.resolve([] as Array<typeof assignmentQuestions.$inferSelect>),
    db
      .select({ id: assignmentSubmissions.id })
      .from(assignmentSubmissions)
      .where(eq(assignmentSubmissions.assignmentId, assignment.id)),
    db
      .select({ weight: assessments.weight, maxScore: assessments.maxScore })
      .from(assessments)
      .where(eq(assessments.id, assignment.assessmentId))
      .limit(1),
  ]);

  const questionIds = questionRows.map((q) => q.id);
  const optionRows =
    questionIds.length === 0
      ? []
      : await db
          .select()
          .from(assignmentOptions)
          .where(inArray(assignmentOptions.questionId, questionIds))
          .orderBy(asc(assignmentOptions.sequence));

  return {
    id: assignment.id,
    disciplineId: assignment.disciplineId,
    kind: assignment.kind,
    title: assignment.title,
    instructions: assignment.instructions,
    dueAt: assignment.dueAt ? assignment.dueAt.toISOString() : null,
    weight: Number(assessmentRow[0]?.weight ?? 1),
    maxScore: Number(assessmentRow[0]?.maxScore ?? 10),
    locked: submissionRows.length > 0,
    questions: questionRows.map((q) => ({
      id: q.id,
      text: q.text,
      points: q.points,
      sequence: q.sequence,
      options: optionRows
        .filter((o) => o.questionId === q.id)
        .map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect, sequence: o.sequence })),
    })),
  };
}

/** Detalhe da tarefa, resolvendo a disciplina sozinho a partir do assignmentId (rota do editor). */
export const getAssignmentByIdFn = createServerFn({ method: "GET" })
  .validator(z.object({ assignmentId: z.string().uuid() }))
  .handler(async ({ data }): Promise<AssignmentDetail> => {
    const [assignment] = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, data.assignmentId))
      .limit(1);
    if (!assignment) throw new Error("Tarefa não encontrada.");
    await requireOwnDiscipline(assignment.disciplineId);
    return buildAssignmentDetail(assignment);
  });
```

- [ ] **Passo 4: `addAssignmentQuestionFn` e `deleteAssignmentQuestionFn`**

Mesmo par de `addExamQuestionFn`/`deleteExamQuestionFn`, trocando "trava se já tem tentativa"
por "trava se já tem entrega" (`assignmentSubmissions` em vez de `examAttempts`) e recusando
pergunta em tarefa que não é `multiple_choice`:

```ts
const optionInputSchema = z.object({
  text: z.string().trim().min(1, "Informe o texto da opção."),
  isCorrect: z.boolean(),
});

const questionInputSchema = z.object({
  disciplineId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  text: z.string().trim().min(1, "Informe o texto da pergunta."),
  points: z.number().positive().default(1),
  options: z
    .array(optionInputSchema)
    .min(2, "A pergunta precisa de pelo menos 2 opções.")
    .max(6, "No máximo 6 opções por pergunta."),
});

function assertExactlyOneCorrect(options: Array<{ isCorrect: boolean }>) {
  if (options.filter((o) => o.isCorrect).length !== 1) {
    throw new Error("Marque exatamente uma opção como correta.");
  }
}

/** Adiciona pergunta + opções a uma tarefa objetiva — bloqueado se algum aluno já entregou. */
export const addAssignmentQuestionFn = createServerFn({ method: "POST" })
  .validator(questionInputSchema)
  .handler(async ({ data }) => {
    await requireOwnDiscipline(data.disciplineId);
    const assignment = await requireAssignmentInDiscipline(data.assignmentId, data.disciplineId);
    if (assignment.kind !== "multiple_choice") {
      throw new Error("Só é possível adicionar perguntas a uma tarefa de múltipla escolha.");
    }
    assertExactlyOneCorrect(data.options);

    const hasSubmissions = await db
      .select({ id: assignmentSubmissions.id })
      .from(assignmentSubmissions)
      .where(eq(assignmentSubmissions.assignmentId, assignment.id))
      .limit(1);
    if (hasSubmissions.length > 0) {
      throw new Error("Não é possível editar perguntas depois que algum aluno já entregou.");
    }

    const existing = await db
      .select({ sequence: assignmentQuestions.sequence })
      .from(assignmentQuestions)
      .where(eq(assignmentQuestions.assignmentId, assignment.id));
    const nextSequence = existing.reduce((max, q) => Math.max(max, q.sequence), 0) + 1;

    const [question] = await db
      .insert(assignmentQuestions)
      .values({
        assignmentId: assignment.id,
        text: data.text,
        points: String(data.points),
        sequence: nextSequence,
      })
      .returning({ id: assignmentQuestions.id });

    await db.insert(assignmentOptions).values(
      data.options.map((option, index) => ({
        questionId: question.id,
        text: option.text,
        isCorrect: option.isCorrect,
        sequence: index + 1,
      })),
    );

    await recomputeAssignmentMaxScore(assignment.id, assignment.assessmentId);
    return { id: question.id };
  });

const deleteQuestionSchema = z.object({
  disciplineId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  questionId: z.string().uuid(),
});

/** Remove a pergunta — bloqueado se algum aluno já entregou. */
export const deleteAssignmentQuestionFn = createServerFn({ method: "POST" })
  .validator(deleteQuestionSchema)
  .handler(async ({ data }) => {
    await requireOwnDiscipline(data.disciplineId);
    const assignment = await requireAssignmentInDiscipline(data.assignmentId, data.disciplineId);

    const hasSubmissions = await db
      .select({ id: assignmentSubmissions.id })
      .from(assignmentSubmissions)
      .where(eq(assignmentSubmissions.assignmentId, assignment.id))
      .limit(1);
    if (hasSubmissions.length > 0) {
      throw new Error("Não é possível editar perguntas depois que algum aluno já entregou.");
    }

    await db.delete(assignmentQuestions).where(eq(assignmentQuestions.id, data.questionId));
    await recomputeAssignmentMaxScore(assignment.id, assignment.assessmentId);
  });
```

- [ ] **Passo 5: Checar o arquivo**

Run: `npx eslint src/functions/assignments.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Passo 6: Commit**

```bash
git add src/functions/assignments.ts
git commit -m "feat: adiciona criação de perguntas de tarefas de múltipla escolha"
```

### Tarefa 5.4 — Server functions: submissão + correção automática (aluno)

**Arquivos:**
- Criar: `src/server/assignments/scoring.ts`
- Modificar: `src/functions/assignmentSubmissions.ts`
- Ler: `src/functions/examAttempts.ts` (`buildAttemptState`, `submitExamAttemptFn` — o padrão de
  expor perguntas/opções sem `isCorrect` pro aluno, e de chamar a correção automática)

**Interfaces:**
- Consome: `sumCorrectPoints` de `src/lib/scoring.ts` (Tarefa 5.2); `assignmentQuestions`,
  `assignmentOptions`, `assignmentAnswers` de `src/server/db/schema.ts` (Tarefa 5.1).
- Produz: `finalizeAssignmentSubmission(submissionId)`; `submitAssignmentAnswersFn`;
  `MySubmission` ganha `kind` e `questions`, consumidos pela Tarefa 5.6.

- [ ] **Passo 1: `finalizeAssignmentSubmission` em `src/server/assignments/scoring.ts`**

Mesma forma de `finalizeExamAttempt` (Tarefa 5.2), sem o conceito de tentativa/tempo: soma os
pontos das respostas certas, marca a entrega como corrigida (`gradedAt`) — pra não entrar na
fila de correção manual da Fase 1 — e grava em `grades`.

```ts
import { eq, inArray } from "drizzle-orm";

import { sumCorrectPoints } from "@/lib/scoring";
import { db } from "@/server/db/client";
import {
  assignmentAnswers,
  assignmentOptions,
  assignmentQuestions,
  assignments,
  assignmentSubmissions,
  grades,
} from "@/server/db/schema";

/**
 * Corrige automaticamente uma entrega de tarefa objetiva: soma os pontos das
 * respostas certas com `sumCorrectPoints` (mesma função pura da correção de
 * provas), marca `gradedAt` na própria entrega e faz o upsert em `grades`
 * pelo `assignments.assessmentId` — o mesmo caminho que `gradeSubmissionFn`
 * usa na correção manual de tarefa aberta. Idempotente: se a entrega já foi
 * corrigida, não recalcula.
 */
export async function finalizeAssignmentSubmission(submissionId: string): Promise<void> {
  const [submission] = await db
    .select()
    .from(assignmentSubmissions)
    .where(eq(assignmentSubmissions.id, submissionId))
    .limit(1);
  if (!submission || submission.gradedAt) return;

  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, submission.assignmentId))
    .limit(1);
  if (!assignment) return;

  const [answerRows, questionRows] = await Promise.all([
    db
      .select({ optionId: assignmentAnswers.optionId })
      .from(assignmentAnswers)
      .where(eq(assignmentAnswers.submissionId, submissionId)),
    db
      .select({ id: assignmentQuestions.id, points: assignmentQuestions.points })
      .from(assignmentQuestions)
      .where(eq(assignmentQuestions.assignmentId, assignment.id)),
  ]);
  const selectedOptionIds = answerRows
    .map((a) => a.optionId)
    .filter((id): id is string => id !== null);
  const questionIds = questionRows.map((q) => q.id);

  const optionRows =
    questionIds.length === 0
      ? []
      : await db
          .select({
            id: assignmentOptions.id,
            questionId: assignmentOptions.questionId,
            isCorrect: assignmentOptions.isCorrect,
          })
          .from(assignmentOptions)
          .where(inArray(assignmentOptions.questionId, questionIds));

  const score = sumCorrectPoints(
    selectedOptionIds,
    optionRows,
    questionRows.map((q) => ({ id: q.id, points: Number(q.points) })),
  );

  await db
    .update(assignmentSubmissions)
    .set({ gradedAt: new Date() })
    .where(eq(assignmentSubmissions.id, submissionId));

  await db
    .insert(grades)
    .values({ assessmentId: assignment.assessmentId, studentId: submission.studentId, score: String(score) })
    .onConflictDoUpdate({
      target: [grades.assessmentId, grades.studentId],
      set: { score: String(score), updatedAt: new Date() },
    });
}
```

- [ ] **Passo 2: `MySubmission` ganha `kind` e `questions`; `getMySubmissionFn` expõe as
      perguntas sem `isCorrect` (mesmo cuidado de `buildAttemptState` em `examAttempts.ts`)**

`and`, `asc`, `eq` e `inArray` já vêm importados de `"drizzle-orm"` neste arquivo — só é
preciso acrescentar `assignmentAnswers`, `assignmentOptions` e `assignmentQuestions` ao import
de `@/server/db/schema`.

```ts
export type MySubmissionQuestion = {
  id: string;
  text: string;
  points: string;
  options: Array<{ id: string; text: string }>;
  selectedOptionId: string | null;
};

export type MySubmission = {
  assignmentId: string;
  kind: "open" | "multiple_choice";
  title: string;
  instructions: string | null;
  dueAt: string | null;
  textContent: string | null;
  fileUrl: string | null;
  fileName: string | null;
  submittedAt: string | null;
  feedback: string | null;
  score: string | null;
  maxScore: string;
  questions: Array<MySubmissionQuestion>;
};

/** Detalhe da tarefa + entrega própria (se houver), pra tela de envio do aluno. */
export const getMySubmissionFn = createServerFn({ method: "GET" })
  .validator(assignmentIdSchema)
  .handler(async ({ data }): Promise<MySubmission> => {
    const studentId = await requireStudentId();

    const [row] = await db
      .select({
        id: assignments.id,
        kind: assignments.kind,
        title: assignments.title,
        instructions: assignments.instructions,
        dueAt: assignments.dueAt,
        assessmentId: assignments.assessmentId,
        maxScore: assessments.maxScore,
      })
      .from(assignments)
      .innerJoin(assessments, eq(assignments.assessmentId, assessments.id))
      .where(eq(assignments.id, data.assignmentId))
      .limit(1);
    if (!row) throw new Error("Tarefa não encontrada.");

    const [submission] = await db
      .select()
      .from(assignmentSubmissions)
      .where(
        and(
          eq(assignmentSubmissions.assignmentId, data.assignmentId),
          eq(assignmentSubmissions.studentId, studentId),
        ),
      )
      .limit(1);

    const [grade] = await db
      .select({ score: grades.score })
      .from(grades)
      .where(and(eq(grades.assessmentId, row.assessmentId), eq(grades.studentId, studentId)))
      .limit(1);

    let questions: Array<MySubmissionQuestion> = [];
    if (row.kind === "multiple_choice") {
      const questionRows = await db
        .select()
        .from(assignmentQuestions)
        .where(eq(assignmentQuestions.assignmentId, row.id))
        .orderBy(asc(assignmentQuestions.sequence));
      const questionIds = questionRows.map((q) => q.id);

      const [optionRows, answerRows] = await Promise.all([
        questionIds.length === 0
          ? []
          : db
              .select({ id: assignmentOptions.id, text: assignmentOptions.text, questionId: assignmentOptions.questionId })
              .from(assignmentOptions)
              .where(inArray(assignmentOptions.questionId, questionIds))
              .orderBy(asc(assignmentOptions.sequence)),
        submission
          ? db
              .select({ questionId: assignmentAnswers.questionId, optionId: assignmentAnswers.optionId })
              .from(assignmentAnswers)
              .where(eq(assignmentAnswers.submissionId, submission.id))
          : Promise.resolve([]),
      ]);

      questions = questionRows.map((q) => ({
        id: q.id,
        text: q.text,
        points: q.points,
        options: optionRows.filter((o) => o.questionId === q.id).map((o) => ({ id: o.id, text: o.text })),
        selectedOptionId: answerRows.find((a) => a.questionId === q.id)?.optionId ?? null,
      }));
    }

    return {
      assignmentId: row.id,
      kind: row.kind,
      title: row.title,
      instructions: row.instructions,
      dueAt: row.dueAt ? row.dueAt.toISOString() : null,
      textContent: submission?.textContent ?? null,
      fileUrl: submission?.fileUrl ?? null,
      fileName: submission?.fileName ?? null,
      submittedAt: submission?.submittedAt ? submission.submittedAt.toISOString() : null,
      feedback: submission?.feedback ?? null,
      score: grade?.score ?? null,
      maxScore: row.maxScore,
      questions,
    };
  });
```

- [ ] **Passo 3: `submitAssignmentAnswersFn`, e travar `submitAssignmentFn` pra tarefa aberta**

`submitAssignmentFn` (texto/arquivo) passa a recusar tarefa `multiple_choice` — cada tipo tem
seu próprio caminho de envio, sem se misturar. A nova função é de envio único: ao contrário da
tarefa aberta (que aceita reenvio até ser corrigida), a objetiva já nasce corrigida no mesmo
golpe do envio, então uma segunda tentativa de enviar já encontra a entrega existente e é
recusada — sem precisar de lógica de bloqueio adicional.

```ts
const answerInputSchema = z.object({
  questionId: z.string().uuid(),
  optionId: z.string().uuid(),
});

const submitAnswersSchema = z.object({
  assignmentId: z.string().uuid(),
  answers: z.array(answerInputSchema).min(1, "Responda pelo menos uma pergunta."),
});

/** Envia as respostas de uma tarefa objetiva — grava e corrige na hora. Envio único. */
export const submitAssignmentAnswersFn = createServerFn({ method: "POST" })
  .validator(submitAnswersSchema)
  .handler(async ({ data }) => {
    const studentId = await requireStudentId();

    const [assignment] = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, data.assignmentId))
      .limit(1);
    if (!assignment) throw new Error("Tarefa não encontrada.");
    if (assignment.kind !== "multiple_choice") {
      throw new Error("Essa tarefa não é de múltipla escolha.");
    }

    const [existing] = await db
      .select({ id: assignmentSubmissions.id })
      .from(assignmentSubmissions)
      .where(
        and(
          eq(assignmentSubmissions.assignmentId, data.assignmentId),
          eq(assignmentSubmissions.studentId, studentId),
        ),
      )
      .limit(1);
    if (existing) {
      throw new Error("Essa tarefa já foi respondida — envio único, sem reenvio.");
    }

    const [submission] = await db
      .insert(assignmentSubmissions)
      .values({ assignmentId: data.assignmentId, studentId })
      .returning({ id: assignmentSubmissions.id });

    await db.insert(assignmentAnswers).values(
      data.answers.map((answer) => ({
        submissionId: submission.id,
        questionId: answer.questionId,
        optionId: answer.optionId,
      })),
    );

    await finalizeAssignmentSubmission(submission.id);
    await logAudit("tarefa.entregar", `Entregou a tarefa objetiva "${assignment.title}".`);
  });
```

Import `finalizeAssignmentSubmission` de `@/server/assignments/scoring` e `assignmentAnswers`
de `@/server/db/schema` no topo do arquivo. Em `submitAssignmentFn` (a função existente de
texto/arquivo), adicionar logo após buscar `assignment`:

```ts
if (assignment.kind !== "open") {
  throw new Error("Essa tarefa é de múltipla escolha — responda pelas alternativas.");
}
```

(A query que busca `assignment` em `submitAssignmentFn` precisa passar a selecionar também
`assignments.kind`, além de `assessmentId` e `title` que já seleciona.)

- [ ] **Passo 4: Checar os arquivos**

Run: `npx eslint src/server/assignments/scoring.ts src/functions/assignmentSubmissions.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Passo 5: Commit**

```bash
git add src/server/assignments/scoring.ts src/functions/assignmentSubmissions.ts
git commit -m "feat: adiciona envio e correção automática de tarefas de múltipla escolha"
```

### Tarefa 5.5 — UI do professor: criar e editar tarefa de múltipla escolha

**Arquivos:**
- Modificar: `src/pages/painel/AssignmentsTab.tsx`, `src/pages/painel/AssignmentEditor.tsx`,
  `src/functions/assignments.ts` (`AssignmentSummary`/`listMyDisciplineAssignmentsFn`)
- Ler: `src/pages/painel/ExamEditor.tsx` (`AddQuestionDialog`, a seção "Perguntas", `ExamResults`
  — os três padrões a espelhar), `src/pages/painel/Expenses.tsx` (uso de `Select`)

**Interfaces:**
- Consome: `createAssignmentFn` (com `kind`), `addAssignmentQuestionFn`,
  `deleteAssignmentQuestionFn`, `AssignmentDetail`, `SubmissionRow` (Tarefa 5.3).
- Produz: nada (fim da UI do professor).

- [ ] **Passo 1: Seletor de tipo no diálogo de criação (`AssignmentsTab.tsx`)**

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const assignmentSchema = z
  .object({
    kind: z.enum(["open", "multiple_choice"]).default("open"),
    title: z.string().trim().min(1, "Informe um título."),
    instructions: z.string().trim().optional(),
    maxScore: z.coerce.number().positive("Deve ser maior que zero.").optional(),
    weight: z.coerce.number().positive("Deve ser maior que zero."),
    dueAt: z.string().optional(),
  })
  .refine((data) => data.kind === "multiple_choice" || data.maxScore !== undefined, {
    message: "Informe a nota máxima.",
    path: ["maxScore"],
  });
```

No formulário, adicionar o campo antes de "Título" e esconder "Nota máxima" quando o tipo é
múltipla escolha (ela nasce em 0 e sobe com as perguntas — Tarefa 5.3, Passo 1):

```tsx
<FormField
  control={form.control}
  name="kind"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Tipo de tarefa</FormLabel>
      <Select onValueChange={field.onChange} value={field.value}>
        <FormControl>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value="open">Texto/arquivo</SelectItem>
          <SelectItem value="multiple_choice">Múltipla escolha (corrige sozinha)</SelectItem>
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

E envolver o campo "Nota máxima" existente com `{form.watch("kind") === "open" ? (...) : null}`.
Em `mutation.mutationFn`, passar `kind: values.kind` e `maxScore: values.maxScore ?? 10` (valor
ignorado no servidor quando `kind === "multiple_choice"`, mas o schema do form exige um número
não-undefined pro `createAssignmentFn` — usar `?? 10` evita erro de tipo).

- [ ] **Passo 2: Badge de tipo na listagem (`AssignmentsTab.tsx` + `assignments.ts`)**

Em `src/functions/assignments.ts`, `AssignmentSummary` ganha `kind`, e o `select()` de
`listMyDisciplineAssignmentsFn` passa a incluir `kind: assignments.kind` (a função já faz
`db.select().from(assignments)` sem projeção — trocar por
`db.select({ id: assignments.id, title: assignments.title, dueAt: assignments.dueAt, kind: assignments.kind, createdAt: assignments.createdAt }).from(assignments)`
ou simplesmente ler `assignment.kind` do resultado já completo, se a query continuar sem
projeção). No card do `Link` em `AssignmentsTab.tsx`, junto do prazo:

```tsx
<Badge variant="outline" className="mt-1">
  {assignment.kind === "multiple_choice" ? "Múltipla escolha" : "Texto/arquivo"}
</Badge>
```

Import `Badge` de `@/components/ui/badge` (novo neste arquivo).

- [ ] **Passo 3: Seção "Perguntas" em `AssignmentEditor.tsx`, só quando `kind === "multiple_choice"`**

Mesma estrutura visual de `ExamEditor.tsx` (lista de perguntas com opções, badge de pontos,
botão de remover quando não travada, diálogo de nova pergunta com `RadioGroup` marcando a
correta). Copiar `AddQuestionDialog` de `ExamEditor.tsx` quase literalmente, trocando
`addExamQuestionFn`/`deleteExamQuestionFn`/`examId` por
`addAssignmentQuestionFn`/`deleteAssignmentQuestionFn`/`assignmentId`, e renomeando pra
`AddAssignmentQuestionDialog` — inclusive as importações que ela usa (`zodResolver`,
`useFieldArray`, `useForm`, `z`, `RadioGroup`/`RadioGroupItem`, `Label`). `AssignmentEditor.tsx`
também precisa de `CheckCircle2` e `Plus` de `lucide-react`, que hoje não importa. Encaixar a
seção logo depois do cabeçalho de ações (editar/excluir tarefa) e antes de "Entregas":

```tsx
{assignment.kind === "multiple_choice" ? (
  <>
    <div className="flex items-center justify-between">
      <h2 className="font-display text-lg font-semibold text-foreground">Perguntas</h2>
      {!assignment.locked ? (
        <Button size="sm" onClick={() => setAddQuestionOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Adicionar pergunta
        </Button>
      ) : null}
    </div>
    {assignment.locked ? (
      <p className="mt-2 text-sm text-muted-foreground">
        Pelo menos um aluno já entregou essa tarefa — perguntas e opções não podem mais ser
        editadas.
      </p>
    ) : null}
    {assignment.questions.length === 0 ? (
      <p className="mt-4 rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft">
        Nenhuma pergunta ainda.
      </p>
    ) : (
      <div className="mt-4 grid gap-3">
        {assignment.questions.map((question, index) => (
          <div
            key={question.id}
            className="animate-in rounded-md border border-border/70 bg-card/70 p-4 shadow-soft fade-in slide-in-from-top-1 duration-200"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-foreground">
                {index + 1}. {question.text}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline">
                  {question.points} {Number(question.points) === 1 ? "ponto" : "pontos"}
                </Badge>
                {!assignment.locked ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Remover pergunta"
                    onClick={() => deleteQuestionMutation.mutate(question.id)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                ) : null}
              </div>
            </div>
            <ul className="mt-3 grid gap-1.5">
              {question.options.map((option) => (
                <li key={option.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                  {option.isCorrect ? (
                    <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
                  ) : (
                    <span className="size-4 shrink-0" />
                  )}
                  <span className={option.isCorrect ? "text-foreground" : undefined}>{option.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    )}
    <AddAssignmentQuestionDialog
      disciplineId={assignment.disciplineId}
      assignmentId={assignmentId}
      open={addQuestionOpen}
      onOpenChange={setAddQuestionOpen}
      onAdded={() => queryClient.invalidateQueries({ queryKey: assignmentKey(assignmentId) })}
    />
  </>
) : null}
```

Adicionar `const [addQuestionOpen, setAddQuestionOpen] = useState(false);` e
`deleteQuestionMutation` (mesmo padrão do `deleteQuestionMutation` de `ExamEditor.tsx`, chamando
`deleteAssignmentQuestionFn`) no topo do componente.

- [ ] **Passo 4: Para `kind === "multiple_choice"`, trocar "Entregas" por uma tabela de
      resultados — a nota já saiu sozinha, não faz sentido o formulário de lançar nota manual**

Reaproveita `getAssignmentSubmissionsFn` como está (já devolve `score`/`gradedAt`), só muda a
apresentação: uma tabela simples, no padrão de `ExamResults` de `ExamEditor.tsx`, em vez de
`SubmissionCard`. Condicional em volta do bloco "Entregas" já existente:

```tsx
{assignment.kind === "multiple_choice" ? (
  <AssignmentResultsTable submissions={submissions} loading={loadingSubmissions} />
) : (
  // ...o mapeamento de SubmissionCard que já existe, inalterado
)}
```

```tsx
function AssignmentResultsTable({
  submissions,
  loading,
}: {
  submissions: Array<SubmissionRow> | undefined;
  loading: boolean;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-md border border-border/70 bg-card/70 shadow-soft">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Aluno</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-center">Nota</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading || !submissions ? (
            <TableSkeletonRows columns={3} />
          ) : (
            submissions.map((row) => (
              <TableRow key={row.studentId} className="animate-in fade-in slide-in-from-top-1 duration-200">
                <TableCell className="font-medium text-foreground">{row.studentName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {row.submissionId === null ? "Não respondeu" : "Respondeu"}
                </TableCell>
                <TableCell className="text-center">
                  {row.score === null ? "—" : Number(row.score).toFixed(1)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

Import `Table`/`TableBody`/`TableCell`/`TableHead`/`TableHeader`/`TableRow` de
`@/components/ui/table`, `TableSkeletonRows` de `@/components/TableSkeletonRows` e `SubmissionRow`
de `@/functions/assignments` (já exportado).

- [ ] **Passo 5: Checar os arquivos**

Run: `npx eslint src/pages/painel/AssignmentsTab.tsx src/pages/painel/AssignmentEditor.tsx src/functions/assignments.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Passo 6: Roteiro manual**

Rodar `npm run dev`, logar como professor: criar uma tarefa "Múltipla escolha", conferir que
nota máxima fica escondida no formulário, adicionar 2-3 perguntas com alternativas, ver a nota
máxima da tarefa subir junto (na tela de editar tarefa/no peso mostrado), tentar adicionar
pergunta depois de simular uma entrega (deve travar). Criar também uma tarefa "Texto/arquivo" e
conferir que nada mudou nela (fluxo de correção manual intacto).

- [ ] **Passo 7: Build e commit**

Run: `npm run build`
Expected: PASS.

```bash
git add src/pages/painel/AssignmentsTab.tsx src/pages/painel/AssignmentEditor.tsx src/functions/assignments.ts
git commit -m "feat: UI do professor para criar e editar tarefas de múltipla escolha"
```

### Tarefa 5.6 — UI do aluno: responder tarefa de múltipla escolha

**Arquivos:**
- Modificar: `src/pages/portal/PortalAssignmentDetail.tsx`
- Ler: `src/pages/portal/TakeExam.tsx` (o bloco de perguntas com `RadioGroup`, linhas 190-216, e
  o diálogo de confirmação de envio, linhas 218-250 — padrão a espelhar, sem o cronômetro nem a
  tela de compromisso, que são específicos de prova)

**Interfaces:**
- Consome: `getMySubmissionFn` (com `kind`/`questions`), `submitAssignmentAnswersFn` (Tarefa
  5.4).
- Produz: nada (fim da fase).

- [ ] **Passo 1: Estado local das respostas e a mutation de envio**

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getMySubmissionFn, submitAssignmentAnswersFn, submitAssignmentFn } from "@/functions/assignmentSubmissions";

// ...dentro do componente, junto dos outros estados:
const [answers, setAnswers] = useState<Record<string, string>>({});

const submitAnswersMutation = useMutation({
  mutationFn: () =>
    submitAssignmentAnswersFn({
      data: {
        assignmentId,
        answers: Object.entries(answers).map(([questionId, optionId]) => ({ questionId, optionId })),
      },
    }),
  onSuccess: async () => {
    toast.success("Respostas enviadas.");
    await queryClient.invalidateQueries({ queryKey: submissionKey(assignmentId) });
  },
  onError: (error) =>
    toast.error(error instanceof Error ? error.message : "Não foi possível enviar."),
});
```

- [ ] **Passo 2: Ramificar a UI por `submission.kind`**

O bloco `isGraded` (linhas 79-107 do arquivo atual) já funciona sem alteração pra tarefa
objetiva corrigida — `textContent`/`fileUrl` vêm nulos e são simplesmente omitidos, e
`feedback` também vem nulo (não há correção manual). A única mudança é no bloco "ainda não
enviou" (o `else` da linha 108): trocar as `Tabs` de texto/arquivo por perguntas com
`RadioGroup` quando `submission.kind === "multiple_choice"`.

```tsx
) : submission.kind === "multiple_choice" ? (
  <div className="rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-5 shadow-soft">
    <div className="grid gap-4">
      {submission.questions.map((question, index) => (
        <div
          key={question.id}
          className="animate-in rounded-md border border-border/70 bg-card/40 p-4 fade-in slide-in-from-top-1 duration-200"
        >
          <p className="font-medium text-foreground">
            {index + 1}. {question.text}
          </p>
          <RadioGroup
            className="mt-3 gap-2.5"
            value={answers[question.id] ?? ""}
            onValueChange={(value) => setAnswers((prev) => ({ ...prev, [question.id]: value }))}
          >
            {question.options.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground"
              >
                <RadioGroupItem value={option.id} />
                {option.text}
              </label>
            ))}
          </RadioGroup>
        </div>
      ))}
    </div>

    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button className="mt-6" disabled={submitAnswersMutation.isPending}>
          {submitAnswersMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : null}
          Entregar respostas
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Entregar respostas?</AlertDialogTitle>
          <AlertDialogDescription>
            A nota sai na hora e não dá pra reenviar depois.{" "}
            {submission.questions.some((q) => !answers[q.id]) ? "Você tem pergunta(s) sem resposta." : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => submitAnswersMutation.mutate()}
            disabled={submitAnswersMutation.isPending}
          >
            {submitAnswersMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            Enviar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
) : (
  // ...o bloco de Tabs texto/arquivo que já existe, inalterado (tarefa "open")
```

Note que `mutation` (a existente, de `submitAssignmentFn`) e a UI de `Tabs` continuam
exatamente como estão — só passam a ficar atrás do `else` final, que só é alcançado quando
`submission.kind === "open"`.

- [ ] **Passo 3: Checar o arquivo**

Run: `npx eslint src/pages/portal/PortalAssignmentDetail.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Passo 4: Roteiro manual e critério de pronto da fase**

Rodar `npm run dev`, como aluno: abrir uma tarefa objetiva, responder todas as perguntas,
entregar, ver a nota aparecer na hora (mesma tela) e depois conferir que a nota também aparece
no boletim (`/portal/notas`) e na aba Notas do professor, sem precisar de nenhuma correção
manual. Tentar reabrir a mesma tarefa depois de entregue: deve mostrar só o resultado, sem opção
de reenviar. Conferir que uma tarefa aberta (texto/arquivo) continua funcionando exatamente como
antes.

- [ ] **Passo 5: Build final da fase**

Run: `npm run build`
Expected: PASS.

- [ ] **Passo 6: Commit**

```bash
git add src/pages/portal/PortalAssignmentDetail.tsx
git commit -m "feat: aluno responde tarefa de múltipla escolha com correção na hora"
```

---

## Fase 6 — Fórum interno de professores

Espaço de dúvidas e coordenação visível só para professores e admins — análogo ao fórum por
disciplina (`forumThreads`/`forumPosts`, `src/functions/forum.ts`), mas com tabelas próprias
(`teacher_forum_threads`/`teacher_forum_posts`, sem `disciplineId`) e guarda de acesso via
**apenas** `requireTeacherId()` — nunca `requireAnyIdentity()`, que deixaria aluno entrar.

**Descobertas de leitura do código real que precisam do desenho do spec:**
- `requireTeacherId()` (`src/server/auth/guard.ts:11`) devolve só o `teacherId` — nome e `role`
  não vêm junto. Toda função nova que precisa do nome (pra `authorName`, desnormalizado como já
  é em `forumThreads`/`forumPosts`) ou do papel (pra saber se é admin, decisão de moderação) faz
  sua própria consulta a `teachers` logo depois do guard — mesmo estilo de `requireAnyIdentity`
  em `guard.ts:90-123`, que já resolve nome assim para o fórum de disciplina.
- `canDeleteThread({ isModerator, isAuthor, postCount })` já existe em
  `src/lib/forumPermissions.ts` (Tarefa 3.1) e foi desenhada **de propósito** sem referência a
  disciplina — esta fase só passa `isModerator: <professor logado é admin>` em vez de
  `isModerator: <dono da disciplina>`. Nenhuma função nova de permissão é necessária.
- `sendPushToOwner` (`src/server/push.ts:32`) já nunca lança (tem seu próprio try/catch
  interno) — o `Promise.all` dos envios em `replyToThreadFn` (`src/functions/forum.ts:257-265`)
  já é seguro por causa disso, apesar do achado da Tarefa 0.6 ter sugerido `allSettled`. Esta
  fase, sendo código novo, usa `Promise.all` mesmo — comportamento idêntico ao do fórum de
  disciplina, sem introduzir uma variação sem necessidade.
- `getCurrentTeacherFn` (`src/functions/auth.ts:47`, já consumida por `PainelShell.tsx:36`) já
  devolve `{ id, name, email, role, mustChangePassword }` do professor logado — a UI reaproveita
  essa query (mesma `queryKey: ["current-teacher"]`, já em cache) pra saber se deve mostrar o
  botão de apagar tópico/mensagem alheios, em vez de inventar uma consulta nova.

### Tarefa 6.1 — Schema: tabelas do fórum interno

**Arquivos:**
- Modificar: `src/server/db/schema.ts`
- Ler: `forumThreads`/`forumPosts` (linhas 398-430 do arquivo atual) — o padrão de colunas a
  copiar, removendo `disciplineId`, `authorRole` e `authorStudentId` (só professor participa)

**Interfaces:**
- Consome: nada.
- Produz: `teacherForumThreads`, `teacherForumPosts` — usadas por todas as tarefas seguintes
  desta fase.

- [ ] **Passo 1: Adicionar as duas tabelas, logo depois de `forumPosts` (antes de
      `spiritualReflections`)**

```ts
// Fórum interno do corpo docente — dúvidas e coordenação entre professores,
// sem disciplina associada (o assunto é o próprio funcionamento do
// seminário) e sem aluno participando. `authorName` é desnormalizado, como
// em forumThreads/forumPosts, pra o histórico sobreviver à exclusão da conta.
export const teacherForumThreads = pgTable("teacher_forum_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorTeacherId: uuid("author_teacher_id").references(() => teachers.id, {
    onDelete: "set null",
  }),
  authorName: text("author_name").notNull(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teacherForumPosts = pgTable("teacher_forum_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => teacherForumThreads.id, { onDelete: "cascade" }),
  authorTeacherId: uuid("author_teacher_id").references(() => teachers.id, {
    onDelete: "set null",
  }),
  authorName: text("author_name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Nenhuma coluna nova em tabela existente — as duas tabelas são inteiramente novas, então não há
necessidade de `default` para compatibilidade com linhas antigas (Global Constraint 11 só se
aplica a coluna nova em tabela já existente).

- [ ] **Passo 2: Checar o arquivo**

Run: `npx eslint src/server/db/schema.ts && npx tsc --noEmit`
Expected: PASS, sem erros.

- [ ] **Passo 3: Aplicar o schema no banco**

Run: `npm run db:push`
Expected: o `drizzle-kit push` lista a criação das duas tabelas novas e aplica sem pedir
confirmação destrutiva — é tudo aditivo (nenhuma tabela nem coluna existente é tocada). Se o
terminal pedir confirmação, responder afirmativamente.

- [ ] **Passo 4: Commit**

```bash
git add src/server/db/schema.ts
git commit -m "feat: adiciona schema do fórum interno de professores"
```

### Tarefa 6.2 — Server functions: listar, criar e ler tópico

**Arquivos:**
- Criar: `src/functions/teacherForum.ts`
- Ler: `src/functions/forum.ts` inteiro (`listDisciplineThreadsFn`, `createThreadFn`,
  `getThreadFn` — o padrão de CRUD a espelhar, trocando `requireAnyIdentity()` por
  `requireTeacherId()` e removendo `authorRole`/`disciplineId`), `src/server/auth/guard.ts`
  (`requireTeacherId`)

**Interfaces:**
- Consome: `teacherForumThreads`, `teacherForumPosts` de `src/server/db/schema.ts` (Tarefa 6.1).
- Produz: `listTeacherThreadsFn`, `createTeacherThreadFn`, `getTeacherThreadFn` — consumidas
  pelas Tarefas 6.4 e 6.5.

- [ ] **Passo 1: Escrever o arquivo com as três funções de leitura/criação**

```ts
import { createServerFn } from "@tanstack/react-start";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import { requireTeacherId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { teachers, teacherForumPosts, teacherForumThreads } from "@/server/db/schema";

export type TeacherForumThreadSummary = {
  id: string;
  title: string;
  authorName: string;
  createdAt: string;
  postCount: number;
};

/** Todos os tópicos do fórum interno, mais recentes primeiro. Só professor/admin. */
export const listTeacherThreadsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<TeacherForumThreadSummary>> => {
    await requireTeacherId();

    const threadRows = await db
      .select()
      .from(teacherForumThreads)
      .orderBy(desc(teacherForumThreads.createdAt));
    const threadIds = threadRows.map((t) => t.id);

    const postRows =
      threadIds.length === 0
        ? []
        : await db
            .select({ threadId: teacherForumPosts.threadId })
            .from(teacherForumPosts)
            .where(inArray(teacherForumPosts.threadId, threadIds));

    return threadRows.map((thread) => ({
      id: thread.id,
      title: thread.title,
      authorName: thread.authorName,
      createdAt: thread.createdAt.toISOString(),
      postCount: postRows.filter((p) => p.threadId === thread.id).length,
    }));
  },
);

const createTeacherThreadSchema = z.object({
  title: z.string().trim().min(1, "Informe um título."),
  content: z.string().trim().min(1, "Escreva a mensagem inicial."),
});

/** Cria o tópico do fórum interno já com a primeira mensagem. */
export const createTeacherThreadFn = createServerFn({ method: "POST" })
  .validator(createTeacherThreadSchema)
  .handler(async ({ data }) => {
    const teacherId = await requireTeacherId();
    const [teacher] = await db
      .select({ name: teachers.name })
      .from(teachers)
      .where(eq(teachers.id, teacherId))
      .limit(1);
    const authorName = teacher?.name ?? "Professor";

    const [thread] = await db
      .insert(teacherForumThreads)
      .values({ authorTeacherId: teacherId, authorName, title: data.title })
      .returning({ id: teacherForumThreads.id });

    await db.insert(teacherForumPosts).values({
      threadId: thread.id,
      authorTeacherId: teacherId,
      authorName,
      content: data.content,
    });

    await logAudit(
      "forum_interno.criar_topico",
      `Criou o tópico "${data.title}" no fórum interno.`,
    );
    return { threadId: thread.id };
  });

const teacherThreadIdSchema = z.object({ threadId: z.string().uuid() });

export type TeacherForumPost = {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
  mine: boolean;
};

export type TeacherForumThreadDetail = {
  id: string;
  title: string;
  /** O tópico foi criado por quem está logado agora — mesma ideia de ForumThreadDetail.mine. */
  mine: boolean;
  posts: Array<TeacherForumPost>;
};

/** Tópico do fórum interno + todas as mensagens, em ordem cronológica. */
export const getTeacherThreadFn = createServerFn({ method: "GET" })
  .validator(teacherThreadIdSchema)
  .handler(async ({ data }): Promise<TeacherForumThreadDetail> => {
    const teacherId = await requireTeacherId();

    const [thread] = await db
      .select()
      .from(teacherForumThreads)
      .where(eq(teacherForumThreads.id, data.threadId))
      .limit(1);
    if (!thread) throw new Error("Tópico não encontrado.");

    const postRows = await db
      .select()
      .from(teacherForumPosts)
      .where(eq(teacherForumPosts.threadId, data.threadId))
      .orderBy(asc(teacherForumPosts.createdAt));

    return {
      id: thread.id,
      title: thread.title,
      mine: thread.authorTeacherId === teacherId,
      posts: postRows.map((post) => ({
        id: post.id,
        authorName: post.authorName,
        content: post.content,
        createdAt: post.createdAt.toISOString(),
        mine: post.authorTeacherId === teacherId,
      })),
    };
  });
```

- [ ] **Passo 2: Checar o arquivo**

Run: `npx eslint src/functions/teacherForum.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Passo 3: Commit**

```bash
git add src/functions/teacherForum.ts
git commit -m "feat: adiciona listagem, criação e leitura de tópicos do fórum interno"
```

### Tarefa 6.3 — Server functions: responder, apagar e notificar

**Arquivos:**
- Modificar: `src/functions/teacherForum.ts`
- Ler: `src/functions/forum.ts` (`replyToThreadFn`, `deleteThreadFn`, `deletePostFn` — o padrão
  de escrita a espelhar), `src/lib/forumPermissions.ts` (`canDeleteThread`, criada na Tarefa 3.1
  — se esta fase for executada antes da Fase 3 estar mergeada, criar o arquivo primeiro com o
  conteúdo já descrito na Tarefa 3.1 do plano)

**Interfaces:**
- Consome: `canDeleteThread` de `src/lib/forumPermissions.ts` (Tarefa 3.1); `sendPushToOwner` de
  `src/server/push.ts`.
- Produz: `createTeacherPostFn`, `deleteTeacherThreadFn`, `deleteTeacherPostFn` — consumidas
  pela Tarefa 6.5.

- [ ] **Passo 1: `createTeacherPostFn` — responde e notifica por push quem já participou**

```ts
import { canDeleteThread } from "@/lib/forumPermissions";
import { sendPushToOwner } from "@/server/push";
// ...(mantém os imports já existentes do Passo 1 da Tarefa 6.2)

const replyTeacherThreadSchema = z.object({
  threadId: z.string().uuid(),
  content: z.string().trim().min(1, "Escreva uma resposta."),
});

/** Responde no tópico do fórum interno e avisa por push quem já participou (menos quem respondeu). */
export const createTeacherPostFn = createServerFn({ method: "POST" })
  .validator(replyTeacherThreadSchema)
  .handler(async ({ data }) => {
    const teacherId = await requireTeacherId();
    const [teacher] = await db
      .select({ name: teachers.name })
      .from(teachers)
      .where(eq(teachers.id, teacherId))
      .limit(1);
    const authorName = teacher?.name ?? "Professor";

    // Pega quem já participou ANTES de inserir a resposta nova, pra poder
    // avisar todo mundo menos quem acabou de responder (mesmo padrão de
    // replyToThreadFn, src/functions/forum.ts:220-230).
    const previousPosts = await db
      .select({ authorTeacherId: teacherForumPosts.authorTeacherId })
      .from(teacherForumPosts)
      .where(eq(teacherForumPosts.threadId, data.threadId));

    await db.insert(teacherForumPosts).values({
      threadId: data.threadId,
      authorTeacherId: teacherId,
      authorName,
      content: data.content,
    });

    const [thread] = await db
      .select({ title: teacherForumThreads.title })
      .from(teacherForumThreads)
      .where(eq(teacherForumThreads.id, data.threadId))
      .limit(1);
    await logAudit(
      "forum_interno.responder",
      `Respondeu no tópico "${thread?.title ?? data.threadId}" do fórum interno.`,
    );

    const participantIds = new Set(
      previousPosts
        .map((post) => post.authorTeacherId)
        .filter((id): id is string => id !== null && id !== teacherId),
    );
    await Promise.all(
      [...participantIds].map((id) =>
        sendPushToOwner("teacher", id, {
          title: `Nova resposta: ${thread?.title ?? "Fórum interno"}`,
          body: `${authorName}: ${data.content.slice(0, 120)}`,
          url: "/painel/forum-interno",
        }),
      ),
    );
  });
```

- [ ] **Passo 2: `deleteTeacherThreadFn` — reusa `canDeleteThread`, admin como moderador**

```ts
/**
 * Apaga um tópico do fórum interno: admin sempre pode (moderação); o autor
 * só pode se ainda não houver nenhuma resposta — mesma regra de
 * canDeleteThread (Tarefa 3.1), só que "isModerator" aqui é "é admin" em vez
 * de "é dono da disciplina", porque o fórum interno não tem disciplina.
 */
export const deleteTeacherThreadFn = createServerFn({ method: "POST" })
  .validator(teacherThreadIdSchema)
  .handler(async ({ data }) => {
    const teacherId = await requireTeacherId();
    const [teacher] = await db
      .select({ role: teachers.role })
      .from(teachers)
      .where(eq(teachers.id, teacherId))
      .limit(1);
    const isModerator = teacher?.role === "admin";

    const [thread] = await db
      .select()
      .from(teacherForumThreads)
      .where(eq(teacherForumThreads.id, data.threadId))
      .limit(1);
    if (!thread) throw new Error("Tópico não encontrado.");
    const isAuthor = thread.authorTeacherId === teacherId;

    const postRows = await db
      .select({ id: teacherForumPosts.id })
      .from(teacherForumPosts)
      .where(eq(teacherForumPosts.threadId, data.threadId));
    // A mensagem inicial também é uma linha de teacherForumPosts — só conta
    // como "resposta" o que vier depois dela (mesma conta da Tarefa 3.1).
    const postCount = Math.max(0, postRows.length - 1);

    if (!canDeleteThread({ isModerator, isAuthor, postCount })) {
      throw new Error("Só é possível apagar um tópico que ainda não tem respostas.");
    }

    await db.delete(teacherForumThreads).where(eq(teacherForumThreads.id, data.threadId));

    // Auditoria só quando é admin moderando — o próprio autor apagando o
    // tópico vazio é correção trivial (mesma decisão da Tarefa 3.1).
    if (isModerator) {
      await logAudit(
        "forum_interno.apagar_topico",
        `Apagou o tópico "${thread.title}" do fórum interno.`,
      );
    }
  });
```

- [ ] **Passo 3: `deleteTeacherPostFn` — o autor apaga a própria mensagem, admin apaga qualquer uma**

```ts
const deleteTeacherPostSchema = z.object({ postId: z.string().uuid() });

/** Apaga a própria mensagem, ou qualquer uma se for admin. */
export const deleteTeacherPostFn = createServerFn({ method: "POST" })
  .validator(deleteTeacherPostSchema)
  .handler(async ({ data }) => {
    const teacherId = await requireTeacherId();

    const [post] = await db
      .select()
      .from(teacherForumPosts)
      .where(eq(teacherForumPosts.id, data.postId))
      .limit(1);
    if (!post) return;

    const isAuthor = post.authorTeacherId === teacherId;
    if (!isAuthor) {
      const [teacher] = await db
        .select({ role: teachers.role })
        .from(teachers)
        .where(eq(teachers.id, teacherId))
        .limit(1);
      if (teacher?.role !== "admin") {
        throw new Error("Você só pode apagar a própria mensagem.");
      }
    }

    await db.delete(teacherForumPosts).where(eq(teacherForumPosts.id, data.postId));
  });
```

- [ ] **Passo 4: Checar o arquivo**

Run: `npx eslint src/functions/teacherForum.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Passo 5: Roteiro manual de permissão (sem Vitest novo, conforme Global Constraint 13)**

Rodar `npm run dev`, logar como professor comum A: criar um tópico, responder num tópico de
outro professor (conferir push, se houver inscrição ativa), tentar apagar um tópico alheio com
resposta (deve falhar com a mensagem de erro), apagar a própria mensagem (deve funcionar). Logar
como aluno no portal e chamar as funções do módulo pelo console do navegador (ou tentar acessar
a URL da rota, feita na Tarefa 6.4) — todas devem devolver `UNAUTHORIZED`. Logar como admin:
apagar um tópico alheio com resposta (deve funcionar e aparecer em Auditoria).

- [ ] **Passo 6: Commit**

```bash
git add src/functions/teacherForum.ts
git commit -m "feat: adiciona resposta, exclusão e notificação do fórum interno"
```

### Tarefa 6.4 — Rota e UI: lista de tópicos (`/painel/forum-interno`)

Sem etapa de "escolher disciplina" — o fórum interno é uma lista só, direto.

**Arquivos:**
- Criar: `src/pages/painel/TeacherForumHome.tsx`, `src/routes/painel/forum-interno/index.tsx`
- Ler: `src/pages/painel/ForumHome.tsx` inteiro (`ForumThreadList`, `CreateThreadDialog` — o
  padrão visual a espelhar, removendo o passo de escolher disciplina),
  `src/routes/painel/forum/index.tsx` (padrão de rota)

**Interfaces:**
- Consome: `listTeacherThreadsFn`, `createTeacherThreadFn` de `src/functions/teacherForum.ts`
  (Tarefa 6.2).
- Produz: rota `/painel/forum-interno`, consumida pela Tarefa 6.6 (link de navegação).

- [ ] **Passo 1: Criar `TeacherForumHome.tsx`, no mesmo formato de `ForumThreadList` +
      `CreateThreadDialog` de `ForumHome.tsx`, sem o seletor de disciplina**

```tsx
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { Loader2, MessagesSquare, Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { PainelShell } from "@/components/painel/PainelShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { createTeacherThreadFn, listTeacherThreadsFn } from "@/functions/teacherForum";

export const teacherThreadsKey = ["teacher-forum-threads"] as const;

/** Fórum interno — só professores e admins veem esta tela e o link na navegação. */
export function TeacherForumHome() {
  const { data: threads, isLoading } = useQuery({
    queryKey: teacherThreadsKey,
    queryFn: () => listTeacherThreadsFn(),
  });
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <PainelShell
      title="Fórum interno"
      description="Espaço de dúvidas e coordenação só entre professores — alunos não têm acesso."
    >
      {isLoading || !threads ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div>
          <div className="mb-4 flex justify-end">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Novo tópico
            </Button>
          </div>

          {threads.length === 0 ? (
            <p className="rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft">
              Nenhum tópico ainda.
            </p>
          ) : (
            <div className="grid gap-3">
              {threads.map((thread) => (
                <Link
                  key={thread.id}
                  to="/painel/forum-interno/$threadId"
                  params={{ threadId: thread.id }}
                  className="flex animate-in items-start gap-3 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-4 shadow-soft fade-in slide-in-from-top-1 duration-200 transition-colors hover:border-primary/50"
                >
                  <MessagesSquare className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">
                      {thread.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {thread.authorName} · {thread.postCount}{" "}
                      {thread.postCount === 1 ? "mensagem" : "mensagens"}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}

          <CreateTeacherThreadDialog open={createOpen} onOpenChange={setCreateOpen} />
        </div>
      )}
    </PainelShell>
  );
}

const threadSchema = z.object({
  title: z.string().trim().min(1, "Informe um título."),
  content: z.string().trim().min(1, "Escreva a mensagem inicial."),
});

function CreateTeacherThreadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const form = useForm<z.infer<typeof threadSchema>>({
    resolver: zodResolver(threadSchema),
    defaultValues: { title: "", content: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof threadSchema>) => createTeacherThreadFn({ data: values }),
    onSuccess: async (result) => {
      toast.success("Tópico criado.");
      form.reset();
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: teacherThreadsKey });
      await navigate({
        to: "/painel/forum-interno/$threadId",
        params: { threadId: result.threadId },
      });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível criar o tópico."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo tópico</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Combinado de datas de prova" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mensagem</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Escreva aqui…" rows={4} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Criar tópico
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Passo 2: Criar a rota**

```tsx
import { createFileRoute } from "@tanstack/react-router";

import { TeacherForumHome } from "@/pages/painel/TeacherForumHome";

export const Route = createFileRoute("/painel/forum-interno/")({
  component: TeacherForumHome,
});
```

`src/routeTree.gen.ts` é gerado automaticamente pelo plugin do TanStack Router — não editar à
mão; `npm run dev` ou `npm run build` regeneram a árvore de rotas assim que os dois arquivos de
rota desta fase existirem (este e o da Tarefa 6.5).

- [ ] **Passo 3: Checar os arquivos**

Run: `npx eslint src/pages/painel/TeacherForumHome.tsx src/routes/painel/forum-interno/index.tsx && npx tsc --noEmit`
Expected: PASS. Se o `tsc` reclamar de `"/painel/forum-interno/$threadId"` não existir ainda
como rota válida, é porque a Tarefa 6.5 (que cria esse arquivo de rota) ainda não rodou nesta
sessão — normal neste ponto, resolve sozinho ao terminar a Tarefa 6.5.

- [ ] **Passo 4: Commit**

```bash
git add src/pages/painel/TeacherForumHome.tsx src/routes/painel/forum-interno/index.tsx
git commit -m "feat: adiciona a lista de tópicos do fórum interno"
```

### Tarefa 6.5 — UI: tópico individual com respostas (`/painel/forum-interno/$threadId`)

Componente próprio (não reaproveita `ForumThreadView`, que é específico do fórum por disciplina
— espera `disciplineId` e `authorRole` em cada post, campos que o fórum interno não tem).

**Arquivos:**
- Criar: `src/pages/painel/TeacherForumThread.tsx`, `src/routes/painel/forum-interno/$threadId.tsx`
- Ler: `src/components/forum/ForumThreadView.tsx` inteiro (o padrão visual a espelhar: cabeçalho
  com "voltar" + "apagar tópico", lista de mensagens com botão de apagar por mensagem, formulário
  de resposta, diálogo de confirmação de exclusão de tópico), `src/pages/painel/ForumThread.tsx`
  (padrão de página fina em volta do componente), `src/lib/forumPermissions.ts` (`canDeleteThread`)

**Interfaces:**
- Consome: `getTeacherThreadFn`, `createTeacherPostFn`, `deleteTeacherThreadFn`,
  `deleteTeacherPostFn` de `src/functions/teacherForum.ts` (Tarefas 6.2-6.3); `canDeleteThread`
  de `src/lib/forumPermissions.ts`; `getCurrentTeacherFn` de `src/functions/auth.ts` (pra saber
  se quem está logado é admin, sem precisar de uma consulta nova).
- Produz: nada (fim da UI do fórum interno).

- [ ] **Passo 1: Criar `TeacherForumThread.tsx`**

```tsx
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PainelShell } from "@/components/painel/PainelShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentTeacherFn } from "@/functions/auth";
import {
  createTeacherPostFn,
  deleteTeacherPostFn,
  deleteTeacherThreadFn,
  getTeacherThreadFn,
} from "@/functions/teacherForum";
import { canDeleteThread } from "@/lib/forumPermissions";

import { teacherThreadsKey } from "./TeacherForumHome";

function teacherThreadKey(threadId: string) {
  return ["teacher-forum-thread", threadId] as const;
}

export function TeacherForumThread({ threadId }: { threadId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useQuery({
    queryKey: ["current-teacher"],
    queryFn: () => getCurrentTeacherFn(),
  });
  const { data: thread, isLoading } = useQuery({
    queryKey: teacherThreadKey(threadId),
    queryFn: () => getTeacherThreadFn({ data: { threadId } }),
  });
  const [reply, setReply] = useState("");
  const [deleteThreadOpen, setDeleteThreadOpen] = useState(false);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: teacherThreadKey(threadId) });
  }

  const replyMutation = useMutation({
    mutationFn: () => createTeacherPostFn({ data: { threadId, content: reply } }),
    onSuccess: async () => {
      setReply("");
      await invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível responder."),
  });

  const deletePostMutation = useMutation({
    mutationFn: (postId: string) => deleteTeacherPostFn({ data: { postId } }),
    onSuccess: () => invalidate(),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível apagar."),
  });

  const deleteThreadMutation = useMutation({
    mutationFn: () => deleteTeacherThreadFn({ data: { threadId } }),
    onSuccess: async () => {
      toast.success("Tópico apagado.");
      await queryClient.invalidateQueries({ queryKey: teacherThreadsKey });
      await navigate({ to: "/painel/forum-interno" });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível apagar o tópico."),
  });

  const isModerator = me?.role === "admin";
  const canDelete =
    thread !== undefined &&
    canDeleteThread({
      isModerator,
      isAuthor: thread.mine,
      postCount: Math.max(0, thread.posts.length - 1),
    });

  return (
    <PainelShell title={thread?.title ?? "Carregando…"}>
      {isLoading || !thread ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <div>
          <div className="mb-6 flex items-center justify-between">
            <Link
              to="/painel/forum-interno"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
            >
              <ArrowLeft className="size-4 shrink-0" aria-hidden />
              Voltar para o fórum interno
            </Link>
            {canDelete ? (
              <Button variant="ghost" size="sm" onClick={() => setDeleteThreadOpen(true)}>
                <Trash2 className="size-4" aria-hidden />
                Apagar tópico
              </Button>
            ) : null}
          </div>

          <div className="grid gap-3">
            {thread.posts.map((post) => (
              <div
                key={post.id}
                className="rounded-md border border-border/70 bg-card/70 p-4 shadow-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{post.authorName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(post.createdAt).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  {post.mine || isModerator ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => deletePostMutation.mutate(post.id)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                      <span className="sr-only">Apagar mensagem</span>
                    </Button>
                  ) : null}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{post.content}</p>
              </div>
            ))}
          </div>

          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (reply.trim().length === 0) return;
              replyMutation.mutate();
            }}
          >
            <Textarea
              placeholder="Escreva uma resposta…"
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              rows={3}
            />
            <Button type="submit" disabled={replyMutation.isPending} className="self-end">
              Responder
            </Button>
          </form>

          <AlertDialog open={deleteThreadOpen} onOpenChange={setDeleteThreadOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apagar tópico?</AlertDialogTitle>
                <AlertDialogDescription>
                  Todas as mensagens desse tópico serão apagadas. Essa ação não pode ser
                  desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteThreadMutation.mutate()}>
                  Apagar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </PainelShell>
  );
}
```

`teacherThreadsKey` precisa ser exportado de `TeacherForumHome.tsx` (Tarefa 6.4) — conferir que
o export já está lá (`export const teacherThreadsKey = [...] as const;`).

- [ ] **Passo 2: Criar a rota**

```tsx
import { createFileRoute } from "@tanstack/react-router";

import { TeacherForumThread } from "@/pages/painel/TeacherForumThread";

export const Route = createFileRoute("/painel/forum-interno/$threadId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { threadId } = Route.useParams();
  return <TeacherForumThread threadId={threadId} />;
}
```

- [ ] **Passo 3: Checar os arquivos**

Run: `npx eslint src/pages/painel/TeacherForumThread.tsx src/routes/painel/forum-interno/'$threadId.tsx' && npx tsc --noEmit`
Expected: PASS.

- [ ] **Passo 4: Commit**

```bash
git add src/pages/painel/TeacherForumThread.tsx "src/routes/painel/forum-interno/\$threadId.tsx"
git commit -m "feat: adiciona a tela de tópico do fórum interno"
```

### Tarefa 6.6 — Link na navegação do painel + roteiro manual + build final da fase

**Arquivos:**
- Modificar: `src/components/painel/PainelShell.tsx`
- Ler: `src/components/painel/PainelShell.tsx` inteiro (`painelNavItems`, linhas 38-50 — todo
  professor vê; `adminOnlyNavItems`, linhas 52-57 — só admin)

**Interfaces:**
- Consome: rota `/painel/forum-interno` (Tarefas 6.4-6.5).
- Produz: nada (fim da fase).

- [ ] **Passo 1: Adicionar o item em `painelNavItems`, não em `adminOnlyNavItems`**

Professor comum também acessa o fórum interno (critério de pronto do spec: "professor comum e
admin acessam `/painel/forum-interno`") — por isso o link entra na lista que todo professor vê,
logo depois de "Fórum":

```ts
import { MessagesSquare } from "lucide-react";
// ...(mantém os demais ícones já importados)

const painelNavItems = [
  { to: "/painel", label: "Painel", icon: LayoutGrid },
  { to: "/painel/agenda", label: "Agenda", icon: CalendarRange },
  { to: "/painel/professores", label: "Contas de professores", icon: Users },
  { to: "/painel/alunos", label: "Alunos", icon: GraduationCap },
  { to: "/painel/provas", label: "Provas", icon: ClipboardList },
  { to: "/painel/tarefas", label: "Tarefas", icon: ListChecks },
  { to: "/painel/forum", label: "Fórum", icon: MessageCircle },
  { to: "/painel/forum-interno", label: "Fórum interno", icon: MessagesSquare },
  { to: "/painel/biblioteca", label: "Biblioteca virtual", icon: Library },
  { to: "/painel/relatorio", label: "Boletim do aluno", icon: FileText },
  { to: "/painel/relatorio-modulo", label: "Relatório por módulo", icon: Layers },
  { to: "/painel/pagamentos", label: "Pagamentos", icon: Wallet },
] as const;
```

O destaque do item ativo (`isActive`, linhas 98-101 do arquivo) já funciona sem mudança —
`/painel/forum-interno` não é prefixo de `/painel/forum` nem o contrário, então não há conflito
de destaque entre os dois links.

- [ ] **Passo 2: Checar o arquivo**

Run: `npx eslint src/components/painel/PainelShell.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Passo 3: Roteiro manual completo da fase**

Rodar `npm run dev`. Como professor comum: ver o link "Fórum interno" na navegação, entrar,
criar um tópico, responder, apagar a própria mensagem, apagar o próprio tópico sem resposta,
tentar apagar um tópico alheio com resposta (deve falhar). Como admin: ver o mesmo link, apagar
qualquer tópico/mensagem (deve funcionar e registrar em Auditoria quando for tópico alheio). Como
aluno, no portal: confirmar que não existe link equivalente e que a URL
`/painel/forum-interno` não é acessível (redireciona pro login do painel, mesmo comportamento de
qualquer outra rota de `/painel/*`).

- [ ] **Passo 4: Build final da fase**

Run: `npm run build`
Expected: PASS.

- [ ] **Passo 5: Commit**

```bash
git add src/components/painel/PainelShell.tsx
git commit -m "feat: adiciona o link do fórum interno na navegação do painel"
```

---

## Fase 7 — Compartilhamento de apostilas entre professores

Professor pode compartilhar sua apostila (`readingMaterials`, `src/functions/readingMaterials.ts`
— materiais de leitura por disciplina, **não** `courseMaterials`, que é catálogo cobrável do aluno
e não tem conteúdo pra compartilhar) com professores específicos, e discutir o conteúdo com eles.
Compartilhamento é **explícito e nominal** (o dono escolhe com quem, não existe "visível pra
todos") e dá acesso só de **leitura e comentário** — nunca de edição, que continua exclusiva do
dono da disciplina.

**Descobertas de leitura do código real que mudam/confirmam o que o spec havia previsto:**
- `readingMaterials` não tem `teacherId` próprio — o dono de uma apostila é sempre o professor
  dono da disciplina (`disciplines.teacherId`), resolvido via `readingMaterials.disciplineId`.
  Toda função de escrita desta fase (compartilhar, descompartilhar, listar quem já tem acesso)
  resolve a disciplina a partir do material e chama `requireOwnDiscipline`, no mesmo padrão de
  `updateMaterialFn`/`deleteMaterialFn` (`src/functions/readingMaterials.ts:87-117`).
- **Inconsistência encontrada no spec, corrigida aqui:** o spec (seção "Funções e UI" da Fase 7)
  propunha colocar a seção "Apostilas compartilhadas comigo" em `src/pages/painel/Materials.tsx`
  — mas esse arquivo é a tela `/painel/materiais` do catálogo **cobrável** (`courseMaterials`,
  só admin, rota em `adminOnlyNavItems`), sem nenhuma relação com apostilas de leitura. Colocar a
  seção lá misturaria dois domínios completamente diferentes atrás do mesmo nome. **Decisão desta
  fase:** a seção nova ganha página e rota próprias — `src/pages/painel/SharedMaterials.tsx` em
  `/painel/apostilas-compartilhadas`, acessível a todo professor (não só admin), no mesmo padrão
  usado pela Fase 6 para o fórum interno (página + rota dedicadas + item em `painelNavItems`).
- `ReadingMaterialsTab.tsx` já lista os materiais da disciplina com botões de ação por linha
  (editar, excluir) — a ação "Compartilhar" entra como um terceiro botão na mesma linha, seguindo
  exatamente o padrão visual já existente (`EditMaterialDialog`/`CreateMaterialDialog` no mesmo
  arquivo).
- `reflectionComments` (`src/server/db/schema.ts:443-452`) e o CRUD em `src/functions/reflections.ts`
  são o padrão de "conteúdo + comentários" a copiar: `teacherId` anulável, `authorName`
  desnormalizado, sem `updatedAt`/edição de comentário. A UI de comentário-por-item em
  `src/pages/painel/reports/StudentReport.tsx:340-395` (lista de comentários + `Textarea` +
  botão "Responder" por item) é o padrão visual a espelhar para o painel de comentários da
  apostila compartilhada.
- `listTeacherAccountsFn` (`src/functions/teacherAccounts.ts:28`) já usa só `requireTeacherId()`
  e devolve `{ id, name, email, hasLogin, role }` de **todos** os professores — é a fonte pronta
  pra popular a lista de "com quem compartilhar", sem precisar de função nova.

### Tarefa 7.1 — Schema: compartilhamento e comentários de apostila

**Arquivos:**
- Modificar: `src/server/db/schema.ts`
- Ler: `readingMaterials` (linhas 350-361) e `reflectionComments`/`spiritualReflections`
  (linhas 432-452) no mesmo arquivo — os dois padrões de coluna a copiar

**Interfaces:**
- Consome: nada.
- Produz: `readingMaterialShares`, `readingMaterialComments` — usadas por todas as tarefas
  seguintes desta fase.

- [ ] **Passo 1: Adicionar as duas tabelas, logo depois de `readingMaterials` (antes de
      `assignments`)**

```ts
// Compartilhamento explícito e nominal de uma apostila com outro professor —
// dá acesso de leitura e comentário, nunca de edição (só o dono da
// disciplina edita). sharedById é quem fez o compartilhamento (sempre o
// dono, na prática, já que só ele pode chamar shareMaterialFn) — snapshot
// anulável pra sobreviver à exclusão da conta de quem compartilhou.
export const readingMaterialShares = pgTable(
  "reading_material_shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    readingMaterialId: uuid("reading_material_id")
      .notNull()
      .references(() => readingMaterials.id, { onDelete: "cascade" }),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    sharedById: uuid("shared_by_id").references(() => teachers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.readingMaterialId, table.teacherId)],
);

// Discussão sobre uma apostila entre o dono e os professores com quem ela
// foi compartilhada. Mesmo formato de reflectionComments: teacherId
// anulável + authorName desnormalizado, pro histórico sobreviver à exclusão
// da conta.
export const readingMaterialComments = pgTable("reading_material_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  readingMaterialId: uuid("reading_material_id")
    .notNull()
    .references(() => readingMaterials.id, { onDelete: "cascade" }),
  teacherId: uuid("teacher_id").references(() => teachers.id, { onDelete: "set null" }),
  authorName: text("author_name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Nenhuma coluna nova em tabela existente — as duas tabelas são inteiramente novas, então não há
necessidade de `default` para compatibilidade com linhas antigas (Global Constraint 11 só se
aplica a coluna nova em tabela já existente).

- [ ] **Passo 2: Checar o arquivo**

Run: `npx eslint src/server/db/schema.ts && npx tsc --noEmit`
Expected: PASS, sem erros.

- [ ] **Passo 3: Aplicar o schema no banco**

Run: `npm run db:push`
Expected: o `drizzle-kit push` lista a criação das duas tabelas novas e aplica sem pedir
confirmação destrutiva — é tudo aditivo (nenhuma tabela nem coluna existente é tocada). Se o
terminal pedir confirmação, responder afirmativamente.

- [ ] **Passo 4: Commit**

```bash
git add src/server/db/schema.ts
git commit -m "feat: adiciona schema de compartilhamento e comentários de apostila"
```

### Tarefa 7.2 — Lógica pura: predicado de acesso à apostila compartilhada

**Arquivos:**
- Criar: `src/lib/materialAccess.ts`

**Interfaces:**
- Consome: nada (função pura).
- Produz: `canAccessMaterial({ isOwner, isSharedWithMe })`, consumida pela Tarefa 7.4.

- [ ] **Passo 1: Escrever a função**

```ts
export type MaterialAccessInput = {
  /** Quem pede é o professor dono da disciplina da apostila. */
  isOwner: boolean;
  /** Existe uma linha em reading_material_shares pra esse professor+apostila. */
  isSharedWithMe: boolean;
};

/**
 * Quem pode ler e comentar uma apostila: o dono (professor da disciplina) ou
 * um professor com quem ela foi explicitamente compartilhada. Não decide
 * edição — editar a apostila em si continua sendo sempre `requireOwnDiscipline`
 * puro, sem passar por este predicado (compartilhamento nunca dá acesso de
 * escrita ao conteúdo, só a leitura e comentário).
 */
export function canAccessMaterial({ isOwner, isSharedWithMe }: MaterialAccessInput): boolean {
  return isOwner || isSharedWithMe;
}
```

- [ ] **Passo 2: Checar o arquivo**

Run: `npx eslint src/lib/materialAccess.ts && npx tsc --noEmit`
Expected: PASS, sem erros.

- [ ] **Passo 3: Commit**

```bash
git add src/lib/materialAccess.ts
git commit -m "feat: adiciona predicado de acesso à apostila compartilhada"
```

### Tarefa 7.3 — Server functions: compartilhar, descompartilhar e listar compartilhamentos

**Arquivos:**
- Criar: `src/functions/materialSharing.ts`
- Ler: `src/functions/readingMaterials.ts` inteiro (`updateMaterialFn`/`deleteMaterialFn` — o
  padrão de resolver a disciplina a partir do material e chamar `requireOwnDiscipline`),
  `src/server/auth/guard.ts` (`requireOwnDiscipline`, `requireTeacherId`)

**Interfaces:**
- Consome: `readingMaterials`, `readingMaterialShares`, `teachers` de `src/server/db/schema.ts`
  (Tarefa 7.1).
- Produz: `shareMaterialFn`, `unshareMaterialFn`, `listMaterialSharesFn` — consumidas pela
  Tarefa 7.5.

- [ ] **Passo 1: Helper de acesso do dono, reaproveitado pelas três funções**

```ts
import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import { requireOwnDiscipline, requireTeacherId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { readingMaterialShares, readingMaterials, teachers } from "@/server/db/schema";

/**
 * Resolve o material e confirma que quem pede é o dono da disciplina dele —
 * mesmo padrão de updateMaterialFn/deleteMaterialFn
 * (src/functions/readingMaterials.ts), reaproveitado aqui porque
 * readingMaterials não tem teacherId próprio: o dono é sempre o professor
 * dono da disciplina.
 */
async function requireOwnMaterial(materialId: string) {
  const [material] = await db
    .select()
    .from(readingMaterials)
    .where(eq(readingMaterials.id, materialId))
    .limit(1);
  if (!material) throw new Error("Material não encontrado.");
  const discipline = await requireOwnDiscipline(material.disciplineId);
  return { material, discipline };
}
```

- [ ] **Passo 2: `shareMaterialFn` e `unshareMaterialFn`**

```ts
const shareSchema = z.object({ materialId: z.string().uuid(), teacherId: z.string().uuid() });

/** Compartilha a apostila com um professor específico — leitura e comentário, nunca edição. */
export const shareMaterialFn = createServerFn({ method: "POST" })
  .validator(shareSchema)
  .handler(async ({ data }) => {
    const { material, discipline } = await requireOwnMaterial(data.materialId);
    if (data.teacherId === discipline.teacherId) {
      throw new Error("Você já é o dono deste material.");
    }

    await db
      .insert(readingMaterialShares)
      .values({
        readingMaterialId: data.materialId,
        teacherId: data.teacherId,
        sharedById: discipline.teacherId,
      })
      .onConflictDoNothing({
        target: [readingMaterialShares.readingMaterialId, readingMaterialShares.teacherId],
      });

    await logAudit(
      "apostila.compartilhar",
      `Compartilhou o material "${material.title}" com outro professor.`,
    );
  });

/** Remove o compartilhamento — o professor perde o acesso de leitura/comentário na hora. */
export const unshareMaterialFn = createServerFn({ method: "POST" })
  .validator(shareSchema)
  .handler(async ({ data }) => {
    const { material } = await requireOwnMaterial(data.materialId);

    await db
      .delete(readingMaterialShares)
      .where(
        and(
          eq(readingMaterialShares.readingMaterialId, data.materialId),
          eq(readingMaterialShares.teacherId, data.teacherId),
        ),
      );

    await logAudit(
      "apostila.descompartilhar",
      `Removeu o compartilhamento do material "${material.title}" com um professor.`,
    );
  });
```

- [ ] **Passo 3: `listMaterialSharesFn` — só o dono vê com quem já compartilhou**

```ts
export type MaterialShare = { teacherId: string; teacherName: string };

const materialIdSchema = z.object({ materialId: z.string().uuid() });

/** Professores com quem esta apostila já foi compartilhada — pro diálogo de compartilhar. */
export const listMaterialSharesFn = createServerFn({ method: "GET" })
  .validator(materialIdSchema)
  .handler(async ({ data }): Promise<Array<MaterialShare>> => {
    await requireOwnMaterial(data.materialId);

    return db
      .select({ teacherId: readingMaterialShares.teacherId, teacherName: teachers.name })
      .from(readingMaterialShares)
      .innerJoin(teachers, eq(teachers.id, readingMaterialShares.teacherId))
      .where(eq(readingMaterialShares.readingMaterialId, data.materialId))
      .orderBy(asc(teachers.name));
  });
```

`asc` já vem importado de `"drizzle-orm"` no Passo 1 — não duplicar o import.

- [ ] **Passo 4: Checar o arquivo**

Run: `npx eslint src/functions/materialSharing.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Passo 5: Commit**

```bash
git add src/functions/materialSharing.ts
git commit -m "feat: adiciona compartilhar, descompartilhar e listar compartilhamentos de apostila"
```

### Tarefa 7.4 — Server functions: apostilas compartilhadas comigo e comentários

**Arquivos:**
- Modificar: `src/functions/materialSharing.ts`
- Ler: `src/functions/reflections.ts` inteiro (`buildReflections`, `addReflectionCommentFn` — o
  padrão de comentário a espelhar), `src/lib/materialAccess.ts` (`canAccessMaterial`, Tarefa 7.2)

**Interfaces:**
- Consome: `canAccessMaterial` de `src/lib/materialAccess.ts` (Tarefa 7.2);
  `readingMaterialComments`, `disciplines` de `src/server/db/schema.ts` (Tarefa 7.1 + já
  existente).
- Produz: `listSharedWithMeFn`, `listMaterialCommentsFn`, `createMaterialCommentFn`,
  `deleteMaterialCommentFn` — consumidas pelas Tarefas 7.6 e 7.7.

- [ ] **Passo 1: Helpers de dono e de acesso, reaproveitados pelas quatro funções**

Acrescentar aos imports do topo do arquivo (`disciplines`, `readingMaterialComments` em
`@/server/db/schema`; `inArray` em `"drizzle-orm"`; `canAccessMaterial` de
`@/lib/materialAccess`):

```ts
import { canAccessMaterial } from "@/lib/materialAccess";
// ...
import { disciplines, readingMaterialComments } from "@/server/db/schema";

/** Dono de uma apostila = dono da disciplina dela. Nulo se a disciplina ficou sem professor. */
async function getMaterialOwnerId(materialId: string): Promise<string | null> {
  const [row] = await db
    .select({ teacherId: disciplines.teacherId })
    .from(readingMaterials)
    .innerJoin(disciplines, eq(disciplines.id, readingMaterials.disciplineId))
    .where(eq(readingMaterials.id, materialId))
    .limit(1);
  return row?.teacherId ?? null;
}

async function resolveMaterialAccess(materialId: string, teacherId: string) {
  const [ownerId, shareRows] = await Promise.all([
    getMaterialOwnerId(materialId),
    db
      .select({ id: readingMaterialShares.id })
      .from(readingMaterialShares)
      .where(
        and(
          eq(readingMaterialShares.readingMaterialId, materialId),
          eq(readingMaterialShares.teacherId, teacherId),
        ),
      )
      .limit(1),
  ]);
  return { isOwner: ownerId === teacherId, isSharedWithMe: shareRows.length > 0 };
}
```

- [ ] **Passo 2: `listSharedWithMeFn`**

Agregação em memória sobre poucas queries amplas (Global Constraint 6): uma pra achar quais
apostilas foram compartilhadas comigo, outra pra buscar os dados delas, outra pros nomes de quem
compartilhou — sem `inArray` com lista vazia (guardado nos dois últimos casos).

```ts
export type SharedMaterial = {
  id: string;
  disciplineId: string;
  disciplineName: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileName: string;
  sharedByName: string;
  /** Quando o compartilhamento foi feito (não a criação da apostila). */
  sharedAt: string;
};

/** Apostilas que outros professores compartilharam comigo — leitura e comentário. */
export const listSharedWithMeFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<SharedMaterial>> => {
    const teacherId = await requireTeacherId();

    const shareRows = await db
      .select({
        materialId: readingMaterialShares.readingMaterialId,
        sharedById: readingMaterialShares.sharedById,
        createdAt: readingMaterialShares.createdAt,
      })
      .from(readingMaterialShares)
      .where(eq(readingMaterialShares.teacherId, teacherId));
    if (shareRows.length === 0) return [];

    const materialIds = shareRows.map((s) => s.materialId);
    const sharedByIds = shareRows
      .map((s) => s.sharedById)
      .filter((id): id is string => id !== null);

    const [materialRows, sharedByRows] = await Promise.all([
      db
        .select({
          id: readingMaterials.id,
          disciplineId: readingMaterials.disciplineId,
          disciplineName: disciplines.discipline,
          title: readingMaterials.title,
          description: readingMaterials.description,
          fileUrl: readingMaterials.fileUrl,
          fileName: readingMaterials.fileName,
        })
        .from(readingMaterials)
        .innerJoin(disciplines, eq(disciplines.id, readingMaterials.disciplineId))
        .where(inArray(readingMaterials.id, materialIds)),
      sharedByIds.length === 0
        ? []
        : db
            .select({ id: teachers.id, name: teachers.name })
            .from(teachers)
            .where(inArray(teachers.id, sharedByIds)),
    ]);

    return shareRows.map((share) => {
      const material = materialRows.find((m) => m.id === share.materialId);
      const sharedBy = sharedByRows.find((t) => t.id === share.sharedById);
      return {
        id: share.materialId,
        disciplineId: material?.disciplineId ?? "",
        disciplineName: material?.disciplineName ?? "",
        title: material?.title ?? "",
        description: material?.description ?? null,
        fileUrl: material?.fileUrl ?? "",
        fileName: material?.fileName ?? "",
        sharedByName: sharedBy?.name ?? "Professor",
        sharedAt: share.createdAt.toISOString(),
      };
    });
  },
);
```

`material` nunca fica de fato ausente aqui — `readingMaterialId` tem `onDelete: "cascade"`, então
apagar a apostila apaga o compartilhamento junto. Os `?? ""` são só defesa, mesmo estilo de
`material?.title ?? data.materialId` em `deleteMaterialFn`.

- [ ] **Passo 3: `listMaterialCommentsFn` e `createMaterialCommentFn`**

```ts
export type MaterialComment = {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
  mine: boolean;
};

/** Comentários da apostila — só quem tem acesso (dono ou compartilhado) pode ver. */
export const listMaterialCommentsFn = createServerFn({ method: "GET" })
  .validator(materialIdSchema)
  .handler(async ({ data }): Promise<Array<MaterialComment>> => {
    const teacherId = await requireTeacherId();
    const access = await resolveMaterialAccess(data.materialId, teacherId);
    if (!canAccessMaterial(access)) {
      throw new Error("Você não tem acesso a este material.");
    }

    const rows = await db
      .select()
      .from(readingMaterialComments)
      .where(eq(readingMaterialComments.readingMaterialId, data.materialId))
      .orderBy(asc(readingMaterialComments.createdAt));

    return rows.map((row) => ({
      id: row.id,
      authorName: row.authorName,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      mine: row.teacherId === teacherId,
    }));
  });

const createCommentSchema = z.object({
  materialId: z.string().uuid(),
  content: z.string().trim().min(1, "Escreva um comentário."),
});

/** Comenta a apostila — só quem tem acesso (dono ou compartilhado) pode comentar. */
export const createMaterialCommentFn = createServerFn({ method: "POST" })
  .validator(createCommentSchema)
  .handler(async ({ data }) => {
    const teacherId = await requireTeacherId();
    const access = await resolveMaterialAccess(data.materialId, teacherId);
    if (!canAccessMaterial(access)) {
      throw new Error("Você não tem acesso a este material.");
    }

    const [teacher] = await db
      .select({ name: teachers.name })
      .from(teachers)
      .where(eq(teachers.id, teacherId))
      .limit(1);

    await db.insert(readingMaterialComments).values({
      readingMaterialId: data.materialId,
      teacherId,
      authorName: teacher?.name ?? "Professor",
      content: data.content,
    });
  });
```

- [ ] **Passo 4: `deleteMaterialCommentFn` — o autor apaga o próprio, o dono apaga qualquer um**

**Decisão** (o spec não detalha a regra de exclusão de comentário): o autor sempre pode apagar o
próprio comentário; o dono da apostila também pode apagar qualquer comentário nela, como
moderação do próprio conteúdo — mesma ideia de `canDeleteThread`/`deleteTeacherPostFn` (Tarefas
3.1 e 6.3), sem reaproveitar a função em si porque aqui não há noção de "tópico sem resposta", só
autor-ou-dono.

```ts
const deleteCommentSchema = z.object({ commentId: z.string().uuid() });

export const deleteMaterialCommentFn = createServerFn({ method: "POST" })
  .validator(deleteCommentSchema)
  .handler(async ({ data }) => {
    const teacherId = await requireTeacherId();

    const [comment] = await db
      .select()
      .from(readingMaterialComments)
      .where(eq(readingMaterialComments.id, data.commentId))
      .limit(1);
    if (!comment) return;

    const isAuthor = comment.teacherId === teacherId;
    if (!isAuthor) {
      const ownerId = await getMaterialOwnerId(comment.readingMaterialId);
      if (ownerId !== teacherId) {
        throw new Error("Você só pode apagar o próprio comentário.");
      }
    }

    await db.delete(readingMaterialComments).where(eq(readingMaterialComments.id, data.commentId));
  });
```

- [ ] **Passo 5: Checar o arquivo**

Run: `npx eslint src/functions/materialSharing.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Passo 6: Commit**

```bash
git add src/functions/materialSharing.ts
git commit -m "feat: adiciona listagem de apostilas compartilhadas e comentários"
```

### Tarefa 7.5 — UI: botão "Compartilhar" em `ReadingMaterialsTab.tsx`

**Arquivos:**
- Modificar: `src/pages/painel/ReadingMaterialsTab.tsx`
- Ler: `src/functions/teacherAccounts.ts` (`listTeacherAccountsFn`, `TeacherAccount`),
  `src/functions/auth.ts` (`getCurrentTeacherFn` — pra excluir o próprio professor logado da
  lista de "com quem compartilhar"), `src/components/ui/switch.tsx` (já usado em
  `Materials.tsx` no mesmo padrão de alternância)

**Interfaces:**
- Consome: `shareMaterialFn`, `unshareMaterialFn`, `listMaterialSharesFn` (Tarefa 7.3);
  `listTeacherAccountsFn` (já existente).
- Produz: nada (fim da UI do dono).

- [ ] **Passo 1: Novo botão na linha do material, ao lado de "Editar"/"Excluir"**

```tsx
import { BookOpen, Download, Loader2, Pencil, Plus, Share2, Trash2 } from "lucide-react";
// ...
import {
  listMaterialSharesFn,
  shareMaterialFn,
  unshareMaterialFn,
} from "@/functions/materialSharing";
import { getCurrentTeacherFn } from "@/functions/auth";
import { listTeacherAccountsFn } from "@/functions/teacherAccounts";
import { Switch } from "@/components/ui/switch";

// ...dentro de ReadingMaterialsTab, junto de editMaterial:
const [shareMaterial, setShareMaterial] = useState<ReadingMaterial | null>(null);
```

No bloco de ações de cada material (antes do botão "Excluir"):

```tsx
<Button
  variant="ghost"
  size="icon"
  title="Compartilhar"
  onClick={() => setShareMaterial(material)}
>
  <Share2 className="size-4" aria-hidden />
</Button>
```

E, junto de `<EditMaterialDialog ... />` no fim do componente:

```tsx
<ShareMaterialDialog
  material={shareMaterial}
  onOpenChange={(open) => !open && setShareMaterial(null)}
/>
```

- [ ] **Passo 2: `ShareMaterialDialog` — lista de professores com alternância por linha**

```tsx
function ShareMaterialDialog({
  material,
  onOpenChange,
}: {
  material: ReadingMaterial | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ["current-teacher"],
    queryFn: () => getCurrentTeacherFn(),
  });
  const { data: teacherAccounts } = useQuery({
    queryKey: ["teacher-accounts"],
    queryFn: () => listTeacherAccountsFn(),
  });
  const sharesKey = ["material-shares", material?.id] as const;
  const { data: shares, isLoading } = useQuery({
    queryKey: sharesKey,
    queryFn: () => listMaterialSharesFn({ data: { materialId: material!.id } }),
    enabled: material !== null,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ teacherId, shared }: { teacherId: string; shared: boolean }) =>
      shared
        ? unshareMaterialFn({ data: { materialId: material!.id, teacherId } })
        : shareMaterialFn({ data: { materialId: material!.id, teacherId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sharesKey }),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar."),
  });

  const sharedIds = new Set((shares ?? []).map((s) => s.teacherId));
  const otherTeachers = (teacherAccounts ?? []).filter((t) => t.id !== me?.id);

  return (
    <Dialog open={material !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Compartilhar "{material?.title}"</DialogTitle>
        </DialogHeader>
        <div className="grid max-h-80 gap-1.5 overflow-y-auto">
          {isLoading ? (
            <>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </>
          ) : otherTeachers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum outro professor cadastrado.</p>
          ) : (
            otherTeachers.map((teacher) => {
              const shared = sharedIds.has(teacher.id);
              return (
                <div
                  key={teacher.id}
                  className="flex items-center justify-between rounded-md border border-border/70 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{teacher.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{teacher.email}</p>
                  </div>
                  <Switch
                    checked={shared}
                    disabled={toggleMutation.isPending}
                    onCheckedChange={() => toggleMutation.mutate({ teacherId: teacher.id, shared })}
                  />
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

`useQuery`/`useMutation`/`useQueryClient` já vêm importados no topo do arquivo (mesmo import de
`"@tanstack/react-query"` usado por `ReadingMaterialsTab`) — só acrescentar os símbolos novos aos
imports já existentes de `@/functions/*`, `lucide-react` e `sonner`, sem duplicar.

- [ ] **Passo 3: Checar o arquivo**

Run: `npx eslint src/pages/painel/ReadingMaterialsTab.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Passo 4: Commit**

```bash
git add src/pages/painel/ReadingMaterialsTab.tsx
git commit -m "feat: adiciona o botão de compartilhar apostila com outros professores"
```

### Tarefa 7.6 — UI: lista "Apostilas compartilhadas comigo" (`/painel/apostilas-compartilhadas`)

**Arquivos:**
- Criar: `src/pages/painel/SharedMaterials.tsx`, `src/routes/painel/apostilas-compartilhadas/index.tsx`
- Ler: `src/pages/painel/TeacherForumHome.tsx` (Tarefa 6.4 — o padrão visual de lista + `PainelShell`
  + `Skeleton` a espelhar, sem o diálogo de criação, que não existe aqui: quem lista não cria
  nada, só recebe compartilhamento)

**Interfaces:**
- Consome: `listSharedWithMeFn` de `src/functions/materialSharing.ts` (Tarefa 7.4).
- Produz: rota `/painel/apostilas-compartilhadas`, consumida pela Tarefa 7.7 (link "ver
  comentários") e pela Tarefa 7.7 (link de navegação).

- [ ] **Passo 1: Criar `SharedMaterials.tsx`**

```tsx
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

import { PainelShell } from "@/components/painel/PainelShell";
import { Skeleton } from "@/components/ui/skeleton";
import { listSharedWithMeFn } from "@/functions/materialSharing";

/** Apostilas que outros professores compartilharam comigo — só leitura e comentário. */
export function SharedMaterials() {
  const { data: materials, isLoading } = useQuery({
    queryKey: ["shared-materials"],
    queryFn: () => listSharedWithMeFn(),
  });

  return (
    <PainelShell
      title="Apostilas compartilhadas"
      description="Materiais que outros professores compartilharam com você — leitura e comentário."
    >
      {isLoading || !materials ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : materials.length === 0 ? (
        <p className="rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft">
          Nenhuma apostila compartilhada com você ainda.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {materials.map((material) => (
            <Link
              key={material.id}
              to="/painel/apostilas-compartilhadas/$materialId"
              params={{ materialId: material.id }}
              className="animate-in flex items-start gap-3 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-4 shadow-soft fade-in slide-in-from-top-1 duration-200 transition-colors hover:border-primary/50"
            >
              <BookOpen className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground">{material.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {material.disciplineName} · compartilhado por {material.sharedByName}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </PainelShell>
  );
}
```

- [ ] **Passo 2: Criar a rota**

```tsx
import { createFileRoute } from "@tanstack/react-router";

import { SharedMaterials } from "@/pages/painel/SharedMaterials";

export const Route = createFileRoute("/painel/apostilas-compartilhadas/")({
  component: SharedMaterials,
});
```

`src/routeTree.gen.ts` é gerado automaticamente pelo plugin do TanStack Router — não editar à
mão; `npm run dev` ou `npm run build` regeneram a árvore assim que os dois arquivos de rota desta
fase existirem (este e o da Tarefa 7.7).

- [ ] **Passo 3: Checar os arquivos**

Run: `npx eslint src/pages/painel/SharedMaterials.tsx src/routes/painel/apostilas-compartilhadas/index.tsx && npx tsc --noEmit`
Expected: PASS. Se o `tsc` reclamar de `"/painel/apostilas-compartilhadas/$materialId"` não
existir ainda como rota válida, é porque a Tarefa 7.7 (que cria esse arquivo de rota) ainda não
rodou nesta sessão — normal neste ponto, resolve sozinho ao terminar a Tarefa 7.7.

- [ ] **Passo 4: Commit**

```bash
git add src/pages/painel/SharedMaterials.tsx src/routes/painel/apostilas-compartilhadas/index.tsx
git commit -m "feat: adiciona a lista de apostilas compartilhadas comigo"
```

### Tarefa 7.7 — UI: leitor + comentários, link de navegação, roteiro manual e build final

**Arquivos:**
- Criar: `src/pages/painel/SharedMaterialReader.tsx`,
  `src/routes/painel/apostilas-compartilhadas/$materialId.tsx`
- Modificar: `src/components/painel/PainelShell.tsx`
- Ler: `src/pages/portal/PortalMaterialReader.tsx` inteiro (o `<iframe>` do PDF, sem toolbar —
  padrão a espelhar pro leitor), `src/pages/painel/reports/StudentReport.tsx:305-399` (o painel
  de comentários — lista + `Textarea` + botão "Responder" por item — padrão visual a espelhar
  para a discussão da apostila)

**Interfaces:**
- Consome: `listSharedWithMeFn` (Tarefa 7.6, pra achar o material pelo id — mesma técnica de
  `PortalMaterialReader.tsx`, que também resolve o item a partir da lista já carregada em vez de
  criar uma segunda função "buscar um só"), `listMaterialCommentsFn`, `createMaterialCommentFn`,
  `deleteMaterialCommentFn` (Tarefa 7.4).
- Produz: rota `/painel/apostilas-compartilhadas/$materialId`; item de navegação no painel — fim
  da fase.

- [ ] **Passo 1: Criar `SharedMaterialReader.tsx`, leitor + painel de comentários lado a lado**

```tsx
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PainelShell } from "@/components/painel/PainelShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentTeacherFn } from "@/functions/auth";
import {
  createMaterialCommentFn,
  deleteMaterialCommentFn,
  listMaterialCommentsFn,
  listSharedWithMeFn,
} from "@/functions/materialSharing";

function commentsKey(materialId: string) {
  return ["material-comments", materialId] as const;
}

export function SharedMaterialReader({ materialId }: { materialId: string }) {
  const queryClient = useQueryClient();
  const { data: materials, isLoading: loadingMaterial } = useQuery({
    queryKey: ["shared-materials"],
    queryFn: () => listSharedWithMeFn(),
  });
  const material = materials?.find((m) => m.id === materialId);

  const { data: me } = useQuery({
    queryKey: ["current-teacher"],
    queryFn: () => getCurrentTeacherFn(),
  });
  const { data: comments, isLoading: loadingComments } = useQuery({
    queryKey: commentsKey(materialId),
    queryFn: () => listMaterialCommentsFn({ data: { materialId } }),
  });
  const [draft, setDraft] = useState("");

  function invalidateComments() {
    return queryClient.invalidateQueries({ queryKey: commentsKey(materialId) });
  }

  const commentMutation = useMutation({
    mutationFn: () => createMaterialCommentFn({ data: { materialId, content: draft } }),
    onSuccess: async () => {
      setDraft("");
      await invalidateComments();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível comentar."),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => deleteMaterialCommentFn({ data: { commentId } }),
    onSuccess: () => invalidateComments(),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível apagar."),
  });

  return (
    <PainelShell title={material?.title ?? (loadingMaterial ? "Carregando…" : "Apostila")} fullWidth>
      <Link
        to="/painel/apostilas-compartilhadas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-4 shrink-0" aria-hidden />
        Voltar pras apostilas compartilhadas
      </Link>

      {loadingMaterial || !material ? (
        <Skeleton className="h-[70vh] w-full" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="overflow-hidden rounded-md border border-border/70 bg-card/70 shadow-soft">
            <iframe
              src={`${material.fileUrl}#toolbar=0&navpanes=0`}
              title={material.title}
              className="h-[70vh] w-full"
            />
          </div>

          <div className="flex flex-col rounded-md border border-border/70 bg-card/70 p-4 shadow-soft">
            <h2 className="font-display text-sm font-semibold text-foreground">Comentários</h2>
            <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
              {loadingComments ? (
                <>
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </>
              ) : comments && comments.length > 0 ? (
                comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="animate-in rounded-md bg-muted/40 p-3 fade-in slide-in-from-top-1 duration-200"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-foreground">{comment.authorName}</p>
                      {comment.mine ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteCommentMutation.mutate(comment.id)}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                          <span className="sr-only">Apagar comentário</span>
                        </Button>
                      ) : null}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                      {comment.content}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>
              )}
            </div>

            <form
              className="mt-3 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (draft.trim().length === 0) return;
                commentMutation.mutate();
              }}
            >
              <Textarea
                placeholder="Comentar…"
                rows={2}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <Button type="submit" size="sm" disabled={commentMutation.isPending}>
                {commentMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Enviar
              </Button>
            </form>
          </div>
        </div>
      )}
    </PainelShell>
  );
}
```

`me` é buscado só pra deixar explícito que a UI não decide exclusão sozinha — quem decide é o
servidor (`deleteMaterialCommentFn`); o botão de apagar aparece com base em `comment.mine`, já
calculado por `listMaterialCommentsFn`, e falha com toast se o servidor recusar (ex.: o dono
tentando apagar via um `comment.mine` desatualizado em cache — caso raro, tratado pelo
`onError` já existente).

- [ ] **Passo 2: Criar a rota**

```tsx
import { createFileRoute } from "@tanstack/react-router";

import { SharedMaterialReader } from "@/pages/painel/SharedMaterialReader";

export const Route = createFileRoute("/painel/apostilas-compartilhadas/$materialId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { materialId } = Route.useParams();
  return <SharedMaterialReader materialId={materialId} />;
}
```

- [ ] **Passo 3: Link na navegação do painel, visível a todo professor**

Igual à Tarefa 6.6: professor comum também acessa apostilas compartilhadas (o compartilhamento
não é privilégio de admin), então o item entra em `painelNavItems`, não em `adminOnlyNavItems`,
logo depois de "Biblioteca virtual":

```ts
import { Share2 } from "lucide-react";
// ...(mantém os demais ícones já importados)

const painelNavItems = [
  { to: "/painel", label: "Painel", icon: LayoutGrid },
  { to: "/painel/agenda", label: "Agenda", icon: CalendarRange },
  { to: "/painel/professores", label: "Contas de professores", icon: Users },
  { to: "/painel/alunos", label: "Alunos", icon: GraduationCap },
  { to: "/painel/provas", label: "Provas", icon: ClipboardList },
  { to: "/painel/tarefas", label: "Tarefas", icon: ListChecks },
  { to: "/painel/forum", label: "Fórum", icon: MessageCircle },
  { to: "/painel/biblioteca", label: "Biblioteca virtual", icon: Library },
  { to: "/painel/apostilas-compartilhadas", label: "Apostilas compartilhadas", icon: Share2 },
  { to: "/painel/relatorio", label: "Boletim do aluno", icon: FileText },
  { to: "/painel/relatorio-modulo", label: "Relatório por módulo", icon: Layers },
  { to: "/painel/pagamentos", label: "Pagamentos", icon: Wallet },
] as const;
```

Se a Fase 6 já estiver mergeada, `painelNavItems` também já tem a entrada `/painel/forum-interno`
— manter, só acrescentar a linha nova depois de "Biblioteca virtual" como acima.

- [ ] **Passo 4: Checar os arquivos**

Run: `npx eslint src/pages/painel/SharedMaterialReader.tsx src/routes/painel/apostilas-compartilhadas/'$materialId.tsx' src/components/painel/PainelShell.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Passo 5: Roteiro manual completo da fase**

Rodar `npm run dev`. Como professor A, numa disciplina com pelo menos uma apostila: abrir
"Apostila", clicar em "Compartilhar" num material, ligar o `Switch` do professor B, fechar o
diálogo. Como professor B: ver o link "Apostilas compartilhadas" na navegação, entrar, ver o
material de A na lista com o nome da disciplina e "compartilhado por A", abrir, ler o PDF
embutido, escrever um comentário, ver o comentário aparecer com o próprio nome e botão de apagar.
Como professor A: abrir o mesmo material pela própria aba "Apostila" da disciplina (ele não passa
pela lista de compartilhadas, é o dono) — não é preciso testar o leitor daqui, só confirmar que
comentar via `createMaterialCommentFn` funcionaria se A tivesse a mesma tela (a regra de acesso
já cobre dono). Como professor C, sem nenhum compartilhamento: entrar em "Apostilas
compartilhadas" e ver a lista vazia. Voltar como A: desligar o `Switch` do professor B e conferir
que B, ao recarregar, não vê mais o material na lista nem consegue reabrir a URL antiga do
leitor (a chamada a `listMaterialCommentsFn`/`listSharedWithMeFn` deve devolver vazio/erro de
acesso).

- [ ] **Passo 6: Build final da fase**

Run: `npm run build`
Expected: PASS.

- [ ] **Passo 7: Commit**

```bash
git add src/pages/painel/SharedMaterialReader.tsx src/routes/painel/apostilas-compartilhadas/'$materialId.tsx' src/components/painel/PainelShell.tsx
git commit -m "feat: adiciona leitor com comentários e navegação das apostilas compartilhadas"
```

---

## Roteiro manual

Checklist rápido de verificação manual, uma vez por fase, executado com `npm run dev` antes de
abrir o PR (Global Constraint 16). Cada tarefa já traz seu próprio passo "Roteiro manual" — esta
seção só consolida, fase a fase, o mínimo a conferir antes de considerar o PR pronto. A Fase 0
não entra aqui (é auditoria + correção pontual, verificada por `npm run test`/`npm run lint`, sem
roteiro de tela) e a Fase 1 já foi implementada e revisada em PR próprio, fora deste plano.

### Fase 2 — Dashboard do aluno

- [ ] Aluno em dia entra em `/portal/`: nenhum alerta de cobrança aparece.
- [ ] Aluno com cobrança vencida vê o alerta vermelho, com o botão "Pagar" levando a
      `/portal/pagamentos`.
- [ ] Aluno com cobrança vencendo em até 7 dias vê o alerta âmbar (não vermelho).
- [ ] "Próxima aula" mostra a aula futura mais próxima entre todas as disciplinas, e some quando
      não há nenhuma.
- [ ] "Vídeo-aulas novas" mostra só o que o aluno não assistiu, mais recente primeiro, e some
      quando não há nenhuma.
- [ ] Aluno sem nenhuma pendência: a tela não fica com caixas vazias.

### Fase 3 — Aluno apaga o próprio tópico sem respostas

- [ ] Professor continua apagando qualquer tópico da própria disciplina, mesmo com respostas.
- [ ] Aluno cria um tópico, vê o botão "Apagar tópico" e consegue apagar (sem resposta ainda).
- [ ] Depois de uma resposta (própria ou de outra pessoa) no tópico, o botão some para o aluno.

### Fase 4 — Painel de acompanhamento por disciplina

- [ ] A aba "Acompanhamento" abre primeiro ao entrar numa disciplina.
- [ ] Os números de nota/frequência/tarefas/provas/vídeos de dois ou três alunos batem com o que
      `GradesTab`/`AttendanceTab`/`VideoLessonsTab` já mostram para os mesmos alunos.
- [ ] Aluno abaixo de `PASSING_AVERAGE` ou de `MINIMUM_ATTENDANCE_RATIO` aparece destacado.
- [ ] Clicar em "Média" e em "Frequência" reordena a tabela com o pior caso no topo.
- [ ] Disciplina sem tarefa/prova/vídeo mostra "0/0" sem quebrar; sem nenhuma aula lançada mostra
      "—" na frequência (nunca "100%").

### Fase 5 — Tarefas de múltipla escolha

- [ ] `npm run db:push` aplica o schema novo sem pedir confirmação destrutiva.
- [ ] Uma prova existente, respondida como antes, dá exatamente a mesma nota de antes da
      refatoração de `finalizeExamAttempt` (regressão do motor de correção).
- [ ] Professor cria uma tarefa "Múltipla escolha": nota máxima fica escondida no formulário,
      sobe sozinha conforme perguntas são cadastradas.
- [ ] Adicionar pergunta trava depois que algum aluno já entregou a tarefa.
- [ ] Aluno responde a tarefa objetiva, vê a nota sair na hora, e ela aparece tanto no boletim
      (`/portal/notas`) quanto na aba Notas do professor, sem correção manual.
- [ ] Reabrir a mesma tarefa depois de entregue mostra só o resultado, sem opção de reenviar.
- [ ] Uma tarefa "Texto/arquivo" continua funcionando exatamente como antes (correção manual
      intacta).

### Fase 6 — Fórum interno de professores

- [ ] `npm run db:push` aplica as duas tabelas novas sem pedir confirmação destrutiva.
- [ ] Professor comum vê o link "Fórum interno", cria tópico, responde, apaga a própria
      mensagem, apaga o próprio tópico sem resposta.
- [ ] Professor comum falha ao tentar apagar um tópico alheio com resposta (mensagem de erro
      clara).
- [ ] Admin apaga qualquer tópico/mensagem alheios, e a ação aparece em Auditoria.
- [ ] Aluno logado no portal não vê o link e recebe `UNAUTHORIZED` ao chamar qualquer função de
      `src/functions/teacherForum.ts` (console do navegador) ou ao acessar a URL direto.

### Fase 7 — Compartilhamento de apostilas entre professores

- [ ] `npm run db:push` aplica as duas tabelas novas sem pedir confirmação destrutiva.
- [ ] Professor A compartilha uma apostila com o professor B pelo botão "Compartilhar" na aba
      Apostila da disciplina.
- [ ] Professor B vê o material em "Apostilas compartilhadas", lê o PDF embutido e comenta.
- [ ] Professor C, sem compartilhamento nenhum, vê a lista vazia.
- [ ] Professor A desliga o compartilhamento com B: B deixa de ver o material na lista e a
      função de comentários passa a recusar acesso.
- [ ] Aluno no portal não tem nenhuma tela ou link equivalente (compartilhamento é só entre
      professores).

### Portões finais, todas as fases

`npm run test`, `npm run lint` e `npm run build` verdes antes de qualquer PR (Global
Constraint 16). A partir da Fase 2, sem Vitest novo (Global Constraint 13 atualizada) — o portão
`npm run test` continua verde porque nada nele muda, só não cresce.
