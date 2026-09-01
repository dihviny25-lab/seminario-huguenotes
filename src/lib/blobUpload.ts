import { upload } from "@vercel/blob/client";

export type UploadedFile = { url: string; fileName: string };
export type UploadPurpose = "assignment" | "material" | "library" | "video";

/**
 * Sobe um arquivo direto do navegador pro Vercel Blob. O cliente informa
 * apenas a finalidade; tipos MIME, limite de tamanho e autorização são
 * decididos no servidor antes da emissão do token.
 */
export async function uploadFile(
  file: File,
  purpose: UploadPurpose,
  onProgress?: (percent: number) => void,
): Promise<UploadedFile> {
  const blob = await upload(file.name, file, {
    access: "public",
    handleUploadUrl: "/api/blob/upload",
    clientPayload: JSON.stringify({ purpose }),
    multipart: true,
    onUploadProgress: onProgress ? ({ percentage }) => onProgress(percentage) : undefined,
  });
  return { url: blob.url, fileName: file.name };
}
