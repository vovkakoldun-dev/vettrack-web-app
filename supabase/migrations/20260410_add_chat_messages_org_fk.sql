-- ============================================================================
-- Migration: add_chat_messages_org_fk
-- Date: 2026-04-10
--
-- chat_messages.organization_id exists but has no FK constraint.
-- Add the missing reference to organizations(id).
-- ============================================================================

BEGIN;

ALTER TABLE chat_messages
  ADD CONSTRAINT chat_messages_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

COMMIT;
