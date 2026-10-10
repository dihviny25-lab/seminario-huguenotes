# Pagamento por matéria (aluno avulso) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o admin criar uma cobrança vinculada a uma disciplina específica (cobrada ou doada) para um aluno de matrícula seletiva, aparecendo normalmente no financeiro/recibo.

**Architecture:** Um campo novo (`charges.disciplineId`, nullable) + uma server function que espelha `assignMaterialToStudentFn` (`src/functions/materials.ts:112`), trocando "material do catálogo" por "disciplina do currículo" e o preço fixo por um valor digitado na hora. Nenhum mecanismo de acesso novo — a liberação de conteúdo continua 100% pela feature de matrícula seletiva já existente (`students.selectiveEnrollment` + `studentLessonAccess`, issue #100), que não é tocada por este plano.

**Tech Stack:** TanStack Start server functions, Drizzle ORM (Postgres/Neon), React Hook Form + Zod, shadcn/ui, TanStack Query.

**Spec:** `docs/superpowers/specs/2026-10-08-pagamento-por-materia-design.md`

## Global Constraints

- Não criar nenhuma coluna nova em `students` — `selectiveEnrollment` já significa "aluno avulso" e é reaproveitado como está.
- Não criar nenhuma tabela, guard ou checagem de acesso nova — toda a visibilidade de conteúdo por disciplina já é resolvida por `getStudentAccessibleLessonIds`/`isLessonContentVisible` (feature de matrícula seletiva, não tocada aqui).
- `charges.disciplineId` é nullable, `onDelete: "set null"`, paralelo a `courseMaterialId` (`schema.ts:364`) — nunca `notNull`.
- Nenhuma automação entre pagar a cobrança e liberar aulas em `studentLessonAccess` — as duas ações continuam manuais e independentes (ver spec, "Fora de escopo").
- Seguir exatamente o padrão existente de `assignMaterialToStudentFn`/`AssignMaterialDialog` (mesma forma de cobrar/doar, mesmo estilo de erro, mesmo layout de diálogo) — não inventar um fluxo diferente.
- Funções de servidor que tocam o banco direto (`src/functions/materials.ts`, `src/functions/payments.ts`) não têm teste unitário neste repositório — só funções puras em `src/lib/*.ts` são testadas (ver `src/lib/payments.test.ts`). Este plano segue essa convenção: a verificação da função nova é typecheck + QA manual no navegador, não um teste automatizado novo.
- Rodar `npm run typecheck` e `npm run lint` antes de cada commit.

## Review Focus

- Cobrar disciplina pra um aluno com `selectiveEnrollment = false` deve falhar com mensagem clara, sem criar cobrança órfã — é o caso de uso mais fácil de esquecer de testar manualmente, então tem um passo de QA dedicado a ele na Task 3.
- Só admin pode chamar `chargeDisciplineAccessFn`/`listDisciplinesForChargeFn` — `requireAdminId()` já garante isso no servidor; a Task 3 confirma que o botão novo também só aparece pra admin na UI (mesma condição `isAdmin` que já envolve os outros botões da barra de ações).
- "Doar disciplina" tem que nascer com `status: "paid"`, `paidAmount: "0"` — igual ao padrão de "material doado"/bolsa integral — e aparecer como paga (não pendente) na lista e no recibo.
- O seletor de disciplinas tem que listar o currículo inteiro (todas as disciplinas, de todos os professores), não só as do professor logado — `listMyDisciplinesFn` (escopado ao professor) não serve aqui; por isso a Task 2 cria uma função de listagem própria, sem escopo de professor.
- Apagar uma disciplina depois de já existir uma cobrança vinculada a ela não deve quebrar nada — `onDelete: "set null"` preserva a cobrança (com a descrição textual já copiada), só zera a referência; a Task 1 confirma isso com `npm run db:push` sem erro.

---

### Task 1: Campo `disciplineId` em `charges`

**Files:**
- Modify: `src/server/db/schema.ts:357-367`

**Interfaces:**
- Consumes: nada (schema puro).
- Produces: `charges.disciplineId` (coluna nullable, FK → `disciplines.id`) — consumido pela Task 2.

- [ ] **Step 1: Adicionar a coluna ao schema**

Em `src/server/db/schema.ts`, dentro de `export const charges = pgTable("charges", { ... })`, logo depois do bloco de `courseMaterialId` (linha 364-366):

```ts
  // Presente só quando a cobrança veio de um material do catálogo (cobrado
  // ou doado) — nulo pra mensalidade e cobrança avulsa comuns.
  courseMaterialId: uuid("course_material_id").references(() => courseMaterials.id, {
    onDelete: "set null",
  }),
  // Presente só quando a cobrança é de acesso a uma disciplina específica
  // (aluno de matrícula seletiva pagando por matéria) — nulo pros demais
  // tipos de cobrança. A liberação de conteúdo em si não depende deste
  // campo: continua sendo feita em `studentLessonAccess` (matrícula
  // seletiva), de forma manual e independente.
  disciplineId: uuid("discipline_id").references(() => disciplines.id, {
    onDelete: "set null",
  }),
```

- [ ] **Step 2: Aplicar no banco**

Run: `npm run db:push`
Expected: drizzle-kit relata 1 coluna nova (`charges.discipline_id`) e aplica sem pedir confirmação de perda de dados (coluna nullable, sem default — adição pura).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add src/server/db/schema.ts
git commit -m "feat: adiciona charges.disciplineId pra cobrança por matéria

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Server functions de cobrança por disciplina

**Files:**
- Modify: `src/functions/payments.ts` (adiciona duas funções novas; nenhuma função existente muda)

**Interfaces:**
- Consumes: `charges.disciplineId` (Task 1); `students.selectiveEnrollment` (já existe); `disciplines` (já existe); `requireAdminId`, `logAudit`, `todayIso` (já existem no próprio arquivo).
- Produces:
  - `listDisciplinesForChargeFn(): Promise<Array<DisciplineOption>>` onde `DisciplineOption = { id: string; discipline: string }` — consumido pela Task 3 (seletor do diálogo).
  - `chargeDisciplineAccessFn({ data: { studentId: string; disciplineId: string; donate: boolean; amount?: number; dueDate?: string } }): Promise<{ id: string }>` — consumido pela Task 3 (submit do diálogo).

- [ ] **Step 1: Adicionar `listDisciplinesForChargeFn`**

No final de `src/functions/payments.ts`, depois de `getFinancialReportFn`:

```ts
export type DisciplineOption = { id: string; discipline: string };

/** Todas as disciplinas do currículo (qualquer professor), pro seletor de "Cobrar disciplina". */
export const listDisciplinesForChargeFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<DisciplineOption>> => {
    await requireAdminId();
    return db
      .select({ id: disciplines.id, discipline: disciplines.discipline })
      .from(disciplines)
      .orderBy(asc(disciplines.sortOrder));
  },
);
```

- [ ] **Step 2: Adicionar o schema e a função `chargeDisciplineAccessFn`**

Logo abaixo do passo anterior, no mesmo arquivo:

```ts
const chargeDisciplineAccessSchema = z
  .object({
    studentId: z.string().uuid(),
    disciplineId: z.string().uuid(),
    donate: z.boolean(),
    amount: z.number().positive("O valor precisa ser maior que zero.").optional(),
    dueDate: z.string().optional(),
  })
  .refine((data) => data.donate || data.amount !== undefined, {
    message: "Informe o valor.",
    path: ["amount"],
  })
  .refine((data) => data.donate || (data.dueDate?.length ?? 0) > 0, {
    message: "Informe o vencimento.",
    path: ["dueDate"],
  });

/**
 * Cria uma cobrança vinculada a uma disciplina pra um aluno de matrícula
 * seletiva ("pagamento por matéria") — cobra normalmente ou já nasce doada
 * (paga, valor zero), mesmo padrão de `assignMaterialToStudentFn`
 * (`src/functions/materials.ts`). Não libera nenhuma aula: isso continua
 * sendo feito manualmente em Alunos → matrícula seletiva.
 */
export const chargeDisciplineAccessFn = createServerFn({ method: "POST" })
  .validator(chargeDisciplineAccessSchema)
  .handler(async ({ data }) => {
    const teacherId = await requireAdminId();

    const [student] = await db
      .select({ name: students.name, selectiveEnrollment: students.selectiveEnrollment })
      .from(students)
      .where(eq(students.id, data.studentId))
      .limit(1);
    if (!student) throw new Error("Aluno não encontrado.");
    if (!student.selectiveEnrollment) {
      throw new Error(
        "Esse aluno não é de matrícula seletiva — ative em Alunos antes de cobrar por disciplina.",
      );
    }

    const [discipline] = await db
      .select({ discipline: disciplines.discipline })
      .from(disciplines)
      .where(eq(disciplines.id, data.disciplineId))
      .limit(1);
    if (!discipline) throw new Error("Disciplina não encontrada.");

    const [row] = await db
      .insert(charges)
      .values({
        studentId: data.studentId,
        disciplineId: data.disciplineId,
        description: `Disciplina: ${discipline.discipline}`,
        fullAmount: data.donate ? "0" : String(data.amount),
        discountPercent: "0",
        dueDate: data.donate ? todayIso() : data.dueDate!,
        createdById: teacherId,
        ...(data.donate
          ? {
              status: "paid" as const,
              paidAt: new Date(),
              paidAmount: "0",
              paidManually: true,
              note: "Disciplina cedida",
            }
          : {}),
      })
      .returning({ id: charges.id });

    await logAudit(
      data.donate ? "financeiro.disciplina_ceder" : "financeiro.disciplina_cobrar",
      data.donate
        ? `Cedeu a disciplina "${discipline.discipline}" para ${student.name}.`
        : `Cobrou a disciplina "${discipline.discipline}" (R$ ${data.amount!.toFixed(2)}) de ${student.name}.`,
    );
    return row;
  });
```

- [ ] **Step 3: Typecheck e lint**

Run: `npm run typecheck && npm run lint`
Expected: sem erros. (`asc`, `disciplines`, `students`, `requireAdminId`, `logAudit`, `todayIso` já estão importados/definidos neste arquivo — nenhum import novo necessário.)

- [ ] **Step 4: Commit**

```bash
git add src/functions/payments.ts
git commit -m "feat: adiciona cobrança por disciplina (chargeDisciplineAccessFn)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Diálogo "Cobrar disciplina" no painel

**Files:**
- Modify: `src/pages/painel/Payments.tsx`

**Interfaces:**
- Consumes: `chargeDisciplineAccessFn`, `listDisciplinesForChargeFn`, `type DisciplineOption` de `@/functions/payments` (Task 2).
- Produces: nada consumido por outra task — é a ponta final da feature.

- [ ] **Step 1: Importar as funções novas e o ícone**

Em `src/pages/painel/Payments.tsx:72-82`, adicionar aos imports já existentes de `@/functions/payments`:

```ts
import {
  cancelChargeFn,
  chargeDisciplineAccessFn,
  createChargeFn,
  generateMonthlyChargesFn,
  listDisciplinesForChargeFn,
  listStudentChargesFn,
  markChargePaidManuallyFn,
  rejectChargeProofFn,
  revertChargeToPendingFn,
  updateChargeFn,
  type Charge,
} from "@/functions/payments";
```

E no bloco de ícones (`src/pages/painel/Payments.tsx:5-17`), adicionar `GraduationCap` à lista importada de `lucide-react` (ordem alfabética, entre `Download` e `Loader2`).

- [ ] **Step 2: Estado e botão novo no componente `Payments`**

Em `src/pages/painel/Payments.tsx:120`, logo após `const [materialOpen, setMaterialOpen] = useState(false);`:

```ts
  const [disciplineChargeOpen, setDisciplineChargeOpen] = useState(false);
```

Em `src/pages/painel/Payments.tsx:222-225`, logo após o botão "Dar/cobrar material":

```tsx
                <Button variant="outline" onClick={() => setMaterialOpen(true)}>
                  <BookOpen className="size-4" aria-hidden />
                  Dar/cobrar material
                </Button>
                <Button variant="outline" onClick={() => setDisciplineChargeOpen(true)}>
                  <GraduationCap className="size-4" aria-hidden />
                  Cobrar disciplina
                </Button>
```

E em `src/pages/painel/Payments.tsx:395-400`, logo após `<AssignMaterialDialog ... />`:

```tsx
          <ChargeDisciplineDialog
            studentId={selectedId}
            open={disciplineChargeOpen}
            onOpenChange={setDisciplineChargeOpen}
            onCharged={invalidate}
          />
```

- [ ] **Step 3: Componente `ChargeDisciplineDialog`**

No final do arquivo `src/pages/painel/Payments.tsx` (depois do fim de `AssignMaterialDialog`, linha 1068), adicionar:

```tsx
const chargeDisciplineSchema = z
  .object({
    disciplineId: z.string().uuid("Escolha uma disciplina."),
    donate: z.boolean(),
    amount: z.coerce.number().optional(),
    dueDate: z.string().optional(),
  })
  .refine((data) => data.donate || (data.amount ?? 0) > 0, {
    message: "Informe um valor maior que zero.",
    path: ["amount"],
  })
  .refine((data) => data.donate || (data.dueDate?.length ?? 0) > 0, {
    message: "Informe o vencimento.",
    path: ["dueDate"],
  });

/**
 * Cobra (ou doa) o acesso a uma disciplina — pra aluno de matrícula
 * seletiva pagando "por matéria" em vez de mensalidade do programa.
 */
function ChargeDisciplineDialog({
  studentId,
  open,
  onOpenChange,
  onCharged,
}: {
  studentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCharged: () => Promise<unknown>;
}) {
  const { data: disciplineOptions } = useQuery({
    queryKey: ["disciplines-for-charge"],
    queryFn: () => listDisciplinesForChargeFn(),
    enabled: open,
  });

  const form = useForm<z.infer<typeof chargeDisciplineSchema>>({
    resolver: zodResolver(chargeDisciplineSchema),
    defaultValues: { disciplineId: "", donate: false, amount: undefined, dueDate: "" },
  });
  const donate = form.watch("donate");

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof chargeDisciplineSchema>) =>
      chargeDisciplineAccessFn({ data: { studentId, ...values } }),
    onSuccess: async () => {
      toast.success(donate ? "Disciplina cedida ao aluno." : "Disciplina cobrada do aluno.");
      form.reset();
      onOpenChange(false);
      await onCharged();
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível registrar.")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cobrar disciplina</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <FormField
              control={form.control}
              name="disciplineId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Disciplina</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha uma disciplina" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(disciplineOptions ?? []).map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.discipline}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Só funciona pra aluno com matrícula seletiva ativada em Alunos.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="donate"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border border-border/70 p-3">
                  <FormLabel className="mb-0">Doar (sem cobrar do aluno)</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            {!donate ? (
              <>
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vencimento</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                {donate ? "Doar disciplina" : "Cobrar disciplina"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Typecheck e lint**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 5: QA manual no navegador**

Run: `npm run dev`, logar no painel como admin, ir em Pagamentos.

1. Escolha um aluno **sem** matrícula seletiva (a maioria). Abra "Cobrar disciplina", preencha e envie. Esperado: toast de erro "Esse aluno não é de matrícula seletiva — ative em Alunos antes de cobrar por disciplina." — nenhuma linha nova na tabela de cobranças.
2. Em Alunos → ícone de lista, ative a matrícula seletiva desse aluno. Volte em Pagamentos, abra "Cobrar disciplina" de novo, escolha uma disciplina, valor e vencimento, envie. Esperado: toast de sucesso, nova linha "Disciplina: <nome>" pendente na tabela, com o valor e vencimento certos.
3. Repita com "Doar (sem cobrar do aluno)" ligado. Esperado: nova linha já como "Pago", valor R$ 0,00.
4. Dê baixa manual na cobrança do passo 2 (botão já existente de marcar como paga). Confirme que ela aparece em Financeiro (`/painel/financeiro`) e que o recibo (`/painel/pagamentos/:id/recibo`) abre mostrando "Disciplina: <nome>" como descrição.
5. Logado como o próprio aluno no portal (`/portal/mensalidades`), confirme que a cobrança aparece com a mesma descrição.
6. Confirme que o botão "Cobrar disciplina" não aparece pra um professor comum (não-admin) logado no painel.

- [ ] **Step 6: Commit**

```bash
git add src/pages/painel/Payments.tsx
git commit -m "feat: adiciona diálogo de cobrança por disciplina no painel

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
