// src/lib/gmail.ts
// Gmail API client — connects to Supabase Edge Functions for OAuth and email operations

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

/**
 * Checks a fetch response for auth-related error codes from the edge function.
 * Throws EmailAuthError if the user needs to re-authenticate.
 * Returns the parsed JSON otherwise.
 */
async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (data.code === 'REAUTH_REQUIRED' || data.code === 'NOT_CONNECTED') {
    throw new EmailAuthError(
      data.error || 'Gmail integration requires re-authentication',
      data.code,
    );
  }

  if (data.error && response.status >= 400) {
    throw new Error(data.error);
  }

  return data as T;
}

// ─── Types ──────────────────────────────────────────

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
  read: boolean;
  starred: boolean;
  labels: string[];
  hasAttachment: boolean;
  attachments: {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
  }[];
  internalDate: string;
}

export interface EmailIntegration {
  id: string;
  provider: 'gmail' | 'outlook' | 'yahoo';
  email_address: string;
  status: 'active' | 'disconnected' | 'error' | 'reauth_required';
  last_synced_at: string | null;
  created_at: string;
}

export interface ListEmailsResponse {
  messages: GmailMessage[];
  nextPageToken: string | null;
  resultSizeEstimate: number;
}

export interface ThreadResponse {
  threadId: string;
  messages: GmailMessage[];
}

export interface GmailLabel {
  id: string;
  name: string;
  type: 'system' | 'user';
  messagesTotal?: number;
  messagesUnread?: number;
  threadsTotal?: number;
  threadsUnread?: number;
  color?: { textColor: string; backgroundColor: string } | null;
}

// ─── OAuth Flow ─────────────────────────────────────

/**
 * Initiates Gmail OAuth flow.
 * Returns the Google authorization URL to redirect the user to.
 * If not configured, returns setup instructions.
 */
export async function initiateGmailAuth(): Promise<{
  auth_url?: string;
  setup_instructions?: Record<string, string>;
  error?: string;
}> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE}/gmail-auth`, { headers });
  return handleResponse(response);
}

// ─── Integration Status ────────────────────────────

/** Check which email integrations are connected */
export async function getIntegrationStatus(): Promise<EmailIntegration[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE}/gmail-api?action=status`, { headers });
  const data = await handleResponse<{ integrations: EmailIntegration[] }>(response);
  return data.integrations || [];
}

/** Disconnect an email integration */
export async function disconnectIntegration(provider: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE}/gmail-api?action=disconnect`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ provider }),
  });
  await handleResponse(response);
}

// ─── Labels ───────────────────────────────────────

/** Fetch all Gmail labels with unread counts */
export async function getLabels(): Promise<GmailLabel[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE}/gmail-api?action=labels`, { headers });
  const data = await handleResponse<{ labels: GmailLabel[] }>(response);
  return data.labels || [];
}

// ─── Email Operations ──────────────────────────────

/** List emails with optional filters */
export async function listEmails(options?: {
  labelIds?: string;
  maxResults?: number;
  pageToken?: string;
  query?: string;
}): Promise<ListEmailsResponse> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ action: 'list' });

  if (options?.labelIds) params.set('labelIds', options.labelIds);
  if (options?.maxResults) params.set('maxResults', String(options.maxResults));
  if (options?.pageToken) params.set('pageToken', options.pageToken);
  if (options?.query) params.set('q', options.query);

  const response = await fetch(`${FUNCTIONS_BASE}/gmail-api?${params}`, { headers });
  return handleResponse<ListEmailsResponse>(response);
}

/** Get a single email with full body */
export async function getEmail(messageId: string): Promise<GmailMessage> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${FUNCTIONS_BASE}/gmail-api?action=get&id=${messageId}`,
    { headers }
  );
  const data = await handleResponse<{ message: GmailMessage }>(response);
  return data.message;
}

/** Get all messages in a thread */
export async function getThread(threadId: string): Promise<ThreadResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${FUNCTIONS_BASE}/gmail-api?action=thread&threadId=${threadId}`,
    { headers }
  );
  return handleResponse<ThreadResponse>(response);
}

/** Send an email */
export async function sendEmail(options: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}): Promise<{ success: boolean; messageId?: string; threadId?: string; error?: string }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE}/gmail-api?action=send`, {
    method: 'POST',
    headers,
    body: JSON.stringify(options),
  });
  return handleResponse(response);
}

/** Mark email as read */
export async function markAsRead(messageId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE}/gmail-api?action=modify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messageId, removeLabelIds: ['UNREAD'] }),
  });
  await handleResponse(response);
}

/** Mark email as unread */
export async function markAsUnread(messageId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE}/gmail-api?action=modify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messageId, addLabelIds: ['UNREAD'] }),
  });
  await handleResponse(response);
}

/** Star an email */
export async function starEmail(messageId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE}/gmail-api?action=modify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messageId, addLabelIds: ['STARRED'] }),
  });
  await handleResponse(response);
}

/** Unstar an email */
export async function unstarEmail(messageId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE}/gmail-api?action=modify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messageId, removeLabelIds: ['STARRED'] }),
  });
  await handleResponse(response);
}

/** Archive an email (remove from INBOX) */
export async function archiveEmail(messageId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE}/gmail-api?action=modify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messageId, removeLabelIds: ['INBOX'] }),
  });
  await handleResponse(response);
}

/** Move email to trash */
export async function trashEmail(messageId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE}/gmail-api?action=trash`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messageId }),
  });
  await handleResponse(response);
}

/** Permanently delete an email */
export async function deleteEmail(messageId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE}/gmail-api?action=delete`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messageId }),
  });
  await handleResponse(response);
}

/** Restore email from trash */
export async function untrashEmail(messageId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE}/gmail-api?action=untrash`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messageId }),
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
