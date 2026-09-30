import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cardVariant } from "@/lib/cardVariants";
import {
  disablePush,
  enablePush,
  getCurrentPushSubscription,
  isPushSupported,
} from "@/lib/pushClient";

/** Card pra ativar/desativar notificações push neste dispositivo — funciona pra professor e aluno. */
export function NotificationToggle() {
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) {
      setSupported(false);
      setLoading(false);
      return;
    }
    getCurrentPushSubscription()
      .then((sub) => setEnabled(sub !== null))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle() {
    setBusy(true);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
        toast.success("Notificações desativadas neste dispositivo.");
      } else {
        await enablePush();
        setEnabled(true);
        toast.success("Notificações ativadas neste dispositivo.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível ativar as notificações.",
      );
    } finally {
      setBusy(false);
    }
  }

  // `loading` é só o tempo de checar a inscrição já existente — passageiro,
  // por isso mostra skeleton. `!supported` é definitivo (navegador não tem
  // suporte), por isso não mostra nada, sem novo carregamento depois.
  if (loading) {
    return (
      <div className={cardVariant("passive", "flex items-start gap-3")}>
        <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
        <span className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-full" />
        </span>
      </div>
    );
  }

  if (!supported) return null;

  return (
    <div className={cardVariant("passive", "flex items-start gap-3")}>
      {enabled ? (
        <Bell className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
      ) : (
        <BellOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-foreground">Notificações push</span>
        <span className="block text-sm text-muted-foreground">
          {enabled
            ? "Ativadas neste dispositivo — você recebe avisos de notas e do fórum."
            : "Ative para receber avisos de notas lançadas e respostas no fórum direto no celular (funciona melhor com o app instalado)."}
        </span>
        <Button
          size="sm"
          variant={enabled ? "outline" : "default"}
          className="mt-3"
          onClick={handleToggle}
          disabled={busy}
        >
          {busy ? "Aguarde…" : enabled ? "Desativar" : "Ativar notificações"}
        </Button>
      </span>
    </div>
  );
}
