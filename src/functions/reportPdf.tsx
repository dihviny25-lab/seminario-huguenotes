import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

import type {
  ClassReportAssessment,
  ClassReportRow,
  StudentReportRow,
} from "@/functions/reportData";

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
  rows: Array<StudentReportRow>;
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

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function renderStudentReportPdf(
  studentName: string,
  rows: Array<StudentReportRow>,
): Promise<Buffer> {
  return renderToBuffer(<StudentReportDocument studentName={studentName} rows={rows} />);
}

const classStyles = StyleSheet.create({
  colStudent: { width: "22%" },
  colAverage: { width: "11%", textAlign: "center" },
  colFaltas: { width: "11%", textAlign: "center" },
});

function ClassReportDocument({
  disciplineName,
  assessments,
  rows,
}: {
  disciplineName: string;
  assessments: Array<ClassReportAssessment>;
  rows: Array<ClassReportRow>;
}) {
  const assessmentWidth = `${56 / Math.max(assessments.length, 1)}%`;

  return (
    <Document>
      <Page size="A4" style={styles.page} orientation="landscape">
        <Text style={styles.eyebrow}>Seminário Huguenotes</Text>
        <Text style={styles.title}>{disciplineName}</Text>

        <View style={styles.headerRow}>
          <Text style={classStyles.colStudent}>Aluno</Text>
          {assessments.map((assessment) => (
            <Text key={assessment.id} style={{ width: assessmentWidth, textAlign: "center" }}>
              {assessment.title}
            </Text>
          ))}
          <Text style={classStyles.colAverage}>Média</Text>
          <Text style={classStyles.colFaltas}>Faltas</Text>
        </View>

        {rows.map((row) => (
          <View key={row.studentId} style={styles.row}>
            <Text style={classStyles.colStudent}>{row.studentName}</Text>
            {row.scores.map((score) => (
              <Text
                key={score.assessmentId}
                style={{ width: assessmentWidth, textAlign: "center" }}
              >
                {score.score === null ? "—" : score.score.toFixed(1)}
              </Text>
            ))}
            <Text style={classStyles.colAverage}>
              {row.average === null ? "—" : row.average.toFixed(1)}
            </Text>
            <Text style={classStyles.colFaltas}>
              {row.totalLessons === 0 ? "—" : row.totalFaltas}
            </Text>
          </View>
        ))}

        <Text style={styles.footer}>Emitido em {new Date().toLocaleDateString("pt-BR")}.</Text>
      </Page>
    </Document>
  );
}

export async function renderClassReportPdf(
  disciplineName: string,
  assessments: Array<ClassReportAssessment>,
  rows: Array<ClassReportRow>,
): Promise<Buffer> {
  return renderToBuffer(
    <ClassReportDocument disciplineName={disciplineName} assessments={assessments} rows={rows} />,
  );
}
