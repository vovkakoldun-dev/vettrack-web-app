// supabase/functions/_shared/oauth-security.ts
// Shared security utilities for OAuth edge functions.
// Import with: import { ... } from '../_shared/oauth-security.ts';

// ─── Redirect URI Validation ────────────────────────────────────────────────
// Prevents open redirects by enforcing an allowlist of valid redirect targets.
// The APP_URL env var is validated against this allowlist before any redirect.

const ALLOWED_REDIRECT_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.hugoit\.com$/,     // Production: *.hugoit.com
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/,      // Preview deploys
  /^http:\/\/localhost:\d{4}$/,                // Local dev (any port)
  /^http:\/\/127\.0\.0\.1:\d{4}$/,            // Local dev (IP)
];

// ─── OAuth Redirect URI Validation ─────────────────────────────────────────
// Validates that the GOOGLE_REDIRECT_URI / MICROSOFT_REDIRECT_URI env vars
// exactly match the expected format. If protocol, domain, or path diverge
// from what's registered in Google Cloud Console / Azure Portal, the OAuth
// provider will reject the request with `redirect_uri_mismatch`.

/** Expected callback paths for each provider. */
const PROVIDER_CALLBACK_PATHS: Record<string, string> = {
  google: '/functions/v1/gmail-callback',
  microsoft: '/functions/v1/outlook-callback',
};

/** Allowed redirect URI host patterns (the OAuth callback lives on Supabase). */
const ALLOWED_CALLBACK_HOST_PATTERNS = [
  /^[a-z0-9-]+\.supabase\.co$/,               // Supabase hosted
  /^localhost:\d{4}$/,                          // Local Supabase CLI
  /^127\.0\.0\.1:\d{4}$/,                      // Local Supabase CLI (IP)
];

export interface RedirectUriValidation {
  valid: boolean;
  errors: string[];
  parsed: { protocol: string; host: string; path: string } | null;
}

/**
 * Validates an OAuth redirect URI for a given provider.
 *
 * Checks:
 * 1. URI is parseable
 * 2. Protocol is https (http only for localhost)
 * 3. Host matches an allowed Supabase domain pattern
 * 4. Path exactly matches the expected callback path for the provider
 * 5. No query string or fragment (Google/Microsoft reject these)
 *
 * Returns a validation result with detailed error messages for logging.
 */
export function validateRedirectUri(
  redirectUri: string,
  provider: 'google' | 'microsoft',
): RedirectUriValidation {
  const errors: string[] = [];

  // 1. Parse
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    return {
      valid: false,
      errors: [`Redirect URI is not a valid URL: "${redirectUri}"`],
      parsed: null,
    };
  }

  const protocol = url.protocol.replace(/:$/, '');  // "https" not "https:"
  const host = url.host;                              // includes port if present
  const path = url.pathname;

  // 2. Protocol — must be https (http only for localhost/127.0.0.1)
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  if (protocol !== 'https' && !(protocol === 'http' && isLocal)) {
    errors.push(
      `Protocol mismatch: expected "https" but got "${protocol}". ` +
      `OAuth providers require HTTPS for redirect URIs in production.`
    );
  }

  // 3. Host — must match an allowed pattern
  const hostAllowed = ALLOWED_CALLBACK_HOST_PATTERNS.some(p => p.test(host));
  if (!hostAllowed) {
    errors.push(
      `Host mismatch: "${host}" does not match any allowed Supabase callback host. ` +
      `Expected pattern: <project-ref>.supabase.co`
    );
  }

  // 4. Path — must exactly match the provider's expected callback path
  const expectedPath = PROVIDER_CALLBACK_PATHS[provider];
  if (path !== expectedPath) {
    errors.push(
      `Path mismatch: expected "${expectedPath}" but got "${path}". ` +
      `This MUST match exactly what is registered in the ${provider === 'google' ? 'Google Cloud Console' : 'Azure Portal'}.`
    );
  }

  // 5. No query string or fragment
  if (url.search) {
    errors.push(`Redirect URI must not contain a query string: "${url.search}"`);
  }
  if (url.hash) {
    errors.push(`Redirect URI must not contain a fragment: "${url.hash}"`);
  }

  return {
    valid: errors.length === 0,
    errors,
    parsed: { protocol, host, path },
  };
}

