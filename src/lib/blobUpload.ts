import { upload } from "@vercel/blob/client";

export type UploadedFile = { url: string; fileName: string };
export type UploadPurpose = "assignment" | "material" | "library" | "video";

type ProgressHandler = (percent: number) => void;

/**
 * Sobe um arquivo direto do navegador pro Vercel Blob. O cliente informa
 * apenas a finalidade; tipos MIME, limite de tamanho e autorização são
 * decididos no servidor antes da emissão do token.
 *
 * Mantém compatibilidade com as chamadas antigas durante a migração: vídeo é
 * reconhecido pelo MIME; outros arquivos caem na política mais restrita de
 * tarefa (50 MB) até o chamador informar explicitamente a finalidade.
 */
export async function uploadFile(
  file: File,
  purposeOrProgress?: UploadPurpose | ProgressHandler,
  onProgress?: ProgressHandler,
): Promise<UploadedFile> {
  const explicitPurpose =
    typeof purposeOrProgress === "string" ? purposeOrProgress : undefined;
  const purpose: UploadPurpose =
    explicitPurpose ?? (file.type.startsWith("video/") ? "video" : "assignment");
  const progress = typeof purposeOrProgress === "function" ? purposeOrProgress : onProgress;

  const blob = await upload(file.name, file, {
    access: "public",
    handleUploadUrl: "/api/blob/upload",
    clientPayload: JSON.stringify({ purpose }),
    multipart: true,
    onUploadProgress: progress ? ({ percentage }) => progress(percentage) : undefined,
  });
  return { url: blob.url, fileName: file.name };
}
