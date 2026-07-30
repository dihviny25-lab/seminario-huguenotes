import "dotenv/config";

import { disciplines as legacyDisciplines } from "../../data/schedule";
import { db } from "./client";
import { disciplines, teachers } from "./schema";

/**
 * Migração única: importa o array hardcoded de src/data/schedule.ts para o
 * Postgres. Depois desta migração, `disciplines` no banco passa a ser a
 * fonte de verdade do currículo — não editar mais src/data/schedule.ts.
 *
 * Idempotente por checagem simples: não roda se `disciplines` já tiver dados.
 */

function slugifyForEmail(name: string): string {
  // Accented letters fall outside [a-z0-9] and simply become a "." separator
  // below — good enough for a placeholder login email, no deburring needed.
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

async function seed() {
  const existing = await db.select({ id: disciplines.id }).from(disciplines).limit(1);
  if (existing.length > 0) {
    console.log("`disciplines` já tem dados — seed abortado (rode só uma vez).");
    return;
  }

  const teacherNames = [
    ...new Set(
      legacyDisciplines.map((d) => d.teacher).filter((name): name is string => Boolean(name)),
    ),
  ];

  const teacherIdByName = new Map<string, string>();
  for (const name of teacherNames) {
    const [row] = await db
      .insert(teachers)
      .values({
        name,
        email: `${slugifyForEmail(name)}@seminariohuguenotes.local`,
        passwordHash: null,
      })
      .returning({ id: teachers.id });
    teacherIdByName.set(name, row.id);
  }
  console.log(`Migrados ${teacherIdByName.size} professores.`);

  const rows = legacyDisciplines.map((d) => ({
    semester: d.semester,
    term: d.term,
    module: d.module,
    period: d.period,
    discipline: d.discipline,
    teacherId: d.teacher ? teacherIdByName.get(d.teacher) : undefined,
    schedule: d.schedule,
    lessons: d.lessons,
    startDate: d.startDate,
    endDate: d.endDate,
    status: d.status,
    observations: d.observations,
  }));
  await db.insert(disciplines).values(rows);
  console.log(`Migradas ${rows.length} disciplinas.`);
}

seed()
  .then(() => {
    console.log("Seed concluído.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed falhou:", error);
    process.exit(1);
  });
