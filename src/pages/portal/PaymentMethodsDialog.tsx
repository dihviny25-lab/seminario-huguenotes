import { useState } from "react";
import { Banknote, Building2, Check, Copy, CreditCard } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDelayedUnmount } from "@/hooks/useDelayedUnmount";
import { PAYMENT_INFO } from "@/lib/paymentInfo";
import { cn } from "@/lib/utils";

function formatAmount(amount: string): string {
  return Number(amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PaymentMethodsDialog({
  charge,
  onOpenChange,
}: {
  charge: { description: string; currentAmount: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  // "Copiado!" desaparece sozinho depois de 2s — o delayed unmount dá tempo do
  // fade/slide de saída rodar antes de voltar pro rótulo "Copiar".
  const copiedMounted = useDelayedUnmount(copied, 200);

  async function copyPixKey() {
    await navigator.clipboard.writeText(PAYMENT_INFO.pix.chave);
    toast.success("Chave PIX copiada!");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={charge !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Como pagar</DialogTitle>
          {charge ? (
            <DialogDescription>
              {charge.description} — {formatAmount(charge.currentAmount)}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-border/70 bg-card/70 p-4 shadow-soft">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="rounded-md bg-accent/10 p-2 text-accent">
                <Banknote className="size-4" aria-hidden />
              </div>
              <h3 className="font-medium text-foreground">PIX</h3>
            </div>
            <p className="text-xs text-muted-foreground">Chave {PAYMENT_INFO.pix.tipo}</p>
            <button
              type="button"
              onClick={copyPixKey}
              className="mt-2 flex w-full items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/40 px-3 py-2.5 text-left transition-colors hover:bg-accent/10"
            >
              <span className="truncate font-mono text-sm font-semibold text-foreground">
                {PAYMENT_INFO.pix.chave}
              </span>
              <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-accent">
                {copiedMounted ? (
                  <span
                    className={cn(
                      "flex items-center gap-1.5 transition-all duration-200",
                      copied ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0",
                    )}
                  >
                    <Check className="size-3.5 shrink-0" aria-hidden />
                    Copiado!
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Copy className="size-3.5 shrink-0" aria-hidden />
                    Copiar
                  </span>
                )}
              </span>
            </button>
          </div>

          <div className="rounded-md border border-border/70 bg-card/70 p-4 shadow-soft">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="rounded-md bg-accent/10 p-2 text-accent">
                <Building2 className="size-4" aria-hidden />
              </div>
              <h3 className="font-medium text-foreground">Transferência (TED/DOC)</h3>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                {PAYMENT_INFO.transferencia.nomeTitular}
              </p>
              <p>{PAYMENT_INFO.transferencia.banco}</p>
              <p>CNPJ: {PAYMENT_INFO.transferencia.documento}</p>
              <p>Agência: {PAYMENT_INFO.transferencia.agencia}</p>
              <p>Conta: {PAYMENT_INFO.transferencia.conta}</p>
            </div>
          </div>

          <div className="rounded-md border border-border/70 bg-card/70 p-4 shadow-soft">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="rounded-md bg-accent/10 p-2 text-accent">
                <CreditCard className="size-4" aria-hidden />
              </div>
              <h3 className="font-medium text-foreground">Cartão ou boleto</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Pague com cartão de crédito ou gere um boleto pelo Mercado Pago.
            </p>
            <Button asChild className="mt-3 w-full">
              <a href={PAYMENT_INFO.linkMercadoPago} target="_blank" rel="noreferrer">
                Pagar com Mercado Pago
              </a>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Depois de pagar via PIX ou transferência, avise a secretaria (ou envie o comprovante)
            para que sua mensalidade seja confirmada aqui no portal.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
