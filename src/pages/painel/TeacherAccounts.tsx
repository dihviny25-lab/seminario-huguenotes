import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { KeyRound, Pencil, Plus, ShieldOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PainelShell } from "@/components/painel/PainelShell";
import {
  createTeacherAccountFn,
  deleteTeacherAccountFn,
  listTeacherAccountsFn,
  revokeTeacherLoginFn,
  setTeacherPasswordFn,
  updateTeacherAccountFn,
  type TeacherAccount,
} from "@/functions/teacherAccounts";

const TEACHER_ACCOUNTS_KEY = ["teacher-accounts"] as const;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** Tela de administração: criar contas de professor e gerenciar login. */
export function TeacherAccounts() {
  const queryClient = useQueryClient();
  const { data: teachers, isLoading } = useQuery({
    queryKey: TEACHER_ACCOUNTS_KEY,
    queryFn: () => listTeacherAccountsFn(),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TeacherAccount | null>(null);
  const [settingPasswordFor, setSettingPasswordFor] = useState<TeacherAccount | null>(null);
  const [deleting, setDeleting] = useState<TeacherAccount | null>(null);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: TEACHER_ACCOUNTS_KEY });
  }

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeTeacherLoginFn({ data: { id } }),
    onSuccess: async () => {
      toast.success("Login removido.");
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível remover o login.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTeacherAccountFn({ data: { id } }),
    onSuccess: async () => {
      toast.success("Professor excluído.");
      setDeleting(null);
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível excluir.")),
  });

  return (
    <PainelShell
      title="Contas de professores"
      description="Cadastre professores e defina o e-mail/senha usados para entrar no painel."
    >
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Novo professor
        </Button>
      </div>

      <div className="overflow-hidden rounded-[1.25rem] border border-border/70 bg-card/70 shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Login</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : teachers && teachers.length > 0 ? (
              teachers.map((teacher) => (
                <TableRow key={teacher.id}>
                  <TableCell className="font-medium text-foreground">{teacher.name}</TableCell>
                  <TableCell className="text-muted-foreground">{teacher.email}</TableCell>
                  <TableCell>
                    <Badge variant={teacher.hasLogin ? "default" : "secondary"}>
                      {teacher.hasLogin ? "Ativo" : "Sem login"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        onClick={() => setEditing(teacher)}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={teacher.hasLogin ? "Redefinir senha" : "Definir senha"}
                        onClick={() => setSettingPasswordFor(teacher)}
                      >
                        <KeyRound className="size-4" aria-hidden />
                      </Button>
                      {teacher.hasLogin ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Remover login"
                          onClick={() => revokeMutation.mutate(teacher.id)}
                        >
                          <ShieldOff className="size-4" aria-hidden />
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Excluir"
                        onClick={() => setDeleting(teacher)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  Nenhum professor cadastrado ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CreateTeacherDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={invalidate} />
      {editing ? (
        <EditTeacherDialog
          teacher={editing}
          onOpenChange={(open) => !open && setEditing(null)}
          onSaved={invalidate}
        />
      ) : null}
      {settingPasswordFor ? (
        <SetPasswordDialog
          teacher={settingPasswordFor}
          onOpenChange={(open) => !open && setSettingPasswordFor(null)}
          onSaved={invalidate}
        />
      ) : null}

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso remove o cadastro do professor e seu acesso ao painel. As disciplinas dele
              continuam existindo, só ficam sem professor atribuído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
              disabled={deleteMutation.isPending}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PainelShell>
  );
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome."),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
  password: z.string().min(8, "Mínimo de 8 caracteres."),
});

function CreateTeacherDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<unknown>;
}) {
  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof createSchema>) => createTeacherAccountFn({ data: values }),
    onSuccess: async () => {
      toast.success("Professor criado.");
      form.reset();
      onOpenChange(false);
      await onCreated();
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível criar o professor.")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo professor</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
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
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                Criar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const editSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome."),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
});

function EditTeacherDialog({
  teacher,
  onOpenChange,
  onSaved,
}: {
  teacher: TeacherAccount;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<unknown>;
}) {
  const form = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: teacher.name, email: teacher.email },
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof editSchema>) =>
      updateTeacherAccountFn({ data: { id: teacher.id, ...values } }),
    onSuccess: async () => {
      toast.success("Dados atualizados.");
      onOpenChange(false);
      await onSaved();
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível salvar.")),
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {teacher.name}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const passwordSchema = z
  .object({
    password: z.string().min(8, "Mínimo de 8 caracteres."),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "As senhas não coincidem.",
    path: ["confirm"],
  });

function SetPasswordDialog({
  teacher,
  onOpenChange,
  onSaved,
}: {
  teacher: TeacherAccount;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<unknown>;
}) {
  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof passwordSchema>) =>
      setTeacherPasswordFn({ data: { id: teacher.id, password: values.password } }),
    onSuccess: async () => {
      toast.success("Senha definida.");
      onOpenChange(false);
      await onSaved();
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível definir a senha.")),
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {teacher.hasLogin ? "Redefinir" : "Definir"} senha de {teacher.name}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nova senha</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
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
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
