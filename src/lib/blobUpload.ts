export type UploadedFile = { url: string; fileName: string };

/** Sobe um arquivo pro servidor, que grava no Vercel Blob e devolve a URL final. */
export async function uploadFile(file: File): Promise<UploadedFile> {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch("/api/upload", { method: "POST", body: formData });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Não foi possível enviar o arquivo.");
  }
  return (await response.json()) as UploadedFile;
}
