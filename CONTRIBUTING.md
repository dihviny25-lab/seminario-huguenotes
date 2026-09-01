> Trabalho de motion/animação de UI segue o padrão em [MOTION.md](MOTION.md).

# Fluxo de trabalho: issues e pull requests

Este projeto usa GitHub Issues + Pull Requests para gerenciar o trabalho e os deploys.
**Toda tarefa** — correção de bug, melhoria ou nova função — vira branch + PR, sem exceção.
A issue é obrigatória só pra tarefas de porte maior (ver critério abaixo).

## 1. Quando abrir uma issue

Antes de começar, avalie o tamanho da tarefa:

- **Ajuste pequeno** (typo, copy, ajuste de estilo/config, correção pontual e óbvia) — pode ir
  direto pra branch + PR, sem issue.
- **Tarefa de porte maior** (nova função, mudança de comportamento/schema, bug que precisa de
  investigação) — cria issue primeiro, descrevendo a tarefa:

```sh
gh issue create --title "Título curto e claro" --body "Descrição do problema/objetivo" --label bug|enhancement
```

Use os labels padrão do repositório:
- `bug` — correção de algo que está quebrado
- `enhancement` — melhoria ou nova função
- `documentation` — mudanças de documentação

Na dúvida sobre o porte, é mais barato abrir a issue do que perder o rastro de uma mudança
maior — mas não trave um ajuste pequeno nessa etapa.

## 2. Trabalho em branch, nunca direto na `main`

Crie uma branch a partir da `main` para cada tarefa (tenha issue ou não):

```sh
git checkout -b tipo/descricao-curta   # ex: fix/frequencia-100-falsa, feat/dashboard-aluno
```

## 3. Pull request

Se a tarefa tem issue, **sempre mencione ela na descrição do PR** usando uma palavra-chave de
fechamento automático (`Closes #123`, `Fixes #123` ou `Resolves #123`) — isso faz a issue
fechar sozinha quando o PR é mergeado e mantém o histórico rastreável. Se for um ajuste
pequeno sem issue, só descreva o que foi feito e por quê.

```sh
gh pr create --title "Título curto" --body "Closes #123

Descrição do que foi feito e por quê."
```

## 4. Deploy via merge do PR

O merge do pull request na `main` é o gatilho de deploy. Não há push direto na `main` para
mudanças de código — tudo passa por PR revisado e mergeado.

## Resumo para qualquer agente (Claude, Codex, Cursor, etc.)

Se você é um agente de IA trabalhando neste repositório:

1. Antes de implementar, avalie o porte: ajuste pequeno (typo, copy, estilo/config, correção
   pontual e óbvia) vai direto pra branch + PR; tarefa maior (nova função, mudança de
   comportamento/schema, bug que precisa de investigação) primeiro vira issue no GitHub
   (`gh issue create`) descrevendo a tarefa.
2. Trabalhe em uma branch dedicada, nunca direto na `main`.
3. Ao abrir o PR (`gh pr create`), inclua `Closes #<número da issue>` na descrição quando
   houver issue.
4. Não faça merge nem push direto na `main` sem autorização explícita do usuário — o merge do
   PR é o que dispara o deploy.
