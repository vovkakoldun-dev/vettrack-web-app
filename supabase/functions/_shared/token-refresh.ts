// supabase/functions/_shared/token-refresh.ts
// Shared token lifecycle management for OAuth integrations.
//
// Provides:
// - `getValidAccessToken()` — proactive refresh before expiry + DB update
// - `withTokenRetry()` — wraps an API call to auto-retry once on 401 after refresh
// - `refreshGoogleToken()` / `refreshMicrosoftToken()` — provider-specific refresh
//
// Import with: import { ... } from '../_shared/token-refresh.ts';

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { encryptToken, decryptToken } from './token-encryption.ts';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

// Refresh 5 minutes before expiry to avoid mid-request failures
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

type Provider = 'google' | 'microsoft';

export interface Integration {
  id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  organization_id?: string;
}

interface RefreshResult {
  access_token: string;
  expires_in: number;
  /** Microsoft may rotate refresh tokens; if returned, update it. */
  refresh_token?: string;
}

// ─── Provider-specific Token Refresh ─────────────────────────────────────────

async function refreshGoogleToken(refreshToken: string): Promise<RefreshResult | null> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();

  if (data.error) {
    console.error(`[TOKEN] Google refresh failed: ${data.error} — ${data.error_description || ''}`);

    if (data.error === 'invalid_grant') {
      console.error(
        '[TOKEN] Refresh token is invalid or revoked. The user must re-authenticate. ' +
        'Common causes: user revoked access in Google Account settings, ' +
        'token unused for 6+ months, or app re-published changing the consent screen.'
      );
    }
    return null;
  }

  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
  };
}

async function refreshMicrosoftToken(refreshToken: string): Promise<RefreshResult | null> {
  const clientId = Deno.env.get('MICROSOFT_CLIENT_ID')!;
  const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET')!;

  const response = await fetch(MICROSOFT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();

  if (data.error) {
    console.error(`[TOKEN] Microsoft refresh failed: ${data.error} — ${data.error_description || ''}`);

    if (data.error === 'invalid_grant') {
      console.error(
        '[TOKEN] Microsoft refresh token is invalid or revoked. The user must re-authenticate. ' +
        'Common causes: user revoked access, token expired (inactive 90+ days), ' +
        'or admin consent was revoked in Azure AD.'
      );
    }
    return null;
  }

  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
    // Microsoft rotates refresh tokens — use the new one if provided
    refresh_token: data.refresh_token || undefined,
  };
}

function getRefreshFunction(provider: Provider) {
  return provider === 'google' ? refreshGoogleToken : refreshMicrosoftToken;
}

// ─── Core: Get Valid Access Token ────────────────────────────────────────────

/**
 * Returns a valid access token for the integration, refreshing proactively
 * if the token expires within the next 5 minutes.
 *
 * On successful refresh:
 * - Updates `access_token` and `token_expires_at` in the DB
 * - If Microsoft returned a rotated refresh_token, updates that too
 *
 * On failed refresh:
 * - Sets integration status to `reauth_required` with a descriptive error
 * - Returns null (caller should return TOKEN_EXPIRED to the frontend)
 */
export async function getValidAccessToken(
  supabase: ReturnType<typeof createClient>,
  integration: Integration,
  provider: Provider,
): Promise<string | null> {
  const expiresAt = new Date(integration.token_expires_at).getTime();
  const now = Date.now();

  // Token is still fresh — decrypt and return
  if (expiresAt - now > REFRESH_BUFFER_MS) {
    return await decryptToken(integration.access_token);
  }

  // Token expired or expiring soon — refresh
  console.info(
    `[TOKEN] Refreshing ${provider} token for integration ${integration.id} ` +
    `(expires in ${Math.round((expiresAt - now) / 1000)}s, buffer: ${REFRESH_BUFFER_MS / 1000}s)`
  );

  // Decrypt the refresh token before sending to the provider
  const plainRefreshToken = await decryptToken(integration.refresh_token);
  if (!plainRefreshToken) {
    await supabase
      .from('email_integrations')
      .update({
        status: 'reauth_required',
        error_message: `${provider} refresh token missing or unreadable — user must reconnect`,
      })
      .eq('id', integration.id);
    return null;
  }

  const refreshFn = getRefreshFunction(provider);
  const refreshed = await refreshFn(plainRefreshToken);

  if (!refreshed) {
    // Refresh failed — mark for re-auth
    await supabase
      .from('email_integrations')
      .update({
        status: 'reauth_required',
        error_message: `${provider} token refresh failed — user must reconnect`,
      })
      .eq('id', integration.id);

    return null;
  }

  // Encrypt new tokens before storing
  const encryptedAccess = await encryptToken(refreshed.access_token);
  const updatePayload: Record<string, unknown> = {
    access_token: encryptedAccess,
    tokens_encrypted: true,
    token_expires_at: new Date(now + refreshed.expires_in * 1000).toISOString(),
    error_message: null, // Clear any previous error
  };

  // Microsoft rotates refresh tokens — encrypt and persist the new one
  if (refreshed.refresh_token) {
    updatePayload.refresh_token = await encryptToken(refreshed.refresh_token);
  }

  await supabase
    .from('email_integrations')
    .update(updatePayload)
    .eq('id', integration.id);

  console.info(
    `[TOKEN] ${provider} token refreshed for integration ${integration.id}, ` +
    `new expiry: ${updatePayload.token_expires_at}`
  );

  // Return the plain-text access token for immediate use
  return refreshed.access_token;
}

