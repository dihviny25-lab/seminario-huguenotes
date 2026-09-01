# Plano de implementação — Fase 1

1. Adicionar CI e script `typecheck`.
2. Endurecer autorização do endpoint de upload por finalidade.
3. Atualizar os clientes de upload para informar finalidade.
4. Endurecer webhook do Mercado Pago com validação de cobrança, valor e idempotência.
5. Adicionar testes unitários para as regras extraídas de pagamento/upload quando aplicável.
6. Corrigir idioma global e telas 404/erro.
7. Executar/verificar checks do PR e revisar diff antes de marcar pronto.

Cada passo deve gerar mudança pequena e revisável; não incluir refatorações de arquitetura fora do escopo.
