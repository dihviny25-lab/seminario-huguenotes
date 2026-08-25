import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { confirmStudentEmailFn } from "@/functions/studentAuth";

/** Confirma o e-mail automaticamente a partir do token no link recebido. */
export function ConfirmEmail({ token }: { token: string }) {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    confirmStudentEmailFn({ data: { token } })
      .then(() => setStatus("success"))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Não foi possível confirmar o e-mail.");
        setStatus("error");
      });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border/70 bg-card/70 p-6 text-center shadow-soft sm:p-8">
        <img src="/logo.png" alt="Seminário Huguenotes" className="mx-auto size-14" />

        {status === "loading" ? (
          <p className="mt-6 text-muted-foreground">Confirmando seu e-mail…</p>
        ) : status === "success" ? (
          <>
            <CheckCircle2 className="mx-auto mt-6 size-10 text-success" aria-hidden />
            <p className="mt-3 font-medium text-foreground">E-mail confirmado com sucesso.</p>
          </>
        ) : (
          <>
            <XCircle className="mx-auto mt-6 size-10 text-destructive" aria-hidden />
            <p className="mt-3 text-sm text-destructive">{error}</p>
          </>
        )}

        <Button asChild className="mt-6 w-full">
          <Link to="/portal/conta">Ir pra Minha conta</Link>
        </Button>
      </div>
    </div>
  );
}
