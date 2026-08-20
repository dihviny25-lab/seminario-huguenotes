import { createFileRoute } from "@tanstack/react-router";

import { getClassReportData } from "@/functions/reportData";
import { renderClassReportPdf, slugify } from "@/functions/reportPdf";
import { requireOwnDiscipline } from "@/server/auth/guard";

export const Route = createFileRoute("/painel/relatorio/turma/$disciplineId/pdf")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          await requireOwnDiscipline(params.disciplineId);
        } catch {
          return new Response("Não autenticado.", { status: 401 });
        }

        const report = await getClassReportData(params.disciplineId);
        const buffer = await renderClassReportPdf(
          report.discipline.discipline,
          report.assessments,
          report.rows,
        );

        return new Response(new Uint8Array(buffer), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="turma-${slugify(report.discipline.discipline)}.pdf"`,
          },
        });
      },
    },
  },
});
