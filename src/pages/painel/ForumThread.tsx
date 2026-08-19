import { useQuery } from "@tanstack/react-query";

import { PainelShell } from "@/components/painel/PainelShell";
import { ForumThreadView, threadKey } from "@/components/forum/ForumThreadView";
import { getThreadFn } from "@/functions/forum";

export function ForumThread({ threadId }: { threadId: string }) {
  const { data: thread } = useQuery({
    queryKey: threadKey(threadId),
    queryFn: () => getThreadFn({ data: { threadId } }),
  });

  return (
    <PainelShell title={thread?.title ?? "Carregando…"}>
      <ForumThreadView
        threadId={threadId}
        backTo="/painel/forum"
        backLabel="Voltar para o fórum"
        canModerateThread
        moderateAllPosts
        afterDeleteThreadTo="/painel/forum"
      />
    </PainelShell>
  );
}
