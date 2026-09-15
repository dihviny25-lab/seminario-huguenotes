import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function DashboardCard({
  title,
  icon: Icon,
  tone,
  viewAll,
  isLoading,
  isEmpty,
  emptyLabel,
  children,
}: {
  title: string;
  icon: LucideIcon;
  /** "action" pede atenção do professor agora; "info" é só panorama. */
  tone: "action" | "info";
  viewAll?: { to: string; params?: Record<string, string> };
  isLoading: boolean;
  isEmpty: boolean;
  emptyLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center justify-between">
        <h2
          className={cn(
            "flex items-center gap-1.5 font-display text-base",
            tone === "action" ? "font-semibold text-foreground" : "font-medium text-foreground/80",
          )}
        >
          <Icon
            className={cn(
              "size-4 shrink-0",
              tone === "action" ? "text-accent" : "text-muted-foreground",
            )}
            aria-hidden
          />
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
      <div className={tone === "action" ? "space-y-2" : "divide-y divide-border/50"}>
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
