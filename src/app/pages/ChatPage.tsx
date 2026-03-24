import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../hooks/useProfile';
import {
  MessageSquare,
  Send,
  Paperclip,
  Smile,
  Check,
} from 'lucide-react';
import { Input } from '../components/ui/input';

// ─── Emoji picker data ────────────────────────────────────────────────────────

const EMOJI_GROUPS = [
  { label: 'Smileys', emojis: ['😀','😂','😍','🥰','😎','😅','🤔','😴','😭','🥹','😊','😋','😏','🤩','😇','😆','🤣','😁','😉','🙂'] },
  { label: 'Gestures', emojis: ['👍','👎','👋','🙏','👏','🤝','💪','✌️','🫶','🤙','🫡','👌','🤌','🫰','👈','👉','👆','👇','☝️','✋'] },
  { label: 'Hearts', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💕','💞','💓','💗','💖','💘','💝','❤️‍🔥','💔','🫀','♥️','❣️'] },
  { label: 'Animals', emojis: ['🐾','🐕','🐈','🐇','🦜','🐠','🐢','🐹','🐾','🦊','🐶','🐱','🐭','🐹','🐰','🦝','🐻','🐼','🐨','🐯'] },
  { label: 'Medical', emojis: ['💊','🩺','🔬','🩹','💉','🧬','🏥','🩻','🧪','🩸','🦷','👁️','🫁','🫀','🧠','🦴','🦿','⚕️','🏨','🚑'] },
  { label: 'Objects', emojis: ['⭐','✨','🔥','💯','✅','❌','⚠️','📌','📎','🔒','🔓','💡','📋','📝','🗓️','⏰','📞','💬','📧','🔔'] },
];

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const CONVERSATION_KEY = 'admin-doctor';
const DOCTOR_NAME = 'Dr. Volodymyr Koldun';

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = {
  id: string;
  from: 'me' | 'them';
  text: string;
  timestamp: Date;
  imageUrl?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TODAY = new Date();

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

// ─── Avatar component ─────────────────────────────────────────────────────────

function Avatar({ name, color, size = 40, online, photoUrl }: { name: string; color: string; size?: number; online?: boolean; photoUrl?: string }) {
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

export default function ChatPage() {
  const { profile: adminProfile } = useProfile('admin');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [selected, setSelected] = useState(false);
  const doctorStaffId = useRef('');
  const chatReadAtRef = useRef('1970-01-01T00:00:00Z');
  const [chatReadAtLoaded, setChatReadAtLoaded] = useState(false);

  // Image attachment state
  const chatImageRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Admin name/photo from useProfile (single source of truth)
  const adminName = adminProfile.fullName || 'Front Desk Admin';
  const adminPhoto = adminProfile.avatarUrl || '';

  // Fetch doctor staff ID + chat_read_at on mount (operational data only)
  useEffect(() => {
    (async () => {
      const { data: docData } = await supabase
        .from('staff')
        .select('id, chat_read_at')
        .in('role', ['veterinarian', 'senior_veterinarian', 'lead_vet_tech'])
        .limit(1)
        .single();
      if (docData) {
        doctorStaffId.current = docData.id;
        chatReadAtRef.current = docData.chat_read_at || '1970-01-01T00:00:00Z';
      }
      setChatReadAtLoaded(true);
    })();
  }, []);

  // Emoji picker
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiTab, setEmojiTab] = useState(0);
  const emojiRef = useRef<HTMLDivElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Fetch messages from Supabase ──────────────────────────
  async function fetchMessages() {
    const { data } = await supabase
      .from('chat_messages')
      .select('id, sender_name, content, image_url, created_at')
      .eq('conversation', CONVERSATION_KEY)
      .order('created_at', { ascending: true });

    if (data) {
      const mapped: Message[] = data.map((m: any) => ({
        id: m.id,
        from: m.sender_name === DOCTOR_NAME ? 'me' as const : 'them' as const,
        text: m.content,
        timestamp: new Date(m.created_at),
        imageUrl: m.image_url || undefined,
      }));
      setMessages(mapped);

      // Track unread — count admin messages newer than chat_read_at
      if (selected) {
        setUnreadCount(0);
      } else {
        const readAt = new Date(chatReadAtRef.current).getTime();
        const unread = data.filter((m: any) => m.sender_name !== DOCTOR_NAME && new Date(m.created_at).getTime() > readAt).length;
        setUnreadCount(unread);
      }
    }
  }

  // Initial fetch + polling — wait for chat_read_at to load first to avoid flash
  useEffect(() => {
    if (!chatReadAtLoaded) return;
    fetchMessages();
    const interval = setInterval(fetchMessages, 2000);
    return () => clearInterval(interval);
  }, [selected, chatReadAtLoaded]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current && selected) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, selected]);

  // Close emoji picker on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setEmojiOpen(false);
    }
    if (emojiOpen) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [emojiOpen]);

  function handleSelect() {
    setSelected(true);
    setUnreadCount(0);
    // Update chat_read_at in Supabase
    const now = new Date().toISOString();
    chatReadAtRef.current = now;
    if (doctorStaffId.current) {
      supabase.from('staff').update({ chat_read_at: now }).eq('id', doctorStaffId.current).then();
    }
    // Notify Sidebar to clear badge instantly
    window.dispatchEvent(new CustomEvent('doctorChatRead', { detail: { chat_read_at: now } }));
  }

  function insertEmoji(emoji: string) {
    setInputValue((prev) => prev + emoji);
    setEmojiOpen(false);
  }

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

  async function handleSend() {
    if (!inputValue.trim() && !imageFile) return;
    const text = inputValue.trim();
    setInputValue('');
    const pendingFile = imageFile;
    const pendingPreview = imagePreview;
    setImageFile(null);
    setImagePreview(null);

    // Optimistic update
    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      from: 'me',
      text: text || (pendingFile ? '📷 Image' : ''),
      timestamp: new Date(),
      imageUrl: pendingPreview || undefined,
    };
    setMessages(prev => [...prev, optimistic]);

    // Upload image to chat-images bucket if present
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
    await supabase.from('chat_messages').insert([{
      organization_id: ORG_ID,
      conversation: CONVERSATION_KEY,
      sender_name: DOCTOR_NAME,
      content: text || (imageUrl ? '📷 Image' : ''),
      image_url: imageUrl,
    }]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Group messages by date
  function groupMessagesByDate(msgs: Message[]): { label: string; msgs: Message[] }[] {
    const groups: { label: string; msgs: Message[] }[] = [];
    for (const msg of msgs) {
      const label = getDateLabel(msg.timestamp);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.msgs.push(msg);
      else groups.push({ label, msgs: [msg] });
    }
    return groups;
  }

  function getLastMineIndex(msgs: Message[]): number {
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].from === 'me') return i;
    }
    return -1;
  }

  // Preview for conversation list
  const lastMsg = messages[messages.length - 1];
  const previewText = lastMsg ? (lastMsg.from === 'me' ? 'You: ' : '') + lastMsg.text : 'Start a conversation...';
  const previewTime = lastMsg ? (isSameDay(lastMsg.timestamp, TODAY) ? formatTime(lastMsg.timestamp) : lastMsg.timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })) : '';

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: 'var(--bg-offwhite)' }}>
      {/* ── Left panel ── */}
      <div style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--surface-white)', borderRight: '1px solid var(--border-color)' }}>
        {/* Panel header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 16px', flexShrink: 0 }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Messages</h2>
        </div>

        {/* Conversation list — single item */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <button
            onClick={handleSelect}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
              backgroundColor: selected ? 'var(--surface-elevated)' : 'transparent',
              border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-elevated)'; }}
            onMouseLeave={(e) => { if (!selected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
          >
            <Avatar name={adminName} color="#7C3AED" size={40} online photoUrl={adminPhoto} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
                  {adminName}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', flexShrink: 0, marginLeft: '8px' }}>
                  {previewTime}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1px', display: 'block' }}>Front Desk Admin</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>
                  {previewText}
                </span>
                {unreadCount > 0 && (
                  <span style={{ flexShrink: 0, marginLeft: '8px', backgroundColor: '#d4183d', color: '#fff', fontSize: '11px', fontWeight: 700, borderRadius: '999px', minWidth: '20px', height: '20px', padding: '0 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', backgroundColor: 'var(--surface-white)' }}>
        {selected ? (
          <>
            {/* Chat header */}
            <div style={{ height: '64px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-white)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Avatar name={adminName} color="#7C3AED" size={40} online photoUrl={adminPhoto} />
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{adminName}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Front Desk Admin</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>·</span>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#22c55e' }}>Online</span>
                  </div>
                </div>
              </div>
              <div />
            </div>

            {/* Messages area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column' }}>
              {messages.length === 0 && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>No messages yet. Say hello!</p>
                </div>
              )}
              {(() => {
                const groups = groupMessagesByDate(messages);
                const lastMineIdx = getLastMineIndex(messages);

                return groups.map((group) => (
                  <div key={group.label}>
                    <DateSeparator label={group.label} />
                    {group.msgs.map((msg) => {
                      const globalIndex = messages.findIndex((m) => m.id === msg.id);
                      const isLastMine = globalIndex === lastMineIdx;
                      const isMe = msg.from === 'me';

                      return (
                        <div key={msg.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: '8px', marginBottom: '8px' }}>
                          {!isMe && (
                            <div style={{ flexShrink: 0, marginBottom: isLastMine ? '20px' : '0' }}>
                              <Avatar name={adminName} color="#7C3AED" size={28} photoUrl={adminPhoto} />
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
                  >×</button>
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
                  style={{
                    width: '36px', height: '36px', borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: emojiOpen ? 'var(--surface-elevated)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'var(--text-secondary)', transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                  onMouseLeave={(e) => { if (!emojiOpen) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <Smile style={{ width: '16px', height: '16px' }} />
                </button>

                {emojiOpen && (
                  <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', right: 0, width: '420px', backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.14)', zIndex: 40, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', padding: '8px 8px 0', gap: '2px' }}>
                      {EMOJI_GROUPS.map((g, i) => (
                        <button
                          key={g.label}
                          onClick={() => setEmojiTab(i)}
                          style={{
                            flex: 1, padding: '6px 4px', borderRadius: '6px 6px 0 0', border: 'none',
                            cursor: 'pointer', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap',
                            backgroundColor: emojiTab === i ? 'var(--surface-elevated)' : 'transparent',
                            color: emojiTab === i ? 'var(--text-primary)' : 'var(--text-secondary)',
                            borderBottom: emojiTab === i ? '2px solid #2D6A4F' : '2px solid transparent',
                            transition: 'all 0.15s',
                          }}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '4px' }}>
                      {EMOJI_GROUPS[emojiTab].emojis.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => insertEmoji(emoji)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px', padding: '6px', borderRadius: '8px', lineHeight: 1, transition: 'background-color 0.1s' }}
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
                disabled={!inputValue.trim()}
                style={{
                  width: '36px', height: '36px', flexShrink: 0, borderRadius: '999px', border: 'none',
                  backgroundColor: inputValue.trim() ? 'var(--brand-green-text)' : 'var(--border-color)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: inputValue.trim() ? 'pointer' : 'not-allowed', color: '#fff', transition: 'background-color 0.15s',
                }}
              >
                <Send style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
          </>
        ) : (
          /* Empty state */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '40px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(45,106,79,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare style={{ width: '40px', height: '40px', color: 'var(--brand-green-text)' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                Select a conversation
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
                Click on {adminName} to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
