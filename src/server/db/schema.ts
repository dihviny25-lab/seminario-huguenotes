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
export const paymentMethod = pgEnum("payment_method", [
  "pix",
  "dinheiro",
  "cartao",
  "transferencia",
  "outro",
]);
export const authorRole = pgEnum("author_role", ["teacher", "student"]);
export const videoSource = pgEnum("video_source", ["youtube", "upload"]);
export const noteKind = pgEnum("note_kind", ["note", "question"]);
export const auditActorType = pgEnum("audit_actor_type", ["teacher", "student"]);
export const pushOwnerType = pgEnum("push_owner_type", ["teacher", "student"]);

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
  // Informações pessoais básicas — o próprio aluno preenche em "Minha conta".
  phone: text("phone"),
  birthDate: date("birth_date"),
  active: boolean("active").notNull().default(true),
  // Bolsa (0-100%) — decidida pelo admin. Aplica desconto nas mensalidades
  // geradas (0 = sem bolsa, 100 = bolsa integral, isento).
  scholarshipPercent: integer("scholarship_percent").notNull().default(0),
  // Nulo = aluno sem login no portal ainda (precisa que um admin defina a senha).
  passwordHash: text("password_hash"),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  // Recuperação de senha self-service — token opaco de uso único, expira em 1h.
  resetToken: text("reset_token"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at", { withTimezone: true }),
  // Confirmação de e-mail — token separado do de redefinição de senha, pra
  // pedir um não invalidar o outro se os dois estiverem pendentes.
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationTokenExpiresAt: timestamp("email_verification_token_expires_at", {
    withTimezone: true,
  }),
  // Token opaco de longa duração (não expira) usado na URL do feed de
  // calendário (.ics) — não é sessão de login, é só pra identificar de quem
  // é o feed quando o Google Calendar/Outlook busca a URL sozinho.
  calendarToken: text("calendar_token").unique(),
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
  // "youtube" usa youtubeUrl; "upload" usa fileUrl (vídeo hospedado no Vercel Blob).
  source: videoSource("source").notNull().default("youtube"),
  youtubeUrl: text("youtube_url"),
  fileUrl: text("file_url"),
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

export const exams = pgTable("exams", {
  id: uuid("id").primaryKey().defaultRandom(),
  disciplineId: uuid("discipline_id")
    .notNull()
    .references(() => disciplines.id, { onDelete: "cascade" }),
  // Elo com a aba Notas — a nota da prova é a nota dessa avaliação.
  assessmentId: uuid("assessment_id")
    .notNull()
    .unique()
    .references(() => assessments.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  instructions: text("instructions"),
  durationMinutes: integer("duration_minutes").notNull(),
  // Nulo = rascunho (invisível pro aluno, perguntas ainda editáveis).
  // Definido = agendada: some vez que chega essa data, fica visível e trava.
  opensAt: timestamp("opens_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const examQuestions = pgTable("exam_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  examId: uuid("exam_id")
    .notNull()
    .references(() => exams.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  points: numeric("points", { precision: 5, scale: 2 }).notNull().default("1"),
  sequence: integer("sequence").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const examOptions = pgTable("exam_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionId: uuid("question_id")
    .notNull()
    .references(() => examQuestions.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
  sequence: integer("sequence").notNull(),
});

export const examAttempts = pgTable(
  "exam_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    // Relógio do servidor — nunca aceito do cliente. É a partir daqui que o
    // prazo (duration_minutes) é calculado.
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    // true quando finalizada pelo fim do tempo (cliente ou cron), não por
    // clique manual em "Finalizar prova".
    autoSubmitted: boolean("auto_submitted").notNull().default(false),
    score: numeric("score", { precision: 5, scale: 2 }),
  },
  (table) => [unique().on(table.examId, table.studentId)],
);

export const examAnswers = pgTable(
  "exam_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => examAttempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => examQuestions.id, { onDelete: "cascade" }),
    optionId: uuid("option_id").references(() => examOptions.id, { onDelete: "set null" }),
    answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.attemptId, table.questionId)],
);

// Catálogo de materiais/livros que podem ser cobrados (ou doados) do aluno —
// separado da biblioteca virtual (`libraryBooks`), que é leitura online livre.
export const courseMaterials = pgTable("course_materials", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdById: uuid("created_by_id").references(() => teachers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const charges = pgTable("charges", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  // Presente só quando a cobrança veio de um material do catálogo (cobrado
  // ou doado) — nulo pra mensalidade e cobrança avulsa comuns.
  courseMaterialId: uuid("course_material_id").references(() => courseMaterials.id, {
    onDelete: "set null",
  }),
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
  // Como foi pago — só preenchido quando é dado baixa manual (PIX, dinheiro
  // etc.); pagamento pelo site já se sabe que foi Mercado Pago.
  paymentMethod: paymentMethod("payment_method"),
  note: text("note"),
  createdById: uuid("created_by_id").references(() => teachers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Controla o lembrete de vencimento por e-mail — evita mandar duas vezes.
  reminderUpcomingSentAt: timestamp("reminder_upcoming_sent_at", { withTimezone: true }),
  reminderOverdueSentAt: timestamp("reminder_overdue_sent_at", { withTimezone: true }),
});

export const studentObservations = pgTable("student_observations", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  teacherId: uuid("teacher_id").references(() => teachers.id, { onDelete: "set null" }),
  // Snapshot do nome de quem escreveu — sobrevive mesmo se o professor for excluído depois.
  authorName: text("author_name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const readingMaterials = pgTable("reading_materials", {
  id: uuid("id").primaryKey().defaultRandom(),
  disciplineId: uuid("discipline_id")
    .notNull()
    .references(() => disciplines.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  sequence: integer("sequence").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assignments = pgTable("assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  disciplineId: uuid("discipline_id")
    .notNull()
    .references(() => disciplines.id, { onDelete: "cascade" }),
  assessmentId: uuid("assessment_id")
    .notNull()
    .unique()
    .references(() => assessments.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  instructions: text("instructions"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assignmentSubmissions = pgTable(
  "assignment_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    textContent: text("text_content"),
    fileUrl: text("file_url"),
    fileName: text("file_name"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    feedback: text("feedback"),
    gradedAt: timestamp("graded_at", { withTimezone: true }),
  },
  (table) => [unique().on(table.assignmentId, table.studentId)],
);

export const forumThreads = pgTable("forum_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  disciplineId: uuid("discipline_id")
    .notNull()
    .references(() => disciplines.id, { onDelete: "cascade" }),
  authorRole: authorRole("author_role").notNull(),
  authorTeacherId: uuid("author_teacher_id").references(() => teachers.id, {
    onDelete: "set null",
  }),
  authorStudentId: uuid("author_student_id").references(() => students.id, {
    onDelete: "set null",
  }),
  authorName: text("author_name").notNull(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const forumPosts = pgTable("forum_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => forumThreads.id, { onDelete: "cascade" }),
  authorRole: authorRole("author_role").notNull(),
  authorTeacherId: uuid("author_teacher_id").references(() => teachers.id, {
    onDelete: "set null",
  }),
  authorStudentId: uuid("author_student_id").references(() => students.id, {
    onDelete: "set null",
  }),
  authorName: text("author_name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const spiritualReflections = pgTable("spiritual_reflections", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  // Snapshot da pergunta feita — o banco de perguntas vive no código, não no banco.
  prompt: text("prompt").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reflectionComments = pgTable("reflection_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  reflectionId: uuid("reflection_id")
    .notNull()
    .references(() => spiritualReflections.id, { onDelete: "cascade" }),
  teacherId: uuid("teacher_id").references(() => teachers.id, { onDelete: "set null" }),
  authorName: text("author_name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const libraryBooks = pgTable("library_books", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  author: text("author"),
  description: text("description"),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  uploadedById: uuid("uploaded_by_id").references(() => teachers.id, { onDelete: "set null" }),
  uploadedByName: text("uploaded_by_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Anotações pessoais do aluno numa disciplina — só ele vê e edita, nem professor tem acesso.
// kind "question" pode ser transformada num tópico do fórum (forumThreadId marca a conversão).
export const studentNotes = pgTable("student_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  disciplineId: uuid("discipline_id")
    .notNull()
    .references(() => disciplines.id, { onDelete: "cascade" }),
  kind: noteKind("kind").notNull().default("note"),
  title: text("title"),
  content: text("content").notNull(),
  forumThreadId: uuid("forum_thread_id").references(() => forumThreads.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Inscrição de push de UM dispositivo/navegador — o mesmo professor ou aluno
// pode ter várias (celular, notebook…), por isso não há um dono único por
// endpoint, e endpoint é a chave de deduplicação (é único por instalação do
// navegador/PWA).
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerType: pushOwnerType("owner_type").notNull(),
  ownerId: uuid("owner_id").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dhKey: text("p256dh_key").notNull(),
  authKey: text("auth_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Log de auditoria — cada linha é um evento (login, logout ou uma ação
 * dentro do sistema). "Tempo de permanência" é calculado no relatório
 * casando cada "login" com o próximo "logout" do mesmo ator (ou, se não
 * houve logout explícito, com a última ação registrada depois do login).
 */
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorType: auditActorType("actor_type").notNull(),
  actorId: uuid("actor_id"),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
