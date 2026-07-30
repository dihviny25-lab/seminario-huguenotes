import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { requireOwnDiscipline, requireTeacherId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { disciplines } from "@/server/db/schema";

export type MyDiscipline = {
  id: string;
  semester: number;
  term: string;
  module: string;
  discipline: string;
};

export const listMyDisciplinesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<MyDiscipline>> => {
    const teacherId = await requireTeacherId();
    return db
      .select({
        id: disciplines.id,
        semester: disciplines.semester,
        term: disciplines.term,
        module: disciplines.module,
        discipline: disciplines.discipline,
      })
      .from(disciplines)
      .where(eq(disciplines.teacherId, teacherId))
      .orderBy(asc(disciplines.semester));
  },
);

const disciplineIdSchema = z.object({ disciplineId: z.string().uuid() });

export const getMyDisciplineFn = createServerFn({ method: "GET" })
  .validator(disciplineIdSchema)
  .handler(async ({ data }) => {
    const discipline = await requireOwnDiscipline(data.disciplineId);
    return {
      id: discipline.id,
      semester: discipline.semester,
      term: discipline.term,
      module: discipline.module,
      discipline: discipline.discipline,
    };
  });
