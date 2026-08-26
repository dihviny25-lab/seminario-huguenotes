import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Ban, CheckCircle2, Download, Pencil, Plus, RefreshCcw, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { PainelShell } from "@/components/painel/PainelShell";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentTeacherFn } from "@/functions/auth";
import { listStudentsFn } from "@/functions/students";
import {
  cancelChargeFn,
  createChargeFn,
  generateMonthlyChargesFn,
  listStudentChargesFn,
  markChargePaidManuallyFn,
  revertChargeToPendingFn,
  updateChargeFn,
  type Charge,
} from "@/functions/payments";
import { computeDiscountedAmount } from "@/lib/payments";
import { PAYMENT_MODALITIES, PUNCTUALITY_DISCOUNT_PERCENT } from "@/lib/paymentModalities";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatAmount(amount: string | number): string {
  return Number(amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

const statusLabel: Record<Charge["status"], string> = {
  pending: "Pendente",
  paid: "Pago",
  canceled: "Cancelado",
};

const paymentMethodLabel: Record<NonNullable<Charge["paymentMethod"]>, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  transferencia: "Transferência",
  outro: "Outro",
};

/** Cobranças de mensalidade/taxas por aluno — cria, gera em lote e confirma pagamentos. */
export function Payments({ initialStudentId }: { initialStudentId?: string } = {}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialStudentId ?? null);
  const [createOpen, setCreateOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [editingCharge, setEditingCharge] = useState<Charge | null>(null);
  const queryClient = useQueryClient();

  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: () => listStudentsFn(),
  });
  const { data: me } = useQuery({
    queryKey: ["current-teacher"],
    queryFn: () => getCurrentTeacherFn(),
  });
  const isAdmin = me?.role === "admin";

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const active = (students ?? []).filter((s) => s.active);
    if (!term) return active;
    return active.filter((s) => s.name.toLowerCase().includes(term));
  }, [students, query]);

  const selectedStudent = students?.find((s) => s.id === selectedId) ?? null;

  const chargesKey = ["student-charges", selectedId] as const;
  const { data: charges, isLoading } = useQuery({
    queryKey: chargesKey,
    queryFn: () => listStudentChargesFn({ data: { studentId: selectedId! } }),
    enabled: selectedId !== null,
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: chargesKey });
  }

  const cancelMutation = useMutation({
    mutationFn: (chargeId: string) => cancelChargeFn({ data: { chargeId } }),
    onSuccess: async () => {
      toast.success("Cobrança cancelada.");
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível cancelar.")),
  });

  const revertMutation = useMutation({
    mutationFn: (chargeId: string) => revertChargeToPendingFn({ data: { chargeId } }),
    onSuccess: async () => {
      toast.success("Pagamento desfeito — cobrança voltou pra pendente.");
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível desfazer.")),
  });

  return (
    <PainelShell
      title="Pagamentos"
      description="Gerencie mensalidades e cobranças avulsas dos alunos."
    >
      <div className="print:hidden">
        <Input
          placeholder="Buscar aluno pelo nome…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="max-w-sm"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {filtered.map((student) => (
            <Button
              key={student.id}
              type="button"
              variant={selectedId === student.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedId(student.id)}
            >
              {student.name}
            </Button>
          ))}
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum aluno encontrado.</p>
          ) : null}
        </div>
      </div>

      {!selectedId ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Busque um aluno acima pra ver e gerenciar as cobranças dele.
        </p>
      ) : null}

      {selectedId && selectedStudent ? (
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-foreground">
              {selectedStudent.name}
            </h2>
            {isAdmin ? (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setGenerateOpen(true)}>
                  <RefreshCcw className="size-4" aria-hidden />
                  Gerar mensalidades
                </Button>
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="size-4" aria-hidden />
                  Nova cobrança
                </Button>
              </div>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-md border border-border/70 bg-card/70 shadow-soft">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                      Carregando…
                    </TableCell>
                  </TableRow>
                ) : charges && charges.length > 0 ? (
                  charges.map((charge) => (
                    <TableRow key={charge.id}>
                      <TableCell className="font-medium text-foreground">
                        {charge.description}
                        {charge.modality ? (
                          <span className="block text-xs font-normal text-muted-foreground">
                            {charge.modality}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {charge.status === "pending" &&
                        charge.currentAmount !== charge.fullAmount ? (
                          <span className="flex flex-col">
                            <span className="font-medium text-success">
                              {formatAmount(charge.currentAmount)}
                            </span>
                            <span className="text-xs text-muted-foreground line-through">
                              {formatAmount(charge.fullAmount)}
                            </span>
                          </span>
                        ) : (
                          formatAmount(
                            charge.status === "paid"
                              ? (charge.paidAmount ?? charge.currentAmount)
                              : charge.currentAmount,
                          )
                        )}
                      </TableCell>
                      <TableCell>{formatDate(charge.dueDate)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            charge.status === "paid"
                              ? "default"
                              : charge.status === "canceled"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {statusLabel[charge.status]}
                        </Badge>
                        {charge.status === "paid" && charge.paymentMethod ? (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {paymentMethodLabel[charge.paymentMethod]}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {isAdmin && charge.status === "pending" ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Editar"
                              onClick={() => setEditingCharge(charge)}
                            >
                              <Pencil className="size-4" aria-hidden />
                            </Button>
                            <MarkPaidButton
                              chargeId={charge.id}
                              suggestedAmount={charge.currentAmount}
                              onDone={invalidate}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Cancelar"
                              onClick={() => cancelMutation.mutate(charge.id)}
                            >
                              <Ban className="size-4" aria-hidden />
                            </Button>
                          </div>
                        ) : isAdmin && charge.status === "paid" ? (
                          <div className="flex justify-end gap-1">
                            <Button asChild variant="ghost" size="icon" title="Baixar recibo">
                              <a
                                href={`/painel/pagamentos/${charge.id}/recibo`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Download className="size-4" aria-hidden />
                              </a>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Desfazer pagamento"
                              onClick={() => revertMutation.mutate(charge.id)}
                              disabled={revertMutation.isPending}
                            >
                              <Undo2 className="size-4" aria-hidden />
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                      Nenhuma cobrança lançada ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <CreateChargeDialog
            studentId={selectedId}
            open={createOpen}
            onOpenChange={setCreateOpen}
            onCreated={invalidate}
          />
          <GenerateMonthlyDialog
            studentId={selectedId}
            open={generateOpen}
            onOpenChange={setGenerateOpen}
            onGenerated={invalidate}
          />
          <EditChargeDialog
            charge={editingCharge}
            onOpenChange={(open) => !open && setEditingCharge(null)}
            onSaved={invalidate}
          />
        </div>
      ) : null}
    </PainelShell>
  );
}

const editChargeSchema = z.object({
  description: z.string().trim().min(1, "Informe a descrição."),
  amount: z.coerce.number().positive("O valor precisa ser maior que zero."),
  dueDate: z.string().min(1, "Informe o vencimento."),
});

function EditChargeDialog({
  charge,
  onOpenChange,
  onSaved,
}: {
  charge: Charge | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<unknown>;
}) {
  const form = useForm<z.infer<typeof editChargeSchema>>({
    resolver: zodResolver(editChargeSchema),
    values: charge
      ? {
          description: charge.description,
          amount: Number(charge.fullAmount),
          dueDate: charge.dueDate,
        }
      : { description: "", amount: 0, dueDate: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof editChargeSchema>) =>
      updateChargeFn({ data: { chargeId: charge!.id, ...values } }),
    onSuccess: async () => {
      toast.success("Cobrança atualizada.");
      onOpenChange(false);
      await onSaved();
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível salvar.")),
  });

  return (
    <Dialog open={charge !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar cobrança</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vencimento</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function MarkPaidButton({
  chargeId,
  suggestedAmount,
  onDone,
}: {
  chargeId: string;
  suggestedAmount: string;
  onDone: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [paidAmount, setPaidAmount] = useState(suggestedAmount);
  const [paymentMethod, setPaymentMethod] = useState<
    "pix" | "dinheiro" | "cartao" | "transferencia" | "outro"
  >("pix");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      markChargePaidManuallyFn({
        data: { chargeId, paidAmount: Number(paidAmount), paymentMethod, note: note || undefined },
      }),
    onSuccess: async () => {
      toast.success("Cobrança marcada como paga.");
      setOpen(false);
      setNote("");
      await onDone();
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível atualizar.")),
  });

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        title="Marcar como pago"
        onClick={() => {
          setPaidAmount(suggestedAmount);
          setOpen(true);
        }}
      >
        <CheckCircle2 className="size-4" aria-hidden />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar cobrança como paga</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Use isso quando o aluno pagou por fora do site (dinheiro, Pix direto na secretaria
            etc.).
          </p>
          <div>
            <label className="text-sm font-medium text-foreground">Valor recebido (R$)</label>
            <Input
              type="number"
              step="0.01"
              value={paidAmount}
              onChange={(event) => setPaidAmount(event.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Forma de pagamento</label>
            <Select
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as typeof paymentMethod)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            placeholder="Observação (opcional)"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <DialogFooter>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const chargeSchema = z.object({
  description: z.string().trim().min(1, "Informe a descrição."),
  amount: z.coerce.number().positive("Deve ser maior que zero."),
  dueDate: z.string().min(1, "Informe o vencimento."),
});

function CreateChargeDialog({
  studentId,
  open,
  onOpenChange,
  onCreated,
}: {
  studentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<unknown>;
}) {
  const form = useForm<z.infer<typeof chargeSchema>>({
    resolver: zodResolver(chargeSchema),
    defaultValues: { description: "", amount: 0, dueDate: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof chargeSchema>) =>
      createChargeFn({ data: { studentId, ...values } }),
    onSuccess: async () => {
      toast.success("Cobrança criada.");
      form.reset();
      onOpenChange(false);
      await onCreated();
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível criar a cobrança.")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova cobrança</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input placeholder="Matrícula 2026" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vencimento</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
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

const generateSchema = z.object({
  modalityId: z.string().min(1, "Escolha a modalidade."),
  startPeriod: z.string().regex(/^\d{4}-\d{2}$/, "Informe o mês inicial."),
  months: z.coerce.number().int().min(1).max(36),
  dueDay: z.coerce.number().int().min(1).max(31),
});

function GenerateMonthlyDialog({
  studentId,
  open,
  onOpenChange,
  onGenerated,
}: {
  studentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: () => Promise<unknown>;
}) {
  const form = useForm<z.infer<typeof generateSchema>>({
    resolver: zodResolver(generateSchema),
    defaultValues: {
      modalityId: "",
      startPeriod: "",
      months: 6,
      dueDay: 10,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof generateSchema>) =>
      generateMonthlyChargesFn({ data: { studentId, ...values } }),
    onSuccess: async (result) => {
      const skippedNote =
        result.skippedPeriods.length > 0
          ? `, ${result.skippedPeriods.length} mês(es) já existiam e foram pulados`
          : "";
      toast.success(`${result.created} cobrança(s) gerada(s)${skippedNote}.`);
      form.reset();
      onOpenChange(false);
      await onGenerated();
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível gerar as cobranças.")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar mensalidades</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <FormField
              control={form.control}
              name="modalityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modalidade</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha a modalidade" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PAYMENT_MODALITIES.map((modality) => (
                        <SelectItem key={modality.id} value={modality.id}>
                          {modality.name} — {formatAmount(modality.fullValue)} cheio /{" "}
                          {formatAmount(
                            computeDiscountedAmount(
                              modality.fullValue,
                              PUNCTUALITY_DISCOUNT_PERCENT,
                            ),
                          )}{" "}
                          pontual
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="startPeriod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mês inicial</FormLabel>
                  <FormControl>
                    <Input type="month" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="months"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade de meses</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueDay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dia do vencimento</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                Gerar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
