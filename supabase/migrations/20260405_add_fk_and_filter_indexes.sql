-- ============================================================================
-- MIGRATION: Add indexes for foreign keys and common query filters
-- Date:      2026-04-05
-- Purpose:   Improve query performance by indexing FK columns and frequently
--            filtered columns. These are non-destructive CREATE INDEX IF NOT
--            EXISTS statements — safe to re-run.
-- ============================================================================

-- ── appointments ──
CREATE INDEX IF NOT EXISTS idx_appointments_org_id       ON appointments (organization_id);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_id    ON appointments (clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at ON appointments (scheduled_at);

-- ── messages ──
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id  ON messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_org_id           ON messages (organization_id);

-- ── email_integrations ──
CREATE INDEX IF NOT EXISTS idx_email_integrations_user_provider ON email_integrations (user_id, provider);

-- ── invoices ──
CREATE INDEX IF NOT EXISTS idx_invoices_client_id        ON invoices (client_id);

-- ── medical_records ──
CREATE INDEX IF NOT EXISTS idx_medical_records_pet_id    ON medical_records (pet_id);
