import { createFileRoute } from "@tanstack/react-router";
import { put } from "@vercel/blob";

import { requireAnyLogin } from "@/server/auth/guard";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
]);
const MAX_SIZE_BYTES = 25 * 1024 * 1024;

/**
 * Upload de arquivo (apostila, entrega de tarefa) — o arquivo passa pelo
 * servidor (não é upload direto-do-navegador pro Blob) porque o upload
 * direto exige que a origem seja um domínio vercel.app; assim funciona
 * igual em desenvolvimento local e em produção.
 */
export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await requireAnyLogin();

        const formData = await request.formData();
        const file = formData.get("file");
        if (!(file instanceof File)) {
          return Response.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
        }
        if (!ALLOWED_TYPES.has(file.type)) {
          return Response.json({ error: "Tipo de arquivo não permitido." }, { status: 400 });
        }
        if (file.size > MAX_SIZE_BYTES) {
          return Response.json({ error: "Arquivo maior que 25MB." }, { status: 400 });
        }

        const blob = await put(file.name, file, {
          access: "public",
          addRandomSuffix: true,
        });

        return Response.json({ url: blob.url, fileName: file.name });
      },
    },
  },
});
