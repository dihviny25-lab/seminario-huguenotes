# Slides e hub "Minhas Matérias" no painel do professor — design

Data: 2026-09-04
Status: aprovado (sessão de brainstorming com o dono do produto)

## Contexto e motivação

Hoje, apostila (`reading_materials`) é o único tipo de "material de leitura" do sistema, e
só existe em dois lugares: dentro da aba **Apostila** de cada disciplina no painel do
professor (`src/pages/painel/ReadingMaterialsTab.tsx`, dentro de
`src/pages/painel/DisciplineDetail.tsx`, rota `/painel/disciplinas/$disciplineId`) e nas
telas equivalentes do portal do aluno. Não existe nenhuma tela agregada onde um professor
veja, de uma vez, todo o conteúdo que publicou em todas as disciplinas que leciona — pra
ver ou editar uma apostila ele precisa lembrar em qual disciplina ela está e abrir a aba de
lá.

O CRUD de apostila vive em `src/functions/readingMaterials.ts`
(`listMyDisciplineMaterialsFn`, `createMaterialFn`, `updateMaterialFn` — só título/descrição,
nunca troca o arquivo —, `deleteMaterialFn`), sempre atrás de `requireOwnDiscipline`
(`src/server/auth/guard.ts`), que confirma que a disciplina pertence ao professor logado. O
upload usa `uploadFile` (`src/lib/blobUpload.ts`, Vercel Blob) com `purpose: "material"`,
cuja política (`src/server/uploads/policy.ts`) aceita PDF, Word, PowerPoint e imagem, até
100 MB, e exige professor autenticado. A tabela `reading_materials`
(`src/server/db/schema.ts`) não tem coluna de dono própria — quem publicou é sempre inferido
via `disciplines.teacherId` — e não persiste data de liberação: `availableAt` é calculado em
runtime, comparando `disciplines.startDate` com a data de hoje (`withAvailability()` em
`readingMaterials.ts`).

O visualizador atual (`src/lib/documentViewer.ts`, `getEmbeddableViewerUrl`) embute PDF
direto num `<iframe>` e passa Word/PowerPoint pelo Google Docs Viewer — em ambos os casos é
rolagem contínua, sem noção de "página atual" nem navegação própria. Ele é usado em
`PortalMaterialReader.tsx`, `PortalLibraryReader.tsx` e `SharedMaterialReader.tsx`. Esse
modo de leitura funciona bem pra apostila (texto corrido), mas não serve pra apresentação de
slides, onde o professor quer que o aluno veja "um slide de cada vez", como numa
apresentação — e não role um PDF na horizontal simulando slides.

O padrão mais próximo de "outro tipo de conteúdo por disciplina, com tabela própria, ao lado
de apostila" é vídeo-aula (`videoLessons`, schema com `disciplineId` e `sequence`, funções em
`src/functions/videoLessons.ts`, aba própria em `DisciplineDetail.tsx` — mas sem `update`,
só `create`/`delete`). Este design usa esse precedente e o de apostila como referência de
convenção; nenhum dos dois é modificado além do necessário para acomodar a nova aba.

Não existe hoje, no projeto, nenhuma tabela, função de servidor ou componente de "slide" ou
"apresentação" — é 100% novo. Também não existe nenhuma lib de renderização de PDF
página-a-página no cliente (a única lib de PDF instalada, `@react-pdf/renderer`, **gera**
PDF no servidor para boletins/recibos — não serve para ler PDF no navegador).

## Objetivo

1. Dar ao professor um hub **Minhas Matérias**, agregando apostilas e slides de todas as
   disciplinas que leciona, num lugar só, com edição inline.
2. Introduzir **slides** como um segundo tipo de conteúdo publicável por disciplina, com
   leitura página-a-página de verdade (não rolagem contínua) — aceitando só PDF.
3. Levar essa mesma leitura de slides para o portal do aluno: uma página agregada
   (`/portal/slides`) e uma aba dentro de cada disciplina, espelhando como apostila já
   funciona hoje.

## Decisões tomadas no brainstorming (vinculantes)

