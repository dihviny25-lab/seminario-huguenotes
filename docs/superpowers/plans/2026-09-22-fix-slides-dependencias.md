# Corrigir dependências do leitor de slides — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o leitor de slides (`PortalSlideReader.tsx`, que usa `react-pdf`) funcionar de forma confiável não importa qual gerenciador de pacotes (`npm` ou `bun`) instalou as dependências.

**Architecture:** O bug não está no código do leitor — está desalinhamento entre `bun.lock` (parado desde 30/07/2026) e `package.json`/`package-lock.json` (que ganharam `react-pdf` em 04/09/2026). Quem roda `bun install` localmente nunca recebe `react-pdf` nem `pdfjs-dist`, e `PortalSlideReader.tsx` quebra com "Cannot find module 'react-pdf'". A correção é regenerar `bun.lock` e declarar `pdfjs-dist` como dependência direta (hoje só existe transitivamente via `react-pdf`, o que foi exatamente o tipo de dependência frágil que causou o problema).

**Tech Stack:** npm + bun (dois lockfiles mantidos em paralelo neste repo), react-pdf, pdfjs-dist, Vite/Vitest, TypeScript.

**Spec:** Sem doc de design formal — tarefa "bounded" discutida em chat na sessão de 2026-09-22 (varredura de erros → brainstorming). Contexto: `src/pages/portal/PortalSlideReader.tsx` é o leitor de slides do aluno; usa `react-pdf` (`Document`/`Page`) e importa `pdfjs-dist/build/pdf.worker.min.mjs` diretamente.

## Global Constraints

- Não escrever testes automatizados novos para esta tarefa (preferência do usuário: implementação primeiro, testes só quando pedidos). Verificação é via `npm run typecheck`, `npm test` (suíte existente) e checagem manual dos arquivos instalados.
- Não editar `bun.lock` manualmente — sempre regenerar via `bun install`, pra garantir que os hashes/integridade batem com o que o bun realmente resolveria.
- Não remover ou trocar `react-pdf`/`@react-pdf/renderer` — são pacotes diferentes, ambos em uso (`@react-pdf/renderer` gera PDFs de boletim, `react-pdf` só lê PDF no navegador). Não confundir os dois.

---

### Task 1: Sincronizar `bun.lock` e declarar `pdfjs-dist` explicitamente

**Files:**
- Modify: `package.json` (adicionar `pdfjs-dist` como dependência direta)
- Modify: `bun.lock` (regenerado por comando, não editado à mão)
- Verify: `node_modules/react-pdf`, `node_modules/pdfjs-dist`

**Interfaces:**
- Consumes: nenhuma interface de código — mudança é só de dependências/lockfile.
- Produces: `pdfjs-dist` resolvível tanto via `npm ci` quanto via `bun install`, na mesma versão que `react-pdf` já usa hoje (`5.4.296`, confirmado em `package-lock.json`).

- [ ] **Step 1: Adicionar `pdfjs-dist` ao `package.json`**

Abra `package.json` e adicione, na lista de `dependencies` (ordem alfabética, ao lado de `path-to-regexp`/`patch-package`/etc.), a mesma versão já resolvida hoje pelo npm:

```json
    "pdfjs-dist": "5.4.296",
```

(Fixo, sem `^`, porque `react-pdf` é sensível à versão exata do `pdfjs-dist` que carrega — evita o worker e a lib divergirem de versão de novo no futuro.)

- [ ] **Step 2: Regenerar o `bun.lock`**

Rodar na raiz do projeto:

```bash
bun install
```

Isso reescreve `bun.lock` incluindo `react-pdf`, `pdfjs-dist` e qualquer outra dependência que tenha ficado pra trás desde 30/07/2026.

- [ ] **Step 3: Verificar que os pacotes foram instalados**

```bash
ls node_modules/react-pdf node_modules/pdfjs-dist
```

Esperado: os dois diretórios existem (antes desta correção, nenhum dos dois existia neste checkout).

- [ ] **Step 4: Rodar o typecheck**

```bash
npm run typecheck
```

Esperado: o erro `Cannot find module 'react-pdf'` em `src/pages/portal/PortalSlideReader.tsx` não aparece mais. (Se restar algum outro erro pré-existente sem relação com slides, não é escopo desta tarefa — confirme comparando com a `main` antes da mudança.)

- [ ] **Step 5: Rodar a suíte de testes**

```bash
npm test
```

Esperado: os 127 testes continuam passando (nenhuma mudança de comportamento de aplicação nesta tarefa).

- [ ] **Step 6: Build de produção**

```bash
npm run build
```

Esperado: build conclui sem erro — confirma que o bundler resolve `react-pdf`/`pdfjs-dist` corretamente (o worker é importado via `new URL(..., import.meta.url)`, então precisa passar pelo Vite).

- [ ] **Step 7: Verificação manual do leitor de slides**

Rodar `npm run dev`, logar como aluno no portal, abrir uma disciplina com slides cadastrados e abrir um slide. Confirmar que o PDF renderiza página a página (setas ←/→, tela cheia) sem erro no console.

- [ ] **Step 8: Commit**

```bash
git add package.json bun.lock package-lock.json
git commit -m "fix: sincroniza bun.lock e declara pdfjs-dist como dependência direta

bun.lock estava parado desde 30/07/2026, sem o react-pdf adicionado em
04/09/2026 (ec142e7). Quem instalava com bun nunca recebia react-pdf nem
pdfjs-dist, quebrando o leitor de slides do aluno (PortalSlideReader.tsx)
com 'Cannot find module react-pdf'."
```

(Note: `package-lock.json` também deve ser regenerado — rode `npm install` depois do Step 1 se ele não atualizar sozinho ao rodar os comandos acima, pra refletir a nova entrada explícita de `pdfjs-dist`.)
