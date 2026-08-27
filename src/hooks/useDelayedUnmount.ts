import { useEffect, useState } from "react";

/**
 * Mantém um elemento montado por `exitDurationMs` a mais depois que `show`
 * vira `false`, pra dar tempo de uma transição CSS de saída rodar antes do
 * React desmontar de verdade (conditional renders comuns — `{show && <X/>}`
 * — desmontam instantaneamente e não dá tempo de nenhuma animação tocar).
 */
export function useDelayedUnmount(show: boolean, exitDurationMs = 200): boolean {
  const [mounted, setMounted] = useState(show);

  useEffect(() => {
    if (show) {
      setMounted(true);
      return;
    }
    const timeout = setTimeout(() => setMounted(false), exitDurationMs);
    return () => clearTimeout(timeout);
  }, [show, exitDurationMs]);

  return mounted;
}