| # | Decisão |
|---|---------|
| 1 | Slides usam navegação página a página real: botão anterior/próximo, contador "X de Y", opção de tela cheia — tudo controlado pela nossa própria UI, nunca pelo iframe do Google Docs Viewer. |
| 2 | Slides aceitam **só PDF**. O professor exporta a apresentação como PDF antes de subir; converter `.pptx` no servidor foi descartado por complexidade/custo. |
| 3 | "Minhas Matérias" é um **hub único** (apostilas + slides, agrupado por disciplina, edição inline), sem criação — a criação continua só dentro da aba da disciplina. Item novo em `painelNavItems`, rota nova. |
| 4 | Criação de slide acontece **só dentro da aba da disciplina** (nova aba "Slides" em `DisciplineDetail.tsx`, ao lado de "Apostila" e "Vídeo-aulas") — cria/edita/apaga lá; "Minhas Matérias" só agrega leitura+edição. |
| 5 | No portal do aluno, Slides tem rota própria (`/portal/slides`, análoga a `/portal/apostilas`), agrupada por disciplina do mesmo jeito que apostilas — acessível por um link a partir da tela de Apostilas, **sem** item novo na sidebar do aluno (que já tem 12 itens). Também existe a versão "dentro da aba da disciplina" (`DisciplineSlidesTab.tsx`, espelhando `DisciplineMaterialsTab.tsx`). |
| 6 | O leitor de slide usa a lib **`react-pdf`** (wrapper de pdf.js) — nova dependência. Renderiza uma página do PDF por vez, com anterior/próximo, contador e tela cheia (Fullscreen API). **Não confundir** com `@react-pdf/renderer`, já instalado, que gera PDF no servidor. |
| 7 | Fora de escopo, explicitamente: compartilhamento entre professores e comentários (o que apostila ganhou na Fase 7); trocar o arquivo depois de enviado (só título/descrição, igual apostila); salvar em qual slide o aluno parou (sempre abre no slide 1); conversão de `.pptx` no servidor. |

## Decisões de baixo nível (tomadas nesta spec, seguindo convenções já existentes no projeto)

Nenhuma delas foi discutida explicitamente no brainstorming; são escolhas de implementação
necessárias para o design fechar, feitas seguindo o padrão do restante do código.

| # | Decisão |
|---|---------|
| A | Tabela própria `presentation_slides` (Drizzle: `presentationSlides`), com as mesmas colunas de `reading_materials` (sem coluna de dono própria — dono via `disciplines.teacherId`, mesmo padrão). Precedente: `videoLessons` também é tabela própria ao lado de `readingMaterials`. |
| B | Novo arquivo `src/functions/presentationSlides.ts`, espelhando `readingMaterials.ts` função por função (mesmos nomes, trocando "Material" por "Slide"). |
| C | Novo `UploadPurpose` `"slide"` em `src/lib/blobUpload.ts` e `src/server/uploads/policy.ts`, com política própria: só `application/pdf`, até **100 MB** (mesmo teto de `"material"` — um PDF de slides exportado tende a ser mais leve que um PDF de apostila com texto e imagens, mas não há motivo pra teto diferente). |
| D | Agregação do hub "Minhas Matérias" fica num arquivo novo, `src/functions/myMaterials.ts` (não cabe nem em `readingMaterials.ts` nem em `presentationSlides.ts`, já que cruza os dois e cruza todas as disciplinas do professor — nenhum dos dois arquivos hoje faz isso). |
| E | Rota do hub: `/painel/minhas-materias` (`src/routes/painel/minhas-materias/index.tsx`), item novo em `painelNavItems` (`src/components/painel/PainelShell.tsx`) rotulado **"Minhas Matérias"**, ícone `BookOpen` (ainda não usado em nenhum item de navegação do painel), posicionado logo depois de "Tarefas" e antes de "Fórum" — agrupa com os outros itens de "conteúdo que o professor gerencia por disciplina" (Provas, Tarefas) antes dos itens de discussão/biblioteca. |
| F | Rotas do portal do aluno: `/portal/slides` (`src/routes/portal/slides/index.tsx`) e `/portal/slides/$slideId` (`src/routes/portal/slides/$slideId.tsx`), espelhando exatamente `/portal/apostilas` e `/portal/apostilas/$materialId`. |
| G | O "link a partir da tela de Apostilas" da decisão 5 é um par de abas de navegação simples (não o componente `Tabs` do shadcn, que troca conteúdo em memória — aqui são duas rotas de verdade) no topo de `PortalMaterials.tsx` e `PortalSlides.tsx`: "Apostilas" / "Slides", a atual destacada. Componente novo `src/components/portal/ContentTypeToggle.tsx`. |
| H | `react-pdf` entra fixado como `"react-pdf": "^10.5.0"` (versão estável atual, com peer deps compatíveis com React 19.2, que é o que o projeto usa). O worker do pdf.js é resolvido com `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)`, o padrão recomendado pela própria `react-pdf` para bundlers Vite — sem copiar o worker manualmente para `public/`. |
| I | Validação de que o arquivo de slide é PDF acontece em duas camadas: o `<input type="file" accept="application/pdf,.pdf">` no formulário, e a política de upload (camada real, obrigatória — `allowedContentTypes: ["application/pdf"]` em `getUploadPolicy("slide")`, que o Vercel Blob valida antes de aceitar o arquivo). `createSlideFn` adiciona uma terceira camada barata, validando com Zod que `fileName` termina em `.pdf` (case-insensitive) — defesa extra contra um cliente adulterado que chame a função direto com uma URL/nome de arquivo que não passou pelo upload. |

