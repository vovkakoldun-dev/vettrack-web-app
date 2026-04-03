// supabase/functions/outlook-callback/index.ts
// Handles Microsoft OAuth callback — exchanges code for tokens and stores them
//
// Environment variables required:
//   MICROSOFT_CLIENT_ID
//   MICROSOFT_CLIENT_SECRET
//   MICROSOFT_REDIRECT_URI
//   APP_URL
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  validateRedirectUri,
  verifySignedState,
  safeRedirect,
} from '../_shared/oauth-security.ts';
import { encryptTokenPair } from '../_shared/token-encryption.ts';

const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const GRAPH_ME_URL = 'https://graph.microsoft.com/v1.0/me';

serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    if (error) {
      console.error('[OAUTH] Microsoft OAuth error:', error, errorDescription);
      return safeRedirect('/admin/communications', { error });
    }

    if (!code || !state) {
      return safeRedirect('/admin/communications', { error: 'missing_code' });
    }

    // Verify HMAC-signed state token (prevents CSRF, validates expiry)
    const statePayload = await verifySignedState(state);
    if (!statePayload) {
      console.error('[OAUTH] Outlook callback: state token verification failed (tampered, expired, or malformed)');
      return safeRedirect('/admin/communications', { error: 'invalid_state' });
    }

    const clientId = Deno.env.get('MICROSOFT_CLIENT_ID')!;
    const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET')!;
    const redirectUri = Deno.env.get('MICROSOFT_REDIRECT_URI')!;

    // Validate redirect URI — must match exactly what's in Azure Portal
    const uriValidation = validateRedirectUri(redirectUri, 'microsoft');
    if (!uriValidation.valid) {
      console.error('[OAUTH] Outlook callback: redirect URI validation FAILED');
      for (const err of uriValidation.errors) {
        console.error(`  → ${err}`);
      }
      console.error(`  Raw URI: "${redirectUri}"`);
      if (uriValidation.parsed) {
        console.error(`  Parsed — protocol: ${uriValidation.parsed.protocol}, host: ${uriValidation.parsed.host}, path: ${uriValidation.parsed.path}`);
      }
      return safeRedirect('/admin/communications', { error: 'redirect_uri_mismatch' });
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(MICROSOFT_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('[OAUTH] Microsoft token exchange error:', tokenData);
      if (tokenData.error === 'invalid_grant' && tokenData.error_description?.includes('redirect_uri')) {
        console.error(
          `[OAUTH] CRITICAL: Microsoft rejected redirect_uri "${redirectUri}". ` +
          `This means MICROSOFT_REDIRECT_URI does not match what is configured in ` +
          `Azure Portal → App registrations → Authentication → Redirect URIs.`
        );
      }
      return safeRedirect('/admin/communications', { error: tokenData.error });
    }

    const { access_token, refresh_token, expires_in, scope } = tokenData;

    // Get user's email from Microsoft Graph
    const meResponse = await fetch(GRAPH_ME_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const meData = await meResponse.json();
    const outlookEmail = meData.mail || meData.userPrincipalName;

    // Store tokens
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', statePayload.user_id)
      .single();

    if (!profile) {
      return safeRedirect('/admin/communications', { error: 'user_not_found' });
    }

    // Encrypt tokens before storing
    const encryptedTokens = await encryptTokenPair(access_token, refresh_token);

    const { error: dbError } = await supabase
      .from('email_integrations')
      .upsert(
        {
          organization_id: profile.organization_id,
          user_id: statePayload.user_id,
          provider: 'outlook',
          email_address: outlookEmail,
          access_token: encryptedTokens.access_token,
          refresh_token: encryptedTokens.refresh_token,
          tokens_encrypted: true,
          token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
          scopes: scope ? scope.split(' ') : [],
          status: 'active',
          last_synced_at: new Date().toISOString(),
          error_message: null,
        },
        { onConflict: 'organization_id,user_id,provider' }
      );

    if (dbError) {
      console.error('[OAUTH] Outlook callback database error:', dbError);
      return safeRedirect('/admin/communications', { error: 'db_error' });
    }

    // Log sync
    const { data: integration } = await supabase
      .from('email_integrations')
      .select('id')
      .eq('user_id', statePayload.user_id)
      .eq('provider', 'outlook')
      .single();

    if (integration) {
      await supabase.from('email_sync_log').insert({
        integration_id: integration.id,
        organization_id: profile.organization_id,
        sync_type: 'full',
        status: 'completed',
        messages_synced: 0,
        completed_at: new Date().toISOString(),
      });
    }

    return safeRedirect('/admin/communications', {
      connected: 'outlook',
      email: outlookEmail,
    });
  } catch (error) {
    console.error('[OAUTH] Outlook callback error:', error);
    return safeRedirect('/admin/communications', { error: 'server_error' });
  }
});
