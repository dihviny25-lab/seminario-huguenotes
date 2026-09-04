const OFFICE_EXTENSIONS = new Set(["doc", "docx", "ppt", "pptx"]);

function extensionOf(fileUrl: string): string {
  const withoutQuery = fileUrl.split(/[?#]/)[0];
  return (withoutQuery.split(".").pop() ?? "").toLowerCase();
}

/**
 * URL pra embutir um documento num `<iframe>` só de leitura. PDF é
 * renderizado nativamente pelo navegador — some com a barra de ferramentas
 * pra não expor o botão de download. Word/PowerPoint não têm visualizador
 * nativo em navegador nenhum (o iframe fica em branco, ou o navegador
 * simplesmente baixa o arquivo); passamos pelo Google Docs Viewer, que
 * renderiza esses formatos como imagem de página, sem baixar nada — exige
 * que `fileUrl` seja publicamente acessível (é, os blobs são `access: "public"`).
 */
export function getEmbeddableViewerUrl(fileUrl: string): string {
  if (OFFICE_EXTENSIONS.has(extensionOf(fileUrl))) {
    return `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`;
  }
  return `${fileUrl}#toolbar=0&navpanes=0`;
}
