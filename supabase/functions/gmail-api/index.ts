// supabase/functions/gmail-api/index.ts
// Proxies Gmail API calls — list, get, send, modify emails
//
// Deployed with verify_jwt: false — function handles auth internally via getUser(token)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { withTokenRetry } from './token-refresh.ts';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

function getCorsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function parseGmailMessage(msg: any): any {
  const headers = msg.payload?.headers || [];
  const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  let body = '';
  if (msg.payload?.body?.data) {
    body = atob(msg.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
  } else if (msg.payload?.parts) {
    const htmlPart = msg.payload.parts.find((p: any) => p.mimeType === 'text/html');
    const textPart = msg.payload.parts.find((p: any) => p.mimeType === 'text/plain');
    const part = htmlPart || textPart;
    if (part?.body?.data) {
      body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }
  }

  const attachments = (msg.payload?.parts || [])
    .filter((p: any) => p.filename && p.filename.length > 0)
    .map((p: any) => ({ id: p.body?.attachmentId, filename: p.filename, mimeType: p.mimeType, size: p.body?.size || 0 }));

  const labelIds = msg.labelIds || [];

  return {
    id: msg.id,
    threadId: msg.threadId,
    from: getHeader('From'),
    to: getHeader('To'),
    cc: getHeader('Cc'),
    subject: getHeader('Subject'),
    date: getHeader('Date'),
    snippet: msg.snippet,
    body,
    read: !labelIds.includes('UNREAD'),
    starred: labelIds.includes('STARRED'),
    labels: labelIds,
    hasAttachment: attachments.length > 0,
    attachments,
    internalDate: msg.internalDate,
  };
}

function createMimeMessage(to: string, subject: string, body: string, cc?: string, bcc?: string): string {
  const boundary = `boundary_${crypto.randomUUID()}`;
  const lines = [
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    ...(bcc ? [`Bcc: ${bcc}`] : []),
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body.replace(/<[^>]*>/g, ''),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    body,
    '',
    `--${boundary}--`,
  ];
  return btoa(lines.join('\r\n')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'));

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Extract Bearer token
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Use SERVICE_ROLE client + pass token directly to getUser
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', detail: userError?.message }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // ─── STATUS ───
    if (action === 'status') {
      const { data: integrations } = await supabase
        .from('email_integrations')
        .select('id, provider, email_address, status, last_synced_at, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      return new Response(
        JSON.stringify({ integrations: integrations || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── DISCONNECT ───
    if (action === 'disconnect') {
      const body = await req.json();
      await supabase
        .from('email_integrations')
        .update({ status: 'disconnected', access_token: null, refresh_token: null })
        .eq('user_id', user.id)
        .eq('provider', body.provider);

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get active Gmail integration
    const { data: integration } = await supabase
      .from('email_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'gmail')
      .eq('status', 'active')
      .single();

    if (!integration) {
      return new Response(
        JSON.stringify({ error: 'No active Gmail integration', code: 'NOT_CONNECTED' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Helper: Gmail API call with token refresh + retry
    async function gmailFetch(apiUrl: string, init?: RequestInit, label?: string): Promise<{ response: Response; token: string }> {
      const { response, accessToken } = await withTokenRetry(
        supabase, integration!, 'google',
        (t) => fetch(apiUrl, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${t}` } }),
      );

      if (response.status === 401) {
        return {
          response: new Response(
            JSON.stringify({ error: 'Token expired, please reconnect', code: 'REAUTH_REQUIRED' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          ),
          token: '',
        };
      }
      return { response, token: accessToken };
    }

    // ─── LIST ───
    if (action === 'list') {
      const labelIds = url.searchParams.get('labelIds') || 'INBOX';
      const maxResults = url.searchParams.get('maxResults') || '20';
      const pageToken = url.searchParams.get('pageToken') || '';
      const query = url.searchParams.get('q') || '';

      const params = new URLSearchParams({ labelIds, maxResults, ...(pageToken ? { pageToken } : {}), ...(query ? { q: query } : {}) });
      const { response: listResponse, token: gmailToken } = await gmailFetch(`${GMAIL_API_BASE}/messages?${params}`, undefined, 'list');
      if (listResponse.status === 401) return listResponse;
      const listData = await listResponse.json();

      if (listData.error) {
        return new Response(JSON.stringify({ error: listData.error.message }), { status: listData.error.code || 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const messages = listData.messages || [];
      const detailed = await Promise.all(
        messages.map(async (m: { id: string }) => {
          const r = await fetch(
            `${GMAIL_API_BASE}/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${gmailToken}` } }
          );
          return parseGmailMessage(await r.json());
        })
      );

      await supabase.from('email_integrations').update({ last_synced_at: new Date().toISOString() }).eq('id', integration.id);

      return new Response(
        JSON.stringify({ messages: detailed, nextPageToken: listData.nextPageToken || null, resultSizeEstimate: listData.resultSizeEstimate || 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── GET ───
    if (action === 'get') {
      const messageId = url.searchParams.get('id');
      if (!messageId) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { response: r } = await gmailFetch(`${GMAIL_API_BASE}/messages/${messageId}?format=full`, undefined, 'get');
      if (r.status === 401) return r;
      const d = await r.json();
      if (d.error) return new Response(JSON.stringify({ error: d.error.message }), { status: d.error.code || 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ message: parseGmailMessage(d) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ─── THREAD ───
    if (action === 'thread') {
      const threadId = url.searchParams.get('threadId');
      if (!threadId) return new Response(JSON.stringify({ error: 'Missing threadId' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { response: r } = await gmailFetch(`${GMAIL_API_BASE}/threads/${threadId}?format=full`, undefined, 'thread');
      if (r.status === 401) return r;
      const d = await r.json();
      if (d.error) return new Response(JSON.stringify({ error: d.error.message }), { status: d.error.code || 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ threadId: d.id, messages: (d.messages || []).map(parseGmailMessage) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ─── SEND ───
    if (action === 'send') {
      const body = await req.json();
      if (!body.to || !body.subject) return new Response(JSON.stringify({ error: 'Missing to or subject' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const raw = createMimeMessage(body.to, body.subject, body.body || '', body.cc, body.bcc);
      const { response: r } = await gmailFetch(`${GMAIL_API_BASE}/messages/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw }) }, 'send');
      if (r.status === 401) return r;
      const d = await r.json();
      if (d.error) return new Response(JSON.stringify({ error: d.error.message }), { status: d.error.code, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ success: true, messageId: d.id, threadId: d.threadId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ─── MODIFY ───
    if (action === 'modify') {
      const body = await req.json();
      if (!body.messageId) return new Response(JSON.stringify({ error: 'Missing messageId' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { response: r } = await gmailFetch(`${GMAIL_API_BASE}/messages/${body.messageId}/modify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ addLabelIds: body.addLabelIds || [], removeLabelIds: body.removeLabelIds || [] }) }, 'modify');
      if (r.status === 401) return r;
      const d = await r.json();
      if (d.error) return new Response(JSON.stringify({ error: d.error.message }), { status: d.error.code, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ success: true, labelIds: d.labelIds }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ─── TRASH / UNTRASH ───
    if (action === 'trash' || action === 'untrash') {
      const body = await req.json();
      const { response: r } = await gmailFetch(`${GMAIL_API_BASE}/messages/${body.messageId}/${action}`, { method: 'POST' }, action);
      if (r.status === 401) return r;
      if (!r.ok) { const e = await r.json(); return new Response(JSON.stringify({ error: e.error?.message || 'Failed' }), { status: r.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[GMAIL-API] Error:', error);
    const corsHeaders = getCorsHeaders(req.headers.get('Origin'));
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
