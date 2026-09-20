import { createFileRoute } from "@tanstack/react-router";
import { get as getBlob, type GetCommandOptions } from "@vercel/blob";

import { requireAnyIdentity } from "@/server/auth/guard";
import { canReadPrivateFile, loadPrivateFile } from "@/server/files/privateFileAccess";

// `headers` é um escape hatch do SDK não coberto pelo tipo público de
// GetCommandOptions, mas suportado em runtime (repassado por cima dos
// headers padrão) — é como propagamos o `Range` do player de vídeo pro
// Blob, pra manter a busca/avanço do player funcionando.
type GetCommandOptionsWithHeaders = GetCommandOptions & { headers?: Record<string, string> };

/**
 * Única forma de ler um arquivo protegido. A store do Blob é `access:
 * "public"` (Vercel não permite misturar público/privado na mesma store),
 * mas a URL real nunca é exposta ao cliente — só essa rota, que revalida a
 * permissão a cada requisição (não confia em URL assinada guardada pelo
 * cliente) e nunca revela se o recurso existe quando o acesso é negado —
 * sempre 404, tanto pra "não existe" quanto pra "existe mas você não pode".
 */
export const Route = createFileRoute("/api/arquivo/$fileId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        let identity;
        try {
          identity = await requireAnyIdentity();
        } catch {
          return new Response(null, { status: 401 });
        }

        const file = await loadPrivateFile(params.fileId);
        if (!file) return new Response(null, { status: 404 });

        const allowed = await canReadPrivateFile({ fileId: params.fileId, identity });
        if (!allowed) return new Response(null, { status: 404 });

        const range = request.headers.get("range");
        const blob = await getBlob(file.blobPath, {
          access: "public",
          ...(range ? { headers: { Range: range } } : {}),
        } satisfies GetCommandOptionsWithHeaders);
        if (!blob || blob.stream === null) return new Response(null, { status: 404 });

        const contentRange = blob.headers.get("content-range");
        const contentLength = blob.headers.get("content-length");

        return new Response(blob.stream, {
          status: contentRange ? 206 : 200,
          headers: {
            "content-type": blob.blob.contentType || file.contentType || "application/octet-stream",
            "content-disposition": `inline; filename="${encodeURIComponent(file.originalName)}"`,
            "cache-control": "private, max-age=0, no-store",
            "accept-ranges": "bytes",
            ...(contentRange ? { "content-range": contentRange } : {}),
            ...(contentLength ? { "content-length": contentLength } : {}),
          },
        });
      },
    },
  },
});
