import { useEffect, useRef } from "react";

/** Só o suficiente da IFrame API do YouTube pra detectar o fim do vídeo. */
interface YouTubePlayer {
  destroy: () => void;
}
interface YouTubeNamespace {
  Player: new (
    element: HTMLElement,
    options: { events: { onStateChange: (event: { data: number }) => void } },
  ) => YouTubePlayer;
  PlayerState: { ENDED: number };
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YouTubeNamespace> | null = null;

function loadYouTubeIframeApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiPromise;
}

/**
 * Liga um <iframe> (precisa ter sido criado com `enablejsapi=1`) ao player
 * do YouTube e chama `onComplete` uma única vez quando o vídeo termina.
 */
export function useYouTubeCompletion(onComplete: () => void) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const firedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (typeof window === "undefined" || !iframeRef.current) return;
    let player: YouTubePlayer | null = null;
    let cancelled = false;

    loadYouTubeIframeApi().then((YT) => {
      if (cancelled || !iframeRef.current) return;
      player = new YT.Player(iframeRef.current, {
        events: {
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.ENDED && !firedRef.current) {
              firedRef.current = true;
              onCompleteRef.current();
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      player?.destroy();
    };
  }, []);

  return iframeRef;
}
