-- ============================================================================
-- MIGRATION: Add Missing Auth-Related Indexes
-- ============================================================================
-- Safe, additive-only — no schema modifications, no column changes.
-- Each index targets a real query pattern found in the codebase.
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. login_activity: composite for dedup check (login performance)
-- ════════════════════════════════════════════════════════════════════════════
-- Query: .eq('user_id', X).gte('created_at', fiveMinAgo).limit(1)
-- Source: SettingsPage.tsx:997, AdminSettingsPage.tsx:900
-- Without: Postgres merges idx_login_activity_user_id + idx_login_activity_created_at
-- With:    Single index scan, no merge step

CREATE INDEX IF NOT EXISTS idx_login_activity_user_created
  ON login_activity (user_id, created_at DESC);

-- ════════════════════════════════════════════════════════════════════════════
-- 2. user_sessions: composite for session list + heartbeat sort
-- ════════════════════════════════════════════════════════════════════════════
-- Query: .select('*').eq('user_id', X).order('last_active_at', {ascending: false})
-- Source: SettingsPage.tsx:987, AdminSettingsPage.tsx:896, SuperAdminDashboardPage.tsx:1015
-- Without: idx_user_sessions_user_id finds rows, then filesort on last_active_at
-- With:    Rows returned pre-sorted, covering the ORDER BY

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active
  ON user_sessions (user_id, last_active_at DESC);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. user_sessions: partial index for "current sessions" fast path
-- ════════════════════════════════════════════════════════════════════════════
-- Query: .update({is_current: false}).eq('user_id', X).neq('session_token_hash', hash)
-- Source: SettingsPage.tsx:980, AdminSettingsPage.tsx:894
-- Also useful for: presence checks ("is user online?")
-- Only indexes current=true rows — small index, fast scan

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_current
  ON user_sessions (user_id)
  WHERE is_current = true;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. email_sync_log: FK index for cascade deletes + sync history lookups
-- ════════════════════════════════════════════════════════════════════════════
-- The table has FK → email_integrations(id) ON DELETE CASCADE, but no index
-- on integration_id. Without it, every CASCADE delete does a sequential scan.
-- Source: gmail-api/index.ts:392, outlook-api/index.ts:400

CREATE INDEX IF NOT EXISTS idx_email_sync_log_integration
  ON email_sync_log (integration_id, started_at DESC);

-- ════════════════════════════════════════════════════════════════════════════
-- 5. email_sync_log: org_id for RLS policy evaluation
-- ════════════════════════════════════════════════════════════════════════════
-- RLS policy: USING (organization_id = auth_org_id())
-- Without index: every SELECT triggers a sequential scan for RLS check

CREATE INDEX IF NOT EXISTS idx_email_sync_log_org
  ON email_sync_log (organization_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 6. email_integrations: token expiry for batch refresh detection
-- ════════════════════════════════════════════════════════════════════════════
-- Query pattern: find all integrations whose tokens expire within N minutes
-- Currently done per-request in edge functions, but needed if a cron job
-- or background worker batch-refreshes tokens.
-- Partial: only indexes active integrations (the ones that matter)

CREATE INDEX IF NOT EXISTS idx_email_integrations_token_expiry
  ON email_integrations (token_expires_at)
  WHERE status = 'active';

-- ════════════════════════════════════════════════════════════════════════════
-- 7. login_activity: status for failed-login monitoring
-- ════════════════════════════════════════════════════════════════════════════
-- Partial index: only indexes failures/lockouts — tiny index, useful for
-- brute-force detection queries and security dashboards.

CREATE INDEX IF NOT EXISTS idx_login_activity_failures
  ON login_activity (user_id, created_at DESC)
  WHERE status IN ('failure', 'locked');

COMMIT;
