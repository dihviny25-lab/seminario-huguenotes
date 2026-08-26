import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import { requireAdminId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { expenses } from "@/server/db/schema";

export type Expense = {
  id: string;
  description: string;
  amount: string;
  category: string;
  date: string;
  note: string | null;
  createdAt: string;
};

function toExpense(row: typeof expenses.$inferSelect): Expense {
  return {
    id: row.id,
    description: row.description,
    amount: row.amount,
    category: row.category,
    date: row.date,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Despesas do seminário (aluguel, contas, manutenção etc.) — só admin. */
export const listExpensesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<Expense>> => {
    await requireAdminId();
    const rows = await db.select().from(expenses).orderBy(desc(expenses.date));
    return rows.map(toExpense);
  },
);

const createExpenseSchema = z.object({
  description: z.string().trim().min(1, "Informe a descrição."),
  amount: z.number().positive("O valor precisa ser maior que zero."),
  category: z.string().trim().min(1, "Informe a categoria."),
  date: z.string().min(1, "Informe a data."),
  note: z.string().trim().optional(),
});

export const createExpenseFn = createServerFn({ method: "POST" })
  .validator(createExpenseSchema)
  .handler(async ({ data }) => {
    const teacherId = await requireAdminId();
    const [row] = await db
      .insert(expenses)
      .values({
        description: data.description,
        amount: String(data.amount),
        category: data.category,
        date: data.date,
        note: data.note || null,
        createdById: teacherId,
      })
      .returning({ id: expenses.id });
    await logAudit(
      "financeiro.despesa_criar",
      `Registrou despesa de R$ ${data.amount.toFixed(2)} (${data.description}).`,
    );
    return row;
  });

const updateExpenseSchema = z.object({
  expenseId: z.string().uuid(),
  description: z.string().trim().min(1, "Informe a descrição."),
  amount: z.number().positive("O valor precisa ser maior que zero."),
  category: z.string().trim().min(1, "Informe a categoria."),
  date: z.string().min(1, "Informe a data."),
  note: z.string().trim().optional(),
});

export const updateExpenseFn = createServerFn({ method: "POST" })
  .validator(updateExpenseSchema)
  .handler(async ({ data }) => {
    await requireAdminId();
    await db
      .update(expenses)
      .set({
        description: data.description,
        amount: String(data.amount),
        category: data.category,
        date: data.date,
        note: data.note || null,
      })
      .where(eq(expenses.id, data.expenseId));
    await logAudit(
      "financeiro.despesa_editar",
      `Editou a despesa ${data.description} (R$ ${data.amount.toFixed(2)}).`,
    );
  });

const deleteExpenseSchema = z.object({ expenseId: z.string().uuid() });

export const deleteExpenseFn = createServerFn({ method: "POST" })
  .validator(deleteExpenseSchema)
  .handler(async ({ data }) => {
    await requireAdminId();
    const [expense] = await db
      .select({ description: expenses.description, amount: expenses.amount })
      .from(expenses)
      .where(eq(expenses.id, data.expenseId))
      .limit(1);
    await db.delete(expenses).where(eq(expenses.id, data.expenseId));
    await logAudit(
      "financeiro.despesa_apagar",
      `Apagou a despesa ${expense?.description ?? data.expenseId}${expense ? ` (R$ ${Number(expense.amount).toFixed(2)})` : ""}.`,
    );
  });
