import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import {
  isSuperAdminTeacher,
  requireAdminId,
  requireAdminOrSelf,
  requireTeacherId,
} from "@/server/auth/guard";
import { hashPassword } from "@/server/auth/password";
import { db } from "@/server/db/client";
import { isLastSuperAdminViolation, isUniqueViolation } from "@/server/db/errors";
import { teachers } from "@/server/db/schema";

export type TeacherAccount = {
  id: string;
  name: string;
  email: string;
  hasLogin: boolean;
  role: "admin" | "teacher" | "super_admin";
  title: string | null;
};

export const listTeacherAccountsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<TeacherAccount>> => {
    await requireTeacherId();
    const rows = await db
      .select({
        id: teachers.id,
        name: teachers.name,
        email: teachers.email,
        passwordHash: teachers.passwordHash,
        role: teachers.role,
        title: teachers.title,
      })
      .from(teachers)
      .orderBy(asc(teachers.name));
    return rows.map(({ passwordHash, ...rest }) => ({ ...rest, hasLogin: passwordHash !== null }));
  },
);

const createSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome."),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres."),
  title: z.string().trim().optional(),
  role: z.enum(["teacher", "admin", "super_admin"]).default("teacher"),
});

/** Admin comum só cria Professor/Admin; só o super admin cria outro super admin. */
export const createTeacherAccountFn = createServerFn({ method: "POST" })
  .validator(createSchema)
  .handler(async ({ data }) => {
    const creatorId = await requireAdminId();
    if (data.role === "super_admin" && !(await isSuperAdminTeacher(creatorId))) {
      throw new Error("Só o super admin pode criar outra conta de super admin.");
    }
    const passwordHash = await hashPassword(data.password);
    try {
      const [row] = await db
        .insert(teachers)
        .values({
          name: data.name,
          email: data.email,
          passwordHash,
          mustChangePassword: true,
          title: data.title || null,
          role: data.role,
        })
        .returning({ id: teachers.id });
      await logAudit("professor.criar", `Criou a conta do professor ${data.name} (${data.email}).`);
      return row;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new Error("Já existe um professor com esse e-mail.");
      }
      throw error;
    }
  });

const setRoleSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["teacher", "admin", "super_admin"]),
});

/**
 * Promove/rebaixa o papel de uma conta já existente. Admin comum só troca
 * entre Professor/Admin — mexer no papel de quem já É admin ou super admin
 * (inclusive rebaixar um admin pra professor) exige ser super admin, senão um
 * admin comum poderia rebaixar outro admin pra professor e em seguida excluir
 * a conta, contornando a proteção de `deleteTeacherAccountFn`. O super admin
 * não remove o próprio papel (evitaria ficar sem nenhum super admin no
 * sistema); a corrida entre dois super admins se rebaixando ao mesmo tempo é
 * bloqueada no banco pelo trigger `teachers_min_super_admin`.
 */
export const setTeacherRoleFn = createServerFn({ method: "POST" })
  .validator(setRoleSchema)
  .handler(async ({ data }) => {
    const requesterId = await requireAdminId();
    const requesterIsSuperAdmin = await isSuperAdminTeacher(requesterId);

    const [target] = await db
      .select({ name: teachers.name, role: teachers.role })
      .from(teachers)
      .where(eq(teachers.id, data.id))
      .limit(1);
    if (!target) throw new Error("Professor não encontrado.");

    const requiresSuperAdmin =
      data.role === "super_admin" || target.role === "super_admin" || target.role === "admin";
    if (requiresSuperAdmin && !requesterIsSuperAdmin) {
      throw new Error(
        "Só o super admin pode alterar o papel de uma conta de admin ou super admin.",
      );
    }
    if (requesterId === data.id && target.role === "super_admin" && data.role !== "super_admin") {
      throw new Error("Você não pode remover o próprio papel de super admin.");
    }

    try {
      await db.update(teachers).set({ role: data.role }).where(eq(teachers.id, data.id));
    } catch (error) {
      if (isLastSuperAdminViolation(error)) {
        throw new Error("Não é possível remover o último super admin do sistema.");
      }
      throw error;
    }
    await logAudit(
      "professor.papel",
      `Alterou o papel de ${target.name} de "${target.role}" para "${data.role}".`,
    );
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Informe o nome."),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
  title: z.string().trim().optional(),
});

/** Admin edita qualquer um; professor comum só edita o próprio perfil. */
export const updateTeacherAccountFn = createServerFn({ method: "POST" })
  .validator(updateSchema)
  .handler(async ({ data }) => {
    await requireAdminOrSelf(data.id);
    try {
      await db
        .update(teachers)
        .set({ name: data.name, email: data.email, title: data.title || null })
        .where(eq(teachers.id, data.id));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new Error("Já existe um professor com esse e-mail.");
      }
      throw error;
    }
  });

const setPasswordSchema = z.object({
  id: z.string().uuid(),
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres."),
});

/** Admin define/redefine a senha de qualquer professor (força troca no próximo login). */
export const setTeacherPasswordFn = createServerFn({ method: "POST" })
  .validator(setPasswordSchema)
  .handler(async ({ data }) => {
    await requireAdminId();
    const passwordHash = await hashPassword(data.password);
    await db
      .update(teachers)
      .set({ passwordHash, mustChangePassword: true })
      .where(eq(teachers.id, data.id));
    const [teacher] = await db
      .select({ name: teachers.name })
      .from(teachers)
      .where(eq(teachers.id, data.id))
      .limit(1);
    await logAudit(
      "professor.senha_redefinida",
      `Redefiniu a senha de ${teacher?.name ?? data.id}.`,
    );
  });

const revokeSchema = z.object({ id: z.string().uuid() });

/** Remove a senha (o registro do professor continua, só perde o login). */
export const revokeTeacherLoginFn = createServerFn({ method: "POST" })
  .validator(revokeSchema)
  .handler(async ({ data }) => {
    await requireAdminId();
    await db.update(teachers).set({ passwordHash: null }).where(eq(teachers.id, data.id));
    const [teacher] = await db
      .select({ name: teachers.name })
      .from(teachers)
      .where(eq(teachers.id, data.id))
      .limit(1);
    await logAudit("professor.login_revogado", `Revogou o login de ${teacher?.name ?? data.id}.`);
  });

const deleteSchema = z.object({ id: z.string().uuid() });

/**
 * Admin comum só exclui conta de Professor. Conta de Admin só o super admin
 * exclui. Conta de super admin nunca é excluída pela interface — nem por
 * outro super admin — pra nunca ficar sem ninguém no papel mais alto.
 */
export const deleteTeacherAccountFn = createServerFn({ method: "POST" })
  .validator(deleteSchema)
  .handler(async ({ data }) => {
    const adminId = await requireAdminId();
    if (adminId === data.id) {
      throw new Error("Você não pode excluir a própria conta.");
    }
    const [teacher] = await db
      .select({ name: teachers.name, role: teachers.role })
      .from(teachers)
      .where(eq(teachers.id, data.id))
      .limit(1);
    if (!teacher) throw new Error("Professor não encontrado.");
    if (teacher.role === "super_admin") {
      throw new Error("A conta de super admin não pode ser excluída pela interface.");
    }
    if (teacher.role === "admin" && !(await isSuperAdminTeacher(adminId))) {
      throw new Error("Só o super admin pode excluir uma conta de admin.");
    }
    await db.delete(teachers).where(eq(teachers.id, data.id));
    await logAudit("professor.apagar", `Apagou a conta do professor ${teacher.name}.`);
  });