/**
 * Validates the redirect URI and returns an error Response if invalid.
 * Returns null if the URI is valid (caller should proceed).
 *
 * Logs every validation error to the server console for debugging.
 */
export function rejectInvalidRedirectUri(
  redirectUri: string,
  provider: 'google' | 'microsoft',
  corsHeaders: Record<string, string>,
): Response | null {
  const result = validateRedirectUri(redirectUri, provider);

  if (result.valid) return null;

  // Log detailed errors server-side
  console.error(`[OAUTH] Redirect URI validation FAILED for ${provider}:`);
  for (const err of result.errors) {
    console.error(`  → ${err}`);
  }
  console.error(`  Raw URI: "${redirectUri}"`);
  if (result.parsed) {
    console.error(`  Parsed — protocol: ${result.parsed.protocol}, host: ${result.parsed.host}, path: ${result.parsed.path}`);
  }

  return new Response(
    JSON.stringify({
      error: 'redirect_uri_mismatch',
      message: `OAuth redirect URI validation failed for ${provider}. Check Edge Function logs for details.`,
      // Surface error count (not details) so the frontend can show a useful message
      validation_errors: result.errors.length,
      expected_path: PROVIDER_CALLBACK_PATHS[provider],
    }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Validates and returns a safe redirect base URL.
 * Returns null if the URL is not in the allowlist.
 */
export function getValidatedAppUrl(): string | null {
  const appUrl = Deno.env.get('APP_URL');
  if (!appUrl) return null;

  // Strip trailing slash for consistency
  const normalized = appUrl.replace(/\/+$/, '');

  // Must match at least one allowed pattern
  const isAllowed = ALLOWED_REDIRECT_PATTERNS.some(pattern => pattern.test(normalized));
  if (!isAllowed) {
    console.error(`APP_URL "${normalized}" does not match any allowed redirect pattern`);
    return null;
  }

  return normalized;
}

/**
 * Builds a safe redirect URL. Falls back to a static error page if APP_URL is invalid.
 */
export function safeRedirect(path: string, params?: Record<string, string>): Response {
  const appUrl = getValidatedAppUrl();

  if (!appUrl) {
    // If APP_URL is not configured or invalid, return an HTML page instead of redirecting
    return new Response(
      `<!DOCTYPE html><html><body>
        <h2>OAuth Configuration Error</h2>
        <p>The application redirect URL is not configured or is invalid.</p>
        <p>Please contact your administrator.</p>
      </body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  }

  const url = new URL(path, appUrl);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  return Response.redirect(url.toString(), 302);
}

// ─── State Token Signing (HMAC-SHA256) ──────────────────────────────────────
// Signs the OAuth state parameter so callbacks can verify it was issued by us.
// Prevents CSRF: an attacker cannot forge a valid state token without the key.

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

interface StatePayload {
  user_id: string;
  timestamp: number;
  nonce: string;
}

interface SignedState {
  payload: StatePayload;
  signature: string;
}

/**
 * Gets the HMAC signing key from env. Falls back to SUPABASE_SERVICE_ROLE_KEY
 * as the signing secret (available in all edge functions).
 */
async function getSigningKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('OAUTH_STATE_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const keyData = new TextEncoder().encode(secret);
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Creates a signed state token for OAuth initiation.
 * The state contains the user_id, timestamp, and a random nonce,
 * plus an HMAC signature that the callback will verify.
 */
export async function createSignedState(userId: string): Promise<string> {
  const payload: StatePayload = {
    user_id: userId,
    timestamp: Date.now(),
    nonce: crypto.randomUUID(),
  };

  const key = await getSigningKey();
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const sigBuffer = await crypto.subtle.sign('HMAC', key, data);
  const signature = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));

  const signed: SignedState = { payload, signature };
  return btoa(JSON.stringify(signed));
}

/**
 * Verifies and decodes a signed state token from the OAuth callback.
 * Returns the payload if valid, or null if tampered/expired/malformed.
 */
export async function verifySignedState(state: string): Promise<StatePayload | null> {
  let signed: SignedState;
  try {
    signed = JSON.parse(atob(state));
  } catch {
    return null;
  }

  if (!signed.payload || !signed.signature) return null;

  // Check expiry
  if (Date.now() - signed.payload.timestamp > STATE_MAX_AGE_MS) {
    return null;
  }

  // Verify HMAC signature
  const key = await getSigningKey();
  const data = new TextEncoder().encode(JSON.stringify(signed.payload));
  const sigBytes = Uint8Array.from(atob(signed.signature), c => c.charCodeAt(0));

  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, data);
  if (!valid) return null;

  // Validate user_id format (must be a UUID)
  if (!isValidUuid(signed.payload.user_id)) return null;

  return signed.payload;
}

// ─── Input Sanitization ─────────────────────────────────────────────────────

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validates a string is a proper UUID v4 format */
export function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * Sanitizes a message/thread ID for safe use in URL paths.
 * Google message IDs: alphanumeric hex strings (e.g. "18f2a3b4c5d6e7f8")
 * Microsoft message IDs: base64-like strings with alphanumeric, -, _, =
 * Rejects anything containing /, ?, #, \, or control characters.
 */
export function sanitizeResourceId(id: string): string | null {
  if (!id || id.length > 512) return null;
  // Allow alphanumeric, hyphen, underscore, dot, equals, plus (covers both Google and Microsoft IDs)
  if (!/^[a-zA-Z0-9\-_\.=+]+$/.test(id)) return null;
  return id;
}

/**
 * Sanitizes an OData filter value to prevent injection.
 * Escapes single quotes (the OData string delimiter).
 */
export function sanitizeODataValue(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Validates a folder name against an explicit allowlist.
 * Returns null if the folder is not recognized — never falls through to raw input.
 */
export function validateFolder(folder: string, allowedFolders: Record<string, string>): string | null {
  return allowedFolders[folder] ?? null;
}

// ─── CORS ───────────────────────────────────────────────────────────────────

/**
 * Returns CORS headers restricted to allowed origins.
 * Falls back to the APP_URL origin if the request origin is not in the allowlist.
 */
export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  const allowedOrigins = [
    getValidatedAppUrl(),
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
  ].filter(Boolean) as string[];

  const origin = requestOrigin && allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : allowedOrigins[0] || '';

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };
}

// ─── Google Consent Screen Status ──────────────────────────────────────────
// When a Google Cloud OAuth app is in "Testing" mode (not verified/published),
// only explicitly added test users can complete the OAuth flow. Non-test users
// get `access_denied` from Google with no useful context. These utilities let
// the backend pre-validate users and provide actionable error messages.
//
// Env vars:
//   GOOGLE_OAUTH_STATUS  — "testing" | "production" (default: "testing")
//   GOOGLE_TEST_USERS    — comma-separated emails (only checked when status=testing)
//
// When status=testing AND GOOGLE_TEST_USERS is set, the auth function checks the
// user's email before redirecting to Google. If the email isn't in the list,
// the request is rejected with a detailed log and user-facing error.

export type ConsentScreenStatus = 'testing' | 'production';

export function getConsentScreenStatus(): ConsentScreenStatus {
  const raw = Deno.env.get('GOOGLE_OAUTH_STATUS')?.toLowerCase().trim();
  return raw === 'production' ? 'production' : 'testing';
}

/**
 * Returns the list of test user emails from env.
 * Empty array means "no allowlist configured" (all users allowed through).
 */
export function getGoogleTestUsers(): string[] {
  const raw = Deno.env.get('GOOGLE_TEST_USERS');
  if (!raw) return [];
  return raw
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

export interface ConsentScreenCheck {
  allowed: boolean;
  status: ConsentScreenStatus;
  reason?: string;
  testUsers?: string[];
}

/**
 * Pre-validate whether a user's email can complete the Google OAuth flow
 * given the current consent screen status.
 *
 * Returns `{ allowed: true }` when:
 * - Status is "production" (all users can consent)
 * - Status is "testing" but no test user list is configured (can't validate)
 * - Status is "testing" and the email is in the test user list
 *
 * Returns `{ allowed: false, reason }` when:
 * - Status is "testing" and the email is NOT in the test user list
 */
export function checkConsentScreenAccess(userEmail: string): ConsentScreenCheck {
  const status = getConsentScreenStatus();

  if (status === 'production') {
    return { allowed: true, status };
  }

  // Testing mode — check the allowlist
  const testUsers = getGoogleTestUsers();

  if (testUsers.length === 0) {
    // No allowlist configured — can't pre-validate, let Google handle it
    return { allowed: true, status, testUsers: [] };
  }

  const emailLower = userEmail.toLowerCase().trim();
  if (testUsers.includes(emailLower)) {
    return { allowed: true, status, testUsers };
  }

  return {
    allowed: false,
    status,
    testUsers,
    reason:
      `Google OAuth consent screen is in TESTING mode. ` +
      `The email "${userEmail}" is not in the test user allowlist. ` +
      `Add this email in Google Cloud Console → OAuth consent screen → Test users, ` +
      `AND in the GOOGLE_TEST_USERS env var.`,
  };
}

/**
 * Check the `oauth_test_users` DB table for the given email + provider.
 * Returns true if the user is in the DB allowlist (or if the table can't be queried).
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 */
export async function isTestUserInDb(
  email: string,
  provider: 'google' | 'microsoft' = 'google',
): Promise<boolean> {
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.0');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data, error } = await supabase
      .from('oauth_test_users')
      .select('id')
      .ilike('email', email.trim())
      .eq('provider', provider)
      .eq('active', true)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[OAUTH] Failed to query oauth_test_users:', error.message);
      return true; // Fail open — don't block if DB query fails
    }
    return !!data;
  } catch (err) {
    console.error('[OAUTH] Error checking oauth_test_users table:', err);
    return true; // Fail open
  }
}

/**
 * Full test user check: env var list OR DB table.
 * Returns `{ allowed: true }` if the email passes either source.
 */
export async function checkTestUserAccess(
  userEmail: string,
  provider: 'google' | 'microsoft' = 'google',
): Promise<ConsentScreenCheck> {
  const status = getConsentScreenStatus();

  if (status === 'production') {
    return { allowed: true, status };
  }

  // Check env var list first (fast path)
  const envCheck = checkConsentScreenAccess(userEmail);
  if (envCheck.allowed) return envCheck;

  // Env check failed — try DB table as fallback
  const inDb = await isTestUserInDb(userEmail, provider);
  if (inDb) {
    return { allowed: true, status, testUsers: envCheck.testUsers };
  }

  // Neither env nor DB — reject
  return {
    allowed: false,
    status,
    testUsers: envCheck.testUsers,
    reason:
      `Google OAuth consent screen is in TESTING mode. ` +
      `The email "${userEmail}" is not in the test user allowlist (checked both ` +
      `GOOGLE_TEST_USERS env var and oauth_test_users DB table). ` +
      `Add this email in: (1) Google Cloud Console → OAuth consent screen → Test users, ` +
      `AND (2) either the GOOGLE_TEST_USERS env var or the oauth_test_users table.`,
  };
}

/**
 * Rejects a request if the user is not an allowed test user.
 * Returns an error Response to send, or null if the user is allowed.
 *
 * Checks both the GOOGLE_TEST_USERS env var and the oauth_test_users DB table.
 * Logs full diagnostic details server-side.
 */
export async function rejectUnauthorizedTestUser(
  userEmail: string,
  corsHeaders: Record<string, string>,
  provider: 'google' | 'microsoft' = 'google',
): Promise<Response | null> {
  const check = await checkTestUserAccess(userEmail, provider);

  if (check.allowed) return null;

  // Log detailed error server-side
  console.error('[OAUTH] Consent screen test user check FAILED:');
  console.error(`  → ${check.reason}`);
  console.error(`  Allowed test users: [${check.testUsers?.join(', ') || 'none configured'}]`);
  console.error(`  Attempted email: "${userEmail}"`);
  console.error(`  Consent screen status: ${check.status}`);

  return new Response(
    JSON.stringify({
      error: 'consent_screen_unauthorized',
      message:
        'This Google account is not authorized for OAuth access. ' +
        'The app is in testing mode — only approved test users can connect.',
      status: check.status,
    }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Maps Google OAuth error codes to detailed diagnostic messages.
 * Use this in the callback to produce actionable logs.
 */
export function diagnoseGoogleOAuthError(
  error: string,
  errorDescription?: string | null,
): { message: string; severity: 'critical' | 'warning' | 'info' } {
  switch (error) {
    case 'access_denied':
      return {
        severity: 'critical',
        message:
          `User denied consent or is NOT an authorized test user. ` +
          `If the Google OAuth consent screen is in "Testing" mode, only users ` +
          `explicitly added in Google Cloud Console → OAuth consent screen → Test users ` +
          `can complete the flow. ` +
          `Resolution: Either add the user as a test user, or publish the app for verification.`,
      };
    case 'redirect_uri_mismatch':
      return {
        severity: 'critical',
        message:
          `The redirect URI does not match Google Cloud Console configuration. ` +
          `Go to APIs & Services → Credentials → OAuth Client → Authorized redirect URIs ` +
          `and ensure the URI matches GOOGLE_REDIRECT_URI exactly (protocol + domain + path).`,
      };
    case 'invalid_scope':
      return {
        severity: 'critical',
        message:
          `One or more requested OAuth scopes are invalid or not enabled. ` +
          `Ensure Gmail API is enabled in Google Cloud Console → APIs & Services → Library.`,
      };
    case 'invalid_client':
      return {
        severity: 'critical',
        message:
          `The GOOGLE_CLIENT_ID is invalid or does not match the OAuth client. ` +
          `Verify in Google Cloud Console → APIs & Services → Credentials.`,
      };
    case 'server_error':
    case 'temporarily_unavailable':
      return {
        severity: 'warning',
        message: `Google OAuth returned a temporary server error: "${error}". Retry later.`,
      };
    default:
      return {
        severity: 'info',
        message:
          `Google OAuth error: "${error}"` +
          (errorDescription ? ` — ${errorDescription}` : '') +
          `. Check Google Cloud Console for configuration issues.`,
      };
  }
}

// ─── Gmail API Enablement Check ─────────────────────────────────────────────

/**
 * Checks whether the Gmail API is enabled in the Google Cloud project by making
 * a lightweight API call. Returns a diagnostic result.
 *
 * This is a best-effort check — it uses the access token to call a minimal
 * Gmail endpoint. If the API is disabled, Google returns 403 with
 * "accessNotConfigured" or a message containing "has not been used" / "it is disabled".
 *
 * Call this after token exchange in the callback to surface the issue early.
 */
export async function checkGmailApiEnabled(
  accessToken: string,
): Promise<{ enabled: boolean; error?: string }> {
  try {
    // Use the labels endpoint — lightest authenticated Gmail API call
    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/labels?fields=labels(id)',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (response.ok) {
      return { enabled: true };
    }

    const data = await response.json();
    const reason = data.error?.errors?.[0]?.reason || '';
    const message = data.error?.message || '';

    if (
      reason === 'accessNotConfigured' ||
      message.includes('has not been used') ||
      message.includes('it is disabled')
    ) {
      return {
        enabled: false,
        error:
          'Gmail API is NOT enabled in the Google Cloud project. ' +
          'Go to Google Cloud Console → APIs & Services → Library → search "Gmail API" → Enable. ' +
          'This must be done in the same project as your OAuth 2.0 credentials.',
      };
    }

    if (response.status === 403 && reason === 'insufficientPermissions') {
      return {
        enabled: true, // API is enabled, but scopes are insufficient
        error: 'Gmail API is enabled but the granted scopes are insufficient.',
      };
    }

    // Some other error — API may or may not be enabled
    return {
      enabled: true, // Assume enabled — let downstream calls surface the real issue
      error: `Gmail API probe returned ${response.status}: ${message}`,
    };
  } catch (err) {
    console.error('[OAUTH] Gmail API enablement check failed:', err);
    return { enabled: true }; // Fail open — don't block on network errors
  }
}

// ─── Error Responses ────────────────────────────────────────────────────────

/**
 * Returns a safe error response that does not leak internal details.
 */
export function safeErrorResponse(
  userMessage: string,
  status: number,
  corsHeaders: Record<string, string>,
  internalError?: unknown
): Response {
  // Log full error server-side for debugging
  if (internalError) {
    console.error(`[${status}] ${userMessage}:`, internalError);
  }

  return new Response(
    JSON.stringify({ error: userMessage }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
