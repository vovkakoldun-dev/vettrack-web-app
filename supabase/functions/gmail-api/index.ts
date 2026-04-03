// supabase/functions/gmail-api/index.ts
// Proxies Gmail API calls — list, get, send, modify emails
//
// Handles token refresh automatically when access_token expires
//
// Endpoints (via ?action= query param):
//   GET  ?action=list       — List emails (inbox, sent, etc.)
//   GET  ?action=get&id=X   — Get single email with full body
//   POST ?action=send        — Send an email
//   POST ?action=modify      — Modify labels (read/unread, archive, trash, star)
//   GET  ?action=status      — Check integration status
//   POST ?action=disconnect  — Disconnect integration

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { withTokenRetry } from '../_shared/token-refresh.ts';
import { getCorsHeaders, safeErrorResponse } from '../_shared/oauth-security.ts';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

/**
 * Diagnose common Gmail API error responses and return actionable log messages.
 */
function diagnoseGmailApiError(
  status: number,
  errorData: { error?: { code?: number; message?: string; errors?: { reason?: string; domain?: string }[] } },
  action: string,
): string {
  const reason = errorData.error?.errors?.[0]?.reason || '';
  const message = errorData.error?.message || '';

  if (status === 403) {
    if (reason === 'insufficientPermissions') {
      return (
        `Gmail API returned 403 insufficientPermissions for action="${action}". ` +
        `The access token lacks the required scope. Check that the user granted all requested scopes ` +
        `(gmail.readonly, gmail.send, gmail.modify) during OAuth. The user may need to reconnect.`
      );
    }
    if (reason === 'accessNotConfigured' || message.includes('has not been used') || message.includes('it is disabled')) {
      return (
        `Gmail API is NOT ENABLED in Google Cloud Console. ` +
        `Go to APIs & Services → Library → search "Gmail API" → Enable. ` +
        `This must be done in the same project as your OAuth credentials.`
      );
    }
    if (reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded') {
      return `Gmail API rate limit exceeded for action="${action}". Retry after a delay.`;
    }
    return `Gmail API 403 for action="${action}": ${reason || message}`;
  }

  if (status === 400) {
    return `Gmail API 400 bad request for action="${action}": ${message}. Check request parameters.`;
  }

  if (status === 404) {
    return `Gmail API 404 for action="${action}": ${message}. The resource (message/thread/label) may have been deleted.`;
  }

  if (status === 429) {
    return `Gmail API 429 too many requests for action="${action}". Implement exponential backoff.`;
  }

  if (status >= 500) {
    return `Gmail API server error (${status}) for action="${action}": ${message}. This is a Google-side issue — retry later.`;
  }

  return `Gmail API error (${status}) for action="${action}": ${message}`;
}

