# Corrigir login de aluno com e-mail duplicado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Impedir que dois alunos tenham o mesmo e-mail cadastrado, pra que `studentLoginFn` nunca autentique um aluno contra a senha de outro.

**Architecture:** `students.email` (`src/server/db/schema.ts`) não tem constraint única — diferente de `teachers.email`, que já tem `.unique()`. Nenhum lugar que cria/edita/importa aluno (`src/functions/students.ts`) verifica duplicidade. `studentLoginFn` busca por `eq(students.email, ...).limit(1)` sem `ORDER BY`: se dois alunos compartilham e-mail, a linha retornada é indeterminada, e o aluno pode ver "e-mail ou senha inválidos" mesmo digitando a senha certa (ou pior, autenticar como o outro aluno). A correção segue o padrão que `src/functions/teacherAccounts.ts` já usa pra `teachers.email`: constraint única no banco + captura da violação (`isUniqueViolation`, hoje duplicada ali) virando mensagem amigável. Este plano extrai esse helper pra um módulo compartilhado e o reaplica em `students.ts`, incluindo a importação em lote.

**Tech Stack:** Drizzle ORM, Postgres (Neon), Zod, TanStack Start server functions.

**Spec:** Sem doc de design formal — tarefa "bounded" discutida em chat na sessão de 2026-09-22 (varredura de erros → brainstorming).

## Global Constraints

- Não escrever testes automatizados novos para esta tarefa (preferência do usuário). Verificação é via `npm run typecheck`, `npm test` e checagem manual descrita em cada task.
- `students.email` continua nullable — a constraint única do Postgres permite múltiplos `NULL` (só valores não-nulos precisam ser distintos), então alunos sem e-mail cadastrado não são afetados.
- **Não rodar `npm run db:push` contra o banco de produção sem confirmação explícita do usuário** — é uma alteração de schema numa base viva. Antes de aplicar, é obrigatório checar se já existem e-mails duplicados (Task 1, Step 1); se existirem, resolver manualmente (perguntar ao usuário como tratar cada caso) antes de seguir, porque o `db:push` vai falhar com a constraint até os duplicados existentes serem removidos/corrigidos.

---

### Task 1: Constraint única em `students.email` + helper de erro compartilhado

**Files:**
- Modify: `src/server/db/schema.ts` (coluna `email` da tabela `students`)
- Create: `src/server/db/errors.ts`
- Modify: `src/functions/teacherAccounts.ts` (trocar `isUniqueViolation` local pelo import compartilhado)
- Modify: `src/functions/students.ts` (`createStudentFn`, `updateStudentFn`)

**Interfaces:**
- Produces: `isUniqueViolation(error: unknown): boolean` exportado de `src/server/db/errors.ts` — usado por `teacherAccounts.ts` e `students.ts`.

- [ ] **Step 1: Checar duplicados existentes antes de tocar no schema**

Antes de editar qualquer coisa, rode esta consulta contra o banco de destino (Neon — via `psql`, o console do Neon, ou a ferramenta MCP do Neon, com autorização do usuário) pra garantir que a constraint não vai falhar ao aplicar:

```sql
SELECT lower(email) AS email, count(*), array_agg(name) AS alunos
FROM students
WHERE email IS NOT NULL AND email <> ''
GROUP BY lower(email)
HAVING count(*) > 1;
```

Se a consulta retornar linhas: pare aqui e decida com o usuário como resolver cada duplicata (normalmente: perguntar aos alunos afetados o e-mail correto de cada um, ou o admin corrigir manualmente pela tela de alunos) antes de continuar pro Step 2. Não force a constraint com duplicatas existentes.

- [ ] **Step 2: Extrair `isUniqueViolation` pra um módulo compartilhado**

Criar `src/server/db/errors.ts`:

```typescript
/** Erro do Postgres pra violação de constraint única (ex.: e-mail duplicado). */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}
```

Em `src/functions/teacherAccounts.ts`, remover a definição local de `isUniqueViolation` (linhas 19-26) e importar do novo módulo:

```typescript
import { isUniqueViolation } from "@/server/db/errors";
```

- [ ] **Step 3: Adicionar a constraint única no schema**

Em `src/server/db/schema.ts`, na tabela `students`, trocar:

```typescript
  email: text("email"),
```

