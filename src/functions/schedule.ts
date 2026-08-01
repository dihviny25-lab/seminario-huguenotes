import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";

import { db } from "@/server/db/client";
import { disciplines, teachers } from "@/server/db/schema";
import type { Discipline } from "@/types/schedule";

/**
 * Currículo completo (semestres, módulos, disciplinas, professores) — dado
 * público, igual ao que já era exibido a partir do array estático antes da
 * migração para o banco. Sem checagem de auth de propósito.
 */
export const getPublicDisciplinesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<Discipline>> => {
    const rows = await db
      .select({
        id: disciplines.id,
        semester: disciplines.semester,
        term: disciplines.term,
        module: disciplines.module,
        period: disciplines.period,
        discipline: disciplines.discipline,
        teacher: teachers.name,
        schedule: disciplines.schedule,
        lessons: disciplines.lessons,
        startDate: disciplines.startDate,
        endDate: disciplines.endDate,
        status: disciplines.status,
        observations: disciplines.observations,
      })
      .from(disciplines)
      .leftJoin(teachers, eq(disciplines.teacherId, teachers.id))
      .orderBy(asc(disciplines.sortOrder));

    return rows.map((row) => ({
      ...row,
      period: row.period ?? undefined,
      teacher: row.teacher ?? undefined,
      schedule: row.schedule ?? undefined,
      lessons: row.lessons ?? undefined,
      startDate: row.startDate ?? undefined,
      endDate: row.endDate ?? undefined,
      observations: row.observations ?? undefined,
    }));
  },
);
