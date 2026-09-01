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
