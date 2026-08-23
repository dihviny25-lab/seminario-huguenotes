import { upload } from "@vercel/blob/client";

export type UploadedFile = { url: string; fileName: string };

/**
 * Sobe um arquivo direto do navegador pro Vercel Blob (o servidor só emite
 * um token, os bytes do arquivo não passam por ele) — necessário pra
 * arquivos grandes (livros da biblioteca podem passar de dezenas de MB),
 * já que uma função serverless tem limite de corpo de requisição bem menor
 * que isso. Só funciona publicado num domínio vercel.app; em localhost o
 * Vercel Blob recusa por CORS.
 */
export async function uploadFile(file: File): Promise<UploadedFile> {
  const blob = await upload(file.name, file, {
    access: "public",
    handleUploadUrl: "/api/blob/upload",
  });
  return { url: blob.url, fileName: file.name };
}
