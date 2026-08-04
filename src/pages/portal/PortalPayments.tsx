import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { PortalShell } from "@/components/portal/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listMyChargesFn, payMyChargeFn, type Charge } from "@/functions/payments";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatAmount(amount: string): string {
  return Number(amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

const statusLabel: Record<Charge["status"], string> = {
  pending: "Pendente",
  paid: "Pago",
  canceled: "Cancelado",
};

/** Mensalidades e cobranças avulsas do próprio aluno, com link de pagamento pelo Mercado Pago. */
export function PortalPayments() {
  const { data: charges, isLoading } = useQuery({
    queryKey: ["my-charges"],
    queryFn: () => listMyChargesFn(),
  });
  const [payingId, setPayingId] = useState<string | null>(null);
  const [returnedFromCheckout] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("payment_id"),
  );

  const payMutation = useMutation({
    mutationFn: (chargeId: string) => payMyChargeFn({ data: { chargeId } }),
    onMutate: (chargeId) => setPayingId(chargeId),
    onSuccess: (result) => {
      window.location.href = result.initPoint;
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Não foi possível iniciar o pagamento."));
      setPayingId(null);
    },
  });

  return (
    <PortalShell
      title="Mensalidades"
      description="Acompanhe e pague suas mensalidades e taxas do seminário."
    >
      {returnedFromCheckout ? (
        <p className="mb-4 rounded-[1.25rem] border border-warning-border bg-warning-soft px-4 py-3 text-sm text-warning">
          Estamos confirmando seu pagamento — pode levar alguns instantes até o status atualizar
          aqui embaixo.
        </p>
      ) : null}
      <div className="overflow-hidden rounded-[1.25rem] border border-border/70 bg-card/70 shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : charges && charges.length > 0 ? (
              charges.map((charge) => (
                <TableRow key={charge.id}>
                  <TableCell className="font-medium text-foreground">
                    {charge.description}
                  </TableCell>
                  <TableCell>{formatAmount(charge.amount)}</TableCell>
                  <TableCell>{formatDate(charge.dueDate)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        charge.status === "paid"
                          ? "default"
                          : charge.status === "canceled"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {statusLabel[charge.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {charge.status === "pending" ? (
                      <Button
                        size="sm"
                        onClick={() => payMutation.mutate(charge.id)}
                        disabled={payingId === charge.id}
                      >
                        {payingId === charge.id ? "Abrindo…" : "Pagar"}
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  Nenhuma cobrança no momento.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </PortalShell>
  );
}
