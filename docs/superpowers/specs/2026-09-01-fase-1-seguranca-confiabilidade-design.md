# Design — Fase 1: Segurança e confiabilidade

## Contexto

O sistema já possui autenticação separada para professores e alunos, uploads diretos para Vercel Blob, cobranças com Mercado Pago e cron jobs. A Fase 1 endurece esses fluxos sem alterar o produto ou a arquitetura principal.

## Uploads

O endpoint de token de upload não deve conceder uma permissão genérica de até 2 GB para qualquer usuário autenticado. A requisição passará a declarar uma finalidade (`assignment`, `material`, `library`, `video`). O servidor escolherá os tipos MIME e o tamanho máximo permitido e validará a identidade:

- `assignment`: aluno ou professor autenticado; PDF/DOC/DOCX; até 50 MB.
- `material`: professor autenticado; PDF/DOC/DOCX/PPT/PPTX; até 100 MB.
- `library`: professor autenticado; PDF; até 250 MB.
- `video`: professor autenticado; MP4/WebM/QuickTime; até 2 GB.

A finalidade será tratada no servidor; o cliente não poderá escolher diretamente `maximumSizeInBytes` ou tipos permitidos.

## Mercado Pago

Antes de marcar uma cobrança como paga, o webhook deve verificar:

1. cobrança existente para `externalReference`;
2. pagamento aprovado;
3. moeda BRL quando informada;
4. valor recebido compatível com o valor esperado da cobrança na data do pagamento;
5. idempotência: se a cobrança já estiver paga com o mesmo `mpPaymentId`, retornar sucesso sem reprocessar;
6. conflito: cobrança já paga com outro pagamento não deve ser sobrescrita silenciosamente.

A atualização continuará sendo disparada somente após assinatura HMAC válida.

## Qualidade automatizada

Adicionar `typecheck` ao package.json e GitHub Actions para rodar em pull requests e pushes para `main`: instalação determinística, typecheck, lint, testes e build.

## Internacionalização global

Alterar `lang="en"` para `lang="pt-BR"` e traduzir as telas globais de 404/erro. Mudança sem efeito de negócio, incluída por ser pequena e diretamente relacionada à confiabilidade da experiência/acessibilidade.
