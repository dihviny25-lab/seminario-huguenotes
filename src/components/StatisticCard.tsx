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
    <div className="rounded-lg border border-t-2 border-border/70 border-t-accent bg-card/80 p-5 shadow-soft">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5 shrink-0 text-accent" aria-hidden />
        <p className="truncate text-xs font-semibold uppercase tracking-[0.14em]">{label}</p>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