## Convenções seguidas

- Lógica de servidor em `src/functions/`, sempre atrás de `requireOwnDiscipline` (professor
  dono) ou `requireAnyLogin` (leitura por aluno/professor), como em `readingMaterials.ts` e
  `videoLessons.ts`.
- UI, mensagens de erro e comentários em português. Componentes de `src/components/ui`
  (shadcn/Radix); ícones `lucide-react`. Toast via `sonner`. Motion conforme `MOTION.md`.
- `sequence` calculado como `max(sequence existente) + 1` na criação, como em
  `readingMaterials.ts`/`videoLessons.ts` — sem reordenar depois.
- `logAudit` com o padrão `"<domínio>.<ação>"` já usado (`"apostila.criar"`,
  `"video.apagar"`) — aqui, `"slide.criar"`, `"slide.editar"`, `"slide.apagar"`.
- Sem framework de teste novo obrigatório nesta fase do projeto — verificação via
  `npx eslint .`, `npx tsc --noEmit -p tsconfig.typecheck.json` e `npm run build`.

## Arquitetura

### Modelo de dados

Nova tabela em `src/server/db/schema.ts`, logo depois do bloco de `readingMaterials` +
`readingMaterialShares` + `readingMaterialComments` (o compartilhamento entre professores é
exclusivo de apostila — a tabela de slide não entra no meio desse bloco) e antes de
`assignments`, com exatamente as mesmas colunas de `reading_materials` (dono inferido via
`disciplines.teacherId`, sem `availableAt` persistido — calculado em runtime igual apostila):

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

Aplicada com `npm run db:push` (Drizzle Kit, sem sistema de migração versionada neste
projeto — mesmo fluxo usado para todas as tabelas existentes). Nenhuma tabela existente
muda de forma.

### Fase A — Painel do professor

#### Funções de servidor

`src/functions/presentationSlides.ts` (novo arquivo, espelha `readingMaterials.ts`):

| Função | Método | Guarda | Faz |
|---|---|---|---|
| `listMyDisciplineSlidesFn` | GET | `requireOwnDiscipline(disciplineId)` | Lista slides de uma disciplina, ordenados por `sequence`, para a aba "Slides" e para o hub. |
| `createSlideFn` | POST | `requireOwnDiscipline(disciplineId)` | Valida `fileName` termina em `.pdf` (Zod `refine`); insere com `sequence = max + 1`; `logAudit("slide.criar", ...)`. |
| `updateSlideFn` | POST | `requireOwnDiscipline(disciplineId)` | Atualiza só `title`/`description` (nunca o arquivo) — mesmo contrato de `updateMaterialFn`; `logAudit("slide.editar", ...)`. |
| `deleteSlideFn` | POST | `requireOwnDiscipline(disciplineId)` | Apaga o registro; `logAudit("slide.apagar", ...)`. Não apaga o blob no Vercel Blob (mesmo comportamento de `deleteMaterialFn` hoje). |
| `listAllPresentationSlidesFn` | GET | `requireAnyLogin()` | Todos os slides do currículo com `availableAt` calculado — biblioteca do portal do aluno (Fase B). |
| `listDisciplinePresentationSlidesFn` | GET | `requireAnyLogin()` | Slides de uma disciplina com `availableAt` — aba da disciplina no portal (Fase B). |

