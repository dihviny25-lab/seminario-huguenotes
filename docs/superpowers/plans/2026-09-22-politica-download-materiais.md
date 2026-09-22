# Política de download de materiais — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A apostila é o único material que o aluno pode baixar (pra imprimir); slides, vídeo-aula, biblioteca e envio de tarefa só podem ser vistos/assistidos na tela, nunca baixados.

**Architecture:** Levantamento mostrou que slides (`PortalSlideReader.tsx`), biblioteca (`PortalLibraryReader.tsx`) e apostila (`PortalMaterialReader.tsx`) já não expõem nenhum link de download hoje — a apostila, inclusive, está *mais* restrita do que deveria (o comentário do código diz literalmente "sem link de download", o oposto do pedido). O único vazamento real de download nos materiais de aula é o `<video controls>` de `PrivateVideoPlayer.tsx`, que o Chrome/Edge decora com um ícone nativo de download por padrão. Este plano faz as duas mudanças pontuais: libera um link de download visível na apostila (reaproveitando `PrivateFileLink`, componente que já existe e já foi projetado exatamente pra isso) e tira o ícone nativo do player de vídeo (`controlsList="nodownload"`).

**Tech Stack:** React, componentes `PrivateFileLink`/`PrivateVideoPlayer` já existentes em `src/components/`.

**Spec:** Sem doc de design formal — tarefa "bounded" discutida em chat na sessão de 2026-09-22 (varredura de erros → brainstorming). Decisões confirmadas com o usuário:
- Apostila: botão/link visível "Baixar apostila para impressão" ao lado do leitor embutido (não substitui o leitor, só adiciona a opção).
- Vídeo-aula: só remover o ícone nativo de download da barra de controles já resolve — não é escopo tentar bloquear 100% (inspeção de rede sempre é possível).

## Global Constraints

- Não escrever testes automatizados novos para esta tarefa (preferência do usuário). Verificação é manual, no navegador.
- Escopo é só o **portal do aluno** (`src/pages/portal/`). As telas do professor (`src/pages/painel/`) continuam com download normal do próprio material que ele mesmo enviou — isso não muda.
- Não alterar a rota `/api/arquivo/$fileId` nem o header `content-disposition: inline` que ela já envia — a mudança da apostila é só de UI (mostrar um link que já existia como componente, hoje só não usado nessa tela).

---

### Task 1: Liberar download da apostila para impressão

**Files:**
- Modify: `src/pages/portal/PortalMaterialReader.tsx`

**Interfaces:**
- Consumes: `PrivateFileLink` (já existe, `src/components/PrivateFileLink.tsx`) — props `fileId`, `fileUrl`, `fileName`, `className`, `children`.

- [ ] **Step 1: Atualizar o comentário do componente**

Trocar:

```typescript
/** Leitor online da apostila — sem link de download, só o PDF embutido. */
```

por:

```typescript
/**
 * Leitor online da apostila, com opção de baixar pra impressão — único
 * material do portal que permite download (os demais só são vistos na
 * tela: ver PrivateFileLink usado aqui vs. PrivateDocumentViewer sozinho
 * em PortalLibraryReader.tsx).
 */
```

- [ ] **Step 2: Adicionar o link de download visível**

Importar `PrivateFileLink` e o ícone, e inserir o link entre o botão "Voltar" e o bloco do leitor (dentro do branch em que `material` existe e não está bloqueado por `availableAt`):

```typescript
import { PrivateFileLink } from "@/components/PrivateFileLink";
```

Trocar o bloco final (o `else` que renderiza `PrivateDocumentViewer`) de:

```typescript
      ) : (
        <div className="animate-in overflow-hidden rounded-md border border-border/70 bg-card/70 shadow-soft fade-in duration-300">
          <PrivateDocumentViewer
            fileId={material.fileId}
            fileUrl={material.fileUrl}
            fileName={material.fileName}
            title={material.title}
            className="h-[85vh] w-full"
          />
        </div>
      )}
```

por:

```typescript
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end">
            <PrivateFileLink
              fileId={material.fileId}
              fileUrl={material.fileUrl}
              fileName={material.fileName}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Baixar apostila para impressão
            </PrivateFileLink>
          </div>
          <div className="animate-in overflow-hidden rounded-md border border-border/70 bg-card/70 shadow-soft fade-in duration-300">
            <PrivateDocumentViewer
              fileId={material.fileId}
              fileUrl={material.fileUrl}
              fileName={material.fileName}
              title={material.title}
              className="h-[85vh] w-full"
            />
          </div>
        </div>
      )}
```

(`PrivateFileLink` já lida sozinho com o caso de arquivo legado sem `fileId` — mostra "Arquivo indisponível para migração." em vez do link, então não precisa de checagem extra aqui.)

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Verificação manual**

Rodar `npm run dev`, logar como aluno, abrir uma apostila disponível e confirmar: o leitor embutido continua funcionando igual, e agora aparece "Baixar apostila para impressão" acima dele, abrindo o PDF completo (com a barra de ferramentas nativa do navegador) numa aba nova.

- [ ] **Step 5: Commit**

```bash
git add src/pages/portal/PortalMaterialReader.tsx
git commit -m "feat: libera download da apostila para impressão

Apostila era o único material sem nenhuma forma de download (nem
embutido nem por link) — oposto do esperado, já que é o material que
faz sentido imprimir. Slides, biblioteca e vídeo-aula continuam só
visualização na tela."
```

---

### Task 2: Remover o ícone nativo de download do player de vídeo-aula

**Files:**
- Modify: `src/components/PrivateVideoPlayer.tsx`

**Interfaces:**
- Nenhuma mudança de props ou de interface — só um atributo a mais no elemento `<video>` já existente.

- [ ] **Step 1: Adicionar `controlsList="nodownload"`**

Trocar:

```typescript
  return <video src={url} controls className={className} onEnded={onEnded} />;
```

por:

```typescript
  return (
    <video
      src={url}
      controls
      controlsList="nodownload"
      className={className}
      onEnded={onEnded}
    />
  );
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Verificação manual**

Rodar `npm run dev`, logar como aluno, abrir uma vídeo-aula do tipo "upload" (não YouTube) e confirmar no Chrome/Edge que o ícone de download não aparece mais na barra de controles do player (só play/pause, volume, tela cheia etc.).

- [ ] **Step 4: Commit**

```bash
git add src/components/PrivateVideoPlayer.tsx
git commit -m "fix: remove ícone nativo de download do player de vídeo-aula

<video controls> sem controlsList expunha um botão de download nativo
do Chrome/Edge — único vazamento de download real encontrado nos
materiais de aula (slides/apostila/biblioteca já não tinham link)."
```
