import { upload } from "@vercel/blob/client";

export type UploadedFile = { url: string; fileName: string };

/**
 * Sobe um arquivo direto do navegador pro Vercel Blob (o servidor só emite
 * um token, os bytes do arquivo não passam por ele) — necessário pra
 * arquivos grandes (livros e vídeo-aulas passam fácil de dezenas/centenas
 * de MB), já que uma função serverless tem limite de corpo de requisição
 * bem menor que isso. Só funciona publicado num domínio vercel.app; em
 * localhost o Vercel Blob recusa por CORS. `multipart: true` deixa envio de
 * arquivo grande mais confiável (divide em pedaços).
 */
export async function uploadFile(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadedFile> {
  const blob = await upload(file.name, file, {
    access: "public",
    handleUploadUrl: "/api/blob/upload",
    multipart: true,
    onUploadProgress: onProgress ? ({ percentage }) => onProgress(percentage) : undefined,
  });
  return { url: blob.url, fileName: file.name };
}
