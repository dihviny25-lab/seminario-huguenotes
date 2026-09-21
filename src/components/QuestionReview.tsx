import { CheckCircle2, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type ReviewQuestion = {
  id: string;
  text: string;
  options: Array<{ id: string; text: string; isCorrect?: boolean }>;
  selectedOptionId: string | null;
};

/**
 * Revisão pergunta-a-pergunta de uma prova ou tarefa objetiva já corrigida:
 * marca a alternativa que o aluno escolheu e, se ela não for a certa,
 * destaca qual era. `options[].isCorrect` só vem preenchido pelo servidor
 * depois da correção — antes disso essas perguntas nem chegam aqui.
 */
export function QuestionReview({ question, index }: { question: ReviewQuestion; index: number }) {
  const gotItRight = question.options.some(
    (option) => option.id === question.selectedOptionId && option.isCorrect,
  );

  return (
    <div
      className={cn(
        "animate-in rounded-md border border-t-2 bg-card/70 p-4 shadow-soft fade-in slide-in-from-top-1 duration-200",
        gotItRight ? "border-border/70 border-t-success" : "border-border/70 border-t-destructive",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-foreground">
          {index + 1}. {question.text}
        </p>
        {gotItRight ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
        ) : (
          <X className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        )}
      </div>
      <div className="mt-3 grid gap-1.5">
        {question.options.map((option) => {
          const wasSelected = option.id === question.selectedOptionId;
          return (
            <div
              key={option.id}
              className={cn(
                "rounded-md border px-3 py-2 text-sm",
                option.isCorrect
                  ? "border-success/50 bg-success-soft/40 text-foreground"
                  : wasSelected
                    ? "border-destructive/50 bg-destructive/10 text-foreground"
                    : "border-border/70 text-muted-foreground",
              )}
            >
              {option.text}
              {wasSelected ? (
                <span className="ml-1.5 text-xs font-medium">(sua resposta)</span>
              ) : null}
              {option.isCorrect ? (
                <span className="ml-1.5 text-xs font-medium">(correta)</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
