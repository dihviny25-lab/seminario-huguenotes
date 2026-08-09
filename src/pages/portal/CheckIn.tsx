import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

import { PortalShell } from "@/components/portal/PortalShell";
import { checkInFn } from "@/functions/attendance";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** Aberta ao escanear o QR da chamada — confirma a presença automaticamente, sem precisar clicar em nada. */
export function CheckIn({ lessonId, token }: { lessonId: string; token: string }) {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    checkInFn({ data: { lessonId, token } })
      .then((result) => {
        setStatus("success");
        setMessage(`Presença confirmada em ${result.disciplineName} — ${result.lessonLabel}.`);
      })
      .catch((error) => {
        setStatus("error");
        setMessage(errorMessage(error, "Não foi possível confirmar sua presença."));
      });
  }, [lessonId, token]);

  return (
    <PortalShell title="Chamada" description="Confirmação de presença por QR code.">
      <div className="flex flex-col items-center gap-4 rounded-[1.25rem] border border-border/70 bg-card/70 p-10 text-center shadow-soft">
        {status === "loading" ? (
          <p className="text-muted-foreground">Confirmando sua presença…</p>
        ) : status === "success" ? (
          <>
            <CheckCircle2 className="size-10 text-success" aria-hidden />
            <p className="font-medium text-foreground">{message}</p>
          </>
        ) : (
          <>
            <XCircle className="size-10 text-destructive" aria-hidden />
            <p className="font-medium text-foreground">{message}</p>
          </>
        )}
      </div>
    </PortalShell>
  );
}
