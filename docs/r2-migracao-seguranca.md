# Migração Vercel Blob → Cloudflare R2 — checklist de segurança (issue #87)

Este documento cobre os itens da issue #87 que **não dá pra resolver só com
código** — dependem de credenciais/acesso que quem revisa este PR precisa
aplicar manualmente antes de configurar Production.

## 1. CORS restrito do bucket R2

O upload é um `PUT` direto do navegador pra URL pré-assinada (`createUploadUrl`
em `src/server/storage/r2.ts`) — isso exige CORS configurado no bucket, senão
o navegador bloqueia a requisição.

A política em [`deploy/r2-cors.json`](../deploy/r2-cors.json) já está pronta:
só `PUT` e o header `Content-Type`, sem curinga, restrita à origem real de
Production (`SITE_URL` do `.env.example`).

Pra aplicar (precisa do `wrangler` autenticado na conta Cloudflare do bucket):

```sh
wrangler r2 bucket cors put <NOME_DO_BUCKET> --rules deploy/r2-cors.json
```

Ou pelo painel: Cloudflare dashboard → R2 → bucket → Settings → CORS Policy →
colar o conteúdo do arquivo.

**Preview**: a URL de cada deploy de Preview é dinâmica (muda por branch/
deploy). Pra validar upload em Preview, adicione temporariamente a URL do
deploy de Preview em uso à lista `AllowedOrigins` (num bucket de teste
separado, como já pede a seção "Pré-requisitos de Preview" do PR — nunca no
bucket de Production).

## 2. Validação em Preview antes de Production

Meio que por definição, isso não é uma tarefa de código — precisa de alguém
com acesso a um ambiente de Preview real (variáveis `R2_*` de teste
configuradas) rodando o app e conferindo manualmente:

- upload real de apostila, tarefa, livro, slide e vídeo;
- leitura autorizada de cada um (inclusive `Range` pra vídeo);
- negação de leitura sem sessão (deve dar 401/404, nunca vazar o objeto);
- prévia (dry-run) da migração administrativa sem gravar nada, e então um
  lote controlado real no banco de Preview.

Esta seção do PR fica como checklist manual — não é algo que outra rodada de
código deste PR consiga marcar sozinha.

## O que já está implementado em código (itens 1 e 3 da issue #87)

- **Fallback de leitura pro Blob**: `/api/arquivo/$fileId` (em
  `src/routes/api/arquivo/$fileId.tsx`) checa se o registro ainda aponta pro
  Vercel Blob (`isStillOnVercelBlob`, em `src/server/storage/r2.ts`) e, se
  sim, serve de lá — sem indisponibilidade enquanto a migração não alcançou
  aquele arquivo.
- **Migração administrativa segura**: `/api/admin/migrar-arquivos-r2` agora é
  só `POST`, exige confirmação textual (`{ "confirm": "MIGRAR" }`) no corpo,
  processa no máximo 10 registros por chamada (idempotente — repetir a
  chamada avança o restante) e grava um registro em `audit_logs` por lote
  (`storage.migrar_r2_lote`), visível em `/painel/auditoria`.
