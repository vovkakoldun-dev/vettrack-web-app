// supabase/functions/outlook-api/index.ts
// Proxies Microsoft Graph Mail API calls — list, get, send, modify emails
//
// Uses Microsoft Graph API v1.0
// Auto-refreshes expired tokens
//
// Endpoints (via ?action= query param):
//   GET  ?action=list              — List emails (inbox, sent, etc.)
//   GET  ?action=get&id=X          — Get single email with full body
//   GET  ?action=thread&threadId=X — Get conversation thread
//   POST ?action=send              — Send an email
//   POST ?action=modify            — Mark read/unread, flag/unflag
//   POST ?action=move              — Move to folder (archive, trash, etc.)
//   GET  ?action=status            — Check integration status
//   POST ?action=disconnect        — Disconnect integration

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { withTokenRetry } from '../_shared/token-refresh.ts';
import { getCorsHeaders, safeErrorResponse } from '../_shared/oauth-security.ts';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0/me';

// Parse Graph API message into normalized format
function parseGraphMessage(msg: any): any {
  const from = msg.from?.emailAddress || {};
  const toRecipients = (msg.toRecipients || []).map((r: any) => r.emailAddress);
  const ccRecipients = (msg.ccRecipients || []).map((r: any) => r.emailAddress);

  const attachments = (msg.attachments || []).map((a: any) => ({
    id: a.id,
    filename: a.name,
    mimeType: a.contentType,
    size: a.size || 0,
  }));

  return {
    id: msg.id,
    threadId: msg.conversationId,
    from: from.name ? `${from.name} <${from.address}>` : from.address || '',
    fromName: from.name || '',
    fromEmail: from.address || '',
    to: toRecipients.map((r: any) => r.name ? `${r.name} <${r.address}>` : r.address).join(', '),
    cc: ccRecipients.map((r: any) => r.name ? `${r.name} <${r.address}>` : r.address).join(', '),
    subject: msg.subject || '(No subject)',
    date: msg.receivedDateTime || msg.sentDateTime || '',
    snippet: msg.bodyPreview || '',
    body: msg.body?.content || '',
    bodyType: msg.body?.contentType || 'text', // 'html' or 'text'
    read: msg.isRead || false,
    starred: msg.flag?.flagStatus === 'flagged',
    labels: msg.categories || [],
    hasAttachment: msg.hasAttachments || false,
    attachments,
    importance: msg.importance || 'normal',
    parentFolderId: msg.parentFolderId || '',
    internalDate: msg.receivedDateTime || '',
  };
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'));

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // ─── STATUS ───────────────────────────────
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

    // ─── DISCONNECT ──────────────────────────
    if (action === 'disconnect') {
      const body = await req.json();
      await supabase
        .from('email_integrations')
        .update({ status: 'disconnected', access_token: null, refresh_token: null })
        .eq('user_id', user.id)
        .eq('provider', body.provider || 'outlook');

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get active Outlook integration
    const { data: integration } = await supabase
      .from('email_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'outlook')
      .eq('status', 'active')
      .single();

    if (!integration) {
      return new Response(
        JSON.stringify({ error: 'No active Outlook integration', code: 'NOT_CONNECTED' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Helper: make a Graph API call with automatic token refresh + retry on 401
    async function graphFetch(
      graphUrl: string,
      init?: RequestInit,
    ): Promise<{ response: Response; token: string }> {
      const { response, accessToken } = await withTokenRetry(
        supabase, integration!, 'microsoft',
        (token) => fetch(graphUrl, {
          ...init,
          headers: {
            ...init?.headers,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
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

    // ─── LIST EMAILS ─────────────────────────
    if (action === 'list') {
      const folder = url.searchParams.get('folder') || 'inbox';
      const top = url.searchParams.get('top') || '20';
      const skip = url.searchParams.get('skip') || '0';
      const search = url.searchParams.get('search') || '';
      const filter = url.searchParams.get('filter') || '';

      const folderMap: Record<string, string> = {
        inbox: 'inbox', sent: 'sentitems', drafts: 'drafts',
        trash: 'deleteditems', archive: 'archive', junk: 'junkemail',
      };
      const graphFolder = folderMap[folder] || folder;

      const endpoint = `${GRAPH_BASE}/mailFolders/${graphFolder}/messages`;
      const params = new URLSearchParams({
        '$top': top, '$skip': skip,
        '$orderby': 'receivedDateTime desc',
        '$select': 'id,conversationId,subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,isRead,hasAttachments,flag,importance,categories,parentFolderId',
      });
      if (search) params.set('$search', `"${search}"`);
      if (filter) params.set('$filter', filter);

      const { response: listResponse } = await graphFetch(`${endpoint}?${params}`);
      if (listResponse.status === 401) return listResponse;
      const listData = await listResponse.json();

      if (listData.error) {
        return new Response(
          JSON.stringify({ error: listData.error.message, code: listData.error.code }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const messages = (listData.value || []).map(parseGraphMessage);

      await supabase
        .from('email_integrations')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', integration.id);

      return new Response(
        JSON.stringify({
          messages,
          totalCount: listData['@odata.count'] || messages.length,
          nextLink: listData['@odata.nextLink'] || null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── GET SINGLE EMAIL ────────────────────
    if (action === 'get') {
      const messageId = url.searchParams.get('id');
      if (!messageId) {
        return new Response(
          JSON.stringify({ error: 'Missing message id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { response: msgResponse } = await graphFetch(`${GRAPH_BASE}/messages/${messageId}?$expand=attachments`);
      if (msgResponse.status === 401) return msgResponse;
      const msgData = await msgResponse.json();

      if (msgData.error) {
        return new Response(
          JSON.stringify({ error: msgData.error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ message: parseGraphMessage(msgData) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── GET THREAD / CONVERSATION ───────────
    if (action === 'thread') {
      const conversationId = url.searchParams.get('threadId');
      if (!conversationId) {
        return new Response(
          JSON.stringify({ error: 'Missing threadId (conversationId)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { response: threadResponse } = await graphFetch(
        `${GRAPH_BASE}/messages?$filter=conversationId eq '${conversationId}'&$orderby=receivedDateTime asc&$select=id,conversationId,subject,body,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,isRead,hasAttachments,flag,importance,categories`
      );
      if (threadResponse.status === 401) return threadResponse;
      const threadData = await threadResponse.json();

      if (threadData.error) {
        return new Response(
          JSON.stringify({ error: threadData.error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ threadId: conversationId, messages: (threadData.value || []).map(parseGraphMessage) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── SEND EMAIL ──────────────────────────
    if (action === 'send') {
      const body = await req.json();
      const { to, subject, body: emailBody, cc, bcc, bodyType } = body;

      if (!to || !subject) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: to, subject' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const toRecipients = to.split(',').map((email: string) => ({ emailAddress: { address: email.trim() } }));
      const ccRecipients = cc ? cc.split(',').map((email: string) => ({ emailAddress: { address: email.trim() } })) : [];
      const bccRecipients = bcc ? bcc.split(',').map((email: string) => ({ emailAddress: { address: email.trim() } })) : [];

      const sendPayload = {
        message: {
          subject,
          body: { contentType: bodyType || 'HTML', content: emailBody || '' },
          toRecipients,
          ...(ccRecipients.length > 0 ? { ccRecipients } : {}),
          ...(bccRecipients.length > 0 ? { bccRecipients } : {}),
        },
        saveToSentItems: true,
      };

      const { response: sendResponse } = await graphFetch(`${GRAPH_BASE}/sendMail`, {
        method: 'POST',
        body: JSON.stringify(sendPayload),
      });
      if (sendResponse.status === 401) return sendResponse;

      if (!sendResponse.ok) {
        const errData = await sendResponse.json();
        return new Response(
          JSON.stringify({ error: errData.error?.message || 'Send failed' }),
          { status: sendResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase.from('email_sync_log').insert({
        integration_id: integration.id,
        organization_id: integration.organization_id,
        sync_type: 'send', status: 'completed',
        messages_synced: 1, completed_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── MODIFY EMAIL ────────────────────────
    if (action === 'modify') {
      const body = await req.json();
      const { messageId, isRead, flag } = body;

      if (!messageId) {
        return new Response(
          JSON.stringify({ error: 'Missing messageId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const patchBody: Record<string, any> = {};
      if (typeof isRead === 'boolean') patchBody.isRead = isRead;
      if (flag) patchBody.flag = { flagStatus: flag };

      const { response: modifyResponse } = await graphFetch(`${GRAPH_BASE}/messages/${messageId}`, {
        method: 'PATCH',
        body: JSON.stringify(patchBody),
      });
      if (modifyResponse.status === 401) return modifyResponse;

      if (!modifyResponse.ok) {
        const errData = await modifyResponse.json();
        return new Response(
          JSON.stringify({ error: errData.error?.message || 'Modify failed' }),
          { status: modifyResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── MOVE EMAIL ──────────────────────────
    if (action === 'move') {
      const body = await req.json();
      const { messageId, destinationFolder } = body;

      if (!messageId || !destinationFolder) {
        return new Response(
          JSON.stringify({ error: 'Missing messageId or destinationFolder' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const folderMap: Record<string, string> = {
        inbox: 'inbox', archive: 'archive', trash: 'deleteditems', junk: 'junkemail', drafts: 'drafts',
      };

      const { response: moveResponse } = await graphFetch(`${GRAPH_BASE}/messages/${messageId}/move`, {
        method: 'POST',
        body: JSON.stringify({ destinationId: folderMap[destinationFolder] || destinationFolder }),
      });
      if (moveResponse.status === 401) return moveResponse;

      if (!moveResponse.ok) {
        const errData = await moveResponse.json();
        return new Response(
          JSON.stringify({ error: errData.error?.message || 'Move failed' }),
          { status: moveResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const moveData = await moveResponse.json();
      return new Response(
        JSON.stringify({ success: true, newMessageId: moveData.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        error: 'Unknown action',
        validActions: ['list', 'get', 'thread', 'send', 'modify', 'move', 'status', 'disconnect'],
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return safeErrorResponse('Internal server error', 500, corsHeaders, error);
  }
});
