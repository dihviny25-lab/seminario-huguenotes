# Botão de WhatsApp no perfil do aluno — plano de implementação

> **Para quem for executar:** implemente task a task. Os passos usam checkbox (`- [ ]`) pra acompanhamento.
> **Nota sobre testes:** o dono do produto pediu para NÃO escrever testes automatizados agora (`.test.ts`). As funções puras ficam em `src/lib/` pra serem testáveis depois; a verificação de cada task é `npm run lint` + `npm run build` + conferência manual. Não crie arquivos de teste a menos que seja pedido.

**Objetivo:** trazer o WhatsApp do aluno para dentro do sistema (via `students.phone`) e oferecer um botão reutilizável que abre a conversa no WhatsApp, opcionalmente com mensagem pronta por situação.

**Arquitetura:** duas funções puras em `src/lib/` (montagem do link `wa.me` e textos por contexto), um componente `WhatsappButton` que as combina, e plumbing de dados: a importação de planilha passa a ler a coluna WhatsApp (preenchendo `phone` só quando vazio), e `listStudentsFn` / `OverdueCharge` passam a expor o telefone. O botão é plugado em 4 telas existentes.

**Tech stack:** TanStack Start (server functions), Drizzle ORM, React 19, react-hook-form + zod, shadcn/Radix UI, lucide-react, Tailwind v4, vite. Gerenciador: `bun` (scripts via `npm run`).

**Spec:** `docs/superpowers/specs/2026-08-31-botao-whatsapp-aluno-design.md`

## Restrições globais

