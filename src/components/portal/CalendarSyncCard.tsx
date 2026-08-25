import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Calendar, Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getMyCalendarLinkFn, regenerateMyCalendarLinkFn } from "@/functions/calendarFeed";

/** Link .ics pra assinar no Google Calendar/Outlook/Apple Calendar — aulas, provas e prazos de tarefa. */
export function CalendarSyncCard() {
  const [copied, setCopied] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-calendar-link"],
    queryFn: () => getMyCalendarLinkFn(),
  });

  const regenerateMutation = useMutation({
    mutationFn: () => regenerateMyCalendarLinkFn(),
    onSuccess: () => toast.success("Novo link gerado — o link antigo parou de funcionar."),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar um novo link."),
  });

  const url = regenerateMutation.data?.url ?? data?.url;

  async function copyUrl() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading) return null;

  if (error || !url) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-t-2 border-border/70 border-t-destructive bg-card/70 p-4 shadow-soft">
        <Calendar className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-foreground">Agenda pessoal</span>
          <span className="block text-sm text-muted-foreground">
            Não foi possível gerar o link agora. Tente de novo mais tarde.
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-4 shadow-soft">
      <Calendar className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-foreground">Agenda pessoal</span>
        <span className="block text-sm text-muted-foreground">
          Cole esse link no Google Calendar, Outlook ou Apple Calendar ("assinar calendário por
          URL") pra ver aulas, provas e prazos de tarefa direto na sua agenda — atualiza sozinho.
        </span>

        <div className="mt-3 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md border border-border/70 bg-muted/40 px-2.5 py-1.5 text-xs text-foreground">
            {url}
          </code>
          <Button type="button" size="sm" variant="outline" onClick={copyUrl}>
            {copied ? (
              <Check className="size-3.5 shrink-0" aria-hidden />
            ) : (
              <Copy className="size-3.5 shrink-0" aria-hidden />
            )}
          </Button>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 text-muted-foreground"
          onClick={() => regenerateMutation.mutate()}
          disabled={regenerateMutation.isPending}
        >
          {regenerateMutation.isPending ? "Gerando…" : "Gerar novo link"}
        </Button>
      </span>
    </div>
  );
}
