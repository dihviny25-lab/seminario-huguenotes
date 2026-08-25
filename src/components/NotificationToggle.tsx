import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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

  if (!supported || loading) return null;

  return (
    <div className="flex items-start gap-3 rounded-md border border-t-2 border-border/70 border-t-accent bg-card/70 p-4 shadow-soft">
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
