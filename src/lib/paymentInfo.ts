/**
 * Dados de pagamento das mensalidades — Seminário Huguenotes é mantido pela
 * Igreja Batista da Cruz, por isso a chave PIX e a conta bancária estão no
 * CNPJ/nome dela.
 *
 * O link do Mercado Pago é um link de pagamento estático (gerado direto no
 * painel do Mercado Pago) — funciona sem precisar da integração via API/
 * webhook, que ainda não está configurada.
 */
export const PAYMENT_INFO = {
  pix: {
    tipo: "CNPJ",
    chave: "31.874.576/0001-01",
  },
  transferencia: {
    banco: "Banco Sicredi",
    nomeTitular: "Igreja Batista da Cruz",
    documento: "31.874.576/0001-01",
    agencia: "3021",
    conta: "14479-7",
  },
  linkMercadoPago: "https://link.mercadopago.com.br/dizimovision",
} as const;
