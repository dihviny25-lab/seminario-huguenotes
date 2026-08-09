import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
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
import { changeMyStudentPasswordFn } from "@/functions/studentAuth";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    newPassword: z.string().min(8, "Mínimo de 8 caracteres."),
    confirm: z.string(),
  })
  .refine((data) => data.newPassword === data.confirm, {
    message: "As senhas não coincidem.",
    path: ["confirm"],
  });

/** Troca obrigatória de senha no primeiro acesso do aluno ao portal. */
export function StudentChangePassword() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    setServerError(null);
    try {
      await changeMyStudentPasswordFn({
        data: { currentPassword: values.currentPassword, newPassword: values.newPassword },
      });
      await navigate({ to: "/portal" });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Não foi possível trocar a senha.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border/70 bg-card/70 p-6 shadow-soft sm:p-8">
        <div className="mb-6 text-center">
          <img src="/logo.png" alt="Seminário Huguenotes" className="mx-auto size-14" />
          <h1 className="mt-4 font-display text-xl font-semibold tracking-tight text-foreground">
            Troque sua senha
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Por segurança, defina uma senha só sua antes de continuar.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha atual</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
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
                  <FormLabel>Confirmar nova senha</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {serverError ? (
              <p className="text-sm font-medium text-destructive">{serverError}</p>
            ) : null}

            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Salvando…" : "Salvar e continuar"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
