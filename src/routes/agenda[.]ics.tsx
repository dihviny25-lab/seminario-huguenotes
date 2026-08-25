import { createFileRoute } from "@tanstack/react-router";
import { and, eq, isNotNull } from "drizzle-orm";

import { buildIcsCalendar, type IcsEvent } from "@/lib/ics";
import { db } from "@/server/db/client";
import { assignments, disciplines, exams, lessons, students } from "@/server/db/schema";

/**
 * Feed de calendário (.ics) do aluno — URL pública protegida por token opaco
 * (não por sessão de login), pra Google Calendar/Outlook/Apple Calendar
 * poderem buscar sozinhos, periodicamente, sem um navegador logado.
 */
export const Route = createFileRoute("/agenda.ics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token");
        if (!token) {
          return new Response("Link inválido.", { status: 400 });
        }

        const [student] = await db
          .select({ id: students.id, name: students.name })
          .from(students)
          .where(eq(students.calendarToken, token))
          .limit(1);
        if (!student) {
          return new Response("Link inválido.", { status: 404 });
        }

        const [lessonRows, examRows, assignmentRows] = await Promise.all([
          db
            .select({
              id: lessons.id,
              date: lessons.date,
              sequence: lessons.sequence,
              disciplineName: disciplines.discipline,
            })
            .from(lessons)
            .innerJoin(disciplines, eq(disciplines.id, lessons.disciplineId))
            .where(isNotNull(lessons.date)),
          db
            .select({
              id: exams.id,
              title: exams.title,
              opensAt: exams.opensAt,
              durationMinutes: exams.durationMinutes,
              disciplineName: disciplines.discipline,
            })
            .from(exams)
            .innerJoin(disciplines, eq(disciplines.id, exams.disciplineId))
            .where(isNotNull(exams.opensAt)),
          db
            .select({
              id: assignments.id,
              title: assignments.title,
              dueAt: assignments.dueAt,
              disciplineName: disciplines.discipline,
            })
            .from(assignments)
            .innerJoin(disciplines, eq(disciplines.id, assignments.disciplineId))
            .where(and(isNotNull(assignments.dueAt))),
        ]);

        const events: Array<IcsEvent> = [
          ...lessonRows
            .filter((l) => l.date !== null)
            .map(
              (lesson): IcsEvent => ({
                uid: `aula-${lesson.id}@seminariohuguenotes`,
                title: `Aula ${lesson.sequence} — ${lesson.disciplineName}`,
                date: lesson.date!,
                allDay: true,
              }),
            ),
          ...examRows
            .filter((e) => e.opensAt !== null)
            .map((exam): IcsEvent => {
              const start = exam.opensAt!;
              const end = new Date(start.getTime() + exam.durationMinutes * 60_000);
              return {
                uid: `prova-${exam.id}@seminariohuguenotes`,
                title: `Prova: ${exam.title} — ${exam.disciplineName}`,
                description: "A prova fica disponível a partir desse horário no portal.",
                start,
                end,
              };
            }),
          ...assignmentRows
            .filter((a) => a.dueAt !== null)
            .map((assignment): IcsEvent => {
              const end = assignment.dueAt!;
              const start = new Date(end.getTime() - 30 * 60_000);
              return {
                uid: `tarefa-${assignment.id}@seminariohuguenotes`,
                title: `Prazo: ${assignment.title} — ${assignment.disciplineName}`,
                start,
                end,
              };
            }),
        ];

        const ics = buildIcsCalendar(events, `Seminário Huguenotes — ${student.name}`);

        return new Response(ics, {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'inline; filename="agenda-seminario-huguenotes.ics"',
          },
        });
      },
    },
  },
});
