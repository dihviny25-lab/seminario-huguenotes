import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  applyScholarship,
  computeCurrentAmount,
  computeMonthlySeries,
  formatPeriodLabel,
} from "@/lib/payments";
import { getPaymentModality, PUNCTUALITY_DISCOUNT_PERCENT } from "@/lib/paymentModalities";
import { logAudit } from "@/server/audit";
import { requireAdminId, requireStudentId, requireTeacherId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { charges, disciplines, students } from "@/server/db/schema";
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
  paymentMethod: "pix" | "dinheiro" | "cartao" | "transferencia" | "outro" | null;
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
    paymentMethod: row.paymentMethod,
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
    const [student] = await db
      .select({ name: students.name })
      .from(students)
      .where(eq(students.id, data.studentId))
      .limit(1);
    await logAudit(
      "financeiro.cobranca_criar",
      `Criou uma cobrança de R$ ${data.amount.toFixed(2)} (${data.description}) para ${student?.name ?? data.studentId}.`,
    );
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

    const [student] = await db
      .select({ name: students.name, scholarshipPercent: students.scholarshipPercent })
      .from(students)
      .where(eq(students.id, data.studentId))
      .limit(1);
    const effectiveValue = applyScholarship(modality.fullValue, student?.scholarshipPercent ?? 0);

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
      const isFullScholarship = effectiveValue === 0;
      toInsert.push({
        studentId: data.studentId,
        description: `Mensalidade — ${formatPeriodLabel(period)}`,
        modality: modality.name,
        fullAmount: String(effectiveValue),
        discountPercent: String(PUNCTUALITY_DISCOUNT_PERCENT),
        dueDate,
        period,
        createdById: teacherId,
        ...(isFullScholarship
          ? {
              status: "paid" as const,
              paidAt: new Date(),
              paidAmount: "0",
              paidManually: true,
              note: "Bolsa integral (100%)",
            }
          : {}),
      });
    }

    if (toInsert.length > 0) {
      await db.insert(charges).values(toInsert);
    }

    await logAudit(
      "financeiro.mensalidades_gerar",
      `Gerou ${toInsert.length} mensalidade(s) de ${modality.name} para ${student?.name ?? data.studentId}.`,
    );
    return { created: toInsert.length, skippedPeriods };
  });

const selfScheduleSchema = z.object({
  modalityId: z.string().min(1, "Escolha a modalidade."),
  dueDay: z.number().int().min(1).max(31),
});

/**
 * O próprio aluno escolhe o dia de vencimento e a modalidade — o sistema
 * gera sozinho todas as mensalidades restantes, do mês atual até o fim do
 * curso (maior data de término entre as disciplinas do currículo). Meses já
 * cobrados são pulados, então dá pra rodar de novo sem duplicar.
 */
export const selfScheduleMyChargesFn = createServerFn({ method: "POST" })
  .validator(selfScheduleSchema)
  .handler(async ({ data }): Promise<GenerateMonthlyChargesResult> => {
    const studentId = await requireStudentId();

    const modality = getPaymentModality(data.modalityId);
    if (!modality) {
      throw new Error("Modalidade inválida.");
    }

    const [studentRow] = await db
      .select({ scholarshipPercent: students.scholarshipPercent })
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);
    const effectiveValue = applyScholarship(
      modality.fullValue,
      studentRow?.scholarshipPercent ?? 0,
    );

    const disciplineRows = await db.select({ endDate: disciplines.endDate }).from(disciplines);
    const courseEndDate = disciplineRows
      .map((d) => d.endDate)
      .filter((d): d is string => d !== null)
      .sort()
      .at(-1);
    if (!courseEndDate) {
      throw new Error(
        "Não foi possível calcular o fim do curso — nenhuma disciplina tem data de término definida.",
      );
    }

    const now = new Date();
    const startPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const [endYear, endMonth] = courseEndDate.split("-").map(Number);
    const monthsUntilEnd =
      (endYear - now.getFullYear()) * 12 + (endMonth - (now.getMonth() + 1)) + 1;
    if (monthsUntilEnd < 1) {
      throw new Error("O curso já terminou — não há mensalidades futuras pra gerar.");
    }

    const series = computeMonthlySeries(startPeriod, Math.min(monthsUntilEnd, 36), data.dueDay);

    const existing = await db
      .select({ period: charges.period })
      .from(charges)
      .where(eq(charges.studentId, studentId));
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
      const isFullScholarship = effectiveValue === 0;
      toInsert.push({
        studentId,
        description: `Mensalidade — ${formatPeriodLabel(period)}`,
        modality: modality.name,
        fullAmount: String(effectiveValue),
        discountPercent: String(PUNCTUALITY_DISCOUNT_PERCENT),
        dueDate,
        period,
        createdById: null,
        ...(isFullScholarship
          ? {
              status: "paid" as const,
              paidAt: new Date(),
              paidAmount: "0",
              paidManually: true,
              note: "Bolsa integral (100%)",
            }
          : {}),
      });
    }

    if (toInsert.length > 0) {
      await db.insert(charges).values(toInsert);
    }

    await logAudit(
      "financeiro.mensalidades_autoconfigurar",
      `Configurou vencimento todo dia ${data.dueDay} e gerou ${toInsert.length} mensalidade(s) de ${modality.name} até o fim do curso.`,
    );
    return { created: toInsert.length, skippedPeriods };
  });

