// supabase/functions/gmail-auth/index.ts
// Initiates Gmail OAuth 2.0 flow — redirects user to Google consent screen
//
// Environment variables required (set in Supabase Dashboard > Edge Functions > Secrets):
//   GOOGLE_CLIENT_ID       — from Google Cloud Console
//   GOOGLE_REDIRECT_URI    — e.g. https://<project>.supabase.co/functions/v1/gmail-callback
//   SUPABASE_URL           — auto-provided
//   SUPABASE_ANON_KEY      — auto-provided
//
// Optional (consent screen test user validation):
//   GOOGLE_OAUTH_STATUS    — "testing" | "production" (default: "testing")
//   GOOGLE_TEST_USERS      — comma-separated emails allowed when status=testing

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  rejectInvalidRedirectUri,
  rejectUnauthorizedTestUser,
  getConsentScreenStatus,
  getGoogleTestUsers,
  createSignedState,
  getCorsHeaders,
  safeErrorResponse,
} from '../_shared/oauth-security.ts';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];
const SCOPES = REQUIRED_SCOPES.join(' ');

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'));

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.info('[GMAIL-AUTH] Step 1/6: Checking environment configuration');
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI');

    if (!clientId || !redirectUri) {
      console.error('[GMAIL-AUTH] FAILED: Missing env vars —', {
        GOOGLE_CLIENT_ID: clientId ? 'set' : 'MISSING',
        GOOGLE_REDIRECT_URI: redirectUri ? 'set' : 'MISSING',
        GOOGLE_CLIENT_SECRET: Deno.env.get('GOOGLE_CLIENT_SECRET') ? 'set' : 'MISSING',
      });
      return new Response(
        JSON.stringify({
          error: 'Gmail integration not configured',
          message: 'GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI must be set in Edge Function secrets.',
          setup_instructions: {
            step1: 'Go to Google Cloud Console → APIs & Services → Credentials',
            step2: 'Create an OAuth 2.0 Client ID (Web application)',
            step3: 'Add authorized redirect URI: https://<project-ref>.supabase.co/functions/v1/gmail-callback',
            step4: 'Enable Gmail API in APIs & Services → Library',
            step5: 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Supabase Edge Function secrets',
            step6: 'Set GOOGLE_REDIRECT_URI to your callback URL',
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.info('[GMAIL-AUTH] Step 2/6: Validating redirect URI');
    // Validate redirect URI — protocol, domain, path must match Google Cloud Console config
    const uriError = rejectInvalidRedirectUri(redirectUri, 'google', corsHeaders);
    if (uriError) return uriError;
    console.info(`[GMAIL-AUTH] Redirect URI valid: ${redirectUri}`);

    console.info('[GMAIL-AUTH] Step 3/6: Verifying user authentication');
    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[GMAIL-AUTH] FAILED: No Authorization header present');
      return safeErrorResponse('Missing authorization header', 401, corsHeaders);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('[GMAIL-AUTH] FAILED: User authentication failed', userError?.message || 'no user');
      return safeErrorResponse('Unauthorized', 401, corsHeaders);
    }
    console.info(`[GMAIL-AUTH] User authenticated: ${user.id} (${user.email || 'no email'})`);

    console.info('[GMAIL-AUTH] Step 4/6: Checking consent screen test user access');
    // ── Consent screen test user pre-validation ──────────────────
    // When GOOGLE_OAUTH_STATUS=testing and GOOGLE_TEST_USERS is set,
    // reject early with a clear error instead of letting Google return
    // a cryptic access_denied after the user goes through the consent screen.
    const userEmail = user.email;
    if (userEmail) {
      const testUserError = await rejectUnauthorizedTestUser(userEmail, corsHeaders, 'google');
      if (testUserError) return testUserError;
    }

    // Log consent screen status on every auth initiation for debugging
    const status = getConsentScreenStatus();
    const testUsers = getGoogleTestUsers();
    console.info(
      `[GMAIL-AUTH] Consent screen: ${status}, ` +
      `test_users: ${testUsers.length > 0 ? testUsers.join(', ') : '(none configured — all pass through)'}`
    );

    console.info('[GMAIL-AUTH] Step 5/6: Generating HMAC-signed state token');
    // Generate HMAC-signed state token (prevents CSRF, includes user ID for callback)
    const state = await createSignedState(user.id);

    // Build Google OAuth URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',    // Get refresh token
      prompt: 'consent',          // Always show consent to get refresh token
      state: state,
      include_granted_scopes: 'true',
    });

    // Pre-fill the user's email on the Google consent screen
    if (userEmail) {
      params.set('login_hint', userEmail);
    }

    const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;

    console.info('[GMAIL-AUTH] Step 6/6: OAuth URL generated successfully');
    console.info(`[GMAIL-AUTH] Flow config: access_type=offline, prompt=consent, scopes=${REQUIRED_SCOPES.length}`);
    console.info(`[GMAIL-AUTH] Requested scopes: ${REQUIRED_SCOPES.map(s => s.split('/').pop()).join(', ')}`);

    return new Response(
      JSON.stringify({
        auth_url: authUrl,
        state: state,
        consent_screen_status: status,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[GMAIL-AUTH] Unexpected error during auth initiation:', error);
    return safeErrorResponse('Internal server error', 500, corsHeaders, error);
  }
});
