import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link } from "@tanstack/react-router";
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
import {
  requestStudentPasswordResetFn,
  requestTeacherPasswordResetFn,
} from "@/functions/passwordReset";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
});

type Audience = "teacher" | "student";

const copy: Record<Audience, { context: string; loginPath: string }> = {
  teacher: { context: "no painel do professor", loginPath: "/login" },
  student: { context: "no portal do aluno", loginPath: "/login-aluno" },
};

/** Pede o e-mail e dispara o link de redefinição — mesma tela pra professor e aluno. */
export function ForgotPassword({ audience }: { audience: Audience }) {
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    setMessage(null);
    const requestFn =
      audience === "teacher" ? requestTeacherPasswordResetFn : requestStudentPasswordResetFn;
    const result = await requestFn({ data: values });
    setMessage(result.message);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border/70 bg-card/70 p-6 shadow-soft sm:p-8">
        <div className="mb-6 text-center">
          <img src="/logo.png" alt="Seminário Huguenotes" className="mx-auto size-14" />
          <h1 className="mt-4 font-display text-xl font-semibold tracking-tight text-foreground">
            Esqueci minha senha
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Informe o e-mail cadastrado {copy[audience].context} — se existir, mandamos um link pra
            redefinir a senha.
          </p>
        </div>

        {message ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-foreground">{message}</p>
            <Link
              to={copy[audience].loginPath}
              className="text-sm font-medium text-accent hover:underline"
            >
              Voltar pro login
            </Link>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Enviando…" : "Enviar link de redefinição"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <Link
                  to={copy[audience].loginPath}
                  className="font-medium text-accent hover:underline"
                >
                  Voltar pro login
                </Link>
              </p>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
}
