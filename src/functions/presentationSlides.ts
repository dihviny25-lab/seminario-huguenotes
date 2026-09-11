import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import { requireAnyLogin, requireOwnDiscipline } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { disciplines, presentationSlides } from "@/server/db/schema";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export type PresentationSlide = {
  id: string;
  disciplineId: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileName: string;
  sequence: number;
  /** null = disponível já (ou disciplina sem data de início definida). */
  availableAt: string | null;
};

export type PortalPresentationSlide = Omit<PresentationSlide, "fileUrl">;

const disciplineIdSchema = z.object({ disciplineId: z.string().uuid() });

/** Slides de uma disciplina — só o professor dono dela gerencia. */
export const listMyDisciplineSlidesFn = createServerFn({ method: "GET" })
  .validator(disciplineIdSchema)
  .handler(async ({ data }): Promise<Array<PresentationSlide>> => {
    await requireOwnDiscipline(data.disciplineId);
    const rows = await db
      .select()
      .from(presentationSlides)
      .where(eq(presentationSlides.disciplineId, data.disciplineId))
      .orderBy(asc(presentationSlides.sequence));
    // Visão do professor gerenciando o conteúdo — sempre "disponível", o
    // bloqueio por data é só pro lado do aluno lendo.
    return rows.map((row) => ({ ...row, availableAt: null }));
  });

const createSchema = z.object({
  disciplineId: z.string().uuid(),
  title: z.string().trim().min(1, "Informe um título."),
  description: z.string().trim().optional(),
  fileUrl: z.string().trim().url("URL de arquivo inválida."),
  fileName: z
    .string()
    .trim()
    .min(1)
    .refine((name) => name.toLowerCase().endsWith(".pdf"), {
      message: "O arquivo precisa ser um PDF.",
    }),
});

export const createSlideFn = createServerFn({ method: "POST" })
  .validator(createSchema)
  .handler(async ({ data }) => {
    const discipline = await requireOwnDiscipline(data.disciplineId);

    const existing = await db
      .select({ sequence: presentationSlides.sequence })
      .from(presentationSlides)
      .where(eq(presentationSlides.disciplineId, data.disciplineId));
    const nextSequence = existing.reduce((max, s) => Math.max(max, s.sequence), 0) + 1;

    const [row] = await db
      .insert(presentationSlides)
      .values({
        disciplineId: data.disciplineId,
        title: data.title,
        description: data.description || null,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        sequence: nextSequence,
      })
      .returning({ id: presentationSlides.id });
    await logAudit("slide.criar", `Adicionou o slide "${data.title}" em ${discipline.discipline}.`);
    return row;
  });

const updateSchema = z.object({
  disciplineId: z.string().uuid(),
  slideId: z.string().uuid(),
  title: z.string().trim().min(1, "Informe um título."),
  description: z.string().trim().optional(),
});

export const updateSlideFn = createServerFn({ method: "POST" })
  .validator(updateSchema)
  .handler(async ({ data }) => {
    const discipline = await requireOwnDiscipline(data.disciplineId);
    const [updated] = await db
      .update(presentationSlides)
      .set({ title: data.title, description: data.description || null })
      .where(
        and(
          eq(presentationSlides.id, data.slideId),
          eq(presentationSlides.disciplineId, data.disciplineId),
        ),
      )
      .returning({ id: presentationSlides.id });
    if (!updated) throw new Error("Slide não encontrado nesta disciplina.");
    await logAudit("slide.editar", `Editou o slide "${data.title}" em ${discipline.discipline}.`);
  });

const deleteSchema = z.object({ disciplineId: z.string().uuid(), slideId: z.string().uuid() });

export const deleteSlideFn = createServerFn({ method: "POST" })
  .validator(deleteSchema)
  .handler(async ({ data }) => {
    const discipline = await requireOwnDiscipline(data.disciplineId);
    const [slide] = await db
      .delete(presentationSlides)
      .where(
        and(
          eq(presentationSlides.id, data.slideId),
          eq(presentationSlides.disciplineId, data.disciplineId),
        ),
      )
      .returning({ title: presentationSlides.title });
    if (!slide) throw new Error("Slide não encontrado nesta disciplina.");
    await logAudit(
      "slide.apagar",
      `Apagou o slide "${slide?.title ?? data.slideId}" em ${discipline.discipline}.`,
    );
  });

function selectSlideColumns() {
  return {
    id: presentationSlides.id,
    disciplineId: presentationSlides.disciplineId,
    title: presentationSlides.title,
    description: presentationSlides.description,
    fileName: presentationSlides.fileName,
    sequence: presentationSlides.sequence,
    startDate: disciplines.startDate,
  };
}

function withAvailability(
  row: PortalPresentationSlide & { startDate: string | null },
): PortalPresentationSlide {
  const { startDate, ...slide } = row;
  const available = startDate === null || startDate <= todayIso();
  return { ...slide, availableAt: available ? null : startDate };
}

/**
 * Todos os slides do currículo, pra biblioteca do portal do aluno — aparecem
 * todos, mas os de disciplinas que ainda não começaram vêm marcados com
 * `availableAt` (o cliente mostra bloqueado até essa data).
 */
export const listAllPresentationSlidesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<PortalPresentationSlide>> => {
    await requireAnyLogin();
    const rows = await db
      .select(selectSlideColumns())
      .from(presentationSlides)
      .innerJoin(disciplines, eq(disciplines.id, presentationSlides.disciplineId))
      .orderBy(asc(presentationSlides.sequence));
    return rows.map(withAvailability);
  },
);

/** Slides de UMA disciplina — pra página do curso no portal (qualquer aluno/professor). */
export const listDisciplinePresentationSlidesFn = createServerFn({ method: "GET" })
  .validator(disciplineIdSchema)
  .handler(async ({ data }): Promise<Array<PortalPresentationSlide>> => {
    await requireAnyLogin();
    const rows = await db
      .select(selectSlideColumns())
      .from(presentationSlides)
      .innerJoin(disciplines, eq(disciplines.id, presentationSlides.disciplineId))
      .where(eq(presentationSlides.disciplineId, data.disciplineId))
      .orderBy(asc(presentationSlides.sequence));
    return rows.map(withAvailability);
  });

const slideIdSchema = z.object({ slideId: z.string().uuid() });

/** Retorna a URL somente quando a disciplina já começou. */
export const getPresentationSlideFileFn = createServerFn({ method: "GET" })
  .validator(slideIdSchema)
  .handler(async ({ data }): Promise<{ fileUrl: string }> => {
    await requireAnyLogin();
    const [row] = await db
      .select({ fileUrl: presentationSlides.fileUrl, startDate: disciplines.startDate })
      .from(presentationSlides)
      .innerJoin(disciplines, eq(disciplines.id, presentationSlides.disciplineId))
      .where(eq(presentationSlides.id, data.slideId))
      .limit(1);
    if (!row) throw new Error("Slide não encontrado.");
    if (row.startDate !== null && row.startDate > todayIso()) {
      throw new Error("Este slide ainda não está disponível.");
    }
    return { fileUrl: row.fileUrl };
  });
