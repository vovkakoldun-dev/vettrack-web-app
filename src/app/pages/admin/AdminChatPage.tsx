import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Search,
  Send,
  Paperclip,
  Smile,
  Check,
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
};

type ConversationItem = {
  id: string;
  otherProfileId: string;
  otherName: string;
  otherRole: string;
  otherAvatarUrl: string;
  lastMessage: string;
  lastMessageTime: Date | null;
  lastMessageIsMe: boolean;
  unread: number;
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

  // Image attachment state
  const chatImageRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Emoji picker
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiTab, setEmojiTab] = useState(0);
  const emojiRef = useRef<HTMLDivElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastReadAtRef = useRef<string | null>(null);

  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null;

  // ── Load conversations ──────────────────────────────────────────────────────

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    const { data: parts } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('profile_id', user.id);
    if (!parts || parts.length === 0) { setLoadingConvs(false); return; }

    const convIds = parts.map(p => p.conversation_id);
    const items: ConversationItem[] = [];

    for (const convId of convIds) {
      const { data: otherParts } = await supabase
        .from('conversation_participants')
        .select('profile_id, last_read_at, profiles:profiles!conversation_participants_profile_id_fkey(id, first_name, last_name, role, avatar_url)')
        .eq('conversation_id', convId)
        .neq('profile_id', user.id);
      const other = otherParts?.[0];
      if (!other) continue;
      const otherProfile = other.profiles as any;

      const { data: myPart } = await supabase
        .from('conversation_participants')
        .select('last_read_at')
        .eq('conversation_id', convId)
        .eq('profile_id', user.id)
        .single();

      const { data: lastMsgs } = await supabase
        .from('messages')
        .select('content, sender_id, created_at')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: false })
        .limit(1);
      const lastMsg = lastMsgs?.[0];

      let unread = 0;
      if (myPart?.last_read_at) {
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', convId)
          .neq('sender_id', user.id)
          .gt('created_at', myPart.last_read_at);
        unread = count || 0;
      } else {
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', convId)
          .neq('sender_id', user.id);
        unread = count || 0;
      }

      const otherName = otherProfile
        ? `${otherProfile.first_name} ${otherProfile.last_name}`.trim()
        : 'Unknown';

      items.push({
        id: convId,
        otherProfileId: otherProfile?.id || '',
        otherName,
        otherRole: ROLE_LABELS[otherProfile?.role] || otherProfile?.role || '',
        otherAvatarUrl: otherProfile?.avatar_url || '',
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
    setLoadingConvs(false);
  }, [user]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // ── Load messages for selected conversation ─────────────────────────────────

  const fetchMessages = useCallback(async (convId: string) => {
    if (!user) return;
    setLoadingMsgs(true);
    const { data } = await supabase
      .from('messages')
      .select('id, content, sender_id, image_url, created_at')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data.map(m => ({
        id: m.id,
        from: m.sender_id === user.id ? 'me' as const : 'them' as const,
        text: m.content,
        timestamp: new Date(m.created_at),
        imageUrl: m.image_url || undefined,
      })));
    }
    setLoadingMsgs(false);
  }, [user]);

  // ── Select conversation ─────────────────────────────────────────────────────

  async function handleSelectConversation(convId: string) {
    setSelectedId(convId);
    setInputValue('');
    clearImagePreview();
    await fetchMessages(convId);

    if (user) {
      const now = new Date().toISOString();
      lastReadAtRef.current = now;
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: now })
        .eq('conversation_id', convId)
        .eq('profile_id', user.id);

      setConversations(prev => prev.map(c =>
        c.id === convId ? { ...c, unread: 0 } : c
      ));

      // Notify AdminSidebar to clear badge
      window.dispatchEvent(new CustomEvent('adminChatRead', { detail: { last_read_at: now } }));
    }
  }

  // ── Image handling ─────────────────────────────────────────────────────────

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    e.target.value = '';
  }

  function clearImagePreview() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  }

  // ── Send message ────────────────────────────────────────────────────────────

  async function handleSend() {
    if ((!inputValue.trim() && !imageFile) || !selectedId || !user) return;
    const content = inputValue.trim();
    setInputValue('');
    const pendingFile = imageFile;
    const pendingPreview = imagePreview;
    setImageFile(null);
    setImagePreview(null);

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const now = new Date();
    setMessages(prev => [...prev, {
      id: tempId,
      from: 'me',
      text: content || (pendingFile ? '📷 Image' : ''),
      timestamp: now,
      imageUrl: pendingPreview || undefined,
    }]);

    setConversations(prev => prev.map(c =>
      c.id === selectedId
        ? { ...c, lastMessage: content || '📷 Image', lastMessageTime: now, lastMessageIsMe: true }
        : c
    ));

    // Upload image if present
    let imageUrl: string | null = null;
    if (pendingFile) {
      setUploadingImage(true);
      const path = `msg-${Date.now()}.png`;
      const { error: uploadErr } = await supabase.storage
        .from('chat-images')
        .upload(path, pendingFile, { upsert: true, contentType: pendingFile.type });
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(path);
        imageUrl = urlData.publicUrl + '?t=' + Date.now();
      }
      setUploadingImage(false);
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    }

    // Insert into Supabase
    const { data } = await supabase
      .from('messages')
      .insert({
        conversation_id: selectedId,
        sender_id: user.id,
        content: content || (imageUrl ? '📷 Image' : ''),
        image_url: imageUrl,
      })
      .select('id')
      .single();

    if (data) {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: data.id, imageUrl: imageUrl || m.imageUrl } : m));
    }

    // Update my last_read_at
    const nowStr = now.toISOString();
    lastReadAtRef.current = nowStr;
    await supabase
      .from('conversation_participants')
      .update({ last_read_at: nowStr })
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
          }]);
          const now = new Date().toISOString();
          lastReadAtRef.current = now;
          supabase
            .from('conversation_participants')
            .update({ last_read_at: now })
            .eq('conversation_id', selectedId)
            .eq('profile_id', user.id)
            .then();
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
        </div>

        {/* Search */}
        <div style={{ padding: '0 16px 12px', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
            <Input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '32px', fontSize: '13px', height: '36px' }}
            />
          </div>
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
              <button
                key={conv.id}
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
                <ChatAvatar name={conv.otherName} color={getAvatarColor(conv.otherProfileId)} size={40} photoUrl={conv.otherAvatarUrl} />

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
                <ChatAvatar name={selectedConv.otherName} color={getAvatarColor(selectedConv.otherProfileId)} size={40} photoUrl={selectedConv.otherAvatarUrl} />
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                    {selectedConv.otherName}
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {selectedConv.otherRole}
                  </span>
                </div>
              </div>
              <div />
            </div>

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
                        <div key={msg.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: '8px', marginBottom: '8px' }}>
                          {!isMe && (
                            <div style={{ flexShrink: 0 }}>
                              <ChatAvatar name={selectedConv.otherName} color={getAvatarColor(selectedConv.otherProfileId)} size={28} photoUrl={selectedConv.otherAvatarUrl} />
                            </div>
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '60%' }}>
                            <div style={{
                              padding: msg.imageUrl ? '4px' : '10px 14px',
                              borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                              backgroundColor: isMe ? 'var(--brand-green-text)' : 'var(--surface-elevated)',
                              color: isMe ? '#fff' : 'var(--text-primary)',
                              fontSize: '14px', lineHeight: 1.5, wordBreak: 'break-word',
                              overflow: 'hidden',
                            }}>
                              {msg.imageUrl && (
                                <img src={msg.imageUrl} alt="Attachment" style={{ maxWidth: '240px', maxHeight: '200px', borderRadius: msg.text && msg.text !== '📷 Image' ? '12px 12px 0 0' : '12px', display: 'block', objectFit: 'cover' }} />
                              )}
                              {msg.text && msg.text !== '📷 Image' && (
                                <div style={{ padding: msg.imageUrl ? '8px 10px 6px' : '0' }}>{msg.text}</div>
                              )}
                            </div>

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

            {/* Input area */}
            <div style={{ flexShrink: 0, borderTop: imagePreview ? 'none' : '1px solid var(--border-color)', padding: '16px', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--surface-white)' }}>
              <input type="file" ref={chatImageRef} accept="image/*" style={{ display: 'none' }} onChange={handleImageSelect} />
              <button
                title="Attach image"
                onClick={() => chatImageRef.current?.click()}
                disabled={uploadingImage}
                style={{ width: '36px', height: '36px', flexShrink: 0, borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'background-color 0.15s', opacity: uploadingImage ? 0.5 : 1 }}
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
                disabled={!inputValue.trim() && !imageFile}
                style={{
                  width: '36px', height: '36px', flexShrink: 0, borderRadius: '999px', border: 'none',
                  backgroundColor: (inputValue.trim() || imageFile) ? 'var(--brand-green-text)' : 'var(--border-color)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: (inputValue.trim() || imageFile) ? 'pointer' : 'not-allowed', color: '#fff', transition: 'background-color 0.15s',
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
    </div>
  );
}
