import { createFileRoute } from "@tanstack/react-router";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

import { getStudentReportData } from "@/functions/reportData";
import { requireTeacherId } from "@/server/auth/guard";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  eyebrow: { fontSize: 9, color: "#6b7280", letterSpacing: 1, textTransform: "uppercase" },
  title: { fontSize: 18, fontWeight: 700, marginTop: 4, marginBottom: 16 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 6,
  },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#111827",
    paddingBottom: 6,
    fontWeight: 700,
  },
  colSemester: { width: "10%" },
  colModule: { width: "18%" },
  colDiscipline: { width: "32%" },
  colTeacher: { width: "20%" },
  colAverage: { width: "10%", textAlign: "center" },
  colFaltas: { width: "10%", textAlign: "center" },
  footer: { marginTop: 24, fontSize: 8, color: "#6b7280" },
});

function StudentReportDocument({
  studentName,
  rows,
}: {
  studentName: string;
  rows: Awaited<ReturnType<typeof getStudentReportData>>["rows"];
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>Seminário Huguenotes</Text>
        <Text style={styles.title}>{studentName}</Text>

        <View style={styles.headerRow}>
          <Text style={styles.colSemester}>Sem.</Text>
          <Text style={styles.colModule}>Módulo</Text>
          <Text style={styles.colDiscipline}>Disciplina</Text>
          <Text style={styles.colTeacher}>Professor</Text>
          <Text style={styles.colAverage}>Média</Text>
          <Text style={styles.colFaltas}>Faltas</Text>
        </View>

        {rows.map((row) => (
          <View key={row.disciplineId} style={styles.row}>
            <Text style={styles.colSemester}>{row.semester}º</Text>
            <Text style={styles.colModule}>{row.module}</Text>
            <Text style={styles.colDiscipline}>{row.discipline}</Text>
            <Text style={styles.colTeacher}>{row.teacherName ?? "—"}</Text>
            <Text style={styles.colAverage}>
              {row.average === null ? "—" : row.average.toFixed(1)}
            </Text>
            <Text style={styles.colFaltas}>{row.totalLessons === 0 ? "—" : row.totalFaltas}</Text>
          </View>
        ))}

        <Text style={styles.footer}>Emitido em {new Date().toLocaleDateString("pt-BR")}.</Text>
      </Page>
    </Document>
  );
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const Route = createFileRoute("/painel/relatorio/$studentId/pdf")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          await requireTeacherId();
        } catch {
          return new Response("Não autenticado.", { status: 401 });
        }

        const report = await getStudentReportData(params.studentId);
        const buffer = await renderToBuffer(
          <StudentReportDocument studentName={report.student.name} rows={report.rows} />,
        );

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
