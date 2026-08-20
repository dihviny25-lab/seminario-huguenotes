import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getFinancialReportFn } from "@/functions/payments";
import { PAYMENT_MODALITIES } from "@/lib/paymentModalities";

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function firstDayOfMonthIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const ALL_MODALITIES = "all";

/** Relatório financeiro por aluno num intervalo de datas — período/modalidade livres. */
export function FinancialReport() {
  const [from, setFrom] = useState(firstDayOfMonthIso());
  const [to, setTo] = useState(todayIso());
  const [modality, setModality] = useState(ALL_MODALITIES);
  const [appliedFilters, setAppliedFilters] = useState({ from, to, modality });

  const { data: report, isLoading } = useQuery({
    queryKey: ["financial-report", appliedFilters],
    queryFn: () =>
      getFinancialReportFn({
        data: {
          from: appliedFilters.from,
          to: appliedFilters.to,
          modality:
            appliedFilters.modality === ALL_MODALITIES ? undefined : appliedFilters.modality,
        },
      }),
  });

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <div className="space-y-1.5">
          <Label htmlFor="financial-from">De</Label>
          <Input
            id="financial-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="financial-to">Até</Label>
          <Input
            id="financial-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Modalidade</Label>
          <Select value={modality} onValueChange={setModality}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_MODALITIES}>Todas as modalidades</SelectItem>
              {PAYMENT_MODALITIES.map((m) => (
                <SelectItem key={m.id} value={m.name}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setAppliedFilters({ from, to, modality })}>Gerar</Button>
      </div>

      {isLoading || !report ? (
        <p className="mt-8 text-muted-foreground">Carregando relatório…</p>
      ) : (
        <div className="mt-8 rounded-md border border-border/70 bg-card/70 p-6 shadow-soft print:border-none print:bg-transparent print:p-0 print:shadow-none">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
                Seminário Huguenotes
              </p>
              <h2 className="font-display text-2xl font-semibold text-foreground">
                Relatório financeiro
              </h2>
              <p className="text-sm text-muted-foreground">
                {new Date(`${report.from}T00:00:00`).toLocaleDateString("pt-BR")} até{" "}
                {new Date(`${report.to}T00:00:00`).toLocaleDateString("pt-BR")}
                {report.modality ? ` · ${report.modality}` : ""}
              </p>
            </div>
            <Button onClick={() => window.print()} className="print:hidden">
              <Printer className="size-4" aria-hidden />
              Imprimir
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead className="text-center">Cobrado</TableHead>
                <TableHead className="text-center">Pago</TableHead>
                <TableHead className="text-center">Pendente</TableHead>
                <TableHead className="text-center">Vencido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    Nenhuma cobrança nesse período.
                  </TableCell>
                </TableRow>
              ) : (
                report.rows.map((row) => (
                  <TableRow key={row.studentId}>
                    <TableCell className="font-medium text-foreground">{row.studentName}</TableCell>
                    <TableCell className="text-center">
                      {formatCurrency(row.totalCharged)}
                    </TableCell>
                    <TableCell className="text-center text-success">
                      {formatCurrency(row.totalPaid)}
                    </TableCell>
                    <TableCell className="text-center">
                      {formatCurrency(row.totalPending)}
                    </TableCell>
                    <TableCell className="text-center text-destructive">
                      {formatCurrency(row.totalOverdue)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold text-foreground">Total</TableCell>
                <TableCell className="text-center font-semibold text-foreground">
                  {formatCurrency(report.totals.totalCharged)}
                </TableCell>
                <TableCell className="text-center font-semibold text-success">
                  {formatCurrency(report.totals.totalPaid)}
                </TableCell>
                <TableCell className="text-center font-semibold text-foreground">
                  {formatCurrency(report.totals.totalPending)}
                </TableCell>
                <TableCell className="text-center font-semibold text-destructive">
                  {formatCurrency(report.totals.totalOverdue)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </div>
  );
}