por:

```typescript
  email: text("email").unique(),
```

- [ ] **Step 4: Aplicar a mudança de schema no banco**

Com o Step 1 confirmado limpo (sem duplicatas) e autorização explícita do usuário para alterar o banco de destino:

```bash
npm run db:push
```

Confirme no prompt do `drizzle-kit` que a mudança é só "adicionar constraint única em `students.email`" antes de aceitar.

- [ ] **Step 5: Traduzir a violação em `createStudentFn`**

Em `src/functions/students.ts`, importar o helper:

```typescript
import { isUniqueViolation } from "@/server/db/errors";
```

Envolver o insert existente em try/catch (mesmo padrão de `createTeacherAccountFn`):

```typescript
export const createStudentFn = createServerFn({ method: "POST" })
  .validator(createSchema)
  .handler(async ({ data }) => {
    await requireAdminId();
    try {
      const [row] = await db
        .insert(students)
        .values({ name: data.name, email: data.email || null, phone: data.phone?.trim() || null })
        .returning({ id: students.id });
      await logAudit("aluno.criar", `Cadastrou o aluno ${data.name}.`);
      return row;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new Error("Já existe um aluno cadastrado com esse e-mail.");
      }
      throw error;
    }
  });
```

- [ ] **Step 6: Traduzir a violação em `updateStudentFn`**

Mesmo padrão:

```typescript
export const updateStudentFn = createServerFn({ method: "POST" })
  .validator(updateSchema)
  .handler(async ({ data }) => {
    await requireAdminId();
    try {
      await db
        .update(students)
        .set({ name: data.name, email: data.email || null, phone: data.phone?.trim() || null })
        .where(eq(students.id, data.id));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new Error("Já existe um aluno cadastrado com esse e-mail.");
      }
      throw error;
    }
  });
```

- [ ] **Step 7: Typecheck e testes**

```bash
npm run typecheck
npm test
```

Esperado: sem erros novos; os testes existentes (nenhum cobre `students.ts` hoje) continuam passando.

- [ ] **Step 8: Verificação manual**

Rodar `npm run dev`, logar como admin, cadastrar um aluno com um e-mail já usado por outro aluno (via tela de alunos) e confirmar que aparece "Já existe um aluno cadastrado com esse e-mail." em vez de um erro genérico/500.

- [ ] **Step 9: Commit**

```bash
git add src/server/db/schema.ts src/server/db/errors.ts src/functions/teacherAccounts.ts src/functions/students.ts
git commit -m "fix: impede e-mail duplicado entre alunos (causa de login autenticar aluno errado)

students.email não tinha constraint única (diferente de teachers.email).
Dois alunos com o mesmo e-mail faziam studentLoginFn buscar uma linha
indeterminada (LIMIT 1 sem ORDER BY), podendo autenticar contra a senha
errada. Extrai isUniqueViolation (antes só em teacherAccounts.ts) pra
src/server/db/errors.ts e reaplica em students.ts."
```

---

### Task 2: Evitar e-mail duplicado na importação em lote

**Files:**
- Modify: `src/functions/students.ts` (`bulkCreateStudentsFn`, tipo `BulkCreateResult`)

**Interfaces:**
- Consumes: nenhuma interface nova de outra task.
- Produces: `BulkCreateResult` ganha o campo `emailConflicts: Array<string>` — nomes dos alunos cujo e-mail da planilha foi descartado por já pertencer a outro aluno (existente ou já processado no mesmo lote).

**Contexto:** `bulkCreateStudentsFn` dedupe alunos por **nome** (`existingByName`), não por e-mail — dois alunos com nomes diferentes na planilha podem ter o mesmo e-mail e, sem tratamento, o `db.insert(students).values(toInsert)` em lote falharia inteiro por causa da constraint única do Task 1 (uma linha ruim derruba a importação toda). Em vez de falhar o lote, a linha com e-mail conflitante é inserida sem e-mail (fica pro admin corrigir manualmente depois), e o nome entra em `emailConflicts` pra aparecer na tela de importação.

- [ ] **Step 1: Escrever a lógica de detecção de conflito**

Em `src/functions/students.ts`, atualizar `BulkCreateResult` e o handler:

