import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireTeacherId } from "@/server/auth/guard";
import { verifyPassword } from "@/server/auth/password";
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
    return { id: teacher.id, name: teacher.name, email: teacher.email };
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useAppSession();
  await session.clear();
});

export const getCurrentTeacherFn = createServerFn({ method: "GET" }).handler(async () => {
  const session = await readAppSession();
  const teacherId = session.data.teacherId;
  if (!teacherId) return null;

  const [teacher] = await db
    .select({ id: teachers.id, name: teachers.name, email: teachers.email })
    .from(teachers)
    .where(eq(teachers.id, teacherId))
    .limit(1);
  return teacher ?? null;
});

/** Usado pelo guard de rota do /painel: lança se não houver sessão válida. */
export const requireTeacherFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireTeacherId();
});
