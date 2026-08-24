import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import { requireAdminId, requireTeacherId } from "@/server/auth/guard";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { readAppSession, useAppSession } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { teachers } from "@/server/db/schema";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
});

export const loginFn = createServerFn({ method: "POST" })
  .validator(loginSchema)
  .handler(async ({ data }) => {
    const invalidCredentialsMessage = "E-mail ou senha inválidos.";
    const [teacher] = await db
      .select()
      .from(teachers)
      .where(eq(teachers.email, data.email))
      .limit(1);

    if (!teacher || !teacher.passwordHash) {
      throw new Error(invalidCredentialsMessage);
    }
    const valid = await verifyPassword(data.password, teacher.passwordHash);
    if (!valid) {
      throw new Error(invalidCredentialsMessage);
    }

    const session = await useAppSession();
    await session.update({ teacherId: teacher.id });
    await logAudit("login", `${teacher.name} entrou no painel do professor.`);
    return { id: teacher.id, name: teacher.name, email: teacher.email };
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  await logAudit("logout", "Saiu do painel do professor.");
  const session = await useAppSession();
  await session.clear();
});

export const getCurrentTeacherFn = createServerFn({ method: "GET" }).handler(async () => {
  const session = await readAppSession();
  const teacherId = session.data.teacherId;
  if (!teacherId) return null;

  const [teacher] = await db
    .select({
      id: teachers.id,
      name: teachers.name,
      email: teachers.email,
      role: teachers.role,
      mustChangePassword: teachers.mustChangePassword,
    })
    .from(teachers)
    .where(eq(teachers.id, teacherId))
    .limit(1);
  return teacher ?? null;
});

/** Usado pelo guard de rota do /painel: lança se não houver sessão válida. */
export const requireTeacherFn = createServerFn({ method: "GET" }).handler(async () => {
  const teacherId = await requireTeacherId();
  const [teacher] = await db
    .select({ mustChangePassword: teachers.mustChangePassword })
    .from(teachers)
    .where(eq(teachers.id, teacherId))
    .limit(1);
  return { mustChangePassword: teacher?.mustChangePassword ?? false };
});

/** Usado pelo guard de rota do /painel/financeiro: lança se o professor logado não for admin. */
export const requireAdminFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminId();
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual."),
  newPassword: z.string().min(8, "A nova senha precisa ter ao menos 8 caracteres."),
});

/** Troca de senha feita pelo próprio professor (exige a senha atual). */
export const changeMyPasswordFn = createServerFn({ method: "POST" })
  .validator(changePasswordSchema)
  .handler(async ({ data }) => {
    const teacherId = await requireTeacherId();
    const [teacher] = await db
      .select({ passwordHash: teachers.passwordHash })
      .from(teachers)
      .where(eq(teachers.id, teacherId))
      .limit(1);

    if (
      !teacher?.passwordHash ||
      !(await verifyPassword(data.currentPassword, teacher.passwordHash))
    ) {
      throw new Error("Senha atual incorreta.");
    }

    const passwordHash = await hashPassword(data.newPassword);
    await db
      .update(teachers)
      .set({ passwordHash, mustChangePassword: false })
      .where(eq(teachers.id, teacherId));
  });
