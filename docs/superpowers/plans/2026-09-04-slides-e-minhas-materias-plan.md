# Slides e hub "Minhas Matérias" — plano de implementação

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development`
> (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa a tarefa.
> Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** dar ao professor um hub "Minhas Matérias" (apostilas + slides de todas as
disciplinas, num lugar só, com edição inline) e introduzir **slides** como um segundo tipo de
conteúdo publicável por disciplina — PDF com leitura página-a-página de verdade — levando a mesma
leitura de slides para o portal do aluno.

**Arquitetura:** tabela nova `presentation_slides`, espelhando `reading_materials` coluna por
coluna; server functions novas em `src/functions/presentationSlides.ts` (espelhando
`readingMaterials.ts` função por função) e `src/functions/myMaterials.ts` (agregação só-leitura
que junta apostila + slide de todas as disciplinas do professor). UI do professor ganha uma aba
"Slides" na disciplina (criação/edição/exclusão) e uma tela nova "Minhas Matérias" (edição inline,
sem criação). UI do aluno ganha uma rota agregada `/portal/slides`, uma aba "Slides" dentro da
disciplina, e um leitor página-a-página com `react-pdf`.

**Tech Stack:** TanStack Start (server functions) + TanStack Router + TanStack Query, React 19,
Drizzle ORM sobre Neon Postgres, Zod, Tailwind 4 + shadcn/Radix (`src/components/ui`),
lucide-react, Vercel Blob (`@vercel/blob`), `react-pdf` (novo).

**Spec:** `docs/superpowers/specs/2026-09-04-slides-e-minhas-materias-design.md` — leia junto com
este plano; ele é a autoridade sobre *o que* construir. Este plano não repete o raciocínio do
spec, só o transforma em tarefas executáveis.

## Global Constraints

Valem para **todas** as tarefas deste plano. Os requisitos de cada tarefa incluem esta seção
implicitamente.

1. **Tabela nova `presentation_slides`** (Drizzle: `presentationSlides`), com **exatamente** as
   mesmas colunas de `reading_materials`: `id`, `disciplineId`, `title`, `description`, `fileUrl`,
   `fileName`, `sequence`, `createdAt`. Sem coluna de dono própria — dono sempre inferido via
   `disciplines.teacherId`. Sem `availableAt` persistido — calculado em runtime, igual apostila.
2. **`npm run db:push` é manual.** Depois da Tarefa A1 (schema), o agente **não** roda
   `npm run db:push` — só marca no relatório da tarefa que esse passo precisa ser rodado pelo dono
   do projeto antes de qualquer teste manual contra o banco real.
3. **`src/functions/presentationSlides.ts`** espelha `src/functions/readingMaterials.ts` função
   por função, mesmos nomes trocando "Material" por "Slide": `listMyDisciplineSlidesFn`,
   `createSlideFn`, `updateSlideFn`, `deleteSlideFn`, `listAllPresentationSlidesFn`,
   `listDisciplinePresentationSlidesFn`. Tipo exportado `PresentationSlide` com o mesmo shape de
   `ReadingMaterial`.
4. **`src/functions/myMaterials.ts`** é o único lugar que agrega apostila + slide juntos. Não
   define update/delete próprios — a edição inline chama `updateMaterialFn`/`deleteMaterialFn` ou
   `updateSlideFn`/`deleteSlideFn` conforme o `kind` do item.
5. **Upload de slide**: novo `UploadPurpose` `"slide"` em `src/lib/blobUpload.ts` e
   `src/server/uploads/policy.ts`. Política: `requiresTeacher: true`,
   `allowedContentTypes: ["application/pdf"]`, `maximumSizeInBytes: 100 * MB`. Nunca aceitar Word,
   PowerPoint ou imagem em slide — só PDF.
6. **Validação de PDF em três camadas** (nenhuma tarefa pula nenhuma): `<input accept="application/pdf,.pdf">`
   no formulário; `allowedContentTypes: ["application/pdf"]` na política de upload (camada real);
   `createSlideFn` valida com Zod `refine` que `fileName` termina em `.pdf` (case-insensitive,
   mensagem "O arquivo precisa ser um PDF.").
7. **`sequence`** é sempre `max(sequence existente) + 1` na criação — nunca reordenar depois do
   fato, mesmo padrão de `readingMaterials.ts`/`videoLessons.ts`.
8. **`logAudit`** com o padrão `"<domínio>.<ação>"`: `"slide.criar"`, `"slide.editar"`,
   `"slide.apagar"` — mesmo formato de `"apostila.criar"`/`"video.apagar"` já usado.
9. **`react-pdf` fixado em `"^10.5.0"`** (não instalar outra major). Worker do pdf.js resolvido com
   `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()` — nunca copiar o
   worker manualmente para `public/`.
10. **Rotas novas**: `/painel/minhas-materias`, `/portal/slides`, `/portal/slides/$slideId`. Nenhuma
    rota existente muda de caminho.
11. **Sem criação nem compartilhamento no hub "Minhas Matérias".** Criação de slide só na aba
    "Slides" da disciplina. Nenhum botão/ícone `Share2` nem `ShareSlideDialog` em Slides — o
    compartilhamento entre professores é exclusivo de apostila.
12. **Sem item novo na sidebar do portal do aluno** (`portalNavItems` em `PortalShell.tsx` **não
    muda**). Acesso a `/portal/slides` só via `ContentTypeToggle` a partir de `/portal/apostilas`, e
    via a aba "Slides" dentro da disciplina.
13. **Item novo em `painelNavItems`** (`PainelShell.tsx`): `{ to: "/painel/minhas-materias", label:
    "Minhas Matérias", icon: BookOpen }`, posicionado depois de "Tarefas" e antes de "Fórum".
14. **`PortalSlideReader` sempre abre no slide 1** — sem persistir onde o aluno parou (não existe
    tabela de progresso de slide). Sem editar/trocar o arquivo de um slide já enviado — só título e
    descrição.
15. **Idioma.** UI, mensagens de erro e comentários de código em **português**.
16. **Sem framework de teste novo.** Nenhuma tarefa deste plano escreve `.test.ts`. Verificação via
    `npx eslint .`, `npx tsc --noEmit -p tsconfig.typecheck.json` e `npm run build`, mais o roteiro
    manual descrito no fim de cada fase.
17. **Portões de cada tarefa.** `npx eslint .` e `npx tsc --noEmit -p tsconfig.typecheck.json`
    limpos antes de cada commit. `npm run build` verde é exigido pelo menos ao fim de cada fase
    (obrigatório nas tarefas A3, A6, B3 e B4, que são as que mexem em código que só quebra o bundle
    de produção — imports do worker do pdf.js, rotas novas).
18. **Commits frequentes.** Cada tarefa termina em commit próprio (`git add` só dos arquivos da
    tarefa), mensagem curta em português no formato `tipo: descrição`, terminando com
    `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

## Ordem de execução

```
Fase A (painel do professor)                    Fase B (portal do aluno)
A1 (schema) ── precisa de npm run db:push manual
  │
  ▼
A2 (upload/política)
  │
  ▼
A3 (server functions presentationSlides.ts) ──────────┐
  │                                                     │
  ▼                                                     ▼
A4 (myMaterials.ts — agregação)              B1 (SlideCard + ContentTypeToggle)
  │                                                     │
  ▼                                                     ▼
A5 (aba Slides na disciplina)                B2 (PortalSlides + rota + toggle em PortalMaterials)
  │                                                     │
  ▼                                                     ▼
A6 (hub Minhas Matérias + rota + nav)        B3 (PortalSlideReader + rota + react-pdf)
                                                         │
                                                         ▼
                                              B4 (DisciplineSlidesTab + aba no portal)
```

