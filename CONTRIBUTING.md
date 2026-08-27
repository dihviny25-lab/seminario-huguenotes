> Trabalho de motion/animação de UI segue o padrão em [MOTION.md](MOTION.md).

# Fluxo de trabalho: issues e pull requests

Este projeto usa GitHub Issues + Pull Requests para gerenciar todo o trabalho e os deploys.
**Toda tarefa** — correção de bug, melhoria ou nova função — segue este fluxo, sem exceção.

## 1. Toda tarefa vira uma issue

Antes de começar a trabalhar em qualquer correção, melhoria ou nova função, crie uma issue no
GitHub descrevendo a tarefa:

```sh
gh issue create --title "Título curto e claro" --body "Descrição do problema/objetivo" --label bug|enhancement
```

Use os labels padrão do repositório:
- `bug` — correção de algo que está quebrado
- `enhancement` — melhoria ou nova função
- `documentation` — mudanças de documentação

## 2. Trabalho em branch, nunca direto na `main`

Crie uma branch a partir da `main` para cada issue:

```sh
git checkout -b tipo/descricao-curta   # ex: fix/frequencia-100-falsa, feat/dashboard-aluno
```

## 3. Pull request referenciando a issue

Ao abrir o PR, **sempre mencione a issue na descrição** usando uma palavra-chave de fechamento
automático (`Closes #123`, `Fixes #123` ou `Resolves #123`). Isso faz a issue fechar sozinha
quando o PR é mergeado, e mantém o histórico rastreável.

```sh
gh pr create --title "Mesmo título/tema da issue" --body "Closes #123

Descrição do que foi feito e por quê."
```

## 4. Deploy via merge do PR

O merge do pull request na `main` é o gatilho de deploy. Não há push direto na `main` para
mudanças de código — tudo passa por PR revisado e mergeado.

## Resumo para qualquer agente (Claude, Codex, Cursor, etc.)

Se você é um agente de IA trabalhando neste repositório:

1. Antes de implementar qualquer correção, melhoria ou nova função, crie uma issue no GitHub
   (`gh issue create`) descrevendo a tarefa.
2. Trabalhe em uma branch dedicada, nunca direto na `main`.
3. Ao abrir o PR (`gh pr create`), inclua `Closes #<número da issue>` na descrição.
4. Não faça merge nem push direto na `main` sem autorização explícita do usuário — o merge do
   PR é o que dispara o deploy.
