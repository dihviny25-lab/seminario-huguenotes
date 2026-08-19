import { useQuery } from "@tanstack/react-query";

import { PortalShell } from "@/components/portal/PortalShell";
import { ForumThreadView, threadKey } from "@/components/forum/ForumThreadView";
import { getThreadFn } from "@/functions/forum";

export function PortalForumThread({ threadId }: { threadId: string }) {
  const { data: thread } = useQuery({
    queryKey: threadKey(threadId),
    queryFn: () => getThreadFn({ data: { threadId } }),
  });

  return (
    <PortalShell title={thread?.title ?? "Carregando…"}>
      <ForumThreadView
        threadId={threadId}
        backTo="/portal/forum"
        backLabel="Voltar para o fórum"
        canModerateThread={false}
        moderateAllPosts={false}
        afterDeleteThreadTo="/portal/forum"
      />
    </PortalShell>
  );
}
