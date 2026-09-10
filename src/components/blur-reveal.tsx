import type { CSSProperties, JSX } from "react";

import { cn } from "@/lib/utils";

export interface BlurRevealProps {
  /** Texto a revelar. Só string — cada caractere é animado individualmente. */
  children: string;
  className?: string;
  /** Tag do elemento de fora (padrão "p"). */
  as?: keyof JSX.IntrinsicElements;
  /** Atraso antes do primeiro caractere, em ms. */
  delay?: number;
  /** Intervalo entre caracteres, em ms. */
  stagger?: number;
  /** Duração da revelação de cada caractere, em ms. */
  duration?: number;
  style?: CSSProperties;
}

/**
 * Revela um texto caractere a caractere, cada um saindo de um blur.
 * Puramente CSS (keyframes `blur-reveal-char` em src/styles.css) — a guarda
 * global de `prefers-reduced-motion` já encolhe a animação pra quase-instantânea
 * e zera o stagger. Uso pontual: momentos de destaque (ex.: título do hero da
 * home), nunca em tela que o usuário abre o tempo todo.
 */
export function BlurReveal({
  children,
  className,
  as: Tag = "p",
  delay = 0,
  stagger = 28,
  duration = 320,
  style,
}: BlurRevealProps) {
  const words = children.split(" ");
  let charIndex = 0;

  return (
    <Tag className={className} style={style}>
      <span className="sr-only">{children}</span>
      <span aria-hidden="true">
        {words.map((word, wordIndex) => (
          <span key={wordIndex} className="inline-block whitespace-nowrap">
            {word.split("").map((char) => {
              const thisDelay = delay + charIndex * stagger;
              charIndex += 1;
              return (
                <span
                  key={charIndex}
                  className={cn("blur-reveal-char")}
                  style={
                    {
                      "--blur-reveal-delay": `${thisDelay}ms`,
                      "--blur-reveal-duration": `${duration}ms`,
                    } as CSSProperties
                  }
                >
                  {char}
                </span>
              );
            })}
            {wordIndex < words.length - 1 ? (
              <span
                className="blur-reveal-char"
                style={
                  {
                    "--blur-reveal-delay": `${delay + charIndex * stagger}ms`,
                    "--blur-reveal-duration": `${duration}ms`,
                  } as CSSProperties
                }
              >
                {" "}
              </span>
            ) : null}
          </span>
        ))}
      </span>
    </Tag>
  );
}
