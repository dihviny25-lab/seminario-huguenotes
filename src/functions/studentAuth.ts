import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import { requireStudentId } from "@/server/auth/guard";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { readAppStudentSession, useAppStudentSession } from "@/server/auth/studentSession";
import { db } from "@/server/db/client";
import { students } from "@/server/db/schema";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
});

export const studentLoginFn = createServerFn({ method: "POST" })
  .validator(loginSchema)
  .handler(async ({ data }) => {
    const invalidCredentialsMessage = "E-mail ou senha inválidos.";
    const [student] = await db
      .select()
      .from(students)
      .where(eq(students.email, data.email))
      .limit(1);

    if (!student || !student.passwordHash) {
      throw new Error(invalidCredentialsMessage);
    }
    const valid = await verifyPassword(data.password, student.passwordHash);
    if (!valid) {
      throw new Error(invalidCredentialsMessage);
    }

    const session = await useAppStudentSession();
    await session.update({ studentId: student.id });
    await logAudit("login", `${student.name} entrou no portal do aluno.`);
    return { id: student.id, name: student.name, email: student.email };
  });

export const studentLogoutFn = createServerFn({ method: "POST" }).handler(async () => {
  await logAudit("logout", "Saiu do portal do aluno.");
  const session = await useAppStudentSession();
  await session.clear();
});

export const getCurrentStudentFn = createServerFn({ method: "GET" }).handler(async () => {
  const session = await readAppStudentSession();
  const studentId = session.data.studentId;
  if (!studentId) return null;

  const [student] = await db
    .select({
      id: students.id,
      name: students.name,
      email: students.email,
      mustChangePassword: students.mustChangePassword,
    })
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);
  return student ?? null;
});

/** Usado pelo guard de rota do /portal: lança se não houver sessão válida. */
export const requireStudentFn = createServerFn({ method: "GET" }).handler(async () => {
  const studentId = await requireStudentId();
  const [student] = await db
    .select({ mustChangePassword: students.mustChangePassword })
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);
  return { mustChangePassword: student?.mustChangePassword ?? false };
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual."),
  newPassword: z.string().min(8, "A nova senha precisa ter ao menos 8 caracteres."),
});

/** Troca de senha feita pelo próprio aluno (exige a senha atual). */
export const changeMyStudentPasswordFn = createServerFn({ method: "POST" })
  .validator(changePasswordSchema)
  .handler(async ({ data }) => {
    const studentId = await requireStudentId();
    const [student] = await db
      .select({ passwordHash: students.passwordHash })
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);

    if (
      !student?.passwordHash ||
      !(await verifyPassword(data.currentPassword, student.passwordHash))
    ) {
      throw new Error("Senha atual incorreta.");
    }

    const passwordHash = await hashPassword(data.newPassword);
    await db
      .update(students)
      .set({ passwordHash, mustChangePassword: false })
      .where(eq(students.id, studentId));
  });
