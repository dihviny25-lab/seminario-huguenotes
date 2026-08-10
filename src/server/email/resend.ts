/**
 * Envio de e-mail via Resend — chamada HTTP direta (sem SDK oficial),
 * mesma convenção já usada pro Mercado Pago em
 * `src/server/payments/mercadopago.ts`.
 */
export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY não configurada.");
  }
  const from = process.env.EMAIL_FROM;
  if (!from) {
    throw new Error("EMAIL_FROM não configurada.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to: input.to, subject: input.subject, html: input.html }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao enviar e-mail: ${response.status} ${body}`);
  }
}
