// supabase/functions/gmail-callback/index.ts
// Handles Google OAuth callback — exchanges code for tokens and stores them
//
// Environment variables required:
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET
//   GOOGLE_REDIRECT_URI
//   APP_URL              — frontend URL for redirect after auth (e.g. https://app.hugoit.com)
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY  — needed to write tokens to DB

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  validateRedirectUri,
  verifySignedState,
  safeRedirect,
  diagnoseGoogleOAuthError,
  getConsentScreenStatus,
  getGoogleTestUsers,
  checkGmailApiEnabled,
} from '../_shared/oauth-security.ts';
import { encryptTokenPair } from '../_shared/token-encryption.ts';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

// Scopes that must be granted for the integration to work
const REQUIRED_SCOPE_SUFFIXES = ['gmail.readonly', 'gmail.send', 'gmail.modify'];

serve(async (req: Request) => {
  try {
    console.info('[GMAIL-CALLBACK] Step 1/9: Received OAuth callback');
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Handle error from Google — diagnose and log with full context
    if (error) {
      const diagnosis = diagnoseGoogleOAuthError(error);
      const status = getConsentScreenStatus();
      const testUsers = getGoogleTestUsers();

      console.error(`[OAUTH] Google returned error during Gmail callback:`);
      console.error(`  Error code: "${error}"`);
      console.error(`  Severity: ${diagnosis.severity}`);
      console.error(`  Diagnosis: ${diagnosis.message}`);
      console.error(`  Consent screen status: ${status}`);
      if (status === 'testing') {
        console.error(`  Configured test users: [${testUsers.length > 0 ? testUsers.join(', ') : 'NONE — add via GOOGLE_TEST_USERS env var'}]`);
        if (error === 'access_denied') {
          console.error(
            `  ACTION REQUIRED: The user who attempted OAuth is likely not in the test user list. ` +
            `Add their Google account email in Google Cloud Console → OAuth consent screen → Test users.`
          );
        }
      }

      // Pass a more descriptive error code to the frontend
      const frontendError = error === 'access_denied' && status === 'testing'
        ? 'consent_screen_unauthorized'
        : error;

      return safeRedirect('/admin/communications', { error: frontendError });
    }

    if (!code || !state) {
      console.error('[GMAIL-CALLBACK] FAILED: Missing code or state in callback URL');
      return safeRedirect('/admin/communications', { error: 'missing_code' });
    }

    console.info('[GMAIL-CALLBACK] Step 2/9: Verifying HMAC-signed state token');
    // Verify HMAC-signed state token (prevents CSRF, validates expiry)
    const statePayload = await verifySignedState(state);
    if (!statePayload) {
      console.error('[GMAIL-CALLBACK] FAILED: State token verification failed (tampered, expired, or malformed)');
      return safeRedirect('/admin/communications', { error: 'invalid_state' });
    }
    console.info(`[GMAIL-CALLBACK] State verified — user_id: ${statePayload.user_id}`);

    console.info('[GMAIL-CALLBACK] Step 3/9: Validating redirect URI');
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
    const redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI')!;

    // Validate redirect URI — must match exactly what's in Google Cloud Console
    const uriValidation = validateRedirectUri(redirectUri, 'google');
    if (!uriValidation.valid) {
      console.error('[GMAIL-CALLBACK] FAILED: Redirect URI validation failed');
      for (const err of uriValidation.errors) {
        console.error(`  → ${err}`);
      }
      console.error(`  Raw URI: "${redirectUri}"`);
      if (uriValidation.parsed) {
        console.error(`  Parsed — protocol: ${uriValidation.parsed.protocol}, host: ${uriValidation.parsed.host}, path: ${uriValidation.parsed.path}`);
      }
      return safeRedirect('/admin/communications', { error: 'redirect_uri_mismatch' });
    }
    console.info(`[GMAIL-CALLBACK] Redirect URI valid: ${redirectUri}`);

    console.info('[GMAIL-CALLBACK] Step 4/9: Exchanging authorization code for tokens');
    // Exchange authorization code for tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      const tokenDiagnosis = diagnoseGoogleOAuthError(
        tokenData.error,
        tokenData.error_description,
      );
      console.error(`[GMAIL-CALLBACK] FAILED: Token exchange error`);
      console.error(`  Error: "${tokenData.error}"`);
      console.error(`  Description: "${tokenData.error_description || 'none'}"`);
      console.error(`  Severity: ${tokenDiagnosis.severity}`);
      console.error(`  Diagnosis: ${tokenDiagnosis.message}`);
      console.error(`  Redirect URI used: "${redirectUri}"`);
      console.error(`  Grant type: authorization_code`);

      // Check for common misconfigurations
      if (tokenData.error === 'invalid_grant') {
        console.error(
          '  HINT: "invalid_grant" during code exchange usually means:\n' +
          '    1. The authorization code was already used (codes are single-use)\n' +
          '    2. The code expired (10 minutes lifetime)\n' +
          '    3. The redirect_uri in this request doesn\'t match the one used during authorization\n' +
          '    4. The client_id/client_secret don\'t match the OAuth app that issued the code'
        );
      }
      if (tokenData.error === 'invalid_client') {
        console.error(
          '  HINT: Check that GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are correct\n' +
          '  and belong to the same OAuth 2.0 Client in Google Cloud Console.'
        );
      }

      return safeRedirect('/admin/communications', { error: tokenData.error });
    }

    const { access_token, refresh_token, expires_in, scope } = tokenData;
    console.info(`[GMAIL-CALLBACK] Token exchange successful — expires_in: ${expires_in}s`);

    // ── Validate refresh_token is present ─────────────────────────────
    // refresh_token is only returned when access_type=offline AND the user
    // grants consent. If missing, the integration can't auto-refresh tokens.
    console.info('[GMAIL-CALLBACK] Step 5/9: Validating tokens and scopes');
    if (!refresh_token) {
      console.error(
        '[GMAIL-CALLBACK] WARNING: No refresh_token received from Google!\n' +
        '  This means the integration will stop working when the access_token expires.\n' +
        '  Common causes:\n' +
        '    1. prompt=consent was not set during authorization (user wasn\'t forced to re-consent)\n' +
        '    2. access_type=offline was not set during authorization\n' +
        '    3. The user previously granted access — Google only returns refresh_token on first consent.\n' +
        '       Fix: Set prompt=consent to force re-consent on every authorization.\n' +
        '  Proceeding with access_token only — token refresh will fail when it expires.'
      );
    } else {
      console.info('[GMAIL-CALLBACK] refresh_token received — offline access confirmed');
    }

    // ── Validate granted scopes ───────────────────────────────────────
    // Google may return fewer scopes than requested if the user unchecked some.
    const grantedScopes = scope ? scope.split(' ') : [];
    const missingScopes = REQUIRED_SCOPE_SUFFIXES.filter(
      required => !grantedScopes.some((granted: string) => granted.endsWith(required))
    );

    if (missingScopes.length > 0) {
      console.error(
        `[GMAIL-CALLBACK] WARNING: Missing required scopes!\n` +
        `  Requested: ${REQUIRED_SCOPE_SUFFIXES.join(', ')}\n` +
        `  Granted:   ${grantedScopes.map((s: string) => s.split('/').pop()).join(', ')}\n` +
        `  Missing:   ${missingScopes.join(', ')}\n` +
        `  Impact: Some email features may not work. The user may need to re-authorize\n` +
        `  with all scopes checked, or Gmail API may not be enabled in Google Cloud Console.`
      );
    } else {
      console.info(`[GMAIL-CALLBACK] All required scopes granted: ${grantedScopes.map((s: string) => s.split('/').pop()).join(', ')}`);
    }

    // ── Verify Gmail API is enabled in the Google Cloud project ──
    console.info('[GMAIL-CALLBACK] Step 6/9: Checking Gmail API enablement');
    const apiCheck = await checkGmailApiEnabled(access_token);
    if (!apiCheck.enabled) {
      console.error(`[GMAIL-CALLBACK] CRITICAL: ${apiCheck.error}`);
      console.error(
        '  The OAuth flow succeeded but the Gmail API itself is not turned on.\n' +
        '  The user will get 403 errors on every email operation until this is fixed.'
      );
      // Don't block — store the integration but surface the warning.
      // The user can still complete setup; API calls will fail with a clear diagnostic.
    } else if (apiCheck.error) {
      console.warn(`[GMAIL-CALLBACK] Gmail API probe note: ${apiCheck.error}`);
    } else {
      console.info('[GMAIL-CALLBACK] Gmail API is enabled and accessible');
    }

    console.info('[GMAIL-CALLBACK] Step 7/9: Fetching user email from Google');
    // Get user's email from Google
    const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userInfoResponse.ok) {
      console.error(
        `[GMAIL-CALLBACK] FAILED: Could not fetch user info from Google\n` +
        `  Status: ${userInfoResponse.status}\n` +
        `  This may indicate Gmail API is not enabled or the access_token is invalid.\n` +
        `  Ensure "Gmail API" is enabled in Google Cloud Console → APIs & Services → Library.`
      );
      return safeRedirect('/admin/communications', { error: 'userinfo_failed' });
    }

    const userInfo = await userInfoResponse.json();
    const gmailAddress = userInfo.email;

    if (!gmailAddress) {
      console.error('[GMAIL-CALLBACK] FAILED: Google returned user info without email address');
      return safeRedirect('/admin/communications', { error: 'no_email' });
    }
    console.info(`[GMAIL-CALLBACK] User email: ${gmailAddress}`);

    console.info('[GMAIL-CALLBACK] Step 8/9: Storing encrypted tokens in database');
    // Store tokens in database using service role (bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get user's organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', statePayload.user_id)
      .single();

    if (!profile) {
      console.error(`[GMAIL-CALLBACK] FAILED: No profile found for user_id ${statePayload.user_id}`);
      return safeRedirect('/admin/communications', { error: 'user_not_found' });
    }
    console.info(`[GMAIL-CALLBACK] User org: ${profile.organization_id}`);

    // Encrypt tokens before storing
    const encryptedTokens = await encryptTokenPair(access_token, refresh_token);

    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Upsert integration record
    const { error: dbError } = await supabase
      .from('email_integrations')
      .upsert(
        {
          organization_id: profile.organization_id,
          user_id: statePayload.user_id,
          provider: 'gmail',
          email_address: gmailAddress,
          access_token: encryptedTokens.access_token,
          refresh_token: encryptedTokens.refresh_token,
          tokens_encrypted: true,
          token_expires_at: tokenExpiresAt,
          scopes: grantedScopes,
          status: 'active',
          last_synced_at: new Date().toISOString(),
          error_message: null,
        },
        {
          onConflict: 'organization_id,user_id,provider',
        }
      );

    if (dbError) {
      console.error('[GMAIL-CALLBACK] FAILED: Database upsert error:', dbError.message);
      console.error(`  Code: ${dbError.code}, Details: ${dbError.details}`);
      return safeRedirect('/admin/communications', { error: 'db_error' });
    }
    console.info(`[GMAIL-CALLBACK] Integration saved — token_expires_at: ${tokenExpiresAt}, scopes: ${grantedScopes.length}`);

    // Log successful sync
    const { data: savedIntegration } = await supabase
      .from('email_integrations')
      .select('id')
      .eq('user_id', statePayload.user_id)
      .eq('provider', 'gmail')
      .single();

    if (savedIntegration) {
      await supabase.from('email_sync_log').insert({
        integration_id: savedIntegration.id,
        organization_id: profile.organization_id,
        sync_type: 'full',
        status: 'completed',
        messages_synced: 0,
        completed_at: new Date().toISOString(),
      });
    }

    console.info('[GMAIL-CALLBACK] Step 9/9: OAuth flow complete — redirecting to app');
    console.info(
      `[GMAIL-CALLBACK] SUCCESS: Gmail connected for ${gmailAddress}\n` +
      `  User: ${statePayload.user_id}\n` +
      `  Org: ${profile.organization_id}\n` +
      `  Scopes: ${grantedScopes.map((s: string) => s.split('/').pop()).join(', ')}\n` +
      `  Has refresh_token: ${!!refresh_token}\n` +
      `  Token expires: ${tokenExpiresAt}` +
      (missingScopes.length > 0 ? `\n  ⚠ Missing scopes: ${missingScopes.join(', ')}` : '')
    );

    // Redirect back to app with success
    return safeRedirect('/admin/communications', {
      connected: 'gmail',
      email: gmailAddress,
    });
  } catch (error) {
    console.error('[GMAIL-CALLBACK] Unexpected error:', error);
    return safeRedirect('/admin/communications', { error: 'server_error' });
  }
});