A3 é o ponto de corte real: A4-A6 dependem dela, e B1-B4 dependem só de A3 (a leitura do lado do
aluno usa `listAllPresentationSlidesFn`/`listDisciplinePresentationSlidesFn`, que também nascem em
A3). B1-B4 podem começar em paralelo com A4-A6 assim que A3 estiver commitada — mas cada tarefa
individual segue sua ordem interna (B2 depende de B1, B4 depende de B3 só por causa da instalação
do `react-pdf`, que acontece em B3).

---

## Fase A — Painel do professor

### Tarefa A1 — Schema: tabela `presentation_slides`

**Arquivos:**
- Modificar: `src/server/db/schema.ts`

**Interfaces:**
- Consome: nada.
- Produz: `export const presentationSlides` (Drizzle `pgTable`, nome da tabela
  `"presentation_slides"`), consumida por A3 (`src/functions/presentationSlides.ts`).

- [ ] **Passo 1: Adicionar a tabela `presentationSlides` no schema**

Abra `src/server/db/schema.ts` e localize o bloco `readingMaterialComments` (logo antes de
`export const assignments = pgTable("assignments", ...)`). Insira a tabela nova **depois** de
`readingMaterialComments` e **antes** de `assignments`:

```ts
export const presentationSlides = pgTable("presentation_slides", {
  id: uuid("id").primaryKey().defaultRandom(),
  disciplineId: uuid("discipline_id")
    .notNull()
    .references(() => disciplines.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  sequence: integer("sequence").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Passo 2: Rodar lint e typecheck**

Run: `npx eslint . && npx tsc --noEmit -p tsconfig.typecheck.json`
Expected: sem erros.

- [ ] **Passo 3: Registrar no relatório da tarefa que falta rodar `db:push`**

**Não execute `npm run db:push` você mesmo.** Escreva explicitamente no relatório final desta
tarefa: "Pendência: o dono do projeto precisa rodar `npm run db:push` antes de testar qualquer
fluxo de slide contra o banco real — sem isso a tabela `presentation_slides` não existe no Postgres
e as tarefas A3+ falham em runtime (embora compilem normalmente, já que Drizzle Kit não é
verificado por `tsc`)."

- [ ] **Passo 4: Commit**

```bash
git add src/server/db/schema.ts
git commit -m "feat: adiciona tabela presentation_slides ao schema"
```

---

### Tarefa A2 — Upload e política de arquivo para slide

**Arquivos:**
- Modificar: `src/lib/blobUpload.ts`
- Modificar: `src/server/uploads/policy.ts`

**Interfaces:**
- Consome: nada (`UploadPurpose` existente).
- Produz: `UploadPurpose` incluindo `"slide"`; `getUploadPolicy("slide")` retornando
  `{ requiresTeacher: true, allowedContentTypes: ["application/pdf"], maximumSizeInBytes: 100 * MB }`.
  Consumido por A5 (`uploadFile(file, "slide")` na aba "Slides" da disciplina).

- [ ] **Passo 1: Adicionar `"slide"` ao tipo `UploadPurpose` em `blobUpload.ts`**

```ts
export type UploadPurpose = "assignment" | "material" | "library" | "video" | "slide";
```

Nenhuma outra mudança é necessária em `blobUpload.ts` — `uploadFile` já repassa `purpose` como
está, genérico.

- [ ] **Passo 2: Adicionar `"slide"` ao tipo `UploadPurpose` em `policy.ts`**

```ts
export type UploadPurpose = "assignment" | "material" | "library" | "video" | "slide";
```

- [ ] **Passo 3: Aceitar `"slide"` em `parseUploadPurpose`**

Em `src/server/uploads/policy.ts`, na função `parseUploadPurpose`, adicione `"slide"` à checagem:

```ts
  if (
    purpose !== "assignment" &&
    purpose !== "material" &&
    purpose !== "library" &&
    purpose !== "video" &&
    purpose !== "slide"
  ) {
    throw new Error("Finalidade do upload inválida.");
  }
```

- [ ] **Passo 4: Adicionar o caso `"slide"` em `getUploadPolicy`**

```ts
    case "slide":
      return {
        requiresTeacher: true,
        allowedContentTypes: ["application/pdf"],
        maximumSizeInBytes: 100 * MB,
      };
```

- [ ] **Passo 5: Rodar lint e typecheck**

Run: `npx eslint . && npx tsc --noEmit -p tsconfig.typecheck.json`
Expected: sem erros. `src/routes/api/blob/upload.tsx` não precisa mudar — já é genérico por
`purpose`; confirme lendo o arquivo que ele só chama `parseUploadPurpose`/`getUploadPolicy`, sem
`switch` próprio sobre a finalidade.

- [ ] **Passo 6: Commit**

```bash
git add src/lib/blobUpload.ts src/server/uploads/policy.ts
git commit -m "feat: adiciona finalidade de upload slide com politica so-PDF"
```

---

### Tarefa A3 — Server functions de slide (`presentationSlides.ts`)

**Arquivos:**
- Criar: `src/functions/presentationSlides.ts`

**Interfaces:**
- Consome: `presentationSlides` (tabela, Tarefa A1), `disciplines` (schema existente),
  `requireAnyLogin`/`requireOwnDiscipline` (`@/server/auth/guard`), `logAudit` (`@/server/audit`).
- Produz: tipo `PresentationSlide` e as funções `listMyDisciplineSlidesFn`, `createSlideFn`,
  `updateSlideFn`, `deleteSlideFn`, `listAllPresentationSlidesFn`,
  `listDisciplinePresentationSlidesFn` — consumidas por A4 (agregação), A5 (aba da disciplina), B2,
  B3 e B4 (portal do aluno).

- [ ] **Passo 1: Criar o arquivo espelhando `readingMaterials.ts`**

Crie `src/functions/presentationSlides.ts` com o conteúdo abaixo. É uma cópia estrutural de
`src/functions/readingMaterials.ts`, trocando `readingMaterials` por `presentationSlides`,
`ReadingMaterial` por `PresentationSlide`, `materialId` por `slideId`, e os textos de auditoria por
`"slide.*"`. A única diferença de comportamento real é a validação extra de `.pdf` em
`createSlideFn`:

```ts
import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import { requireAnyLogin, requireOwnDiscipline } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { disciplines, presentationSlides } from "@/server/db/schema";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export type PresentationSlide = {
  id: string;
  disciplineId: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileName: string;
  sequence: number;
  /** null = disponível já (ou disciplina sem data de início definida). */
  availableAt: string | null;
};

const disciplineIdSchema = z.object({ disciplineId: z.string().uuid() });

/** Slides de uma disciplina — só o professor dono dela gerencia. */
export const listMyDisciplineSlidesFn = createServerFn({ method: "GET" })
  .validator(disciplineIdSchema)
  .handler(async ({ data }): Promise<Array<PresentationSlide>> => {
    await requireOwnDiscipline(data.disciplineId);
    const rows = await db
      .select()
      .from(presentationSlides)
      .where(eq(presentationSlides.disciplineId, data.disciplineId))
      .orderBy(asc(presentationSlides.sequence));
    // Visão do professor gerenciando o conteúdo — sempre "disponível", o
    // bloqueio por data é só pro lado do aluno lendo.
    return rows.map((row) => ({ ...row, availableAt: null }));
  });

const createSchema = z.object({
  disciplineId: z.string().uuid(),
  title: z.string().trim().min(1, "Informe um título."),
  description: z.string().trim().optional(),
  fileUrl: z.string().trim().url("URL de arquivo inválida."),
  fileName: z
    .string()
    .trim()
    .min(1)
    .refine((name) => name.toLowerCase().endsWith(".pdf"), {
      message: "O arquivo precisa ser um PDF.",
    }),
});

