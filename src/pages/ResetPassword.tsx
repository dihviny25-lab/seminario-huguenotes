import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { resetStudentPasswordFn, resetTeacherPasswordFn } from "@/functions/passwordReset";

const schema = z
  .object({
    password: z.string().min(8, "Mínimo de 8 caracteres."),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "As senhas não coincidem.",
    path: ["confirm"],
  });

type Audience = "teacher" | "student";

const copy: Record<Audience, { loginPath: string; forgotPath: string }> = {
  teacher: { loginPath: "/login", forgotPath: "/esqueci-senha" },
  student: { loginPath: "/login-aluno", forgotPath: "/esqueci-senha-aluno" },
};

/** Define a nova senha a partir do link recebido por e-mail — mesma tela pra professor e aluno. */
export function ResetPassword({ audience, token }: { audience: Audience; token: string }) {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    setServerError(null);
    try {
      const resetFn = audience === "teacher" ? resetTeacherPasswordFn : resetStudentPasswordFn;
      await resetFn({ data: { token, password: values.password } });
      setSuccess(true);
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Não foi possível redefinir a senha.",
      );
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border/70 bg-card/70 p-6 shadow-soft sm:p-8">
        <div className="mb-6 text-center">
          <img src="/logo.png" alt="Seminário Huguenotes" className="mx-auto size-14" />
          <h1 className="mt-4 font-display text-xl font-semibold tracking-tight text-foreground">
            Redefinir senha
          </h1>
        </div>

        {success ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-foreground">Senha redefinida com sucesso.</p>
            <Button className="w-full" onClick={() => navigate({ to: copy[audience].loginPath })}>
              Ir pro login
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova senha</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar senha</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {serverError ? (
                <div className="space-y-2 text-center">
                  <p className="text-sm font-medium text-destructive">{serverError}</p>
                  <Link
                    to={copy[audience].forgotPath}
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    Pedir um novo link
                  </Link>
                </div>
              ) : null}

              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Salvando…" : "Redefinir senha"}
              </Button>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
}
