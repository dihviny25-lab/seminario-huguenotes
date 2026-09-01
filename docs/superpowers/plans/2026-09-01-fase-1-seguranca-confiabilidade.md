# Fase 1 — Segurança e confiabilidade

## Objetivo

Endurecer os fluxos críticos antes de expandir funcionalidades: uploads, pagamentos, validação de acesso e qualidade automatizada.

## Escopo

1. Restringir uploads por contexto e papel do usuário.
2. Validar pagamentos do Mercado Pago antes de marcar cobranças como pagas.
3. Garantir idempotência do webhook de pagamento.
4. Adicionar typecheck e CI com lint, testes e build.
5. Criar testes para os novos invariantes de segurança.
6. Corrigir o idioma raiz do documento e mensagens globais de erro para pt-BR como ajuste de baixo risco.

## Estratégia

- Implementar em branch dedicada.
- Alterar primeiro as regras server-side, depois testes e CI.
- Não misturar refatorações visuais ou grandes reorganizações nesta fase.
- Abrir PR ao final com resumo, riscos e passos de validação.

## Critérios de aceite

- Alunos não conseguem obter token de upload genérico de vídeo/biblioteca.
- Uploads possuem limites de tamanho coerentes por finalidade.
- Webhook não quita cobrança com valor incompatível.
- Webhook repetido não duplica efeitos.
- `npm run typecheck`, `npm run lint`, `npm test` e `npm run build` fazem parte do pipeline.
- Fluxos alterados possuem testes automatizados.