export const createSlideFn = createServerFn({ method: "POST" })
  .validator(createSchema)
  .handler(async ({ data }) => {
    const discipline = await requireOwnDiscipline(data.disciplineId);

    const existing = await db
      .select({ sequence: presentationSlides.sequence })
      .from(presentationSlides)
      .where(eq(presentationSlides.disciplineId, data.disciplineId));
    const nextSequence = existing.reduce((max, s) => Math.max(max, s.sequence), 0) + 1;

    const [row] = await db
      .insert(presentationSlides)
      .values({
        disciplineId: data.disciplineId,
        title: data.title,
        description: data.description || null,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        sequence: nextSequence,
      })
      .returning({ id: presentationSlides.id });
    await logAudit(
      "slide.criar",
      `Adicionou o slide "${data.title}" em ${discipline.discipline}.`,
    );
    return row;
  });

const updateSchema = z.object({
  disciplineId: z.string().uuid(),
  slideId: z.string().uuid(),
  title: z.string().trim().min(1, "Informe um título."),
  description: z.string().trim().optional(),
});

export const updateSlideFn = createServerFn({ method: "POST" })
  .validator(updateSchema)
  .handler(async ({ data }) => {
    const discipline = await requireOwnDiscipline(data.disciplineId);
    await db
      .update(presentationSlides)
      .set({ title: data.title, description: data.description || null })
      .where(eq(presentationSlides.id, data.slideId));
    await logAudit(
      "slide.editar",
      `Editou o slide "${data.title}" em ${discipline.discipline}.`,
    );
  });

const deleteSchema = z.object({ disciplineId: z.string().uuid(), slideId: z.string().uuid() });

export const deleteSlideFn = createServerFn({ method: "POST" })
  .validator(deleteSchema)
  .handler(async ({ data }) => {
    const discipline = await requireOwnDiscipline(data.disciplineId);
    const [slide] = await db
      .select({ title: presentationSlides.title })
      .from(presentationSlides)
      .where(eq(presentationSlides.id, data.slideId))
      .limit(1);
    await db.delete(presentationSlides).where(eq(presentationSlides.id, data.slideId));
    await logAudit(
      "slide.apagar",
      `Apagou o slide "${slide?.title ?? data.slideId}" em ${discipline.discipline}.`,
    );
  });

function selectSlideColumns() {
  return {
    id: presentationSlides.id,
    disciplineId: presentationSlides.disciplineId,
    title: presentationSlides.title,
    description: presentationSlides.description,
    fileUrl: presentationSlides.fileUrl,
    fileName: presentationSlides.fileName,
    sequence: presentationSlides.sequence,
    startDate: disciplines.startDate,
  };
}

function withAvailability(
  row: Omit<PresentationSlide, "availableAt"> & { startDate: string | null },
): PresentationSlide {
  const { startDate, ...slide } = row;
  const available = startDate === null || startDate <= todayIso();
  return { ...slide, availableAt: available ? null : startDate };
}

/**
 * Todos os slides do currículo, pra biblioteca do portal do aluno — aparecem
 * todos, mas os de disciplinas que ainda não começaram vêm marcados com
 * `availableAt` (o cliente mostra bloqueado até essa data).
 */
export const listAllPresentationSlidesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<PresentationSlide>> => {
    await requireAnyLogin();
    const rows = await db
      .select(selectSlideColumns())
      .from(presentationSlides)
      .innerJoin(disciplines, eq(disciplines.id, presentationSlides.disciplineId))
      .orderBy(asc(presentationSlides.sequence));
    return rows.map(withAvailability);
  },
);

/** Slides de UMA disciplina — pra página do curso no portal (qualquer aluno/professor). */
export const listDisciplinePresentationSlidesFn = createServerFn({ method: "GET" })
  .validator(disciplineIdSchema)
  .handler(async ({ data }): Promise<Array<PresentationSlide>> => {
    await requireAnyLogin();
    const rows = await db
      .select(selectSlideColumns())
      .from(presentationSlides)
      .innerJoin(disciplines, eq(disciplines.id, presentationSlides.disciplineId))
      .where(eq(presentationSlides.disciplineId, data.disciplineId))
      .orderBy(asc(presentationSlides.sequence));
    return rows.map(withAvailability);
  });
```

- [ ] **Passo 2: Rodar lint e typecheck**

Run: `npx eslint . && npx tsc --noEmit -p tsconfig.typecheck.json`
Expected: sem erros. Se `presentationSlides` não for encontrado em `@/server/db/schema`, confirme
que a Tarefa A1 foi commitada antes desta.

- [ ] **Passo 3: Commit**

```bash
git add src/functions/presentationSlides.ts
git commit -m "feat: adiciona server functions de slide (CRUD + leitura por disciplina)"
```

---

### Tarefa A4 — Agregação do hub (`myMaterials.ts`)

**Arquivos:**
- Criar: `src/functions/myMaterials.ts`

**Interfaces:**
- Consome: `readingMaterials`, `presentationSlides`, `disciplines` (schema),
  `requireTeacherId` (`@/server/auth/guard`).
- Produz: tipo `MyMaterialItem` e `listMyMaterialsFn` — consumidos por A6 (`MyMaterials.tsx`).

- [ ] **Passo 1: Criar `src/functions/myMaterials.ts`**

```ts
import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";

import { requireTeacherId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { disciplines, presentationSlides, readingMaterials } from "@/server/db/schema";

export type MyMaterialItem = {
  kind: "apostila" | "slide";
  id: string;
  disciplineId: string;
  disciplineName: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileName: string;
};

/**
 * Apostilas + slides de todas as disciplinas do professor logado, num só
 * array — base do hub "Minhas Matérias". Não expõe update/delete próprios:
 * a UI chama updateMaterialFn/deleteMaterialFn ou updateSlideFn/deleteSlideFn
 * conforme o `kind` do item, ambas já protegidas por requireOwnDiscipline.
 */
export const listMyMaterialsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<MyMaterialItem>> => {
    const teacherId = await requireTeacherId();

    const [materialRows, slideRows] = await Promise.all([
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
        .where(eq(disciplines.teacherId, teacherId)),
      db
        .select({
          id: presentationSlides.id,
          disciplineId: presentationSlides.disciplineId,
          disciplineName: disciplines.discipline,
          title: presentationSlides.title,
          description: presentationSlides.description,
          fileUrl: presentationSlides.fileUrl,
          fileName: presentationSlides.fileName,
        })
        .from(presentationSlides)
        .innerJoin(disciplines, eq(disciplines.id, presentationSlides.disciplineId))
        .where(eq(disciplines.teacherId, teacherId)),
    ]);

    return [
      ...materialRows.map((row) => ({ ...row, kind: "apostila" as const })),
      ...slideRows.map((row) => ({ ...row, kind: "slide" as const })),
    ];
  },
);
```

- [ ] **Passo 2: Rodar lint e typecheck**

Run: `npx eslint . && npx tsc --noEmit -p tsconfig.typecheck.json`
Expected: sem erros.

- [ ] **Passo 3: Commit**

```bash
git add src/functions/myMaterials.ts
git commit -m "feat: adiciona agregacao de apostilas e slides do professor (myMaterials)"
```

---

### Tarefa A5 — Aba "Slides" na disciplina

**Arquivos:**
- Criar: `src/pages/painel/SlidesTab.tsx`
- Modificar: `src/pages/painel/DisciplineDetail.tsx`

**Interfaces:**
- Consome: `listMyDisciplineSlidesFn`, `createSlideFn`, `updateSlideFn`, `deleteSlideFn`, tipo
  `PresentationSlide` (todos de `@/functions/presentationSlides`, Tarefa A3); `uploadFile`
  (`@/lib/blobUpload`, Tarefa A2 acrescentou `"slide"` ao `UploadPurpose`).
- Produz: `SlidesTab({ disciplineId }: { disciplineId: string })`, montado dentro da aba "Slides"
  de `DisciplineDetail.tsx`.

- [ ] **Passo 1: Criar `src/pages/painel/SlidesTab.tsx`**

Cópia estrutural de `src/pages/painel/ReadingMaterialsTab.tsx` (leia esse arquivo antes de
escrever este), com estas diferenças: usa as funções de `presentationSlides.ts`; o campo de
arquivo do diálogo de criação aceita só PDF (`accept="application/pdf,.pdf"`, rótulo "Arquivo
(PDF)"); o upload usa `uploadFile(file, "slide")`; **sem** botão/ícone de compartilhar
(`Share2`), sem `ShareSlideDialog`, sem `shareSlide` state. Ícone do card:
`MonitorPlay` (`lucide-react`, mesmo ícone da decisão de UI do aluno) no lugar de `BookOpen`.

```tsx
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, MonitorPlay, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  createSlideFn,
  deleteSlideFn,
  listMyDisciplineSlidesFn,
  updateSlideFn,
  type PresentationSlide,
} from "@/functions/presentationSlides";
import { uploadFile } from "@/lib/blobUpload";

