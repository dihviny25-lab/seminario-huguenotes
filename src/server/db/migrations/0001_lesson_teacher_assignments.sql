ALTER TABLE "lessons"
ADD COLUMN "teacher_id" uuid REFERENCES "teachers"("id") ON DELETE SET NULL;

CREATE INDEX "lessons_teacher_date_idx" ON "lessons" ("teacher_id", "date");
