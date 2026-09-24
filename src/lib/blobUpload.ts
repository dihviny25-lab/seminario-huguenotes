import { createUploadUrlFn } from "@/functions/uploads";

// O bucket R2 deste projeto é privado — a URL pré-assinada de upload expira
// em minutos e nunca é reaproveitável pra leitura. O objeto só fica
// acessível depois de registrado em `private_files` e servido, sempre
// autorizado, por `/api/arquivo/$fileId`.
export type UploadedFile = {
  fileName: string;
  pathname: string;
  contentType: string | null;
};
export type UploadPurpose = "assignment" | "material" | "library" | "video" | "slide";

type ProgressHandler = (percent: number) => void;

/**
 * Sobe um arquivo direto do navegador pro R2. O cliente informa apenas a
 * finalidade; tipos MIME, limite de tamanho e autorização são decididos no
 * servidor antes da emissão da URL de upload.
 *
 * Mantém compatibilidade com as chamadas antigas: vídeo é reconhecido pelo
 * MIME; outros arquivos caem na política mais restrita de tarefa (50 MB)
 * até o chamador informar explicitamente a finalidade.
 */
export async function uploadFile(
  file: File,
  purposeOrProgress?: UploadPurpose | ProgressHandler,
  onProgress?: ProgressHandler,
): Promise<UploadedFile> {
  const explicitPurpose = typeof purposeOrProgress === "string" ? purposeOrProgress : undefined;
  const purpose: UploadPurpose =
    explicitPurpose ?? (file.type.startsWith("video/") ? "video" : "assignment");
  const progress = typeof purposeOrProgress === "function" ? purposeOrProgress : onProgress;

  const { uploadUrl, pathname } = await createUploadUrlFn({
    data: {
      purpose,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
    },
  });

  await putWithProgress(uploadUrl, file, progress);

  return { fileName: file.name, pathname, contentType: file.type || null };
}

/** `fetch` não expõe progresso de upload — usa `XMLHttpRequest` só por isso. */
function putWithProgress(url: string, file: File, onProgress?: ProgressHandler): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress((event.loaded / event.total) * 100);
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Falha no upload (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Falha de rede durante o upload."));
    xhr.send(file);
  });
}
