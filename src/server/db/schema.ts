import {
  boolean,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Schema do banco (Neon Postgres via Drizzle).
 *
 * `disciplines` é a fonte de verdade do currículo (substitui o antigo
 * src/data/schedule.ts, migrado uma única vez pelo seed script).
 */

export const scheduleStatus = pgEnum("schedule_status", ["confirmed", "pending"]);
export const teacherRole = pgEnum("teacher_role", ["admin", "teacher"]);

export const teachers = pgTable("teachers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  // Nulo = professor sem login (ex.: "Professores convidados", "Todos os professores").
  passwordHash: text("password_hash"),
  // true sempre que a senha foi (re)definida por alguém administrando a conta
  // (criação ou "Redefinir senha") — força a troca no próximo login.
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  // admin: acesso completo (gerenciar professores e alunos).
  // teacher: só visualiza professores/alunos, edita apenas o próprio perfil.
  role: teacherRole("role").notNull().default("teacher"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const disciplines = pgTable("disciplines", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Preserva a ordem de exibição original (currículo → semestre → módulo).
  sortOrder: integer("sort_order").notNull().default(0),
  semester: integer("semester").notNull(),
  term: text("term").notNull(),
  module: text("module").notNull(),
  period: text("period"),
  discipline: text("discipline").notNull(),
  teacherId: uuid("teacher_id").references(() => teachers.id, { onDelete: "set null" }),
  schedule: text("schedule"),
  lessons: integer("lessons"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  status: scheduleStatus("status").notNull(),
  observations: text("observations"),
});

export const students = pgTable("students", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email"),
  active: boolean("active").notNull().default(true),
  // Nulo = aluno sem login no portal ainda (precisa que um admin defina a senha).
  passwordHash: text("password_hash"),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assessments = pgTable("assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  disciplineId: uuid("discipline_id")
    .notNull()
    .references(() => disciplines.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  maxScore: numeric("max_score", { precision: 5, scale: 2 }).notNull().default("10"),
  weight: numeric("weight", { precision: 5, scale: 2 }).notNull().default("1"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const grades = pgTable(
  "grades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    score: numeric("score", { precision: 5, scale: 2 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.assessmentId, table.studentId)],
);

export const lessons = pgTable("lessons", {
  id: uuid("id").primaryKey().defaultRandom(),
  disciplineId: uuid("discipline_id")
    .notNull()
    .references(() => disciplines.id, { onDelete: "cascade" }),
  date: date("date"),
  sequence: integer("sequence").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const attendance = pgTable(
  "attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    present: boolean("present").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.lessonId, table.studentId)],
);

export const videoLessons = pgTable("video_lessons", {
  id: uuid("id").primaryKey().defaultRandom(),
  disciplineId: uuid("discipline_id")
    .notNull()
    .references(() => disciplines.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  youtubeUrl: text("youtube_url").notNull(),
  sequence: integer("sequence").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
