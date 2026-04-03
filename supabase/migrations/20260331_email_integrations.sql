-- ============================================================
-- Email Integrations: Store OAuth tokens for Gmail/Outlook/Yahoo
-- ============================================================

CREATE TABLE IF NOT EXISTS email_integrations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider      text NOT NULL CHECK (provider IN ('gmail', 'outlook', 'yahoo')),
  email_address text NOT NULL,

  -- OAuth tokens (encrypted at rest via Supabase Vault in production)
  access_token  text,
  refresh_token text,
  token_expires_at timestamptz,
  scopes        text[], -- granted OAuth scopes

  -- Connection status
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'error', 'reauth_required')),
  last_synced_at timestamptz,
  error_message text,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- One provider per user per org
  UNIQUE (organization_id, user_id, provider)
);

-- Index for fast lookups
CREATE INDEX idx_email_integrations_org_user
  ON email_integrations(organization_id, user_id);

CREATE INDEX idx_email_integrations_status
  ON email_integrations(status) WHERE status = 'active';

-- RLS policies
ALTER TABLE email_integrations ENABLE ROW LEVEL SECURITY;

-- Users can only see their own integrations within their org
CREATE POLICY "Users can view own email integrations"
  ON email_integrations FOR SELECT
  USING (
    organization_id = auth_org_id()
    AND user_id = auth.uid()
  );

-- Users can insert their own integrations
CREATE POLICY "Users can create own email integrations"
  ON email_integrations FOR INSERT
  WITH CHECK (
    organization_id = auth_org_id()
    AND user_id = auth.uid()
  );

-- Users can update their own integrations
CREATE POLICY "Users can update own email integrations"
  ON email_integrations FOR UPDATE
  USING (
    organization_id = auth_org_id()
    AND user_id = auth.uid()
  );

-- Users can delete (disconnect) their own integrations
CREATE POLICY "Users can delete own email integrations"
  ON email_integrations FOR DELETE
  USING (
    organization_id = auth_org_id()
    AND user_id = auth.uid()
  );

-- Email sync log (tracks sync history and errors)
CREATE TABLE IF NOT EXISTS email_sync_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id  uuid NOT NULL REFERENCES email_integrations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sync_type       text NOT NULL CHECK (sync_type IN ('full', 'incremental', 'send')),
  status          text NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  messages_synced integer DEFAULT 0,
  error_message   text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);

ALTER TABLE email_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync logs"
  ON email_sync_log FOR SELECT
  USING (organization_id = auth_org_id());

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_email_integration_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_email_integration_updated_at
  BEFORE UPDATE ON email_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_email_integration_timestamp();
