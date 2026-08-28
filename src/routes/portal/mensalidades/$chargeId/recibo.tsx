import { createFileRoute } from "@tanstack/react-router";

import { getChargeForReceipt, renderChargeReceiptPdf } from "@/functions/receiptPdf";
import { slugify } from "@/functions/reportPdf";
import { requireStudentId } from "@/server/auth/guard";

export const Route = createFileRoute("/portal/mensalidades/$chargeId/recibo")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        let studentId: string;
        try {
          studentId = await requireStudentId();
        } catch {
          return new Response("Não autenticado.", { status: 401 });
        }

        const row = await getChargeForReceipt(params.chargeId);
        if (!row || row.charge.studentId !== studentId) {
          return new Response("Não encontrado.", { status: 404 });
        }
        const { charge, studentName } = row;
        if (charge.status !== "paid") {
          return new Response("Cobrança não paga.", { status: 400 });
        }

        const buffer = await renderChargeReceiptPdf({
          studentName,
          description: charge.description,
          paidAmount: charge.paidAmount ?? charge.fullAmount,
          paymentMethod: charge.paymentMethod,
          paidAt: (charge.paidAt ?? new Date()).toISOString(),
        });

        return new Response(new Uint8Array(buffer), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="recibo-${slugify(studentName)}.pdf"`,
          },
        });
      },
    },
  },
});
