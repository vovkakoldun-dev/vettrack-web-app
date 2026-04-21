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
  FileText,
  Download,
  Image as ImageIcon,
  Forward,
  Microscope,
  ClipboardList,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { Input } from '../../components/ui/input';
import { supabase } from '../../../lib/supabase';
import { useTenantDb } from '../../context/TenantContext';
import { ForwardMessageDialog, type ForwardableMessage } from '../../components/ForwardMessageDialog';
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

type AttachmentMeta = {
  type: 'record' | 'lab';
  id: string;
  title: string;
  petName: string;
  petImage?: string;
  date: string;
  status: string;
  recordType?: string;
  vet?: string;
  summary?: string;
  fileUrl?: string;
  fileName?: string;
};

type RecordPickItem = {
  id: string;
  recordNumber: string;
  recordType: string;
  petName: string;
  petImage: string;
  date: string;
  vet: string;
  summary: string;
  status: string;
};

type LabPickItem = {
  id: string;
  fileName: string;
  fileUrl: string;
  testPanel: string;
  petName: string;
  petImage: string;
  date: string;
  status: string;
  uploadedBy: string;
};

type DisplayMessage = {
  id: string;
  from: 'me' | 'them';
  text: string;
  timestamp: Date;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  forwardedFromName?: string;
  attachmentMeta?: AttachmentMeta;
};