- Idioma: toda UI, mensagem de erro e comentário novo em **português**.
- Sem migração de schema: reaproveita `students.phone` (`text`, anulável). Nenhum `db:push`.
- Lógica pura em `src/lib/`; consulta/autenticação em `src/functions/`.
- Componentes de UI vêm de `src/components/ui`. Motion conforme `MOTION.md` (usar só as transições que os botões da tela já usam — nada custom).
- O número é guardado como o usuário digita. Normalização acontece só na hora de montar o link (`toWhatsappLink`).
- Sempre Brasil: código de país `55`.
- Nenhum clique no botão dispara server function ou `logAudit`.
- Fluxo de entrega: issue [#23](https://github.com/dihviny25-lab/seminario-huguenotes/issues/23), branch `feat/botao-whatsapp-aluno` (já criada, a partir da `main`), PR com `Closes #23`. Sem push direto na `main`.
- Portão de cada task que toca `.ts`/`.tsx`: `npm run lint` e `npm run build` verdes antes do commit.

---

### Task 1: Helper de link `wa.me` — `src/lib/whatsapp.ts`

**Files:**
- Create: `src/lib/whatsapp.ts`

**Interfaces:**
- Produz: `export function toWhatsappLink(phone: string | null | undefined, message?: string): string | null`

- [ ] **Passo 1: Criar o arquivo `src/lib/whatsapp.ts`**

```ts
/**
 * Monta um link wa.me a partir de um número de telefone brasileiro digitado de
 * qualquer forma (com/sem +55, com/sem 0 na frente, com espaços, traços ou
 * parênteses). Retorna null quando não dá pra formar um número confiável.
 *
 * A normalização só acontece aqui — o número é guardado no banco como o usuário
 * digitou.
 */
export function toWhatsappLink(
  phone: string | null | undefined,
  message?: string,
): string | null {
  let digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);

  let normalized: string | null = null;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    normalized = digits;
  } else if (digits.length === 10 || digits.length === 11) {
    normalized = `55${digits}`;
  }

  if (normalized === null) return null;

  const base = `https://wa.me/${normalized}`;
  const text = message?.trim();
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
```

- [ ] **Passo 2: Verificar rápido no terminal**

Run: `cd "c:/Users/DIEGO/Cronograma huguenotes" && bunx tsx -e "import('./src/lib/whatsapp.ts').then(m=>{console.log(m.toWhatsappLink('18996336965'));console.log(m.toWhatsappLink('+55 (18) 99633-6965','oi tudo bem?'));console.log(m.toWhatsappLink('996336965'));console.log(m.toWhatsappLink(null));})"`
Esperado:
```
https://wa.me/5518996336965
https://wa.me/5518996336965?text=oi%20tudo%20bem%3F
null
null
```

- [ ] **Passo 3: `npm run lint`**

Run: `cd "c:/Users/DIEGO/Cronograma huguenotes" && npm run lint`
Esperado: sem erros novos.

- [ ] **Passo 4: Commit**

```bash
git add src/lib/whatsapp.ts
git commit -m "feat: helper toWhatsappLink pra montar link wa.me de número BR

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Textos por situação — `src/lib/whatsappTemplates.ts`

**Files:**
- Create: `src/lib/whatsappTemplates.ts`

**Interfaces:**
- Consome: nada.
- Produz:
  - `export type WhatsappContext = { kind: "generic" } | { kind: "overdue"; amount: number; daysOverdue: number } | { kind: "lowAttendance"; discipline: string } | { kind: "lowGrade"; discipline: string; average: number } | { kind: "missingAssignment"; title: string }`
  - `export function firstName(fullName: string): string`
  - `export function messageFor(context: WhatsappContext, studentFullName: string): string | undefined`

- [ ] **Passo 1: Criar o arquivo `src/lib/whatsappTemplates.ts`**

```ts
/**
 * Situação em que o aluno aparece quando o botão de WhatsApp é oferecido.
 * `generic` = sem mensagem pronta (abre a conversa em branco).
 *
 * `lowAttendance`, `lowGrade` e `missingAssignment` ainda não têm chamador nesta
 * entrega — ficam prontos para as Fases 1/2/4 da spec de dashboards
 * (docs/superpowers/specs/2026-08-31-dashboards-professor-aluno-design.md).
 */
export type WhatsappContext =
  | { kind: "generic" }
  | { kind: "overdue"; amount: number; daysOverdue: number }
  | { kind: "lowAttendance"; discipline: string }
  | { kind: "lowGrade"; discipline: string; average: number }
  | { kind: "missingAssignment"; title: string };

/** Primeiro nome com inicial maiúscula, a partir do nome completo (que vem em CAIXA ALTA no banco). */
export function firstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? "";
  if (first.length === 0) return "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function money(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Texto pré-preenchido para a conversa. `generic` retorna undefined (sem texto).
 * Os demais retornam um texto curto e cordial com o primeiro nome do aluno.
 */
export function messageFor(
  context: WhatsappContext,
  studentFullName: string,
): string | undefined {
  const nome = firstName(studentFullName);

  switch (context.kind) {
    case "generic":
      return undefined;
    case "overdue":
      return (
        `Olá, ${nome}! Tudo bem? Passando pra lembrar da mensalidade do seminário, ` +
        `que está com ${context.daysOverdue} dia(s) de atraso (R$ ${money(context.amount)}). ` +
        `Qualquer dificuldade, me avisa que a gente resolve juntos. 🙏`
      );
    case "lowAttendance":
      return (
        `Olá, ${nome}! Notamos algumas faltas suas em ${context.discipline}. ` +
        `Está tudo bem? Se precisar de ajuda pra acompanhar o conteúdo, conta com a gente.`
      );
    case "lowGrade":
      return (
        `Olá, ${nome}! Queremos te ajudar a melhorar em ${context.discipline} ` +
        `(sua média está em ${context.average.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}). ` +
        `Vamos combinar um horário pra conversar sobre o conteúdo?`
      );
    case "missingAssignment":
      return (
        `Olá, ${nome}! Vi que a tarefa "${context.title}" ainda não foi entregue. ` +
        `Precisa de mais prazo ou de alguma ajuda?`
      );
  }
}
```

- [ ] **Passo 2: Verificar rápido no terminal**

Run: `cd "c:/Users/DIEGO/Cronograma huguenotes" && bunx tsx -e "import('./src/lib/whatsappTemplates.ts').then(m=>{console.log(m.firstName('DARIO LOPES SARAIVA JUNIOR'));console.log(m.messageFor({kind:'generic'},'FULANO'));console.log(m.messageFor({kind:'overdue',amount:150,daysOverdue:3},'NATÁLIA TOLEDO FERREIRA'));})"`
Esperado: `Dario`, depois `undefined`, depois um texto contendo `Natália`, `3 dia(s)` e `150,00`.

- [ ] **Passo 3: `npm run lint`**

Run: `cd "c:/Users/DIEGO/Cronograma huguenotes" && npm run lint`
Esperado: sem erros novos.

- [ ] **Passo 4: Commit**

```bash
git add src/lib/whatsappTemplates.ts
git commit -m "feat: textos de WhatsApp por situação (messageFor)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Componente `WhatsappButton` — `src/components/WhatsappButton.tsx`

**Files:**
- Create: `src/components/WhatsappButton.tsx`

**Interfaces:**
- Consome: `toWhatsappLink` (Task 1), `messageFor` / `WhatsappContext` (Task 2), `Button` de `@/components/ui/button`.
- Produz: `export function WhatsappButton(props: WhatsappButtonProps)` com
  ```ts
  type WhatsappButtonProps = {
    phone: string | null | undefined;
    studentName: string;
    context?: WhatsappContext;
    size?: "sm" | "icon" | "default";
    variant?: "outline" | "ghost" | "default";
    withLabel?: boolean;
  };
  ```

- [ ] **Passo 1: Criar o arquivo `src/components/WhatsappButton.tsx`**

```tsx
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toWhatsappLink } from "@/lib/whatsapp";
import { messageFor, type WhatsappContext } from "@/lib/whatsappTemplates";