Tipo exportado `PresentationSlide` — mesmo shape de `ReadingMaterial`
(`{ id, disciplineId, title, description, fileUrl, fileName, sequence, availableAt }`).

`src/functions/myMaterials.ts` (novo arquivo — o hub):

```ts
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

export const listMyMaterialsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<MyMaterialItem>> => { ... },
);
```

`listMyMaterialsFn` chama `requireTeacherId()` uma vez e faz duas consultas em paralelo
(`Promise.all`), cada uma com `innerJoin(disciplines)` filtrando
`eq(disciplines.teacherId, teacherId)` — o mesmo filtro que `listMyDisciplinesFn`
(`src/functions/disciplines.ts`) já usa —, uma em `readingMaterials` marcando
`kind: "apostila"` e outra em `presentationSlides` marcando `kind: "slide"`; concatena e
devolve. **Não** define funções de update/delete próprias: a edição inline no hub chama
`updateMaterialFn`/`deleteMaterialFn` ou `updateSlideFn`/`deleteSlideFn` conforme o `kind`
do item clicado — ambas já são gated por `requireOwnDiscipline`, então o hub não precisa
reimplementar a checagem de dono.

#### Upload e política de arquivo

`src/lib/blobUpload.ts`: `UploadPurpose` ganha `"slide"`.

`src/server/uploads/policy.ts`: `parseUploadPurpose` passa a aceitar `"slide"`; novo caso em
`getUploadPolicy`:

```ts
case "slide":
  return {
    requiresTeacher: true,
    allowedContentTypes: ["application/pdf"],
    maximumSizeInBytes: 100 * MB,
  };
```

`src/routes/api/blob/upload.tsx` não muda — já é genérico por `purpose`.

#### Componentes de UI

**Aba "Slides" na disciplina** — `src/pages/painel/SlidesTab.tsx` (novo), estrutural e
visualmente igual a `ReadingMaterialsTab.tsx`: grade de cards com criar/editar/apagar,
diálogo de criação com campo de arquivo (`accept="application/pdf,.pdf"`, um único arquivo),
diálogo de edição só com título/descrição. Diferença: **sem** botão/coluna de compartilhar
(nenhum ícone `Share2`, nenhum `ShareSlideDialog`) — decisão 7. `DisciplineDetail.tsx` ganha
a aba, depois de "Apostila":

```tsx
<TabsList>
  ...
  <TabsTrigger value="apostila">Apostila</TabsTrigger>
  <TabsTrigger value="slides">Slides</TabsTrigger>
</TabsList>
...
<TabsContent value="slides">
  <SlidesTab disciplineId={disciplineId} />
</TabsContent>
```

**Hub "Minhas Matérias"** — `src/pages/painel/MyMaterials.tsx` (novo), rota
`src/routes/painel/minhas-materias/index.tsx` → `/painel/minhas-materias` (mesmo padrão de
arquivo de rota que `apostilas-compartilhadas/index.tsx`). Usa `listMyMaterialsFn`, agrupa
o array retornado por `disciplineName` (agrupamento em memória, como `PortalMaterials.tsx`
já faz por `disciplineId`) e renderiza uma seção por disciplina; cada item mostra um selo
"Apostila" ou "Slide" (badge), o título, e os botões Editar/Apagar já existentes — clicar em
Editar abre o mesmo diálogo de edição de `ReadingMaterialsTab.tsx`/`SlidesTab.tsx`
(extraído, se necessário, para ser reutilizável pelos dois; ou reimplementado localmente com
o mesmo formato — decisão de código, não de design). Sem botão "Novo material" nem "Novo
slide" nessa tela (decisão 3/4). `PainelShell.tsx`:

