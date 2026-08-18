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
export const chargeStatus = pgEnum("charge_status", ["pending", "paid", "canceled"]);

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
  // Recuperação de senha self-service — token opaco de uso único, expira em 1h.
  resetToken: text("reset_token"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at", { withTimezone: true }),
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
  // Recuperação de senha self-service — token opaco de uso único, expira em 1h.
  resetToken: text("reset_token"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at", { withTimezone: true }),
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
  // Chamada por QR code: enquanto aberta, o token na URL escaneada
  // confirma a presença do próprio aluno logado automaticamente.
  checkInOpen: boolean("check_in_open").notNull().default(false),
  checkInToken: text("check_in_token"),
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

export const videoWatches = pgTable(
  "video_watches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    videoLessonId: uuid("video_lesson_id")
      .notNull()
      .references(() => videoLessons.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    // Marcado automaticamente quando o player do YouTube reporta o vídeo como concluído.
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.videoLessonId, table.studentId)],
);

export const charges = pgTable("charges", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  // Valor cheio (sem desconto) — pra avulsa é o que o admin digitou; pra
  // mensalidade é o valor da modalidade escolhida, copiado na criação.
  fullAmount: numeric("full_amount", { precision: 10, scale: 2 }).notNull(),
  // Desconto por pontualidade (%) — 0 pra avulsa, 20 pra mensalidade.
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  // Nome da modalidade escolhida (nulo pra cobrança avulsa).
  modality: text("modality"),
  dueDate: date("due_date").notNull(),
  // "YYYY-MM" só para mensalidade gerada em lote (evita cobrar o mesmo mês
  // duas vezes); nulo para cobrança avulsa.
  period: text("period"),
  status: chargeStatus("status").notNull().default("pending"),
  mpPreferenceId: text("mp_preference_id"),
  mpInitPoint: text("mp_init_point"),
  mpPaymentId: text("mp_payment_id"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  // Valor efetivamente recebido (pode ser com ou sem desconto, dependendo
  // de quando foi pago) — o que entra de verdade no dashboard financeiro.
  paidAmount: numeric("paid_amount", { precision: 10, scale: 2 }),
  paidManually: boolean("paid_manually").notNull().default(false),
  note: text("note"),
  createdById: uuid("created_by_id").references(() => teachers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Controla o lembrete de vencimento por e-mail — evita mandar duas vezes.
  reminderUpcomingSentAt: timestamp("reminder_upcoming_sent_at", { withTimezone: true }),
  reminderOverdueSentAt: timestamp("reminder_overdue_sent_at", { withTimezone: true }),
});
