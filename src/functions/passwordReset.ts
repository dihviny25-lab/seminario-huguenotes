import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { hashPassword } from "@/server/auth/password";
import { db } from "@/server/db/client";
import { students, teachers } from "@/server/db/schema";
import { sendEmail } from "@/server/email/resend";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

function getSiteUrl(): string {
  const url = process.env.SITE_URL;
  if (!url) throw new Error("SITE_URL não configurada.");
  return url;
}

function resetEmailHtml(name: string, resetUrl: string): string {
  return `
    <p>Olá, ${name}.</p>
    <p>Recebemos um pedido para redefinir sua senha. Clique no link abaixo pra
    criar uma nova senha (válido por 1 hora):</p>
    <p><a href="${resetUrl}">${resetUrl}</a></p>
    <p>Se você não pediu isso, pode ignorar este e-mail — sua senha continua a mesma.</p>
    <p>Seminário Huguenotes</p>
  `;
}

/**
 * Não revela se o e-mail existe ou não no sistema — resposta genérica
 * sempre igual, e falha de envio de e-mail é só logada (não propagada),
 * pra não vazar a existência da conta por uma diferença de comportamento.
 */
const GENERIC_MESSAGE =
  "Se esse e-mail estiver cadastrado, enviamos um link de redefinição de senha.";

const requestSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
});

export const requestTeacherPasswordResetFn = createServerFn({ method: "POST" })
  .validator(requestSchema)
  .handler(async ({ data }): Promise<{ message: string }> => {
    const [teacher] = await db
      .select({ id: teachers.id, name: teachers.name })
      .from(teachers)
      .where(eq(teachers.email, data.email))
      .limit(1);

    if (teacher) {
      const token = crypto.randomUUID();
      await db
        .update(teachers)
        .set({ resetToken: token, resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) })
        .where(eq(teachers.id, teacher.id));

      const resetUrl = `${getSiteUrl()}/redefinir-senha?token=${token}`;
      try {
        await sendEmail({
          to: data.email,
          subject: "Redefinição de senha — Seminário Huguenotes",
          html: resetEmailHtml(teacher.name, resetUrl),
        });
      } catch (error) {
        console.error("Falha ao enviar e-mail de redefinição de senha (professor):", error);
      }
    }

    return { message: GENERIC_MESSAGE };
  });

export const requestStudentPasswordResetFn = createServerFn({ method: "POST" })
  .validator(requestSchema)
  .handler(async ({ data }): Promise<{ message: string }> => {
    const [student] = await db
      .select({ id: students.id, name: students.name })
      .from(students)
      .where(eq(students.email, data.email))
      .limit(1);

    if (student) {
      const token = crypto.randomUUID();
      await db
        .update(students)
        .set({ resetToken: token, resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) })
        .where(eq(students.id, student.id));

      const resetUrl = `${getSiteUrl()}/redefinir-senha-aluno?token=${token}`;
      try {
        await sendEmail({
          to: data.email,
          subject: "Redefinição de senha — Seminário Huguenotes",
          html: resetEmailHtml(student.name, resetUrl),
        });
      } catch (error) {
        console.error("Falha ao enviar e-mail de redefinição de senha (aluno):", error);
      }
    }

    return { message: GENERIC_MESSAGE };
  });

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres."),
});

const INVALID_TOKEN_MESSAGE = "Link inválido ou expirado. Peça um novo.";

export const resetTeacherPasswordFn = createServerFn({ method: "POST" })
  .validator(resetSchema)
  .handler(async ({ data }) => {
    const [teacher] = await db
      .select({ id: teachers.id, resetTokenExpiresAt: teachers.resetTokenExpiresAt })
      .from(teachers)
      .where(eq(teachers.resetToken, data.token))
      .limit(1);

    if (!teacher || !teacher.resetTokenExpiresAt || teacher.resetTokenExpiresAt < new Date()) {
      throw new Error(INVALID_TOKEN_MESSAGE);
    }

    const passwordHash = await hashPassword(data.password);
    await db
      .update(teachers)
      .set({ passwordHash, mustChangePassword: false, resetToken: null, resetTokenExpiresAt: null })
      .where(eq(teachers.id, teacher.id));
  });

export const resetStudentPasswordFn = createServerFn({ method: "POST" })
  .validator(resetSchema)
  .handler(async ({ data }) => {
    const [student] = await db
      .select({ id: students.id, resetTokenExpiresAt: students.resetTokenExpiresAt })
      .from(students)
      .where(eq(students.resetToken, data.token))
      .limit(1);

    if (!student || !student.resetTokenExpiresAt || student.resetTokenExpiresAt < new Date()) {
      throw new Error(INVALID_TOKEN_MESSAGE);
    }

    const passwordHash = await hashPassword(data.password);
    await db
      .update(students)
      .set({ passwordHash, mustChangePassword: false, resetToken: null, resetTokenExpiresAt: null })
      .where(eq(students.id, student.id));
  });
