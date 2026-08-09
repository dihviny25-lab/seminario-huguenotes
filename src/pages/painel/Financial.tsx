import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Ban, Clock, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { PainelShell } from "@/components/painel/PainelShell";
import { StatisticCard } from "@/components/StatisticCard";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getFinancialSummaryFn } from "@/functions/payments";

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
        <p className="text-muted-foreground">Carregando…</p>
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

          <div className="rounded-[1.5rem] border border-border/70 bg-card/80 p-5 shadow-soft">
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

          <div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-card/80 shadow-soft">
            <div className="p-5 pb-0">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Alunos inadimplentes
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Cobranças vencidas e ainda não pagas — busque o aluno em "Pagamentos" pra gerenciar.
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-center">Valor</TableHead>
                  <TableHead className="text-center">Dias em atraso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.overdueList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                      Nenhuma cobrança em atraso.
                    </TableCell>
                  </TableRow>
                ) : (
                  summary.overdueList.map((item) => (
                    <TableRow key={item.chargeId}>
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
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </PainelShell>
  );
}
