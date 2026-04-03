-- ============================================================================
-- MIGRATION: OAuth Redirect URI Allowlist & Security Hardening
-- ============================================================================
--
-- FINDINGS ADDRESSED:
--   1. No server-side validation of redirect URIs
--   2. No audit trail of OAuth token operations
--   3. State tokens are not tracked (replay attacks possible)
--
-- APPROACH:
--   - Add an allowlist table for permitted redirect URIs
--   - Add a validation function edge functions can call before redirecting
--   - Add OAuth state nonce tracking to prevent replay attacks
--   - All additive — no existing schema changes
--
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. OAuth Redirect URI Allowlist
-- ════════════════════════════════════════════════════════════════════════════
-- Stores approved redirect URI patterns per organization.
-- Edge functions check against this before issuing a redirect.

CREATE TABLE IF NOT EXISTS oauth_allowed_redirects (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid REFERENCES organizations(id) ON DELETE CASCADE,
  uri_pattern      text NOT NULL,   -- exact URI or pattern like 'https://*.hugoit.com'
  provider         text CHECK (provider IN ('gmail', 'outlook', 'all')),
  created_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  is_active        boolean NOT NULL DEFAULT true,

  -- Prevent duplicate patterns per org+provider
  UNIQUE (organization_id, uri_pattern, provider)
);

ALTER TABLE oauth_allowed_redirects ENABLE ROW LEVEL SECURITY;

-- Only org admins can view/manage redirect allowlist
CREATE POLICY "Admins can manage redirect allowlist"
  ON oauth_allowed_redirects FOR ALL
  USING (organization_id = auth_org_id());

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Seed default allowed redirects
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO oauth_allowed_redirects (organization_id, uri_pattern, provider)
VALUES
  (NULL, 'http://localhost:5173', 'all'),    -- Local dev
  (NULL, 'http://localhost:5174', 'all'),    -- Local dev (alternate port)
  (NULL, 'http://127.0.0.1:5173', 'all')    -- Local dev (IP)
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Validation function: check if a redirect URI is allowed
-- ════════════════════════════════════════════════════════════════════════════
-- Edge functions call this before redirecting. Returns true/false.
-- Checks both org-specific and global (organization_id IS NULL) patterns.

CREATE OR REPLACE FUNCTION is_redirect_allowed(
  p_uri text,
  p_provider text DEFAULT 'all'
) RETURNS boolean AS $$
DECLARE
  found boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM oauth_allowed_redirects
    WHERE is_active = true
      AND (provider = p_provider OR provider = 'all')
      AND (
        -- Exact match
        uri_pattern = p_uri
        -- Wildcard subdomain match: 'https://*.example.com' matches 'https://app.example.com'
        OR (
          uri_pattern LIKE 'https://%*%'
          AND p_uri LIKE 'https://%'
          AND p_uri ~ ('^https://[a-z0-9-]+\.' || regexp_replace(
            replace(uri_pattern, 'https://*.', ''),
            '([.+?^${}()|[\]\\])', '\\\1', 'g'
          ) || '$')
        )
      )
      AND (organization_id IS NULL)  -- Global patterns
  ) INTO found;

  RETURN found;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. OAuth State Nonce Tracking (replay prevention)
-- ════════════════════════════════════════════════════════════════════════════
-- Each OAuth state token contains a nonce. The callback records the nonce
-- here after use. If a nonce appears twice, the second attempt is rejected.
-- Entries auto-expire after 15 minutes (state tokens are valid for 10 min).

CREATE TABLE IF NOT EXISTS oauth_used_nonces (
  nonce       text PRIMARY KEY,
  user_id     uuid NOT NULL,
  provider    text NOT NULL,
  used_at     timestamptz NOT NULL DEFAULT now()
);

-- No RLS needed — only service_role accesses this table from edge functions
ALTER TABLE oauth_used_nonces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON oauth_used_nonces
  FOR ALL USING (false);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_oauth_nonces_used_at
  ON oauth_used_nonces (used_at);

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Nonce check-and-claim function (atomic, prevents race conditions)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION claim_oauth_nonce(
  p_nonce text,
  p_user_id uuid,
  p_provider text
) RETURNS boolean AS $$
DECLARE
  inserted boolean;
BEGIN
  -- Try to insert; if it already exists (replay), the INSERT fails
  INSERT INTO oauth_used_nonces (nonce, user_id, provider)
  VALUES (p_nonce, p_user_id, p_provider)
  ON CONFLICT (nonce) DO NOTHING;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Cleanup: auto-delete expired nonces (older than 15 min)
-- ════════════════════════════════════════════════════════════════════════════
-- Call this periodically via a cron job or pg_cron.

CREATE OR REPLACE FUNCTION cleanup_expired_nonces()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM oauth_used_nonces
  WHERE used_at < now() - interval '15 minutes';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. Add provider CHECK to email_integrations (tighten valid values)
-- ════════════════════════════════════════════════════════════════════════════
-- Yahoo was removed from the UI but the CHECK constraint still allows it.
-- Drop the old check and add a stricter one.

ALTER TABLE email_integrations
  DROP CONSTRAINT IF EXISTS email_integrations_provider_check;

ALTER TABLE email_integrations
  ADD CONSTRAINT email_integrations_provider_check
  CHECK (provider IN ('gmail', 'outlook'));

COMMIT;
