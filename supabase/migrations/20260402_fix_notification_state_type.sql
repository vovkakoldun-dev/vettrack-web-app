-- ============================================================================
-- MIGRATION: Fix notification_state.notification_id Type Mismatch
-- ============================================================================
--
-- PROBLEM:
--   notification_state.notification_id is TEXT, storing composite app IDs like
--   "client-51ca241a-..." and "appt-assign-03b0c37a-...-1774328760396".
--
--   notification_events.id is also TEXT with the same format.
--   notifications.id is UUID — a completely different ID space.
--
--   notification_state references notification_events, NOT notifications,
--   but has no FK constraint. 18 of 32 rows are orphaned (their
--   notification_events rows were never created or were deleted).
--
-- STRATEGY (gradual, non-breaking):
--
--   Step 1: Add FK from notification_state → notification_events (with orphan cleanup)
--   Step 2: Add validation trigger to prevent future orphans
--   Step 3: Add a shadow uuid column for future migration to proper uuid PKs
--
-- WHY NOT change text→uuid now?
--   The composite IDs ("client-{uuid}", "appt-assign-{uuid}-{timestamp}")
--   encode semantic meaning that the app relies on. Changing the PK format
--   requires coordinated frontend changes. This migration hardens referential
--   integrity first, leaving the type migration for a future coordinated release.
--
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- Step 1a: Backfill missing notification_events for orphaned notification_state rows
-- ════════════════════════════════════════════════════════════════════════════
-- 18 notification_state rows reference notification_events that don't exist.
-- Rather than delete user state, create stub events so the FK can be enforced.

INSERT INTO notification_events (id, type, timestamp, data, organization_id)
SELECT
  ns.notification_id,
  CASE
    WHEN ns.notification_id LIKE 'client-%' THEN 'client_event'
    WHEN ns.notification_id LIKE 'appt-%'   THEN 'appt_event'
    WHEN ns.notification_id LIKE 'assign-%' THEN 'vet_assign'
    ELSE 'unknown'
  END,
  COALESCE(ns.updated_at, now()),
  '{"backfilled": true}'::jsonb,
  ns.organization_id
FROM notification_state ns
WHERE NOT EXISTS (
  SELECT 1 FROM notification_events ne WHERE ne.id = ns.notification_id
);

-- ════════════════════════════════════════════════════════════════════════════
-- Step 1b: Add FK constraint notification_state → notification_events
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE notification_state
  ADD CONSTRAINT fk_notification_state_event
  FOREIGN KEY (notification_id) REFERENCES notification_events(id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE notification_state VALIDATE CONSTRAINT fk_notification_state_event;

-- ════════════════════════════════════════════════════════════════════════════
-- Step 2: Validation function for notification_id format
-- ════════════════════════════════════════════════════════════════════════════
-- Ensures new IDs follow the established composite format:
--   "client-{uuid}", "appt-assign-{uuid}-{timestamp}", "assign-{uuid}-{ts}",
--   "unassign-{uuid}-{ts}"
-- This acts as a schema-level validation layer until the type is migrated.

CREATE OR REPLACE FUNCTION validate_notification_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Must start with a known prefix
  IF NEW.notification_id !~ '^(client|appt-assign|assign|unassign)-[0-9a-f]{8}-' THEN
    RAISE EXCEPTION 'Invalid notification_id format: %. Expected prefix-uuid pattern.', NEW.notification_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_notification_state_id
  BEFORE INSERT OR UPDATE ON notification_state
  FOR EACH ROW
  EXECUTE FUNCTION validate_notification_id();

CREATE TRIGGER trg_validate_notification_event_id
  BEFORE INSERT OR UPDATE ON notification_events
  FOR EACH ROW
  EXECUTE FUNCTION validate_notification_id();

-- ════════════════════════════════════════════════════════════════════════════
-- Step 3: Shadow UUID columns for future type migration
-- ════════════════════════════════════════════════════════════════════════════
-- When ready to migrate text→uuid PKs, these columns will already be
-- populated. The cutover then becomes:
--   1. Stop writes
--   2. DROP old PK, RENAME shadow → id, ADD PK
--   3. Update frontend to use uuid IDs
--   4. Resume writes

ALTER TABLE notification_events
  ADD COLUMN uuid_id uuid DEFAULT gen_random_uuid();

ALTER TABLE notification_state
  ADD COLUMN event_uuid_id uuid;

-- Backfill shadow columns: link them together
UPDATE notification_state ns
SET event_uuid_id = ne.uuid_id
FROM notification_events ne
WHERE ne.id = ns.notification_id;

-- Index shadow columns for future use
CREATE INDEX IF NOT EXISTS idx_notification_events_uuid_id
  ON notification_events (uuid_id);

CREATE INDEX IF NOT EXISTS idx_notification_state_event_uuid
  ON notification_state (event_uuid_id);

-- ════════════════════════════════════════════════════════════════════════════
-- Step 4: Trigger to keep shadow UUIDs in sync on new inserts
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sync_notification_state_uuid()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-populate event_uuid_id from the linked notification_events row
  IF NEW.event_uuid_id IS NULL THEN
    SELECT uuid_id INTO NEW.event_uuid_id
    FROM notification_events
    WHERE id = NEW.notification_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_notification_state_uuid
  BEFORE INSERT OR UPDATE ON notification_state
  FOR EACH ROW
  EXECUTE FUNCTION sync_notification_state_uuid();

COMMIT;
