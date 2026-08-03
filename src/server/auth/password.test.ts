import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/server/auth/password";

describe("hashPassword / verifyPassword", () => {
  it("verifies the correct password against its own hash", async () => {
    const hash = await hashPassword("huguenotes2026");
    await expect(verifyPassword("huguenotes2026", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("huguenotes2026");
    await expect(verifyPassword("senha-errada", hash)).resolves.toBe(false);
  });

  it("produces a different hash each time (random salt), but both still verify", async () => {
    const hashA = await hashPassword("mesma-senha");
    const hashB = await hashPassword("mesma-senha");

    expect(hashA).not.toBe(hashB);
    await expect(verifyPassword("mesma-senha", hashA)).resolves.toBe(true);
    await expect(verifyPassword("mesma-senha", hashB)).resolves.toBe(true);
  });

  it("rejects a malformed or unrecognized hash instead of throwing", async () => {
    await expect(verifyPassword("qualquer-senha", "não-é-um-hash-pbkdf2")).resolves.toBe(false);
  });
});
