import { useState, useRef, useEffect, useCallback } from 'react';
import { getOrgContext } from '../../hooks/useOrgContext';
import {
  MessageSquare,
  Search,
  Send,
  Paperclip,
  Smile,
  CheckCheck,
  X,
  Trash2,
  ChevronUp,
  ChevronDown,
  Plus,
  Users,
} from 'lucide-react';
import { Input } from '../../components/ui/input';
import { supabase } from '../../../lib/supabase';

// ─── Emoji picker data ────────────────────────────────────────────────────────

const EMOJI_GROUPS = [
  { label: 'Smileys', emojis: ['😀','😂','😍','🥰','😎','😅','🤔','😴','😭','🥹','😊','😋','😏','🤩','😇','😆','🤣','😁','😉','🙂'] },
  { label: 'Gestures', emojis: ['👍','👎','👋','🙏','👏','🤝','💪','✌️','🫶','🤙','🫡','👌','🤌','🫰','👈','👉','👆','👇','☝️','✋'] },
  { label: 'Hearts', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💕','💞','💓','💗','💖','💘','💝','❤️‍🔥','💔','🫀','♥️','❣️'] },
  { label: 'Animals', emojis: ['🐾','🐕','🐈','🐇','🦜','🐠','🐢','🐹','🐾','🦊','🐶','🐱','🐭','🐹','🐰','🦝','🐻','🐼','🐨','🐯'] },
  { label: 'Medical', emojis: ['💊','🩺','🔬','🩹','💉','🧬','🏥','🩻','🧪','🩸','🦷','👁️','🫁','🫀','🧠','🦴','🦿','⚕️','🏨','🚑'] },
  { label: 'Objects', emojis: ['⭐','✨','🔥','💯','✅','❌','⚠️','📌','📎','🔒','🔓','💡','📋','📝','🗓️','⏰','📞','💬','📧','🔔'] },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type DisplayMessage = {
  id: string;
  from: 'me' | 'them';
  text: string;
  timestamp: Date;
  imageUrl?: string;
};

type ConversationItem = {
  id: string;
  isGroup: boolean;
  groupTitle: string;
  otherProfileId: string;
  otherName: string;
  otherRole: string;
  otherAvatarUrl: string;
  lastMessage: string;
  lastMessageTime: Date | null;
  lastMessageIsMe: boolean;
  unread: number;
};

type StaffResult = {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  avatar_url: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TODAY = new Date();

const ROLE_LABELS: Record<string, string> = {
  veterinarian: 'Veterinarian',
  senior_veterinarian: 'Senior Veterinarian',
  clinic_manager: 'Clinic Manager',
  front_desk_manager: 'Front Desk Manager',
  receptionist: 'Receptionist',
  superadmin: 'Super Administrator',
};

const AVATAR_COLORS: string[] = ['#2D6A4F', '#3B82F6', '#8B5CF6', '#EC4899', '#F4A261', '#06B6D4', '#DC2626', '#0891B2', '#7C3AED', '#059669'];

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getDateLabel(date: Date): string {
  if (isSameDay(date, TODAY)) return 'Today';
  const yesterday = new Date(TODAY);
  yesterday.setDate(TODAY.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getTimeLabel(date: Date | null): string {
  if (!date) return '';
  if (isSameDay(date, TODAY)) return formatTime(date);
  const yesterday = new Date(TODAY);
  yesterday.setDate(TODAY.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Avatar component ─────────────────────────────────────────────────────────

function ChatAvatar({ name, color, size = 40, online, photoUrl }: { name: string; color: string; size?: number; online?: boolean; photoUrl?: string }) {
  const dotSize = size <= 28 ? 8 : 10;
  return (
    <div style={{ position: 'relative', flexShrink: 0, width: size, height: size }}>
      {photoUrl ? (
        <img src={photoUrl} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
      ) : (
        <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size <= 28 ? '10px' : '13px', fontWeight: 700, color: '#fff', userSelect: 'none' }}>
          {getInitials(name)}
        </div>
      )}
      {online && (
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: dotSize, height: dotSize, borderRadius: '50%', backgroundColor: '#22c55e', border: '2px solid var(--surface-white)' }} />
      )}
    </div>
  );
}

// ─── Date separator ───────────────────────────────────────────────────────────

function DateSeparator({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0' }}>
      <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', padding: '2px 10px', backgroundColor: 'var(--bg-offwhite)', borderRadius: '999px', border: '1px solid var(--border-color)' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SuperAdminChatPage() {
  const [saProfileId, setSaProfileId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Resolve the superadmin profile ID (not the auth user)
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'superadmin')
        .single();
      if (data) setSaProfileId(data.id);
    })();
  }, []);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  // Delete conversation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // In-conversation search
  const [msgSearchOpen, setMsgSearchOpen] = useState(false);
  const [msgSearchQuery, setMsgSearchQuery] = useState('');
  const [msgSearchIndex, setMsgSearchIndex] = useState(0);

  // Staff search + new conversation
  const [staffResults, setStaffResults] = useState<StaffResult[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupSelectedIds, setGroupSelectedIds] = useState<string[]>([]);
  const [allStaff, setAllStaff] = useState<StaffResult[]>([]);

  // Emoji picker
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiTab, setEmojiTab] = useState(0);
  const emojiRef = useRef<HTMLDivElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastReadAtRef = useRef<string | null>(null);

  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null;

  // Filtered message indices for in-conversation search
  const msgSearchMatches = msgSearchQuery.trim()
    ? messages.reduce<number[]>((acc, m, i) => {
        if (m.text.toLowerCase().includes(msgSearchQuery.toLowerCase())) acc.push(i);
        return acc;
      }, [])
    : [];

  // ── Staff search ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!searchQuery.trim() || !saProfileId) { setStaffResults([]); return; }
    const timer = setTimeout(async () => {
      const { organizationId } = await getOrgContext();
      const q = searchQuery.trim().toLowerCase();
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role, avatar_url')
        .eq('organization_id', organizationId)
        .neq('id', saProfileId)
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
        .limit(8);
      const existingIds = new Set(conversations.map(c => c.otherProfileId));
      setStaffResults((data || []).filter(s => !existingIds.has(s.id)));
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, saProfileId, conversations]);

  // ── Start new direct conversation ─────────────────────────────────────────────

  async function handleStartConversation(staff: StaffResult) {
    if (!saProfileId) return;
    const { organizationId } = await getOrgContext();
    const { data: conv } = await supabase
      .from('conversations')
      .insert({ organization_id: organizationId, type: 'direct', created_by: saProfileId })
      .select('id')
      .single();
    if (!conv) return;
    await supabase.from('conversation_participants').insert([
      { organization_id: organizationId, conversation_id: conv.id, profile_id: saProfileId },
      { organization_id: organizationId, conversation_id: conv.id, profile_id: staff.id },
    ]);
    setSearchQuery('');
    setStaffResults([]);
    await fetchConversations();
    setSelectedId(conv.id);
    setMessages([]);
  }

  // ── Create group conversation ──────────────────────────────────────────────────

  async function handleCreateGroup() {
    if (!saProfileId || groupSelectedIds.length < 2) return;
    const { organizationId } = await getOrgContext();
    const { data: conv } = await supabase
      .from('conversations')
      .insert({
        organization_id: organizationId,
        type: 'group',
        title: groupName.trim() || null,
        created_by: saProfileId,
      })
      .select('id')
      .single();
    if (!conv) return;
    const participants = [saProfileId, ...groupSelectedIds].map(pid => ({
      organization_id: organizationId,
      conversation_id: conv.id,
      profile_id: pid,
    }));
    await supabase.from('conversation_participants').insert(participants);
    setNewGroupOpen(false);
    setGroupName('');
    setGroupSelectedIds([]);
    setAllStaff([]);
    await fetchConversations();
    setSelectedId(conv.id);
    setMessages([]);
  }

  async function openNewGroupDialog() {
    if (!saProfileId) return;
    const { organizationId } = await getOrgContext();
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, role, avatar_url')
      .eq('organization_id', organizationId)
      .neq('id', saProfileId)
      .order('first_name');
    setAllStaff(data || []);
    setGroupSelectedIds([]);
    setGroupName('');
    setNewGroupOpen(true);
  }

  // ── Load conversations ──────────────────────────────────────────────────────

  const fetchConversations = useCallback(async () => {
    if (!saProfileId) return;
    try {
    const { organizationId } = await getOrgContext();
    const { data: parts } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('organization_id', organizationId)
      .eq('profile_id', saProfileId);
    if (!parts || parts.length === 0) { setLoadingConvs(false); return; }

    const convIds = parts.map(p => p.conversation_id);

    // Batch all queries in parallel instead of sequential per-conversation loop
    const [convMetaRes, allPartsRes, myPartsRes, lastMsgsRes, unreadRes] = await Promise.all([
      supabase.from('conversations').select('id, type, title').eq('organization_id', organizationId).in('id', convIds),
      supabase.from('conversation_participants')
        .select('conversation_id, profile_id, last_read_at, profiles:profiles!conversation_participants_profile_id_fkey(id, first_name, last_name, role, avatar_url)')
        .eq('organization_id', organizationId).in('conversation_id', convIds).neq('profile_id', saProfileId),
      supabase.from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('organization_id', organizationId).in('conversation_id', convIds).eq('profile_id', saProfileId),
      supabase.from('messages')
        .select('conversation_id, content, sender_id, created_at')
        .eq('organization_id', organizationId).in('conversation_id', convIds)
        .order('created_at', { ascending: false }).limit(convIds.length * 2),
      supabase.from('messages')
        .select('conversation_id, created_at')
        .eq('organization_id', organizationId).in('conversation_id', convIds).neq('sender_id', saProfileId),
    ]);

    const metaMap = new Map((convMetaRes.data || []).map(c => [c.id, c]));
    const otherPartsMap = new Map<string, any[]>();
    for (const p of (allPartsRes.data || [])) {
      const list = otherPartsMap.get(p.conversation_id) || [];
      list.push(p);
      otherPartsMap.set(p.conversation_id, list);
    }
    const myPartMap = new Map((myPartsRes.data || []).map(p => [p.conversation_id, p]));
    const lastMsgMap = new Map<string, any>();
    for (const m of (lastMsgsRes.data || [])) {
      if (!lastMsgMap.has(m.conversation_id)) lastMsgMap.set(m.conversation_id, m);
    }
    const unreadMsgsMap = new Map<string, any[]>();
    for (const m of (unreadRes.data || [])) {
      const list = unreadMsgsMap.get(m.conversation_id) || [];
      list.push(m);
      unreadMsgsMap.set(m.conversation_id, list);
    }

    const items: ConversationItem[] = [];
    for (const convId of convIds) {
      const convMeta = metaMap.get(convId);
      const isGroup = convMeta?.type === 'group';
      const otherParts = otherPartsMap.get(convId);
      if (!otherParts || otherParts.length === 0) continue;

      const firstProfile = (otherParts[0].profiles as any);
      const allNames = otherParts.map((p: any) => {
        const prof = p.profiles as any;
        return prof ? `${prof.first_name} ${prof.last_name}`.trim() : 'Unknown';
      });
      const groupTitle = convMeta?.title || allNames.join(', ');
      const myPart = myPartMap.get(convId);
      const lastMsg = lastMsgMap.get(convId);
      const unreadMsgs = unreadMsgsMap.get(convId) || [];
      let unread = 0;
      if (myPart?.last_read_at) {
        unread = unreadMsgs.filter(m => m.created_at > myPart.last_read_at).length;
      } else {
        unread = unreadMsgs.length;
      }

      const otherName = isGroup
        ? groupTitle
        : (firstProfile ? `${firstProfile.first_name} ${firstProfile.last_name}`.trim() : 'Unknown');

      items.push({
        id: convId,
        isGroup,
        groupTitle,
        otherProfileId: firstProfile?.id || '',
        otherName,
        otherRole: isGroup ? `${otherParts.length + 1} members` : (ROLE_LABELS[firstProfile?.role] || firstProfile?.role || ''),
        otherAvatarUrl: isGroup ? '' : (firstProfile?.avatar_url || ''),
        lastMessage: lastMsg?.content || '',
        lastMessageTime: lastMsg ? new Date(lastMsg.created_at) : null,
        lastMessageIsMe: lastMsg?.sender_id === saProfileId,
        unread,
      });
    }

    items.sort((a, b) => {
      if (!a.lastMessageTime) return 1;
      if (!b.lastMessageTime) return -1;
      return b.lastMessageTime.getTime() - a.lastMessageTime.getTime();
    });

    setConversations(items);
    } catch (e) {
      console.error('fetchConversations error:', e);
    }
    setLoadingConvs(false);
  }, [saProfileId]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Auto-select first conversation with unread messages on initial load
  useEffect(() => {
    if (selectedId || loadingConvs || conversations.length === 0 || !saProfileId) return;
    const unreadConv = conversations.find(c => c.unread > 0);
    if (unreadConv) {
      handleSelectConversation(unreadConv.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, loadingConvs, saProfileId]);

  // ── Load messages for selected conversation ─────────────────────────────────

  const fetchMessages = useCallback(async (convId: string) => {
    if (!saProfileId) return;
    const { organizationId } = await getOrgContext();
    setLoadingMsgs(true);
    const { data } = await supabase
      .from('messages')
      .select('id, content, sender_id, image_url, created_at')
      .eq('organization_id', organizationId)
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data.map(m => ({
        id: m.id,
        from: m.sender_id === saProfileId ? 'me' as const : 'them' as const,
        text: m.content,
        timestamp: new Date(m.created_at),
        imageUrl: m.image_url || undefined,
      })));
    }
    setLoadingMsgs(false);
  }, [saProfileId]);

  function closeMsgSearch() {
    setMsgSearchOpen(false);
    setMsgSearchQuery('');
    setMsgSearchIndex(0);
  }

  // ── Select conversation ─────────────────────────────────────────────────────

  async function handleSelectConversation(convId: string) {
    setSelectedId(convId);
    setInputValue('');
    closeMsgSearch();
    await fetchMessages(convId);

    // Mark as read
    if (saProfileId) {
      const { organizationId } = await getOrgContext();
      const now = new Date().toISOString();
      lastReadAtRef.current = now;
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: now })
        .eq('organization_id', organizationId)
        .eq('conversation_id', convId)
        .eq('profile_id', saProfileId);

      // Clear unread in local state
      setConversations(prev => prev.map(c =>
        c.id === convId ? { ...c, unread: 0 } : c
      ));
    }
  }

  // ── Delete conversation ──────────────────────────────────────────────────────

  async function handleDeleteConversation(convId: string) {
    if (!saProfileId) return;
    const { organizationId } = await getOrgContext();
    await supabase.from('messages').delete().eq('organization_id', organizationId).eq('conversation_id', convId);
    await supabase.from('conversation_participants').delete().eq('organization_id', organizationId).eq('conversation_id', convId);
    await supabase.from('conversations').delete().eq('organization_id', organizationId).eq('id', convId);
    setConversations(prev => prev.filter(c => c.id !== convId));
    if (selectedId === convId) {
      setSelectedId(null);
      setMessages([]);
    }
    setDeleteConfirmId(null);
  }

  // ── Send message ────────────────────────────────────────────────────────────

  async function handleSend() {
    if (!inputValue.trim() || !selectedId || !saProfileId) return;
    const content = inputValue.trim();
    setInputValue('');

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const now = new Date();
    setMessages(prev => [...prev, { id: tempId, from: 'me', text: content, timestamp: now }]);

    // Update conversation preview
    setConversations(prev => prev.map(c =>
      c.id === selectedId
        ? { ...c, lastMessage: content, lastMessageTime: now, lastMessageIsMe: true }
        : c
    ));

    // Insert into Supabase
    const { data } = await supabase
      .from('messages')
      .insert({ organization_id: (await getOrgContext()).organizationId, conversation_id: selectedId, sender_id: saProfileId, content })
      .select('id')
      .single();

    if (data) {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: data.id } : m));
    }

    // Update my last_read_at
    const { organizationId: oid } = await getOrgContext();
    const nowStr = now.toISOString();
    lastReadAtRef.current = nowStr;
    await supabase
      .from('conversation_participants')
      .update({ last_read_at: nowStr })
      .eq('organization_id', oid)
      .eq('conversation_id', selectedId)
      .eq('profile_id', saProfileId);
  }

  // ── Realtime subscription ───────────────────────────────────────────────────

  useEffect(() => {
    if (!saProfileId) return;
    const channel = supabase
      .channel('superadmin-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as any;
        // Check if this message is for the currently selected conversation
        if (msg.conversation_id === selectedId && msg.sender_id !== saProfileId) {
          setMessages(prev => [...prev, {
            id: msg.id,
            from: 'them',
            text: msg.content,
            timestamp: new Date(msg.created_at),
            imageUrl: msg.image_url || undefined,
          }]);
          // Auto mark as read since we're viewing
          const now = new Date().toISOString();
          lastReadAtRef.current = now;
          getOrgContext().then(({ organizationId: oid }) =>
            supabase
              .from('conversation_participants')
              .update({ last_read_at: now })
              .eq('organization_id', oid)
              .eq('conversation_id', selectedId)
              .eq('profile_id', saProfileId)
              .then()
          );
        }
        // Refresh conversation list for unread counts
        fetchConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [saProfileId, selectedId, fetchConversations]);

  // ── Auto-scroll ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Scroll to search match
  useEffect(() => {
    if (msgSearchMatches.length > 0 && msgSearchOpen) {
      const matchIdx = msgSearchMatches[msgSearchIndex];
      const el = document.querySelector(`[data-msg-index="${matchIdx}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [msgSearchIndex, msgSearchMatches.length, msgSearchOpen]);

  // Close emoji picker on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setEmojiOpen(false);
    }
    if (emojiOpen) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [emojiOpen]);

  function insertEmoji(emoji: string) {
    setInputValue((prev) => prev + emoji);
    setEmojiOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  // Filter conversations by search
  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.otherName.toLowerCase().includes(q) || c.otherRole.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q);
  });

  // Group messages by date
  function groupMessagesByDate(msgs: DisplayMessage[]): { label: string; msgs: DisplayMessage[] }[] {
    const groups: { label: string; msgs: DisplayMessage[] }[] = [];
    for (const msg of msgs) {
      const label = getDateLabel(msg.timestamp);
      const last = groups[groups.length - 1];
      if (last && last.label === label) { last.msgs.push(msg); } else { groups.push({ label, msgs: [msg] }); }
    }
    return groups;
  }

  function getLastMineIndex(msgs: DisplayMessage[]): number {
    for (let i = msgs.length - 1; i >= 0; i--) { if (msgs[i].from === 'me') return i; }
    return -1;
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: 'var(--bg-offwhite)' }}>

      {/* ── Left panel ──────────────────────────────────────────────────────── */}
      <div style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--surface-white)', borderRight: '1px solid var(--border-color)' }}>

        {/* Panel header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 16px', flexShrink: 0 }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Messages</h2>
          <button
            title="New group chat"
            onClick={openNewGroupDialog}
            style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'background-color 0.15s' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Plus style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '0 16px 12px', flexShrink: 0, position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
            <Input
              type="text"
              placeholder="Search people & conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              style={{ paddingLeft: '32px', fontSize: '13px', height: '36px' }}
            />
          </div>

          {/* Staff search results dropdown */}
          {searchFocused && staffResults.length > 0 && (
            <div style={{ position: 'absolute', left: '16px', right: '16px', top: '100%', backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.14)', zIndex: 20, maxHeight: '240px', overflowY: 'auto' }}>
              <div style={{ padding: '8px 12px 4px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Start a conversation</div>
              {staffResults.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleStartConversation(s)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <ChatAvatar name={`${s.first_name} ${s.last_name}`} color={getAvatarColor(s.id)} size={32} photoUrl={s.avatar_url || undefined} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.first_name} {s.last_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{ROLE_LABELS[s.role] || s.role}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingConvs ? (
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Loading conversations...</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No conversations yet</p>
            </div>
          ) : filteredConversations.map((conv) => {
            const isActive = conv.id === selectedId;
            const previewText = conv.lastMessageIsMe ? `You: ${conv.lastMessage}` : conv.lastMessage;

            return (
              <div
                key={conv.id}
                style={{ position: 'relative' }}
                onMouseEnter={(e) => { const del = e.currentTarget.querySelector('[data-delete-btn]') as HTMLElement; if (del) del.style.opacity = '1'; }}
                onMouseLeave={(e) => { const del = e.currentTarget.querySelector('[data-delete-btn]') as HTMLElement; if (del) del.style.opacity = '0'; }}
              >
                <button
                  onClick={() => handleSelectConversation(conv.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 16px',
                    backgroundColor: isActive ? 'var(--surface-elevated)' : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-elevated)'; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                >
                  {conv.isGroup ? (
                    <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#2D6A4F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Users style={{ width: 20, height: 20, color: '#fff' }} />
                    </div>
                  ) : (
                    <ChatAvatar name={conv.otherName} color={getAvatarColor(conv.otherProfileId)} size={40} photoUrl={conv.otherAvatarUrl} />
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
                        {conv.otherName}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', flexShrink: 0, marginLeft: '8px' }}>
                        {getTimeLabel(conv.lastMessageTime)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1px', display: 'block' }}>
                        {conv.otherRole}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>
                        {previewText}
                      </span>
                      {conv.unread > 0 && (
                        <span style={{ flexShrink: 0, marginLeft: '8px', backgroundColor: '#d4183d', color: '#fff', fontSize: '11px', fontWeight: 700, borderRadius: '999px', minWidth: '20px', height: '20px', padding: '0 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          {conv.unread > 99 ? '99+' : conv.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {/* Delete button — visible on hover */}
                <button
                  data-delete-btn
                  title="Delete conversation"
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(conv.id); }}
                  style={{ position: 'absolute', top: '8px', right: '8px', width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--surface-white)', boxShadow: '0 1px 4px rgba(0,0,0,0.10)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', opacity: 0, transition: 'opacity 0.15s, color 0.15s', zIndex: 5 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#d4183d'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; }}
                >
                  <Trash2 style={{ width: '14px', height: '14px' }} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right panel ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', backgroundColor: 'var(--surface-white)' }}>
        {selectedConv ? (
          <>
            {/* Chat header */}
            <div style={{ height: '64px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-white)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {selectedConv.isGroup ? (
                  <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#2D6A4F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Users style={{ width: 20, height: 20, color: '#fff' }} />
                  </div>
                ) : (
                  <ChatAvatar name={selectedConv.otherName} color={getAvatarColor(selectedConv.otherProfileId)} size={40} photoUrl={selectedConv.otherAvatarUrl} />
                )}
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                    {selectedConv.otherName}
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {selectedConv.otherRole}
                  </span>
                </div>
              </div>
              <button
                title="Search in conversation"
                onClick={() => setMsgSearchOpen(v => !v)}
                style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: msgSearchOpen ? 'var(--surface-elevated)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'background-color 0.15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                onMouseLeave={(e) => { if (!msgSearchOpen) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <Search style={{ width: '16px', height: '16px' }} />
              </button>
            </div>

            {/* In-conversation search bar */}
            {msgSearchOpen && (
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-white)' }}>
                <Search style={{ width: '14px', height: '14px', color: 'var(--text-secondary)', flexShrink: 0 }} />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search messages..."
                  value={msgSearchQuery}
                  onChange={(e) => { setMsgSearchQuery(e.target.value); setMsgSearchIndex(0); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && msgSearchMatches.length > 0) setMsgSearchIndex(i => (i + 1) % msgSearchMatches.length);
                    if (e.key === 'Escape') closeMsgSearch();
                  }}
                  style={{ flex: 1, border: 'none', outline: 'none', fontSize: '13px', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                />
                {msgSearchQuery && (
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {msgSearchMatches.length === 0 ? 'No results' : `${msgSearchIndex + 1} of ${msgSearchMatches.length}`}
                  </span>
                )}
                <button onClick={() => msgSearchMatches.length > 0 && setMsgSearchIndex(i => (i - 1 + msgSearchMatches.length) % msgSearchMatches.length)} disabled={msgSearchMatches.length === 0} style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', opacity: msgSearchMatches.length === 0 ? 0.3 : 1 }}>
                  <ChevronUp style={{ width: '14px', height: '14px' }} />
                </button>
                <button onClick={() => msgSearchMatches.length > 0 && setMsgSearchIndex(i => (i + 1) % msgSearchMatches.length)} disabled={msgSearchMatches.length === 0} style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', opacity: msgSearchMatches.length === 0 ? 0.3 : 1 }}>
                  <ChevronDown style={{ width: '14px', height: '14px' }} />
                </button>
                <button onClick={closeMsgSearch} style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <X style={{ width: '14px', height: '14px' }} />
                </button>
              </div>
            )}

            {/* Messages area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column' }}>
              {loadingMsgs ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px' }}>
                  <MessageSquare style={{ width: 40, height: 40, color: 'var(--border-color)' }} />
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>No messages yet. Start the conversation!</p>
                </div>
              ) : (() => {
                const groups = groupMessagesByDate(messages);
                const lastMineIndex = getLastMineIndex(messages);

                return groups.map((group) => (
                  <div key={group.label}>
                    <DateSeparator label={group.label} />
                    {group.msgs.map((msg) => {
                      const globalIndex = messages.findIndex((m) => m.id === msg.id);
                      const isLastMine = globalIndex === lastMineIndex;
                      const isMe = msg.from === 'me';

                      return (
                        <div key={msg.id} data-msg-index={globalIndex} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: '8px', marginBottom: '8px', borderRadius: '12px', outline: msgSearchOpen && msgSearchMatches[msgSearchIndex] === globalIndex ? '2px solid #3B82F6' : 'none', outlineOffset: '4px', transition: 'outline 0.2s' }}>
                          {/* Their avatar */}
                          {!isMe && (
                            <div style={{ flexShrink: 0 }}>
                              <ChatAvatar name={selectedConv.otherName} color={getAvatarColor(selectedConv.otherProfileId)} size={28} photoUrl={selectedConv.otherAvatarUrl} />
                            </div>
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '60%' }}>
                            {/* Image if present */}
                            {msg.imageUrl && (
                              <img src={msg.imageUrl} alt="" style={{ maxWidth: '280px', maxHeight: '200px', borderRadius: '12px', marginBottom: msg.text ? '4px' : 0, objectFit: 'cover', cursor: 'pointer' }} />
                            )}
                            {msg.text && (
                              <div style={{
                                padding: '10px 14px',
                                borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                backgroundColor: isMe ? '#C2671A' : 'var(--surface-elevated)',
                                color: isMe ? '#fff' : 'var(--text-primary)',
                                fontSize: '14px', lineHeight: 1.5, wordBreak: 'break-word',
                              }}>
                                {msg.text}
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{formatTime(msg.timestamp)}</span>
                              {isMe && isLastMine && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                  <CheckCheck style={{ width: '12px', height: '12px' }} /> Read
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ));
              })()}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div style={{ flexShrink: 0, borderTop: '1px solid var(--border-color)', padding: '16px', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--surface-white)' }}>
              <button
                title="Attach file"
                style={{ width: '36px', height: '36px', flexShrink: 0, borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'background-color 0.15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Paperclip style={{ width: '16px', height: '16px' }} />
              </button>

              <Input
                type="text"
                placeholder="Type a message..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ flex: 1, fontSize: '14px', height: '36px' }}
              />

              {/* Emoji picker */}
              <div ref={emojiRef} style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  title="Emoji"
                  onClick={() => setEmojiOpen((v) => !v)}
                  style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: emojiOpen ? 'var(--surface-elevated)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'background-color 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                  onMouseLeave={(e) => { if (!emojiOpen) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <Smile style={{ width: '16px', height: '16px' }} />
                </button>

                {emojiOpen && (
                  <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', right: 0, width: '420px', backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.14)', zIndex: 40, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', padding: '8px 8px 0', gap: '2px' }}>
                      {EMOJI_GROUPS.map((g, i) => (
                        <button key={g.label} onClick={() => setEmojiTab(i)} style={{ flex: 1, padding: '6px 4px', borderRadius: '6px 6px 0 0', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', backgroundColor: emojiTab === i ? 'var(--surface-elevated)' : 'transparent', color: emojiTab === i ? 'var(--text-primary)' : 'var(--text-secondary)', borderBottom: emojiTab === i ? '2px solid #C2671A' : '2px solid transparent', transition: 'all 0.15s' }}>
                          {g.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '2px', padding: '12px 8px', maxHeight: '200px', overflowY: 'auto' }}>
                      {EMOJI_GROUPS[emojiTab].emojis.map((emoji, i) => (
                        <button key={`${emoji}-${i}`} onClick={() => insertEmoji(emoji)} style={{ width: '36px', height: '36px', borderRadius: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.15s' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                style={{ width: '36px', height: '36px', flexShrink: 0, borderRadius: '8px', border: 'none', backgroundColor: inputValue.trim() ? '#C2671A' : 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: inputValue.trim() ? 'pointer' : 'not-allowed', transition: 'background-color 0.15s' }}
              >
                <Send style={{ width: '16px', height: '16px', color: '#fff' }} />
              </button>
            </div>
          </>
        ) : (
          /* Empty state */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <MessageSquare style={{ width: '48px', height: '48px', color: '#C2671A', opacity: 0.6 }} />
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Select a conversation
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
              Choose a staff member to start messaging
            </p>
          </div>
        )}
      </div>

      {/* ── New group chat dialog ──────────────────────────────────────────── */}
      {newGroupOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setNewGroupOpen(false)}>
          <div style={{ backgroundColor: 'var(--surface-white)', borderRadius: '12px', padding: '24px', width: '440px', maxWidth: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.18)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>New Group Chat</h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>Select 2 or more people to start a group conversation.</p>

            <input
              type="text"
              placeholder="Group name (optional)"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px', marginBottom: '12px', outline: 'none', backgroundColor: 'transparent', color: 'var(--text-primary)', boxSizing: 'border-box' }}
            />

            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '16px', maxHeight: '300px' }}>
              {allStaff.map(s => {
                const selected = groupSelectedIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => setGroupSelectedIds(prev => selected ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: 'none', backgroundColor: selected ? 'var(--surface-elevated)' : 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.15s', borderBottom: '1px solid var(--border-color)' }}
                    onMouseEnter={(e) => { if (!selected) e.currentTarget.style.backgroundColor = 'var(--surface-elevated)'; }}
                    onMouseLeave={(e) => { if (!selected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <div style={{ width: '20px', height: '20px', borderRadius: '4px', border: selected ? 'none' : '2px solid var(--border-color)', backgroundColor: selected ? '#2D6A4F' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {selected && <CheckCheck style={{ width: '12px', height: '12px', color: '#fff' }} />}
                    </div>
                    <ChatAvatar name={`${s.first_name} ${s.last_name}`} color={getAvatarColor(s.id)} size={32} photoUrl={s.avatar_url || undefined} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.first_name} {s.last_name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{ROLE_LABELS[s.role] || s.role}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{groupSelectedIds.length} selected</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setNewGroupOpen(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-white)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)' }}>Cancel</button>
                <button onClick={handleCreateGroup} disabled={groupSelectedIds.length < 2} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: groupSelectedIds.length < 2 ? 'var(--border-color)' : '#2D6A4F', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: groupSelectedIds.length < 2 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users style={{ width: '14px', height: '14px' }} /> Create Group
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation dialog ─────────────────────────────────────── */}
      {deleteConfirmId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setDeleteConfirmId(null)}>
          <div style={{ backgroundColor: 'var(--surface-white)', borderRadius: '12px', padding: '24px', width: '400px', maxWidth: '90vw', boxShadow: '0 16px 48px rgba(0,0,0,0.18)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Delete conversation?</h3>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              This will permanently delete all messages in this conversation for both participants. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-white)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)' }}>
                Cancel
              </button>
              <button onClick={() => handleDeleteConversation(deleteConfirmId)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#d4183d', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