```ts
const painelNavItems = [
  { to: "/painel", label: "Painel", icon: LayoutGrid },
  { to: "/painel/agenda", label: "Agenda", icon: CalendarRange },
  { to: "/painel/professores", label: "Contas de professores", icon: Users },
  { to: "/painel/alunos", label: "Alunos", icon: GraduationCap },
  { to: "/painel/provas", label: "Provas", icon: ClipboardList },
  { to: "/painel/tarefas", label: "Tarefas", icon: ListChecks },
  { to: "/painel/minhas-materias", label: "Minhas Matérias", icon: BookOpen }, // novo
  { to: "/painel/forum", label: "Fórum", icon: MessageCircle },
  ...
] as const;
```

### Fase B — Portal do aluno

#### Componentes de UI

**`src/components/portal/SlideCard.tsx`** (novo) — espelha `ReadingMaterialCard.tsx`
exatamente (mesmo bloqueio visual por `availableAt`, mesmo ícone trocado por algo do tipo
apresentação — `MonitorPlay`, `lucide-react`), com `Link to="/portal/slides/$slideId"`.

**`src/pages/portal/PortalSlides.tsx`** (novo), rota `src/routes/portal/slides/index.tsx` →
`/portal/slides` — cópia estrutural de `PortalMaterials.tsx`: usa `listAllPresentationSlidesFn`
e `getPublicDisciplinesFn`, agrupa com `groupBySemester`/`semesterLabel` de
`src/lib/schedule-utils.ts` (mesma função, sem alteração), renderiza `SlideCard` em vez de
`ReadingMaterialCard`. Ganha `<ContentTypeToggle active="slides" />` logo abaixo do título.
`PortalMaterials.tsx` ganha o mesmo componente com `active="apostilas"`.

`src/components/portal/ContentTypeToggle.tsx` (novo) — duas `Link` lado a lado
(`/portal/apostilas` e `/portal/slides`), estilo de pílula, a ativa destacada com
`bg-accent`/`text-accent-foreground`, a inativa em `text-muted-foreground` com hover —
componente pequeno e sem estado, só recebe `active: "apostilas" | "slides"`.

**`src/pages/portal/PortalSlideReader.tsx`** (novo), rota
`src/routes/portal/slides/$slideId.tsx` → `/portal/slides/$slideId`. Estrutura de tela igual
a `PortalMaterialReader.tsx` (link "Voltar", `PortalShell fullWidth`, mesmo tratamento de
"ainda não disponível" com `Lock`), mas o miolo troca o `<iframe>` por um leitor `react-pdf`:

```tsx
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();
```

- `<Document file={slide.fileUrl} onLoadSuccess={({ numPages }) => setNumPages(numPages)} onLoadError={...} loading={<Skeleton className="h-[85vh] w-full" />}>` envolvendo `<Page pageNumber={current} width={containerWidth} />`.
- Estado local: `current` (1-indexado, sempre começa em `1` — decisão 7, sem retomar de
  onde parou), `numPages`.
- Barra de controles fixa abaixo do slide: botão "Anterior" (`ChevronLeft`, desabilitado em
  `current === 1`), texto "Slide {current} de {numPages}", botão "Próximo" (`ChevronRight`,
  desabilitado em `current === numPages`), botão de tela cheia (`Maximize`/`Minimize`
  alternando conforme `document.fullscreenElement`, chamando
  `containerRef.current.requestFullscreen()` / `document.exitFullscreen()` — Fullscreen API
  nativa, sem lib).
- Setas do teclado (`ArrowLeft`/`ArrowRight`) também navegam, como reforço da "navegação
  página a página real" da decisão 1 — ouvidas num `useEffect` com `window.addEventListener`,
  desligado no unmount.
- `containerWidth` acompanha a largura do container via `ResizeObserver` (padrão recomendado
  pela própria `react-pdf` para paginação responsiva), com um teto (`max-width` do container,
  mesmo `max-w-7xl` do `fullWidth` do `PortalShell`) para não esticar demais em telas largas.

