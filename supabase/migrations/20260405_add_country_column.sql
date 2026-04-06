-- ============================================================================
-- MIGRATION: Add country column to clients table
-- Date:      2026-04-05
-- Purpose:   Support USA/Canada country selection for client addresses.
--            Defaults to 'US' for existing records.
-- ============================================================================

ALTER TABLE clients ADD COLUMN IF NOT EXISTS country text DEFAULT 'US';
