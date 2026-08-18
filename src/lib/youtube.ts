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

/**
 * URL de embed pronta pra usar num <iframe>. Com `trackCompletion`, habilita
 * a IFrame API do YouTube (`enablejsapi`) pra detectar quando o vídeo termina.
 */
export function youtubeEmbedUrl(videoId: string, options?: { trackCompletion?: boolean }): string {
  if (!options?.trackCompletion) {
    return `https://www.youtube-nocookie.com/embed/${videoId}`;
  }
  const url = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
  url.searchParams.set("enablejsapi", "1");
  if (typeof window !== "undefined") {
    url.searchParams.set("origin", window.location.origin);
  }
  return url.toString();
}

/** URL de miniatura do vídeo. */
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
