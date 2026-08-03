/**
 * Extrai o ID de um vídeo a partir de uma URL do YouTube, aceitando os
 * formatos mais comuns (watch, youtu.be, embed, shorts). Retorna `null`
 * quando a URL não é reconhecida.
 */
export function extractYouTubeId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = parsed.pathname.slice(1);
    return id || null;
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    if (parsed.pathname === "/watch") {
      return parsed.searchParams.get("v");
    }
    for (const prefix of ["/embed/", "/shorts/", "/live/"]) {
      if (parsed.pathname.startsWith(prefix)) {
        return parsed.pathname.slice(prefix.length) || null;
      }
    }
  }

  return null;
}

/** URL de embed pronta pra usar num <iframe>. */
export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

/** URL de miniatura do vídeo. */
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