type WhatsappButtonProps = {
  phone: string | null | undefined;
  studentName: string;
  context?: WhatsappContext;
  size?: "sm" | "icon" | "default";
  variant?: "outline" | "ghost" | "default";
  /** Mostra o texto "WhatsApp" ao lado do ícone. Padrão: só o ícone. */
  withLabel?: boolean;
};

/**
 * Botão que abre a conversa do aluno no WhatsApp, opcionalmente com uma mensagem
 * pronta conforme a situação (`context`). Fica desabilitado quando o aluno não
 * tem número cadastrado. Não dispara nada no servidor — só abre o link.
 */
export function WhatsappButton({
  phone,
  studentName,
  context = { kind: "generic" },
  size = "icon",
  variant = "ghost",
  withLabel = false,
}: WhatsappButtonProps) {
  const href = toWhatsappLink(phone, messageFor(context, studentName));
  const label = "Mandar mensagem no WhatsApp";

  if (!href) {
    return (
      <Button
        variant={variant}
        size={withLabel ? size : "icon"}
        disabled
        title="Sem WhatsApp cadastrado"
        aria-label="Sem WhatsApp cadastrado"
      >
        <MessageCircle className="size-4" aria-hidden />
        {withLabel ? "WhatsApp" : null}
      </Button>
    );
  }

  return (
    <Button variant={variant} size={withLabel ? size : "icon"} asChild title={label}>
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
        <MessageCircle className="size-4" aria-hidden />
        {withLabel ? "WhatsApp" : null}
      </a>
    </Button>
  );
}
```

- [ ] **Passo 2: `npm run lint` e `npm run build`**

Run: `cd "c:/Users/DIEGO/Cronograma huguenotes" && npm run lint && npm run build`
Esperado: ambos verdes.

- [ ] **Passo 3: Commit**

```bash
git add src/components/WhatsappButton.tsx
git commit -m "feat: componente WhatsappButton (link wa.me + estado desabilitado)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Ler a coluna WhatsApp na importação — `src/lib/spreadsheet.ts`

**Files:**
- Modify: `src/lib/spreadsheet.ts`

