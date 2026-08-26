import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { PainelShell } from "@/components/painel/PainelShell";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createExpenseFn,
  deleteExpenseFn,
  listExpensesFn,
  updateExpenseFn,
  type Expense,
} from "@/functions/expenses";
import { EXPENSE_CATEGORIES } from "@/lib/expenseCategories";

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

const expensesKey = ["expenses"] as const;

/** Despesas do seminário (aluguel, contas, manutenção etc.) — admin-only. */
export function Expenses() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const queryClient = useQueryClient();

  const { data: expenses, isLoading } = useQuery({
    queryKey: expensesKey,
    queryFn: () => listExpensesFn(),
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: expensesKey });
  }

  const deleteMutation = useMutation({
    mutationFn: (expenseId: string) => deleteExpenseFn({ data: { expenseId } }),
    onSuccess: async () => {
      toast.success("Despesa apagada.");
      setDeletingExpense(null);
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível apagar.")),
  });

  const total = (expenses ?? []).reduce((sum, expense) => sum + Number(expense.amount), 0);

  return (
    <PainelShell
      title="Despesas"
      description="Registre os gastos do seminário — aluguel, contas, manutenção etc."
    >
      <div className="mb-4 flex items-center justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Nova despesa
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border border-border/70 bg-card/70 shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Observação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : expenses && expenses.length > 0 ? (
              expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="font-medium text-foreground">
                    {expense.description}
                  </TableCell>
                  <TableCell>{expense.category}</TableCell>
                  <TableCell>{formatAmount(expense.amount)}</TableCell>
                  <TableCell>{formatDate(expense.date)}</TableCell>
                  <TableCell className="text-muted-foreground">{expense.note ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        onClick={() => setEditingExpense(expense)}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Apagar"
                        onClick={() => setDeletingExpense(expense)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  Nenhuma despesa registrada ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {expenses && expenses.length > 0 ? (
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold text-foreground">Total</TableCell>
                <TableCell />
                <TableCell className="font-semibold text-foreground">
                  {formatAmount(total)}
                </TableCell>
                <TableCell />
                <TableCell />
                <TableCell />
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </div>

      <CreateExpenseDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={invalidate} />
      <EditExpenseDialog
        expense={editingExpense}
        onOpenChange={(open) => !open && setEditingExpense(null)}
        onSaved={invalidate}
      />

      <AlertDialog
        open={deletingExpense !== null}
        onOpenChange={(open) => !open && setDeletingExpense(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar "{deletingExpense?.description}"?</AlertDialogTitle>
            <AlertDialogDescription>Não dá pra desfazer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingExpense && deleteMutation.mutate(deletingExpense.id)}
              disabled={deleteMutation.isPending}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PainelShell>
  );
}

const expenseFormSchema = z.object({
  description: z.string().trim().min(1, "Informe a descrição."),
  amount: z.coerce.number().positive("O valor precisa ser maior que zero."),
  category: z.string().trim().min(1, "Informe a categoria."),
  date: z.string().min(1, "Informe a data."),
  note: z.string().trim().optional(),
});

type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

function ExpenseFormFields({ form }: { form: ReturnType<typeof useForm<ExpenseFormValues>> }) {
  return (
    <>
      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Descrição</FormLabel>
            <FormControl>
              <Input placeholder="Aluguel de agosto" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="category"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Categoria</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha a categoria" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={form.control}
        name="note"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Observação (opcional)</FormLabel>
            <FormControl>
              <Textarea {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

function CreateExpenseDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<unknown>;
}) {
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: { description: "", amount: 0, category: "", date: "", note: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: ExpenseFormValues) => createExpenseFn({ data: values }),
    onSuccess: async () => {
      toast.success("Despesa registrada.");
      form.reset();
      onOpenChange(false);
      await onCreated();
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível registrar a despesa.")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova despesa</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <ExpenseFormFields form={form} />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                Registrar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditExpenseDialog({
  expense,
  onOpenChange,
  onSaved,
}: {
  expense: Expense | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<unknown>;
}) {
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    values: expense
      ? {
          description: expense.description,
          amount: Number(expense.amount),
          category: expense.category,
          date: expense.date,
          note: expense.note ?? "",
        }
      : { description: "", amount: 0, category: "", date: "", note: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: ExpenseFormValues) =>
      updateExpenseFn({ data: { expenseId: expense!.id, ...values } }),
    onSuccess: async () => {
      toast.success("Despesa atualizada.");
      onOpenChange(false);
      await onSaved();
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível salvar.")),
  });

  return (
    <Dialog open={expense !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar despesa</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <ExpenseFormFields form={form} />
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
