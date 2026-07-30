import { getSession, useSession } from "@tanstack/react-start/server";

export type AppStudentSessionData = {
  studentId: string;
};

function requireSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET não configurada. Copie .env.example para .env e preencha.");
  }
  return secret;
}

const SEVEN_DAYS_SECONDS = 60 * 60 * 24 * 7;

function sessionConfig() {
  return {
    password: requireSecret(),
    // Nome de cookie diferente do de professores — sessões independentes,
    // dá pra estar logado como professor e aluno ao mesmo tempo no navegador.
    name: "huguenotes_student_session",
    maxAge: SEVEN_DAYS_SECONDS,
  };
}

/** Sessão selada (criptografada + assinada) num cookie httpOnly, para alunos. */
export function useAppStudentSession() {
  return useSession<AppStudentSessionData>(sessionConfig());
}

/** Leitura somente-consulta da sessão atual do aluno (ex.: guards de rota). */
export function readAppStudentSession() {
  return getSession<AppStudentSessionData>(sessionConfig());
}