**Interfaces:**
- Consome: nada novo.
- Produz: `ParsedStudent` passa a ser `{ name: string; email: string | null; phone: string | null }`.

- [ ] **Passo 1: Atualizar `src/lib/spreadsheet.ts`**

Trocar o tipo e adicionar a dica de coluna e a extração:

```ts
export type ParsedStudent = { name: string; email: string | null; phone: string | null };

const NAME_HEADER_HINTS = ["nome", "name", "aluno"];
const EMAIL_HEADER_HINTS = ["e-mail", "email"];
const PHONE_HEADER_HINTS = ["whatsapp", "whats", "celular", "telefone", "fone"];
```

Dentro de `parseStudentsFile`, depois de achar `emailColumn`:

```ts
  const phoneColumn = findColumn(headers, PHONE_HEADER_HINTS);
```

E no `map` final:

```ts
  return rows
    .map((row) => ({
      name: String(row[nameColumn] ?? "").trim(),
      email: emailColumn ? String(row[emailColumn] ?? "").trim() || null : null,
      phone: phoneColumn ? String(row[phoneColumn] ?? "").trim() || null : null,
    }))
    .filter((row) => row.name.length > 0);
```

Não normaliza o número aqui — guarda o texto como veio.

- [ ] **Passo 2: `npm run lint`**

Run: `cd "c:/Users/DIEGO/Cronograma huguenotes" && npm run lint`
Esperado: sem erros novos (o build completo roda na Task 5, junto da mudança em `students.ts` que consome esse tipo).

- [ ] **Passo 3: Commit**

```bash
git add src/lib/spreadsheet.ts
git commit -m "feat: parser da planilha lê a coluna WhatsApp

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: `phone` nas server functions de aluno — `src/functions/students.ts`

**Files:**
- Modify: `src/functions/students.ts`

**Interfaces:**
- Consome: `ParsedStudent.phone` (Task 4).
- Produz:
  - `Student` type ganha `phone: string | null`.
  - `BulkCreateResult` passa a ser `{ created: number; updated: number; skipped: Array<string> }`.
  - `createStudentFn` / `updateStudentFn` aceitam `phone?: string` no `data`.

- [ ] **Passo 1: `Student` type e `listStudentsFn`**

No type `Student` (topo do arquivo), adicionar:
```ts
  phone: string | null;
```

Em `listStudentsFn`, adicionar `phone: students.phone` ao `.select({ ... })`. O `.map` final espalha `...rest`, então `phone` já vai junto — confirmar que `phone` está em `rest` (está, porque só `passwordHash` é desestruturado à parte).

- [ ] **Passo 2: `createSchema` e `updateSchema`**

Adicionar em ambos os schemas:
```ts
  phone: z.string().trim().optional().or(z.literal("")),
```

Em `createStudentFn`, trocar o `.values(...)`:
```ts
    .values({ name: data.name, email: data.email || null, phone: data.phone?.trim() || null })
```

Em `updateStudentFn`, trocar o `.set(...)`:
```ts
    .set({ name: data.name, email: data.email || null, phone: data.phone?.trim() || null })
```

- [ ] **Passo 3: `bulkCreateSchema` e `BulkCreateResult`**

No `bulkCreateSchema`, no objeto de cada item, adicionar:
```ts
      phone: z.string().trim().nullable(),
