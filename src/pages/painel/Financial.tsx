import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Ban, Clock, Printer, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { PainelShell } from "@/components/painel/PainelShell";
import { StatisticCard } from "@/components/StatisticCard";
import { Button } from "@/components/ui/button";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeletonRows } from "@/components/TableSkeletonRows";
import { getFinancialReportFn, getFinancialSummaryFn } from "@/functions/payments";
import { PAYMENT_MODALITIES } from "@/lib/paymentModalities";

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const chartConfig = {
  revenue: { label: "Receita", color: "var(--primary)" },
} satisfies ChartConfig;

/** Dashboard financeiro — visão geral de mensalidades e cobranças, só admin. */
export function Financial() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["financial-summary"],
    queryFn: () => getFinancialSummaryFn(),
  });

  return (
    <PainelShell
      title="Financeiro"
      description="Visão geral de mensalidades e cobranças do seminário."
    >
      {isLoading || !summary ? (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-lg border border-t-2 border-border/70 border-t-border bg-card/80 p-5 shadow-soft"
              >
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-3 h-8 w-28" />
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-border/70 bg-card/80 p-5 shadow-soft">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-4 h-64 w-full" />
          </div>
          <div className="space-y-3 rounded-lg border border-border/70 bg-card/80 p-5 shadow-soft">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatisticCard
              label="Recebido no mês"
              value={formatCurrency(summary.receivedThisMonth)}
              icon={Wallet}
            />
            <StatisticCard
              label="Pendente"
              value={formatCurrency(summary.pendingNotYetDue)}
              icon={Clock}
              hint="Ainda dentro do prazo"
            />
            <StatisticCard
              label="Vencido"
              value={formatCurrency(summary.overdue)}
              icon={AlertTriangle}
              hint={`${summary.overdueList.length} cobrança(s) em atraso`}
            />
            <StatisticCard label="Cancelado" value={formatCurrency(summary.canceled)} icon={Ban} />
          </div>

          <div className="rounded-lg border border-border/70 bg-card/80 p-5 shadow-soft">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold text-foreground">Receita mensal</h2>
              <p className="text-sm text-muted-foreground">
                Pago pelo site: {summary.paidAutomaticallyCount} (
                {formatCurrency(summary.paidAutomaticallyTotal)}) · Pago manualmente:{" "}
                {summary.paidManuallyCount} ({formatCurrency(summary.paidManuallyTotal)})
              </p>
            </div>
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <BarChart data={summary.monthlyRevenue}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />
                  }
                />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
              </BarChart>
            </ChartContainer>
          </div>

          <div className="overflow-hidden rounded-lg border border-border/70 bg-card/80 shadow-soft">
            <div className="p-5 pb-0">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Alunos inadimplentes
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Cobranças vencidas e ainda não pagas — clique num aluno pra gerenciar as cobranças
                dele.
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-center">Valor</TableHead>
                  <TableHead className="text-center">Dias em atraso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.overdueList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                      Nenhuma cobrança em atraso.
                    </TableCell>
                  </TableRow>
                ) : (
                  summary.overdueList.map((item) => (
                    <TableRow
                      key={item.chargeId}
                      className="animate-in fade-in slide-in-from-top-1 duration-200"
                    >
                      <TableCell className="font-medium text-foreground">
                        {item.studentName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.description}</TableCell>
                      <TableCell className="text-center text-destructive">
                        {formatCurrency(item.amount)}
                      </TableCell>
                      <TableCell className="text-center text-destructive">
                        {item.daysOverdue}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/painel/pagamentos" search={{ studentId: item.studentId }}>
                            Gerenciar
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <FinancialPeriodReport />
        </div>
      )}
    </PainelShell>
  );
}

function firstDayOfMonthIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const ALL_MODALITIES = "all";

/** Relatório financeiro por aluno num intervalo de datas livre — período/modalidade à escolha. */
function FinancialPeriodReport() {
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
    <div className="rounded-lg border border-t-2 border-border/70 border-t-accent bg-card/80 p-5 shadow-soft print:border-none print:bg-transparent print:p-0 print:shadow-none">
      <h2 className="font-display text-lg font-semibold text-foreground print:hidden">
        Relatório por período
      </h2>
      <p className="mt-1 text-sm text-muted-foreground print:hidden">
        Escolha um intervalo de datas (e opcionalmente uma modalidade) pra ver o total cobrado,
        pago, pendente e vencido por aluno.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3 print:hidden">
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
        {report ? (
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden />
            Imprimir
          </Button>
        ) : null}
      </div>

      {isLoading || !report ? (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-lg border border-t-2 border-border/70 border-t-border bg-card/80 p-5 shadow-soft"
              >
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-3 h-8 w-28" />
              </div>
            ))}
          </div>
          <div className="overflow-hidden rounded-md border border-border/70">
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
                <TableSkeletonRows columns={5} />
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-6 hidden text-sm text-muted-foreground print:block">
            {new Date(`${report.from}T00:00:00`).toLocaleDateString("pt-BR")} até{" "}
            {new Date(`${report.to}T00:00:00`).toLocaleDateString("pt-BR")}
            {report.modality ? ` · ${report.modality}` : ""}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-4 print:hidden lg:grid-cols-4">
            <StatisticCard
              label="Cobrado"
              value={formatCurrency(report.totals.totalCharged)}
              icon={Wallet}
            />
            <StatisticCard
              label="Pago"
              value={formatCurrency(report.totals.totalPaid)}
              icon={Wallet}
            />
            <StatisticCard
              label="Pendente"
              value={formatCurrency(report.totals.totalPending)}
              icon={Clock}
            />
            <StatisticCard
              label="Vencido"
              value={formatCurrency(report.totals.totalOverdue)}
              icon={AlertTriangle}
            />
          </div>

          <div className="mt-6 overflow-hidden rounded-md border border-border/70">
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
                    <TableRow
                      key={row.studentId}
                      className="animate-in fade-in slide-in-from-top-1 duration-200"
                    >
                      <TableCell className="font-medium text-foreground">
                        {row.studentName}
                      </TableCell>
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
        </>
      )}
    </div>
  );
}
