// supabase/functions/outlook-auth/index.ts
// Initiates Microsoft OAuth 2.0 flow — redirects user to Microsoft consent screen
//
// Environment variables required (set in Supabase Dashboard > Edge Functions > Secrets):
//   MICROSOFT_CLIENT_ID       — from Azure Portal App Registration
//   MICROSOFT_REDIRECT_URI    — e.g. https://<project>.supabase.co/functions/v1/outlook-callback
//   SUPABASE_URL              — auto-provided
//   SUPABASE_ANON_KEY         — auto-provided

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  rejectInvalidRedirectUri,
  createSignedState,
  getCorsHeaders,
  safeErrorResponse,
} from '../_shared/oauth-security.ts';

const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';

const SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'https://graph.microsoft.com/Mail.Read',
  'https://graph.microsoft.com/Mail.ReadWrite',
  'https://graph.microsoft.com/Mail.Send',
  'https://graph.microsoft.com/User.Read',
  'https://graph.microsoft.com/Contacts.Read',
  'https://graph.microsoft.com/Calendars.Read',
].join(' ');

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'));

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get('MICROSOFT_CLIENT_ID');
    const redirectUri = Deno.env.get('MICROSOFT_REDIRECT_URI');

    if (!clientId || !redirectUri) {
      return new Response(
        JSON.stringify({
          error: 'Outlook integration not configured',
          message: 'MICROSOFT_CLIENT_ID and MICROSOFT_REDIRECT_URI must be set in Edge Function secrets.',
          setup_instructions: {
            step1: 'Go to Azure Portal → App registrations → New registration',
            step2: 'Set redirect URI (Web): https://<project-ref>.supabase.co/functions/v1/outlook-callback',
            step3: 'Under API permissions, add Microsoft Graph: Mail.Read, Mail.ReadWrite, Mail.Send, User.Read, Contacts.Read, Calendars.Read',
            step4: 'Under Certificates & secrets, create a new client secret',
            step5: 'Set MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REDIRECT_URI in Supabase secrets',
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate redirect URI — protocol, domain, path must match Azure Portal config
    const uriError = rejectInvalidRedirectUri(redirectUri, 'microsoft', corsHeaders);
    if (uriError) return uriError;

    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return safeErrorResponse('Missing authorization header', 401, corsHeaders);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return safeErrorResponse('Unauthorized', 401, corsHeaders);
    }

    // Generate HMAC-signed state token (prevents CSRF, includes user ID for callback)
    const state = await createSignedState(user.id);

    // Build Microsoft OAuth URL
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: SCOPES,
      state: state,
      prompt: 'consent',
    });

    const authUrl = `${MICROSOFT_AUTH_URL}?${params.toString()}`;

    return new Response(
      JSON.stringify({ auth_url: authUrl, state }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return safeErrorResponse('Internal server error', 500, corsHeaders, error);
  }
});
