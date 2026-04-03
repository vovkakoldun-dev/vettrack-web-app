-- ============================================================================
-- MIGRATION: Enforce Missing Foreign Key Constraints
-- ============================================================================
--
-- AUDIT FINDINGS:
--   7 uuid columns reference parent tables but have no FK constraint.
--   All have 0 orphan rows (verified 2026-04-02), so constraints can be
--   added immediately without data cleanup.
--
-- STRATEGY:
--   Phase 1 — Add FK constraints to clean columns (this migration)
--   Phase 2 — Fix notification_state text→uuid mismatch (separate migration)
--
-- SAFETY:
--   - All constraints use IF NOT EXISTS pattern (via DO blocks)
--   - ON DELETE SET NULL for optional references (created_by)
--   - ON DELETE CASCADE for ownership references (organization_id)
--   - NOT VALID + VALIDATE deferred pattern for zero-downtime on large tables
--   - No column type changes, no data modifications
--
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. shifts.organization_id → organizations(id)
-- ════════════════════════════════════════════════════════════════════════════
-- Every shift belongs to an org. Deleting an org should cascade-delete shifts.

ALTER TABLE shifts
  ADD CONSTRAINT fk_shifts_organization
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE shifts VALIDATE CONSTRAINT fk_shifts_organization;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. shifts.created_by → profiles(id)
-- ════════════════════════════════════════════════════════════════════════════
-- Optional (nullable). If the creator's profile is deleted, null it out.

ALTER TABLE shifts
  ADD CONSTRAINT fk_shifts_created_by
  FOREIGN KEY (created_by) REFERENCES profiles(id)
  ON DELETE SET NULL
  NOT VALID;

ALTER TABLE shifts VALIDATE CONSTRAINT fk_shifts_created_by;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. chat_messages.organization_id → organizations(id)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE chat_messages
  ADD CONSTRAINT fk_chat_messages_organization
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE chat_messages VALIDATE CONSTRAINT fk_chat_messages_organization;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. organization_settings.organization_id → organizations(id)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE organization_settings
  ADD CONSTRAINT fk_org_settings_organization
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE organization_settings VALIDATE CONSTRAINT fk_org_settings_organization;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. pending_requests.organization_id → organizations(id)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE pending_requests
  ADD CONSTRAINT fk_pending_requests_organization
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE pending_requests VALIDATE CONSTRAINT fk_pending_requests_organization;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. notification_events.organization_id → organizations(id)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE notification_events
  ADD CONSTRAINT fk_notification_events_organization
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE notification_events VALIDATE CONSTRAINT fk_notification_events_organization;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. notification_state.organization_id → organizations(id)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE notification_state
  ADD CONSTRAINT fk_notification_state_organization
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE notification_state VALIDATE CONSTRAINT fk_notification_state_organization;

COMMIT;
