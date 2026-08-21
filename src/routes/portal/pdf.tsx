import { createFileRoute } from "@tanstack/react-router";

import { getStudentReportData } from "@/functions/reportData";
import { renderStudentReportPdf, slugify } from "@/functions/reportPdf";
import { requireStudentId } from "@/server/auth/guard";

/** Boletim em PDF do próprio aluno logado no portal. */
export const Route = createFileRoute("/portal/pdf")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        let studentId: string;
        try {
          studentId = await requireStudentId();
        } catch {
          return new Response("Não autenticado.", { status: 401 });
        }

        const semesterParam = new URL(request.url).searchParams.get("semester");
        const semester = semesterParam ? Number(semesterParam) : null;

        const report = await getStudentReportData(studentId);
        const rows =
          semester === null ? report.rows : report.rows.filter((row) => row.semester === semester);
        const buffer = await renderStudentReportPdf(report.student.name, rows);

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
