import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

export function DashboardCard({
  title,
  icon: Icon,
  viewAll,
  isLoading,
  isEmpty,
  emptyLabel,
  children,
}: {
  title: string;
  icon: LucideIcon;
  viewAll?: { to: string; params?: Record<string, string> };
  isLoading: boolean;
  isEmpty: boolean;
  emptyLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-foreground">
          <Icon className="size-4 shrink-0 text-accent" aria-hidden />
          {title}
        </h2>
        {viewAll ? (
          <Link
            to={viewAll.to}
            params={viewAll.params}
            className="text-xs font-medium text-muted-foreground hover:text-accent"
          >
            Ver tudo
          </Link>
        ) : null}
      </div>
      <div className="space-y-2">
        {isLoading ? (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        ) : isEmpty ? (
          <p className="rounded-md border border-border/70 bg-card/40 p-4 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
