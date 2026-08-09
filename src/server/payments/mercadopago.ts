import { toHex } from "@/server/hex";

const MP_API_BASE = "https://api.mercadopago.com";

/**
 * Chamadas à API do Mercado Pago via `fetch` puro (sem o SDK oficial) e
 * verificação de assinatura de webhook via `crypto.subtle` — mesma
 * convenção de portabilidade já usada em `src/server/auth/password.ts`.
 */

function getAccessToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurada.");
  return token;
}

function getSiteUrl(): string {
  const url = process.env.SITE_URL;
  if (!url) throw new Error("SITE_URL não configurada.");
  return url;
}

export type CreatePreferenceInput = {
  chargeId: string;
  description: string;
  amount: number;
};

export type CreatePreferenceResult = {
  preferenceId: string;
  initPoint: string;
};

/** Cria uma preference de Checkout Pro — o aluno é redirecionado pro `initPoint`. */
export async function createPreference(
  input: CreatePreferenceInput,
): Promise<CreatePreferenceResult> {
  const siteUrl = getSiteUrl();
  const response = await fetch(`${MP_API_BASE}/checkout/preferences`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({
      items: [
        {
          title: input.description,
          quantity: 1,
          unit_price: input.amount,
          currency_id: "BRL",
        },
      ],
      external_reference: input.chargeId,
      notification_url: `${siteUrl}/api/mercadopago/webhook`,
      back_urls: {
        success: `${siteUrl}/portal/mensalidades`,
        pending: `${siteUrl}/portal/mensalidades`,
        failure: `${siteUrl}/portal/mensalidades`,
      },
      auto_return: "approved",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Mercado Pago recusou a criação da cobrança: ${response.status} ${body}`);
  }

  const data = (await response.json()) as { id: string; init_point: string };
  return { preferenceId: data.id, initPoint: data.init_point };
}

export type MercadoPagoPayment = {
  status: string;
  externalReference: string | null;
  /** Valor efetivamente pago, segundo o Mercado Pago. */
  transactionAmount: number;
};

/** Busca o status oficial de um pagamento — nunca confiar só no corpo do webhook. */
export async function getPayment(paymentId: string): Promise<MercadoPagoPayment> {
  const response = await fetch(`${MP_API_BASE}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao consultar pagamento no Mercado Pago: ${response.status} ${body}`);
  }

  const data = (await response.json()) as {
    status: string;
    external_reference: string | null;
    transaction_amount: number;
  };
  return {
    status: data.status,
    externalReference: data.external_reference ?? null,
    transactionAmount: data.transaction_amount,
  };
}

/**
 * Manifest usado na verificação HMAC do header `x-signature` dos webhooks do
 * Mercado Pago. Formato conforme a doc oficial (`id:<data.id>;request-id:<x-request-id>;ts:<ts>;`)
 * — confirmar contra o botão "Simular notificação" do painel do Mercado Pago
 * antes de confiar nisso em produção, já que a doc pública não deixa 100% claro.
 */
export function buildSignatureManifest(input: {
  dataId: string;
  requestId: string;
  ts: string;
}): string {
  return `id:${input.dataId};request-id:${input.requestId};ts:${input.ts};`;
}

function parseSignatureHeader(xSignature: string): { ts: string; v1: string } | null {
  const entries = xSignature
    .split(",")
    .map((part) => part.trim().split("="))
    .filter((pair): pair is [string, string] => pair.length === 2);
  const parts = Object.fromEntries(entries);
  if (!parts.ts || !parts.v1) return null;
  return { ts: parts.ts, v1: parts.v1 };
}

/** Verifica o header `x-signature` de um webhook recebido. */
export async function verifyWebhookSignature(input: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string;
}): Promise<boolean> {
  if (!input.xSignature || !input.xRequestId || !input.dataId) return false;

  const parsed = parseSignatureHeader(input.xSignature);
  if (!parsed) return false;

  const manifest = buildSignatureManifest({
    dataId: input.dataId,
    requestId: input.xRequestId,
    ts: parsed.ts,
  });

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(input.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBits = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const computed = toHex(new Uint8Array(signatureBits));

  // Comparação em tempo constante — mesmo padrão de password.ts.
  if (computed.length !== parsed.v1.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++)
    diff |= computed.charCodeAt(i) ^ parsed.v1.charCodeAt(i);
  return diff === 0;
}
