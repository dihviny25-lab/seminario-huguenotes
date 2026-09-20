const OFFICE_EXTENSIONS = new Set(["doc", "docx", "ppt", "pptx"]);

function extensionOf(fileName: string): string {
  const withoutQuery = fileName.split(/[?#]/)[0];
  return (withoutQuery.split(".").pop() ?? "").toLowerCase();
}

/**
 * Word/PowerPoint não têm visualizador nativo em navegador nenhum — só dá
 * pra embutir com segurança arquivos que o próprio navegador renderiza
 * (PDF). Não usamos mais o Google Docs Viewer: ele exigia URL pública do
 * arquivo, e os blobs agora são `access: "private"` (só acessíveis via
 * `/api/arquivo/$fileId`, autorizado). Pra Office, o chamador deve oferecer
 * download em vez de tentar embutir.
 */
export function isEmbeddableInline(fileName: string): boolean {
  return !OFFICE_EXTENSIONS.has(extensionOf(fileName));
}

/** URL pra embutir um PDF num `<iframe>` só de leitura, sem a barra de ferramentas. */
export function getEmbeddableViewerUrl(fileUrl: string): string {
  return `${fileUrl}#toolbar=0&navpanes=0`;
}
