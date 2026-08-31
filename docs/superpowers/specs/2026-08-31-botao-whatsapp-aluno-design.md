# Botão de WhatsApp no perfil do aluno — design

Data: 2026-08-31
Status: aprovado (sessão de brainstorming com o dono do produto)
Issue: [#23](https://github.com/dihviny25-lab/seminario-huguenotes/issues/23)

## Contexto e motivação

A planilha de cadastro de alunos (`alunos.xlsx`) tem uma coluna **WhatsApp** com o número
de cada aluno (formato `18996336965` — DDD + número, sem código de país). Hoje esse dado se
perde: o parser de importação (`src/lib/spreadsheet.ts`) só lê **Nome** e **E-mail**, e a
função de importação (`bulkCreateStudentsFn` em `src/functions/students.ts`) ignora qualquer
outra coluna.

O seminário quer, a partir de qualquer tela onde um aluno aparece, poder abrir a conversa
dele no WhatsApp com um clique — e, quando o aluno aparece numa situação conhecida
(mensalidade atrasada, falta, nota baixa, tarefa não entregue), já abrir com uma mensagem
pronta para aquela situação.

### O que já existe

- `students.phone` (`text`, anulável) — hoje preenchido só pelo próprio aluno em
  "Minha conta" (`src/pages/portal/PortalAccount.tsx`, rótulo "Telefone / WhatsApp"). O
  valor é salvo exatamente como o aluno digita, sem normalização.
- `listStudentsFn` (`src/functions/students.ts`) — lista usada tanto na tela de Alunos
  (`src/pages/painel/Students.tsx`) quanto no seletor do Relatório do aluno
  (`src/pages/painel/reports/StudentReport.tsx`). O tipo `Student` **não** expõe `phone`.
- Lista "Alunos inadimplentes" em `src/pages/painel/Financial.tsx`, alimentada por
  `getFinancialSummaryFn` (`src/functions/payments.ts`); cada linha (`OverdueCharge`) tem
  `studentId`, `studentName`, `description`, `amount`, `daysOverdue` — **não** tem telefone.
- Um cron de lembrete de mensalidade **por e-mail** (`src/routes/api/cron/payment-reminders.tsx`).
  Não há nenhum canal de WhatsApp no projeto.

### O que NÃO existe (e por que isso limita o escopo)

Os alertas de **falta**, **nota baixa** e **tarefa não entregue** que o dono do produto
quer usar como gatilho do botão **ainda não têm tela**. Eles são exatamente as Fases 1, 2 e
4 da spec `docs/superpowers/specs/2026-08-31-dashboards-professor-aluno-design.md` (dashboard
do professor, dashboard do aluno e acompanhamento por disciplina), nenhuma construída. Este
design **não** constrói esses dashboards — entrega o botão e os textos prontos, e os planos
daquelas fases passam a consumi-los.

## Objetivo

1. Trazer o número de WhatsApp da planilha para `students.phone`, sem sobrescrever o que o
   aluno já tiver preenchido.
2. Um helper puro que normaliza número brasileiro e monta o link `wa.me`.
3. Textos prontos por situação, testados, com o nome do aluno interpolado.
4. Um componente de botão reutilizável, plugado nas telas que já existem hoje.

## Decisões (tomadas no brainstorming)

| # | Decisão |
|---|---------|
| 1 | **Sempre Brasil (+55).** O sistema assume código de país 55 ao montar o link; se o número já vier com 55, não duplica. |
| 2 | **Reaproveitar `students.phone`** — nenhuma coluna nova, nenhum `db:push`. |
| 3 | **Re-importação só preenche se vazio.** Reimportar a planilha preenche `phone` de alunos existentes apenas quando está nulo/vazio; nunca sobrescreve. |
| 4 | **Mensagens fixas no código (v1).** Textos padrão em `src/lib/`, com o primeiro nome do aluno interpolado. Mudar texto exige deploy — aceitável nesta versão. |
| 5 | **Botão aparece desabilitado** quando o aluno não tem número, com dica "Sem WhatsApp cadastrado". |
| 6 | **Escopo separado dos dashboards.** Esta entrega pluga o botão só nos 4 lugares que já existem; os alertas de falta/nota/tarefa ficam para as Fases 1/2/4 da spec de dashboards, que importam o botão e os textos já prontos. |

## Convenções seguidas

- Lógica pura em `src/lib/` com `.test.ts` ao lado (padrão de `attendance.test.ts`,
  `grades.test.ts`, `payments.test.ts`). Consulta/autenticação em `src/functions/`.
- UI, mensagens e comentários em português. Componentes de `src/components/ui`
  (shadcn/Radix). Motion conforme `MOTION.md`.
- Sem framework de teste novo; telas verificadas manualmente com `npm run dev`.

## Arquitetura

```
planilha .xlsx ──> src/lib/spreadsheet.ts ──> bulkCreateStudentsFn ──> students.phone
                     (lê coluna WhatsApp)      (cria OU preenche se vazio)
                                                        │
                                                        ▼
  telas ──> <WhatsappButton phone={...} studentName={...} context={...} />
                     │
                     ├─ src/lib/whatsapp.ts        toWhatsappLink(phone, message?) -> string | null
                     └─ src/lib/whatsappTemplates.ts  messageFor(context, firstName) -> string | undefined
```

### Unidades

| Arquivo | Responsabilidade | Depende de |
|---------|------------------|------------|
| `src/lib/whatsapp.ts` | Normalizar número BR e montar URL `wa.me`. Função pura. | — |
| `src/lib/whatsappTemplates.ts` | Definir os contextos e devolver o texto de cada um. Função pura. | — |
| `src/components/WhatsappButton.tsx` | Renderizar o botão (link externo ou desabilitado). | `whatsapp.ts`, `whatsappTemplates.ts`, `components/ui/button`, `components/ui/tooltip` (ou `title`) |
| `src/lib/spreadsheet.ts` (mod.) | Passar a extrair a coluna WhatsApp. | — |
| `src/functions/students.ts` (mod.) | Expor `phone`; aceitar `phone` no create/update; preencher no bulk. | schema |
| `src/functions/payments.ts` (mod.) | Incluir `studentPhone` em `OverdueCharge`. | schema |
| `src/pages/painel/Students.tsx` (mod.) | Coluna WhatsApp + campo no formulário. | `WhatsappButton` |
| `src/pages/painel/reports/StudentReport.tsx` (mod.) | Botão no cabeçalho. | `WhatsappButton` |
| `src/pages/painel/Financial.tsx` (mod.) | Botão na lista de inadimplentes, contexto `overdue`. | `WhatsappButton` |

## Detalhamento

### 1. `src/lib/whatsapp.ts`

```ts
/**
 * Monta um link wa.me a partir de um número de telefone brasileiro digitado de
 * qualquer forma (com/sem +55, com/sem 0 na frente, com espaços/traços/parênteses).
 * Retorna null quando não dá pra formar um número confiável.
 */
export function toWhatsappLink(
  phone: string | null | undefined,
  message?: string,
): string | null;
```

Normalização, nesta ordem:

1. `String(phone ?? "")`, remove tudo que não é dígito (`replace(/\D/g, "")`).
2. Remove um único `0` à esquerda, se houver (tronco de DDD antigo).
3. Classifica pelo comprimento:
   - 12 ou 13 dígitos começando com `55` → já tem código de país, usa como está.
   - 10 dígitos (fixo com DDD) ou 11 dígitos (celular com DDD) → prefixa `55`.
   - Qualquer outro comprimento → retorna `null` (não inventa número).
4. Monta `https://wa.me/<digitos>`; se `message` for não vazia, acrescenta
   `?text=${encodeURIComponent(message)}`.

Sem dependências externas. Não usa `window`.

### 2. `src/lib/whatsappTemplates.ts`

```ts
export type WhatsappContext =
  | { kind: "generic" }
  | { kind: "overdue"; amount: number; daysOverdue: number }
  | { kind: "lowAttendance"; discipline: string }
  | { kind: "lowGrade"; discipline: string; average: number }
  | { kind: "missingAssignment"; title: string };

/** Primeiro nome, capitalizado, a partir do nome completo (que vem em CAIXA ALTA no banco). */
export function firstName(fullName: string): string;

/**
 * Texto pré-preenchido para a situação. `generic` retorna undefined
 * (abre a conversa sem texto). Os demais retornam um texto curto e cordial.
 */
export function messageFor(
  context: WhatsappContext,
  studentFullName: string,
): string | undefined;
```

Textos (o primeiro nome entra no lugar de `{nome}`; o plano de implementação fixa as
strings exatas a partir daqui):

- `overdue`: `Olá, {nome}! Tudo bem? Passando pra lembrar da mensalidade do seminário, que está com {daysOverdue} dia(s) de atraso (R$ {amount}). Qualquer dificuldade, me avisa que a gente resolve juntos. 🙏`
- `lowAttendance`: `Olá, {nome}! Notamos algumas faltas suas em {discipline}. Está tudo bem? Se precisar de ajuda pra acompanhar o conteúdo, conta com a gente.`
- `lowGrade`: `Olá, {nome}! Queremos te ajudar a melhorar em {discipline} (sua média está em {average}). Vamos combinar um horário pra conversar sobre o conteúdo?`
- `missingAssignment`: `Olá, {nome}! Vi que a tarefa "{title}" ainda não foi entregue. Precisa de mais prazo ou de alguma ajuda?`
- `generic`: sem texto.

`amount` é formatado com `toLocaleString("pt-BR", { minimumFractionDigits: 2 })`;
`average` com uma casa decimal.

Nesta entrega **só `generic` e `overdue` têm chamador**. `lowAttendance`, `lowGrade` e
`missingAssignment` ficam definidos e testados, prontos para as Fases 1/2/4 dos dashboards.

### 3. `src/components/WhatsappButton.tsx`

```ts
type WhatsappButtonProps = {
  phone: string | null | undefined;
  studentName: string;
  context?: WhatsappContext;      // default { kind: "generic" }
  size?: "sm" | "icon" | "default";
  variant?: "outline" | "ghost" | "default";
  withLabel?: boolean;            // default false: só ícone
};
```

Comportamento:

- Calcula `message = messageFor(context, studentName)` e `href = toWhatsappLink(phone, message)`.
- `href` não nulo → `<Button asChild variant size>` envolvendo
  `<a href={href} target="_blank" rel="noopener noreferrer">` com ícone
  `MessageCircle` (lucide-react) e, se `withLabel`, o texto "WhatsApp".
- `href` nulo → `<Button disabled>` com `title="Sem WhatsApp cadastrado"` e
  `aria-label` equivalente.
- Motion: transição de `hover`/`active` no padrão de `MOTION.md` (mesma linguagem dos
  outros botões da tela — nada custom).
- Clicar **não** dispara nenhuma server function, nenhum `logAudit`.

### 4. `src/lib/spreadsheet.ts` (modificação)

- `ParsedStudent` passa a ser `{ name: string; email: string | null; phone: string | null }`.
- Nova constante `PHONE_HEADER_HINTS = ["whatsapp", "whats", "celular", "telefone", "fone"]`
  e detecção da coluna por `findColumn` (já existe).
- No `map`, `phone: phoneColumn ? String(row[phoneColumn] ?? "").trim() || null : null`.
  A normalização/validação do número **não** acontece aqui — é responsabilidade de
  `toWhatsappLink` no momento de montar o link. Guarda-se o texto como veio.

### 5. `src/functions/students.ts` (modificação)

- `Student` type: adiciona `phone: string | null`.
- `listStudentsFn`: `select` inclui `phone: students.phone`; o `map` repassa `phone`.
- `createSchema` e `updateSchema`: adicionam
  `phone: z.string().trim().optional().or(z.literal(""))`. `createStudentFn` e
  `updateStudentFn` gravam `phone: data.phone?.trim() || null`.
  - `updateStudentFn` só grava `phone` quando o campo vem no payload — o formulário de
    edição sempre envia, então na prática é sempre definido; manter o `|| null` para
    limpar o campo.
- `bulkCreateSchema`: cada item ganha `phone: z.string().trim().nullable()`.
- `BulkCreateResult` passa a ser `{ created: number; updated: number; skipped: Array<string> }`.
- `bulkCreateStudentsFn`:
  - Carrega os existentes com `id`, `name` **e** `phone`.
  - Monta `Map<nomeNormalizado, { id, phone }>`.
  - Para cada linha da planilha:
    - Não existe e não repetida no lote → vai para `toInsert` (com `phone`).
    - Existe, `phone` atual é `null`/vazio, e a linha tem `phone` → vai para
      `toUpdate: Array<{ id: string; phone: string }>`.
    - Existe com `phone` já preenchido, ou linha sem `phone` → `skipped.push(name)`.
  - `db.insert(students).values(toInsert)` se houver.
  - `toUpdate` aplicado um a um (`db.update(students).set({ phone }).where(eq(students.id, id))`)
    — volume pequeno (dezenas de alunos), mesmo estilo de agregação em memória do resto do
    projeto.
  - `logAudit("aluno.importar", ...)` — mensagem passa a citar criados **e** atualizados.
  - Retorna `{ created: toInsert.length, updated: toUpdate.length, skipped }`.

### 6. `src/functions/payments.ts` (modificação)

- `OverdueCharge` type: adiciona `studentPhone: string | null`.
- `getFinancialSummaryFn`: o `select` que faz `innerJoin(students)` passa a trazer
  `studentPhone: students.phone`; ao dar `overdueList.push(...)`, inclui `studentPhone`.
- Nenhuma outra função de `payments.ts` muda.

### 7. Telas

**`src/pages/painel/Students.tsx`**

- Nova coluna "WhatsApp" no `<Table>` (entre "E-mail" e "Situação"). Célula:
  `<WhatsappButton phone={student.phone} studentName={student.name} size="icon" variant="ghost" />`.
  `colSpan` do estado vazio passa de 6 para 7; `TableSkeletonRows columns={7}`.
- `studentSchema` (o do arquivo, ~linha 367): adiciona
  `phone: z.string().trim().optional().or(z.literal(""))`.
- `CreateStudentDialog` e `EditStudentDialog`: novo `FormField name="phone"`, rótulo
  "Telefone / WhatsApp", abaixo do e-mail. `defaultValues` incluem `phone` (`""` no create,
  `student.phone ?? ""` no edit). Ambas as mutações passam `phone` no payload.
- `importMutation.onSuccess`: o toast passa a mostrar
  `${created} criado(s), ${updated} atualizado(s), ${skipped.length} já cadastrado(s)`.

**`src/pages/painel/reports/StudentReport.tsx`**

- No bloco de cabeçalho do relatório, ao lado do link "Baixar PDF" (~linha 237-242):
  `{selectedStudent ? <WhatsappButton phone={selectedStudent.phone} studentName={selectedStudent.name} withLabel variant="outline" size="sm" /> : null}`.
  `selectedStudent` já vem de `listStudentsFn`, que agora traz `phone`.

**`src/pages/painel/Financial.tsx`**

- Na célula "Ações" da tabela "Alunos inadimplentes", antes do botão "Gerenciar":
  ```tsx
  <WhatsappButton
    phone={item.studentPhone}
    studentName={item.studentName}
    context={{ kind: "overdue", amount: item.amount, daysOverdue: item.daysOverdue }}
    size="sm"
    variant="outline"
  />
  ```
  Envolver os dois botões num `<div className="flex justify-end gap-1">`.

### 8. Integração futura (fora desta entrega)

Quando a spec `2026-08-31-dashboards-professor-aluno-design.md` for para a `main`, ela ganha
uma nota curta nas Fases 1, 2 e 4: os cards "Alunos com frequência baixa", "Tarefas para
corrigir" e as linhas do "Acompanhamento por disciplina" renderizam `<WhatsappButton>` com,
respectivamente, `{ kind: "lowAttendance" }`, `{ kind: "missingAssignment" }` e
`{ kind: "lowGrade" }` — contextos já definidos e testados aqui. Como aquele arquivo não
está na branch desta entrega, a nota entra num PR posterior; este design é o registro do
contrato.

## Estratégia de testes

### Automatizado (vitest, função pura)

**`src/lib/whatsapp.test.ts`** — `toWhatsappLink`:

| Entrada | Esperado |
|---------|----------|
| `"18996336965"` (celular, 11 díg.) | `https://wa.me/5518996336965` |
| `"1833334444"` (fixo, 10 díg.) | `https://wa.me/551833334444` |
| `"5518996336965"` (já com 55) | `https://wa.me/5518996336965` |
| `"+55 (18) 99633-6965"` | `https://wa.me/5518996336965` |
| `"018996336965"` (0 na frente) | `https://wa.me/5518996336965` |
| `"996336965"` (9 díg., sem DDD) | `null` |
| `""`, `null`, `undefined` | `null` |
| `"abc"` / `"12"` | `null` |
| com `message` `"oi tudo bem?"` | sufixo `?text=oi%20tudo%20bem%3F` |

**`src/lib/whatsappTemplates.test.ts`**:

- `firstName("DARIO LOPES SARAIVA JUNIOR")` → `"Dario"`.
- `messageFor({ kind: "generic" }, "FULANO")` → `undefined`.
- `messageFor({ kind: "overdue", amount: 150, daysOverdue: 3 }, "NATÁLIA TOLEDO")` →
  contém `"Natália"`, `"3 dia"`, `"150,00"`.
- `messageFor({ kind: "lowAttendance", discipline: "Bibliologia" }, "JOÃO")` → contém
  `"João"` e `"Bibliologia"`.
- `messageFor({ kind: "lowGrade", discipline: "Grego", average: 5.4 }, "ANA")` → contém
  `"Ana"`, `"Grego"`, `"5,4"`.
- `messageFor({ kind: "missingAssignment", title: "Resumo cap. 3" }, "PEDRO")` → contém
  `"Pedro"` e `"Resumo cap. 3"`.

### Manual (`npm run dev`)

1. **Importar planilha** com a coluna WhatsApp num banco onde alguns alunos já existem sem
   telefone: os novos entram com número, os existentes sem telefone são preenchidos, os
   que já tinham telefone não mudam; o toast mostra os três números.
2. **Tela de Alunos**: coluna WhatsApp mostra botão ativo para quem tem número e botão
   cinza ("Sem WhatsApp cadastrado") para quem não tem; clicar abre `wa.me` em nova aba.
3. **Novo/Editar aluno**: o campo Telefone / WhatsApp salva e volta a aparecer preenchido.
4. **Relatório do aluno**: botão no cabeçalho abre a conversa sem texto.
5. **Financeiro › Alunos inadimplentes**: botão abre a conversa com a mensagem de atraso
   pré-preenchida, com nome, dias e valor corretos; alterna para desabilitado quando o
   aluno inadimplente não tem telefone.

### Portões do PR

`npm run test`, `npm run lint` e `npm run build` verdes, mais o roteiro manual acima.

## Fora de escopo

- Construir as telas de alerta de falta / nota baixa / tarefa não entregue (Fases 1/2/4 da
  spec de dashboards).
- Envio automático de mensagem ou integração com a API oficial do WhatsApp Business.
- Registro de auditoria quando alguém clica no botão.
- Campo de WhatsApp separado do `phone` (decidiu-se reaproveitar `phone`).
- Painel para editar os textos das mensagens (v1 são fixos no código).
- Normalização/validação do número no cadastro manual ou em "Minha conta" — o número é
  guardado como digitado; a montagem do link tolera formatos.
- Números fora do Brasil.

## Entrega

Issue [#23](https://github.com/dihviny25-lab/seminario-huguenotes/issues/23), branch
`feat/botao-whatsapp-aluno` a partir da `main`, pull request com `Closes #23`. Merge do PR
dispara o deploy; sem push direto na `main`.