function slidesKey(disciplineId: string) {
  return ["discipline-slides", disciplineId] as const;
}

export function SlidesTab({ disciplineId }: { disciplineId: string }) {
  const queryClient = useQueryClient();
  const { data: slides, isLoading } = useQuery({
    queryKey: slidesKey(disciplineId),
    queryFn: () => listMyDisciplineSlidesFn({ data: { disciplineId } }),
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [editSlide, setEditSlide] = useState<PresentationSlide | null>(null);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: slidesKey(disciplineId) });
  }

  const deleteMutation = useMutation({
    mutationFn: (slideId: string) => deleteSlideFn({ data: { disciplineId, slideId } }),
    onSuccess: async () => {
      toast.success("Slide removido.");
      await invalidate();
    },
    onError: () => toast.error("Não foi possível remover o slide."),
  });

  if (isLoading || !slides) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-md border border-t-2 border-border/70 border-t-border bg-card/70 p-4 shadow-soft"
          >
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Novo slide
        </Button>
      </div>

      {slides.length === 0 ? (
        <p className="rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft">
          Nenhum slide cadastrado ainda.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {slides.map((slide) => (
            <div
              key={slide.id}
              className="animate-in flex items-start gap-3 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-4 shadow-soft fade-in slide-in-from-top-1 duration-200"
            >
              <MonitorPlay className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground">{slide.title}</span>
                {slide.description ? (
                  <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
                    {slide.description}
                  </span>
                ) : null}
                <a
                  href={slide.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Download className="size-3.5 shrink-0" aria-hidden />
                  {slide.fileName}
                </a>
              </span>
              <div className="flex shrink-0 flex-col gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Editar"
                  onClick={() => setEditSlide(slide)}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Excluir"
                  onClick={() => deleteMutation.mutate(slide.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateSlideDialog
        disciplineId={disciplineId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={invalidate}
      />
      <EditSlideDialog
        disciplineId={disciplineId}
        slide={editSlide}
        onOpenChange={(open) => !open && setEditSlide(null)}
        onUpdated={invalidate}
      />
    </div>
  );
}

function EditSlideDialog({
  disciplineId,
  slide,
  onOpenChange,
  onUpdated,
}: {
  disciplineId: string;
  slide: PresentationSlide | null;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => Promise<unknown>;
}) {
  const [title, setTitle] = useState(slide?.title ?? "");
  const [description, setDescription] = useState(slide?.description ?? "");

  useEffect(() => {
    if (slide) {
      setTitle(slide.title);
      setDescription(slide.description ?? "");
    }
  }, [slide]);

  const mutation = useMutation({
    mutationFn: () =>
      updateSlideFn({
        data: {
          disciplineId,
          slideId: slide!.id,
          title,
          description: description || undefined,
        },
      }),
    onSuccess: async () => {
      toast.success("Slide atualizado.");
      onOpenChange(false);
      await onUpdated();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar."),
  });

  return (
    <Dialog open={slide !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar slide</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (title.trim().length === 0) return;
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="slide-edit-title">Título</Label>
            <Input
              id="slide-edit-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slide-edit-description">Descrição (opcional)</Label>
            <Textarea
              id="slide-edit-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateSlideDialog({
  disciplineId,
  open,
  onOpenChange,
  onCreated,
}: {
  disciplineId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<unknown>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  function reset() {
    setTitle("");
    setDescription("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Escolha um arquivo.");
      setUploading(true);
      try {
        const uploaded = await uploadFile(file, "slide");
        return createSlideFn({
          data: {
            disciplineId,
            title,
            description: description || undefined,
            fileUrl: uploaded.url,
            fileName: uploaded.fileName,
          },
        });
      } finally {
        setUploading(false);
      }
    },
    onSuccess: async () => {
      toast.success("Slide adicionado.");
      reset();
      onOpenChange(false);
      await onCreated();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível adicionar."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo slide</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (title.trim().length === 0 || !file) return;
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="slide-title">Título</Label>
            <Input
              id="slide-title"
              placeholder="Aula 1 — Introdução"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slide-description">Descrição (opcional)</Label>
            <Textarea
              id="slide-description"
              placeholder="Apresentação usada em sala…"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slide-file">Arquivo (PDF)</Label>
            <Input
              id="slide-file"
              type="file"
              ref={fileInputRef}
              accept="application/pdf,.pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending || uploading}>
              {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {uploading ? "Enviando…" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Passo 2: Adicionar a aba "Slides" em `DisciplineDetail.tsx`**

Em `src/pages/painel/DisciplineDetail.tsx`, importe `SlidesTab` e adicione o gatilho e o conteúdo
depois de "Apostila":

```tsx
import { SlidesTab } from "@/pages/painel/SlidesTab";
```

```tsx
        <TabsList>
          <TabsTrigger value="acompanhamento">Acompanhamento</TabsTrigger>
          <TabsTrigger value="frequencia">Frequência</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
          <TabsTrigger value="videos">Vídeo-aulas</TabsTrigger>
          <TabsTrigger value="apostila">Apostila</TabsTrigger>
          <TabsTrigger value="slides">Slides</TabsTrigger>
        </TabsList>
        ...
        <TabsContent value="apostila">
          <ReadingMaterialsTab disciplineId={disciplineId} />
        </TabsContent>
        <TabsContent value="slides">
          <SlidesTab disciplineId={disciplineId} />
        </TabsContent>
```

- [ ] **Passo 3: Rodar lint e typecheck**

Run: `npx eslint . && npx tsc --noEmit -p tsconfig.typecheck.json`
Expected: sem erros.

- [ ] **Passo 4: Roteiro manual (exige `npm run db:push` já rodado pelo dono do projeto)**

Run: `npm run dev`, abrir `/painel/disciplinas/<id>`, aba "Slides".
Expected: criar um slide com PDF válido funciona e aparece na grade; tentar criar com um arquivo
que não seja PDF é rejeitado antes de gravar (toast de erro); editar título/descrição reflete
na grade; apagar remove o card.

- [ ] **Passo 5: Commit**

```bash
git add src/pages/painel/SlidesTab.tsx src/pages/painel/DisciplineDetail.tsx
git commit -m "feat: adiciona aba Slides na disciplina do painel do professor"
```

---

### Tarefa A6 — Hub "Minhas Matérias"

**Arquivos:**
- Criar: `src/pages/painel/MyMaterials.tsx`
- Criar: `src/routes/painel/minhas-materias/index.tsx`
- Modificar: `src/components/painel/PainelShell.tsx`

**Interfaces:**
- Consome: `listMyMaterialsFn`, tipo `MyMaterialItem` (`@/functions/myMaterials`, Tarefa A4);
  `updateMaterialFn`/`deleteMaterialFn` (`@/functions/readingMaterials`, já existentes);
  `updateSlideFn`/`deleteSlideFn` (`@/functions/presentationSlides`, Tarefa A3).
- Produz: página `MyMaterials`, montada na rota `/painel/minhas-materias`; item novo em
  `painelNavItems`.

- [ ] **Passo 1: Criar `src/pages/painel/MyMaterials.tsx`**

Agrupa o array de `listMyMaterialsFn` por `disciplineName` (agrupamento em memória, como
`PortalMaterials.tsx` já faz por `disciplineId`) e renderiza uma seção por disciplina. Sem botão
de criar. Cada item mostra um selo (`Badge`, `@/components/ui/badge`) "Apostila" ou "Slide",
título, descrição e os botões Editar/Apagar — que chamam `updateMaterialFn`/`deleteMaterialFn` ou
`updateSlideFn`/`deleteSlideFn` conforme `item.kind`.

```tsx
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Loader2, MonitorPlay, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PainelShell } from "@/components/painel/PainelShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { listMyMaterialsFn, type MyMaterialItem } from "@/functions/myMaterials";
import { deleteMaterialFn, updateMaterialFn } from "@/functions/readingMaterials";
import { deleteSlideFn, updateSlideFn } from "@/functions/presentationSlides";

const MY_MATERIALS_KEY = ["my-materials"] as const;

function editItem(item: MyMaterialItem, title: string, description: string) {
  return item.kind === "apostila"
    ? updateMaterialFn({
        data: {
          disciplineId: item.disciplineId,
          materialId: item.id,
          title,
          description: description || undefined,
        },
      })
    : updateSlideFn({
        data: {
          disciplineId: item.disciplineId,
          slideId: item.id,
          title,
          description: description || undefined,
        },
      });
}

function deleteItem(item: MyMaterialItem) {
  return item.kind === "apostila"
    ? deleteMaterialFn({ data: { disciplineId: item.disciplineId, materialId: item.id } })
    : deleteSlideFn({ data: { disciplineId: item.disciplineId, slideId: item.id } });
}

export function MyMaterials() {
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useQuery({
    queryKey: MY_MATERIALS_KEY,
    queryFn: () => listMyMaterialsFn(),
  });
  const [editItemState, setEditItemState] = useState<MyMaterialItem | null>(null);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: MY_MATERIALS_KEY });
  }

  const deleteMutation = useMutation({
    mutationFn: (item: MyMaterialItem) => deleteItem(item),
    onSuccess: async () => {
      toast.success("Item removido.");
      await invalidate();
    },
    onError: () => toast.error("Não foi possível remover o item."),
  });

  const groups = new Map<string, Array<MyMaterialItem>>();
  for (const item of items ?? []) {
    const list = groups.get(item.disciplineName) ?? [];
    list.push(item);
    groups.set(item.disciplineName, list);
  }

  return (
    <PainelShell
      title="Minhas Matérias"
      description="Apostilas e slides de todas as suas disciplinas, num lugar só."
    >
      {isLoading || !items ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : groups.size === 0 ? (
        <p className="rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft">
          Nenhuma apostila ou slide cadastrado ainda. Adicione pela aba da disciplina.
        </p>
      ) : (
        <div className="space-y-8">
          {Array.from(groups.entries()).map(([disciplineName, disciplineItems]) => (
            <section key={disciplineName}>
              <h2 className="font-display text-lg font-semibold text-foreground">
                {disciplineName}
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {disciplineItems.map((item) => (
                  <div
                    key={`${item.kind}-${item.id}`}
                    className="animate-in flex items-start gap-3 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-4 shadow-soft fade-in slide-in-from-top-1 duration-200"
                  >
                    {item.kind === "slide" ? (
                      <MonitorPlay className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                    ) : (
                      <BookOpen className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <Badge variant="secondary" className="mb-1">
                        {item.kind === "slide" ? "Slide" : "Apostila"}
                      </Badge>
                      <span className="block truncate font-medium text-foreground">
                        {item.title}
                      </span>
                      {item.description ? (
                        <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      ) : null}
                    </span>
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        onClick={() => setEditItemState(item)}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Excluir"
                        onClick={() => deleteMutation.mutate(item)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <EditMyMaterialDialog
        item={editItemState}
        onOpenChange={(open) => !open && setEditItemState(null)}
        onUpdated={invalidate}
      />
    </PainelShell>
  );
}

function EditMyMaterialDialog({
  item,
  onOpenChange,
  onUpdated,
}: {
  item: MyMaterialItem | null;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => Promise<unknown>;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setDescription(item.description ?? "");
    }
  }, [item]);

  const mutation = useMutation({
    mutationFn: () => editItem(item!, title, description),
    onSuccess: async () => {
      toast.success("Item atualizado.");
      onOpenChange(false);
      await onUpdated();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar."),
  });

  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {item?.kind === "slide" ? "slide" : "material"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (title.trim().length === 0) return;
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="my-materials-edit-title">Título</Label>
            <Input
              id="my-materials-edit-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="my-materials-edit-description">Descrição (opcional)</Label>
            <Textarea
              id="my-materials-edit-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Passo 2: Criar a rota `src/routes/painel/minhas-materias/index.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";

import { MyMaterials } from "@/pages/painel/MyMaterials";

export const Route = createFileRoute("/painel/minhas-materias/")({
  component: MyMaterials,
});
```

- [ ] **Passo 3: Adicionar o item em `painelNavItems` (`PainelShell.tsx`)**

Importe `BookOpen` de `lucide-react` (ainda não usado em `PainelShell.tsx`) e insira o item entre
"Tarefas" e "Fórum":

```tsx
import {
  BarChart3,
  BookOpen,
  CalendarRange,
  ClipboardList,
  ...
```

```tsx
const painelNavItems = [
  { to: "/painel", label: "Painel", icon: LayoutGrid },
  { to: "/painel/agenda", label: "Agenda", icon: CalendarRange },
  { to: "/painel/professores", label: "Contas de professores", icon: Users },
  { to: "/painel/alunos", label: "Alunos", icon: GraduationCap },
  { to: "/painel/provas", label: "Provas", icon: ClipboardList },
  { to: "/painel/tarefas", label: "Tarefas", icon: ListChecks },
  { to: "/painel/minhas-materias", label: "Minhas Matérias", icon: BookOpen },
  { to: "/painel/forum", label: "Fórum", icon: MessageCircle },
  { to: "/painel/forum-interno", label: "Fórum interno", icon: MessagesSquare },
  { to: "/painel/biblioteca", label: "Biblioteca virtual", icon: Library },
  { to: "/painel/apostilas-compartilhadas", label: "Apostilas compartilhadas", icon: Share2 },
  { to: "/painel/relatorio", label: "Boletim do aluno", icon: FileText },
  { to: "/painel/relatorio-modulo", label: "Relatório por módulo", icon: Layers },
  { to: "/painel/pagamentos", label: "Pagamentos", icon: Wallet },
] as const;
```

- [ ] **Passo 4: Rodar lint, typecheck e build**

Run: `npx eslint . && npx tsc --noEmit -p tsconfig.typecheck.json && npm run build`
Expected: sem erros; o build gera a rota nova em `src/routeTree.gen.ts` automaticamente (arquivo
gerado pelo plugin do TanStack Router — não editar manualmente).

- [ ] **Passo 5: Roteiro manual (exige `npm run db:push` já rodado)**

Run: `npm run dev`, abrir `/painel/minhas-materias`.
Expected: apostilas e slides de todas as disciplinas do professor aparecem agrupados por
disciplina; editar ali reflete na aba da disciplina de origem, e vice-versa (mesma tabela); não há
botão de criar nem de compartilhar nessa tela.

- [ ] **Passo 6: Commit**

```bash
git add src/pages/painel/MyMaterials.tsx src/routes/painel/minhas-materias/index.tsx src/components/painel/PainelShell.tsx src/routeTree.gen.ts
git commit -m "feat: adiciona hub Minhas Materias no painel do professor"
```

---

## Fase B — Portal do aluno

### Tarefa B1 — Componentes base: `SlideCard` e `ContentTypeToggle`

**Arquivos:**
- Criar: `src/components/portal/SlideCard.tsx`
- Criar: `src/components/portal/ContentTypeToggle.tsx`

**Interfaces:**
- Consome: tipo `PresentationSlide` (`@/functions/presentationSlides`, Tarefa A3).
- Produz: `SlideCard({ slide: PresentationSlide })`, consumido por B2 e B4;
  `ContentTypeToggle({ active: "apostilas" | "slides" })`, consumido por B2 e pela modificação de
  `PortalMaterials.tsx` na mesma tarefa B2.

- [ ] **Passo 1: Criar `src/components/portal/SlideCard.tsx`**

Espelha `src/components/portal/ReadingMaterialCard.tsx` (leia esse arquivo antes de escrever
este) exatamente — mesmo bloqueio visual por `availableAt` — trocando o ícone por `MonitorPlay` e
o destino do link para `/portal/slides/$slideId`:

```tsx
import { Link } from "@tanstack/react-router";
import { Lock, MonitorPlay } from "lucide-react";

import type { PresentationSlide } from "@/functions/presentationSlides";

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/** Card de slide — bloqueado (sem link) se a disciplina ainda não começou. */
export function SlideCard({ slide }: { slide: PresentationSlide }) {
  const content = (
    <>
      {slide.availableAt ? (
        <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      ) : (
        <MonitorPlay className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">{slide.title}</span>
        {slide.description ? (
          <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
            {slide.description}
          </span>
        ) : null}
        {slide.availableAt ? (
          <span className="mt-2 block text-xs text-muted-foreground">
            Disponível a partir de {formatDate(slide.availableAt)}
          </span>
        ) : (
          <span className="mt-2 inline-block text-xs font-medium text-accent">Ver slides</span>
        )}
      </span>
    </>
  );

  if (slide.availableAt) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-border/70 bg-card/40 p-4 opacity-70">
        {content}
      </div>
    );
  }

  return (
    <Link
      to="/portal/slides/$slideId"
      params={{ slideId: slide.id }}
      className="flex items-start gap-3 rounded-md border border-border/70 bg-card/70 p-4 shadow-soft transition-colors hover:border-primary/50"
    >
      {content}
    </Link>
  );
}
```

- [ ] **Passo 2: Criar `src/components/portal/ContentTypeToggle.tsx`**

Duas `Link` lado a lado, estilo de pílula, a ativa destacada:

```tsx
import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

/** Alterna entre a biblioteca de apostilas e a de slides — sem estado próprio. */
export function ContentTypeToggle({ active }: { active: "apostilas" | "slides" }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/70 p-1">
      <Link
        to="/portal/apostilas"
        className={cn(
          "rounded-full px-3 py-1 text-sm font-medium transition-colors",
          active === "apostilas"
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Apostilas
      </Link>
      <Link
        to="/portal/slides"
        className={cn(
          "rounded-full px-3 py-1 text-sm font-medium transition-colors",
          active === "slides"
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Slides
      </Link>
    </div>
  );
}
```

- [ ] **Passo 3: Rodar lint e typecheck**

Run: `npx eslint . && npx tsc --noEmit -p tsconfig.typecheck.json`
Expected: erro esperado nesta etapa — `to="/portal/slides"` e `to="/portal/slides/$slideId"` ainda
não existem como rotas (nascem em B2/B3). Se o `tsc`/router tipado acusar rota inexistente,
prossiga mesmo assim: é esperado até B2/B3 existirem; confirme que o **único** tipo de erro é
"rota não encontrada" para esses dois caminhos, nenhum outro.

- [ ] **Passo 4: Commit**

```bash
git add src/components/portal/SlideCard.tsx src/components/portal/ContentTypeToggle.tsx
git commit -m "feat: adiciona SlideCard e ContentTypeToggle no portal do aluno"
```

---

### Tarefa B2 — Biblioteca `/portal/slides`

**Arquivos:**
- Criar: `src/pages/portal/PortalSlides.tsx`
- Criar: `src/routes/portal/slides/index.tsx`
- Modificar: `src/pages/portal/PortalMaterials.tsx`

**Interfaces:**
- Consome: `listAllPresentationSlidesFn` (`@/functions/presentationSlides`, Tarefa A3),
  `SlideCard`, `ContentTypeToggle` (`@/components/portal`, Tarefa B1), `getPublicDisciplinesFn`
  (`@/functions/schedule`, existente), `groupBySemester`/`semesterLabel` (`@/lib/schedule-utils`,
  existente, sem alteração).
- Produz: página `PortalSlides`, montada na rota `/portal/slides`.

- [ ] **Passo 1: Criar `src/pages/portal/PortalSlides.tsx`**

Cópia estrutural de `src/pages/portal/PortalMaterials.tsx` (leia esse arquivo antes de escrever
este), trocando `listAllReadingMaterialsFn`/`ReadingMaterial`/`ReadingMaterialCard` pelos
equivalentes de slide, e acrescentando `<ContentTypeToggle active="slides" />` logo abaixo do
título:

```tsx
import { useQuery } from "@tanstack/react-query";

import { ContentTypeToggle } from "@/components/portal/ContentTypeToggle";
import { PortalShell } from "@/components/portal/PortalShell";
import { SlideCard } from "@/components/portal/SlideCard";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicDisciplinesFn } from "@/functions/schedule";
import {
  listAllPresentationSlidesFn,
  type PresentationSlide,
} from "@/functions/presentationSlides";
import { groupBySemester, semesterLabel } from "@/lib/schedule-utils";

/** Biblioteca de slides — todas as disciplinas, agrupadas por semestre. */
export function PortalSlides() {
  const { data: disciplines, isLoading: loadingDisciplines } = useQuery({
    queryKey: ["public-disciplines"],
    queryFn: () => getPublicDisciplinesFn(),
  });
  const { data: slides, isLoading: loadingSlides } = useQuery({
    queryKey: ["all-presentation-slides"],
    queryFn: () => listAllPresentationSlidesFn(),
  });

  const isLoading = loadingDisciplines || loadingSlides;
  const slidesByDiscipline = new Map<string, Array<PresentationSlide>>();
  for (const slide of slides ?? []) {
    const list = slidesByDiscipline.get(slide.disciplineId) ?? [];
    list.push(slide);
    slidesByDiscipline.set(slide.disciplineId, list);
  }

  const disciplinesWithSlides = (disciplines ?? []).filter((d) => slidesByDiscipline.has(d.id));
  const semesters = groupBySemester(disciplinesWithSlides);

  return (
    <PortalShell
      title="Slides"
      description="Apresentações disponibilizadas pelos professores em cada disciplina."
    >
      <ContentTypeToggle active="slides" />

      {isLoading ? (
        <div className="mt-8 space-y-10">
          {Array.from({ length: 2 }).map((_, sectionIndex) => (
            <div key={sectionIndex}>
              <Skeleton className="h-5 w-32" />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 2 }).map((_, cardIndex) => (
                  <Skeleton key={cardIndex} className="h-16 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : semesters.length === 0 ? (
        <p className="animate-in mt-8 rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft fade-in zoom-in-95 duration-300">
          Nenhum slide disponível no momento.
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          {semesters.map((semester) => (
            <section key={semester.semester}>
              <h2 className="font-display text-lg font-semibold text-foreground">
                {semesterLabel(semester.semester)}
              </h2>
              <div className="mt-4 space-y-8">
                {semester.modules.flatMap((module) =>
                  module.disciplines.map((discipline) => {
                    const disciplineSlides = slidesByDiscipline.get(discipline.id) ?? [];
                    return (
                      <div key={discipline.id}>
                        <h3 className="text-base font-semibold text-foreground">
                          {discipline.discipline}
                        </h3>
                        {discipline.teacher ? (
                          <p className="text-sm text-muted-foreground">{discipline.teacher}</p>
                        ) : null}
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {disciplineSlides.map((slide) => (
                            <div
                              key={slide.id}
                              className="animate-in fade-in slide-in-from-top-1 duration-200"
                            >
                              <SlideCard slide={slide} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }),
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
```

- [ ] **Passo 2: Criar a rota `src/routes/portal/slides/index.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";

import { PortalSlides } from "@/pages/portal/PortalSlides";

export const Route = createFileRoute("/portal/slides/")({
  head: () => ({
    meta: [{ title: "Slides — Seminário Huguenotes" }],
  }),
  component: PortalSlides,
});
```

- [ ] **Passo 3: Acrescentar o toggle em `PortalMaterials.tsx`**

Em `src/pages/portal/PortalMaterials.tsx`, importe `ContentTypeToggle` e insira
`<ContentTypeToggle active="apostilas" />` logo depois de abrir `<PortalShell>`, antes do bloco
`isLoading ? (...)`, envolvendo o restante do conteúdo do jeito que foi feito em `PortalSlides`
acima (mesmo `mt-8` nos três ramos condicionais, pra manter o espaçamento com o toggle).

- [ ] **Passo 4: Rodar lint, typecheck e build**

Run: `npx eslint . && npx tsc --noEmit -p tsconfig.typecheck.json && npm run build`
Expected: sem erros. Confirme que `src/routeTree.gen.ts` foi regenerado com a rota
`/portal/slides/`.

- [ ] **Passo 5: Commit**

```bash
git add src/pages/portal/PortalSlides.tsx src/routes/portal/slides/index.tsx src/pages/portal/PortalMaterials.tsx src/routeTree.gen.ts
git commit -m "feat: adiciona biblioteca de slides no portal do aluno"
```

---

### Tarefa B3 — Leitor `/portal/slides/$slideId` (react-pdf)

**Arquivos:**
- Modificar: `package.json` (adicionar dependência `react-pdf`)
- Criar: `src/pages/portal/PortalSlideReader.tsx`
- Criar: `src/routes/portal/slides/$slideId.tsx`

**Interfaces:**
- Consome: `listAllPresentationSlidesFn` (`@/functions/presentationSlides`, Tarefa A3); biblioteca
  `react-pdf` (`Document`, `Page`, `pdfjs`).
- Produz: página `PortalSlideReader({ slideId: string })`, montada na rota
  `/portal/slides/$slideId`.

- [ ] **Passo 1: Instalar `react-pdf`**

Run: `npm install react-pdf@^10.5.0`
Expected: `package.json` ganha `"react-pdf": "^10.5.0"` em `dependencies`; `package-lock.json`
atualizado. Não instale nenhuma outra versão — a `^10.5.0` é a fixada pelo spec, com peer deps
compatíveis com React 19.2.

- [ ] **Passo 2: Criar `src/pages/portal/PortalSlideReader.tsx`**

Estrutura de tela igual a `src/pages/portal/PortalMaterialReader.tsx` (leia esse arquivo antes de
escrever este) — link "Voltar", `PortalShell fullWidth`, mesmo tratamento de "ainda não
disponível" com `Lock` — mas o miolo troca o `<iframe>` por um leitor `react-pdf` com navegação
página-a-página, contador, teclado e tela cheia:

```tsx
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Lock,
  Maximize,
  Minimize,
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";

import { Button } from "@/components/ui/button";
import { PortalShell } from "@/components/portal/PortalShell";
import { Skeleton } from "@/components/ui/skeleton";
import { listAllPresentationSlidesFn } from "@/functions/presentationSlides";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/** Leitor de slide — página a página, controlado pela nossa UI (nunca pelo iframe do visualizador). */
export function PortalSlideReader({ slideId }: { slideId: string }) {
  const { data: slides, isLoading } = useQuery({
    queryKey: ["all-presentation-slides"],
    queryFn: () => listAllPresentationSlidesFn(),
  });

  const slide = slides?.find((s) => s.id === slideId);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [current, setCurrent] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [documentKey, setDocumentKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(Math.min(width, 1280));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement !== null);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") setCurrent((page) => Math.max(1, page - 1));
      if (event.key === "ArrowRight") setCurrent((page) => Math.min(numPages, page + 1));
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [numPages]);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (containerRef.current) {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  }

  return (
    <PortalShell title={slide?.title ?? (isLoading ? "Carregando…" : "Slide")} fullWidth>
      <Link
        to="/portal/slides"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-4 shrink-0" aria-hidden />
        Voltar pros slides
      </Link>

      {isLoading ? (
        <Skeleton className="h-[85vh] w-full" />
      ) : !slide ? (
        <div className="animate-in flex h-[50vh] flex-col items-center justify-center gap-3 rounded-md border border-border/70 bg-card/70 text-center shadow-soft fade-in zoom-in-95 duration-300">
          <p className="text-muted-foreground">Este slide não foi encontrado.</p>
          <Link to="/portal/slides" className="text-sm font-medium text-accent hover:underline">
            Voltar pros slides
          </Link>
        </div>
      ) : slide.availableAt ? (
        <div className="animate-in flex h-[50vh] flex-col items-center justify-center gap-3 rounded-md border border-border/70 bg-card/70 text-center shadow-soft fade-in zoom-in-95 duration-300">
          <Lock className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-muted-foreground">
            Esses slides ficam disponíveis a partir de {formatDate(slide.availableAt)}.
          </p>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="animate-in mx-auto flex max-w-7xl flex-col items-center gap-4 rounded-md border border-border/70 bg-card/70 p-4 shadow-soft fade-in duration-300"
        >
          {loadError ? (
            <div className="flex h-[70vh] flex-col items-center justify-center gap-3 text-center">
              <AlertTriangle className="size-8 text-muted-foreground" aria-hidden />
              <p className="text-muted-foreground">Não foi possível carregar este slide.</p>
              <Button
                variant="outline"
                onClick={() => {
                  setLoadError(false);
                  setDocumentKey((key) => key + 1);
                }}
              >
                Tentar de novo
              </Button>
            </div>
          ) : (
            <Document
              key={documentKey}
              file={slide.fileUrl}
              onLoadSuccess={({ numPages: total }) => {
                setNumPages(total);
                setCurrent(1);
              }}
              onLoadError={() => setLoadError(true)}
              loading={<Skeleton className="h-[70vh] w-full" />}
            >
              <Page pageNumber={current} width={containerWidth || undefined} />
            </Document>
          )}

          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              disabled={current === 1}
              onClick={() => setCurrent((page) => Math.max(1, page - 1))}
              title="Anterior"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <span className="text-sm text-muted-foreground">
              Slide {current} de {numPages || "…"}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={current === numPages}
              onClick={() => setCurrent((page) => Math.min(numPages, page + 1))}
              title="Próximo"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Button>
            <Button variant="outline" size="icon" onClick={toggleFullscreen} title="Tela cheia">
              {isFullscreen ? (
                <Minimize className="size-4" aria-hidden />
              ) : (
                <Maximize className="size-4" aria-hidden />
              )}
            </Button>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
```

- [ ] **Passo 3: Criar a rota `src/routes/portal/slides/$slideId.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";

import { PortalSlideReader } from "@/pages/portal/PortalSlideReader";

export const Route = createFileRoute("/portal/slides/$slideId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { slideId } = Route.useParams();
  return <PortalSlideReader slideId={slideId} />;
}
```

- [ ] **Passo 4: Rodar lint, typecheck e build**

Run: `npx eslint . && npx tsc --noEmit -p tsconfig.typecheck.json && npm run build`
Expected: sem erros — `npm run build` é o portão real de que a resolução do worker do pdf.js
(`new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)`) funciona no bundle de
produção, não só em dev. Se o build falhar especificamente na resolução do worker, confira que a
versão instalada é mesmo `^10.5.0` (`react-pdf` reexporta `pdfjs-dist` como dependência, então o
caminho do pacote precisa existir em `node_modules/pdfjs-dist`).

- [ ] **Passo 5: Roteiro manual (exige `npm run db:push` já rodado, e pelo menos um slide
  cadastrado via A5)**

Run: `npm run dev`, abrir um slide a partir de `/portal/slides`.
Expected: abre no slide 1; botões anterior/próximo navegam e desabilitam nas pontas; setas do
teclado também navegam; contador "Slide X de Y" correto; botão de tela cheia entra e sai;
abrir um slide de disciplina ainda não iniciada mostra o cadeado, não o leitor.

- [ ] **Passo 6: Commit**

```bash
git add package.json package-lock.json src/pages/portal/PortalSlideReader.tsx src/routes/portal/slides/\$slideId.tsx
git commit -m "feat: adiciona leitor de slides pagina-a-pagina com react-pdf"
```

---

### Tarefa B4 — Aba "Slides" na disciplina do portal

**Arquivos:**
- Criar: `src/pages/portal/discipline/DisciplineSlidesTab.tsx`
- Modificar: `src/pages/portal/PortalDisciplineDetail.tsx`

**Interfaces:**
- Consome: `listDisciplinePresentationSlidesFn` (`@/functions/presentationSlides`, Tarefa A3),
  `SlideCard` (`@/components/portal/SlideCard`, Tarefa B1).
- Produz: `DisciplineSlidesTab({ disciplineId }: { disciplineId: string })`, montado na aba
  "Slides" de `PortalDisciplineDetail.tsx`.

- [ ] **Passo 1: Criar `src/pages/portal/discipline/DisciplineSlidesTab.tsx`**

Cópia estrutural de `src/pages/portal/discipline/DisciplineMaterialsTab.tsx` (leia esse arquivo
antes de escrever este), trocando `listDisciplineMaterialsFn` por
`listDisciplinePresentationSlidesFn` e `ReadingMaterialCard` por `SlideCard`:

```tsx
import { useQuery } from "@tanstack/react-query";

import { SlideCard } from "@/components/portal/SlideCard";
import { Skeleton } from "@/components/ui/skeleton";
import { listDisciplinePresentationSlidesFn } from "@/functions/presentationSlides";

export function DisciplineSlidesTab({ disciplineId }: { disciplineId: string }) {
  const { data: slides, isLoading } = useQuery({
    queryKey: ["discipline-slides", disciplineId],
    queryFn: () => listDisciplinePresentationSlidesFn({ data: { disciplineId } }),
  });

  if (isLoading || !slides) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <p className="animate-in rounded-md border border-border/70 bg-card/70 p-6 text-center text-muted-foreground shadow-soft fade-in zoom-in-95 duration-300">
        Nenhum slide cadastrado ainda.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {slides.map((slide) => (
        <div key={slide.id} className="animate-in fade-in slide-in-from-top-1 duration-200">
          <SlideCard slide={slide} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Passo 2: Adicionar a aba "Slides" em `PortalDisciplineDetail.tsx`**

```tsx
import { DisciplineSlidesTab } from "@/pages/portal/discipline/DisciplineSlidesTab";
```

```tsx
          <TabsList>
            <TabsTrigger value="aulas">Aulas</TabsTrigger>
            <TabsTrigger value="apostila">Apostila</TabsTrigger>
            <TabsTrigger value="slides">Slides</TabsTrigger>
            <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
            ...
          </TabsList>
        ...
        <TabsContent value="apostila">
          <DisciplineMaterialsTab disciplineId={disciplineId} />
        </TabsContent>
        <TabsContent value="slides">
          <DisciplineSlidesTab disciplineId={disciplineId} />
        </TabsContent>
```

- [ ] **Passo 3: Rodar lint, typecheck e build**

Run: `npx eslint . && npx tsc --noEmit -p tsconfig.typecheck.json && npm run build`
Expected: sem erros.

- [ ] **Passo 4: Roteiro manual (exige `npm run db:push` já rodado, e pelo menos um slide
  cadastrado via A5)**

Run: `npm run dev`, abrir `/portal/disciplinas/<id>`, aba "Slides".
Expected: lista só os slides daquela disciplina, mesmo comportamento visual da aba "Apostila" ao
lado (cadeado se a disciplina ainda não começou).

- [ ] **Passo 5: Commit**

```bash
git add src/pages/portal/discipline/DisciplineSlidesTab.tsx src/pages/portal/PortalDisciplineDetail.tsx
git commit -m "feat: adiciona aba Slides na disciplina do portal do aluno"
```

---

## Roteiro manual de fim de plano

Depois de A1-A6 e B1-B4 completas (e com `npm run db:push` já rodado pelo dono do projeto), repita
o roteiro completo descrito na seção "Estratégia de testes" do spec, de ponta a ponta:

1. **Painel**: aba "Slides" de uma disciplina — criar slide com PDF válido; tentar criar com
   `.pptx` (rejeitado antes de gravar); editar título/descrição; apagar.
2. **Minhas Matérias**: `/painel/minhas-materias` mostra apostilas e slides de todas as
   disciplinas do professor, agrupados por disciplina; editar ali reflete na aba da disciplina de
   origem e vice-versa.
3. **Portal — biblioteca de slides**: `/portal/apostilas` mostra o link para `/portal/slides`; lá,
   slides aparecem agrupados por semestre/disciplina, com cadeado nos de disciplina ainda não
   iniciada.
4. **Portal — leitor**: abrir um slide; navegar com botões e setas do teclado; conferir contador
   "X de Y"; entrar/sair da tela cheia; abrir um slide de disciplina bloqueada (mostra cadeado, não
   o leitor).
5. **Portal — aba da disciplina**: a aba "Slides" dentro de uma disciplina no portal lista só os
   slides daquela disciplina.

`npx eslint .`, `npx tsc --noEmit -p tsconfig.typecheck.json` e `npm run build` devem estar limpos
antes de abrir o PR, conforme [CONTRIBUTING.md](../../../CONTRIBUTING.md) — issue no GitHub
(rótulo `enhancement`) antes de começar, branch a partir da `main`
(`feat/slides-e-minhas-materias`), PR com `Closes #<número>`, merge disparando o deploy. Nada
commitado direto na `main`.
