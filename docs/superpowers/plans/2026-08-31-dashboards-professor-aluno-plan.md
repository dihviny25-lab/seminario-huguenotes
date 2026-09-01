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
