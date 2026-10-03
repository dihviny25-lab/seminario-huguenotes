import { useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  GraduationCap,
  KeyRound,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  ShieldOff,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { parseStudentsFile } from "@/lib/spreadsheet";

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
import { Checkbox } from "@/components/ui/checkbox";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeletonRows } from "@/components/TableSkeletonRows";
import { WhatsappButton } from "@/components/WhatsappButton";
import { PainelShell } from "@/components/painel/PainelShell";
import { getCurrentTeacherFn } from "@/functions/auth";
import {
  bulkCreateStudentsFn,
  createStudentFn,
  deleteStudentFn,
  listStudentsFn,
  revokeStudentLoginFn,
  setStudentActiveFn,
  setStudentPasswordFn,
  setStudentScholarshipFn,
  updateStudentFn,
  type Student,
} from "@/functions/students";
import {
  getStudentEnrollmentFn,
  setSelectiveEnrollmentFn,
  setStudentLessonAccessFn,
} from "@/functions/studentEnrollment";
import { isAdminRole } from "@/lib/teacherRole";

const STUDENTS_KEY = ["students"] as const;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** Cadastro de alunos: nome, e-mail opcional e situação (ativo/inativo). */
export function Students() {
  const queryClient = useQueryClient();
  const { data: students, isLoading } = useQuery({
    queryKey: STUDENTS_KEY,
    queryFn: () => listStudentsFn(),
  });
  const { data: me } = useQuery({
    queryKey: ["current-teacher"],
    queryFn: () => getCurrentTeacherFn(),
  });
  const isAdmin = isAdminRole(me?.role);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [settingPasswordFor, setSettingPasswordFor] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState<Student | null>(null);
  const [settingScholarshipFor, setSettingScholarshipFor] = useState<Student | null>(null);
  const [managingLessonsFor, setManagingLessonsFor] = useState<Student | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: STUDENTS_KEY });
  }

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const parsed = await parseStudentsFile(file);
      if (parsed.length === 0) {
        throw new Error("Nenhum aluno encontrado na planilha.");
      }
      return bulkCreateStudentsFn({ data: { students: parsed } });
    },
    onSuccess: async (result) => {
      const partes = [`${result.created} importado(s)`];
      if (result.updated > 0) partes.push(`${result.updated} com WhatsApp preenchido`);
      if (result.skipped.length > 0) partes.push(`${result.skipped.length} já cadastrado(s)`);
      if (result.emailConflicts.length > 0) {
        partes.push(`${result.emailConflicts.length} sem e-mail (já usado por outro aluno)`);
      }
      toast.success(`${partes.join(", ")}.`);
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível importar a planilha.")),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (student: Student) =>
      setStudentActiveFn({ data: { id: student.id, active: !student.active } }),
    onSuccess: async () => {
      toast.success("Situação atualizada.");
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível atualizar.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteStudentFn({ data: { id } }),
    onSuccess: async () => {
      toast.success("Aluno excluído.");
      setDeleting(null);
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível excluir.")),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeStudentLoginFn({ data: { id } }),
    onSuccess: async () => {
      toast.success("Login removido.");
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível remover o login.")),
  });

  return (
    <PainelShell
      title="Alunos"
      description="Cadastre os alunos do seminário para lançar notas e faltas por disciplina."
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {students
            ? `${students.length} ${students.length === 1 ? "aluno cadastrado" : "alunos cadastrados"}${
                students.length > 0
                  ? ` · ${students.filter((s) => s.active).length} ${students.filter((s) => s.active).length === 1 ? "ativo" : "ativos"}`
                  : ""
              }`
            : "Carregando…"}
        </p>
        {isAdmin ? (
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) importMutation.mutate(file);
              }}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importMutation.isPending}
            >
              {importMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="size-4" aria-hidden />
              )}
              {importMutation.isPending ? "Importando…" : "Importar planilha"}
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Novo aluno
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Você só visualiza a lista de alunos — cadastro e edição são feitos pelos admins.
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-md border border-border/70 bg-card/70 shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Portal</TableHead>
              <TableHead>Bolsa</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows columns={7} />
            ) : students && students.length > 0 ? (
              students.map((student) => (
                <TableRow
                  key={student.id}
                  className="animate-in fade-in slide-in-from-top-1 even:bg-muted/30 duration-200"
                >
                  <TableCell className="font-medium text-foreground">{student.name}</TableCell>
                  <TableCell className="text-muted-foreground">{student.email ?? "—"}</TableCell>
                  <TableCell>
                    <WhatsappButton phone={student.phone} studentName={student.name} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={student.active ? "default" : "secondary"}>
                      {student.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={student.hasLogin ? "default" : "secondary"}>
                      {student.hasLogin ? "Ativo" : "Sem login"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {student.scholarshipPercent > 0 ? (
                      <Badge variant="outline">
                        {student.scholarshipPercent === 100
                          ? "Integral"
                          : `${student.scholarshipPercent}%`}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Editar"
                          onClick={() => setEditing(student)}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Definir bolsa"
                          onClick={() => setSettingScholarshipFor(student)}
                        >
                          <GraduationCap className="size-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Aulas atribuídas (matrícula seletiva)"
                          onClick={() => setManagingLessonsFor(student)}
                        >
                          <ListChecks className="size-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={
                            student.hasLogin
                              ? "Redefinir senha do portal"
                              : "Definir senha do portal"
                          }
                          onClick={() => setSettingPasswordFor(student)}
                        >
                          <KeyRound className="size-4" aria-hidden />
                        </Button>
                        {student.hasLogin ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Remover login do portal"
                            onClick={() => revokeMutation.mutate(student.id)}
                            disabled={
                              revokeMutation.isPending && revokeMutation.variables === student.id
                            }
                          >
                            {revokeMutation.isPending && revokeMutation.variables === student.id ? (
                              <Loader2 className="size-4 animate-spin" aria-hidden />
                            ) : (
                              <ShieldOff className="size-4" aria-hidden />
                            )}
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          title={student.active ? "Inativar" : "Reativar"}
                          onClick={() => toggleActiveMutation.mutate(student)}
                          disabled={
                            toggleActiveMutation.isPending &&
                            toggleActiveMutation.variables?.id === student.id
                          }
                        >
                          {toggleActiveMutation.isPending &&
                          toggleActiveMutation.variables?.id === student.id ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                          ) : (
                            <Undo2 className="size-4" aria-hidden />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Excluir"
                          onClick={() => setDeleting(student)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                  Nenhum aluno cadastrado ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CreateStudentDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={invalidate} />
      {editing ? (
        <EditStudentDialog
          student={editing}
          onOpenChange={(open) => !open && setEditing(null)}
          onSaved={invalidate}
        />
      ) : null}
      {settingScholarshipFor ? (
        <SetScholarshipDialog
          student={settingScholarshipFor}
          onOpenChange={(open) => !open && setSettingScholarshipFor(null)}
          onSaved={invalidate}
        />
      ) : null}
      {settingPasswordFor ? (
        <SetStudentPasswordDialog
          student={settingPasswordFor}
          onOpenChange={(open) => !open && setSettingPasswordFor(null)}
          onSaved={invalidate}
        />
      ) : null}
      {managingLessonsFor ? (
        <LessonAccessDialog
          student={managingLessonsFor}
          onOpenChange={(open) => !open && setManagingLessonsFor(null)}
        />
      ) : null}

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso remove o aluno e todas as notas e faltas lançadas para ele. Essa ação não pode
              ser desfeita — se o aluno só saiu do curso, prefira "Inativar".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PainelShell>
  );
}

const studentSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Informe um e-mail válido.")
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
});

function CreateStudentDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<unknown>;
}) {
  const form = useForm<z.infer<typeof studentSchema>>({
    resolver: zodResolver(studentSchema),
    defaultValues: { name: "", email: "", phone: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof studentSchema>) => createStudentFn({ data: values }),
    onSuccess: async () => {
      toast.success("Aluno cadastrado.");
      form.reset();
      onOpenChange(false);
      await onCreated();
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível cadastrar.")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo aluno</DialogTitle>
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
                  <FormLabel>E-mail (opcional)</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone / WhatsApp (opcional)</FormLabel>
                  <FormControl>
                    <Input inputMode="tel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Cadastrar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditStudentDialog({
  student,
  onOpenChange,
  onSaved,
}: {
  student: Student;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<unknown>;
}) {
  const form = useForm<z.infer<typeof studentSchema>>({
    resolver: zodResolver(studentSchema),
    defaultValues: { name: student.name, email: student.email ?? "", phone: student.phone ?? "" },
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof studentSchema>) =>
      updateStudentFn({ data: { id: student.id, ...values } }),
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
          <DialogTitle>Editar {student.name}</DialogTitle>
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
                  <FormLabel>E-mail (opcional)</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone / WhatsApp (opcional)</FormLabel>
                  <FormControl>
                    <Input inputMode="tel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
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

function SetStudentPasswordDialog({
  student,
  onOpenChange,
  onSaved,
}: {
  student: Student;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<unknown>;
}) {
  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof passwordSchema>) =>
      setStudentPasswordFn({ data: { id: student.id, password: values.password } }),
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
            {student.hasLogin ? "Redefinir" : "Definir"} senha do portal de {student.name}
          </DialogTitle>
        </DialogHeader>
        {!student.email ? (
          <p className="text-sm text-destructive">
            Esse aluno não tem e-mail cadastrado. Edite o cadastro e adicione um e-mail antes de
            definir a senha.
          </p>
        ) : (
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
                  {mutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : null}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SetScholarshipDialog({
  student,
  onOpenChange,
  onSaved,
}: {
  student: Student;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<unknown>;
}) {
  const [percent, setPercent] = useState(String(student.scholarshipPercent));

  const mutation = useMutation({
    mutationFn: () =>
      setStudentScholarshipFn({ data: { id: student.id, scholarshipPercent: Number(percent) } }),
    onSuccess: async () => {
      toast.success("Bolsa atualizada.");
      onOpenChange(false);
      await onSaved();
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível salvar.")),
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bolsa de {student.name}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Percentual de desconto aplicado nas mensalidades geradas pra esse aluno. 0% = sem bolsa,
          100% = bolsa integral (as mensalidades já entram quitadas, sem precisar dar baixa).
        </p>
        <div>
          <label className="text-sm font-medium text-foreground">Bolsa (%)</label>
          <Input
            type="number"
            min={0}
            max={100}
            step={1}
            value={percent}
            onChange={(event) => setPercent(event.target.value)}
            className="mt-1.5"
          />
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {mutation.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Matrícula seletiva: por padrão todo aluno faz o currículo inteiro. Liga
 * aqui pra um aluno que só vai fazer aulas específicas (ex.: Denis) — cada
 * aula liberada/revogada já salva na hora, sem botão de salvar separado,
 * pra dar pra ir atribuindo aula a aula conforme o curso anda.
 */
function LessonAccessDialog({
  student,
  onOpenChange,
}: {
  student: Student;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const queryKey = ["student-enrollment", student.id] as const;

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => getStudentEnrollmentFn({ data: { studentId: student.id } }),
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey });
  }

  const toggleSelectiveMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      setSelectiveEnrollmentFn({ data: { studentId: student.id, enabled } }),
    onSuccess: () => invalidate(),
    onError: () => toast.error("Não foi possível atualizar a matrícula seletiva."),
  });

  const toggleLessonMutation = useMutation({
    mutationFn: (input: { lessonId: string; granted: boolean }) =>
      setStudentLessonAccessFn({ data: { studentId: student.id, ...input } }),
    onSuccess: () => invalidate(),
    onError: () => toast.error("Não foi possível atualizar essa aula."),
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Aulas atribuídas — {student.name}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Por padrão todo aluno ativo participa do currículo inteiro. Ligue a matrícula seletiva pra
          um aluno que só vai fazer aulas específicas — escolha abaixo quais, podendo liberar mais
          aulas depois, conforme o curso anda.
        </p>

        {isLoading || !data ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-md border border-border/70 p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Matrícula seletiva</p>
                <p className="text-xs text-muted-foreground">
                  Ligada: só vê/participa das aulas marcadas abaixo.
                </p>
              </div>
              <Switch
                checked={data.selectiveEnrollment}
                onCheckedChange={(checked) => toggleSelectiveMutation.mutate(checked)}
                disabled={toggleSelectiveMutation.isPending}
              />
            </div>

            {data.selectiveEnrollment ? (
              <div className="divide-y divide-border/70 rounded-md border border-border/70">
                {data.disciplines.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    Nenhuma disciplina com aulas cadastradas ainda.
                  </p>
                ) : (
                  data.disciplines.map((discipline) => (
                    <div key={discipline.id} className="p-3">
                      <p className="mb-2 text-sm font-medium text-foreground">
                        {discipline.discipline}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {discipline.lessons.map((lesson) => (
                          <label
                            key={lesson.id}
                            className="flex items-center gap-1.5 rounded-md border border-border/70 px-2 py-1 text-xs"
                          >
                            <Checkbox
                              checked={lesson.granted}
                              disabled={
                                toggleLessonMutation.isPending &&
                                toggleLessonMutation.variables?.lessonId === lesson.id
                              }
                              onCheckedChange={(checked) =>
                                toggleLessonMutation.mutate({
                                  lessonId: lesson.id,
                                  granted: checked === true,
                                })
                              }
                            />
                            Aula {lesson.sequence}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
