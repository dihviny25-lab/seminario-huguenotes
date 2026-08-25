import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";

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
import { listMyChargesFn, type Charge } from "@/functions/payments";
import { PaymentMethodsDialog } from "@/pages/portal/PaymentMethodsDialog";
import { SelfScheduleChargesDialog } from "@/pages/portal/SelfScheduleChargesDialog";

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

/** Mensalidades e cobranças avulsas do próprio aluno, com as formas de pagamento disponíveis. */
export function PortalPayments() {
  const { data: charges, isLoading } = useQuery({
    queryKey: ["my-charges"],
    queryFn: () => listMyChargesFn(),
  });
  const [selectedCharge, setSelectedCharge] = useState<Charge | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  return (
    <PortalShell
      title="Mensalidades"
      description="Acompanhe e pague suas mensalidades e taxas do seminário."
    >
      <div className="mb-4 flex justify-end">
        <Button variant="outline" onClick={() => setScheduleOpen(true)}>
          <Settings2 className="size-4" aria-hidden />
          Configurar minhas mensalidades
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border border-border/70 bg-card/70 shadow-soft">
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
                    {charge.modality ? (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {charge.modality}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {charge.status === "pending" && charge.currentAmount !== charge.fullAmount ? (
                      <span className="flex flex-col">
                        <span className="font-medium text-success">
                          {formatAmount(charge.currentAmount)}
                        </span>
                        <span className="text-xs text-muted-foreground line-through">
                          {formatAmount(charge.fullAmount)}
                        </span>
                      </span>
                    ) : (
                      formatAmount(
                        charge.status === "paid"
                          ? (charge.paidAmount ?? charge.currentAmount)
                          : charge.currentAmount,
                      )
                    )}
                  </TableCell>
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
                      <Button size="sm" onClick={() => setSelectedCharge(charge)}>
                        Pagar
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

      <PaymentMethodsDialog
        charge={selectedCharge}
        onOpenChange={(open) => !open && setSelectedCharge(null)}
      />
      <SelfScheduleChargesDialog open={scheduleOpen} onOpenChange={setScheduleOpen} />
    </PortalShell>
  );
}
