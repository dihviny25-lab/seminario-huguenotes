const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg"]);

function extensionOf(fileName: string): string {
  const withoutQuery = fileName.split(/[?#]/)[0];
  return (withoutQuery.split(".").pop() ?? "").toLowerCase();
}

export type ViewerKind = "pdf" | "image" | "unsupported";

/**
 * PDF é renderizado em canvas (react-pdf) e imagem num `<img>` — os dois
 * sempre online, nunca baixados. Word/PowerPoint não têm visualizador
 * confiável em navegador nenhum; a política de upload de apostila/livro
 * só aceita PDF (e imagem, apostila) por causa disso — `unsupported` só
 * deve aparecer pra conteúdo enviado antes dessa restrição existir.
 */
export function getViewerKind(fileName: string): ViewerKind {
  const ext = extensionOf(fileName);
  if (ext === "pdf") return "pdf";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  return "unsupported";
}