```

Trocar o type:
```ts
export type BulkCreateResult = { created: number; updated: number; skipped: Array<string> };
```

- [ ] **Passo 4: Reescrever `bulkCreateStudentsFn`**

```ts
export const bulkCreateStudentsFn = createServerFn({ method: "POST" })
  .validator(bulkCreateSchema)
  .handler(async ({ data }): Promise<BulkCreateResult> => {
    await requireAdminId();

    const existing = await db
      .select({ id: students.id, name: students.name, phone: students.phone })
      .from(students);
    const existingByName = new Map(
      existing.map((s) => [s.name.trim().toLowerCase(), { id: s.id, phone: s.phone }]),
    );

    const seenInBatch = new Set<string>();
    const toInsert: Array<{ name: string; email: string | null; phone: string | null }> = [];
    const toUpdatePhone: Array<{ id: string; phone: string }> = [];
    const skipped: Array<string> = [];

    for (const row of data.students) {
      const key = row.name.toLowerCase();
      const match = existingByName.get(key);

      if (match || seenInBatch.has(key)) {
        // Aluno já existe: preenche o telefone só se estiver vazio; nunca sobrescreve.
        const currentPhone = match?.phone?.trim();
        if (match && !currentPhone && row.phone) {
          toUpdatePhone.push({ id: match.id, phone: row.phone });
        } else {
          skipped.push(row.name);
        }
        continue;
      }

      seenInBatch.add(key);
      toInsert.push({ name: row.name, email: row.email || null, phone: row.phone || null });
    }

    if (toInsert.length > 0) {
      await db.insert(students).values(toInsert);
    }
    for (const u of toUpdatePhone) {
      await db.update(students).set({ phone: u.phone }).where(eq(students.id, u.id));
    }

    const parts = [`Importou ${toInsert.length} aluno(s) por planilha`];
    if (toUpdatePhone.length > 0) parts.push(`preencheu WhatsApp de ${toUpdatePhone.length}`);
    if (skipped.length > 0) parts.push(`${skipped.length} já existiam`);
    await logAudit("aluno.importar", `${parts.join("; ")}.`);

    return { created: toInsert.length, updated: toUpdatePhone.length, skipped };
  });
```

Confirmar que `eq` já está importado de `drizzle-orm` no topo (está — usado em outras funções).

- [ ] **Passo 5: `npm run lint` e `npm run build`**

Run: `cd "c:/Users/DIEGO/Cronograma huguenotes" && npm run lint && npm run build`
Esperado: ambos verdes. O build vai apontar se algum consumidor de `BulkCreateResult` ou `Student` ficou desalinhado — o único consumidor do resultado é `Students.tsx`, ajustado na Task 7. Se o build quebrar **só** por causa do `result.skipped`/campos em `Students.tsx`, seguir para a Task 7 e rodar o build de novo lá; não commitar esta task com build vermelho — se quebrar em `Students.tsx`, fazer as Tasks 5 e 7 no mesmo commit.

- [ ] **Passo 6: Commit** (se o build passar isolado)

```bash
git add src/functions/students.ts
git commit -m "feat: phone nas funções de aluno + importação preenche WhatsApp vazio

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: `studentPhone` em `OverdueCharge` — `src/functions/payments.ts`

**Files:**
- Modify: `src/functions/payments.ts`

**Interfaces:**
- Produz: o type `OverdueCharge` ganha `studentPhone: string | null`; cada item de `overdueList` passa a incluí-lo.

- [ ] **Passo 1: Type `OverdueCharge`**

Localizar o type (perto da linha 508, campos `studentName`, `studentId`, `description`, `amount`, `daysOverdue`) e adicionar:
```ts
  studentPhone: string | null;
```

- [ ] **Passo 2: `select` de `getFinancialSummaryFn`**

O `.select({ charge: charges, studentName: students.name })` que faz `innerJoin(students, ...)` passa a ser:
```ts
      .select({
        charge: charges,
        studentName: students.name,
        studentPhone: students.phone,
      })
```

- [ ] **Passo 3: Loop de agregação**

O `for (const { charge, studentName } of rows)` passa a desestruturar também `studentPhone`, e o `overdueList.push({ ... })` (perto da linha 584) inclui `studentPhone`.

- [ ] **Passo 4: `npm run lint` e `npm run build`**

Run: `cd "c:/Users/DIEGO/Cronograma huguenotes" && npm run lint && npm run build`
Esperado: ambos verdes (o consumidor `Financial.tsx` só passa a usar o campo na Task 9; adicionar um campo ao objeto não quebra nada).

- [ ] **Passo 5: Commit**

