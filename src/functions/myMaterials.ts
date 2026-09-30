import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";

import { isAdminTeacher, requireTeacherId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { disciplines, presentationSlides, readingMaterials } from "@/server/db/schema";

export type MyMaterialItem = {
  kind: "apostila" | "slide";
  id: string;
  disciplineId: string;
  disciplineName: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileName: string;
};

/**
 * Apostilas + slides de todas as disciplinas do professor logado, num só
 * array — base do hub "Minhas Matérias". Admin vê de todas as disciplinas,
 * de todos os professores. Não expõe update/delete próprios: a UI chama
 * updateMaterialFn/deleteMaterialFn ou updateSlideFn/deleteSlideFn
 * conforme o `kind` do item, ambas já protegidas por requireOwnDiscipline.
 */
export const listMyMaterialsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<MyMaterialItem>> => {
    const teacherId = await requireTeacherId();
    const isAdmin = await isAdminTeacher(teacherId);
    const ownDiscipline = isAdmin ? undefined : eq(disciplines.teacherId, teacherId);

    const [materialRows, slideRows] = await Promise.all([
      db
        .select({
          id: readingMaterials.id,
          disciplineId: readingMaterials.disciplineId,
          disciplineName: disciplines.discipline,
          title: readingMaterials.title,
          description: readingMaterials.description,
          fileUrl: readingMaterials.fileUrl,
          fileName: readingMaterials.fileName,
        })
        .from(readingMaterials)
        .innerJoin(disciplines, eq(disciplines.id, readingMaterials.disciplineId))
        .where(ownDiscipline),
      db
        .select({
          id: presentationSlides.id,
          disciplineId: presentationSlides.disciplineId,
          disciplineName: disciplines.discipline,
          title: presentationSlides.title,
          description: presentationSlides.description,
          fileUrl: presentationSlides.fileUrl,
          fileName: presentationSlides.fileName,
        })
        .from(presentationSlides)
        .innerJoin(disciplines, eq(disciplines.id, presentationSlides.disciplineId))
        .where(ownDiscipline),
    ]);

    return [
      ...materialRows.map((row) => ({ ...row, kind: "apostila" as const })),
      ...slideRows.map((row) => ({ ...row, kind: "slide" as const })),
    ];
  },
);
