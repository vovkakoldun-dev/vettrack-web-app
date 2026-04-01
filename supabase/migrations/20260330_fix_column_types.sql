-- ============================================================================
-- MIGRATION: Fix Incorrect PostgreSQL Column Types
-- ============================================================================
-- Converts TEXT columns to proper native types where PostgreSQL offers
-- built-in validation, indexing, and operator support.
--
-- CHANGES:
--   shifts.start_time         TEXT → time    (HH:MM format, auto-casts cleanly)
--   shifts.end_time           TEXT → time    (HH:MM format, auto-casts cleanly)
--   tasks.due_time            TEXT → time    (empty column, clean conversion)
--   tasks.completed_at        TEXT → timestamptz (locale strings → ISO 8601)
--   login_activity.ip_address TEXT → inet    (all NULL currently, clean)
--   user_sessions.ip_address  TEXT → inet    (all NULL currently, clean)
--
-- ALREADY CORRECT (no changes needed):
--   tasks.tags                text[]          (already typed array)
--   invoices.*                numeric(10,2)   (all money columns already precise)
--   record_vitals.*           numeric/integer (already have proper precision)
--   staff_time_blocks         time            (already correct)
--   appointments              timestamptz     (already correct)
--   v_invoice_summary         VIEW            (inherits precision from source columns)
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. shifts.start_time  TEXT → time
-- ════════════════════════════════════════════════════════════════════════════
-- Existing data: "08:00", "09:00", etc. — valid time literals.
-- USING clause casts existing text values during conversion.

ALTER TABLE shifts
  ALTER COLUMN start_time TYPE time USING start_time::time;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. shifts.end_time  TEXT → time
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE shifts
  ALTER COLUMN end_time TYPE time USING end_time::time;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. tasks.due_time  TEXT → time
-- ════════════════════════════════════════════════════════════════════════════
-- Column has no non-NULL data. Code sends values from <input type="time">
-- which produces "HH:MM" format — valid time literals.

ALTER TABLE tasks
  ALTER COLUMN due_time TYPE time USING due_time::time;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. tasks.completed_at  TEXT → timestamptz
-- ════════════════════════════════════════════════════════════════════════════
-- Column has no non-NULL data currently.
-- IMPORTANT: The frontend code (AdminTasksPage.tsx) must be updated to send
-- ISO 8601 strings (new Date().toISOString()) instead of toLocaleString().
-- Supabase client auto-serialises JS Date/ISO strings to timestamptz.

ALTER TABLE tasks
  ALTER COLUMN completed_at TYPE timestamptz
  USING CASE
    WHEN completed_at IS NULL THEN NULL
    -- Try ISO parse first; fall back to a lenient cast for locale strings
    WHEN completed_at ~ '^\d{4}-\d{2}-\d{2}' THEN completed_at::timestamptz
    ELSE to_timestamp(completed_at, 'MM/DD/YYYY, HH12:MI:SS AM')
  END;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. login_activity.ip_address  TEXT → inet
-- ════════════════════════════════════════════════════════════════════════════
-- All values currently NULL. inet type provides:
--   • IPv4/IPv6 validation on insert
--   • Network operator support (<<, >>, &&)
--   • Efficient B-tree and GiST indexing

ALTER TABLE login_activity
  ALTER COLUMN ip_address TYPE inet USING ip_address::inet;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. user_sessions.ip_address  TEXT → inet
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE user_sessions
  ALTER COLUMN ip_address TYPE inet USING ip_address::inet;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. Add CHECK constraints for bounded integer fields
-- ════════════════════════════════════════════════════════════════════════════
-- These integer columns represent bounded clinical scores. Add domain
-- constraints so the database rejects nonsensical values.

ALTER TABLE record_vitals
  ADD CONSTRAINT chk_heart_rate_bpm
    CHECK (heart_rate_bpm > 0 AND heart_rate_bpm < 500),
  ADD CONSTRAINT chk_respiratory_rate_bpm
    CHECK (respiratory_rate_bpm > 0 AND respiratory_rate_bpm < 200),
  ADD CONSTRAINT chk_blood_pressure_systolic
    CHECK (blood_pressure_systolic > 0 AND blood_pressure_systolic < 400),
  ADD CONSTRAINT chk_blood_pressure_diastolic
    CHECK (blood_pressure_diastolic > 0 AND blood_pressure_diastolic < 300),
  ADD CONSTRAINT chk_body_condition_score
    CHECK (body_condition_score >= 1 AND body_condition_score <= 9),
  ADD CONSTRAINT chk_pain_score
    CHECK (pain_score >= 0 AND pain_score <= 10);

COMMIT;
