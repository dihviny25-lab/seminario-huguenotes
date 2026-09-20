import { Skeleton } from "@/components/ui/skeleton";
import { usePrivateFileUrl } from "@/hooks/usePrivateFileUrl";

/**
 * `<video>` autorizado pra vídeo-aula hospedada no Blob. `fileId` nulo é
 * registro legado ainda não migrado — nunca cai pra URL pública antiga.
 */
export function PrivateVideoPlayer({
  fileId,
  className,
  onEnded,
}: {
  fileId: string | null;
  className?: string;
  onEnded?: () => void;
}) {
  const { url, isLoading } = usePrivateFileUrl(fileId);

  if (!fileId) {
    return (
      <div
        className={`flex items-center justify-center bg-black text-center text-sm text-white/70 ${className ?? ""}`}
      >
        Vídeo indisponível para migração.
      </div>
    );
  }

  if (isLoading || !url) {
    return <Skeleton className={className ?? "aspect-video w-full"} />;
  }

  return <video src={url} controls className={className} onEnded={onEnded} />;
}
