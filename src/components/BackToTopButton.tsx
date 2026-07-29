import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/** Botão flutuante "Voltar ao topo", visível após rolagem. */
export function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Voltar ao topo"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-5 z-50 grid size-11 place-items-center rounded-full border border-border bg-card text-foreground shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-accent"
    >
      <ArrowUp className="size-4" aria-hidden />
    </button>
  );
}
