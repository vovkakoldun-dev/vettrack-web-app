-- ============================================================================
-- Migration: fix_tasks_completed_at_type
-- Date: 2026-04-10
--
-- tasks.completed_at was stored as text. Convert to timestamptz.
-- Existing text values are ISO 8601 strings that cast cleanly.
-- ============================================================================

BEGIN;

ALTER TABLE tasks
  ALTER COLUMN completed_at TYPE timestamptz
  USING completed_at::timestamptz;

COMMENT ON COLUMN tasks.completed_at IS 'When the task was completed (was text, migrated to timestamptz)';

COMMIT;
