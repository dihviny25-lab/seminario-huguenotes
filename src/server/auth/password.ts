import { fromHex, toHex } from "@/server/hex";

const ITERATIONS = 210_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

/**
 * Hash/verify de senha com PBKDF2-SHA256 via Web Crypto (`crypto.subtle`),
 * disponível tanto em Node quanto no runtime de Cloudflare Workers usado no
 * deploy — evita depender de uma lib nativa (bcrypt) que pode não rodar lá.
 * Formato armazenado: "pbkdf2$<iterações>$<saltHex>$<hashHex>".
 */

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    keyMaterial,
    KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${toHex(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  const salt = fromHex(parts[2]);
  const expected = fromHex(parts[3]);
  const actual = await derive(password, salt, iterations);
  if (actual.length !== expected.length) return false;
  // Comparação em tempo constante — evita timing attack no length-independent case.
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
