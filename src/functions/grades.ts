import { createServerFn } from "@tanstack/react-start";
import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import { requireOwnDiscipline } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { assessments, grades, students } from "@/server/db/schema";
import { sendPushToOwner } from "@/server/push";

const disciplineIdSchema = z.object({ disciplineId: z.string().uuid() });

export type GradesBoard = {
  students: Array<{ id: string; name: string }>;
  assessments: Array<{ id: string; title: string; maxScore: string; weight: string }>;
  grades: Array<{ assessmentId: string; studentId: string; score: string }>;
};

/** Alunos ativos, avaliações e notas já lançadas — tudo que a grade precisa. */
export const getGradesBoardFn = createServerFn({ method: "GET" })
  .validator(disciplineIdSchema)
  .handler(async ({ data }): Promise<GradesBoard> => {
    await requireOwnDiscipline(data.disciplineId);

    const [studentRows, assessmentRows] = await Promise.all([
      db
        .select({ id: students.id, name: students.name })
        .from(students)
        .where(eq(students.active, true))
        .orderBy(asc(students.name)),
      db
        .select({
          id: assessments.id,
          title: assessments.title,
          maxScore: assessments.maxScore,
          weight: assessments.weight,
        })
        .from(assessments)
        .where(eq(assessments.disciplineId, data.disciplineId))
        .orderBy(asc(assessments.createdAt)),
    ]);

    const assessmentIds = assessmentRows.map((a) => a.id);
    const gradeRows =
      assessmentIds.length === 0
        ? []
        : await db
            .select({
              assessmentId: grades.assessmentId,
              studentId: grades.studentId,
              score: grades.score,
            })
            .from(grades)
            .where(inArray(grades.assessmentId, assessmentIds));

    return { students: studentRows, assessments: assessmentRows, grades: gradeRows };
  });

const createAssessmentSchema = z.object({
  disciplineId: z.string().uuid(),
  title: z.string().trim().min(1, "Informe um título."),
  maxScore: z.number().positive().default(10),
  weight: z.number().positive().default(1),
});

export const createAssessmentFn = createServerFn({ method: "POST" })
  .validator(createAssessmentSchema)
  .handler(async ({ data }) => {
    const discipline = await requireOwnDiscipline(data.disciplineId);
    const [row] = await db
      .insert(assessments)
      .values({
        disciplineId: data.disciplineId,
        title: data.title,
        maxScore: String(data.maxScore),
        weight: String(data.weight),
      })
      .returning({ id: assessments.id });
    await logAudit(
      "avaliacao.criar",
      `Criou a avaliação "${data.title}" em ${discipline.discipline}.`,
    );
    return row;
  });

const deleteAssessmentSchema = z.object({
  disciplineId: z.string().uuid(),
  assessmentId: z.string().uuid(),
});

export const deleteAssessmentFn = createServerFn({ method: "POST" })
  .validator(deleteAssessmentSchema)
  .handler(async ({ data }) => {
    const discipline = await requireOwnDiscipline(data.disciplineId);
    const [assessment] = await db
      .select({ title: assessments.title })
      .from(assessments)
      .where(eq(assessments.id, data.assessmentId))
      .limit(1);
    await db.delete(assessments).where(eq(assessments.id, data.assessmentId));
    await logAudit(
      "avaliacao.apagar",
      `Apagou a avaliação "${assessment?.title ?? data.assessmentId}" em ${discipline.discipline}.`,
    );
  });

const setGradeSchema = z.object({
  disciplineId: z.string().uuid(),
  assessmentId: z.string().uuid(),
  studentId: z.string().uuid(),
  score: z.number().min(0),
});

export const setGradeFn = createServerFn({ method: "POST" })
  .validator(setGradeSchema)
  .handler(async ({ data }) => {
    await requireOwnDiscipline(data.disciplineId);
    await db
      .insert(grades)
      .values({
        assessmentId: data.assessmentId,
        studentId: data.studentId,
        score: String(data.score),
      })
      .onConflictDoUpdate({
        target: [grades.assessmentId, grades.studentId],
        set: { score: String(data.score), updatedAt: new Date() },
      });
    const [row] = await db
      .select({ assessmentTitle: assessments.title, studentName: students.name })
      .from(assessments)
      .innerJoin(students, eq(students.id, data.studentId))
      .where(eq(assessments.id, data.assessmentId))
      .limit(1);
    await logAudit(
      "nota.lancar",
      `Lançou nota ${data.score} de ${row?.studentName ?? "aluno"} em "${row?.assessmentTitle ?? "avaliação"}".`,
    );
    await sendPushToOwner("student", data.studentId, {
      title: "Nota lançada",
      body: `Você tirou ${data.score} em "${row?.assessmentTitle ?? "uma avaliação"}".`,
      url: "/portal",
    });
  });
