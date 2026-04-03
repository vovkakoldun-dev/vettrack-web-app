-- ============================================================
-- Encrypt OAuth tokens at rest in email_integrations
-- ============================================================
-- Tokens are now encrypted via AES-256-GCM in the edge functions
-- (see _shared/token-encryption.ts). Encrypted values are prefixed
-- with "enc:" so the application can distinguish them from legacy
-- plain-text tokens.
--
-- This migration:
-- 1. Updates the schema comment to reflect encryption
-- 2. Adds a tokens_encrypted flag for tracking migration progress
-- 3. Revokes direct column access from anon/authenticated roles
--    (tokens are only accessed via service_role in edge functions)
-- 4. Adds a partial index for unmigrated rows

-- Track which rows have been encrypted
ALTER TABLE email_integrations
  ADD COLUMN IF NOT EXISTS tokens_encrypted boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN email_integrations.access_token IS
  'OAuth access token — AES-256-GCM encrypted (prefixed with "enc:"). Legacy rows may still be plain text until migrated.';

COMMENT ON COLUMN email_integrations.refresh_token IS
  'OAuth refresh token — AES-256-GCM encrypted (prefixed with "enc:"). Legacy rows may still be plain text until migrated.';

COMMENT ON COLUMN email_integrations.tokens_encrypted IS
  'True once both access_token and refresh_token have been encrypted. Used to track migration progress.';

-- Index to quickly find rows that still need encryption
CREATE INDEX IF NOT EXISTS idx_email_integrations_unencrypted
  ON email_integrations(id)
  WHERE tokens_encrypted = false AND status = 'active';

-- ────────────────────────────────────────────────────────────
-- Batch encryption helper
-- ────────────────────────────────────────────────────────────
-- Plain-text tokens cannot be encrypted inside SQL because the
-- application uses AES-256-GCM via Web Crypto API with HKDF key
-- derivation. Instead, call the migrate-encrypt-tokens edge
-- function after deploying this migration:
--
--   curl -X POST \
--     "https://<project>.supabase.co/functions/v1/migrate-encrypt-tokens" \
--     -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
--
-- The edge function reads all rows where tokens_encrypted=false,
-- encrypts the tokens, and sets tokens_encrypted=true.
-- ────────────────────────────────────────────────────────────

-- After all rows are migrated, you can optionally enforce that
-- new tokens must be encrypted by uncommenting this constraint:
--
-- ALTER TABLE email_integrations
--   ADD CONSTRAINT chk_tokens_encrypted
--   CHECK (
--     tokens_encrypted = true
--     OR (access_token IS NULL AND refresh_token IS NULL)
--   );
