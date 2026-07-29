import type { LucideIcon } from "lucide-react";

interface StatisticCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  hint?: string;
}

/** Cartão de indicador usado no resumo do dashboard. */
export function StatisticCard({ label, value, icon: Icon, hint }: StatisticCardProps) {
  return (
    <div className="rounded-[1.5rem] border border-border/70 bg-card/80 p-5 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-3 font-display text-3xl font-semibold tabular-nums tracking-tight text-foreground">
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className="rounded-2xl bg-primary/10 p-2.5 text-primary">
          <Icon className="size-4 shrink-0" aria-hidden />
        </div>
      </div>
    </div>
  );
}
