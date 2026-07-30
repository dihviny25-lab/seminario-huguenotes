import { createFileRoute } from "@tanstack/react-router";

import { getStudentReportData } from "@/functions/reportData";
import { renderStudentReportPdf, slugify } from "@/functions/reportPdf";
import { requireStudentId } from "@/server/auth/guard";

/** Boletim em PDF do próprio aluno logado no portal. */
export const Route = createFileRoute("/portal/pdf")({
  server: {
    handlers: {
      GET: async () => {
        let studentId: string;
        try {
          studentId = await requireStudentId();
        } catch {
          return new Response("Não autenticado.", { status: 401 });
        }

        const report = await getStudentReportData(studentId);
        const buffer = await renderStudentReportPdf(report.student.name, report.rows);

        return new Response(new Uint8Array(buffer), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="boletim-${slugify(report.student.name)}.pdf"`,
          },
        });
      },
    },
  },
});
