import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

/** Alterna entre a biblioteca de apostilas e a de slides — sem estado próprio. */
export function ContentTypeToggle({ active }: { active: "apostilas" | "slides" }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/70 p-1">
      <Link
        to="/portal/apostilas"
        className={cn(
          "rounded-full px-3 py-1 text-sm font-medium transition-colors",
          active === "apostilas"
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Apostilas
      </Link>
      <Link
        to="/portal/slides"
        className={cn(
          "rounded-full px-3 py-1 text-sm font-medium transition-colors",
          active === "slides"
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Slides
      </Link>
    </div>
  );
}
