import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import { requireStudentId } from "@/server/auth/guard";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { readAppStudentSession, useAppStudentSession } from "@/server/auth/studentSession";
import { db } from "@/server/db/client";
import { students } from "@/server/db/schema";
import { sendEmail } from "@/server/email/resend";

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
      phone: students.phone,
      birthDate: students.birthDate,
      emailVerified: students.emailVerified,
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

const updateProfileSchema = z.object({
  phone: z.string().trim().optional(),
  birthDate: z.string().trim().optional(), // ISO "YYYY-MM-DD", de <input type="date">
});

/** O próprio aluno preenche/edita telefone e data de nascimento. */
export const updateMyStudentProfileFn = createServerFn({ method: "POST" })
  .validator(updateProfileSchema)
  .handler(async ({ data }) => {
    const studentId = await requireStudentId();
    await db
      .update(students)
      .set({ phone: data.phone || null, birthDate: data.birthDate || null })
      .where(eq(students.id, studentId));
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

const EMAIL_VERIFICATION_TTL_MS = 60 * 60 * 1000; // 1 hora

function getSiteUrl(): string {
  const url = process.env.SITE_URL;
  if (!url) throw new Error("SITE_URL não configurada.");
  return url;
}

function verificationEmailHtml(name: string, confirmUrl: string): string {
  return `
    <p>Olá, ${name}.</p>
    <p>Confirme seu e-mail clicando no link abaixo (válido por 1 hora):</p>
    <p><a href="${confirmUrl}">${confirmUrl}</a></p>
    <p>Se você não pediu isso, pode ignorar este e-mail.</p>
    <p>Seminário Huguenotes</p>
  `;
}

/** O próprio aluno pede a confirmação — manda um link novo pro e-mail cadastrado. */
export const requestEmailVerificationFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ message: string }> => {
    const studentId = await requireStudentId();
    const [student] = await db
      .select({ name: students.name, email: students.email, emailVerified: students.emailVerified })
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);
    if (!student?.email) {
      throw new Error("Cadastre um e-mail antes de confirmar.");
    }
    if (student.emailVerified) {
      return { message: "Esse e-mail já está confirmado." };
    }

    const token = crypto.randomUUID();
    await db
      .update(students)
      .set({
        emailVerificationToken: token,
        emailVerificationTokenExpiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      })
      .where(eq(students.id, studentId));

    const confirmUrl = `${getSiteUrl()}/confirmar-email?token=${token}`;
    await sendEmail({
      to: student.email,
      subject: "Confirme seu e-mail — Seminário Huguenotes",
      html: verificationEmailHtml(student.name, confirmUrl),
    });

    return { message: "Enviamos um link de confirmação pro seu e-mail." };
  },
);

const confirmEmailSchema = z.object({ token: z.string().min(1) });

/** Confirma o e-mail a partir do link recebido — não exige estar logado. */
export const confirmStudentEmailFn = createServerFn({ method: "POST" })
  .validator(confirmEmailSchema)
  .handler(async ({ data }) => {
    const [student] = await db
      .select({
        id: students.id,
        emailVerificationTokenExpiresAt: students.emailVerificationTokenExpiresAt,
      })
      .from(students)
      .where(eq(students.emailVerificationToken, data.token))
      .limit(1);

    if (
      !student ||
      !student.emailVerificationTokenExpiresAt ||
      student.emailVerificationTokenExpiresAt < new Date()
    ) {
      throw new Error('Link inválido ou expirado. Peça um novo em "Minha conta".');
    }

    await db
      .update(students)
      .set({
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationTokenExpiresAt: null,
      })
      .where(eq(students.id, student.id));
  });