**`src/pages/portal/discipline/DisciplineSlidesTab.tsx`** (novo) — cópia estrutural de
`DisciplineMaterialsTab.tsx`, trocando `listDisciplineMaterialsFn` por
`listDisciplinePresentationSlidesFn` e `ReadingMaterialCard` por `SlideCard`.
`PortalDisciplineDetail.tsx` ganha a aba, depois de "Apostila":

```tsx
<TabsTrigger value="apostila">Apostila</TabsTrigger>
<TabsTrigger value="slides">Slides</TabsTrigger>
...
<TabsContent value="apostila">
  <DisciplineMaterialsTab disciplineId={disciplineId} />
</TabsContent>
<TabsContent value="slides">
  <DisciplineSlidesTab disciplineId={disciplineId} />
</TabsContent>
```

`src/components/portal/PortalShell.tsx` (`portalNavItems`) **não muda** — decisão 5.

## Fluxo de dados

```
Professor (aba "Slides" da disciplina)
  │  upload PDF ──> uploadFile(file, "slide") ──> Vercel Blob
  │                    (política: só application/pdf, até 100 MB)
  ▼
createSlideFn({ disciplineId, title, description?, fileUrl, fileName })
  │  requireOwnDiscipline + valida fileName termina em .pdf
  ▼
presentation_slides (tabela nova)
  │
  ├──> listMyDisciplineSlidesFn ──> SlidesTab (aba da disciplina, professor)
  │
  ├──> listMyMaterialsFn (junto com reading_materials, filtrado por
  │       disciplines.teacherId) ──> MyMaterials ("Minhas Matérias", professor)
  │
  ├──> listAllPresentationSlidesFn / listDisciplinePresentationSlidesFn
  │       (requireAnyLogin, availableAt calculado a partir de
  │        disciplines.startDate) ──> PortalSlides ("/portal/slides") e
  │                                    DisciplineSlidesTab (aba da disciplina, aluno)
  │
  ▼
PortalSlideReader ("/portal/slides/$slideId")
  fileUrl ──> <Document> (react-pdf/pdf.js) ──> <Page pageNumber={current}>
  navegação: anterior/próximo/teclado altera `current` (estado local, 1..numPages)
```

## Tratamento de erros

