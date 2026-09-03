export function threadKey(threadId: string) {
  return ["forum-thread", threadId] as const;
}
