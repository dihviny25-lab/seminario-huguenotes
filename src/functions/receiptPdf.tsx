import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { eq } from "drizzle-orm";

import { db } from "@/server/db/client";
import { charges, students } from "@/server/db/schema";

/**
 * Busca uma cobrança com o nome do aluno pra gerar o recibo em PDF. Vive
 * neste arquivo (e não em functions/payments.ts) de propósito: este módulo
 * só é importado pelos handlers de rota (server-side), nunca por páginas
 * client-side — importar `db`/schema aqui não vaza pro bundle do navegador.
 */
export async function getChargeForReceipt(chargeId: string) {
  const [row] = await db
    .select({ charge: charges, studentName: students.name })
    .from(charges)
    .innerJoin(students, eq(charges.studentId, students.id))
    .where(eq(charges.id, chargeId))
    .limit(1);
  return row ?? null;
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  eyebrow: { fontSize: 9, color: "#6b7280", letterSpacing: 1, textTransform: "uppercase" },
  title: { fontSize: 18, fontWeight: 700, marginTop: 4, marginBottom: 16 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 8,
  },
  label: { width: "35%", color: "#6b7280" },
  value: { width: "65%", fontWeight: 700 },
  footer: { marginTop: 24, fontSize: 8, color: "#6b7280" },
});

const paymentMethodLabels: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  transferencia: "Transferência",
  outro: "Outro",
};

function formatPaymentMethod(
  method: "pix" | "dinheiro" | "cartao" | "transferencia" | "outro" | null,
): string {
  if (method === null) return "Mercado Pago (site)";
  return paymentMethodLabels[method];
}

function formatAmount(amount: string): string {
  return Number(amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function ReceiptDocument({
  studentName,
  description,
  paidAmount,
  paymentMethod,
  paidAt,
}: {
  studentName: string;
  description: string;
  paidAmount: string;
  paymentMethod: "pix" | "dinheiro" | "cartao" | "transferencia" | "outro" | null;
  paidAt: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>Seminário Huguenotes</Text>
        <Text style={styles.title}>Recibo de pagamento</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Aluno</Text>
          <Text style={styles.value}>{studentName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Descrição</Text>
          <Text style={styles.value}>{description}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Valor pago</Text>
          <Text style={styles.value}>{formatAmount(paidAmount)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Forma de pagamento</Text>
          <Text style={styles.value}>{formatPaymentMethod(paymentMethod)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Data do pagamento</Text>
          <Text style={styles.value}>{formatDate(paidAt)}</Text>
        </View>

        <Text style={styles.footer}>Emitido em {new Date().toLocaleDateString("pt-BR")}.</Text>
      </Page>
    </Document>
  );
}

export async function renderChargeReceiptPdf(input: {
  studentName: string;
  description: string;
  paidAmount: string;
  paymentMethod: "pix" | "dinheiro" | "cartao" | "transferencia" | "outro" | null;
  paidAt: string; // ISO
}): Promise<Buffer> {
  return renderToBuffer(
    <ReceiptDocument
      studentName={input.studentName}
      description={input.description}
      paidAmount={input.paidAmount}
      paymentMethod={input.paymentMethod}
      paidAt={input.paidAt}
    />,
  );
}
