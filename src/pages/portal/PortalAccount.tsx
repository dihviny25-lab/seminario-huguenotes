import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { NotificationToggle } from "@/components/NotificationToggle";
import { PortalShell } from "@/components/portal/PortalShell";
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
  changeMyStudentPasswordFn,
  getCurrentStudentFn,
  updateMyStudentProfileFn,
} from "@/functions/studentAuth";

const profileSchema = z.object({
  phone: z.string().trim().optional(),
  birthDate: z.string().trim().optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    newPassword: z.string().min(8, "Mínimo de 8 caracteres."),
    confirm: z.string(),
  })
  .refine((data) => data.newPassword === data.confirm, {
    message: "As senhas não coincidem.",
    path: ["confirm"],
  });

/** Minha conta — informações pessoais, notificações e troca de senha. */
export function PortalAccount() {
  const queryClient = useQueryClient();
  const { data: student } = useQuery({
    queryKey: ["current-student"],
    queryFn: () => getCurrentStudentFn(),
  });

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { phone: "", birthDate: "" },
  });

  useEffect(() => {
    if (student) {
      profileForm.reset({ phone: student.phone ?? "", birthDate: student.birthDate ?? "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student]);

  const profileMutation = useMutation({
    mutationFn: (values: z.infer<typeof profileSchema>) =>
      updateMyStudentProfileFn({ data: values }),
    onSuccess: async () => {
      toast.success("Informações atualizadas.");
      await queryClient.invalidateQueries({ queryKey: ["current-student"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar."),
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });

  async function onSubmitPassword(values: z.infer<typeof passwordSchema>) {
    try {
      await changeMyStudentPasswordFn({
        data: { currentPassword: values.currentPassword, newPassword: values.newPassword },
      });
      toast.success("Senha atualizada.");
      passwordForm.reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível trocar a senha.");
    }
  }

  return (
    <PortalShell
      title="Minha conta"
      description="Suas informações pessoais, notificações e senha de acesso."
    >
      <div className="max-w-sm rounded-md border border-border/70 bg-card/70 p-6 shadow-soft">
        <h2 className="font-display text-base font-semibold text-foreground">
          Informações pessoais
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajude a secretaria a manter seu cadastro em dia.
        </p>
        <Form {...profileForm}>
          <form
            className="mt-4 space-y-4"
            onSubmit={profileForm.handleSubmit((values) => profileMutation.mutate(values))}
          >
            <FormField
              control={profileForm.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone / WhatsApp</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="(00) 00000-0000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={profileForm.control}
              name="birthDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de nascimento</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={profileMutation.isPending}>
              {profileMutation.isPending ? "Salvando…" : "Salvar informações"}
            </Button>
          </form>
        </Form>
      </div>

      <div className="mt-6 max-w-sm">
        <NotificationToggle />
      </div>

      <div className="mt-6 max-w-sm rounded-md border border-border/70 bg-card/70 p-6 shadow-soft">
        <h2 className="font-display text-base font-semibold text-foreground">Trocar senha</h2>
        <Form {...passwordForm}>
          <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)} className="mt-4 space-y-4">
            <FormField
              control={passwordForm.control}
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
              control={passwordForm.control}
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
              control={passwordForm.control}
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
            <Button type="submit" className="w-full" disabled={passwordForm.formState.isSubmitting}>
              {passwordForm.formState.isSubmitting ? "Salvando…" : "Salvar nova senha"}
            </Button>
          </form>
        </Form>
      </div>
    </PortalShell>
  );
}
