CREATE TYPE "private_file_owner_type" AS ENUM (
  'assignment_submission',
  'reading_material',
  'library_book',
  'presentation_slide',
  'video_lesson'
);

CREATE TABLE "private_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "blob_path" text NOT NULL,
  "original_name" text NOT NULL,
  "content_type" text,
  "owner_type" "private_file_owner_type" NOT NULL,
  "owner_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);

-- Colunas anuláveis: referências antigas continuam em file_url/file_name até a
-- migração manual dos blobs legados (revisão administrativa, não automática —
-- ver docs/superpowers/plans/2026-09-20-lgpd-adequacao.md, Task 1, Step 8).
ALTER TABLE "video_lessons"
ADD COLUMN "file_id" uuid REFERENCES "private_files"("id") ON DELETE SET NULL;

ALTER TABLE "reading_materials"
ADD COLUMN "file_id" uuid REFERENCES "private_files"("id") ON DELETE SET NULL;

ALTER TABLE "presentation_slides"
ADD COLUMN "file_id" uuid REFERENCES "private_files"("id") ON DELETE SET NULL;

ALTER TABLE "assignment_submissions"
ADD COLUMN "file_id" uuid REFERENCES "private_files"("id") ON DELETE SET NULL;

ALTER TABLE "library_books"
ADD COLUMN "file_id" uuid REFERENCES "private_files"("id") ON DELETE SET NULL;