const paymentMethodLabels: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  transferencia: "Transferência",
  outro: "Outro",
};

const markPaidSchema = z.object({
  chargeId: z.string().uuid(),
  paidAmount: z.number().positive("Informe o valor recebido."),
  paymentMethod: z.enum(["pix", "dinheiro", "cartao", "transferencia", "outro"]),
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
        paymentMethod: data.paymentMethod,
        note: data.note || null,
      })
      .where(eq(charges.id, data.chargeId));
    const [row] = await db
      .select({ description: charges.description, studentName: students.name })
      .from(charges)
      .innerJoin(students, eq(charges.studentId, students.id))
      .where(eq(charges.id, data.chargeId))
      .limit(1);
    await logAudit(
      "financeiro.marcar_pago",
      `Marcou como pago manualmente: ${row?.description ?? data.chargeId} de ${row?.studentName ?? "aluno"} (R$ ${data.paidAmount.toFixed(2)}, ${paymentMethodLabels[data.paymentMethod]}).`,
    );
  });

const cancelChargeSchema = z.object({ chargeId: z.string().uuid() });

export const cancelChargeFn = createServerFn({ method: "POST" })
  .validator(cancelChargeSchema)
  .handler(async ({ data }) => {
    await requireAdminId();
    const [row] = await db
      .select({ description: charges.description, studentName: students.name })
      .from(charges)
      .innerJoin(students, eq(charges.studentId, students.id))
      .where(eq(charges.id, data.chargeId))
      .limit(1);
    await db.update(charges).set({ status: "canceled" }).where(eq(charges.id, data.chargeId));
    await logAudit(
      "financeiro.cancelar",
      `Cancelou a cobrança ${row?.description ?? data.chargeId} de ${row?.studentName ?? "aluno"}.`,
    );
  });

const updateChargeSchema = z.object({
  chargeId: z.string().uuid(),
  description: z.string().trim().min(1, "Informe a descrição."),
  amount: z.number().positive("O valor precisa ser maior que zero."),
  dueDate: z.string().min(1, "Informe o vencimento."),
});

/** Corrige descrição/valor/vencimento de uma cobrança pendente — não mexe em cobranças já pagas ou canceladas. */
export const updateChargeFn = createServerFn({ method: "POST" })
  .validator(updateChargeSchema)
  .handler(async ({ data }) => {
    await requireAdminId();
    const [charge] = await db
      .select({ status: charges.status, studentName: students.name })
      .from(charges)
      .innerJoin(students, eq(charges.studentId, students.id))
      .where(eq(charges.id, data.chargeId))
      .limit(1);
    if (!charge) throw new Error("Cobrança não encontrada.");
    if (charge.status !== "pending") {
      throw new Error("Só dá pra editar cobranças pendentes.");
    }

    await db
      .update(charges)
      .set({
        description: data.description,
        fullAmount: String(data.amount),
        dueDate: data.dueDate,
      })
      .where(eq(charges.id, data.chargeId));
    await logAudit(
      "financeiro.cobranca_editar",
      `Editou a cobrança de ${charge.studentName} — ${data.description}, R$ ${data.amount.toFixed(2)}, vencimento ${data.dueDate}.`,
    );
  });

