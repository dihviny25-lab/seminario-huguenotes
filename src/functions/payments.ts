import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { computeCurrentAmount, computeMonthlySeries, formatPeriodLabel } from "@/lib/payments";
import { getPaymentModality, PUNCTUALITY_DISCOUNT_PERCENT } from "@/lib/paymentModalities";
import { requireAdminId, requireStudentId, requireTeacherId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { charges, students } from "@/server/db/schema";
import { createPreference } from "@/server/payments/mercadopago";

export type Charge = {
  id: string;
  studentId: string;
  description: string;
  modality: string | null;
  fullAmount: string;
  discountPercent: string;
  /** Valor a pagar agora (com desconto se ainda dentro do prazo, cheio se vencido); igual ao valor pago quando já está `paid`. */
  currentAmount: string;
  paidAmount: string | null;
  dueDate: string;
  status: "pending" | "paid" | "canceled";
  paidAt: string | null;
  paidManually: boolean;
  note: string | null;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function toCharge(row: typeof charges.$inferSelect): Charge {
  const currentAmount =
    row.status === "paid" && row.paidAmount !== null
      ? row.paidAmount
      : String(
          computeCurrentAmount(
            {
              fullAmount: Number(row.fullAmount),
              discountPercent: Number(row.discountPercent),
              dueDate: row.dueDate,
            },
            todayIso(),
          ),
        );

  return {
    id: row.id,
    studentId: row.studentId,
    description: row.description,
    modality: row.modality,
    fullAmount: row.fullAmount,
    discountPercent: row.discountPercent,
    currentAmount,
    paidAmount: row.paidAmount,
    dueDate: row.dueDate,
    status: row.status,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    paidManually: row.paidManually,
    note: row.note,
  };
}

/** Cobranças do próprio aluno logado no portal. */
export const listMyChargesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<Charge>> => {
    const studentId = await requireStudentId();
    const rows = await db
      .select()
      .from(charges)
      .where(eq(charges.studentId, studentId))
      .orderBy(asc(charges.dueDate));
    return rows.map(toCharge);
  },
);

const payChargeSchema = z.object({ chargeId: z.string().uuid() });

/**
 * Cria uma preference nova do Mercado Pago pra pagar uma cobrança pendente
 * do próprio aluno — sempre nova (não reaproveita uma antiga) porque o
 * valor pode ter mudado entre um clique e outro, se o vencimento passou.
 */
export const payMyChargeFn = createServerFn({ method: "POST" })
  .validator(payChargeSchema)
  .handler(async ({ data }): Promise<{ initPoint: string }> => {
    const studentId = await requireStudentId();

    const [row] = await db
      .select({ charge: charges, studentName: students.name })
      .from(charges)
      .innerJoin(students, eq(charges.studentId, students.id))
      .where(eq(charges.id, data.chargeId))
      .limit(1);
    if (!row || row.charge.studentId !== studentId) {
      throw new Error("Cobrança não encontrada.");
    }
    const { charge, studentName } = row;
    if (charge.status !== "pending") {
      throw new Error("Essa cobrança não está mais pendente.");
    }

    const amount = computeCurrentAmount(
      {
        fullAmount: Number(charge.fullAmount),
        discountPercent: Number(charge.discountPercent),
        dueDate: charge.dueDate,
      },
      todayIso(),
    );

    const { preferenceId, initPoint } = await createPreference({
      chargeId: charge.id,
      // Título exibido no histórico de vendas da própria conta do Mercado
      // Pago — identifica de quem é cada pagamento (a igreja pediu isso
      // pra separar essa receita das demais contas dela).
      description: `Pagamento de ${studentName} referente ao seminário — ${charge.description}`,
      amount,
    });

    await db
      .update(charges)
      .set({ mpPreferenceId: preferenceId, mpInitPoint: initPoint })
      .where(eq(charges.id, charge.id));

    return { initPoint };
  });

const studentIdSchema = z.object({ studentId: z.string().uuid() });

/** Cobranças de um aluno específico — visão do admin/professor. */
export const listStudentChargesFn = createServerFn({ method: "GET" })
  .validator(studentIdSchema)
  .handler(async ({ data }): Promise<Array<Charge>> => {
    await requireTeacherId();
    const rows = await db
      .select()
      .from(charges)
      .where(eq(charges.studentId, data.studentId))
      .orderBy(asc(charges.dueDate));
    return rows.map(toCharge);
  });

const createChargeSchema = z.object({
  studentId: z.string().uuid(),
  description: z.string().trim().min(1, "Informe a descrição."),
  amount: z.number().positive("O valor precisa ser maior que zero."),
  dueDate: z.string().min(1, "Informe o vencimento."),
});

/** Cria uma cobrança avulsa (matrícula, taxa pontual) — valor livre, sem modalidade/desconto. */
export const createChargeFn = createServerFn({ method: "POST" })
  .validator(createChargeSchema)
  .handler(async ({ data }) => {
    const teacherId = await requireAdminId();
    const [row] = await db
      .insert(charges)
      .values({
        studentId: data.studentId,
        description: data.description,
        fullAmount: String(data.amount),
        discountPercent: "0",
        dueDate: data.dueDate,
        createdById: teacherId,
      })
      .returning({ id: charges.id });
    return row;
  });

const generateMonthlyChargesSchema = z.object({
  studentId: z.string().uuid(),
  modalityId: z.string().min(1, "Escolha a modalidade."),
  startPeriod: z.string().regex(/^\d{4}-\d{2}$/, "Informe o mês inicial."),
  months: z.number().int().min(1).max(36),
  dueDay: z.number().int().min(1).max(31),
});

export type GenerateMonthlyChargesResult = { created: number; skippedPeriods: Array<string> };

/** Gera uma série de mensalidades numa modalidade, pulando meses já cobrados desse aluno. */
export const generateMonthlyChargesFn = createServerFn({ method: "POST" })
  .validator(generateMonthlyChargesSchema)
  .handler(async ({ data }): Promise<GenerateMonthlyChargesResult> => {
    const teacherId = await requireAdminId();

    const modality = getPaymentModality(data.modalityId);
    if (!modality) {
      throw new Error("Modalidade inválida.");
    }

    const series = computeMonthlySeries(data.startPeriod, data.months, data.dueDay);

    const existing = await db
      .select({ period: charges.period })
      .from(charges)
      .where(eq(charges.studentId, data.studentId));
    const existingPeriods = new Set(
      existing.map((c) => c.period).filter((p): p is string => p !== null),
    );

    const skippedPeriods: Array<string> = [];
    const toInsert: Array<typeof charges.$inferInsert> = [];
    for (const { period, dueDate } of series) {
      if (existingPeriods.has(period)) {
        skippedPeriods.push(period);
        continue;
      }
      toInsert.push({
        studentId: data.studentId,
        description: `Mensalidade — ${formatPeriodLabel(period)}`,
        modality: modality.name,
        fullAmount: String(modality.fullValue),
        discountPercent: String(PUNCTUALITY_DISCOUNT_PERCENT),
        dueDate,
        period,
        createdById: teacherId,
      });
    }

    if (toInsert.length > 0) {
      await db.insert(charges).values(toInsert);
    }

    return { created: toInsert.length, skippedPeriods };
  });

const markPaidSchema = z.object({
  chargeId: z.string().uuid(),
  paidAmount: z.number().positive("Informe o valor recebido."),
  note: z.string().trim().optional(),
});

/** Admin marca uma cobrança como paga manualmente (dinheiro/Pix direto na secretaria). */
export const markChargePaidManuallyFn = createServerFn({ method: "POST" })
  .validator(markPaidSchema)
  .handler(async ({ data }) => {
    await requireAdminId();
    await db
      .update(charges)
      .set({
        status: "paid",
        paidManually: true,
        paidAt: new Date(),
        paidAmount: String(data.paidAmount),
        note: data.note || null,
      })
      .where(eq(charges.id, data.chargeId));
  });

const cancelChargeSchema = z.object({ chargeId: z.string().uuid() });

export const cancelChargeFn = createServerFn({ method: "POST" })
  .validator(cancelChargeSchema)
  .handler(async ({ data }) => {
    await requireAdminId();
    await db.update(charges).set({ status: "canceled" }).where(eq(charges.id, data.chargeId));
  });

export type OverdueCharge = {
  chargeId: string;
  studentName: string;
  description: string;
  amount: number;
  daysOverdue: number;
};

export type FinancialSummary = {
  receivedThisMonth: number;
  pendingNotYetDue: number;
  overdue: number;
  canceled: number;
  overdueList: Array<OverdueCharge>;
  monthlyRevenue: Array<{ month: string; revenue: number }>;
  paidAutomaticallyCount: number;
  paidAutomaticallyTotal: number;
  paidManuallyCount: number;
  paidManuallyTotal: number;
};

/** Resumo pro dashboard financeiro — só admin. Agrega em memória (volume pequeno), como já é feito em reportData.ts. */
export const getFinancialSummaryFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<FinancialSummary> => {
    await requireAdminId();

    const rows = await db
      .select({ charge: charges, studentName: students.name })
      .from(charges)
      .innerJoin(students, eq(charges.studentId, students.id));

    const today = todayIso();
    const currentMonthPrefix = today.slice(0, 7);

    let receivedThisMonth = 0;
    let pendingNotYetDue = 0;
    let overdue = 0;
    let canceled = 0;
    let paidAutomaticallyCount = 0;
    let paidAutomaticallyTotal = 0;
    let paidManuallyCount = 0;
    let paidManuallyTotal = 0;
    const overdueList: Array<OverdueCharge> = [];
    const revenueByMonth = new Map<string, number>();

    for (const { charge, studentName } of rows) {
      if (charge.status === "paid") {
        const paid = Number(charge.paidAmount ?? charge.fullAmount);
        if (charge.paidManually) {
          paidManuallyCount += 1;
          paidManuallyTotal += paid;
        } else {
          paidAutomaticallyCount += 1;
          paidAutomaticallyTotal += paid;
        }
        if (charge.paidAt) {
          const paidMonth = charge.paidAt.toISOString().slice(0, 7);
          revenueByMonth.set(paidMonth, (revenueByMonth.get(paidMonth) ?? 0) + paid);
          if (paidMonth === currentMonthPrefix) {
            receivedThisMonth += paid;
          }
        }
      } else if (charge.status === "pending") {
        const isOverdue = charge.dueDate < today;
        const amount = computeCurrentAmount(
          {
            fullAmount: Number(charge.fullAmount),
            discountPercent: Number(charge.discountPercent),
            dueDate: charge.dueDate,
          },
          today,
        );
        if (isOverdue) {
          overdue += amount;
          const daysOverdue = Math.round(
            (Date.parse(today) - Date.parse(charge.dueDate)) / (1000 * 60 * 60 * 24),
          );
          overdueList.push({
            chargeId: charge.id,
            studentName,
            description: charge.description,
            amount,
            daysOverdue,
          });
        } else {
          pendingNotYetDue += amount;
        }
      } else {
        canceled += Number(charge.fullAmount);
      }
    }

    overdueList.sort((a, b) => b.daysOverdue - a.daysOverdue);

    const monthlyRevenue: Array<{ month: string; revenue: number }> = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      monthlyRevenue.push({
        month: formatPeriodLabel(key),
        revenue: revenueByMonth.get(key) ?? 0,
      });
    }

    return {
      receivedThisMonth,
      pendingNotYetDue,
      overdue,
      canceled,
      overdueList,
      monthlyRevenue,
      paidAutomaticallyCount,
      paidAutomaticallyTotal,
      paidManuallyCount,
      paidManuallyTotal,
    };
  },
);
