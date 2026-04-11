-- ============================================================================
-- Migration: skip_staff_time_blocks_not_null (WARNING — SKIPPED)
-- Date: 2026-04-10
--
-- staff_time_blocks.staff_id has 5 rows with NULL values.
-- Cannot safely add NOT NULL constraint without data loss.
--
-- To fix manually:
--   1. DELETE FROM staff_time_blocks WHERE staff_id IS NULL;
--      (or UPDATE them to a valid staff_id)
--   2. ALTER TABLE staff_time_blocks ALTER COLUMN staff_id SET NOT NULL;
-- ============================================================================

-- Intentionally empty — logged as warning.
SELECT 1;
