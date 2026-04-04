import { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import {
  Mail, X, ExternalLink, Check, ArrowRight, Copy, ChevronLeft, Shield, Key, Link2,
  Inbox, Send, Star, Trash2, Archive, MailPlus, Search, Paperclip, MoreHorizontal,
  Reply, Forward, ChevronDown, Clock, Settings, Tag, FolderInput, BellOff,
  MailOpen, Bold, Italic, Underline, List, ListOrdered, Image, Link as LinkIcon,
  AlignLeft, Type, Users, ShoppingBag, Megaphone, RefreshCw, CheckSquare, Square,
  Minus, CornerUpLeft, CornerUpRight, ChevronUp, Maximize2, AlertTriangle, Loader2,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  initiateGmailAuth,
  getIntegrationStatus,
  disconnectIntegration,
  listEmails as gmailListEmails,
  getEmail as gmailGetEmail,
  sendEmail as gmailSendEmail,
  markAsRead as gmailMarkAsRead,
  markAsUnread as gmailMarkAsUnread,
  starEmail as gmailStarEmail,
  unstarEmail as gmailUnstarEmail,
  archiveEmail as gmailArchiveEmail,
  trashEmail as gmailTrashEmail,
  EmailAuthError,
  type GmailMessage,
} from '../../../lib/gmail';
import {
  initiateOutlookAuth,
  listEmails as outlookListEmails,
  getEmail as outlookGetEmail,
  sendEmail as outlookSendEmail,
  markAsRead as outlookMarkAsRead,
  markAsUnread as outlookMarkAsUnread,
  flagEmail as outlookFlagEmail,
  unflagEmail as outlookUnflagEmail,
  archiveEmail as outlookArchiveEmail,
  trashEmail as outlookTrashEmail,
  disconnectOutlook,
  type OutlookMessage,
} from '../../../lib/outlook';

// ─── Integration definitions ──────────────────────────────────

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  connected: boolean;
}

const iconWrap = (children: React.ReactNode) => (
  <div style={{
    width: 40, height: 40, borderRadius: 10,
    background: '#fff', border: '1px solid #e5e7eb',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  }}>
    {children}
  </div>
);

const GMAIL_ICON = iconWrap(
  <svg width="24" height="24" viewBox="7.086 -169.483 1277.149 1277.149" xmlns="http://www.w3.org/2000/svg">
    <path d="M1179.439 7.087c57.543 0 104.627 47.083 104.627 104.626v30.331l-145.36 103.833-494.873 340.894L148.96 242.419v688.676h-37.247c-57.543 0-104.627-47.082-104.627-104.625V111.742C7.086 54.198 54.17 7.115 111.713 7.115l532.12 394.525L1179.41 7.115l.029-.028z" fill="#e75a4d"/>
    <path fill="#e7e4d7" d="M148.96 242.419v688.676h989.774V245.877L643.833 586.771z"/>
    <path fill="#b8b7ae" d="M148.96 931.095l494.873-344.324-2.24-1.586L148.96 923.527z"/>
    <path fill="#b7b6ad" d="M1138.734 245.877l.283 685.218-495.184-344.324z"/>
    <path d="M1284.066 142.044l.17 684.51c-2.494 76.082-35.461 103.238-145.219 104.514l-.283-685.219 145.36-103.833-.028.028z" fill="#b2392f"/>
    <path fill="#f7f5ed" d="M111.713 7.087l532.12 394.525L1179.439 7.087z"/>
  </svg>
);

const OUTLOOK_ICON = iconWrap(
  <svg width="24" height="24" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <path d="M512,267.91c0.03-4-2.04-7.73-5.45-9.82h-0.06l-0.21-0.12L328.86,152.95c-0.77-0.52-1.56-0.99-2.38-1.42c-6.85-3.53-14.99-3.53-21.84,0c-0.82,0.43-1.62,0.9-2.38,1.42L124.84,257.96l-0.21,0.12c-5.42,3.37-7.08,10.5-3.71,15.92c0.99,1.6,2.36,2.93,3.99,3.88L302.32,382.9c0.77,0.51,1.56,0.99,2.38,1.42c6.85,3.53,14.99,3.53,21.84,0c0.82-0.43,1.61-0.9,2.38-1.42l177.41-105.02C509.88,275.82,512.04,272.01,512,267.91z" fill="#0A2767"/>
    <path d="M145.53,197.79h116.43v106.72H145.53V197.79z M488.19,89.3V40.48c0.28-12.21-9.38-22.33-21.59-22.62H164.47c-12.21,0.29-21.87,10.42-21.59,22.62V89.3l178.6,47.63L488.19,89.3z" fill="#0364B8"/>
    <path d="M142.88,89.3h119.07v107.16H142.88V89.3z" fill="#0078D4"/>
    <path d="M381.02,89.3H261.95v107.16l119.07,107.16h107.16V196.47L381.02,89.3z" fill="#28A8EA"/>
    <path d="M261.95,196.47h119.07v107.16H261.95V196.47z" fill="#0078D4"/>
    <path d="M261.95,303.63h119.07v107.16H261.95V303.63z" fill="#0364B8"/>
    <path d="M145.53,304.51h116.43v97.02H145.53V304.51z" fill="#14447D"/>
    <path d="M381.02,303.63h107.16v107.16H381.02V303.63z" fill="#0078D4"/>
    <path d="M506.55,277.23l-0.23,0.13l-177.41,99.78c-0.77,0.48-1.56,0.93-2.38,1.33c-6.89,3.37-14.95,3.37-21.84,0c-0.82-0.4-1.61-0.85-2.38-1.33l-177.41-99.78l-0.21-0.13c-3.43-1.86-5.57-5.43-5.61-9.32V469.9c0.09,13.47,11.08,24.33,24.55,24.24h343.83c13.47,0.09,24.47-10.77,24.55-24.24V267.91C512,271.77,509.91,275.33,506.55,277.23z" fill="#1490DF"/>
    <defs><linearGradient id="outlook_g" gradientUnits="userSpaceOnUse" x1="45.5" y1="108" x2="216.4" y2="404"><stop offset="0" stopColor="#1784D9"/><stop offset=".5" stopColor="#107AD5"/><stop offset="1" stopColor="#0A63C9"/></linearGradient></defs>
    <rect x="0" y="125.02" width="261.95" height="261.95" rx="21.83" fill="url(#outlook_g)"/>
    <path d="M68.22,216.56c5.38-11.46,14.06-21.05,24.93-27.54c12.04-6.89,25.75-10.33,39.61-9.93c12.85-0.28,25.53,2.98,36.66,9.42c10.46,6.24,18.89,15.38,24.25,26.31c5.85,12.05,8.76,25.31,8.5,38.7c0.28,13.99-2.71,27.86-8.75,40.48c-5.49,11.33-14.19,20.79-25,27.23c-11.56,6.64-24.71,9.98-38.03,9.67c-13.13,0.32-26.09-2.98-37.47-9.53c-10.55-6.25-19.08-15.4-24.58-26.36c-5.88-11.87-8.83-24.99-8.6-38.23C59.5,242.91,62.4,229.16,68.22,216.56z M94.79,281.22c2.87,7.25,7.73,13.53,14.03,18.12c6.41,4.48,14.09,6.79,21.91,6.6c8.33,0.33,16.54-2.06,23.39-6.81c6.22-4.58,10.95-10.88,13.62-18.12c2.99-8.09,4.46-16.66,4.35-25.28c0.09-8.7-1.29-17.36-4.1-25.6c-2.48-7.44-7.06-14-13.19-18.88c-6.68-4.97-14.86-7.5-23.18-7.14c-7.99-0.21-15.84,2.12-22.42,6.66c-6.4,4.61-11.36,10.95-14.29,18.28c-6.5,16.79-6.54,35.4-0.1,52.21L94.79,281.22z" fill="#FFFFFF"/>
    <path d="M381.02,89.3h107.16v107.16H381.02V89.3z" fill="#50D9FF"/>
  </svg>
);

const YAHOO_ICON = iconWrap(
  <svg width="24" height="24" viewBox="0 0 3386.34 3010.5" xmlns="http://www.w3.org/2000/svg">
    <path d="M0 732.88h645.84l376.07 962.1 380.96-962.1h628.76l-946.8 2277.62H451.98l259.19-603.53L.02 732.88zm2763.84 768.75h-704.26L2684.65 0l701.69.03-622.5 1501.6zm-519.78 143.72c216.09 0 391.25 175.17 391.25 391.22 0 216.06-175.16 391.23-391.25 391.23-216.06 0-391.19-175.17-391.19-391.23 0-216.05 175.16-391.22 391.19-391.22z" fill="#5f01d1" fillRule="nonzero"/>
  </svg>
);

// ─── Categories / Labels ─────────────────────────────────────

type EmailCategory = 'primary' | 'social' | 'promotions';
type EmailLabel = 'work' | 'personal' | 'important' | 'finance' | 'clients' | 'lab-results';

