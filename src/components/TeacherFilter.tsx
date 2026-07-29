import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TeacherSummary } from "@/types/schedule";

interface TeacherFilterProps {
  teachers: TeacherSummary[];
  query: string;
  onQueryChange: (query: string) => void;
  selected: string | null;
  onSelect: (teacher: string | null) => void;
}

/** Campo de busca + lista de professores selecionáveis. */
export function TeacherFilter({
  teachers,
  query,
  onQueryChange,
  selected,
  onSelect,
}: TeacherFilterProps) {
  return (
    <div className="grid gap-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Pesquisar professor..."
          aria-label="Pesquisar professor"
          className="h-12 rounded-[1rem] border-border/70 bg-background/80 pl-9 shadow-sm"
        />
      </div>

      <ul className="flex flex-wrap gap-2">
        {teachers.map((teacher) => {
          const isActive = selected === teacher.name;
          return (
            <li key={teacher.name}>
              <button
                type="button"
                onClick={() => onSelect(isActive ? null : teacher.name)}
                aria-pressed={isActive}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border/70 bg-card/80 text-foreground hover:border-accent hover:-translate-y-0.5",
                )}
              >
                <span className="truncate">{teacher.name}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    isActive
                      ? "bg-primary-foreground/20"
                      : "bg-secondary text-secondary-foreground",
                  )}
                >
                  {teacher.totalLessons}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {teachers.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum professor encontrado para essa pesquisa.
        </p>
      )}
    </div>
  );
}
