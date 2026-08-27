# Padrão de motion do projeto

Baseado no skill [design-motion-principles](https://github.com/kylezantos/design-motion-principles)
(instalado em `.agents/skills/design-motion-principles`, symlinkado em `.claude/skills/`).

Pesos confirmados pra este projeto: **Emil Kowalski** (restrição/velocidade) como lente
principal no painel do professor/admin — é uma ferramenta de uso frequente, com tabelas e
formulários acessados dezenas de vezes por dia. **Jakub Krehel** (polish de produção) como
lente secundária nos dois lados (painel e portal) — é um sistema real em produção. **Jhey
Tompkins** (playful) só seletivamente no portal do aluno, em momentos pontuais (onboarding,
estados vazios) — nunca no painel.

Toda animação precisa ter um propósito nomeável (feedback, orientação, continuidade). Sem
propósito, não anima. Interações de alta frequência (dezenas de vezes por sessão) e ações via
teclado nunca animam.

## Acessibilidade (obrigatório, sem exceção)

`src/styles.css` já tem a guarda global de `prefers-reduced-motion: reduce`, que encolhe
qualquer `animation`/`transition` do app (inclusive `animate-in`/`animate-out` do
tw-animate-css) pra quase-instantâneo. Isso já cobre qualquer classe Tailwind/CSS puro — não
precisa reimplementar por componente. Só cuidado ao usar `setTimeout` pra desmontagem
atrasada (`useDelayedUnmount`): a duração do timeout em JS não é afetada pela media query CSS,
então mantenha os `exitDurationMs` baixos (150-250ms) pra não atrasar artificialmente quem
pediu menos movimento.

## Padrões prontos — use estes, não invente novos

### 1. Loading de lista/tabela → skeleton, nunca texto

Trocar qualquer `<TableRow><TableCell colSpan={N}>Carregando…</TableCell></TableRow>` por:

```tsx
import { TableSkeletonRows } from "@/components/TableSkeletonRows";

{isLoading ? <TableSkeletonRows columns={N} /> : ...}
```

Pra cards/listas fora de `<Table>`, usar `<Skeleton>` de `@/components/ui/skeleton`
diretamente, com a mesma forma/tamanho aproximado do conteúdo real (nunca um spinner genérico
central — o esqueleto deve prever o layout final, reduzindo o salto de layout quando os dados
chegam).

### 2. Entrada de elemento condicional → classes do tw-animate-css

Pra qualquer `{condição && <Elemento />}` que hoje aparece sem transição (linhas de tabela
novas, painéis que expandem, cards que aparecem), adicionar:

```tsx
<div className="animate-in fade-in slide-in-from-top-1 duration-200">
```

- `duration-200` (200ms) no painel (lente Emil); até `duration-300`/`duration-500` aceitável no
  portal do aluno (lente Jakub) se o elemento for maior (modal, card grande).
- Diálogos/Sheets/Popovers do Radix (`@/components/ui/dialog`, `sheet`, `popover`,
  `dropdown-menu` etc.) **já animam** via `data-[state=open]:animate-in` embutido no
  componente — não precisa mexer neles.
- Nunca começar de `scale-0` — se for usar `zoom-in`, o tw-animate-css já parte de ~95%, o que
  já é seguro.

### 3. Saída de elemento condicional → `useDelayedUnmount`

Conditional renders comuns (`{show && <X/>}`) desmontam instantaneamente — não dá tempo de
nenhuma transição de saída rodar. Usar o hook `useDelayedUnmount` de `@/hooks/useDelayedUnmount`:

```tsx
import { useDelayedUnmount } from "@/hooks/useDelayedUnmount";

const mounted = useDelayedUnmount(show, 150);
if (!mounted) return null;

return (
  <div
    className={cn(
      "transition-all duration-150",
      show ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0",
    )}
  >
    ...
  </div>
);
```

A saída é sempre mais sutil que a entrada (menos deslocamento) — ver exemplo acima
(`-translate-y-1`, não uma tela inteira).

### 4. Progresso de uma ação (mutation) → ícone `Loader2` girando, nunca só texto

Botões que já trocam de texto durante `mutation.isPending` (ex.: "Salvando…") ganham também o
ícone, mantendo o texto (o ícone sozinho não é acessível):

```tsx
import { Loader2 } from "lucide-react";

<Button disabled={mutation.isPending}>
  {mutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
  {mutation.isPending ? "Salvando…" : "Salvar"}
</Button>
```

### 5. Lazy loading de rotas pouco acessadas

Rotas pesadas ou raramente abertas (editor de prova, relatórios, auditoria) devem usar o
code-splitting nativo do TanStack Router — sufixo `.lazy.tsx` no arquivo de rota, movendo o
`component` pra lá:

```tsx
// src/routes/painel/auditoria.tsx — só a definição da rota, sem o componente
export const Route = createFileRoute("/painel/auditoria")({ ... });

// src/routes/painel/auditoria.lazy.tsx — o componente, carregado sob demanda
export const Route = createLazyFileRoute("/painel/auditoria")({
  component: AuditLog,
});
```

Não aplicar em rotas de entrada/alto tráfego (`/painel`, `/painel/pagamentos`, `/portal`,
`/portal/notas`) — lazy loading nelas só adiciona uma requisição extra sem ganho real.

## O que NÃO fazer

- Nada de indicador pulsante contínuo (bolinha piscando, borda "respirando") pra chamar
  atenção — isso é o padrão "AI slop" que o skill existe pra evitar. `animate-pulse` no
  `<Skeleton>` é a única exceção aceita (sinaliza carregamento, não decoração).
- Nada de `hover:scale-*` em todo elemento clicável só por "dar polish".
- Nada de duração única pra tudo — elemento pequeno anima mais rápido que um modal grande.
- Não anime propriedades de layout (`width`, `height`, `top`, `margin`) — use `transform` e
  `opacity` (já é o que as classes do tw-animate-css fazem).
