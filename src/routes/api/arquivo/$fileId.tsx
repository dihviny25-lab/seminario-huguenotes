import { createFileRoute } from "@tanstack/react-router";
import { get as getBlob } from "@vercel/blob";

import { requireAnyIdentity } from "@/server/auth/guard";
import { canReadPrivateFile, loadPrivateFile } from "@/server/files/privateFileAccess";
import { getObject, isStillOnVercelBlob } from "@/server/storage/r2";

const CACHE_CONTROL =
  // `private` (só o navegador de quem acabou de ser autorizado guarda, nunca
  // um CDN/proxy compartilhado) com um max-age real — sem isso, cada replay
  // do mesmo vídeo baixa o arquivo inteiro de novo, o que já estourou cota
  // gratuita de transferência uma vez. O conteúdo por fileId é imutável
  // (reupload gera fileId novo).
  "private, max-age=604800, immutable";

/**
 * Única forma de ler um arquivo protegido. O bucket R2 é privado — a URL
 * real nunca é exposta ao cliente, só essa rota, que checa a permissão a
 * cada requisição que não vier do cache do navegador (não confia em URL
 * assinada guardada pelo cliente) e nunca revela se o recurso existe quando
 * o acesso é negado — sempre 404, tanto pra "não existe" quanto pra "existe
 * mas você não pode".
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

        const range = request.headers.get("range") ?? undefined;

        // Enquanto a migração pro R2 não rodou pra este registro, o arquivo
        // ainda está no Vercel Blob — continua servindo de lá (sem
        // indisponibilidade) até a migração alcançar e virar `blobPath` uma
        // chave do R2.
        if (isStillOnVercelBlob(file.blobPath)) {
          const blob = await getBlob(file.blobPath, {
            access: "public",
            headers: range ? { range } : undefined,
          });
          if (!blob || !blob.stream) return new Response(null, { status: 404 });

          const contentRange = blob.headers.get("content-range");
          const contentLength = blob.headers.get("content-length");

          return new Response(blob.stream, {
            status: contentRange ? 206 : 200,
            headers: {
              "content-type":
                blob.blob.contentType || file.contentType || "application/octet-stream",
              "content-disposition": `inline; filename="${encodeURIComponent(file.originalName)}"`,
              "cache-control": CACHE_CONTROL,
              "accept-ranges": "bytes",
              ...(contentRange ? { "content-range": contentRange } : {}),
              ...(contentLength ? { "content-length": contentLength } : {}),
            },
          });
        }

        const object = await getObject({ key: file.blobPath, range });
        if (!object || !object.Body) return new Response(null, { status: 404 });

        const stream = await object.Body.transformToWebStream();

        return new Response(stream, {
          status: object.ContentRange ? 206 : 200,
          headers: {
            "content-type": object.ContentType || file.contentType || "application/octet-stream",
            "content-disposition": `inline; filename="${encodeURIComponent(file.originalName)}"`,
            "cache-control": CACHE_CONTROL,
            "accept-ranges": "bytes",
            ...(object.ContentRange ? { "content-range": object.ContentRange } : {}),
            ...(object.ContentLength !== undefined
              ? { "content-length": String(object.ContentLength) }
              : {}),
          },
        });
      },
    },
  },
});
