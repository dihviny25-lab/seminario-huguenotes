CREATE TABLE "discipline_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "discipline_id" uuid NOT NULL REFERENCES "disciplines"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "rating" integer NOT NULL,
  "liked_most" text NOT NULL,
  "could_improve" text NOT NULL,
  "additional_comments" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "discipline_feedback_discipline_id_student_id_unique"
    UNIQUE("discipline_id", "student_id"),
  CONSTRAINT "discipline_feedback_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);
