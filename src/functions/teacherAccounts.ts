import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { requireAdminId, requireAdminOrSelf, requireTeacherId } from "@/server/auth/guard";
import { hashPassword } from "@/server/auth/password";
import { db } from "@/server/db/client";
import { teachers } from "@/server/db/schema";

export type TeacherAccount = {
  id: string;
  name: string;
  email: string;
  hasLogin: boolean;
  role: "admin" | "teacher";
};

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

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
});

export const createTeacherAccountFn = createServerFn({ method: "POST" })
  .validator(createSchema)
  .handler(async ({ data }) => {
    await requireAdminId();
    const passwordHash = await hashPassword(data.password);
    try {
      const [row] = await db
        .insert(teachers)
        .values({ name: data.name, email: data.email, passwordHash, mustChangePassword: true })
        .returning({ id: teachers.id });
      return row;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new Error("Já existe um professor com esse e-mail.");
      }
      throw error;
    }
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Informe o nome."),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
});

/** Admin edita qualquer um; professor comum só edita o próprio perfil. */
export const updateTeacherAccountFn = createServerFn({ method: "POST" })
  .validator(updateSchema)
  .handler(async ({ data }) => {
    await requireAdminOrSelf(data.id);
    try {
      await db
        .update(teachers)
        .set({ name: data.name, email: data.email })
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
  });

const revokeSchema = z.object({ id: z.string().uuid() });

/** Remove a senha (o registro do professor continua, só perde o login). */
export const revokeTeacherLoginFn = createServerFn({ method: "POST" })
  .validator(revokeSchema)
  .handler(async ({ data }) => {
    await requireAdminId();
    await db.update(teachers).set({ passwordHash: null }).where(eq(teachers.id, data.id));
  });

const deleteSchema = z.object({ id: z.string().uuid() });

export const deleteTeacherAccountFn = createServerFn({ method: "POST" })
  .validator(deleteSchema)
  .handler(async ({ data }) => {
    const adminId = await requireAdminId();
    if (adminId === data.id) {
      throw new Error("Você não pode excluir a própria conta.");
    }
    await db.delete(teachers).where(eq(teachers.id, data.id));
  });