```bash
git add src/functions/payments.ts
git commit -m "feat: OverdueCharge expõe studentPhone

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Tela de Alunos — coluna, formulário e toast — `src/pages/painel/Students.tsx`

**Files:**
- Modify: `src/pages/painel/Students.tsx`

**Interfaces:**
- Consome: `WhatsappButton` (Task 3), `Student.phone` (Task 5), `BulkCreateResult` com `created`/`updated`/`skipped` (Task 5).

- [ ] **Passo 1: Import**

Adicionar:
```ts
import { WhatsappButton } from "@/components/WhatsappButton";
```

- [ ] **Passo 2: Coluna na tabela**

No `<TableHeader>`, adicionar `<TableHead>WhatsApp</TableHead>` entre "E-mail" e "Situação".

No corpo, depois da célula de e-mail:
```tsx
                  <TableCell>
                    <WhatsappButton phone={student.phone} studentName={student.name} />
                  </TableCell>
```

Ajustar contadores de colunas:
- `<TableSkeletonRows columns={6} />` → `columns={7}`.
- `<TableCell colSpan={6} ...>Nenhum aluno cadastrado ainda.</TableCell>` → `colSpan={7}`.

- [ ] **Passo 3: `studentSchema` do arquivo (~linha 367)**

Adicionar:
```ts
  phone: z.string().trim().optional().or(z.literal("")),
```

- [ ] **Passo 4: `CreateStudentDialog`**

`defaultValues: { name: "", email: "" }` → `{ name: "", email: "", phone: "" }`.

Depois do `FormField` de e-mail, adicionar:
```tsx
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone / WhatsApp (opcional)</FormLabel>
                  <FormControl>
                    <Input inputMode="tel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
```

`createStudentFn` já recebe `values` inteiro — `phone` vai junto sem mudança na mutation.

- [ ] **Passo 5: `EditStudentDialog`**

`defaultValues: { name: student.name, email: student.email ?? "" }` → adicionar `phone: student.phone ?? ""`.

Adicionar o mesmo `FormField name="phone"` do passo 4 depois do e-mail.

A mutation chama `updateStudentFn({ data: { id: student.id, ...values } })` — `phone` vai junto sem mudança.

- [ ] **Passo 6: Toast da importação**

Em `importMutation.onSuccess`, trocar a montagem da mensagem:
```ts
    onSuccess: async (result) => {
      const partes = [`${result.created} importado(s)`];
      if (result.updated > 0) partes.push(`${result.updated} com WhatsApp preenchido`);
      if (result.skipped.length > 0) partes.push(`${result.skipped.length} já cadastrado(s)`);
      toast.success(`${partes.join(", ")}.`);
      await invalidate();
    },
```

- [ ] **Passo 7: `npm run lint` e `npm run build`**

Run: `cd "c:/Users/DIEGO/Cronograma huguenotes" && npm run lint && npm run build`
Esperado: ambos verdes.

- [ ] **Passo 8: Commit**

```bash
git add src/pages/painel/Students.tsx
git commit -m "feat: coluna WhatsApp e campo de telefone na tela de Alunos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Botão no cabeçalho do Relatório do aluno — `src/pages/painel/reports/StudentReport.tsx`

**Files:**
- Modify: `src/pages/painel/reports/StudentReport.tsx`

**Interfaces:**
- Consome: `WhatsappButton` (Task 3), `selectedStudent.phone` (via `listStudentsFn`, Task 5).

- [ ] **Passo 1: Import**

```ts
import { WhatsappButton } from "@/components/WhatsappButton";
```

- [ ] **Passo 2: Botão ao lado de "Baixar PDF"**

No bloco `<div className="flex gap-2 print:hidden">` que tem os botões "Baixar PDF" e "Imprimir", adicionar como primeiro filho:
```tsx
                    {selectedStudent ? (
                      <WhatsappButton
                        phone={selectedStudent.phone}
                        studentName={selectedStudent.name}
                        withLabel
                        variant="outline"
                        size="sm"
                      />
                    ) : null}
```