```typescript
export type BulkCreateResult = {
  created: number;
  updated: number;
  skipped: Array<string>;
  emailConflicts: Array<string>;
};
```

Trocar o `select` de `existing` (hoje só busca `id`, `name`, `phone`) pra incluir `email`:

```typescript
    const existing = await db
      .select({ id: students.id, name: students.name, phone: students.phone, email: students.email })
      .from(students);
    const existingByName = new Map(
      existing.map((s) => [s.name.trim().toLowerCase(), { id: s.id, phone: s.phone }]),
    );
    const existingEmails = new Set(
      existing
        .map((s) => s.email?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email)),
    );
```

No laço principal (linha 234-251 do arquivo original), antes de `toInsert.push`, checar conflito de e-mail:

```typescript
    const seenInBatch = new Set<string>();
    const seenEmailsInBatch = new Set<string>();
    const emailConflicts: Array<string> = [];
    const toInsert: Array<{ name: string; email: string | null; phone: string | null }> = [];
    const toUpdatePhone: Array<{ id: string; phone: string }> = [];
    const skipped: Array<string> = [];

    for (const row of data.students) {
      const key = row.name.toLowerCase();
      const match = existingByName.get(key);

      if (match || seenInBatch.has(key)) {
        const currentPhone = match?.phone?.trim();
        if (match && !currentPhone && row.phone) {
          toUpdatePhone.push({ id: match.id, phone: row.phone });
        } else {
          skipped.push(row.name);
        }
        continue;
      }

      seenInBatch.add(key);
      const email = row.email?.trim().toLowerCase() || null;
      const emailTaken = email !== null && (existingEmails.has(email) || seenEmailsInBatch.has(email));
      if (email && emailTaken) {
        emailConflicts.push(row.name);
      } else if (email) {
        seenEmailsInBatch.add(email);
      }
      toInsert.push({ name: row.name, email: emailTaken ? null : email, phone: row.phone || null });
    }
```

- [ ] **Step 2: Repassar `emailConflicts` no retorno e no log de auditoria**

Atualizar o final da função:

```typescript
    const parts = [`Importou ${toInsert.length} aluno(s) por planilha`];
    if (toUpdatePhone.length > 0) parts.push(`preencheu WhatsApp de ${toUpdatePhone.length}`);
    if (skipped.length > 0) parts.push(`${skipped.length} já existiam`);
    if (emailConflicts.length > 0) {
      parts.push(`${emailConflicts.length} ficaram sem e-mail (já usado por outro aluno)`);
    }
    await logAudit("aluno.importar", `${parts.join("; ")}.`);

    return { created: toInsert.length, updated: toUpdatePhone.length, skipped, emailConflicts };
```

- [ ] **Step 3: Ajustar a tela que consome `bulkCreateStudentsFn`**

Em `src/pages/painel/Students.tsx`, no `onSuccess` da mutation de importação (por volta da linha 112-118), adicionar a mesma lógica já usada pra `skipped`:

```typescript
    onSuccess: async (result) => {
      const partes = [`${result.created} importado(s)`];
      if (result.updated > 0) partes.push(`${result.updated} com WhatsApp preenchido`);
      if (result.skipped.length > 0) partes.push(`${result.skipped.length} já cadastrado(s)`);
      if (result.emailConflicts.length > 0) {
        partes.push(`${result.emailConflicts.length} sem e-mail (já usado por outro aluno)`);
      }
      toast.success(`${partes.join(", ")}.`);
      await invalidate();
    },
```

- [ ] **Step 4: Typecheck e testes**

```bash
npm run typecheck
npm test
```

- [ ] **Step 5: Verificação manual**

Montar uma planilha de teste com duas linhas de nomes diferentes e o mesmo e-mail, importar, e confirmar: os dois alunos são criados, só um fica com o e-mail preenchido, e a tela mostra o conflito.

- [ ] **Step 6: Commit**

```bash
git add src/functions/students.ts src/pages/painel/Students.tsx
git commit -m "fix: importação em lote não deixa e-mail duplicado entrar

bulkCreateStudentsFn dedupava só por nome; duas linhas com o mesmo
e-mail derrubariam o insert em lote inteiro por causa da constraint
única (task anterior). Agora descarta o e-mail conflitante em vez do
aluno inteiro e reporta em emailConflicts pro admin corrigir."
```
