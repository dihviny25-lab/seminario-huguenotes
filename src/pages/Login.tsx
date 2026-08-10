import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { loginFn } from "@/functions/auth";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
});

/** Login de professores/secretaria — acesso ao painel interno. */
export function Login() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    setServerError(null);
    try {
      await loginFn({ data: values });
      await navigate({ to: "/painel" });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Não foi possível entrar.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border/70 bg-card/70 p-6 shadow-soft sm:p-8">
        <div className="mb-6 text-center">
          <img src="/logo.png" alt="Seminário Huguenotes" className="mx-auto size-14" />
          <h1 className="mt-4 font-display text-xl font-semibold tracking-tight text-foreground">
            Painel do professor
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entre com seu e-mail e senha para lançar notas e faltas.
          </p>
        </div>

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
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <p className="text-right">
              <Link to="/esqueci-senha" className="text-xs font-medium text-accent hover:underline">
                Esqueci minha senha
              </Link>
            </p>

            {serverError ? (
              <p className="text-sm font-medium text-destructive">{serverError}</p>
            ) : null}

            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
