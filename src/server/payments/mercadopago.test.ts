import { describe, expect, it } from "vitest";

import { buildSignatureManifest, verifyWebhookSignature } from "@/server/payments/mercadopago";

describe("buildSignatureManifest", () => {
  it("builds the id/request-id/ts manifest string", () => {
    expect(buildSignatureManifest({ dataId: "123", requestId: "abc", ts: "456" })).toBe(
      "id:123;request-id:abc;ts:456;",
    );
  });
});

async function signManifest(secret: string, manifest: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bits = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("verifyWebhookSignature", () => {
  const secret = "test-secret";

  it("accepts a correctly-signed notification", async () => {
    const dataId = "999999999";
    const requestId = "req-1";
    const ts = "1700000000";
    const manifest = buildSignatureManifest({ dataId, requestId, ts });
    const v1 = await signManifest(secret, manifest);

    const ok = await verifyWebhookSignature({
      xSignature: `ts=${ts},v1=${v1}`,
      xRequestId: requestId,
      dataId,
      secret,
    });
    expect(ok).toBe(true);
  });

  it("rejects a tampered data id", async () => {
    const requestId = "req-1";
    const ts = "1700000000";
    const manifest = buildSignatureManifest({ dataId: "999999999", requestId, ts });
    const v1 = await signManifest(secret, manifest);

    const ok = await verifyWebhookSignature({
      xSignature: `ts=${ts},v1=${v1}`,
      xRequestId: requestId,
      dataId: "000000000",
      secret,
    });
    expect(ok).toBe(false);
  });

  it("rejects the wrong secret", async () => {
    const dataId = "999999999";
    const requestId = "req-1";
    const ts = "1700000000";
    const manifest = buildSignatureManifest({ dataId, requestId, ts });
    const v1 = await signManifest("other-secret", manifest);

    const ok = await verifyWebhookSignature({
      xSignature: `ts=${ts},v1=${v1}`,
      xRequestId: requestId,
      dataId,
      secret,
    });
    expect(ok).toBe(false);
  });

  it("rejects when headers are missing", async () => {
    const ok = await verifyWebhookSignature({
      xSignature: null,
      xRequestId: "req-1",
      dataId: "999999999",
      secret,
    });
    expect(ok).toBe(false);
  });
});
