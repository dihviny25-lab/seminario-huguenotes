import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";

import type { ChargeAlert } from "@/lib/dashboard";
import { buildChargeAlert, pickNextLesson, selectUnwatchedVideos } from "@/lib/dashboard";
import { listMyChargesFn } from "@/functions/payments";
import { listMyWatchedVideosFn } from "@/functions/videoLessons";
import { requireStudentId } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { disciplines, lessons, videoLessons } from "@/server/db/schema";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export type StudentNextLesson = {
  id: string;
  disciplineId: string;
  disciplineName: string;
  date: string;
};

export type StudentUnwatchedVideo = {
  id: string;
  disciplineId: string;
  disciplineName: string;
  title: string;
};

export type StudentDashboard = {
  chargeAlert: ChargeAlert;
  nextLesson: StudentNextLesson | null;
  unwatchedVideos: Array<StudentUnwatchedVideo>;
};

/** Avisos do topo do portal do aluno: cobrança, próxima aula, vídeos novos. */
export const getStudentDashboardFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<StudentDashboard> => {
    await requireStudentId();
    const today = todayIso();

    const [myCharges, watchedIds, lessonRows, videoRows] = await Promise.all([
      listMyChargesFn(),
      listMyWatchedVideosFn(),
      db
        .select({
          id: lessons.id,
          disciplineId: lessons.disciplineId,
          disciplineName: disciplines.discipline,
          date: lessons.date,
        })
        .from(lessons)
        .innerJoin(disciplines, eq(disciplines.id, lessons.disciplineId)),
      db
        .select({
          id: videoLessons.id,
          disciplineId: videoLessons.disciplineId,
          disciplineName: disciplines.discipline,
          title: videoLessons.title,
          createdAt: videoLessons.createdAt,
        })
        .from(videoLessons)
        .innerJoin(disciplines, eq(disciplines.id, videoLessons.disciplineId)),
    ]);

    const chargeAlert = buildChargeAlert(
      myCharges.map((c) => ({
        chargeId: c.id,
        description: c.description,
        currentAmount: c.currentAmount,
        dueDate: c.dueDate,
        status: c.status,
      })),
      today,
    );

    const next = pickNextLesson(lessonRows, today);
    const nextLesson: StudentNextLesson | null = next
      ? {
          id: next.id,
          disciplineId: next.disciplineId,
          disciplineName: next.disciplineName,
          date: next.date!,
        }
      : null;

    const unwatchedVideos = selectUnwatchedVideos(
      videoRows.map((v) => ({ ...v, createdAt: v.createdAt.toISOString() })),
      watchedIds,
    ).map(({ id, disciplineId, disciplineName, title }) => ({
      id,
      disciplineId,
      disciplineName,
      title,
    }));

    return { chargeAlert, nextLesson, unwatchedVideos };
  },
);