// Parse Gmail message into clean format
function parseGmailMessage(msg: any): any {
  const headers = msg.payload?.headers || [];
  const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  // Extract body
  let body = '';
  if (msg.payload?.body?.data) {
    body = atob(msg.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
  } else if (msg.payload?.parts) {
    const textPart = msg.payload.parts.find((p: any) => p.mimeType === 'text/plain');
    const htmlPart = msg.payload.parts.find((p: any) => p.mimeType === 'text/html');
    const part = htmlPart || textPart;
    if (part?.body?.data) {
      body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }
  }

  // Extract attachments info
  const attachments = (msg.payload?.parts || [])
    .filter((p: any) => p.filename && p.filename.length > 0)
    .map((p: any) => ({
      id: p.body?.attachmentId,
      filename: p.filename,
      mimeType: p.mimeType,
      size: p.body?.size || 0,
    }));

  const labelIds = msg.labelIds || [];

  return {
    id: msg.id,
    threadId: msg.threadId,
    from: getHeader('From'),
    to: getHeader('To'),
    cc: getHeader('Cc'),
    bcc: getHeader('Bcc'),
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

// Create MIME message for sending
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
    body.replace(/<[^>]*>/g, ''), // Strip HTML for plain text version
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    body,
    '',
    `--${boundary}--`,
  ];

  const raw = lines.join('\r\n');
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'));

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return safeErrorResponse('Unauthorized', 401, corsHeaders);
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return safeErrorResponse('Unauthorized', 401, corsHeaders);
    }

    // Service role client for token management
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // ─── STATUS ───────────────────────────────────
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

    // ─── DISCONNECT ──────────────────────────────
    if (action === 'disconnect') {
      const body = await req.json();
      const { provider } = body;

      await supabase
        .from('email_integrations')
        .update({ status: 'disconnected', access_token: null, refresh_token: null })
        .eq('user_id', user.id)
        .eq('provider', provider);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    // Helper: make a Gmail API call with automatic token refresh + retry on 401
    async function gmailFetch(
      urlOrPath: string,
      init?: RequestInit,
      actionLabel?: string,
    ): Promise<{ response: Response; token: string }> {
      const label = actionLabel || action || 'unknown';
      console.info(`[GMAIL-API] ${label}: Making API call`);

      const { response, accessToken } = await withTokenRetry(
        supabase, integration!, 'google',
        (token) => fetch(urlOrPath, {
          ...init,
          headers: { ...init?.headers, Authorization: `Bearer ${token}` },
        }),
      );

      if (response.status === 401) {
        console.error(`[GMAIL-API] ${label}: Token expired and refresh failed — REAUTH_REQUIRED`);
        return {
          response: new Response(
            JSON.stringify({ error: 'Token expired, please reconnect', code: 'REAUTH_REQUIRED' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          ),
          token: '',
        };
      }

      if (!response.ok && response.status !== 401) {
        // Try to parse and diagnose the error — clone to avoid consuming the body
        try {
          const errClone = response.clone();
          const errData = await errClone.json();
          const diagnosis = diagnoseGmailApiError(response.status, errData, label);
          console.error(`[GMAIL-API] ${label}: ${diagnosis}`);
        } catch {
          console.error(`[GMAIL-API] ${label}: Non-OK response (${response.status}), body not parseable`);
        }
      }

      return { response, token: accessToken };
    }

    // ─── LIST EMAILS ─────────────────────────────
    if (action === 'list') {
      const labelIds = url.searchParams.get('labelIds') || 'INBOX';
      const maxResults = url.searchParams.get('maxResults') || '20';
      const pageToken = url.searchParams.get('pageToken') || '';
      const query = url.searchParams.get('q') || '';

      const params = new URLSearchParams({
        labelIds,
        maxResults,
        ...(pageToken ? { pageToken } : {}),
        ...(query ? { q: query } : {}),
      });

      const { response: listResponse, token } = await gmailFetch(`${GMAIL_API_BASE}/messages?${params}`, undefined, 'list');
      if (listResponse.status === 401) return listResponse;
      const listData = await listResponse.json();

      if (listData.error) {
        const diagnosis = diagnoseGmailApiError(listData.error.code || 400, { error: listData.error }, 'list');
        console.error(`[GMAIL-API] list: ${diagnosis}`);
        return new Response(
          JSON.stringify({ error: listData.error.message }),
          { status: listData.error.code, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.info(`[GMAIL-API] list: Found ${(listData.messages || []).length} messages, fetching details`);

      // Fetch full message details using the same (refreshed) token
      const messages = listData.messages || [];
      const detailed = await Promise.all(
        messages.map(async (m: { id: string }) => {
          const msgResponse = await fetch(
            `${GMAIL_API_BASE}/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const msgData = await msgResponse.json();
          return parseGmailMessage(msgData);
        })
      );

      // Update last synced
      await supabase
        .from('email_integrations')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', integration.id);

      return new Response(
        JSON.stringify({
          messages: detailed,
          nextPageToken: listData.nextPageToken || null,
          resultSizeEstimate: listData.resultSizeEstimate || 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── GET SINGLE EMAIL ────────────────────────
    if (action === 'get') {
      const messageId = url.searchParams.get('id');
      if (!messageId) {
        return new Response(
          JSON.stringify({ error: 'Missing message id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { response: msgResponse } = await gmailFetch(`${GMAIL_API_BASE}/messages/${messageId}?format=full`, undefined, 'get');
      if (msgResponse.status === 401) return msgResponse;
      const msgData = await msgResponse.json();

      if (msgData.error) {
        const diagnosis = diagnoseGmailApiError(msgData.error.code || 400, { error: msgData.error }, 'get');
        console.error(`[GMAIL-API] get: ${diagnosis}`);
        return new Response(
          JSON.stringify({ error: msgData.error.message }),
          { status: msgData.error.code || 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ message: parseGmailMessage(msgData) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── GET THREAD ──────────────────────────────
    if (action === 'thread') {
      const threadId = url.searchParams.get('threadId');
      if (!threadId) {
        return new Response(
          JSON.stringify({ error: 'Missing thread id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { response: threadResponse } = await gmailFetch(`${GMAIL_API_BASE}/threads/${threadId}?format=full`, undefined, 'thread');
      if (threadResponse.status === 401) return threadResponse;
      const threadData = await threadResponse.json();

      if (threadData.error) {
        const diagnosis = diagnoseGmailApiError(threadData.error.code || 400, { error: threadData.error }, 'thread');
        console.error(`[GMAIL-API] thread: ${diagnosis}`);
        return new Response(
          JSON.stringify({ error: threadData.error.message }),
          { status: threadData.error.code || 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const messages = (threadData.messages || []).map(parseGmailMessage);

      return new Response(
        JSON.stringify({ threadId: threadData.id, messages }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── SEND EMAIL ──────────────────────────────
    if (action === 'send') {
      const body = await req.json();
      const { to, subject, body: emailBody, cc, bcc } = body;

      if (!to || !subject) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: to, subject' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const raw = createMimeMessage(to, subject, emailBody || '', cc, bcc);

      const { response: sendResponse } = await gmailFetch(`${GMAIL_API_BASE}/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      }, 'send');
      if (sendResponse.status === 401) return sendResponse;

      const sendData = await sendResponse.json();

      if (sendData.error) {
        const diagnosis = diagnoseGmailApiError(sendData.error.code || 400, { error: sendData.error }, 'send');
        console.error(`[GMAIL-API] send: ${diagnosis}`);
        return new Response(
          JSON.stringify({ error: sendData.error.message }),
          { status: sendData.error.code, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.info(`[GMAIL-API] send: Email sent successfully (id: ${sendData.id})`);

      // Log send
      await supabase.from('email_sync_log').insert({
        integration_id: integration.id,
        organization_id: integration.organization_id,
        sync_type: 'send',
        status: 'completed',
        messages_synced: 1,
        completed_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({ success: true, messageId: sendData.id, threadId: sendData.threadId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── MODIFY EMAIL ────────────────────────────
    if (action === 'modify') {
      const body = await req.json();
      const { messageId, addLabelIds, removeLabelIds } = body;

      if (!messageId) {
        return new Response(
          JSON.stringify({ error: 'Missing messageId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { response: modifyResponse } = await gmailFetch(
        `${GMAIL_API_BASE}/messages/${messageId}/modify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            addLabelIds: addLabelIds || [],
            removeLabelIds: removeLabelIds || [],
          }),
        },
        'modify',
      );
      if (modifyResponse.status === 401) return modifyResponse;

      const modifyData = await modifyResponse.json();

      if (modifyData.error) {
        const diagnosis = diagnoseGmailApiError(modifyData.error.code || 400, { error: modifyData.error }, 'modify');
        console.error(`[GMAIL-API] modify: ${diagnosis}`);
        return new Response(
          JSON.stringify({ error: modifyData.error.message }),
          { status: modifyData.error.code, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, labelIds: modifyData.labelIds }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── TRASH / UNTRASH ─────────────────────────
    if (action === 'trash' || action === 'untrash') {
      const body = await req.json();
      const { messageId } = body;

      const { response: trashResponse } = await gmailFetch(
        `${GMAIL_API_BASE}/messages/${messageId}/${action}`,
        { method: 'POST' },
        action,
      );
      if (trashResponse.status === 401) return trashResponse;

      if (!trashResponse.ok) {
        const errData = await trashResponse.json();
        const diagnosis = diagnoseGmailApiError(trashResponse.status, errData, action);
        console.error(`[GMAIL-API] ${action}: ${diagnosis}`);
        return new Response(
          JSON.stringify({ error: errData.error?.message || 'Failed' }),
          { status: trashResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action', validActions: ['list', 'get', 'thread', 'send', 'modify', 'trash', 'untrash', 'status', 'disconnect'] }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return safeErrorResponse('Internal server error', 500, corsHeaders, error);
  }
});
