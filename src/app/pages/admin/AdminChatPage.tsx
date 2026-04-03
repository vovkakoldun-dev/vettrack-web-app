import { useState, useRef, useEffect, useCallback } from 'react';
import { getOrgContext } from '../../hooks/useOrgContext';
import {
  MessageSquare,
  Search,
  Send,
  Paperclip,
  Smile,
  Check,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  Plus,
  Users,
  FileText,
  Download,
  Image as ImageIcon,
} from 'lucide-react';
import { Input } from '../../components/ui/input';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

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
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
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

export default function AdminChatPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
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

  // Reactions
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);

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
    if (!searchQuery.trim() || !user) { setStaffResults([]); return; }
    const timer = setTimeout(async () => {
      const { organizationId } = await getOrgContext();
      const q = searchQuery.trim().toLowerCase();
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role, avatar_url')
        .eq('organization_id', organizationId)
        .neq('id', user.id)
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
        .limit(8);
      const existingIds = new Set(conversations.map(c => c.otherProfileId));
      setStaffResults((data || []).filter(s => !existingIds.has(s.id)));
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, user, conversations]);

  // ── Start new direct conversation ─────────────────────────────────────────────

  async function handleStartConversation(staff: StaffResult) {
    if (!user) return;
    const { organizationId } = await getOrgContext();
    const { data: conv } = await supabase
      .from('conversations')
      .insert({ organization_id: organizationId, type: 'direct', created_by: user.id })
      .select('id')
      .single();
    if (!conv) return;
    await supabase.from('conversation_participants').insert([
      { organization_id: organizationId, conversation_id: conv.id, profile_id: user.id },
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
    if (!user || groupSelectedIds.length < 2) return;
    const { organizationId } = await getOrgContext();
    const { data: conv } = await supabase
      .from('conversations')
      .insert({
        organization_id: organizationId,
        type: 'group',
        title: groupName.trim() || null,
        created_by: user.id,
      })
      .select('id')
      .single();
    if (!conv) return;
    const participants = [user.id, ...groupSelectedIds].map(pid => ({
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
    if (!user) return;
    const { organizationId } = await getOrgContext();
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, role, avatar_url')
      .eq('organization_id', organizationId)
      .neq('id', user.id)
      .order('first_name');
    setAllStaff(data || []);
    setGroupSelectedIds([]);
    setGroupName('');
    setNewGroupOpen(true);
  }

  // ── Load conversations ──────────────────────────────────────────────────────

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    try {
    const { organizationId } = await getOrgContext();
    const { data: parts } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('organization_id', organizationId)
      .eq('profile_id', user.id);
    if (!parts || parts.length === 0) { setLoadingConvs(false); return; }

    const convIds = parts.map(p => p.conversation_id);

    // Batch all queries in parallel instead of sequential per-conversation loop
    const [convMetaRes, allPartsRes, myPartsRes, lastMsgsRes, unreadRes] = await Promise.all([
      supabase.from('conversations').select('id, type, title').eq('organization_id', organizationId).in('id', convIds),
      supabase.from('conversation_participants')
        .select('conversation_id, profile_id, last_read_at, profiles:profiles!conversation_participants_profile_id_fkey(id, first_name, last_name, role, avatar_url)')
        .eq('organization_id', organizationId).in('conversation_id', convIds).neq('profile_id', user.id),
      supabase.from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('organization_id', organizationId).in('conversation_id', convIds).eq('profile_id', user.id),
      supabase.from('messages')
        .select('conversation_id, content, sender_id, created_at')
        .eq('organization_id', organizationId).in('conversation_id', convIds)
        .order('created_at', { ascending: false }).limit(convIds.length * 2),
      supabase.from('messages')
        .select('conversation_id, created_at')
        .eq('organization_id', organizationId).in('conversation_id', convIds).neq('sender_id', user.id),
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
        lastMessageIsMe: lastMsg?.sender_id === user.id,
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
  }, [user]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // ── Load messages for selected conversation ─────────────────────────────────

  const fetchMessages = useCallback(async (convId: string) => {
    if (!user) return;
    const { organizationId } = await getOrgContext();
    setLoadingMsgs(true);
    const { data } = await supabase
      .from('messages')
      .select('id, content, sender_id, image_url, file_url, file_name, file_size, created_at')
      .eq('organization_id', organizationId)
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data.map(m => ({
        id: m.id,
        from: m.sender_id === user.id ? 'me' as const : 'them' as const,
        text: m.content,
        timestamp: new Date(m.created_at),
        imageUrl: m.image_url || undefined,
        fileUrl: m.file_url || undefined,
        fileName: m.file_name || undefined,
        fileSize: m.file_size || undefined,
      })));
    }
    // Fetch reactions
    if (data && data.length > 0) {
      const msgIds = data.map((m: { id: string }) => m.id);
      const { data: rxns } = await supabase
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
  }, [user]);

  async function toggleReaction(messageId: string, emoji: string) {
    if (!user) return;
    const msgReactions = reactions[messageId] || [];
    const existing = msgReactions.find(r => r.emoji === emoji);
    const alreadyReacted = existing?.users.includes(user.id);
    setReactions(prev => {
      const current = [...(prev[messageId] || [])];
      if (alreadyReacted) {
        const idx = current.findIndex(r => r.emoji === emoji);
        if (idx >= 0) {
          current[idx] = { ...current[idx], users: current[idx].users.filter(u => u !== user.id) };
          if (current[idx].users.length === 0) current.splice(idx, 1);
        }
      } else {
        const idx = current.findIndex(r => r.emoji === emoji);
        if (idx >= 0) current[idx] = { ...current[idx], users: [...current[idx].users, user.id] };
        else current.push({ emoji, users: [user.id] });
      }
      return { ...prev, [messageId]: current };
    });
    if (alreadyReacted) {
      await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', user.id).eq('emoji', emoji);
    } else {
      await supabase.from('message_reactions').insert({ message_id: messageId, user_id: user.id, emoji });
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
    closeMsgSearch();
    clearImagePreview();
    await fetchMessages(convId);

    if (user) {
      const { organizationId } = await getOrgContext();
      const now = new Date().toISOString();
      lastReadAtRef.current = now;
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: now })
        .eq('organization_id', organizationId)
        .eq('conversation_id', convId)
        .eq('profile_id', user.id);

      setConversations(prev => prev.map(c =>
        c.id === convId ? { ...c, unread: 0 } : c
      ));

      // Notify AdminSidebar to clear badge
      window.dispatchEvent(new CustomEvent('adminChatRead', { detail: { last_read_at: now } }));
    }
  }

  // ── Delete conversation ──────────────────────────────────────────────────────

  async function handleDeleteConversation(convId: string) {
    if (!user) return;
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

  // ── Image handling ─────────────────────────────────────────────────────────

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

  async function handleSend() {
    if ((!inputValue.trim() && !imageFile && !attachedFile) || !selectedId || !user) return;
    const content = inputValue.trim();
    setInputValue('');
    const pendingImageFile = imageFile;
    const pendingPreview = imagePreview;
    const pendingAttachedFile = attachedFile;
    setImageFile(null);
    setImagePreview(null);
    setAttachedFile(null);

    const attachLabel = pendingAttachedFile ? `📎 ${pendingAttachedFile.name}` : pendingImageFile ? '📷 Image' : '';

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
    }]);

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
    const msgContent = content || (imageUrl ? '📷 Image' : fileName ? `📎 ${fileName}` : '');
    const { data } = await supabase
      .from('messages')
      .insert({
        organization_id: organizationId,
        conversation_id: selectedId,
        sender_id: user.id,
        content: msgContent,
        image_url: imageUrl,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
      })
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
      } : m));
    }

    // Update my last_read_at
    const nowStr = now.toISOString();
    lastReadAtRef.current = nowStr;
    await supabase
      .from('conversation_participants')
      .update({ last_read_at: nowStr })
      .eq('organization_id', organizationId)
      .eq('conversation_id', selectedId)
      .eq('profile_id', user.id);
  }

  // ── Realtime subscription ───────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('admin-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as any;
        if (msg.conversation_id === selectedId && msg.sender_id !== user.id) {
          setMessages(prev => [...prev, {
            id: msg.id,
            from: 'them',
            text: msg.content,
            timestamp: new Date(msg.created_at),
            imageUrl: msg.image_url || undefined,
            fileUrl: msg.file_url || undefined,
            fileName: msg.file_name || undefined,
            fileSize: msg.file_size || undefined,
          }]);
          const now = new Date().toISOString();
          lastReadAtRef.current = now;
          getOrgContext().then(({ organizationId: oid }) =>
            supabase
              .from('conversation_participants')
              .update({ last_read_at: now })
              .eq('organization_id', oid)
              .eq('conversation_id', selectedId)
              .eq('profile_id', user.id)
              .then()
          );
        }
        fetchConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, selectedId, fetchConversations]);

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
            const previewText = conv.lastMessage
              ? (conv.lastMessageIsMe ? `You: ${conv.lastMessage}` : conv.lastMessage)
              : 'Start a conversation...';

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
                          {!isMe && (
                            <div style={{ flexShrink: 0 }}>
                              <ChatAvatar name={selectedConv.otherName} color={getAvatarColor(selectedConv.otherProfileId)} size={28} photoUrl={selectedConv.otherAvatarUrl} />
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
                                  const myReaction = msgRx.find(r => r.emoji === emoji && r.users.includes(user!.id));
                                  return (
                                    <button key={emoji} onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, emoji); }}
                                      style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', backgroundColor: myReaction ? 'var(--surface-elevated)' : 'transparent', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.15s, background-color 0.15s' }}
                                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.25)'; e.currentTarget.style.backgroundColor = 'var(--surface-elevated)'; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; if (!myReaction) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                    >{emoji}</button>
                                  );
                                })}
                              </div>
                            )}
                            <div style={{
                              padding: (msg.imageUrl || msg.fileUrl) ? '4px' : '10px 14px',
                              borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                              backgroundColor: isMe ? 'var(--brand-green-text)' : 'var(--surface-elevated)',
                              color: isMe ? 'var(--on-brand-green)' : 'var(--text-primary)',
                              fontSize: '14px', lineHeight: 1.5, wordBreak: 'break-word',
                              overflow: 'hidden',
                            }}>
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
                              {msg.text && msg.text !== '📷 Image' && !msg.text.startsWith('📎 ') && (
                                <div style={{ padding: (msg.imageUrl || msg.fileUrl) ? '8px 10px 6px' : '0' }}>{msg.text}</div>
                              )}
                            </div>

                            {(reactions[msg.id] || []).length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                {(reactions[msg.id] || []).map(rx => (
                                  <button key={rx.emoji} onClick={() => toggleReaction(msg.id, rx.emoji)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '999px', border: '1px solid var(--border-color)', backgroundColor: rx.users.includes(user!.id) ? 'var(--brand-green-text)' : 'var(--surface-elevated)', color: rx.users.includes(user!.id) ? 'var(--on-brand-green)' : 'var(--text-primary)', cursor: 'pointer', fontSize: '13px', lineHeight: '20px', transition: 'background-color 0.15s' }}>
                                    <span>{rx.emoji}</span>
                                    {rx.users.length > 1 && <span style={{ fontSize: '11px', fontWeight: 600 }}>{rx.users.length}</span>}
                                  </button>
                                ))}
                              </div>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{formatTime(msg.timestamp)}</span>
                              {isMe && isLastMine && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                  <Check style={{ width: '12px', height: '12px' }} /> Sent
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

            {/* Input area */}
            <div style={{ flexShrink: 0, borderTop: (imagePreview || attachedFile) ? 'none' : '1px solid var(--border-color)', padding: '16px', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--surface-white)' }}>
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
                  </div>
                )}
              </div>

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
                        <button key={g.label} onClick={() => setEmojiTab(i)} style={{ flex: 1, padding: '6px 4px', borderRadius: '6px 6px 0 0', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', backgroundColor: emojiTab === i ? 'var(--surface-elevated)' : 'transparent', color: emojiTab === i ? 'var(--text-primary)' : 'var(--text-secondary)', borderBottom: emojiTab === i ? '2px solid #2D6A4F' : '2px solid transparent', transition: 'all 0.15s' }}>
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
                disabled={!inputValue.trim() && !imageFile && !attachedFile}
                style={{
                  width: '36px', height: '36px', flexShrink: 0, borderRadius: '999px', border: 'none',
                  backgroundColor: (inputValue.trim() || imageFile || attachedFile) ? 'var(--brand-green-text)' : 'var(--border-color)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: (inputValue.trim() || imageFile || attachedFile) ? 'pointer' : 'not-allowed', color: 'var(--on-brand-green)', transition: 'background-color 0.15s',
                }}
              >
                <Send style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
          </>
        ) : (
          /* Empty state */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <MessageSquare style={{ width: '48px', height: '48px', color: 'var(--brand-green-text)', opacity: 0.6 }} />
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
                      {selected && <Check style={{ width: '12px', height: '12px', color: '#fff' }} />}
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
