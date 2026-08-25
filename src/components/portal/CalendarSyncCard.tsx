import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Calendar, Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMyCalendarLinkFn, regenerateMyCalendarLinkFn } from "@/functions/calendarFeed";

const PROVIDER_STEPS = [
  {
    id: "google",
    label: "Google Calendar",
    steps: [
      "Abra o Google Calendar no computador (calendar.google.com).",
      'No menu à esquerda, clique no "+" ao lado de "Outras agendas".',
      'Escolha "Da URL".',
      'Cole o link copiado acima e clique em "Adicionar agenda".',
    ],
    note: "No celular o Google Calendar não deixa adicionar por URL — faça pelo computador uma vez, que ela aparece sincronizada no app depois.",
  },
  {
    id: "outlook",
    label: "Outlook",
    steps: [
      "Abra o Outlook Calendar (outlook.com/calendar) ou o app do Outlook.",
      'Clique em "Adicionar calendário" → "Assinar da web".',
      'Cole o link, dê um nome (ex.: "Seminário Huguenotes") e confirme.',
    ],
  },
  {
    id: "apple",
    label: "Apple Calendar",
    steps: [
      'No Mac: abra o app Calendário → menu "Arquivo" → "Nova Assinatura de Calendário".',
      'No iPhone/iPad: Ajustes → Calendário → Contas → Adicionar Conta → "Outra" → "Adicionar Assinatura de Calendário".',
      "Cole o link e confirme — pode deixar as opções padrão.",
    ],
  },
];

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
          Assine esse link no seu app de calendário pra ver aulas, provas e prazos de tarefa direto
          na sua agenda — atualiza sozinho, sem precisar fazer nada de novo depois.
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

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Como assinar
          </p>
          <Tabs defaultValue="google" className="mt-2">
            <TabsList>
              {PROVIDER_STEPS.map((provider) => (
                <TabsTrigger key={provider.id} value={provider.id}>
                  {provider.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {PROVIDER_STEPS.map((provider) => (
              <TabsContent key={provider.id} value={provider.id}>
                <ol className="list-decimal space-y-1.5 pl-4 text-sm text-muted-foreground">
                  {provider.steps.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
                {provider.note ? (
                  <p className="mt-2 text-xs text-muted-foreground">{provider.note}</p>
                ) : null}
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3 text-muted-foreground"
          onClick={() => regenerateMutation.mutate()}
          disabled={regenerateMutation.isPending}
        >
          {regenerateMutation.isPending ? "Gerando…" : "Gerar novo link"}
        </Button>
      </span>
    </div>
  );
}