const CATEGORIES: { id: EmailCategory; label: string; icon: typeof Inbox; color: string }[] = [
  { id: 'primary', label: 'Primary', icon: Inbox, color: '#2D6A4F' },
  { id: 'social', label: 'Social', icon: Users, color: '#4A90D9' },
  { id: 'promotions', label: 'Promotions', icon: Megaphone, color: '#E67E22' },
];

const LABELS: { id: EmailLabel; label: string; color: string }[] = [
  { id: 'work', label: 'Work', color: '#4A90D9' },
  { id: 'personal', label: 'Personal', color: '#27AE60' },
  { id: 'important', label: 'Important', color: '#E74C3C' },
  { id: 'finance', label: 'Finance', color: '#F39C12' },
  { id: 'clients', label: 'Clients', color: '#8E44AD' },
  { id: 'lab-results', label: 'Lab Results', color: '#1ABC9C' },
];

// ─── Unified Email type (normalized from Gmail/Outlook API) ──

interface UnifiedEmail {
  id: string;
  threadId: string;
  from: string;
  fromEmail: string;
  to: string;
  subject: string;
  preview: string;
  body: string;
  date: string;
  time: string;
  read: boolean;
  starred: boolean;
  hasAttachment: boolean;
  attachments: { id?: string; filename: string; mimeType?: string; size?: number }[];
  folder: string;
  category: EmailCategory;
  labels: string[];
  snoozed: boolean;
  thread: { id: string; from: string; fromEmail: string; body: string; date: string; time: string }[];
}

