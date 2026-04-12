-- ============================================================================
-- Migration: add_conversation_hidden_at
-- Date: 2026-04-11
--
-- Adds a `hidden_at` column to conversation_participants so that "delete
-- conversation" only hides it for the current user rather than permanently
-- deleting it for all participants.
-- ============================================================================

ALTER TABLE conversation_participants
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz DEFAULT NULL;

-- Index to efficiently filter visible conversations per user
CREATE INDEX IF NOT EXISTS idx_conv_participants_hidden_at
  ON conversation_participants (profile_id, hidden_at)
  WHERE hidden_at IS NULL;
