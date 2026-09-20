-- Relatório de blobs legados por tipo — só leitura, sem apagar nada. Roda
-- depois que a migration 0002_private_files.sql já estiver aplicada.
-- Nunca expõe URL nem nome de aluno; só contagem por tipo/situação, pra
-- revisão administrativa antes de qualquer migração manual de blob antigo.
SELECT
  'reading_material' AS tipo,
  count(*) FILTER (WHERE file_id IS NULL) AS legado_sem_migrar,
  count(*) FILTER (WHERE file_id IS NOT NULL) AS ja_migrado
FROM reading_materials
UNION ALL
SELECT
  'library_book',
  count(*) FILTER (WHERE file_id IS NULL),
  count(*) FILTER (WHERE file_id IS NOT NULL)
FROM library_books
UNION ALL
SELECT
  'presentation_slide',
  count(*) FILTER (WHERE file_id IS NULL),
  count(*) FILTER (WHERE file_id IS NOT NULL)
FROM presentation_slides
UNION ALL
SELECT
  'assignment_submission',
  count(*) FILTER (WHERE file_url IS NOT NULL AND file_id IS NULL),
  count(*) FILTER (WHERE file_id IS NOT NULL)
FROM assignment_submissions
UNION ALL
SELECT
  'video_lesson',
  count(*) FILTER (WHERE source = 'upload' AND file_id IS NULL),
  count(*) FILTER (WHERE file_id IS NOT NULL)
FROM video_lessons;