const revertChargeSchema = z.object({ chargeId: z.string().uuid() });

/** Desfaz um "marcar como pago" feito por engano — volta a cobrança pra pendente. */
export const revertChargeToPendingFn = createServerFn({ method: "POST" })
  .validator(revertChargeSchema)
  .handler(async ({ data }) => {
    await requireAdminId();
    const [charge] = await db
      .select({
        status: charges.status,
        description: charges.description,
        studentName: students.name,
      })
      .from(charges)
      .innerJoin(students, eq(charges.studentId, students.id))
      .where(eq(charges.id, data.chargeId))
      .limit(1);
    if (!charge) throw new Error("Cobrança não encontrada.");
    if (charge.status !== "paid") {
      throw new Error("Só dá pra desfazer cobranças marcadas como pagas.");
    }

    await db
      .update(charges)
      .set({
        status: "pending",
        paidAt: null,
        paidAmount: null,
        paidManually: false,
        mpPaymentId: null,
        note: null,
      })
      .where(eq(charges.id, data.chargeId));
    await logAudit(
      "financeiro.desfazer_pagamento",
      `Desfez o pagamento da cobrança ${charge.description} de ${charge.studentName} — voltou pra pendente.`,
    );
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

const financialReportSchema = z.object({
  from: z.string().min(1, "Informe a data inicial."),
  to: z.string().min(1, "Informe a data final."),
  modality: z.string().optional(),
});

export type FinancialReportRow = {
  studentId: string;
  studentName: string;
  totalCharged: number;
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
};

export type FinancialReport = {
  from: string;
  to: string;
  modality: string | null;
  rows: Array<FinancialReportRow>;
  totals: {
    totalCharged: number;
    totalPaid: number;
    totalPending: number;
    totalOverdue: number;
  };
};

/**
 * Relatório financeiro por aluno num intervalo de vencimento — generaliza
 * `getFinancialSummaryFn` (que só olha o mês atual/últimos 6 meses) com
 * período e modalidade livres. Só admin, como o resto do financeiro.
 */
export const getFinancialReportFn = createServerFn({ method: "GET" })
  .validator(financialReportSchema)
  .handler(async ({ data }): Promise<FinancialReport> => {
    await requireAdminId();

    const rows = await db
      .select({ charge: charges, studentName: students.name })
      .from(charges)
      .innerJoin(students, eq(charges.studentId, students.id));

    const today = todayIso();
    const inRange = rows.filter(
      ({ charge }) =>
        charge.dueDate >= data.from &&
        charge.dueDate <= data.to &&
        (!data.modality || charge.modality === data.modality),
    );

    const byStudent = new Map<string, FinancialReportRow>();
    for (const { charge, studentName } of inRange) {
      const entry = byStudent.get(charge.studentId) ?? {
        studentId: charge.studentId,
        studentName,
        totalCharged: 0,
        totalPaid: 0,
        totalPending: 0,
        totalOverdue: 0,
      };

      const fullAmount = Number(charge.fullAmount);
      entry.totalCharged += fullAmount;

      if (charge.status === "paid") {
        entry.totalPaid += Number(charge.paidAmount ?? charge.fullAmount);
      } else if (charge.status === "pending") {
        const amount = computeCurrentAmount(
          { fullAmount, discountPercent: Number(charge.discountPercent), dueDate: charge.dueDate },
          today,
        );
        if (charge.dueDate < today) {
          entry.totalOverdue += amount;
        } else {
          entry.totalPending += amount;
        }
      }

      byStudent.set(charge.studentId, entry);
    }

    const reportRows = [...byStudent.values()].sort((a, b) =>
      a.studentName.localeCompare(b.studentName, "pt-BR"),
    );

    const totals = reportRows.reduce(
      (acc, row) => ({
        totalCharged: acc.totalCharged + row.totalCharged,
        totalPaid: acc.totalPaid + row.totalPaid,
        totalPending: acc.totalPending + row.totalPending,
        totalOverdue: acc.totalOverdue + row.totalOverdue,
      }),
      { totalCharged: 0, totalPaid: 0, totalPending: 0, totalOverdue: 0 },
    );

    return {
      from: data.from,
      to: data.to,
      modality: data.modality ?? null,
      rows: reportRows,
      totals,
    };
  });
