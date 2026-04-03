// src/lib/outlook.ts
// Outlook / Microsoft Graph Mail API client
// Connects to Supabase Edge Functions for OAuth and email operations

import { supabase } from './supabase';

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

/**
 * Thrown when the backend returns REAUTH_REQUIRED or NOT_CONNECTED.
 * Callers should catch this to trigger the re-authentication flow.
 */
export class EmailAuthError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'EmailAuthError';
    this.code = code;
  }
}

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (data.code === 'REAUTH_REQUIRED' || data.code === 'NOT_CONNECTED') {
    throw new EmailAuthError(
      data.error || 'Outlook integration requires re-authentication',
      data.code,
    );
  }

  if (data.error && response.status >= 400) {
    throw new Error(data.error);
  }

  return data as T;
}

// ─── Types ──────────────────────────────────────────

export interface OutlookMessage {
  id: string;
  threadId: string; // conversationId in Graph API
  from: string;
  fromName: string;
  fromEmail: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
  bodyType: 'html' | 'text';
  read: boolean;
  starred: boolean; // flagged in Outlook
  labels: string[]; // categories in Outlook
  hasAttachment: boolean;
  attachments: {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
  }[];
  importance: 'low' | 'normal' | 'high';
  parentFolderId: string;
  internalDate: string;
}

export interface ListOutlookResponse {
  messages: OutlookMessage[];
  totalCount: number;
  nextLink: string | null;
}

export interface OutlookThread {
  threadId: string;
  messages: OutlookMessage[];
}

// ─── OAuth Flow ─────────────────────────────────────

/**
 * Initiates Outlook OAuth flow.
 * Returns the Microsoft authorization URL to redirect the user to.
 */
export async function initiateOutlookAuth(): Promise<{
  auth_url?: string;
  setup_instructions?: Record<string, string>;
  error?: string;
}> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE}/outlook-auth`, { headers });
  return handleResponse(response);
}

// ─── Email Operations ──────────────────────────────

/** List emails from a specific folder */
export async function listEmails(options?: {
  folder?: string;
  top?: number;
  skip?: number;
  search?: string;
  filter?: string;
}): Promise<ListOutlookResponse> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ action: 'list' });

  if (options?.folder) params.set('folder', options.folder);
  if (options?.top) params.set('top', String(options.top));
  if (options?.skip) params.set('skip', String(options.skip));
  if (options?.search) params.set('search', options.search);
  if (options?.filter) params.set('filter', options.filter);

  const response = await fetch(`${FUNCTIONS_BASE}/outlook-api?${params}`, { headers });
  return handleResponse<ListOutlookResponse>(response);
}

/** Get a single email with full body */
export async function getEmail(messageId: string): Promise<OutlookMessage> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${FUNCTIONS_BASE}/outlook-api?action=get&id=${encodeURIComponent(messageId)}`,
    { headers }
  );
  const data = await handleResponse<{ message: OutlookMessage }>(response);
  return data.message;
}

/** Get all messages in a conversation thread */
export async function getThread(conversationId: string): Promise<OutlookThread> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${FUNCTIONS_BASE}/outlook-api?action=thread&threadId=${encodeURIComponent(conversationId)}`,
    { headers }
  );
  return handleResponse<OutlookThread>(response);
}

/** Send an email */
export async function sendEmail(options: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  bodyType?: 'HTML' | 'Text';
}): Promise<{ success: boolean; error?: string }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE}/outlook-api?action=send`, {
    method: 'POST',
    headers,
    body: JSON.stringify(options),
  });
  return handleResponse(response);
}

/** Mark email as read */
export async function markAsRead(messageId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE}/outlook-api?action=modify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messageId, isRead: true }),
  });
  await handleResponse(response);
}

/** Mark email as unread */
export async function markAsUnread(messageId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE}/outlook-api?action=modify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messageId, isRead: false }),
  });
  await handleResponse(response);
}

/** Flag (star) an email */
export async function flagEmail(messageId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE}/outlook-api?action=modify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messageId, flag: 'flagged' }),
  });
  await handleResponse(response);
}

/** Unflag (unstar) an email */
export async function unflagEmail(messageId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE}/outlook-api?action=modify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messageId, flag: 'notFlagged' }),
  });
  await handleResponse(response);
}

/** Move email to archive */
export async function archiveEmail(messageId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE}/outlook-api?action=move`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messageId, destinationFolder: 'archive' }),
  });
  await handleResponse(response);
}

/** Move email to trash */
export async function trashEmail(messageId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE}/outlook-api?action=move`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messageId, destinationFolder: 'trash' }),
  });
  await handleResponse(response);
}

/** Move email back to inbox */
export async function moveToInbox(messageId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE}/outlook-api?action=move`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messageId, destinationFolder: 'inbox' }),
  });
  await handleResponse(response);
}

/** Disconnect Outlook integration */
export async function disconnectOutlook(): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE}/outlook-api?action=disconnect`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ provider: 'outlook' }),
  });
  await handleResponse(response);
}

// ─── Utility ───────────────────────────────────────

/** Parse "Name <email@example.com>" format */
export function parseEmailAddress(raw: string): { name: string; email: string } {
  const match = raw.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].replace(/"/g, '').trim(), email: match[2] };
  }
  return { name: raw, email: raw };
}

/** Format bytes to human readable */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