(`selectedStudent` já está em escopo no componente, vindo de `listStudentsFn`.)

- [ ] **Passo 3: `npm run lint` e `npm run build`**

Run: `cd "c:/Users/DIEGO/Cronograma huguenotes" && npm run lint && npm run build`
Esperado: ambos verdes.

- [ ] **Passo 4: Commit**

```bash
git add src/pages/painel/reports/StudentReport.tsx
git commit -m "feat: botão de WhatsApp no cabeçalho do boletim do aluno

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Botão na lista de inadimplentes — `src/pages/painel/Financial.tsx`

**Files:**
- Modify: `src/pages/painel/Financial.tsx`

**Interfaces:**
- Consome: `WhatsappButton` (Task 3), `item.studentPhone` / `item.amount` / `item.daysOverdue` de `OverdueCharge` (Task 6).

- [ ] **Passo 1: Import**

```ts
import { WhatsappButton } from "@/components/WhatsappButton";
```

- [ ] **Passo 2: Botão na célula "Ações"**

A célula que hoje é:
```tsx
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/painel/pagamentos" search={{ studentId: item.studentId }}>
                            Gerenciar
                          </Link>
                        </Button>
                      </TableCell>
```

passa a ser:
```tsx
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <WhatsappButton
                            phone={item.studentPhone}
                            studentName={item.studentName}
                            context={{
                              kind: "overdue",
                              amount: item.amount,
                              daysOverdue: item.daysOverdue,
                            }}
                            size="sm"
                            variant="outline"
                          />
                          <Button variant="outline" size="sm" asChild>
                            <Link to="/painel/pagamentos" search={{ studentId: item.studentId }}>
                              Gerenciar
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
```

Confirmar que `item.amount` é `number` (é — `OverdueCharge.amount: number`).

- [ ] **Passo 3: `npm run lint` e `npm run build`**

Run: `cd "c:/Users/DIEGO/Cronograma huguenotes" && npm run lint && npm run build`
Esperado: ambos verdes.

- [ ] **Passo 4: Commit**

```bash
git add src/pages/painel/Financial.tsx
git commit -m "feat: botão de WhatsApp com mensagem de atraso na lista de inadimplentes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Verificação final e Pull Request

**Files:** nenhum (só verificação e PR).

- [ ] **Passo 1: Build e lint completos**

Run: `cd "c:/Users/DIEGO/Cronograma huguenotes" && npm run lint && npm run build`
Esperado: ambos verdes.

- [ ] **Passo 2: Conferência manual (`npm run dev`)**

Run: `cd "c:/Users/DIEGO/Cronograma huguenotes" && npm run dev`

Conferir, logado como admin:
1. **Alunos** — coluna WhatsApp: botão ativo para quem tem número (abre `wa.me` em nova aba), botão cinza com dica "Sem WhatsApp cadastrado" para quem não tem.
2. **Novo aluno** / **Editar aluno** — campo "Telefone / WhatsApp" salva; ao reabrir a edição, volta preenchido.
3. **Importar planilha** (`alunos.xlsx`) — o toast mostra importados / com WhatsApp preenchido / já cadastrados; alunos que já existiam sem telefone passam a ter, e quem já tinha telefone não muda.
4. **Boletim do aluno** — botão "WhatsApp" no cabeçalho abre a conversa sem texto.
5. **Financeiro › Alunos inadimplentes** — botão abre a conversa com a mensagem de atraso preenchida (nome, dias, valor corretos); desabilitado quando o inadimplente não tem telefone.

- [ ] **Passo 3: Push da branch**

```bash
git push -u origin feat/botao-whatsapp-aluno
```

- [ ] **Passo 4: Abrir o PR**

