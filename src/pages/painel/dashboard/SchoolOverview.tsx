import { BookOpen, CalendarCheck, GraduationCap, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import { StatisticCard } from "@/components/StatisticCard";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { SchoolOverview as SchoolOverviewData } from "@/lib/teacherDashboard";

const performanceConfig = {
  average: { label: "Média", color: "var(--chart-1)" },
  attendancePercent: { label: "Frequência", color: "var(--chart-2)" },
} satisfies ChartConfig;

const progressConfig = {
  progressPercent: { label: "Aulas realizadas", color: "var(--primary)" },
} satisfies ChartConfig;

const riskConfig = {
  onTrack: { label: "Dentro dos mínimos", color: "var(--chart-2)" },
  gradeOnly: { label: "Risco por nota", color: "var(--chart-4)" },
  attendanceOnly: { label: "Risco por frequência", color: "var(--chart-1)" },
  both: { label: "Risco por nota e frequência", color: "var(--destructive)" },
} satisfies ChartConfig;

const percentFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const averageFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

function shortName(value: string): string {
  return value.length > 18 ? `${value.slice(0, 17)}…` : value;
}

export function SchoolOverview({ overview }: { overview: SchoolOverviewData }) {
  const riskData = Object.entries(overview.riskDistribution).map(([key, value]) => ({
    key,
    name: riskConfig[key as keyof typeof riskConfig].label,
    value,
    fill: riskConfig[key as keyof typeof riskConfig].color,
  }));
  const metrics = overview.disciplineMetrics.map((metric) => ({
    ...metric,
    shortName: shortName(metric.disciplineName),
  }));
  const chartWidth = Math.max(720, metrics.length * 105);

  return (
    <section className="mt-8 space-y-6" aria-labelledby="school-overview-title">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Gestão acadêmica
        </p>
        <h2 id="school-overview-title" className="mt-1 font-display text-2xl font-semibold">
          Visão geral da escola
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Indicadores consolidados das disciplinas, alunos ativos e aulas com chamada concluída.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatisticCard
          label="Alunos"
          value={overview.totals.activeStudents}
          icon={GraduationCap}
          hint="Matrículas ativas"
        />
        <StatisticCard
          label="Docentes"
          value={overview.totals.teachers}
          icon={Users}
          hint="Vinculados a disciplinas"
        />
        <StatisticCard label="Disciplinas" value={overview.totals.disciplines} icon={BookOpen} />
        <StatisticCard
          label="Aulas"
          value={overview.totals.lessonsGiven}
          icon={CalendarCheck}
          hint="Com chamada concluída"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <article className="min-w-0 rounded-lg border border-border/70 bg-card/80 p-5 shadow-soft">
          <h3 className="font-display text-lg font-semibold">Situação dos alunos</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Risco nas disciplinas em andamento: média abaixo de 7 ou frequência abaixo de 75%.
          </p>
          {overview.totals.activeStudents === 0 ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              Nenhum aluno ativo para analisar.
            </p>
          ) : (
            <>
              <ChartContainer
                config={riskConfig}
                className="mx-auto mt-4 h-64 w-full max-w-md"
                aria-label="Distribuição dos alunos por situação acadêmica"
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="key" />} />
                  <Pie
                    data={riskData}
                    dataKey="value"
                    nameKey="key"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {riskData.map((item) => (
                      <Cell key={item.key} fill={item.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <ul className="grid gap-2 text-sm sm:grid-cols-2">
                {riskData.map((item) => (
                  <li key={item.key} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                      <span
                        className="size-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: item.fill }}
                        aria-hidden
                      />
                      {item.name}
                    </span>
                    <strong className="tabular-nums">{item.value}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
        </article>

        <article className="min-w-0 rounded-lg border border-border/70 bg-card/80 p-5 shadow-soft">
          <h3 className="font-display text-lg font-semibold">Progresso das disciplinas</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Percentual de aulas realizadas em relação ao total planejado.
          </p>
          {metrics.length === 0 ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              Nenhuma disciplina cadastrada.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto pb-2">
              <div style={{ width: chartWidth }}>
                <ChartContainer
                  config={progressConfig}
                  className="h-72 w-full"
                  aria-label="Progresso das aulas por disciplina"
                >
                  <BarChart data={metrics} margin={{ left: 8, right: 8, top: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="shortName" tickLine={false} axisLine={false} interval={0} />
                    <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} width={42} />
                    <ReferenceLine y={100} stroke="var(--border)" strokeDasharray="4 4" />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(_, payload) => payload[0]?.payload.disciplineName}
                          formatter={(value, _name, item) => {
                            const row = item.payload;
                            return `${percentFormatter.format(Number(value))}% · ${row.lessonsGiven}/${row.lessonsPlanned} aulas`;
                          }}
                        />
                      }
                    />
                    <Bar
                      dataKey="progressPercent"
                      fill="var(--color-progressPercent)"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ChartContainer>
              </div>
            </div>
          )}
        </article>
      </div>

      <article className="min-w-0 rounded-lg border border-border/70 bg-card/80 p-5 shadow-soft">
        <h3 className="font-display text-lg font-semibold">Desempenho por disciplina</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Médias consideram somente alunos com notas lançadas; frequência considera alunos ativos e
          aulas com chamada concluída.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-[var(--chart-1)]" aria-hidden />
            Média (eixo de 0 a 10)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-[var(--chart-2)]" aria-hidden />
            Frequência (eixo de 0% a 100%)
          </span>
        </div>
        {metrics.length === 0 ? (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Nenhuma disciplina cadastrada.
          </p>
        ) : (
          <>
            <div className="mt-4 overflow-x-auto pb-2">
              <div style={{ width: chartWidth }}>
                <ChartContainer
                  config={performanceConfig}
                  className="h-80 w-full"
                  aria-label="Média e frequência por disciplina"
                >
                  <BarChart data={metrics} margin={{ left: 8, right: 8, top: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="shortName" tickLine={false} axisLine={false} interval={0} />
                    <YAxis
                      yAxisId="average"
                      domain={[0, 10]}
                      ticks={[0, 2, 4, 6, 8, 10]}
                      width={32}
                    />
                    <YAxis
                      yAxisId="attendance"
                      orientation="right"
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                      width={42}
                    />
                    <ReferenceLine
                      yAxisId="average"
                      y={7}
                      stroke="var(--destructive)"
                      strokeDasharray="4 4"
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(_, payload) => payload[0]?.payload.disciplineName}
                          formatter={(value, name) =>
                            name === "average"
                              ? `Média ${averageFormatter.format(Number(value))}`
                              : `Frequência ${percentFormatter.format(Number(value))}%`
                          }
                        />
                      }
                    />
                    <Bar
                      yAxisId="average"
                      dataKey="average"
                      fill="var(--color-average)"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Bar
                      yAxisId="attendance"
                      dataKey="attendancePercent"
                      fill="var(--color-attendancePercent)"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ChartContainer>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <caption className="sr-only">
                  Valores de média, frequência e progresso por disciplina
                </caption>
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Disciplina</th>
                    <th className="px-2 py-2 font-medium">Professor</th>
                    <th className="px-2 py-2 text-right font-medium">Média</th>
                    <th className="px-2 py-2 text-right font-medium">Frequência</th>
                    <th className="px-2 py-2 text-right font-medium">Aulas</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((metric) => (
                    <tr
                      key={metric.disciplineId}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="px-2 py-2 font-medium">{metric.disciplineName}</td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {metric.teacherName ?? "Sem professor"}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {metric.average === null
                          ? "Sem notas"
                          : averageFormatter.format(metric.average)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {metric.attendancePercent === null
                          ? "Sem chamadas"
                          : `${percentFormatter.format(metric.attendancePercent)}%`}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {metric.lessonsGiven}/{metric.lessonsPlanned}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </article>
    </section>
  );
}