type Reaction = {
  emoji: string;
  users: string[];
};

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

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
  const db = useTenantDb();
  const [saProfileId, setSaProfileId] = useState<string | null>(null);
  const [saFullName, setSaFullName] = useState<string>('Super Administrator');
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Forward message
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<ForwardableMessage | null>(null);

  // Resolve the superadmin profile ID (not the auth user)
  useEffect(() => {
    (async () => {
      const { data } = await db
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('role', 'superadmin')
        .single();
      if (data) {
        setSaProfileId(data.id);
        const full = `${data.first_name || ''} ${data.last_name || ''}`.trim();
        if (full) setSaFullName(full);
      }
    })();
  }, []);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  // Attachment state (images + files)
  const chatImageRef = useRef<HTMLInputElement>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const [recordPickerOpen, setRecordPickerOpen] = useState(false);
  const [labPickerOpen, setLabPickerOpen] = useState(false);
  const [availableRecords, setAvailableRecords] = useState<RecordPickItem[]>([]);
  const [availableLabs, setAvailableLabs] = useState<LabPickItem[]>([]);
  const [pickerSearch, setPickerSearch] = useState('');
  const [attachedRecord, setAttachedRecord] = useState<AttachmentMeta | null>(null);

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

  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastReadAtRef = useRef<string | null>(null);
  const initialLoadRef = useRef(true);
  const prependingRef = useRef(false);
  const prevScrollInfoRef = useRef<{ height: number; top: number }>({ height: 0, top: 0 });
  const MESSAGES_PAGE_SIZE = 30;
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null);

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
      // Staff-only chat: exclude pet owners from search results
      const { data } = await db
        .from('profiles')
        .select('id, first_name, last_name, role, avatar_url')
        .eq('organization_id', organizationId)
        .neq('id', saProfileId)
        .neq('role', 'owner')
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
        .limit(8);
      // Only exclude DIRECT conversation partners so group members remain searchable
      const existingDirectIds = new Set(
        conversations.filter(c => !c.isGroup).map(c => c.otherProfileId)
      );
      setStaffResults((data || []).filter(s => !existingDirectIds.has(s.id)));
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, saProfileId, conversations]);

  // ── Start new direct conversation ─────────────────────────────────────────────

  async function handleStartConversation(staff: StaffResult) {
    if (!saProfileId) return;
    const { organizationId } = await getOrgContext();

    // Check if a direct conversation already exists between these two users
    const { data: myConvs } = await db
      .from('conversation_participants')
      .select('conversation_id')
      .eq('organization_id', organizationId)
      .eq('profile_id', saProfileId);
    const { data: theirConvs } = await db
      .from('conversation_participants')
      .select('conversation_id')
      .eq('organization_id', organizationId)
      .eq('profile_id', staff.id);

    let existingConvId: string | null = null;
    if (myConvs && theirConvs) {
      const theirSet = new Set(theirConvs.map(c => c.conversation_id));
      const shared = myConvs.filter(c => theirSet.has(c.conversation_id));
      if (shared.length > 0) {
        const { data: convMeta } = await db
          .from('conversations')
          .select('id, type')
          .in('id', shared.map(s => s.conversation_id))
          .eq('type', 'direct')
          .limit(1)
          .single();
        if (convMeta) existingConvId = convMeta.id;
      }
    }

    if (existingConvId) {
      // Un-hide if it was previously hidden by this user
      await db.from('conversation_participants')
        .update({ hidden_at: null })
        .eq('organization_id', organizationId)
        .eq('conversation_id', existingConvId)
        .eq('profile_id', saProfileId);
      setSearchQuery('');
      setStaffResults([]);
      await fetchConversations();
      setSelectedId(existingConvId);
      return;
    }

    // No existing conversation — create a new one
    const { data: conv } = await db
      .from('conversations')
      .insert({ organization_id: organizationId, type: 'direct', created_by: saProfileId })
      .select('id')
      .single();
    if (!conv) return;
    await db.from('conversation_participants').insert([
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
    const { data: conv } = await db
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
    await db.from('conversation_participants').insert(participants);
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
    // Staff-only — exclude pet owners from group chat member list
    const { data } = await db
      .from('profiles')
      .select('id, first_name, last_name, role, avatar_url')
      .eq('organization_id', organizationId)
      .neq('id', saProfileId)
      .neq('role', 'owner')
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
    const { data: parts } = await db
      .from('conversation_participants')
      .select('conversation_id')
      .eq('organization_id', organizationId)
      .eq('profile_id', saProfileId)
      .is('hidden_at', null);
    if (!parts || parts.length === 0) { setLoadingConvs(false); return; }

    const convIds = parts.map(p => p.conversation_id);

    // Step 1: Fetch metadata, participants, and last messages in parallel
    const [convMetaRes, allPartsRes, myPartsRes, lastMsgsRes] = await Promise.all([
      db.from('conversations').select('id, type, title').eq('organization_id', organizationId).in('id', convIds),
      db.from('conversation_participants')
        .select('conversation_id, profile_id, last_read_at, profiles:profiles!conv_participants_profile_id_fkey(id, first_name, last_name, role, avatar_url)')
        .eq('organization_id', organizationId).in('conversation_id', convIds).neq('profile_id', saProfileId),
      db.from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('organization_id', organizationId).in('conversation_id', convIds).eq('profile_id', saProfileId),
      db.from('messages')
        .select('conversation_id, content, sender_id, created_at')
        .eq('organization_id', organizationId).in('conversation_id', convIds)
        .order('created_at', { ascending: false }).limit(convIds.length * 2),
    ]);

    // Step 2: Compute cutoff from last_read_at, then only fetch actually-unread messages
    const myParts = myPartsRes.data || [];
    const earliestLastRead = myParts.reduce((min: string, p: any) => {
      if (!p.last_read_at) return '1970-01-01T00:00:00Z';
      return p.last_read_at < min ? p.last_read_at : min;
    }, new Date().toISOString());

    const unreadRes = await db.from('messages')
      .select('conversation_id, created_at')
      .eq('organization_id', organizationId).in('conversation_id', convIds).neq('sender_id', saProfileId)
      .gt('created_at', earliestLastRead);

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
      // Staff-only chat: hide direct conversations whose counterparty is a pet owner
      if (!isGroup && firstProfile?.role === 'owner') continue;

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
        otherRole: groupTitle === 'HugoChat' ? 'HugoIT Updates' : isGroup ? `${otherParts.length + 1} members` : (ROLE_LABELS[firstProfile?.role] || firstProfile?.role || ''),
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

  // Map DB row → UI message
  const mapDbMessage = useCallback((m: any) => ({
    id: m.id,
    from: m.sender_id === saProfileId ? 'me' as const : 'them' as const,
    text: m.content,
    timestamp: new Date(m.created_at),
    imageUrl: m.image_url || undefined,
    fileUrl: m.file_url || undefined,
    fileName: m.file_name || undefined,
    fileSize: m.file_size || undefined,
    forwardedFromName: m.forwarded_from_name || undefined,
    attachmentMeta: m.attachment_meta || undefined,
  }), [saProfileId]);

  const fetchMessages = useCallback(async (convId: string) => {
    if (!saProfileId) return;
    const { organizationId } = await getOrgContext();
    setLoadingMsgs(true);
    initialLoadRef.current = true;
    // Load most recent page only, reverse for display (oldest→newest)
    const { data } = await db
      .from('messages')
      .select('id, content, sender_id, image_url, file_url, file_name, file_size, forwarded_from_name, attachment_meta, created_at')
      .eq('organization_id', organizationId)
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_PAGE_SIZE);

    if (data) {
      setHasMoreMessages(data.length >= MESSAGES_PAGE_SIZE);
      const reversed = [...data].reverse();
      setMessages(reversed.map(mapDbMessage));
    }
    if (data && data.length > 0) {
      const msgIds = data.map((m: { id: string }) => m.id);
      const { data: rxns } = await db
        .from('message_reactions')
        .select('message_id, emoji, user_id')
        .in('message_id', msgIds);
      if (rxns) {
        const grouped: Record<string, Reaction[]> = {};
        for (const r of rxns) {
          if (!grouped[r.message_id]) grouped[r.message_id] = [];
          const existing = grouped[r.message_id].find(rx => rx.emoji === r.emoji);
          if (existing) existing.users.push(r.user_id);
          else grouped[r.message_id] = [...grouped[r.message_id], { emoji: r.emoji, users: [r.user_id] }];
        }
        setReactions(grouped);
      }
    }
    setLoadingMsgs(false);
  }, [saProfileId, mapDbMessage]);

  // Lazy-load older messages when scrolling near the top
  const loadMoreMessages = useCallback(async () => {
    if (!saProfileId || !selectedId || loadingMore || !hasMoreMessages) return;
    if (messages.length === 0) return;
    const oldest = messages[0];
    if (!oldest?.timestamp) return;

    const container = messagesContainerRef.current;
    if (container) {
      prevScrollInfoRef.current = { height: container.scrollHeight, top: container.scrollTop };
    }
    prependingRef.current = true;
    setLoadingMore(true);

    try {
      const { organizationId } = await getOrgContext();
      const { data } = await db
        .from('messages')
        .select('id, content, sender_id, image_url, file_url, file_name, file_size, forwarded_from_name, attachment_meta, created_at')
        .eq('organization_id', organizationId)
        .eq('conversation_id', selectedId)
        .lt('created_at', oldest.timestamp.toISOString())
        .order('created_at', { ascending: false })
        .limit(MESSAGES_PAGE_SIZE);

      if (data) {
        setHasMoreMessages(data.length >= MESSAGES_PAGE_SIZE);
        const reversed = [...data].reverse();
        const older = reversed.map(mapDbMessage);
        setMessages(prev => [...older, ...prev]);

        if (data.length > 0) {
          const msgIds = data.map((m: { id: string }) => m.id);
          const { data: rxns } = await db
            .from('message_reactions')
            .select('message_id, emoji, user_id')
            .in('message_id', msgIds);
          if (rxns) {
            setReactions(prev => {
              const next = { ...prev };
              for (const r of rxns) {
                if (!next[r.message_id]) next[r.message_id] = [];
                const existing = next[r.message_id].find(rx => rx.emoji === r.emoji);
                if (existing) {
                  if (!existing.users.includes(r.user_id)) existing.users.push(r.user_id);
                } else {
                  next[r.message_id] = [...next[r.message_id], { emoji: r.emoji, users: [r.user_id] }];
                }
              }
              return next;
            });
          }
        }
      }
    } finally {
      setLoadingMore(false);
    }
  }, [saProfileId, selectedId, db, messages, loadingMore, hasMoreMessages, mapDbMessage]);

  const handleMessagesScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const t = e.currentTarget;
    if (t.scrollTop < 100 && !loadingMore && hasMoreMessages) {
      loadMoreMessages();
    }
  }, [loadingMore, hasMoreMessages, loadMoreMessages]);

  async function toggleReaction(messageId: string, emoji: string) {
    if (!saProfileId) return;
    const msgReactions = reactions[messageId] || [];
    const existing = msgReactions.find(r => r.emoji === emoji);
    const alreadyReacted = existing?.users.includes(saProfileId);
    setReactions(prev => {
      const current = [...(prev[messageId] || [])];
      if (alreadyReacted) {
        const idx = current.findIndex(r => r.emoji === emoji);
        if (idx >= 0) {
          current[idx] = { ...current[idx], users: current[idx].users.filter(u => u !== saProfileId) };
          if (current[idx].users.length === 0) current.splice(idx, 1);
        }
      } else {
        const idx = current.findIndex(r => r.emoji === emoji);
        if (idx >= 0) current[idx] = { ...current[idx], users: [...current[idx].users, saProfileId] };
        else current.push({ emoji, users: [saProfileId] });
      }
      return { ...prev, [messageId]: current };
    });
    if (alreadyReacted) {
      await db.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', saProfileId).eq('emoji', emoji);
    } else {
      await db.from('message_reactions').insert({ message_id: messageId, user_id: saProfileId, emoji });
    }
  }

  function closeMsgSearch() {
    setMsgSearchOpen(false);
    setMsgSearchQuery('');
    setMsgSearchIndex(0);
  }

  // ── Select conversation ─────────────────────────────────────────────────────

  async function handleSelectConversation(convId: string) {
    setSelectedId(convId);
    setInputValue('');
    setOtherLastReadAt(null);
    closeMsgSearch();
    clearImagePreview();
    clearAttachedFile();
    await fetchMessages(convId);

    // Mark as read + fetch other participant's last_read_at
    if (saProfileId) {
      const { organizationId } = await getOrgContext();
      const now = new Date().toISOString();
      lastReadAtRef.current = now;
      await db
        .from('conversation_participants')
        .update({ last_read_at: now })
        .eq('organization_id', organizationId)
        .eq('conversation_id', convId)
        .eq('profile_id', saProfileId);

      // Fetch the other participant's last_read_at
      const { data: otherParts } = await db
        .from('conversation_participants')
        .select('last_read_at')
        .eq('organization_id', organizationId)
        .eq('conversation_id', convId)
        .neq('profile_id', saProfileId);
      if (otherParts && otherParts.length > 0) {
        // For 1:1 chats use their last_read_at; for groups use the earliest
        const readAts = otherParts.map(p => p.last_read_at).filter(Boolean) as string[];
        setOtherLastReadAt(readAts.length > 0 ? readAts.sort()[0] : null);
      }

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
    // Soft-delete: hide conversation for current user only (other participant still sees it)
    await db.from('conversation_participants')
      .update({ hidden_at: new Date().toISOString() })
      .eq('organization_id', organizationId)
      .eq('conversation_id', convId)
      .eq('profile_id', saProfileId);
    setConversations(prev => prev.filter(c => c.id !== convId));
    if (selectedId === convId) {
      setSelectedId(null);
      setMessages([]);
    }
    setDeleteConfirmId(null);
  }

  // ── Image / file handling ───────────────────────────────────────────────────

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setAttachedFile(null);
    setImagePreview(URL.createObjectURL(file));
    setAttachMenuOpen(false);
    e.target.value = '';
  }

  function clearImagePreview() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachedFile(file);
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setAttachMenuOpen(false);
    e.target.value = '';
  }

  function clearAttachedFile() {
    setAttachedFile(null);
  }

  function clearAttachedRecord() {
    setAttachedRecord(null);
  }

  async function fetchAvailableRecords() {
    const { organizationId } = await getOrgContext();
    const { data } = await db
      .from('medical_records')
      .select('id, record_number, record_type, status, visit_date, reason, clinical_notes, pets!left(name, photo_url), clients!left(first_name, last_name), staff!medical_records_vet_id_fkey!left(profiles:profiles!staff_profile_id_fkey(first_name, last_name))')
      .eq('organization_id', organizationId)
      .order('visit_date', { ascending: false })
      .limit(50);
    if (data) {
      setAvailableRecords(data.map((r: any) => ({
        id: r.id,
        recordNumber: r.record_number || r.id.slice(0, 8).toUpperCase(),
        recordType: r.record_type || 'Visit',
        petName: r.pets?.name ?? '—',
        petImage: r.pets?.photo_url || '',
        date: r.visit_date ? new Date(r.visit_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
        vet: r.staff?.profiles ? `Dr. ${r.staff.profiles.first_name} ${r.staff.profiles.last_name}` : '—',
        summary: r.reason || r.clinical_notes || '—',
        status: r.status || 'Final',
      })));
    }
  }

  async function fetchAvailableLabs() {
    const { organizationId } = await getOrgContext();
    const { data } = await db
      .from('lab_results')
      .select('id, file_name, file_url, test_panel, review_status, created_at, pet_id, pets!left(name, photo_url), uploader:profiles!lab_results_uploaded_by_fkey(first_name, last_name)')
      .eq('organization_id', organizationId)
      .not('file_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) {
      setAvailableLabs(data.map((r: any) => ({
        id: r.id,
        fileName: r.file_name || 'Unnamed file',
        fileUrl: r.file_url || '',
        testPanel: r.test_panel || 'General',
        petName: r.pets?.name ?? '—',
        petImage: r.pets?.photo_url || '',
        date: r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
        status: r.review_status === 'reviewed' ? 'Reviewed' : 'Awaiting Review',
        uploadedBy: r.uploader ? `${r.uploader.first_name} ${r.uploader.last_name}`.trim() : '—',
      })));
    }
  }

  function handlePickRecord(rec: RecordPickItem) {
    const meta: AttachmentMeta = {
      type: 'record',
      id: rec.id,
      title: rec.recordNumber,
      petName: rec.petName,
      petImage: rec.petImage,
      date: rec.date,
      status: rec.status,
      recordType: rec.recordType,
      vet: rec.vet,
      summary: rec.summary,
    };
    setAttachedRecord(meta);
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setAttachedFile(null);
    setRecordPickerOpen(false);
    setPickerSearch('');
  }

  function handlePickLab(lab: LabPickItem) {
    const meta: AttachmentMeta = {
      type: 'lab',
      id: lab.id,
      title: lab.testPanel,
      petName: lab.petName,
      petImage: lab.petImage,
      date: lab.date,
      status: lab.status,
      fileUrl: lab.fileUrl,
      fileName: lab.fileName,
    };
    setAttachedRecord(meta);
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setAttachedFile(null);
    setLabPickerOpen(false);
    setPickerSearch('');
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getFileIcon(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (['pdf'].includes(ext)) return '📄';
    if (['doc', 'docx'].includes(ext)) return '📝';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
    if (['ppt', 'pptx'].includes(ext)) return '📑';
    if (['zip', 'rar', '7z'].includes(ext)) return '📦';
    if (['mp4', 'mov', 'avi'].includes(ext)) return '🎬';
    if (['mp3', 'wav', 'ogg'].includes(ext)) return '🎵';
    return '📎';
  }

  // Close attach menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setAttachMenuOpen(false);
      }
    }
    if (attachMenuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [attachMenuOpen]);

  // ── Send message ────────────────────────────────────────────────────────────

  // ── Forward message ──────────────────────────────────────────────────────────
  // Insert one new message per target conversation, copying the original
  // text/image/file. The new messages are sent by the current user with the
  // current timestamp, so they slot naturally into each conversation timeline.
  async function handleForward(targetIds: string[], message: ForwardableMessage) {
    if (!saProfileId || targetIds.length === 0) return;
    const { organizationId } = await getOrgContext();
    const nowIso = new Date().toISOString();
    // Preserve the original author chain: if the source was already forwarded,
    // keep that name; otherwise label the forward with the original sender.
    const forwardedFromName = message.forwardedFromName || null;
    const rows = targetIds.map(convId => ({
      organization_id: organizationId,
      conversation_id: convId,
      sender_id: saProfileId,
      content: message.text || (message.imageUrl ? '📷 Image' : message.fileName ? `📎 ${message.fileName}` : ''),
      image_url: message.imageUrl || null,
      file_url: message.fileUrl || null,
      file_name: message.fileName || null,
      file_size: message.fileSize ?? null,
      forwarded_from_name: forwardedFromName,
      created_at: nowIso,
    }));
    const { data, error } = await db.from('messages').insert(rows).select('id, conversation_id');
    if (error) {
      console.error('[handleForward] insert failed:', error.message);
      throw error;
    }

    // If forwarding to the currently-open conversation, append locally
    if (selectedId && data) {
      const inserted = data.find(r => r.conversation_id === selectedId);
      if (inserted) {
        setMessages(prev => [...prev, {
          id: inserted.id,
          from: 'me',
          text: message.text || (message.imageUrl ? '📷 Image' : message.fileName ? `📎 ${message.fileName}` : ''),
          timestamp: new Date(nowIso),
          imageUrl: message.imageUrl,
          fileUrl: message.fileUrl,
          fileName: message.fileName,
          fileSize: message.fileSize,
          forwardedFromName: forwardedFromName || undefined,
        }]);
      }
    }

    const previewLabel = message.text || (message.imageUrl ? '📷 Image' : message.fileName ? `📎 ${message.fileName}` : '');
    setConversations(prev => prev.map(c =>
      targetIds.includes(c.id)
        ? { ...c, lastMessage: previewLabel, lastMessageTime: new Date(nowIso), lastMessageIsMe: true }
        : c
    ));
    fetchConversations();
  }

  async function handleSend() {
    if ((!inputValue.trim() && !imageFile && !attachedFile && !attachedRecord) || !selectedId || !saProfileId) return;
    const content = inputValue.trim();
    setInputValue('');
    const pendingImageFile = imageFile;
    const pendingPreview = imagePreview;
    const pendingAttachedFile = attachedFile;
    const pendingRecord = attachedRecord;
    setImageFile(null);
    setImagePreview(null);
    setAttachedFile(null);
    setAttachedRecord(null);

    const attachLabel = pendingRecord
      ? (pendingRecord.type === 'record' ? `📋 Record: ${pendingRecord.title}` : `🔬 Lab: ${pendingRecord.title}`)
      : pendingAttachedFile ? `📎 ${pendingAttachedFile.name}` : pendingImageFile ? '📷 Image' : '';

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const now = new Date();
    setMessages(prev => [...prev, {
      id: tempId,
      from: 'me',
      text: content || attachLabel,
      timestamp: now,
      imageUrl: pendingPreview || undefined,
      fileName: pendingAttachedFile?.name,
      fileSize: pendingAttachedFile?.size,
      attachmentMeta: pendingRecord || undefined,
    }]);

    // Update conversation preview
    setConversations(prev => prev.map(c =>
      c.id === selectedId
        ? { ...c, lastMessage: content || attachLabel, lastMessageTime: now, lastMessageIsMe: true }
        : c
    ));

    // Upload image if present
    let imageUrl: string | null = null;
    if (pendingImageFile) {
      setUploadingImage(true);
      const ext = pendingImageFile.name.split('.').pop() || 'png';
      const path = `msg-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('chat-images')
        .upload(path, pendingImageFile, { upsert: true, contentType: pendingImageFile.type });
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(path);
        imageUrl = urlData.publicUrl + '?t=' + Date.now();
      }
      setUploadingImage(false);
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    }

    // Upload file if present
    let fileUrl: string | null = null;
    let fileName: string | null = null;
    let fileSize: number | null = null;
    if (pendingAttachedFile) {
      setUploadingImage(true);
      fileName = pendingAttachedFile.name;
      fileSize = pendingAttachedFile.size;
      const safeName = `file-${Date.now()}-${pendingAttachedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: uploadErr } = await supabase.storage
        .from('chat-images')
        .upload(safeName, pendingAttachedFile, { upsert: true, contentType: pendingAttachedFile.type });
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(safeName);
        fileUrl = urlData.publicUrl + '?t=' + Date.now();
      }
      setUploadingImage(false);
    }

    // Insert into Supabase
    const { organizationId } = await getOrgContext();
    const msgContent = content || (pendingRecord
      ? (pendingRecord.type === 'record' ? `📋 Record: ${pendingRecord.title}` : `🔬 Lab: ${pendingRecord.title}`)
      : imageUrl ? '📷 Image' : fileName ? `📎 ${fileName}` : '');
    const insertPayload: any = {
      organization_id: organizationId,
      conversation_id: selectedId,
      sender_id: saProfileId,
      content: msgContent,
      image_url: imageUrl,
      file_url: fileUrl,
      file_name: fileName,
      file_size: fileSize,
    };
    if (pendingRecord) insertPayload.attachment_meta = pendingRecord;
    const { data } = await db
      .from('messages')
      .insert(insertPayload)
      .select('id')
      .single();

    if (data) {
      setMessages(prev => prev.map(m => m.id === tempId ? {
        ...m,
        id: data.id,
        imageUrl: imageUrl || m.imageUrl,
        fileUrl: fileUrl || undefined,
        fileName: fileName || m.fileName,
        fileSize: fileSize ?? m.fileSize,
        attachmentMeta: pendingRecord || undefined,
      } : m));
    }

    // Update my last_read_at
    const nowStr = now.toISOString();
    lastReadAtRef.current = nowStr;
    await db
      .from('conversation_participants')
      .update({ last_read_at: nowStr })
      .eq('organization_id', organizationId)
      .eq('conversation_id', selectedId)
      .eq('profile_id', saProfileId);
  }

  // ── Realtime subscription ───────────────────────────────────────────────────

  useEffect(() => {
    if (!saProfileId) return;
    const channel = supabase
      .channel('superadmin-chat')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_participants' }, (payload) => {
        const row = payload.new as any;
        // If the other person (not me) updated their last_read_at on the selected conversation
        if (row.conversation_id === selectedId && row.profile_id !== saProfileId && row.last_read_at) {
          setOtherLastReadAt(row.last_read_at);
        }
      })
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
            fileUrl: msg.file_url || undefined,
            fileName: msg.file_name || undefined,
            fileSize: msg.file_size || undefined,
            forwardedFromName: msg.forwarded_from_name || undefined,
            attachmentMeta: msg.attachment_meta || undefined,
          }]);
          // Auto mark as read since we're viewing
          const now = new Date().toISOString();
          lastReadAtRef.current = now;
          getOrgContext().then(({ organizationId: oid }) =>
            db
              .from('conversation_participants')
              .update({ last_read_at: now })
              .eq('organization_id', oid)
              .eq('conversation_id', selectedId)
              .eq('profile_id', saProfileId)
              .then()
          );
        }
        // Lightweight sidebar update — zero network requests
        setConversations(prev => {
          const updated = prev.map(c => {
            if (c.id !== msg.conversation_id) return c;
            return {
              ...c,
              lastMessage: msg.content || c.lastMessage,
              lastMessageTime: new Date(msg.created_at),
              lastMessageIsMe: msg.sender_id === saProfileId,
              unread: (msg.conversation_id !== selectedId && msg.sender_id !== saProfileId)
                ? c.unread + 1 : c.unread,
            };
          });
          return [...updated].sort((a, b) => {
            if (!a.lastMessageTime) return 1;
            if (!b.lastMessageTime) return -1;
            return b.lastMessageTime.getTime() - a.lastMessageTime.getTime();
          });
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [saProfileId, selectedId]);

  // ── Auto-scroll (initial jump to bottom, new msg smooths, prepend preserves) ──

  useEffect(() => {
    if (loadingMsgs) return;
    if (messages.length === 0) return;
    const container = messagesContainerRef.current;
    if (!container) return;

    if (prependingRef.current) {
      const prev = prevScrollInfoRef.current;
      requestAnimationFrame(() => {
        const diff = container.scrollHeight - prev.height;
        container.scrollTop = prev.top + diff;
        prependingRef.current = false;
      });
      return;
    }

    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      const jumpToBottom = () => { container.scrollTop = container.scrollHeight; };
      jumpToBottom();
      requestAnimationFrame(() => {
        jumpToBottom();
        setTimeout(jumpToBottom, 100);
      });
      return;
    }

    const distanceFromBottom = container.scrollHeight - container.clientHeight - container.scrollTop;
    if (distanceFromBottom < 200) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, loadingMsgs]);

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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter inserts a newline (like MS Teams / Slack)
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  }

  // Auto-resize the message textarea based on content (caps at ~6 lines)
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = 160;
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [inputValue]);

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

  const isHugoChat = selectedConv?.groupTitle === 'HugoChat';

  const spawnHugoStars = (e: React.MouseEvent) => {
    const msgEl = (e.currentTarget as HTMLElement).closest('[data-msg-index]');
    const refEl = msgEl?.querySelector('.hugo-glow-border');
    if (!refEl) return;
    const rect = refEl.getBoundingClientRect();
    const stars = ['✦', '✧', '⭑', '✶', '★'];
    const colors = ['#4ADE80', '#3B82F6', '#8B5CF6', '#F4A261', '#FFD700'];
    for (let i = 0; i < 14; i++) {
      const star = document.createElement('span');
      star.textContent = stars[Math.floor(Math.random() * stars.length)];
      const perim = Math.random();
      let x: number, y: number, outAngle: number;
      if (perim < 0.25) { x = Math.random() * rect.width; y = 0; outAngle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8; }
      else if (perim < 0.5) { x = Math.random() * rect.width; y = rect.height; outAngle = Math.PI / 2 + (Math.random() - 0.5) * 0.8; }
      else if (perim < 0.75) { x = 0; y = Math.random() * rect.height; outAngle = Math.PI + (Math.random() - 0.5) * 0.8; }
      else { x = rect.width; y = Math.random() * rect.height; outAngle = (Math.random() - 0.5) * 0.8; }
      const dist = 40 + Math.random() * 70;
      const dx = Math.cos(outAngle) * dist;
      const dy = Math.sin(outAngle) * dist;
      const dur = 600 + Math.random() * 500;
      star.style.cssText = `position:fixed;left:${rect.left + x}px;top:${rect.top + y}px;font-size:${10 + Math.random() * 10}px;color:${colors[i % colors.length]};pointer-events:none;z-index:9999;text-shadow:0 0 6px rgba(255,255,200,0.8);`;
      document.body.appendChild(star);
      star.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) scale(0.3)`, opacity: 0 },
      ], { duration: dur, easing: 'ease-out', fill: 'forwards' });
      setTimeout(() => star.remove(), dur + 100);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: 'var(--bg-offwhite)' }}>
      <style>{`
        @keyframes hugoGradientSpin {
          0%   { --hugo-angle: 0deg; }
          100% { --hugo-angle: 360deg; }
        }
        @property --hugo-angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
        .hugo-glow-border {
          position: relative;
          border-radius: 16px 16px 16px 4px;
          padding: 2px;
          background: conic-gradient(from var(--hugo-angle), #4ADE80, #3B82F6, #8B5CF6, #F4A261, #4ADE80);
          animation: hugoGradientSpin 4s linear infinite;
          box-shadow: 0 0 12px rgba(74,222,128,0.3), 0 0 24px rgba(59,130,246,0.2), 0 0 12px rgba(139,92,246,0.2);
        }
        .hugo-glow-border > div {
          border-radius: 14px 14px 14px 2px;
        }
        .theme-glass .hugo-glow-border > div {
          background-color: #1E2946 !important;
        }
      `}</style>

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
                    ...(conv.groupTitle === 'HugoChat' ? { borderLeft: '3px solid', borderImage: 'linear-gradient(to bottom, #4ADE80, #3B82F6, #8B5CF6, #F4A261) 1' } : {}),
                  }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-elevated)'; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                >
                  {conv.isGroup && conv.groupTitle === 'HugoChat' ? (
                    <img src="/logo-mini.svg" alt="HugoChat" style={{ width: 40, height: 40, flexShrink: 0 }} />
                  ) : conv.isGroup ? (
                    <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'var(--brand-green-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
                {selectedConv.isGroup && selectedConv.groupTitle === 'HugoChat' ? (
                  <img src="/logo-mini.svg" alt="HugoChat" style={{ width: 40, height: 40, flexShrink: 0 }} />
                ) : selectedConv.isGroup ? (
                  <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'var(--brand-green-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
            <div
              ref={messagesContainerRef}
              onScroll={handleMessagesScroll}
              style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column' }}
            >
              {loadingMore && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Loading older messages…</span>
                </div>
              )}
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
                      const isMe = isHugoChat ? false : msg.from === 'me';

                      return (
                        <div key={msg.id} data-msg-index={globalIndex} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: '8px', marginBottom: '8px', borderRadius: '12px', outline: msgSearchOpen && msgSearchMatches[msgSearchIndex] === globalIndex ? '2px solid #3B82F6' : 'none', outlineOffset: '4px', transition: 'outline 0.2s' }}>
                          {/* Their avatar */}
                          {!isMe && (
                            <div style={{ flexShrink: 0 }}>
                              {selectedConv.groupTitle === 'HugoChat' ? (
                                <img src="/logo-mini.svg" alt="HugoChat" style={{ width: 28, height: 28 }} />
                              ) : (
                                <ChatAvatar name={selectedConv.otherName} color={getAvatarColor(selectedConv.otherProfileId)} size={28} photoUrl={selectedConv.otherAvatarUrl} />
                              )}
                            </div>
                          )}

                          <div
                            style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '60%', position: 'relative' }}
                            onMouseEnter={() => setHoveredMsgId(msg.id)}
                            onMouseLeave={() => setHoveredMsgId(null)}
                          >
                            {hoveredMsgId === msg.id && !msg.id.startsWith('temp-') && (
                              <div style={{
                                position: 'absolute', top: '-32px',
                                [isMe ? 'right' : 'left']: '0',
                                display: 'flex', gap: '2px', padding: '4px 6px',
                                backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)',
                                borderRadius: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', zIndex: 10,
                              }}>
                                {QUICK_REACTIONS.map(emoji => {
                                  const msgRx = reactions[msg.id] || [];
                                  const myReaction = msgRx.find(r => r.emoji === emoji && r.users.includes(saProfileId!));
                                  return (
                                    <button key={emoji} onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, emoji); if (isHugoChat) spawnHugoStars(e); }}
                                      style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', backgroundColor: myReaction ? 'var(--surface-elevated)' : 'transparent', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.15s, background-color 0.15s' }}
                                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.25)'; e.currentTarget.style.backgroundColor = 'var(--surface-elevated)'; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; if (!myReaction) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                    >{emoji}</button>
                                  );
                                })}
                                {/* Divider + Forward */}
                                <div style={{ width: '1px', backgroundColor: 'var(--border-color)', margin: '4px 2px' }} />
                                <button
                                  title="Forward"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Preserve the original author when re-forwarding an already-forwarded message.
                                    // Otherwise resolve by whether the current user or the other party wrote it.
                                    const originalAuthor =
                                      msg.forwardedFromName
                                      || (msg.from === 'me' ? saFullName : (selectedConv?.otherName || 'Unknown'));
                                    setForwardMsg({
                                      id: msg.id,
                                      text: msg.text,
                                      imageUrl: msg.imageUrl,
                                      fileUrl: msg.fileUrl,
                                      fileName: msg.fileName,
                                      fileSize: msg.fileSize,
                                      forwardedFromName: originalAuthor,
                                    });
                                    setForwardOpen(true);
                                  }}
                                  style={{
                                    width: '28px', height: '28px', borderRadius: '50%', border: 'none',
                                    backgroundColor: 'transparent',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--text-secondary)',
                                    transition: 'transform 0.15s, background-color 0.15s, color 0.15s',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; e.currentTarget.style.backgroundColor = 'var(--surface-elevated)'; e.currentTarget.style.color = '#C2671A'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                >
                                  <Forward style={{ width: '15px', height: '15px' }} />
                                </button>
                              </div>
                            )}
                            <div className={isHugoChat && !isMe ? 'hugo-glow-border' : undefined} style={isHugoChat && !isMe ? { marginBottom: 0 } : undefined}>
                            <div style={{
                              padding: (msg.imageUrl || msg.fileUrl || msg.attachmentMeta) ? '4px' : '10px 14px',
                              borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                              backgroundColor: isMe ? '#C2671A' : 'var(--surface-elevated)',
                              color: isMe ? '#fff' : 'var(--text-primary)',
                              fontSize: '14px', lineHeight: 1.5, wordBreak: 'break-word',
                              overflow: 'hidden',
                            }}>
                              {msg.forwardedFromName && (
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  fontStyle: 'italic',
                                  opacity: 0.85,
                                  padding: (msg.imageUrl || msg.fileUrl || msg.attachmentMeta) ? '6px 10px 0' : '0 0 4px',
                                  color: isMe ? '#fff' : '#C2671A',
                                }}>
                                  <Forward style={{ width: '11px', height: '11px' }} />
                                  Forwarded from {msg.forwardedFromName}
                                </div>
                              )}
                              {msg.imageUrl && (
                                <img src={msg.imageUrl} alt="Attachment" style={{ maxWidth: '240px', maxHeight: '200px', borderRadius: msg.text && msg.text !== '📷 Image' ? '12px 12px 0 0' : '12px', display: 'block', objectFit: 'cover' }} />
                              )}
                              {msg.fileUrl && msg.fileName && (
                                <a
                                  href={msg.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '10px 12px', margin: '4px',
                                    borderRadius: '10px',
                                    backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : 'var(--bg-offwhite)',
                                    textDecoration: 'none', color: 'inherit',
                                    transition: 'background-color 0.15s',
                                    minWidth: '180px',
                                  }}
                                >
                                  <div style={{
                                    width: 36, height: 36, borderRadius: '8px',
                                    backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : 'var(--surface-elevated)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '18px', flexShrink: 0,
                                  }}>
                                    {getFileIcon(msg.fileName)}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {msg.fileName}
                                    </div>
                                    {msg.fileSize && (
                                      <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '1px' }}>
                                        {formatFileSize(msg.fileSize)}
                                      </div>
                                    )}
                                  </div>
                                  <Download style={{ width: 14, height: 14, opacity: 0.6, flexShrink: 0 }} />
                                </a>
                              )}
                              {msg.attachmentMeta && (
                                <div
                                  onClick={() => {
                                    if (msg.attachmentMeta!.type === 'record') {
                                      window.open(`/records/${msg.attachmentMeta!.id}`, '_blank');
                                    } else if (msg.attachmentMeta!.fileUrl) {
                                      window.open(msg.attachmentMeta!.fileUrl, '_blank');
                                    }
                                  }}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '10px 12px', margin: '4px',
                                    borderRadius: '10px',
                                    backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : 'var(--bg-offwhite)',
                                    cursor: 'pointer', minWidth: '200px', maxWidth: '280px',
                                    transition: 'background-color 0.15s',
                                  }}
                                >
                                  <div style={{
                                    width: 36, height: 36, borderRadius: '8px',
                                    backgroundColor: msg.attachmentMeta.type === 'record'
                                      ? (isMe ? 'rgba(0,0,0,0.08)' : 'rgba(45,106,79,0.12)')
                                      : (isMe ? 'rgba(0,0,0,0.08)' : 'rgba(236,72,153,0.12)'),
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                  }}>
                                    {msg.attachmentMeta.type === 'record'
                                      ? <ClipboardList style={{ width: 16, height: 16, color: isMe ? '#1a1a2e' : '#2D6A4F' }} />
                                      : <Microscope style={{ width: 16, height: 16, color: isMe ? '#1a1a2e' : '#EC4899' }} />}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {msg.attachmentMeta.type === 'record'
                                        ? `${msg.attachmentMeta.recordType} Record`
                                        : msg.attachmentMeta.title}
                                    </div>
                                    <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '1px' }}>
                                      {msg.attachmentMeta.petName} &middot; {msg.attachmentMeta.date}
                                    </div>
                                    {msg.attachmentMeta.type === 'record' && msg.attachmentMeta.vet && (
                                      <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '1px' }}>
                                        {msg.attachmentMeta.vet}
                                      </div>
                                    )}
                                  </div>
                                  <ExternalLink style={{ width: 14, height: 14, opacity: 0.6, flexShrink: 0 }} />
                                </div>
                              )}
                              {msg.text && msg.text !== '📷 Image' && !msg.text.startsWith('📎 ') && !msg.text.startsWith('📋 Record:') && !msg.text.startsWith('🔬 Lab:') && (
                                <div style={{ padding: (msg.imageUrl || msg.fileUrl || msg.attachmentMeta) ? '8px 10px 6px' : '0', whiteSpace: 'pre-wrap' }}>{isHugoChat && msg.text.startsWith('Welcome to HugoChat') ? <><strong style={{ fontSize: '16px' }}>Welcome to HugoChat</strong>{msg.text.slice('Welcome to HugoChat'.length)}</> : msg.text}</div>
                              )}
                            </div>
                            </div>

                            {(reactions[msg.id] || []).length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                {(reactions[msg.id] || []).map(rx => (
                                  <button key={rx.emoji} onClick={(e) => { toggleReaction(msg.id, rx.emoji); if (isHugoChat) spawnHugoStars(e); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '999px', border: '1px solid var(--border-color)', backgroundColor: rx.users.includes(saProfileId!) ? '#C2671A' : 'var(--surface-elevated)', color: rx.users.includes(saProfileId!) ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontSize: '13px', lineHeight: '20px', transition: 'background-color 0.15s' }}>
                                    <span>{rx.emoji}</span>
                                    {rx.users.length > 1 && <span style={{ fontSize: '11px', fontWeight: 600 }}>{rx.users.length}</span>}
                                  </button>
                                ))}
                              </div>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{formatTime(msg.timestamp)}</span>
                              {isMe && isLastMine && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '11px', color: otherLastReadAt && msg.timestamp.toISOString() <= otherLastReadAt ? 'var(--brand-green-text)' : 'var(--text-secondary)' }}>
                                  <CheckCheck style={{ width: '12px', height: '12px' }} />
                                  {otherLastReadAt && msg.timestamp.toISOString() <= otherLastReadAt ? ' Read' : ' Delivered'}
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

            {/* Image preview */}
            {imagePreview && (
              <div style={{ flexShrink: 0, borderTop: '1px solid var(--border-color)', padding: '12px 16px 0', backgroundColor: 'var(--surface-white)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={imagePreview} alt="Preview" style={{ maxWidth: '120px', maxHeight: '80px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                  <button
                    onClick={clearImagePreview}
                    style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#d4183d', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}
                  >x</button>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{imageFile?.name}</span>
              </div>
            )}

            {/* File preview */}
            {attachedFile && (
              <div style={{ flexShrink: 0, borderTop: '1px solid var(--border-color)', padding: '12px 16px 0', backgroundColor: 'var(--surface-white)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 12px', borderRadius: '10px',
                  backgroundColor: 'var(--surface-elevated)',
                  border: '1px solid var(--border-color)',
                }}>
                  <span style={{ fontSize: '20px' }}>{getFileIcon(attachedFile.name)}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                      {attachedFile.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {formatFileSize(attachedFile.size)}
                    </div>
                  </div>
                  <button
                    onClick={clearAttachedFile}
                    style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#d4183d', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}
                  >x</button>
                </div>
              </div>
            )}

            {/* Record / Lab preview */}
            {attachedRecord && (
              <div style={{ flexShrink: 0, borderTop: '1px solid var(--border-color)', padding: '12px 16px 0', backgroundColor: 'var(--surface-white)' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', borderRadius: '10px',
                  backgroundColor: attachedRecord.type === 'record' ? 'rgba(45,106,79,0.08)' : 'rgba(236,72,153,0.08)',
                  border: `1px solid ${attachedRecord.type === 'record' ? 'rgba(45,106,79,0.25)' : 'rgba(236,72,153,0.25)'}`,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '8px',
                    backgroundColor: attachedRecord.type === 'record' ? 'rgba(45,106,79,0.15)' : 'rgba(236,72,153,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {attachedRecord.type === 'record'
                      ? <ClipboardList style={{ width: 16, height: 16, color: '#2D6A4F' }} />
                      : <Microscope style={{ width: 16, height: 16, color: '#EC4899' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {attachedRecord.type === 'record' ? `${attachedRecord.recordType} — ${attachedRecord.title}` : attachedRecord.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '1px' }}>
                      {attachedRecord.petName} &middot; {attachedRecord.date}
                    </div>
                  </div>
                  <button
                    onClick={clearAttachedRecord}
                    style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#d4183d', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}
                  >x</button>
                </div>
              </div>
            )}

            {/* Input area */}
            {selectedConv.groupTitle === 'HugoChat' ? (
              <div style={{ flexShrink: 0, borderTop: '1px solid var(--border-color)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'var(--surface-white)', color: 'var(--text-secondary)', fontSize: 13 }}>
                <Lock style={{ width: 14, height: 14 }} />
                This channel is read-only — updates are posted by the HugoIT team
              </div>
            ) : (
            <div style={{ flexShrink: 0, borderTop: (imagePreview || attachedFile || attachedRecord) ? 'none' : '1px solid var(--border-color)', padding: '16px', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--surface-white)' }}>
              <input type="file" ref={chatImageRef} accept="image/*" style={{ display: 'none' }} onChange={handleImageSelect} />
              <input type="file" ref={chatFileRef} accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.zip,.rar,.7z,.mp4,.mov,.mp3,.wav" style={{ display: 'none' }} onChange={handleFileSelect} />
              <div ref={attachMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  title="Attach"
                  onClick={() => setAttachMenuOpen(v => !v)}
                  disabled={uploadingImage}
                  style={{ width: '36px', height: '36px', flexShrink: 0, borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: attachMenuOpen ? 'var(--surface-elevated)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'background-color 0.15s', opacity: uploadingImage ? 0.5 : 1 }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                  onMouseLeave={(e) => { if (!attachMenuOpen) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <Paperclip style={{ width: '16px', height: '16px' }} />
                </button>

                {attachMenuOpen && (
                  <div style={{
                    position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
                    backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)',
                    borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
                    zIndex: 40, overflow: 'hidden', minWidth: '160px',
                  }}>
                    <button
                      onClick={() => { chatImageRef.current?.click(); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 14px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, transition: 'background-color 0.15s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <ImageIcon style={{ width: 16, height: 16, color: '#3B82F6' }} />
                      Photo or Image
                    </button>
                    <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }} />
                    <button
                      onClick={() => { chatFileRef.current?.click(); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 14px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, transition: 'background-color 0.15s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <FileText style={{ width: 16, height: 16, color: '#8B5CF6' }} />
                      Document or File
                    </button>
                    <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }} />
                    <button
                      onClick={() => { setAttachMenuOpen(false); fetchAvailableLabs(); setLabPickerOpen(true); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 14px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, transition: 'background-color 0.15s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <Microscope style={{ width: 16, height: 16, color: '#EC4899' }} />
                      Lab Result
                    </button>
                    <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }} />
                    <button
                      onClick={() => { setAttachMenuOpen(false); fetchAvailableRecords(); setRecordPickerOpen(true); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 14px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, transition: 'background-color 0.15s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <ClipboardList style={{ width: 16, height: 16, color: '#2D6A4F' }} />
                      Medical Record
                    </button>
                  </div>
                )}
              </div>

              <textarea
                ref={inputRef}
                placeholder="Type a message..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                style={{
                  flex: 1,
                  fontSize: '14px',
                  minHeight: '36px',
                  maxHeight: '160px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--input-background)',
                  color: 'var(--text-primary)',
                  resize: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                  lineHeight: '1.4',
                  overflowY: 'hidden',
                }}
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
                title="Send"
                onClick={handleSend}
                disabled={!inputValue.trim() && !imageFile && !attachedFile && !attachedRecord}
                style={{
                  width: '36px', height: '36px', flexShrink: 0, borderRadius: '8px', border: 'none',
                  backgroundColor: (inputValue.trim() || imageFile || attachedFile || attachedRecord) ? '#C2671A' : 'var(--border-color)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: (inputValue.trim() || imageFile || attachedFile || attachedRecord) ? 'pointer' : 'not-allowed', color: '#fff', transition: 'background-color 0.15s',
                }}
              >
                <Send style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
            )}
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
                    <div style={{ width: '20px', height: '20px', borderRadius: '4px', border: selected ? 'none' : '2px solid var(--border-color)', backgroundColor: selected ? 'var(--brand-green-text)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
                <button onClick={handleCreateGroup} disabled={groupSelectedIds.length < 2} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: groupSelectedIds.length < 2 ? 'var(--border-color)' : 'var(--brand-green-text)', color: 'var(--on-brand-green)', fontSize: '13px', fontWeight: 600, cursor: groupSelectedIds.length < 2 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users style={{ width: '14px', height: '14px' }} /> Create Group
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Forward message dialog ─────────────────────────────────────────── */}
      <ForwardMessageDialog
        open={forwardOpen}
        onOpenChange={setForwardOpen}
        message={forwardMsg}
        conversations={conversations.map(c => ({
          id: c.id,
          isGroup: c.isGroup,
          otherName: c.isGroup ? c.groupTitle : c.otherName,
          otherProfileId: c.otherProfileId,
          otherAvatarUrl: c.otherAvatarUrl,
        }))}
        excludeIds={selectedId ? [selectedId] : []}
        onForward={handleForward}
      />

      {/* ── Lab Result picker dialog ──────────────────────────────────────── */}
      {labPickerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => { setLabPickerOpen(false); setPickerSearch(''); }}>
          <div style={{ backgroundColor: 'var(--surface-white)', borderRadius: '12px', padding: '24px', width: '500px', maxWidth: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.18)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <Microscope style={{ width: 20, height: 20, color: '#EC4899' }} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Attach Lab Result</h3>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>Select a lab result to share in this conversation.</p>
            <input
              type="text"
              placeholder="Search by pet name, test, or file..."
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              autoFocus
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px', marginBottom: '12px', outline: 'none', backgroundColor: 'transparent', color: 'var(--text-primary)', boxSizing: 'border-box' }}
            />
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', maxHeight: '350px' }}>
              {availableLabs.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>No lab results found</div>
              ) : availableLabs.filter(l => {
                const q = pickerSearch.toLowerCase();
                return !q || l.petName.toLowerCase().includes(q) || l.testPanel.toLowerCase().includes(q) || l.fileName.toLowerCase().includes(q);
              }).map(lab => (
                <button
                  key={lab.id}
                  onClick={() => handlePickLab(lab)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.15s', borderBottom: '1px solid var(--border-color)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ width: 36, height: 36, borderRadius: '8px', backgroundColor: 'rgba(236,72,153,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Microscope style={{ width: 16, height: 16, color: '#EC4899' }} />
                  </div>
                  {lab.petImage ? (
                    <img src={lab.petImage} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>{lab.petName.charAt(0)}</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lab.testPanel}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{lab.petName} &middot; {lab.date}</div>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', backgroundColor: lab.status === 'Reviewed' ? 'rgba(116,198,157,0.15)' : 'rgba(244,162,97,0.15)', color: lab.status === 'Reviewed' ? 'var(--brand-green-text)' : '#F4A261' }}>{lab.status}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => { setLabPickerOpen(false); setPickerSearch(''); }} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-white)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Medical Record picker dialog ──────────────────────────────────── */}
      {recordPickerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => { setRecordPickerOpen(false); setPickerSearch(''); }}>
          <div style={{ backgroundColor: 'var(--surface-white)', borderRadius: '12px', padding: '24px', width: '520px', maxWidth: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.18)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <ClipboardList style={{ width: 20, height: 20, color: '#2D6A4F' }} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Attach Medical Record</h3>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>Select a record to share in this conversation.</p>
            <input
              type="text"
              placeholder="Search by pet name, vet, or summary..."
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              autoFocus
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px', marginBottom: '12px', outline: 'none', backgroundColor: 'transparent', color: 'var(--text-primary)', boxSizing: 'border-box' }}
            />
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', maxHeight: '350px' }}>
              {availableRecords.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>No records found</div>
              ) : availableRecords.filter(r => {
                const q = pickerSearch.toLowerCase();
                return !q || r.petName.toLowerCase().includes(q) || r.vet.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q) || r.recordType.toLowerCase().includes(q);
              }).map(rec => {
                const typeColors: Record<string, string> = { Visit: '#2D6A4F', Vaccination: '#3B82F6', 'Lab Result': '#8B5CF6', Surgery: '#EC4899', Prescription: '#F4A261', Dental: '#06B6D4', Imaging: '#6B7280' };
                const tc = typeColors[rec.recordType] || '#2D6A4F';
                return (
                  <button
                    key={rec.id}
                    onClick={() => handlePickRecord(rec)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.15s', borderBottom: '1px solid var(--border-color)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: '8px', backgroundColor: `${tc}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ClipboardList style={{ width: 16, height: 16, color: tc }} />
                    </div>
                    {rec.petImage ? (
                      <img src={rec.petImage} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>{rec.petName.charAt(0)}</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{rec.petName}</span>
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '1px 6px', borderRadius: '999px', backgroundColor: `${tc}18`, color: tc }}>{rec.recordType}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.vet} &middot; {rec.date}</div>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', flexShrink: 0, backgroundColor: rec.status === 'Final' ? 'rgba(116,198,157,0.15)' : rec.status === 'Pending Review' ? 'rgba(244,162,97,0.15)' : 'rgba(59,130,246,0.15)', color: rec.status === 'Final' ? 'var(--brand-green-text)' : rec.status === 'Pending Review' ? '#F4A261' : '#3B82F6' }}>{rec.status}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => { setRecordPickerOpen(false); setPickerSearch(''); }} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-white)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)' }}>Cancel</button>
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
              This will remove this conversation from your chat list. The other participant will still be able to see it.
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
