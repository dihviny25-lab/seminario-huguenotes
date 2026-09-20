import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAnyIdentity } from "@/server/auth/guard";
import { canReadPrivateFile } from "@/server/files/privateFileAccess";

const fileIdSchema = z.object({ fileId: z.string().uuid() });

// Curto o bastante pra não valer a pena compartilhar o link fora da sessão,
// longo o bastante pra não expirar no meio de uma visualização normal. A
// rota /api/arquivo/$fileId revalida a permissão a cada acesso de qualquer
// forma — este prazo é só informativo pra interface.
const ACCESS_TTL_MS = 15 * 60 * 1000;

/**
 * Autoriza o acesso a um arquivo privado e devolve a URL da rota que
 * efetivamente entrega o conteúdo (`/api/arquivo/$fileId`), que revalida a
 * permissão a cada requisição — não é uma URL assinada do Blob.
 */
export const getPrivateFileAccessFn = createServerFn({ method: "GET" })
  .validator(fileIdSchema)
  .handler(async ({ data }): Promise<{ url: string; expiresAt: string }> => {
    const identity = await requireAnyIdentity();
    const allowed = await canReadPrivateFile({ fileId: data.fileId, identity });
    if (!allowed) {
      throw new Error("Arquivo não encontrado.");
    }
    return {
      url: `/api/arquivo/${data.fileId}`,
      expiresAt: new Date(Date.now() + ACCESS_TTL_MS).toISOString(),
    };
  });
