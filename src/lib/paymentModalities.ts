export type PaymentModality = {
  id: string;
  name: string;
  fullValue: number;
};

/** Desconto por pontualidade — igual para todas as modalidades. */
export const PUNCTUALITY_DISCOUNT_PERCENT = 20;

/** Modalidades de mensalidade da igreja — valores fixos, uso só interno (painel do admin). */
export const PAYMENT_MODALITIES: Array<PaymentModality> = [
  { id: "outras-igrejas", name: "Membros de Outras Igrejas", fullValue: 187.5 },
  { id: "obreiros", name: "Obreiros", fullValue: 150 },
  { id: "ibv-pastores", name: "Membros IBV e Pastores", fullValue: 125 },
];

export function getPaymentModality(id: string): PaymentModality | undefined {
  return PAYMENT_MODALITIES.find((m) => m.id === id);
}
