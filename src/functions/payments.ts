import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { computeMonthlySeries, formatPeriodLabel } from "@/lib/payments";
import { requireAdminId, requireStudentId, requireTeacherId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { charges, students } from "@/server/db/schema";
import { createPreference } from "@/server/payments/mercadopago";

export type Charge = {
  id: string;
  studentId: string;
  description: string;
  amount: string;
  dueDate: string;
  status: "pending" | "paid" | "canceled";
  paidAt: string | null;
  paidManually: boolean;
  note: string | null;
};

const chargeColumns = {
  id: charges.id,
  studentId: charges.studentId,
  description: charges.description,
  amount: charges.amount,
  dueDate: charges.dueDate,
  status: charges.status,
  paidAt: charges.paidAt,
  paidManually: charges.paidManually,
  note: charges.note,
};

/** Cobranças do próprio aluno logado no portal. */
export const listMyChargesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<Charge>> => {
    const studentId = await requireStudentId();
    return db
      .select(chargeColumns)
      .from(charges)
      .where(eq(charges.studentId, studentId))
      .orderBy(asc(charges.dueDate));
  },
);

const payChargeSchema = z.object({ chargeId: z.string().uuid() });

/** Cria (ou reaproveita) o link de pagamento do Mercado Pago pra uma cobrança pendente do próprio aluno. */
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
    if (charge.mpInitPoint) {
      return { initPoint: charge.mpInitPoint };
    }

    const { preferenceId, initPoint } = await createPreference({
      chargeId: charge.id,
      // Título exibido no histórico de vendas da própria conta do Mercado
      // Pago — identifica de quem é cada pagamento (a igreja pediu isso
      // pra separar essa receita das demais contas dela).
      description: `Pagamento de ${studentName} referente ao seminário — ${charge.description}`,
      amount: Number(charge.amount),
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
    return db
      .select(chargeColumns)
      .from(charges)
      .where(eq(charges.studentId, data.studentId))
      .orderBy(asc(charges.dueDate));
  });

const createChargeSchema = z.object({
  studentId: z.string().uuid(),
  description: z.string().trim().min(1, "Informe a descrição."),
  amount: z.number().positive("O valor precisa ser maior que zero."),
  dueDate: z.string().min(1, "Informe o vencimento."),
});

/** Cria uma cobrança avulsa (matrícula, taxa pontual). */
export const createChargeFn = createServerFn({ method: "POST" })
  .validator(createChargeSchema)
  .handler(async ({ data }) => {
    const teacherId = await requireAdminId();
    const [row] = await db
      .insert(charges)
      .values({
        studentId: data.studentId,
        description: data.description,
        amount: String(data.amount),
        dueDate: data.dueDate,
        createdById: teacherId,
      })
      .returning({ id: charges.id });
    return row;
  });

const generateMonthlyChargesSchema = z.object({
  studentId: z.string().uuid(),
  description: z.string().trim().min(1, "Informe a descrição."),
  amount: z.number().positive("O valor precisa ser maior que zero."),
  startPeriod: z.string().regex(/^\d{4}-\d{2}$/, "Informe o mês inicial."),
  months: z.number().int().min(1).max(36),
  dueDay: z.number().int().min(1).max(31),
});

export type GenerateMonthlyChargesResult = { created: number; skippedPeriods: Array<string> };

/** Gera uma série de cobranças mensais, pulando meses já cobrados desse aluno. */
export const generateMonthlyChargesFn = createServerFn({ method: "POST" })
  .validator(generateMonthlyChargesSchema)
  .handler(async ({ data }): Promise<GenerateMonthlyChargesResult> => {
    const teacherId = await requireAdminId();

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
        description: `${data.description} — ${formatPeriodLabel(period)}`,
        amount: String(data.amount),
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