```bash
gh pr create --title "Botão de WhatsApp no perfil do aluno" --body "$(cat <<'EOF'
Closes #23

Traz o WhatsApp do aluno para dentro do sistema e adiciona um botão que abre a conversa,
opcionalmente com mensagem pronta por situação.

## O que mudou

- `src/lib/whatsapp.ts` — `toWhatsappLink`: normaliza número BR (+55) e monta link `wa.me`.
- `src/lib/whatsappTemplates.ts` — `messageFor`: textos por contexto (`generic`, `overdue` em
  uso; `lowAttendance`, `lowGrade`, `missingAssignment` prontos para as Fases 1/2/4 dos dashboards).
- `src/components/WhatsappButton.tsx` — botão reutilizável; desabilitado quando não há número.
- `src/lib/spreadsheet.ts` — importação lê a coluna WhatsApp.
- `src/functions/students.ts` — `phone` no tipo/lista/cadastro/edição; importação preenche
  `phone` de aluno existente só quando está vazio (retorno passa a ter `updated`).
- `src/functions/payments.ts` — `OverdueCharge` expõe `studentPhone`.
- Plugado em: lista de Alunos, diálogos Novo/Editar aluno, cabeçalho do Boletim do aluno e
  lista "Alunos inadimplentes" do Financeiro.

## Fora de escopo

- Telas de alerta de falta / nota baixa / tarefa não entregue (Fases 1/2/4 da spec de dashboards).
- Envio automático / API oficial do WhatsApp. Auditoria do clique. Testes automatizados
  (a pedido, ficam para depois).

Design: `docs/superpowers/specs/2026-08-31-botao-whatsapp-aluno-design.md`
🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Passo 5: Avisar o usuário** com o link do PR. Não fazer merge — o merge é decisão do usuário.

---

## Auto-revisão do plano

**Cobertura da spec:**
- Helper `toWhatsappLink` → Task 1. ✅
- Textos `messageFor` + `firstName` → Task 2. ✅
- Componente `WhatsappButton` (link + desabilitado) → Task 3. ✅
- Parser lê coluna WhatsApp → Task 4. ✅
- `Student.phone`, create/update com phone, bulk "preenche se vazio", retorno `{created,updated,skipped}` → Task 5. ✅
- `OverdueCharge.studentPhone` → Task 6. ✅
- Tela Alunos: coluna + campos de formulário + toast → Task 7. ✅
- Cabeçalho do Boletim → Task 8. ✅
- Lista de inadimplentes com contexto `overdue` → Task 9. ✅
- Verificação (lint/build) + roteiro manual + PR `Closes #23` → Task 10. ✅
- Nota cruzada na spec de dashboards → registrada na própria spec do WhatsApp (seção 8), num PR posterior quando aquele arquivo estiver na `main`. Fora do escopo de código deste plano, por decisão registrada.
- Testes automatizados → **deliberadamente omitidos** a pedido do dono do produto; funções puras ficam prontas para receber teste depois.

**Consistência de tipos:**
- `ParsedStudent.phone: string | null` (Task 4) ↔ `bulkCreateSchema` item `phone: z.string().trim().nullable()` (Task 5). ✅
- `BulkCreateResult { created, updated, skipped }` (Task 5) ↔ uso em `Students.tsx` (`result.created`, `result.updated`, `result.skipped`) (Task 7). ✅
- `Student.phone: string | null` (Task 5) ↔ `WhatsappButton` prop `phone: string | null | undefined` (Task 3) ↔ uso em `Students.tsx` e `StudentReport.tsx`. ✅
- `OverdueCharge.studentPhone: string | null` + `amount: number` + `daysOverdue: number` (Task 6) ↔ `WhatsappButton` `context={{ kind: "overdue", amount, daysOverdue }}` (Task 9). ✅
- `WhatsappContext` união (Task 2) ↔ prop `context` de `WhatsappButton` (Task 3) ↔ contexto passado em `Financial.tsx` (Task 9). ✅

**Placeholders:** nenhum "TBD"/"TODO"/"etc." nos passos de código. Strings das mensagens fixadas na Task 2.
