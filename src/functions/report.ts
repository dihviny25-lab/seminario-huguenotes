import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireOwnDiscipline, requireStudentId, requireTeacherId } from "@/server/auth/guard";
import {
  getClassReportData,
  getStudentReportData,
  type ClassReport,
  type StudentReport,
} from "@/functions/reportData";

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

const classReportSchema = z.object({ disciplineId: z.string().uuid() });

/** Boletim da turma inteira de uma disciplina — só o professor dono dela. */
export const getClassReportFn = createServerFn({ method: "GET" })
  .validator(classReportSchema)
  .handler(async ({ data }): Promise<ClassReport> => {
    await requireOwnDiscipline(data.disciplineId);
    return getClassReportData(data.disciplineId);
  });

export type { StudentReport, StudentReportRow } from "@/functions/reportData";
export type { ClassReport, ClassReportRow, ClassReportAssessment } from "@/functions/reportData";
