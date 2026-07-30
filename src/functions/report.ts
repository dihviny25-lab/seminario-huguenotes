import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireStudentId, requireTeacherId } from "@/server/auth/guard";
import { getStudentReportData, type StudentReport } from "@/functions/reportData";

const reportSchema = z.object({ studentId: z.string().uuid() });

/**
 * RPC chamável pelo cliente — não fica restrito às disciplinas do professor
 * logado (qualquer professor pode buscar/imprimir o relatório de qualquer
 * aluno).
 */
export const getStudentReportFn = createServerFn({ method: "GET" })
  .validator(reportSchema)
  .handler(async ({ data }): Promise<StudentReport> => {
    await requireTeacherId();
    return getStudentReportData(data.studentId);
  });

/** Portal do aluno: só o próprio boletim, nunca de outro aluno. */
export const getMyStudentReportFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<StudentReport> => {
    const studentId = await requireStudentId();
    return getStudentReportData(studentId);
  },
);

export type { StudentReport, StudentReportRow } from "@/functions/reportData";
