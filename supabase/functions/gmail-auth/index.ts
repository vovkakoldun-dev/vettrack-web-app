// supabase/functions/gmail-auth/index.ts
// Initiates Gmail OAuth 2.0 flow — redirects user to Google consent screen
//
// Deployed with verify_jwt: false — function handles auth internally via getUser(token)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];
const SCOPES = REQUIRED_SCOPES.join(' ');

function getCorsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'));

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Extract Bearer token from Authorization header
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use SERVICE_ROLE client + pass token directly to getUser
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', detail: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check environment
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

    if (!clientId || !redirectUri || !clientSecret) {
      return new Response(
        JSON.stringify({
          error: 'Gmail integration not configured',
          setup_instructions: {
            GOOGLE_CLIENT_ID: clientId ? 'SET' : 'MISSING',
            GOOGLE_CLIENT_SECRET: clientSecret ? 'SET' : 'MISSING',
            GOOGLE_REDIRECT_URI: redirectUri || 'MISSING',
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate HMAC-signed state token
    const statePayload = {
      user_id: user.id,
      timestamp: Date.now(),
      nonce: crypto.randomUUID(),
    };
    const secret = Deno.env.get('OAUTH_STATE_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const stateData = new TextEncoder().encode(JSON.stringify(statePayload));
    const sigBuffer = await crypto.subtle.sign('HMAC', key, stateData);
    const signature = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));
    const state = btoa(JSON.stringify({ payload: statePayload, signature }));

    // Build Google OAuth URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state,
      include_granted_scopes: 'true',
    });
    if (user.email) params.set('login_hint', user.email);

    const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;

    return new Response(
      JSON.stringify({ auth_url: authUrl }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[GMAIL-AUTH] Exception:', error);
    const corsHeaders = getCorsHeaders(req.headers.get('Origin'));
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
