-- ============================================================================
-- MIGRATION: Case-Insensitive Email Handling
-- ============================================================================
--
-- PROBLEM:  Email columns are plain TEXT. A user can register as
--           "Alice@Vet.com" and again as "alice@vet.com" — the UNIQUE
--           constraint treats them as different values.
--
-- APPROACH: Use UNIQUE indexes on LOWER(email) instead of citext.
--
--   WHY NOT citext?
--     • citext requires the `citext` extension, which changes the column
--       type and can break Supabase client type generation.
--     • A functional UNIQUE index on LOWER(email) gives the same
--       uniqueness guarantee with zero type changes.
--     • We also normalize on INSERT/UPDATE via a trigger so the stored
--       value is always lowercase — queries don't need LOWER() wrappers.
--
-- TABLES AFFECTED:
--   ┌───────────┬─────────────────────────────────────┬──────────────────────┐
--   │ Table     │ Existing UNIQUE on email            │ Action               │
--   ├───────────┼─────────────────────────────────────┼──────────────────────┤
--   │ profiles  │ profiles_email_key (plain)          │ Replace with LOWER() │
--   │ clients   │ uq_clients_org_email (org + plain)  │ Replace with LOWER() │
--   │ staff     │ none                                │ Add LOWER() index    │
--   └───────────┴─────────────────────────────────────┴──────────────────────┘
--
-- DEPENDS ON: 20260330_constraints_and_indexes.sql (creates uq_clients_org_email)
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 1: Normalize existing data to lowercase
-- ════════════════════════════════════════════════════════════════════════════

UPDATE profiles SET email = LOWER(email) WHERE email IS NOT NULL AND email <> LOWER(email);
UPDATE clients  SET email = LOWER(email) WHERE email IS NOT NULL AND email <> LOWER(email);
UPDATE staff    SET email = LOWER(email) WHERE email IS NOT NULL AND email <> LOWER(email);

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 2: Replace existing UNIQUE constraints with LOWER() versions
-- ════════════════════════════════════════════════════════════════════════════

-- ── profiles ──
-- Drop the existing plain-text unique constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_email_key;

-- Unique index on LOWER(email) — case-insensitive uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_email_lower
  ON profiles (LOWER(email))
  WHERE email IS NOT NULL;

-- ── clients ──
-- Drop the existing org + email unique constraint (added by constraints migration)
ALTER TABLE clients DROP CONSTRAINT IF EXISTS uq_clients_org_email;

-- Composite unique index: one email per org, case-insensitive
CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_org_email_lower
  ON clients (organization_id, LOWER(email))
  WHERE email IS NOT NULL;

-- ── staff ──
-- No existing constraint to drop. Add org-scoped case-insensitive uniqueness.
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_org_email_lower
  ON staff (organization_id, LOWER(email))
  WHERE email IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 3: Trigger to auto-lowercase on INSERT / UPDATE
-- ════════════════════════════════════════════════════════════════════════════
-- This ensures the stored value is always lowercase, so queries never need
-- LOWER() wrappers and indexes are used efficiently.

CREATE OR REPLACE FUNCTION fn_lowercase_email()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := LOWER(NEW.email);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- profiles
CREATE TRIGGER trg_profiles_lowercase_email
  BEFORE INSERT OR UPDATE OF email ON profiles
  FOR EACH ROW EXECUTE FUNCTION fn_lowercase_email();

-- clients
CREATE TRIGGER trg_clients_lowercase_email
  BEFORE INSERT OR UPDATE OF email ON clients
  FOR EACH ROW EXECUTE FUNCTION fn_lowercase_email();

-- staff
CREATE TRIGGER trg_staff_lowercase_email
  BEFORE INSERT OR UPDATE OF email ON staff
  FOR EACH ROW EXECUTE FUNCTION fn_lowercase_email();

COMMIT;
