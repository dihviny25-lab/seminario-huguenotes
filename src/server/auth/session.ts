import { getSession, useSession } from "@tanstack/react-start/server";

export type AppSessionData = {
  teacherId: string;
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
    name: "huguenotes_session",
    maxAge: SEVEN_DAYS_SECONDS,
  };
}

/**
 * Sessão selada (criptografada + assinada) num cookie httpOnly.
 *
 * Nome com prefixo "use" só para bater com a convenção que o eslint-plugin-
 * react-hooks exige de qualquer função que chame `useSession` — não é um
 * React Hook de verdade, é a API server-only do TanStack Start.
 */
export function useAppSession() {
  return useSession<AppSessionData>(sessionConfig());
}

/** Leitura somente-consulta da sessão atual (ex.: guards de rota). */
export function readAppSession() {
  return getSession<AppSessionData>(sessionConfig());
}
