import { createFileRoute } from "@tanstack/react-router";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { requireAnyLogin } from "@/server/auth/guard";

/**
 * Emite o token de upload direto-do-navegador pro Vercel Blob — o arquivo
 * nunca passa pelo servidor, só a URL final depois de subido. Isso é
 * necessário porque funções serverless (Vercel) têm um limite de tamanho de
 * corpo de requisição bem menor que um livro em PDF real; passando o
 * arquivo pelo servidor, qualquer coisa acima de uns poucos MB falhava
 * silenciosamente antes mesmo de chegar no nosso código. Só funciona a
 * partir de um domínio vercel.app publicado — em localhost dá erro de CORS,
 * então upload de arquivo só é testável em produção.
 */
export const Route = createFileRoute("/api/blob/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as HandleUploadBody;

        try {
          const jsonResponse = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async () => {
              await requireAnyLogin();
              return {
                allowedContentTypes: [
                  "application/pdf",
                  "application/msword",
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  "image/png",
                  "image/jpeg",
                  "video/mp4",
                  "video/webm",
                  "video/quicktime",
                ],
                addRandomSuffix: true,
                // Vídeo-aula pode passar bem de 200MB — limite generoso pra não travar upload de aula gravada.
                maximumSizeInBytes: 2 * 1024 * 1024 * 1024,
              };
            },
            onUploadCompleted: async () => {},
          });
          return Response.json(jsonResponse);
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Falha no upload." },
            { status: 400 },
          );
        }
      },
    },
  },
});
