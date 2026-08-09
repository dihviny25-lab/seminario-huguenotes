import { CalendarCheck, CalendarClock } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ScheduleStatus } from "@/types/schedule";

interface StatusBadgeProps {
  status: ScheduleStatus;
  /** Período publicado, exibido quando a data está confirmada. */
  period?: string;
  className?: string;
}

/** Selo visual que diferencia datas confirmadas de datas pendentes. */
export function StatusBadge({ status, period, className }: StatusBadgeProps) {
  const confirmed = status === "confirmed";
  const Icon = confirmed ? CalendarCheck : CalendarClock;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium tracking-tight",
        confirmed
          ? "border-success-border bg-success-soft text-success"
          : "border-warning-border bg-warning-soft text-warning",
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {confirmed ? <span>Confirmado{period ? ` · ${period}` : ""}</span> : <span>A confirmar</span>}
    </span>
  );
}
