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

/** Decode base64 (URL-safe) to a proper UTF-8 string (handles emojis, etc.) */
function decodeBase64Utf8(data: string): string {
  const raw = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Encode a UTF-8 string to URL-safe base64 (handles emojis, etc.) */
function encodeBase64Utf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Recursively collect all leaf parts from a MIME tree */
function collectParts(part: any, result: any[] = []): any[] {
  if (!part) return result;
  if (part.parts && part.parts.length > 0) {
    for (const child of part.parts) {
      collectParts(child, result);
    }
  } else {
    result.push(part);
  }
  return result;
}

async function parseGmailMessage(msg: any, gmailToken?: string): Promise<any> {
  const headers = msg.payload?.headers || [];
  const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  // Recursively collect all leaf parts from the MIME tree
  const allParts = collectParts(msg.payload);

  // Find body: prefer HTML over plain text
  let body = '';
  if (msg.payload?.body?.data && !msg.payload?.parts) {
    body = decodeBase64Utf8(msg.payload.body.data);
  } else {
    const htmlPart = allParts.find((p: any) => p.mimeType === 'text/html' && p.body?.data);
    const textPart = allParts.find((p: any) => p.mimeType === 'text/plain' && p.body?.data);
    const bestPart = htmlPart || textPart;
    if (bestPart?.body?.data) {
      body = decodeBase64Utf8(bestPart.body.data);
    }
  }

  // Build a CID → data URL map for inline images
  const cidMap: Record<string, string> = {};
  const cidParts = allParts.filter((p: any) => {
    const contentIdHeader = (p.headers || []).find((h: any) => h.name.toLowerCase() === 'content-id');
    return contentIdHeader && p.mimeType?.startsWith('image/');
  });

  for (const p of cidParts) {
    const contentIdHeader = (p.headers || []).find((h: any) => h.name.toLowerCase() === 'content-id');
    const cid = contentIdHeader.value.replace(/^<|>$/g, '');

    if (p.body?.data) {
      // Image data is inline
      const b64 = p.body.data.replace(/-/g, '+').replace(/_/g, '/');
      cidMap[cid] = `data:${p.mimeType};base64,${b64}`;
    } else if (p.body?.attachmentId && gmailToken && msg.id) {
      // Image data needs to be fetched via attachments API
      try {
        const attResp = await fetch(
          `${GMAIL_API_BASE}/messages/${msg.id}/attachments/${p.body.attachmentId}`,
          { headers: { Authorization: `Bearer ${gmailToken}` } }
        );
        if (attResp.ok) {
          const attData = await attResp.json();
          if (attData.data) {
            const b64 = attData.data.replace(/-/g, '+').replace(/_/g, '/');
            cidMap[cid] = `data:${p.mimeType};base64,${b64}`;
          }
        }
      } catch {
        // Skip this inline image if fetch fails
      }
    }
  }

  // Replace cid: references in the HTML body with data URLs
  if (body && Object.keys(cidMap).length > 0) {
    for (const [cid, dataUrl] of Object.entries(cidMap)) {
      body = body.split(`cid:${cid}`).join(dataUrl);
    }
  }

  // Remove any remaining unresolved cid: image references (e.g. from quoted replies
  // where the original message's inline images aren't part of this message's MIME tree)
  if (body) {
    body = body.replace(/<img[^>]*src="cid:[^"]*"[^>]*>/gi, '');
  }

  // Collect real attachments — exclude inline CID images
  const attachments = allParts
    .filter((p: any) => {
      if (p.filename && p.filename.length > 0) {
        const contentId = (p.headers || []).find((h: any) => h.name.toLowerCase() === 'content-id');
        if (contentId) {
          const cid = contentId.value.replace(/^<|>$/g, '');
          if (cidMap[cid]) return false;
          // Also skip if disposition is inline
          const disposition = (p.headers || []).find((h: any) => h.name.toLowerCase() === 'content-disposition');
          if (disposition && disposition.value.toLowerCase().startsWith('inline')) return false;
        }
        return true;
      }
      return false;
    })
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
  // Extract inline base64 images from HTML body
  const inlineImages: { cid: string; mimeType: string; base64Data: string }[] = [];
  let processedBody = body;
  const imgRegex = /src="data:(image\/[^;]+);base64,([^"]+)"/g;
  let match;
  while ((match = imgRegex.exec(body)) !== null) {
    const cid = `img_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    inlineImages.push({ cid, mimeType: match[1], base64Data: match[2] });
    processedBody = processedBody.replace(match[0], `src="cid:${cid}"`);
  }

  const altBoundary = `boundary_alt_${crypto.randomUUID()}`;

  if (inlineImages.length === 0) {
    // Simple multipart/alternative (no images)
    const lines = [
      `To: ${to}`,
      ...(cc ? [`Cc: ${cc}`] : []),
      ...(bcc ? [`Bcc: ${bcc}`] : []),
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      '',
      `--${altBoundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      body.replace(/<[^>]*>/g, ''),
      '',
      `--${altBoundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      '',
      body,
      '',
      `--${altBoundary}--`,
    ];
    return encodeBase64Utf8(lines.join('\r\n'));
  }

  // multipart/related wrapping multipart/alternative + inline images
  const relBoundary = `boundary_rel_${crypto.randomUUID()}`;
  const lines = [
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    ...(bcc ? [`Bcc: ${bcc}`] : []),
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/related; boundary="${relBoundary}"`,
    '',
    `--${relBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    '',
    `--${altBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    processedBody.replace(/<[^>]*>/g, ''),
    '',
    `--${altBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    processedBody,
    '',
    `--${altBoundary}--`,
  ];

  // Add each inline image as a MIME part
  for (const img of inlineImages) {
    lines.push('');
    lines.push(`--${relBoundary}`);
    lines.push(`Content-Type: ${img.mimeType}`);
    lines.push('Content-Transfer-Encoding: base64');
    lines.push(`Content-ID: <${img.cid}>`);
    lines.push(`Content-Disposition: inline`);
    lines.push('');
    // Split base64 data into 76-char lines per MIME spec
    const b64 = img.base64Data;
    for (let i = 0; i < b64.length; i += 76) {
      lines.push(b64.slice(i, i + 76));
    }
  }

  lines.push('');
  lines.push(`--${relBoundary}--`);

  const raw = lines.join('\r\n');
  return encodeBase64Utf8(raw);
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
          return await parseGmailMessage(await r.json());
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
      const { response: r, token: getToken } = await gmailFetch(`${GMAIL_API_BASE}/messages/${messageId}?format=full`, undefined, 'get');
      if (r.status === 401) return r;
      const d = await r.json();
      if (d.error) return new Response(JSON.stringify({ error: d.error.message }), { status: d.error.code || 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const parsed = await parseGmailMessage(d, getToken);
      return new Response(JSON.stringify({ message: parsed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ─── THREAD ───
    if (action === 'thread') {
      const threadId = url.searchParams.get('threadId');
      if (!threadId) return new Response(JSON.stringify({ error: 'Missing threadId' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { response: r, token: threadToken } = await gmailFetch(`${GMAIL_API_BASE}/threads/${threadId}?format=full`, undefined, 'thread');
      if (r.status === 401) return r;
      const d = await r.json();
      if (d.error) return new Response(JSON.stringify({ error: d.error.message }), { status: d.error.code || 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const threadMessages = await Promise.all((d.messages || []).map((m: any) => parseGmailMessage(m, threadToken)));
      return new Response(JSON.stringify({ threadId: d.id, messages: threadMessages }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

    // ─── DELETE (permanent) ───
    if (action === 'delete') {
      const body = await req.json();
      if (!body.messageId) return new Response(JSON.stringify({ error: 'Missing messageId' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { response: r } = await gmailFetch(`${GMAIL_API_BASE}/messages/${body.messageId}`, { method: 'DELETE' }, 'delete');
      if (r.status === 401) return r;
      if (!r.ok && r.status !== 204) { const e = await r.json().catch(() => ({})); return new Response(JSON.stringify({ error: (e as any).error?.message || 'Failed to delete' }), { status: r.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ─── LABELS ───
    if (action === 'labels') {
      const { response: r } = await gmailFetch(`${GMAIL_API_BASE}/labels`, undefined, 'labels');
      if (r.status === 401) return r;
      const d = await r.json();
      if (d.error) return new Response(JSON.stringify({ error: d.error.message }), { status: d.error.code || 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // Fetch details for each label to get counts
      const labels = d.labels || [];
      const detailed = await Promise.all(
        labels.map(async (l: any) => {
          try {
            const { response: lr } = await gmailFetch(`${GMAIL_API_BASE}/labels/${l.id}`, undefined, 'label-detail');
            if (!lr.ok) return { id: l.id, name: l.name, type: l.type };
            const ld = await lr.json();
            return {
              id: ld.id,
              name: ld.name,
              type: ld.type,
              messagesTotal: ld.messagesTotal || 0,
              messagesUnread: ld.messagesUnread || 0,
              threadsTotal: ld.threadsTotal || 0,
              threadsUnread: ld.threadsUnread || 0,
              color: ld.color || null,
            };
          } catch { return { id: l.id, name: l.name, type: l.type }; }
        })
      );

      return new Response(JSON.stringify({ labels: detailed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[GMAIL-API] Error:', error);
    const corsHeaders = getCorsHeaders(req.headers.get('Origin'));
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