- **Upload de arquivo não-PDF para slide.** Três camadas: (1) `accept` do `<input>` já
  filtra a maior parte no seletor de arquivo do sistema operacional; (2) a política de
  upload (`allowedContentTypes: ["application/pdf"]`) faz o Vercel Blob rejeitar o upload
  antes de gravar qualquer coisa — o cliente recebe erro e mostra
  `toast.error("Não foi possível enviar o arquivo.")` (mesmo tratamento genérico que
  `CreateMaterialDialog` já usa); (3) `createSlideFn` rejeita com Zod (mensagem "O arquivo
  precisa ser um PDF.") se, por algum motivo, o `fileName` não terminar em `.pdf` — defesa
  extra, não o caminho normal.
- **PDF corrompido / que não carrega no leitor.** `onLoadError` do `<Document>` troca o
  conteúdo por um estado de erro (ícone + "Não foi possível carregar este slide. Tente
  novamente." + botão "Tentar de novo", que remonta o `<Document>` trocando sua `key`) — não
  deixa a tela em branco nem em skeleton infinito.
- **Slide apagado pelo professor enquanto o aluno está com o leitor aberto.** A query de
  `listAllPresentationSlidesFn`/`listDisciplinePresentationSlidesFn` simplesmente não traz
  mais o item; `PortalSlideReader` trata `material === undefined` (depois do `isLoading`)
  como "não encontrado" e mostra uma mensagem com o link "Voltar pros slides" — mesmo padrão
  que `PortalMaterialReader.tsx` já teria nesse cenário (`find` retorna `undefined`).
- **Disciplina ainda não começou.** Igual apostila hoje: `availableAt` não nulo bloqueia a
  leitura com o mesmo cartão de cadeado (`Lock`) e mensagem de data — `SlideCard` e
  `PortalSlideReader` reaproveitam a mesma lógica de `ReadingMaterialCard`/
  `PortalMaterialReader`.
- **Professor tentando editar/apagar slide de disciplina que não é sua.** `requireOwnDiscipline`
  já lança `"Disciplina não encontrada."` — mesmo comportamento de apostila e vídeo-aula,
  sem tratamento novo.
- **Fullscreen indisponível** (navegador sem suporte, ou chamada bloqueada por política do
  navegador). `requestFullscreen()` retorna uma Promise que pode rejeitar; o botão de tela
  cheia captura a rejeição e simplesmente não muda de estado (sem toast de erro — tela cheia
  é conveniência, não uma ação crítica).

## Estratégia de testes

Não há lógica pura nova que justifique um teste Vitest dedicado: `createSlideFn`,
`listMyMaterialsFn` etc. são funções de servidor que dependem de banco e sessão (mesmo
padrão de `readingMaterials.ts`/`videoLessons.ts`, nenhum dos quais tem teste automatizado
hoje), e os componentes de leitor são interativos/visuais. O portão de verificação desta
entrega é:

1. `npx eslint .` e `npx tsc --noEmit -p tsconfig.typecheck.json` limpos.
2. `npm run build` verde (garante que `react-pdf` e a resolução do worker do pdf.js
   funcionam no bundle de produção, não só em dev).
3. Roteiro manual (`npm run dev`):
   - **Painel**: na aba "Slides" de uma disciplina, criar um slide com PDF válido; tentar
     criar com um arquivo `.pptx` (deve ser rejeitado antes de gravar); editar título e
     descrição; apagar.
   - **Minhas Matérias**: abrir `/painel/minhas-materias`, conferir que apostilas e slides
     de todas as disciplinas do professor aparecem agrupados por disciplina, e que editar
     ali reflete na aba da disciplina de origem (e vice-versa, já que é a mesma tabela).
   - **Portal — biblioteca de slides**: `/portal/apostilas` mostra o link para
     `/portal/slides`; lá, os slides aparecem agrupados por semestre/disciplina, com cadeado
     nos de disciplina ainda não iniciada.
   - **Portal — leitor**: abrir um slide; navegar com os botões e com as setas do teclado;
     conferir contador "X de Y"; entrar e sair da tela cheia; abrir um slide de uma
     disciplina bloqueada (deve mostrar o cadeado, não o leitor).
   - **Portal — aba da disciplina**: a aba "Slides" dentro de uma disciplina no portal lista
     só os slides daquela disciplina, mesmo comportamento de "Apostila" ao lado.

## Fora de escopo

- **Compartilhamento entre professores e comentários em slide** — o que apostila ganhou na
  Fase 7 (`readingMaterialShares`/`readingMaterialComments`) não se estende a slide. Nenhum
  botão de compartilhar na aba "Slides" nem no hub.
- **Editar/trocar o arquivo de um slide já enviado** — só título e descrição, igual apostila
  hoje. Trocar o PDF exige apagar e criar de novo.
- **Salvar em qual slide o aluno parou** — `PortalSlideReader` sempre abre no slide 1; não
  há tabela de progresso (equivalente a `videoWatches`, mas para slide).
- **Conversão de `.pptx`/`.ppt` para PDF no servidor** — descartada explicitamente por
  complexidade/custo; o professor exporta como PDF antes de subir.
- **Item de slides na sidebar do portal do aluno** — acesso só via o link a partir de
  Apostilas (`ContentTypeToggle`) e via a aba dentro da disciplina.
- **Botão "Novo material"/"Novo slide" dentro do hub "Minhas Matérias"** — criação continua
  restrita à aba da disciplina.

## Entrega

Segue [CONTRIBUTING.md](../../../CONTRIBUTING.md): issue no GitHub (rótulo `enhancement`)
antes de começar a implementação, branch a partir da `main` (sugestão:
`feat/slides-e-minhas-materias`), pull request com `Closes #<número>`, merge disparando o
deploy. Nada é commitado direto na `main`. O plano de implementação é escrito a partir deste
documento, via a skill `writing-plans`.
