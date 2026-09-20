import type { ReactNode } from "react";
import { Download } from "lucide-react";

import { usePrivateFileUrl } from "@/hooks/usePrivateFileUrl";

/**
 * Link de download pra um arquivo privado. `fileId` nulo com `fileUrl`
 * presente é um registro legado ainda não migrado — nunca cai pra URL
 * pública antiga, mostra que está indisponível até a migração manual.
 */
export function PrivateFileLink({
  fileId,
  fileUrl,
  fileName,
  className,
  children,
}: {
  fileId: string | null;
  fileUrl: string | null;
  fileName: string;
  className?: string;
  children?: ReactNode;
}) {
  const { url } = usePrivateFileUrl(fileId);

  if (fileId) {
    if (!url) {
      return <span className="text-xs text-muted-foreground">Carregando arquivo…</span>;
    }
    return (
      <a href={url} target="_blank" rel="noreferrer" className={className}>
        {children ?? (
          <>
            <Download className="size-3.5 shrink-0" aria-hidden />
            {fileName}
          </>
        )}
      </a>
    );
  }

  if (fileUrl) {
    return (
      <span className="text-xs text-muted-foreground">Arquivo indisponível para migração.</span>
    );
  }

  return null;
}