// ─── Retry Wrapper: Auto-refresh on 401 ─────────────────────────────────────

/**
 * Executes an API call with the given access token. If the API returns 401
 * (token rejected), refreshes the token once and retries the call.
 *
 * This handles the race condition where:
 * - The proactive 5-minute check passed (token seemed valid)
 * - But the provider revoked/expired it between the check and the API call
 *
 * Returns the Response from the API call (either the original or the retry).
 * If the retry also fails with 401, returns the 401 response (caller handles reauth).
 *
 * Usage:
 * ```ts
 * const response = await withTokenRetry(
 *   supabase, integration, 'google',
 *   (token) => fetch(`${GMAIL_API}/messages`, {
 *     headers: { Authorization: `Bearer ${token}` }
 *   })
 * );
 * ```
 */
export async function withTokenRetry(
  supabase: ReturnType<typeof createClient>,
  integration: Integration,
  provider: Provider,
  apiCall: (accessToken: string) => Promise<Response>,
): Promise<{ response: Response; accessToken: string }> {
  // First attempt — use the current (possibly refreshed) token
  let accessToken = await getValidAccessToken(supabase, integration, provider);

  if (!accessToken) {
    // Can't get a valid token at all — return a synthetic 401
    return {
      response: new Response(
        JSON.stringify({ error: { message: 'Token refresh failed', code: 401 } }),
        { status: 401 }
      ),
      accessToken: '',
    };
  }

  let response = await apiCall(accessToken);

  // If 401, force-refresh and retry once
  if (response.status === 401) {
    console.warn(
      `[TOKEN] ${provider} API returned 401 despite valid-looking token — ` +
      `force-refreshing for integration ${integration.id}`
    );

    // Force refresh regardless of expiry time — decrypt refresh token first
    const plainRefreshToken = await decryptToken(integration.refresh_token);
    if (!plainRefreshToken) {
      await supabase
        .from('email_integrations')
        .update({
          status: 'reauth_required',
          error_message: `${provider} refresh token missing or unreadable — user must reconnect`,
        })
        .eq('id', integration.id);
      return { response, accessToken: '' };
    }

    const refreshFn = getRefreshFunction(provider);
    const refreshed = await refreshFn(plainRefreshToken);

    if (!refreshed) {
      // Refresh failed — mark for re-auth and return the original 401
      await supabase
        .from('email_integrations')
        .update({
          status: 'reauth_required',
          error_message: `${provider} API rejected token and refresh failed — user must reconnect`,
        })
        .eq('id', integration.id);

      return { response, accessToken: '' };
    }

    // Encrypt new tokens before storing
    const encryptedAccess = await encryptToken(refreshed.access_token);
    const updatePayload: Record<string, unknown> = {
      access_token: encryptedAccess,
      tokens_encrypted: true,
      token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      error_message: null,
    };
    if (refreshed.refresh_token) {
      updatePayload.refresh_token = await encryptToken(refreshed.refresh_token);
    }

    await supabase
      .from('email_integrations')
      .update(updatePayload)
      .eq('id', integration.id);

    accessToken = refreshed.access_token;

    console.info(
      `[TOKEN] Retrying ${provider} API call with fresh token for integration ${integration.id}`
    );

    // Retry the API call with the new token
    response = await apiCall(accessToken);

    if (response.status === 401) {
      console.error(
        `[TOKEN] ${provider} API still returned 401 after token refresh — ` +
        `marking integration ${integration.id} for re-auth`
      );
      await supabase
        .from('email_integrations')
        .update({
          status: 'reauth_required',
          error_message: `${provider} API rejected fresh token — user must reconnect`,
        })
        .eq('id', integration.id);
    }
  }

  return { response, accessToken };
}