function parseFrom(raw: string): { name: string; email: string } {
  const match = raw?.match(/^(.+?)\s*<(.+?)>$/);
  if (match) return { name: match[1].replace(/"/g, '').trim(), email: match[2] };
  return { name: raw || 'Unknown', email: raw || '' };
}

function formatEmailDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso || '';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatEmailTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function gmailCategoryFromLabels(labels: string[]): EmailCategory {
  if (labels?.includes('CATEGORY_SOCIAL')) return 'social';
  if (labels?.includes('CATEGORY_PROMOTIONS')) return 'promotions';
  return 'primary';
}

const GMAIL_SYSTEM_LABELS = new Set([
  'INBOX', 'UNREAD', 'STARRED', 'SENT', 'DRAFT', 'TRASH', 'SPAM', 'IMPORTANT',
  'CATEGORY_PERSONAL', 'CATEGORY_SOCIAL', 'CATEGORY_PROMOTIONS', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS',
]);

function normalizeGmailMessage(msg: GmailMessage): UnifiedEmail {
  const parsed = parseFrom(msg.from);
  const dateStr = msg.date || msg.internalDate;
  return {
    id: msg.id,
    threadId: msg.threadId,
    from: parsed.name,
    fromEmail: parsed.email,
    to: msg.to || '',
    subject: msg.subject || '(no subject)',
    preview: msg.snippet || '',
    body: msg.body || '',
    date: formatEmailDate(dateStr),
    time: formatEmailTime(dateStr),
    read: msg.read,
    starred: msg.starred,
    hasAttachment: msg.hasAttachment,
    attachments: msg.attachments || [],
    folder: msg.labels?.includes('TRASH') ? 'trash' : msg.labels?.includes('SENT') ? 'sent' : 'inbox',
    category: gmailCategoryFromLabels(msg.labels),
    labels: (msg.labels || []).filter(l => !GMAIL_SYSTEM_LABELS.has(l)),
    snoozed: false,
    thread: [],
  };
}

function normalizeOutlookMessage(msg: OutlookMessage): UnifiedEmail {
  const dateStr = msg.date || msg.internalDate;
  return {
    id: msg.id,
    threadId: msg.threadId,
    from: msg.fromName || parseFrom(msg.from).name,
    fromEmail: msg.fromEmail || parseFrom(msg.from).email,
    to: msg.to || '',
    subject: msg.subject || '(no subject)',
    preview: msg.snippet || '',
    body: msg.body || '',
    date: formatEmailDate(dateStr),
    time: formatEmailTime(dateStr),
    read: msg.read,
    starred: msg.starred,
    hasAttachment: msg.hasAttachment,
    attachments: msg.attachments || [],
    folder: 'inbox',
    category: 'primary',
    labels: msg.labels || [],
    snoozed: false,
    thread: [],
  };
}

const SIDEBAR_ITEMS = [
  { icon: Inbox, label: 'Inbox', id: 'inbox' },
  { icon: Star, label: 'Starred', id: 'starred' },
  { icon: Clock, label: 'Snoozed', id: 'snoozed' },
  { icon: Send, label: 'Sent', id: 'sent' },
  { icon: Archive, label: 'Archive', id: 'archive' },
  { icon: Trash2, label: 'Trash', id: 'trash' },
];

// ─── Email Inbox View (Enhanced) ─────────────────────────────

function EmailInboxView({ connectedIds, integrations, onManageIntegrations, activeProvider }: {
  connectedIds: Set<string>;
  integrations: Integration[];
  onManageIntegrations: () => void;
  activeProvider: 'gmail' | 'outlook' | null;
}) {
  const [emails, setEmails] = useState<UnifiedEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<UnifiedEmail | null>(null);
  const [activeFolder, setActiveFolder] = useState('inbox');
  const [activeCategory, setActiveCategory] = useState<EmailCategory>('primary');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCompose, setShowCompose] = useState(false);
  const [composeExpanded, setComposeExpanded] = useState(false);
  const [showLabelMenu, setShowLabelMenu] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);

  // Compose state
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const composeRef = useRef<HTMLDivElement>(null);
  const savedSelection = useRef<Range | null>(null);

  // ── Fetch real emails from API ��─
  const fetchEmails = useCallback(async () => {
    if (!activeProvider) return;
    setLoading(true);
    setLoadError(null);
    setNeedsReauth(false);
    try {
      // Map active folder to Gmail label and/or search query
      let labelIds: string | undefined;
      let query = searchQuery || '';

      switch (activeFolder) {
        case 'inbox': labelIds = 'INBOX'; break;
        case 'starred': labelIds = 'STARRED'; break;
        case 'sent': labelIds = 'SENT'; break;
        case 'trash': labelIds = 'TRASH'; break;
        case 'snoozed': labelIds = 'INBOX'; query = query ? `is:snoozed ${query}` : 'is:snoozed'; break;
        default: labelIds = 'INBOX';
      }

      if (activeProvider === 'gmail') {
        const result = await gmailListEmails({
          labelIds,
          maxResults: 50,
          query: query || undefined,
        });
        setEmails(result.messages.map(normalizeGmailMessage));
      } else {
        const result = await outlookListEmails({
          top: 50,
          search: searchQuery || undefined,
        });
        setEmails(result.messages.map(normalizeOutlookMessage));
      }
    } catch (err) {
      if (err instanceof EmailAuthError) {
        setNeedsReauth(true);
        setLoadError('Your email connection has expired. Please reconnect.');
      } else if (err instanceof TypeError && err.message === 'Failed to fetch') {
        setLoadError('Could not reach the email service. Please check that the backend is deployed and try again.');
      } else {
        setLoadError(err instanceof Error ? err.message : 'Failed to load emails');
      }
    } finally {
      setLoading(false);
    }
  }, [activeProvider, activeFolder, searchQuery]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelection.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    const sel = window.getSelection();
    if (sel && savedSelection.current) {
      sel.removeAllRanges();
      sel.addRange(savedSelection.current);
    }
  };

  const execFormat = (command: string, value?: string) => {
    restoreSelection();
    composeRef.current?.focus();
    document.execCommand(command, false, value);
    saveSelection();
  };

  const execFormatWithPrompt = (command: string, promptMsg: string) => {
    saveSelection();
    const value = prompt(promptMsg);
    if (value) {
      composeRef.current?.focus();
      restoreSelection();
      document.execCommand(command, false, value);
      saveSelection();
    }
  };

  const connectedProvider = integrations.find(i => connectedIds.has(i.id));

  const filteredEmails = emails.filter(e => {
    // For non-inbox folders, emails are already fetched with the right labelIds — just show all
    if (activeFolder === 'starred' || activeFolder === 'sent' || activeFolder === 'trash' || activeFolder === 'snoozed') {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return e.from.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q) || e.preview.toLowerCase().includes(q);
      }
      return true;
    }
    // Inbox: filter by category
    if (e.category !== activeCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return e.from.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q) || e.preview.toLowerCase().includes(q);
    }
    return true;
  });

  const unreadCount = emails.filter(e => !e.read && e.folder === 'inbox' && e.category === 'primary').length;
  const socialCount = emails.filter(e => !e.read && e.folder === 'inbox' && e.category === 'social').length;
  const promoCount = emails.filter(e => !e.read && e.folder === 'inbox' && e.category === 'promotions').length;

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredEmails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEmails.map(e => e.id)));
    }
  };

  // Actions — call real API then update local state optimistically
  const toggleRead = useCallback(async (ids: Set<string>) => {
    for (const id of ids) {
      const email = emails.find(e => e.id === id);
      if (!email) continue;
      try {
        if (activeProvider === 'gmail') {
          email.read ? await gmailMarkAsUnread(id) : await gmailMarkAsRead(id);
        } else if (activeProvider === 'outlook') {
          email.read ? await outlookMarkAsUnread(id) : await outlookMarkAsRead(id);
        }
      } catch (err) {
        console.error('Failed to toggle read:', err);
      }
    }
    setEmails(prev => prev.map(e => ids.has(e.id) ? { ...e, read: !e.read } : e));
    setSelectedIds(new Set());
  }, [emails, activeProvider]);

  const toggleStar = useCallback(async (id: string) => {
    const email = emails.find(e => e.id === id);
    if (!email) return;
    // Optimistic update
    setEmails(prev => prev.map(e => e.id === id ? { ...e, starred: !e.starred } : e));
    try {
      if (activeProvider === 'gmail') {
        email.starred ? await gmailUnstarEmail(id) : await gmailStarEmail(id);
      } else if (activeProvider === 'outlook') {
        email.starred ? await outlookUnflagEmail(id) : await outlookFlagEmail(id);
      }
    } catch (err) {
      // Revert on failure
      setEmails(prev => prev.map(e => e.id === id ? { ...e, starred: !e.starred } : e));
      console.error('Failed to toggle star:', err);
    }
  }, [emails, activeProvider]);

  const snoozeEmails = useCallback((ids: Set<string>) => {
    // Snooze is not supported via API — hide locally for now
    setEmails(prev => prev.map(e => ids.has(e.id) ? { ...e, snoozed: true } : e));
    setSelectedIds(new Set());
  }, []);

  const moveToTrash = useCallback(async (ids: Set<string>) => {
    setEmails(prev => prev.map(e => ids.has(e.id) ? { ...e, folder: 'trash' } : e));
    setSelectedIds(new Set());
    setSelectedEmail(null);
    for (const id of ids) {
      try {
        if (activeProvider === 'gmail') {
          await gmailTrashEmail(id);
        } else if (activeProvider === 'outlook') {
          await outlookTrashEmail(id);
        }
      } catch (err) {
        console.error('Failed to trash email:', err);
      }
    }
  }, [activeProvider]);

  const archiveEmails = useCallback(async (ids: Set<string>) => {
    setEmails(prev => prev.map(e => ids.has(e.id) ? { ...e, folder: 'archive' } : e));
    setSelectedIds(new Set());
    setSelectedEmail(null);
    for (const id of ids) {
      try {
        if (activeProvider === 'gmail') {
          await gmailArchiveEmail(id);
        } else if (activeProvider === 'outlook') {
          await outlookArchiveEmail(id);
        }
      } catch (err) {
        console.error('Failed to archive email:', err);
      }
    }
  }, [activeProvider]);

  const addLabel = useCallback((ids: Set<string>, label: EmailLabel) => {
    setEmails(prev => prev.map(e => ids.has(e.id) && !e.labels.includes(label) ? { ...e, labels: [...e.labels, label] } : e));
    setShowLabelMenu(false);
  }, []);

  const toggleThread = (id: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelectEmail = async (email: UnifiedEmail) => {
    // Show immediately with what we have, then fetch full body
    setSelectedEmail(email);
    if (!email.read) {
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, read: true } : e));
      try {
        if (activeProvider === 'gmail') await gmailMarkAsRead(email.id);
        else if (activeProvider === 'outlook') await outlookMarkAsRead(email.id);
      } catch (err) {
        console.error('Failed to mark as read:', err);
      }
    }
    // Fetch full email body (list only returns metadata/snippet)
    try {
      if (activeProvider === 'gmail') {
        const full = await gmailGetEmail(email.id);
        const fullEmail = normalizeGmailMessage(full);
        fullEmail.read = true; // already marked
        setSelectedEmail(fullEmail);
        setEmails(prev => prev.map(e => e.id === email.id ? fullEmail : e));
      } else if (activeProvider === 'outlook') {
        const full = await outlookGetEmail(email.id);
        const fullEmail = normalizeOutlookMessage(full);
        fullEmail.read = true;
        setSelectedEmail(fullEmail);
        setEmails(prev => prev.map(e => e.id === email.id ? fullEmail : e));
      }
    } catch (err) {
      console.error('Failed to fetch full email:', err);
    }
  };

  const toolbarBtn = (props: { onClick?: () => void; title: string; children: React.ReactNode; active?: boolean; disabled?: boolean }) => (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={props.onClick}
      title={props.title}
      disabled={props.disabled}
      style={{
        background: props.active ? 'var(--surface-elevated)' : 'none',
        border: 'none', cursor: props.disabled ? 'default' : 'pointer',
        color: props.disabled ? 'var(--text-secondary)' : 'var(--text-secondary)',
        opacity: props.disabled ? 0.4 : 1,
        padding: 6, borderRadius: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => { if (!props.disabled) e.currentTarget.style.background = 'var(--surface-elevated)'; }}
      onMouseLeave={(e) => { if (!props.active) e.currentTarget.style.background = 'none'; }}
    >
      {props.children}
    </button>
  );

  return (
    <div style={{
      display: 'flex',
      background: 'var(--surface-white)',
      border: '1px solid var(--border-color)',
      borderRadius: 16,
      overflow: 'hidden',
      height: 'calc(100vh - 200px)',
      minHeight: 560,
    }}>
      {/* ── Sidebar ── */}
      <div style={{
        width: 200, flexShrink: 0,
        borderRight: '1px solid var(--border-color)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: 14 }}>
          <Button
            onClick={() => setShowCompose(true)}
            style={{
              width: '100%', gap: 8, fontSize: 13, fontWeight: 600,
              borderRadius: 10, padding: '10px 16px',
              background: 'var(--brand-green-text)', color: 'var(--on-brand-green)',
            }}
          >
            <MailPlus style={{ width: 16, height: 16 }} />
            Compose
          </Button>
        </div>

        <div style={{ flex: 1, padding: '0 8px', overflowY: 'auto' }}>
          {SIDEBAR_ITEMS.map(item => {
            const count = item.id === 'inbox' ? unreadCount : item.id === 'snoozed' ? emails.filter(e => e.snoozed).length : 0;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveFolder(item.id); setSelectedEmail(null); setSelectedIds(new Set()); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 8, border: 'none',
                  background: activeFolder === item.id ? 'var(--surface-elevated)' : 'transparent',
                  color: activeFolder === item.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 13, fontWeight: activeFolder === item.id ? 600 : 400,
                  marginBottom: 2, textAlign: 'left',
                }}
              >
                <item.icon style={{ width: 16, height: 16 }} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {count > 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: 'var(--brand-green-text)',
                    background: 'rgba(45,106,79,0.1)', padding: '1px 7px', borderRadius: 9999,
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}

          {/* Labels section */}
          <div style={{ padding: '16px 12px 6px', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Labels
          </div>
          {LABELS.map(label => (
            <button
              key={label.id}
              onClick={() => {}}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 12px', borderRadius: 8, border: 'none',
                background: 'transparent', color: 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 12, textAlign: 'left',
              }}
            >
              <div style={{ width: 10, height: 10, borderRadius: 3, background: label.color, flexShrink: 0 }} />
              <span>{label.label}</span>
            </button>
          ))}
        </div>

        {/* Connected account badge */}
        <div style={{ padding: 10, borderTop: '1px solid var(--border-color)' }}>
          <button
            onClick={onManageIntegrations}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)',
              background: 'var(--surface-elevated)', cursor: 'pointer',
            }}
          >
            {connectedProvider && <div style={{ width: 24, height: 24, flexShrink: 0, overflow: 'hidden', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ transform: 'scale(0.6)', transformOrigin: 'center center' }}>{connectedProvider.icon}</div></div>}
            <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {connectedProvider?.name || 'Email'}
              </p>
              <p style={{ fontSize: 10, color: 'var(--brand-green-text)' }}>Connected</p>
            </div>
            <Settings style={{ width: 14, height: 14, color: 'var(--text-secondary)', flexShrink: 0 }} />
          </button>
        </div>
      </div>

      {/* ── Email List ── */}
      <div style={{
        flex: 1,
        display: selectedEmail ? 'none' : 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Search + toolbar */}
        <div style={{ borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search style={{ width: 16, height: 16, color: 'var(--text-secondary)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1, border: 'none', outline: 'none', fontSize: 13,
                background: 'transparent', color: 'var(--text-primary)',
              }}
            />
            {toolbarBtn({ onClick: () => fetchEmails(), title: 'Refresh', children: <RefreshCw style={{ width: 15, height: 15, ...(loading ? { animation: 'spin 0.8s linear infinite' } : {}) }} /> })}
          </div>

          {/* Bulk actions toolbar */}
          <div style={{
            padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4,
            borderTop: '1px solid var(--border-color)',
          }}>
            {/* Select all checkbox */}
            <button
              onClick={selectAll}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, borderRadius: 4, display: 'flex' }}
              title="Select all"
            >
              {selectedIds.size === filteredEmails.length && filteredEmails.length > 0
                ? <CheckSquare style={{ width: 16, height: 16, color: 'var(--brand-green-text)' }} />
                : selectedIds.size > 0
                ? <Minus style={{ width: 16, height: 16 }} />
                : <Square style={{ width: 16, height: 16 }} />
              }
            </button>

            <div style={{ width: 1, height: 18, background: 'var(--border-color)', margin: '0 4px' }} />

            {toolbarBtn({ onClick: () => archiveEmails(selectedIds), title: 'Archive', disabled: selectedIds.size === 0, children: <Archive style={{ width: 15, height: 15 }} /> })}
            {toolbarBtn({ onClick: () => moveToTrash(selectedIds), title: 'Delete', disabled: selectedIds.size === 0, children: <Trash2 style={{ width: 15, height: 15 }} /> })}
            {toolbarBtn({ onClick: () => toggleRead(selectedIds), title: 'Mark read/unread', disabled: selectedIds.size === 0, children: <MailOpen style={{ width: 15, height: 15 }} /> })}
            {toolbarBtn({ onClick: () => snoozeEmails(selectedIds), title: 'Snooze', disabled: selectedIds.size === 0, children: <BellOff style={{ width: 15, height: 15 }} /> })}

            {/* Label dropdown */}
            <div style={{ position: 'relative' }}>
              {toolbarBtn({ onClick: () => { if (selectedIds.size > 0) setShowLabelMenu(!showLabelMenu); }, title: 'Label', disabled: selectedIds.size === 0, children: <Tag style={{ width: 15, height: 15 }} /> })}
              {showLabelMenu && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, zIndex: 50,
                  background: 'var(--surface-white)', border: '1px solid var(--border-color)',
                  borderRadius: 10, padding: 6, minWidth: 160,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', padding: '4px 10px', textTransform: 'uppercase' }}>Apply label</p>
                  {LABELS.map(label => (
                    <button
                      key={label.id}
                      onClick={() => addLabel(selectedIds, label.id)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 10px', border: 'none', borderRadius: 6,
                        background: 'transparent', cursor: 'pointer',
                        fontSize: 12, color: 'var(--text-primary)', textAlign: 'left',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-elevated)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: label.color }} />
                      {label.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Move dropdown */}
            <div style={{ position: 'relative' }}>
              {toolbarBtn({ onClick: () => { if (selectedIds.size > 0) setShowMoveMenu(!showMoveMenu); }, title: 'Move to', disabled: selectedIds.size === 0, children: <FolderInput style={{ width: 15, height: 15 }} /> })}
              {showMoveMenu && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, zIndex: 50,
                  background: 'var(--surface-white)', border: '1px solid var(--border-color)',
                  borderRadius: 10, padding: 6, minWidth: 140,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', padding: '4px 10px', textTransform: 'uppercase' }}>Move to</p>
                  {['inbox', 'archive', 'trash'].map(folder => (
                    <button
                      key={folder}
                      onClick={() => {
                        if (folder === 'trash') {
                          moveToTrash(selectedIds);
                        } else if (folder === 'archive') {
                          archiveEmails(selectedIds);
                        } else {
                          // Move back to inbox — just update locally (untrash not yet wired)
                          setEmails(prev => prev.map(e => selectedIds.has(e.id) ? { ...e, folder } : e));
                          setSelectedIds(new Set());
                        }
                        setShowMoveMenu(false);
                      }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 10px', border: 'none', borderRadius: 6,
                        background: 'transparent', cursor: 'pointer',
                        fontSize: 12, color: 'var(--text-primary)', textAlign: 'left',
                        textTransform: 'capitalize',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-elevated)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {folder === 'inbox' ? <Inbox style={{ width: 14, height: 14 }} /> : folder === 'archive' ? <Archive style={{ width: 14, height: 14 }} /> : <Trash2 style={{ width: 14, height: 14 }} />}
                      {folder}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedIds.size > 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8 }}>
                {selectedIds.size} selected
              </span>
            )}
          </div>

          {/* Category tabs (only when in inbox) */}
          {activeFolder === 'inbox' && (
            <div style={{ display: 'flex', borderTop: '1px solid var(--border-color)' }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => { setActiveCategory(cat.id); setSelectedEmail(null); setSelectedIds(new Set()); }}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '10px 12px', border: 'none',
                    borderBottom: activeCategory === cat.id ? `2px solid ${cat.color}` : '2px solid transparent',
                    background: 'transparent',
                    color: activeCategory === cat.id ? cat.color : 'var(--text-secondary)',
                    cursor: 'pointer', fontSize: 12, fontWeight: activeCategory === cat.id ? 600 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  <cat.icon style={{ width: 14, height: 14 }} />
                  {cat.label}
                  {cat.id === 'primary' && unreadCount > 0 && <span style={{ fontSize: 10, background: `${cat.color}20`, color: cat.color, padding: '1px 5px', borderRadius: 9999, fontWeight: 600 }}>{unreadCount}</span>}
                  {cat.id === 'social' && socialCount > 0 && <span style={{ fontSize: 10, background: `${cat.color}20`, color: cat.color, padding: '1px 5px', borderRadius: 9999, fontWeight: 600 }}>{socialCount}</span>}
                  {cat.id === 'promotions' && promoCount > 0 && <span style={{ fontSize: 10, background: `${cat.color}20`, color: cat.color, padding: '1px 5px', borderRadius: 9999, fontWeight: 600 }}>{promoCount}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Email list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Loading state */}
          {loading && emails.length === 0 && (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <Loader2 style={{ width: 28, height: 28, color: 'var(--text-secondary)', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>Loading emails...</p>
            </div>
          )}

          {/* Error state */}
          {loadError && !loading && (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <AlertTriangle style={{ width: 28, height: 28, color: '#EF4444', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
                {needsReauth ? 'Connection Expired' : 'Failed to Load Emails'}
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, maxWidth: 360, margin: '0 auto 16px' }}>{loadError}</p>
              <Button
                onClick={needsReauth ? onManageIntegrations : () => fetchEmails()}
                variant="outline"
                style={{ fontSize: 13, borderRadius: 8 }}
              >
                {needsReauth ? 'Reconnect' : 'Try Again'}
              </Button>
            </div>
          )}

          {/* Email list */}
          {!loading && !loadError && filteredEmails.map(email => (
            <div
              key={email.id}
              style={{
                display: 'flex', alignItems: 'flex-start',
                borderBottom: '1px solid var(--border-color)',
                background: selectedEmail?.id === email.id
                  ? 'var(--surface-elevated)'
                  : !email.read ? 'rgba(45, 106, 79, 0.03)' : 'transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { if (selectedEmail?.id !== email.id) e.currentTarget.style.background = 'var(--surface-elevated)'; }}
              onMouseLeave={(e) => { if (selectedEmail?.id !== email.id) e.currentTarget.style.background = !email.read ? 'rgba(45, 106, 79, 0.03)' : 'transparent'; }}
            >
              {/* Checkbox */}
              <div style={{ padding: '14px 0 14px 12px', display: 'flex', alignItems: 'flex-start', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSelect(email.id); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 2 }}
                >
                  {selectedIds.has(email.id)
                    ? <CheckSquare style={{ width: 15, height: 15, color: 'var(--brand-green-text)' }} />
                    : <Square style={{ width: 15, height: 15 }} />
                  }
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleStar(email.id); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                >
                  <Star style={{ width: 14, height: 14, color: email.starred ? '#F4A261' : 'var(--text-secondary)', fill: email.starred ? '#F4A261' : 'none' }} />
                </button>
              </div>

              {/* Email content (clickable) */}
              <button
                onClick={() => handleSelectEmail(email)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', gap: 2,
                  padding: '14px 14px 14px 4px', border: 'none',
                  background: 'transparent', cursor: 'pointer', textAlign: 'left', minWidth: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {!email.read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-green-text)', flexShrink: 0 }} />}
                  <span style={{
                    fontSize: 13, fontWeight: email.read ? 400 : 700,
                    color: 'var(--text-primary)', flex: 1,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {email.from}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>
                    {email.date}
                  </span>
                </div>
                <p style={{
                  fontSize: 13, fontWeight: email.read ? 400 : 600,
                  color: 'var(--text-primary)', margin: 0,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {email.subject}
                  {email.thread.length > 0 && <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 6 }}>({email.thread.length + 1})</span>}
                </p>
                <p style={{
                  fontSize: 12, color: 'var(--text-secondary)', margin: 0,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {email.preview}
                </p>
                {/* Labels + attachment */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                  {email.labels.map(labelId => {
                    const label = LABELS.find(l => l.id === labelId);
                    return label ? (
                      <span key={labelId} style={{
                        fontSize: 10, fontWeight: 500, color: label.color,
                        background: `${label.color}15`, padding: '1px 6px',
                        borderRadius: 4, border: `1px solid ${label.color}30`,
                      }}>
                        {label.label}
                      </span>
                    ) : null;
                  })}
                  {email.hasAttachment && <Paperclip style={{ width: 12, height: 12, color: 'var(--text-secondary)' }} />}
                </div>
              </button>
            </div>
          ))}
          {!loading && !loadError && filteredEmails.length === 0 && (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <Mail style={{ width: 36, height: 36, color: 'var(--text-secondary)', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>
                {activeFolder === 'inbox' ? 'No emails in this category' :
                 activeFolder === 'starred' ? 'No starred emails' :
                 activeFolder === 'sent' ? 'No sent emails' :
                 activeFolder === 'trash' ? 'Trash is empty' :
                 'No emails found'}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                {activeFolder === 'trash' ? 'Deleted emails will appear here' : 'Messages will appear here when they arrive'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Email Detail / Thread View ── */}
      {selectedEmail && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Detail toolbar */}
          <div style={{
            padding: '10px 16px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {toolbarBtn({ onClick: () => setSelectedEmail(null), title: 'Back', children: <ChevronLeft style={{ width: 18, height: 18 }} /> })}
            <div style={{ flex: 1 }} />
            {toolbarBtn({ onClick: () => archiveEmails(new Set([selectedEmail.id])), title: 'Archive', children: <Archive style={{ width: 16, height: 16 }} /> })}
            {toolbarBtn({ onClick: () => moveToTrash(new Set([selectedEmail.id])), title: 'Delete', children: <Trash2 style={{ width: 16, height: 16 }} /> })}
            {toolbarBtn({ onClick: () => toggleRead(new Set([selectedEmail.id])), title: 'Mark unread', children: <MailOpen style={{ width: 16, height: 16 }} /> })}
            {toolbarBtn({ onClick: () => snoozeEmails(new Set([selectedEmail.id])), title: 'Snooze', children: <BellOff style={{ width: 16, height: 16 }} /> })}

            <div style={{ width: 1, height: 18, background: 'var(--border-color)', margin: '0 4px' }} />

            {toolbarBtn({ onClick: () => {
              setComposeTo(selectedEmail.fromEmail);
              setComposeSubject(selectedEmail.subject.startsWith('Re:') ? selectedEmail.subject : `Re: ${selectedEmail.subject}`);
              setShowCompose(true);
            }, title: 'Reply', children: <Reply style={{ width: 16, height: 16 }} /> })}
            {toolbarBtn({ onClick: () => {
              setComposeTo('');
              setComposeSubject(selectedEmail.subject.startsWith('Fwd:') ? selectedEmail.subject : `Fwd: ${selectedEmail.subject}`);
              setShowCompose(true);
            }, title: 'Forward', children: <Forward style={{ width: 16, height: 16 }} /> })}
            {toolbarBtn({ onClick: () => {}, title: 'More', children: <MoreHorizontal style={{ width: 16, height: 16 }} /> })}
          </div>

          {/* Thread content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>
                {selectedEmail.subject}
              </h2>
              {selectedEmail.labels.map(labelId => {
                const label = LABELS.find(l => l.id === labelId);
                return label ? (
                  <span key={labelId} style={{
                    fontSize: 10, fontWeight: 500, color: label.color,
                    background: `${label.color}15`, padding: '2px 8px',
                    borderRadius: 4, border: `1px solid ${label.color}30`,
                  }}>
                    {label.label}
                  </span>
                ) : null;
              })}
            </div>

            {/* Older thread messages (collapsed) */}
            {selectedEmail.thread.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <button
                  onClick={() => toggleThread(selectedEmail.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px', border: '1px solid var(--border-color)',
                    borderRadius: 10, background: 'var(--surface-elevated)',
                    cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)',
                  }}
                >
                  {expandedThreads.has(selectedEmail.id) ? <ChevronUp style={{ width: 14, height: 14 }} /> : <ChevronDown style={{ width: 14, height: 14 }} />}
                  <span>{selectedEmail.thread.length} earlier {selectedEmail.thread.length === 1 ? 'message' : 'messages'}</span>
                </button>

                {expandedThreads.has(selectedEmail.id) && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[...selectedEmail.thread].reverse().map(msg => (
                      <div key={msg.id} style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: 10, padding: 16,
                        background: 'var(--surface-elevated)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: 'var(--border-color)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                          }}>
                            {msg.from.split(' ').map(n => n[0]).join('').substring(0, 2)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{msg.from}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8 }}>&lt;{msg.fromEmail}&gt;</span>
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{msg.date}, {msg.time}</span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                          {msg.body}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Latest message */}
            <div style={{
              border: '1px solid var(--border-color)',
              borderRadius: 12, padding: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'var(--surface-elevated)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                  flexShrink: 0,
                }}>
                  {selectedEmail.from.split(' ').map(n => n[0]).join('').substring(0, 2)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {selectedEmail.from}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      &lt;{selectedEmail.fromEmail}&gt;
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>to me</span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>|</span>
                    <Clock style={{ width: 11, height: 11, color: 'var(--text-secondary)' }} />
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {selectedEmail.date}, {selectedEmail.time}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => toggleStar(selectedEmail.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                >
                  <Star style={{ width: 16, height: 16, color: selectedEmail.starred ? '#F4A261' : 'var(--text-secondary)', fill: selectedEmail.starred ? '#F4A261' : 'none' }} />
                </button>
              </div>

              {selectedEmail.body && selectedEmail.body.includes('<') ? (
                <div
                  style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.8 }}
                  dangerouslySetInnerHTML={{ __html: selectedEmail.body }}
                />
              ) : (
                <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
                  {selectedEmail.body}
                </div>
              )}

              {selectedEmail.hasAttachment && selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedEmail.attachments.map((att: any, idx: number) => (
                    <div key={att.id || idx} style={{
                      padding: '12px 16px',
                      border: '1px solid var(--border-color)', borderRadius: 10,
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: 'var(--surface-elevated)',
                    }}>
                      <Paperclip style={{ width: 16, height: 16, color: 'var(--text-secondary)' }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                          {att.filename || 'attachment'}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {att.size ? (att.size > 1024 * 1024 ? `${(att.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(att.size / 1024)} KB`) : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick reply buttons */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => {
                  setComposeTo(selectedEmail.fromEmail);
                  setComposeSubject(selectedEmail.subject.startsWith('Re:') ? selectedEmail.subject : `Re: ${selectedEmail.subject}`);
                  setShowCompose(true);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', border: '1px solid var(--border-color)',
                  borderRadius: 20, background: 'transparent', cursor: 'pointer',
                  fontSize: 13, color: 'var(--text-primary)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-elevated)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <CornerUpLeft style={{ width: 14, height: 14 }} />
                Reply
              </button>
              <button
                onClick={() => {
                  setComposeTo('');
                  setComposeSubject(selectedEmail.subject.startsWith('Fwd:') ? selectedEmail.subject : `Fwd: ${selectedEmail.subject}`);
                  setShowCompose(true);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', border: '1px solid var(--border-color)',
                  borderRadius: 20, background: 'transparent', cursor: 'pointer',
                  fontSize: 13, color: 'var(--text-primary)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-elevated)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <CornerUpRight style={{ width: 14, height: 14 }} />
                Forward
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Compose Dialog ── */}
      {showCompose && (
        <div style={{
          position: 'fixed', zIndex: 100,
          ...(composeExpanded
            ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '80vw', maxWidth: 900, height: '80vh', maxHeight: '80vh' }
            : { bottom: 16, right: 24, width: 520, maxHeight: '70vh' }
          ),
          background: 'var(--surface-white)', border: '1px solid var(--border-color)',
          borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          transition: 'all 0.2s ease',
        }}>
          {/* Backdrop when expanded */}
          {composeExpanded && (
            <div
              onClick={() => setComposeExpanded(false)}
              style={{
                position: 'fixed', inset: 0, zIndex: -1,
                background: 'rgba(0,0,0,0.3)',
              }}
            />
          )}
          {/* Compose header */}
          <div style={{
            padding: '12px 16px', background: 'var(--surface-elevated)',
            display: 'flex', alignItems: 'center', gap: 4,
            borderBottom: '1px solid var(--border-color)',
          }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>New Message</span>
            <button
              onClick={() => setComposeExpanded(!composeExpanded)}
              title={composeExpanded ? 'Minimize' : 'Expand'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}
            >
              {composeExpanded
                ? <Minus style={{ width: 16, height: 16 }} />
                : <Maximize2 style={{ width: 14, height: 14 }} />
              }
            </button>
            <button
              onClick={() => { setShowCompose(false); setComposeExpanded(false); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}
            >
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>

          {/* To / Subject */}
          <div style={{ borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 50 }}>To</span>
              <input
                type="email"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                placeholder="recipient@email.com"
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, background: 'transparent', color: 'var(--text-primary)' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', gap: 8, borderTop: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 50 }}>Subject</span>
              <input
                type="text"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="Email subject"
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, background: 'transparent', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          {/* Formatting toolbar */}
          <div style={{
            padding: '6px 12px', borderBottom: '1px solid var(--border-color)',
            display: 'flex', alignItems: 'center', gap: 2,
          }}>
            {toolbarBtn({ onClick: () => execFormat('bold'), title: 'Bold (Ctrl+B)', children: <Bold style={{ width: 14, height: 14 }} /> })}
            {toolbarBtn({ onClick: () => execFormat('italic'), title: 'Italic (Ctrl+I)', children: <Italic style={{ width: 14, height: 14 }} /> })}
            {toolbarBtn({ onClick: () => execFormat('underline'), title: 'Underline (Ctrl+U)', children: <Underline style={{ width: 14, height: 14 }} /> })}
            <div style={{ width: 1, height: 18, background: 'var(--border-color)', margin: '0 4px' }} />
            {toolbarBtn({ onClick: () => execFormat('fontSize', '5'), title: 'Increase font size', children: <Type style={{ width: 14, height: 14 }} /> })}
            {toolbarBtn({ onClick: () => execFormat('justifyLeft'), title: 'Align left', children: <AlignLeft style={{ width: 14, height: 14 }} /> })}
            <div style={{ width: 1, height: 18, background: 'var(--border-color)', margin: '0 4px' }} />
            {toolbarBtn({ onClick: () => execFormat('insertUnorderedList'), title: 'Bulleted list', children: <List style={{ width: 14, height: 14 }} /> })}
            {toolbarBtn({ onClick: () => execFormat('insertOrderedList'), title: 'Numbered list', children: <ListOrdered style={{ width: 14, height: 14 }} /> })}
            <div style={{ width: 1, height: 18, background: 'var(--border-color)', margin: '0 4px' }} />
            {toolbarBtn({ onClick: () => execFormatWithPrompt('createLink', 'Enter URL:'), title: 'Insert link', children: <LinkIcon style={{ width: 14, height: 14 }} /> })}
            {toolbarBtn({ onClick: () => execFormatWithPrompt('insertImage', 'Enter image URL:'), title: 'Insert image', children: <Image style={{ width: 14, height: 14 }} /> })}
            {toolbarBtn({ onClick: () => {}, title: 'Attach file', children: <Paperclip style={{ width: 14, height: 14 }} /> })}
          </div>

          {/* Compose body - contentEditable for rich text */}
          <div
            ref={composeRef}
            contentEditable
            data-placeholder="Write your email..."
            style={{
              flex: 1, minHeight: 200, padding: 16,
              outline: 'none',
              fontSize: 13, lineHeight: 1.7, color: 'var(--text-primary)',
              background: 'transparent', fontFamily: 'inherit',
              overflowY: 'auto',
            }}
            onFocus={(e) => { if (!e.currentTarget.textContent) e.currentTarget.classList.add('empty'); }}
            onInput={(e) => {
              if (e.currentTarget.textContent) e.currentTarget.classList.remove('empty');
              else e.currentTarget.classList.add('empty');
            }}
            onKeyUp={saveSelection}
            onMouseUp={saveSelection}
          />

          {/* Send bar */}
          <div style={{
            padding: '10px 16px', borderTop: '1px solid var(--border-color)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Button
              disabled={sending || !composeTo}
              onClick={async () => {
                if (!composeTo || !activeProvider) return;
                setSending(true);
                try {
                  const bodyHtml = composeRef.current?.innerHTML || '';
                  if (activeProvider === 'gmail') {
                    await gmailSendEmail({ to: composeTo, subject: composeSubject, body: bodyHtml });
                  } else {
                    await outlookSendEmail({ to: composeTo, subject: composeSubject, body: bodyHtml, bodyType: 'HTML' });
                  }
                  setShowCompose(false);
                  setComposeExpanded(false);
                  setComposeTo('');
                  setComposeSubject('');
                  if (composeRef.current) composeRef.current.innerHTML = '';
                } catch (err) {
                  console.error('Failed to send email:', err);
                  alert(err instanceof Error ? err.message : 'Failed to send email');
                } finally {
                  setSending(false);
                }
              }}
              style={{
                padding: '8px 20px', fontSize: 13, fontWeight: 600,
                borderRadius: 8, background: 'var(--brand-green-text)', color: 'var(--on-brand-green)',
                gap: 6, opacity: sending || !composeTo ? 0.6 : 1,
              }}
            >
              {sending ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 0.8s linear infinite' }} /> : <Send style={{ width: 14, height: 14 }} />}
              {sending ? 'Sending...' : 'Send'}
            </Button>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => {
                setShowCompose(false);
                setComposeExpanded(false);
                setComposeTo('');
                setComposeSubject('');
                if (composeRef.current) composeRef.current.innerHTML = '';
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 6 }}
              title="Discard"
            >
              <Trash2 style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────

// ─── OAuth error → user-friendly message map ────────────────
const OAUTH_ERROR_MESSAGES: Record<string, { title: string; message: string; severity: 'error' | 'warning' }> = {
  consent_screen_unauthorized: {
    title: 'Not Authorized',
    message: 'This Google account is not authorized for OAuth access. The app is in testing mode — only approved test users can connect. Contact your administrator to be added as a test user.',
    severity: 'error',
  },
  access_denied: {
    title: 'Access Denied',
    message: 'Google OAuth consent was denied. If you didn\'t deny access, your account may not be added as a test user in Google Cloud Console. Contact your administrator.',
    severity: 'error',
  },
  redirect_uri_mismatch: {
    title: 'Configuration Error',
    message: 'OAuth redirect URI mismatch — the callback URL doesn\'t match Google Cloud Console configuration. Contact your administrator.',
    severity: 'error',
  },
  invalid_scope: {
    title: 'Configuration Error',
    message: 'One or more OAuth scopes are invalid or the Gmail API is not enabled. Contact your administrator.',
    severity: 'error',
  },
  invalid_client: {
    title: 'Configuration Error',
    message: 'OAuth client ID is invalid. Contact your administrator to verify Google Cloud Console credentials.',
    severity: 'error',
  },
  invalid_state: {
    title: 'Session Expired',
    message: 'OAuth session expired or was tampered with. Please try connecting again.',
    severity: 'warning',
  },
  expired_state: {
    title: 'Session Expired',
    message: 'The authorization request expired. Please try connecting again.',
    severity: 'warning',
  },
  missing_code: {
    title: 'Connection Failed',
    message: 'No authorization code received from Google. Please try again.',
    severity: 'warning',
  },
  userinfo_failed: {
    title: 'Connection Failed',
    message: 'Could not fetch your email address from Google. The Gmail API may not be enabled. Contact your administrator.',
    severity: 'error',
  },
  no_email: {
    title: 'Connection Failed',
    message: 'Google did not return an email address for your account. Please try again or use a different account.',
    severity: 'error',
  },
  invalid_grant: {
    title: 'Authorization Expired',
    message: 'The authorization code expired or was already used. Please try connecting again.',
    severity: 'warning',
  },
  db_error: {
    title: 'Connection Failed',
    message: 'Could not save your email connection. Please try again or contact your administrator.',
    severity: 'error',
  },
  user_not_found: {
    title: 'Account Error',
    message: 'Your user profile could not be found. Please log out and log back in.',
    severity: 'error',
  },
  server_error: {
    title: 'Server Error',
    message: 'An unexpected error occurred during OAuth. Please try again later.',
    severity: 'error',
  },
};

export default function AdminCommunicationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [connecting, setConnecting] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<'gmail' | 'outlook' | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // ── OAuth callback result (read from URL params set by callback redirect) ──
  const [oauthError, setOauthError] = useState<{ title: string; message: string; severity: 'error' | 'warning' } | null>(null);
  const [oauthSuccess, setOauthSuccess] = useState<{ provider: string; email: string } | null>(null);

  useEffect(() => {
    const error = searchParams.get('error');
    const connected = searchParams.get('connected');
    const email = searchParams.get('email');

    if (error) {
      const known = OAUTH_ERROR_MESSAGES[error];
      setOauthError(known || {
        title: 'Connection Failed',
        message: `OAuth error: ${error}. Please try again or contact your administrator.`,
        severity: 'error',
      });
      setSearchParams({}, { replace: true });
    } else if (connected && email) {
      setOauthSuccess({ provider: connected, email });
      setConnectedIds(prev => new Set([...prev, connected]));
      setActiveProvider(connected as 'gmail' | 'outlook');
      setSearchParams({}, { replace: true });
    }

    // Load real integration status from Supabase
    getIntegrationStatus().then((integrations) => {
      const active = new Set<string>();
      let provider: 'gmail' | 'outlook' | null = null;
      for (const i of integrations) {
        if (i.status === 'active') {
          active.add(i.provider);
          if (!provider) provider = i.provider as 'gmail' | 'outlook';
        }
      }
      if (active.size > 0) {
        setConnectedIds(active);
        setActiveProvider(provider);
      }
    }).catch((err) => {
      console.error('Failed to load integration status:', err);
    }).finally(() => {
      setStatusLoading(false);
    });
  }, []);

  const integrations: Integration[] = [
    {
      id: 'gmail',
      name: 'Gmail',
      description: 'Connect your Google Workspace or personal Gmail account.',
      icon: GMAIL_ICON,
      connected: connectedIds.has('gmail'),
    },
    {
      id: 'outlook',
      name: 'Outlook',
      description: 'Connect your Microsoft 365 or Outlook.com account.',
      icon: OUTLOOK_ICON,
      connected: connectedIds.has('outlook'),
    },
  ];

  // Setup flow state
  const [setupId, setSetupId] = useState<string | null>(null);
  const [setupStep, setSetupStep] = useState(0);
  const [setupEmail, setSetupEmail] = useState('');
  const [setupAuthorizing, setSetupAuthorizing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleConnect = (id: string) => {
    setSetupId(id);
    setSetupStep(0);
    setSetupEmail('');
    setSetupAuthorizing(false);
    setDialogOpen(false);
  };

  const handleAuthorize = async () => {
    if (!setupId) return;
    setSetupAuthorizing(true);
    try {
      const result = setupId === 'gmail'
        ? await initiateGmailAuth()
        : await initiateOutlookAuth();

      if (result.auth_url) {
        // Redirect the browser to Google/Microsoft consent screen
        window.location.href = result.auth_url;
      } else if (result.error) {
        setOauthError({
          title: 'Connection Failed',
          message: result.error,
          severity: 'error',
        });
        setSetupAuthorizing(false);
        setSetupId(null);
      } else if (result.setup_instructions) {
        setOauthError({
          title: 'Not Configured',
          message: `${setupId === 'gmail' ? 'Gmail' : 'Outlook'} integration is not configured. Contact your administrator.`,
          severity: 'error',
        });
        setSetupAuthorizing(false);
        setSetupId(null);
      }
    } catch (err) {
      const isNetworkError = err instanceof TypeError && err.message === 'Failed to fetch';
      setOauthError({
        title: isNetworkError ? 'Service Unavailable' : 'Connection Failed',
        message: isNetworkError
          ? 'Could not reach the email service. The backend edge functions may not be deployed yet. Please ensure Supabase edge functions are deployed and try again.'
          : (err instanceof Error ? err.message : 'Failed to start authorization'),
        severity: 'error',
      });
      setSetupAuthorizing(false);
      setSetupId(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      if (id === 'outlook') {
        await disconnectOutlook();
      } else {
        await disconnectIntegration(id);
      }
      setConnectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      console.error('Failed to disconnect:', err);
      // Still remove from UI — the user intends to disconnect
      setConnectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const hasAnyConnection = connectedIds.size > 0;

  const setupIntegration = integrations.find(i => i.id === setupId);

  // Derive callback URLs from the Supabase project URL — these must match
  // what's configured in Google Cloud Console / Azure Portal exactly.
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');

  const getSetupSteps = (id: string) => {
    switch (id) {
      case 'gmail': return {
        title: 'Connect Gmail',
        authLabel: 'Sign in with Google',
        authDescription: 'You\'ll be redirected to Google to authorize HugoIT to access your email. We request read and send permissions only.',
        permissions: ['Read your emails', 'Send emails on your behalf', 'Access your contacts'],
        callbackUrl: `${supabaseUrl}/functions/v1/gmail-callback`,
        steps: [
          'Enter the Gmail address you want to connect',
          'Click "Sign in with Google" to open the authorization window',
          'Sign in to your Google account and grant the requested permissions',
          'You\'ll be redirected back to HugoIT automatically',
        ],
      };
      case 'outlook': return {
        title: 'Connect Outlook',
        authLabel: 'Sign in with Microsoft',
        authDescription: 'You\'ll be redirected to Microsoft to authorize HugoIT. We use Microsoft Graph API for secure access.',
        permissions: ['Read your emails', 'Send emails on your behalf', 'Access your contacts', 'Read your calendar'],
        callbackUrl: `${supabaseUrl}/functions/v1/outlook-callback`,
        steps: [
          'Enter your Microsoft / Outlook email address',
          'Click "Sign in with Microsoft" to open the authorization window',
          'Sign in with your Microsoft account and approve permissions',
          'You\'ll be redirected back to HugoIT automatically',
        ],
      };
      default: return {
        title: 'Connect', authLabel: 'Authorize', authDescription: '',
        permissions: [], callbackUrl: '', steps: [],
      };
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto p-8">
      {/* OAuth error banner */}
      {oauthError && (
        <div
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 18px',
            borderRadius: 10, marginBottom: 16,
            background: oauthError.severity === 'error' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
            border: `1px solid ${oauthError.severity === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
          }}
        >
          <AlertTriangle style={{
            width: 18, height: 18, flexShrink: 0, marginTop: 1,
            color: oauthError.severity === 'error' ? '#EF4444' : '#F59E0B',
          }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 600, fontSize: 14, color: oauthError.severity === 'error' ? '#EF4444' : '#F59E0B' }}>
              {oauthError.title}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              {oauthError.message}
            </p>
          </div>
          <button
            onClick={() => setOauthError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X style={{ width: 16, height: 16, color: 'var(--text-secondary)' }} />
          </button>
        </div>
      )}

      {/* OAuth success banner */}
      {oauthSuccess && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
            borderRadius: 10, marginBottom: 16,
            background: 'rgba(45, 106, 79, 0.08)',
            border: '1px solid rgba(45, 106, 79, 0.2)',
          }}
        >
          <Check style={{ width: 18, height: 18, color: '#2D6A4F', flexShrink: 0 }} />
          <p style={{ flex: 1, fontSize: 14, color: '#2D6A4F', fontWeight: 500 }}>
            Successfully connected {oauthSuccess.provider === 'gmail' ? 'Gmail' : 'Outlook'} ({oauthSuccess.email})
          </p>
          <button
            onClick={() => setOauthSuccess(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X style={{ width: 16, height: 16, color: 'var(--text-secondary)' }} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-8" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="text-[var(--text-primary)]" style={{ fontSize: 32, fontWeight: 700 }}>
            Communications
          </h1>
          <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: 16 }}>
            Email, contacts, and client outreach in one place.
          </p>
        </div>
        {hasAnyConnection && (
          <Button
            variant="outline"
            onClick={() => setDialogOpen(true)}
            style={{ gap: 6, fontSize: 13, fontWeight: 500, borderRadius: 8 }}
          >
            <Settings style={{ width: 15, height: 15 }} />
            Manage Integrations
          </Button>
        )}
      </div>

      {statusLoading ? (
        <div
          className="flex flex-col items-center justify-center"
          style={{
            background: 'var(--surface-white)',
            border: '1px solid var(--border-color)',
            borderRadius: 16,
            padding: '80px 40px',
            minHeight: 480,
          }}
        >
          <div style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: 'var(--brand-green-text)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ marginTop: 16, fontSize: 14, color: 'var(--text-secondary)' }}>Loading email...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : hasAnyConnection ? (
        <EmailInboxView
          connectedIds={connectedIds}
          integrations={integrations}
          onManageIntegrations={() => setDialogOpen(true)}
          activeProvider={activeProvider}
        />
      ) : (
        <div
          className="flex flex-col items-center justify-center text-center"
          style={{
            background: 'var(--surface-white)',
            border: '1px solid var(--border-color)',
            borderRadius: 16,
            padding: '80px 40px',
            minHeight: 480,
          }}
        >
          <div
            style={{
              width: 80, height: 80, borderRadius: 20,
              background: 'var(--surface-elevated)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 24,
            }}
          >
            <Mail style={{ width: 36, height: 36, color: 'var(--text-secondary)' }} />
          </div>
          <h2 className="text-[var(--text-primary)]" style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
            Connect Your Email
          </h2>
          <p className="text-[var(--text-secondary)]" style={{ fontSize: 15, maxWidth: 420, marginBottom: 32, lineHeight: 1.6 }}>
            Integrate your email to send and receive messages, manage contacts, and handle client outreach — all from within HugoIT.
          </p>
          <Button
            onClick={() => setDialogOpen(true)}
            style={{
              gap: 8, fontSize: 15, fontWeight: 600,
              padding: '12px 28px', borderRadius: 10,
              background: 'var(--brand-green-text)', color: 'var(--on-brand-green)',
            }}
          >
            <ExternalLink style={{ width: 18, height: 18 }} />
            Connect Email Account
          </Button>
        </div>
      )}

      {/* ─── Integration Dialog ──────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="sm:max-w-[520px]"
          style={{
            background: 'var(--surface-white)',
            border: '1px solid var(--border-color)',
            borderRadius: 16,
            padding: 0,
            overflow: 'hidden',
          }}
        >
          <DialogHeader style={{ padding: '24px 24px 0' }}>
            <DialogTitle
              className="text-[var(--text-primary)]"
              style={{ fontSize: 20, fontWeight: 700 }}
            >
              Email Integrations
            </DialogTitle>
            <p className="text-[var(--text-secondary)]" style={{ fontSize: 14, marginTop: 4 }}>
              Choose an email provider to connect with HugoIT.
            </p>
          </DialogHeader>

          <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {integrations.map((integration) => {
              const isConnecting = connecting === integration.id;
              return (
                <div
                  key={integration.id}
                  className="flex items-center gap-4"
                  style={{
                    padding: '16px 20px',
                    borderRadius: 12,
                    border: `1px solid ${integration.connected ? 'rgba(45, 106, 79, 0.3)' : 'var(--border-color)'}`,
                    background: integration.connected ? 'rgba(45, 106, 79, 0.04)' : 'var(--surface-elevated)',
                    transition: 'all 0.15s',
                  }}
                >
                  {integration.icon}
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {integration.name}
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {integration.description}
                    </p>
                  </div>
                  {integration.connected ? (
                    <div className="flex items-center gap-2">
                      <span
                        className="flex items-center gap-1"
                        style={{
                          fontSize: 12, fontWeight: 600,
                          color: 'var(--brand-green-text)',
                          background: 'rgba(45, 106, 79, 0.1)',
                          padding: '4px 10px', borderRadius: 9999,
                        }}
                      >
                        <Check style={{ width: 12, height: 12 }} />
                        Connected
                      </span>
                      <button
                        onClick={() => handleDisconnect(integration.id)}
                        style={{
                          fontSize: 12, fontWeight: 500,
                          color: '#d4183d', background: 'none',
                          border: 'none', cursor: 'pointer',
                          padding: '4px 8px', borderRadius: 6,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(212, 24, 61, 0.08)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => handleConnect(integration.id)}
                      disabled={isConnecting}
                      style={{
                        gap: 6, fontSize: 13, fontWeight: 600,
                        borderRadius: 8, padding: '6px 14px',
                        minWidth: 90,
                      }}
                    >
                      {isConnecting ? (
                        <>
                          <div
                            style={{
                              width: 14, height: 14, borderRadius: '50%',
                              border: '2px solid var(--border-color)',
                              borderTopColor: 'var(--text-primary)',
                              animation: 'spin 0.8s linear infinite',
                            }}
                          />
                          Connecting...
                        </>
                      ) : (
                        <>
                          Connect
                          <ArrowRight style={{ width: 14, height: 14 }} />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-color)',
              background: 'var(--surface-elevated)',
            }}
          >
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              HugoIT uses OAuth 2.0 for secure authentication. We never store your email password.
              You can disconnect at any time.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Setup / Authorization Dialog ────────────── */}
      <Dialog open={!!setupId} onOpenChange={(open) => { if (!open) setSetupId(null); }}>
        <DialogContent
          className="sm:max-w-[560px]"
          style={{
            background: 'var(--surface-white)',
            border: '1px solid var(--border-color)',
            borderRadius: 16,
            padding: 0,
            overflow: 'hidden',
          }}
        >
          {setupIntegration && (() => {
            const info = getSetupSteps(setupId!);
            const isAppPassword = setupId === 'yahoo';
            return (
              <>
                <div style={{ padding: '24px 24px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={() => { setSetupId(null); setDialogOpen(true); }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-secondary)', padding: 4, borderRadius: 6,
                    }}
                  >
                    <ChevronLeft style={{ width: 20, height: 20 }} />
                  </button>
                  {setupIntegration.icon}
                  <div>
                    <DialogTitle className="text-[var(--text-primary)]" style={{ fontSize: 20, fontWeight: 700 }}>
                      {info.title}
                    </DialogTitle>
                  </div>
                </div>

                {setupStep === 2 ? (
                  <div style={{ padding: '32px 24px', textAlign: 'center' }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: '50%',
                      background: 'rgba(45, 106, 79, 0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 16px',
                    }}>
                      <Check style={{ width: 28, height: 28, color: 'var(--brand-green-text)' }} />
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                      Successfully Connected!
                    </h3>
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
                      Your {setupIntegration.name} account ({setupEmail || 'clinic@hugoit.com'}) is now connected.
                      You can send and receive emails directly from HugoIT.
                    </p>
                    <Button
                      onClick={() => setSetupId(null)}
                      style={{
                        background: 'var(--brand-green-text)', color: 'var(--on-brand-green)',
                        borderRadius: 10, padding: '10px 28px', fontSize: 14, fontWeight: 600,
                      }}
                    >
                      Done
                    </Button>
                  </div>
                ) : (
                  <div style={{ padding: '20px 24px 24px' }}>
                    <div style={{
                      background: 'var(--surface-elevated)',
                      borderRadius: 10, padding: '16px 20px', marginBottom: 20,
                    }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
                        Setup Instructions
                      </p>
                      <ol style={{ margin: 0, paddingLeft: 20 }}>
                        {info.steps.map((step, i) => (
                          <li key={i} style={{
                            fontSize: 13, color: 'var(--text-secondary)',
                            lineHeight: 1.6, marginBottom: 4,
                          }}>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                        Email Address
                      </label>
                      <Input
                        type="email"
                        placeholder={`you@${setupId === 'gmail' ? 'gmail.com' : setupId === 'outlook' ? 'outlook.com' : 'yahoo.com'}`}
                        value={setupEmail}
                        onChange={(e) => setSetupEmail(e.target.value)}
                        style={{ borderRadius: 8 }}
                      />
                    </div>

                    {isAppPassword && (
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                          App-Specific Password
                        </label>
                        <Input
                          type="password"
                          placeholder="xxxx-xxxx-xxxx-xxxx"
                          style={{ borderRadius: 8, fontFamily: 'monospace' }}
                        />
                      </div>
                    )}

                    <div style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: 10, padding: '14px 16px', marginBottom: 20,
                    }}>
                      <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
                        <Shield style={{ width: 14, height: 14, color: 'var(--text-secondary)' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          Permissions Requested
                        </span>
                      </div>
                      {info.permissions.map((perm, i) => (
                        <div key={i} className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                          <Check style={{ width: 12, height: 12, color: 'var(--brand-green-text)' }} />
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{perm}</span>
                        </div>
                      ))}
                    </div>

                    {info.callbackUrl && (
                      <div style={{
                        background: 'var(--surface-elevated)',
                        borderRadius: 8, padding: '10px 14px', marginBottom: 20,
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <Link2 style={{ width: 14, height: 14, color: 'var(--text-secondary)', flexShrink: 0 }} />
                        <code style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>
                          {info.callbackUrl}
                        </code>
                        <button
                          onClick={() => {
                            try { navigator.clipboard.writeText(info.callbackUrl); } catch {}
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'var(--brand-green-text)' : 'var(--text-secondary)', padding: 2, display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          {copied ? (
                            <>
                              <Check style={{ width: 14, height: 14 }} />
                              <span style={{ fontSize: 11, fontWeight: 500 }}>Copied!</span>
                            </>
                          ) : (
                            <Copy style={{ width: 14, height: 14 }} />
                          )}
                        </button>
                      </div>
                    )}

                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
                      {info.authDescription}
                    </p>

                    <Button
                      onClick={handleAuthorize}
                      disabled={!setupEmail || setupAuthorizing}
                      style={{
                        width: '100%',
                        background: setupId === 'gmail' ? '#EA4335' : setupId === 'outlook' ? '#0078D4' : '#5f01d1',
                        color: '#fff',
                        borderRadius: 10, padding: '12px 20px',
                        fontSize: 14, fontWeight: 600, gap: 8,
                        opacity: !setupEmail ? 0.5 : 1,
                      }}
                    >
                      {setupAuthorizing ? (
                        <>
                          <div style={{
                            width: 16, height: 16, borderRadius: '50%',
                            border: '2px solid rgba(255,255,255,0.3)',
                            borderTopColor: '#fff',
                            animation: 'spin 0.8s linear infinite',
                          }} />
                          Authorizing...
                        </>
                      ) : (
                        <>
                          {isAppPassword ? <Key style={{ width: 16, height: 16 }} /> : <ExternalLink style={{ width: 16, height: 16 }} />}
                          {info.authLabel}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: var(--text-secondary);
          opacity: 0.6;
          pointer-events: none;
        }
        [contenteditable] ul {
          list-style-type: disc;
          padding-left: 24px;
          margin: 4px 0;
        }
        [contenteditable] ol {
          list-style-type: decimal;
          padding-left: 24px;
          margin: 4px 0;
        }
        [contenteditable] li {
          margin: 2px 0;
        }
        [contenteditable] a {
          color: #4A90D9;
          text-decoration: underline;
        }
        [contenteditable] img {
          max-width: 100%;
          border-radius: 6px;
          margin: 8px 0;
        }
      `}</style>
    </div>
  );
}
