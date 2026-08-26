import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import { requireAdminId, requireTeacherId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { charges, courseMaterials, students } from "@/server/db/schema";

export type CourseMaterial = {
  id: string;
  title: string;
  price: string;
  active: boolean;
  createdAt: string;
};

function toCourseMaterial(row: typeof courseMaterials.$inferSelect): CourseMaterial {
  return {
    id: row.id,
    title: row.title,
    price: row.price,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Catálogo de materiais/livros cobráveis — qualquer professor pode ver pra usar em Pagamentos. */
export const listCourseMaterialsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<CourseMaterial>> => {
    await requireTeacherId();
    const rows = await db.select().from(courseMaterials).orderBy(asc(courseMaterials.title));
    return rows.map(toCourseMaterial);
  },
);

const createMaterialSchema = z.object({
  title: z.string().trim().min(1, "Informe o título."),
  price: z.number().positive("O valor precisa ser maior que zero."),
});

export const createCourseMaterialFn = createServerFn({ method: "POST" })
  .validator(createMaterialSchema)
  .handler(async ({ data }) => {
    const teacherId = await requireAdminId();
    const [row] = await db
      .insert(courseMaterials)
      .values({ title: data.title, price: String(data.price), createdById: teacherId })
      .returning({ id: courseMaterials.id });
    await logAudit(
      "financeiro.material_criar",
      `Adicionou o material "${data.title}" ao catálogo (R$ ${data.price.toFixed(2)}).`,
    );
    return row;
  });

const updateMaterialSchema = z.object({
  materialId: z.string().uuid(),
  title: z.string().trim().min(1, "Informe o título."),
  price: z.number().positive("O valor precisa ser maior que zero."),
  active: z.boolean(),
});

export const updateCourseMaterialFn = createServerFn({ method: "POST" })
  .validator(updateMaterialSchema)
  .handler(async ({ data }) => {
    await requireAdminId();
    await db
      .update(courseMaterials)
      .set({ title: data.title, price: String(data.price), active: data.active })
      .where(eq(courseMaterials.id, data.materialId));
    await logAudit("financeiro.material_editar", `Editou o material "${data.title}" do catálogo.`);
  });

const deleteMaterialSchema = z.object({ materialId: z.string().uuid() });

/** Apaga do catálogo — cobranças já geradas a partir dele continuam existindo (só perdem o vínculo). */
export const deleteCourseMaterialFn = createServerFn({ method: "POST" })
  .validator(deleteMaterialSchema)
  .handler(async ({ data }) => {
    await requireAdminId();
    const [material] = await db
      .select({ title: courseMaterials.title })
      .from(courseMaterials)
      .where(eq(courseMaterials.id, data.materialId))
      .limit(1);
    if (!material) return;
    await db.delete(courseMaterials).where(eq(courseMaterials.id, data.materialId));
    await logAudit(
      "financeiro.material_apagar",
      `Removeu o material "${material.title}" do catálogo.`,
    );
  });

const assignMaterialSchema = z
  .object({
    studentId: z.string().uuid(),
    materialId: z.string().uuid(),
    donate: z.boolean(),
    dueDate: z.string().optional(),
  })
  .refine((data) => data.donate || (data.dueDate?.length ?? 0) > 0, {
    message: "Informe o vencimento.",
    path: ["dueDate"],
  });

/**
 * Atribui um material do catálogo a um aluno: cria uma cobrança normal (segue
 * o fluxo de pagamento de sempre) ou, se `donate`, já nasce paga com valor
 * zero — mesmo padrão usado na bolsa integral em `generateMonthlyChargesFn`.
 */
export const assignMaterialToStudentFn = createServerFn({ method: "POST" })
  .validator(assignMaterialSchema)
  .handler(async ({ data }) => {
    const teacherId = await requireAdminId();

    const [material] = await db
      .select()
      .from(courseMaterials)
      .where(eq(courseMaterials.id, data.materialId))
      .limit(1);
    if (!material) throw new Error("Material não encontrado.");

    const [student] = await db
      .select({ name: students.name })
      .from(students)
      .where(eq(students.id, data.studentId))
      .limit(1);
    if (!student) throw new Error("Aluno não encontrado.");

    const [row] = await db
      .insert(charges)
      .values({
        studentId: data.studentId,
        courseMaterialId: material.id,
        description: `Material: ${material.title}`,
        fullAmount: material.price,
        discountPercent: "0",
        dueDate: data.donate ? new Date().toISOString().slice(0, 10) : data.dueDate!,
        createdById: teacherId,
        ...(data.donate
          ? {
              status: "paid" as const,
              paidAt: new Date(),
              paidAmount: "0",
              paidManually: true,
              note: "Material doado",
            }
          : {}),
      })
      .returning({ id: charges.id });

    await logAudit(
      data.donate ? "financeiro.material_doar" : "financeiro.material_cobrar",
      data.donate
        ? `Doou o material "${material.title}" para ${student.name}.`
        : `Cobrou o material "${material.title}" (R$ ${Number(material.price).toFixed(2)}) de ${student.name}.`,
    );
    return row;
  });
