import { createHmac, timingSafeEqual } from "node:crypto";

import type { UploadPurpose } from "./policy";

// Fecha a lacuna de "qualquer usuário autenticado pode registrar qualquer
// `filePathname` como se tivesse sido ele quem subiu" — sem isso, um aluno
// mal-intencionado podia passar a chave de um objeto que nunca subiu (se
// conseguisse adivinhar/vazar) pras funções de registro e criar um
// registro em `private_files` apontando pra ele. O token amarra
// (identidade, finalidade, chave) no momento em que a URL de upload é
// emitida — as funções de registro só aceitam o `filePathname` se vier
// acompanhado do token correspondente, assinado pelo servidor.
export type UploadTokenClaim = {
  identityId: string;
  purpose: UploadPurpose;
  key: string;
  exp: number;
};

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

function requireSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET não configurada. Copie .env.example para .env e preencha.");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", requireSecret()).update(payload).digest("base64url");
}

export function signUploadToken(claim: Omit<UploadTokenClaim, "exp">): string {
  const payload: UploadTokenClaim = { ...claim, exp: Date.now() + THIRTY_MINUTES_MS };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

/**
 * Confere que quem está registrando o arquivo (`registerPrivateFile`) é a
 * mesma identidade que pediu a URL de upload, pra mesma finalidade e
 * mesma chave — chamar antes de todo `registerPrivateFile`. Lança em
 * qualquer divergência (nunca revela qual condição falhou).
 */
export function requireValidUploadOwnership(input: {
  token: string;
  purpose: UploadPurpose;
  key: string;
  identityId: string;
}): void {
  const claim = verifyUploadToken(input.token);
  if (
    !claim ||
    claim.purpose !== input.purpose ||
    claim.key !== input.key ||
    claim.identityId !== input.identityId
  ) {
    throw new Error("Upload inválido ou expirado — envie o arquivo novamente.");
  }
}

/** Devolve o claim só se a assinatura bate e o token não expirou; `null` em qualquer outro caso. */
export function verifyUploadToken(token: string): UploadTokenClaim | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = sign(encodedPayload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let claim: UploadTokenClaim;
  try {
    claim = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof claim.exp !== "number" || claim.exp < Date.now()) return null;
  return claim;
}
