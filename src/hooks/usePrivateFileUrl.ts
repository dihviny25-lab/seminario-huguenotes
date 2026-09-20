import { useQuery } from "@tanstack/react-query";

import { getPrivateFileAccessFn } from "@/functions/privateFiles";

/**
 * Resolve a URL autorizada (`/api/arquivo/$fileId`) de um arquivo privado.
 * `fileId` nulo/indefinido significa registro legado ainda não migrado —
 * nunca cai de volta pra URL pública antiga, mostra indisponível.
 */
export function usePrivateFileUrl(fileId: string | null | undefined) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["private-file-access", fileId],
    queryFn: () => getPrivateFileAccessFn({ data: { fileId: fileId! } }),
    enabled: Boolean(fileId),
    staleTime: 10 * 60 * 1000,
  });

  return {
    url: data?.url ?? null,
    isLoading: Boolean(fileId) && isLoading,
    isUnavailable: !fileId || isError,
  };
}
