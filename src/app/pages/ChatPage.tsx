import { useState, useRef, useEffect } from 'react';
import { useMessages } from '../hooks/useMessages';
import {
  MessageSquare,
  Search,
  Pencil,
  Send,
  Paperclip,
  Smile,
  CheckCheck,
  X,
  Users,
  ChevronLeft,
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

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = {
  id: string;
  from: 'me' | 'them';
  text: string;
  timestamp: Date;
  senderName?: string;
};

type Conversation = {
  id: string;
  name: string;
  role: string;
  avatarColor: string;
  online: boolean;
  unread: number;
  messages: Message[];
  isGroup?: boolean;
  members?: { id: string; name: string; color: string }[];
};

// ─── Mock data helpers ────────────────────────────────────────────────────────

function d(year: number, month: number, day: number, h: number, m: number): Date {
  return new Date(year, month - 1, day, h, m);
}

// "Today" = March 14 2026, "Yesterday" = March 13 2026
const TODAY = new Date(2026, 2, 14); // month is 0-indexed

// ─── Mock conversations ───────────────────────────────────────────────────────

const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: '1',
    name: 'Dr. James Wilson',
    role: 'Veterinarian',
    avatarColor: '#7C3AED',
    online: true,
    unread: 3,
    messages: [
      { id: 'm1', from: 'them', text: "Hey Sarah, have you reviewed Max's post-op bloodwork?", timestamp: d(2026, 3, 14, 9, 2) },
      { id: 'm2', from: 'me',   text: 'Yes just finished — values look great, no concerns',       timestamp: d(2026, 3, 14, 9, 5) },
      { id: 'm3', from: 'them', text: 'Perfect. Can we schedule a follow-up for next Tuesday?',    timestamp: d(2026, 3, 14, 9, 6) },
      { id: 'm4', from: 'me',   text: "Absolutely, I'll have reception block 10am",                timestamp: d(2026, 3, 14, 9, 8) },
      { id: 'm5', from: 'them', text: "Thanks! Also the Hendersons asked about switching Max to a prescription diet", timestamp: d(2026, 3, 14, 9, 10) },
      { id: 'm6', from: 'me',   text: "Good call, I'll prepare the diet plan before Tuesday",      timestamp: d(2026, 3, 14, 9, 12) },
      { id: 'm7', from: 'them', text: "One more thing — Cooper's owner called, wants to discuss the biopsy results", timestamp: d(2026, 3, 14, 9, 47) },
      { id: 'm8', from: 'them', text: "She's pretty anxious, do you have 15 mins today?",          timestamp: d(2026, 3, 14, 9, 48) },
      { id: 'm9', from: 'them', text: 'Preferably before 2pm',                                     timestamp: d(2026, 3, 14, 9, 49) },
    ],
  },
  {
    id: '2',
    name: 'Sarah Martinez',
    role: 'Vet Technician',
    avatarColor: '#0891B2',
    online: true,
    unread: 0,
    messages: [
      { id: 'm1', from: 'them', text: "Reminder: Bella's suture removal is tomorrow at 11am",      timestamp: d(2026, 3, 13, 16, 15) },
      { id: 'm2', from: 'me',   text: 'Thanks for the heads up! All good?',                        timestamp: d(2026, 3, 13, 16, 18) },
      { id: 'm3', from: 'them', text: 'Healing beautifully, no signs of infection',                timestamp: d(2026, 3, 13, 16, 20) },
      { id: 'm4', from: 'me',   text: 'Morning! Any updates on the overnight boarders?',           timestamp: d(2026, 3, 14, 8, 30) },
      { id: 'm5', from: 'them', text: 'All good! Rocky had a quiet night, eating well this morning', timestamp: d(2026, 3, 14, 8, 35) },
    ],
  },
  {
    id: '3',
    name: 'Dr. Emily Rodriguez',
    role: 'Veterinary Surgeon',
    avatarColor: '#DC2626',
    online: false,
    unread: 1,
    messages: [
      { id: 'm1', from: 'me',   text: 'Emily, can you consult on a suspected foreign body case?',  timestamp: d(2026, 3, 12, 14, 0) },
      { id: 'm2', from: 'them', text: 'Sure, send me the X-rays when you get a chance',            timestamp: d(2026, 3, 12, 14, 45) },
      { id: 'm3', from: 'me',   text: 'Sent! Patient is stable, no emergency',                     timestamp: d(2026, 3, 12, 15, 0) },
      { id: 'm4', from: 'them', text: "Reviewed the X-rays — definitely looks like an obstruction. Let's discuss treatment options", timestamp: d(2026, 3, 14, 7, 55) },
    ],
  },
  {
    id: '4',
    name: 'Tom Anderson',
    role: 'Receptionist',
    avatarColor: '#D97706',
    online: true,
    unread: 0,
    messages: [
      { id: 'm1', from: 'them', text: "Good morning Dr. Chen! Today's schedule is fully booked",   timestamp: d(2026, 3, 14, 8, 0) },
      { id: 'm2', from: 'me',   text: 'Thanks Tom! Any cancellations to be aware of?',             timestamp: d(2026, 3, 14, 8, 2) },
      { id: 'm3', from: 'them', text: "Mrs. Patterson cancelled her 3pm, I'm trying to fill the slot", timestamp: d(2026, 3, 14, 8, 3) },
      { id: 'm4', from: 'me',   text: "If you can't fill it, use it for catch-up paperwork",       timestamp: d(2026, 3, 14, 8, 5) },
      { id: 'm5', from: 'them', text: 'Will do, thank you!',                                       timestamp: d(2026, 3, 14, 8, 6) },
    ],
  },
  {
    id: '5',
    name: 'Lisa Chen',
    role: 'Vet Nurse',
    avatarColor: '#059669',
    online: true,
    unread: 0,
    messages: [
      { id: 'm1', from: 'them', text: 'Medication inventory is running low on Amoxicillin',        timestamp: d(2026, 3, 13, 13, 0) },
      { id: 'm2', from: 'me',   text: "I'll put in an order today, thanks for flagging",            timestamp: d(2026, 3, 13, 13, 5) },
      { id: 'm3', from: 'them', text: "Also low on IV fluids (Lactated Ringer's)",                 timestamp: d(2026, 3, 13, 13, 6) },
      { id: 'm4', from: 'me',   text: 'Adding that to the order too',                              timestamp: d(2026, 3, 13, 13, 8) },
      { id: 'm5', from: 'them', text: "Perfect, I'll send you the full inventory report",          timestamp: d(2026, 3, 13, 13, 10) },
    ],
  },
  {
    id: '6',
    name: 'Dr. Michael Park',
    role: 'Specialist',
    avatarColor: '#7C3AED',
    online: false,
    unread: 0,
    messages: [
      { id: 'm1', from: 'me',   text: 'Michael, I need a cardiology consult for a 9yo Labrador',  timestamp: d(2026, 3, 10, 10, 0) },
      { id: 'm2', from: 'them', text: 'Happy to help. Can you send over the ECG and echo results?', timestamp: d(2026, 3, 10, 11, 30) },
      { id: 'm3', from: 'me',   text: 'Sent to your email. Patient is on furosemide currently',   timestamp: d(2026, 3, 10, 12, 0) },
      { id: 'm4', from: 'them', text: "Reviewed — this looks like early DCM. Let's discuss management options", timestamp: d(2026, 3, 10, 14, 0) },
      { id: 'm5', from: 'me',   text: 'Available for a call at 4pm?',                             timestamp: d(2026, 3, 10, 14, 30) },
      { id: 'm6', from: 'them', text: 'Perfect, talk then',                                        timestamp: d(2026, 3, 10, 14, 35) },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getDateLabel(date: Date): string {
  if (isSameDay(date, TODAY)) return 'Today';
  const yesterday = new Date(TODAY);
  yesterday.setDate(TODAY.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getLastMessagePreview(conv: Conversation): { text: string; time: string } {
  const last = conv.messages[conv.messages.length - 1];
  if (!last) return { text: '', time: '' };
  const prefix = last.from === 'me' ? 'You: ' : '';
  const time = isSameDay(last.timestamp, TODAY)
    ? formatTime(last.timestamp)
    : isSameDay(last.timestamp, new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - 1))
    ? 'Yesterday'
    : last.timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return { text: prefix + last.text, time };
}

// ─── Avatar component ─────────────────────────────────────────────────────────

function Avatar({
  name,
  color,
  size = 40,
  online,
}: {
  name: string;
  color: string;
  size?: number;
  online?: boolean;
}) {
  const dotSize = size <= 28 ? 8 : 10;
  return (
    <div style={{ position: 'relative', flexShrink: 0, width: size, height: size }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          backgroundColor: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size <= 28 ? '10px' : '13px',
          fontWeight: 700,
          color: '#fff',
          userSelect: 'none',
        }}
      >
        {getInitials(name)}
      </div>
      {online && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            backgroundColor: '#22c55e',
            border: '2px solid var(--surface-white)',
          }}
        />
      )}
    </div>
  );
}

// ─── Date separator ───────────────────────────────────────────────────────────

function DateSeparator({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        margin: '16px 0',
      }}
    >
      <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
      <span
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          whiteSpace: 'nowrap',
          padding: '2px 10px',
          backgroundColor: 'var(--bg-offwhite)',
          borderRadius: '999px',
          border: '1px solid var(--border-color)',
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Emoji picker
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiTab, setEmojiTab] = useState(0);
  const emojiRef = useRef<HTMLDivElement>(null);

  // New conversation search
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const newChatRef = useRef<HTMLDivElement>(null);
  const newChatInputRef = useRef<HTMLInputElement>(null);

  // Group creation
  const [groupStep, setGroupStep] = useState<'idle' | 'members' | 'name'>('idle');
  const [groupSelected, setGroupSelected] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null;

  // ── Supabase message persistence ───────────────────────────
  const convKey = selectedConv?.name ?? 'general';
  const { sendMessage: persistMessage } = useMessages(convKey);

  // Auto-scroll to bottom when conversation changes or new message sent
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedId, selectedConv?.messages.length]);

  // Close emoji picker on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setEmojiOpen(false);
      }
    }
    if (emojiOpen) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [emojiOpen]);

  // Close new-chat popup on outside click + focus input when opened
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (newChatRef.current && !newChatRef.current.contains(e.target as Node)) {
        setNewChatOpen(false);
        setNewChatSearch('');
      }
    }
    if (newChatOpen) {
      document.addEventListener('mousedown', onOutside);
      setTimeout(() => newChatInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener('mousedown', onOutside);
  }, [newChatOpen]);

  function insertEmoji(emoji: string) {
    setInputValue((prev) => prev + emoji);
    setEmojiOpen(false);
  }

  function openConversation(id: string) {
    handleSelectConversation(id);
    setNewChatOpen(false);
    setNewChatSearch('');
  }

  // Filter conversations by search
  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const lastMsg = c.messages[c.messages.length - 1]?.text ?? '';
    return c.name.toLowerCase().includes(q) || lastMsg.toLowerCase().includes(q);
  });

  function handleSelectConversation(id: string) {
    setSelectedId(id);
    // Clear unread when opening
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c))
    );
    setInputValue('');
  }

  function handleSend() {
    if (!inputValue.trim() || !selectedId) return;
    const text = inputValue.trim();
    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      from: 'me',
      text,
      timestamp: new Date(),
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedId ? { ...c, messages: [...c.messages, newMsg] } : c
      )
    );
    setInputValue('');
    // Persist to Supabase (fire-and-forget)
    persistMessage(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function closeNewChat() {
    setNewChatOpen(false);
    setNewChatSearch('');
    setGroupStep('idle');
    setGroupSelected(new Set());
    setGroupName('');
  }

  function handleCreateGroup() {
    if (!groupName.trim() || groupSelected.size < 2) return;
    const members = INITIAL_CONVERSATIONS
      .filter(c => groupSelected.has(c.id))
      .map(c => ({ id: c.id, name: c.name, color: c.avatarColor }));
    const newGroup: Conversation = {
      id: `group-${Date.now()}`,
      name: groupName.trim(),
      role: `${members.length} members`,
      avatarColor: '#2D6A4F',
      online: false,
      unread: 0,
      isGroup: true,
      members,
      messages: [],
    };
    setConversations(prev => [newGroup, ...prev]);
    setSelectedId(newGroup.id);
    closeNewChat();
  }

  // Group messages by date for rendering
  function groupMessagesByDate(messages: Message[]): { label: string; msgs: Message[] }[] {
    const groups: { label: string; msgs: Message[] }[] = [];
    for (const msg of messages) {
      const label = getDateLabel(msg.timestamp);
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.msgs.push(msg);
      } else {
        groups.push({ label, msgs: [msg] });
      }
    }
    return groups;
  }

  // Find last "mine" message index across all messages
  function getLastMineIndex(messages: Message[]): number {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].from === 'me') return i;
    }
    return -1;
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-offwhite)',
      }}
    >
      {/* ── Left panel ──────────────────────────────────────────────────────── */}
      <div
        style={{
          width: '320px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          backgroundColor: 'var(--surface-white)',
          borderRight: '1px solid var(--border-color)',
        }}
      >
        {/* Panel header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 20px 16px',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Messages
          </h2>

          {/* Compose button + popup */}
          <div ref={newChatRef} style={{ position: 'relative' }}>
            <button
              title="New message"
              onClick={() => { setNewChatOpen((v) => !v); setNewChatSearch(''); setGroupStep('idle'); setGroupSelected(new Set()); setGroupName(''); }}
              style={{
                width: '36px', height: '36px', borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: newChatOpen ? 'var(--surface-elevated)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-secondary)', transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
              onMouseLeave={(e) => { if (!newChatOpen) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <Pencil style={{ width: '16px', height: '16px' }} />
            </button>

            {newChatOpen && (
              <div
                style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  width: '290px', backgroundColor: 'var(--surface-white)',
                  border: '1px solid var(--border-color)', borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 40, overflow: 'hidden',
                }}
              >
                {/* ── Step: idle (default) ── */}
                {groupStep === 'idle' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>New message</span>
                      <button onClick={closeNewChat} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: '2px' }}>
                        <X style={{ width: '15px', height: '15px' }} />
                      </button>
                    </div>

                    {/* New group CTA */}
                    <div style={{ padding: '0 8px 6px' }}>
                      <button
                        onClick={() => { setGroupStep('members'); setNewChatSearch(''); }}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '9px 10px', borderRadius: '8px', border: 'none',
                          backgroundColor: 'rgba(45,106,79,0.08)', cursor: 'pointer', textAlign: 'left',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(45,106,79,0.14)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(45,106,79,0.08)')}
                      >
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#2D6A4F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Users style={{ width: '15px', height: '15px', color: '#fff' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--brand-green-text)' }}>New group</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Create a group chat</div>
                        </div>
                      </button>
                    </div>

                    <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />

                    <div style={{ padding: '6px 12px 8px', position: 'relative' }}>
                      <Search style={{ position: 'absolute', left: '22px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
                      <input
                        ref={newChatInputRef}
                        type="text"
                        placeholder="Search colleagues..."
                        value={newChatSearch}
                        onChange={(e) => setNewChatSearch(e.target.value)}
                        style={{ width: '100%', height: '34px', paddingLeft: '32px', paddingRight: '10px', fontSize: '13px', borderRadius: '8px', outline: 'none', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '0 6px 8px' }}>
                      {INITIAL_CONVERSATIONS
                        .filter((c) => !newChatSearch.trim() || c.name.toLowerCase().includes(newChatSearch.toLowerCase()) || c.role.toLowerCase().includes(newChatSearch.toLowerCase()))
                        .map((c) => (
                          <button key={c.id} onClick={() => openConversation(c.id)}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.15s' }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <Avatar name={c.name} color={c.avatarColor} size={34} online={c.online} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{c.role}</div>
                            </div>
                            <span style={{ marginLeft: 'auto', flexShrink: 0, width: '8px', height: '8px', borderRadius: '50%', backgroundColor: c.online ? '#22c55e' : 'var(--border-color)' }} />
                          </button>
                        ))}
                    </div>
                  </>
                )}

                {/* ── Step: select members ── */}
                {groupStep === 'members' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 16px 10px' }}>
                      <button onClick={() => setGroupStep('idle')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: '2px', flexShrink: 0 }}>
                        <ChevronLeft style={{ width: '16px', height: '16px' }} />
                      </button>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>Add members</span>
                      <button onClick={closeNewChat} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: '2px' }}>
                        <X style={{ width: '15px', height: '15px' }} />
                      </button>
                    </div>

                    <div style={{ padding: '0 12px 8px', position: 'relative' }}>
                      <Search style={{ position: 'absolute', left: '22px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search colleagues..."
                        value={newChatSearch}
                        onChange={(e) => setNewChatSearch(e.target.value)}
                        style={{ width: '100%', height: '34px', paddingLeft: '32px', paddingRight: '10px', fontSize: '13px', borderRadius: '8px', outline: 'none', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div style={{ maxHeight: '220px', overflowY: 'auto', padding: '0 6px 4px' }}>
                      {INITIAL_CONVERSATIONS
                        .filter((c) => !newChatSearch.trim() || c.name.toLowerCase().includes(newChatSearch.toLowerCase()))
                        .map((c) => {
                          const selected = groupSelected.has(c.id);
                          return (
                            <button key={c.id}
                              onClick={() => {
                                setGroupSelected(prev => {
                                  const next = new Set(prev);
                                  next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                                  return next;
                                });
                              }}
                              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', border: 'none', backgroundColor: selected ? 'rgba(45,106,79,0.08)' : 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.15s' }}
                              onMouseEnter={(e) => { if (!selected) e.currentTarget.style.backgroundColor = 'var(--surface-elevated)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = selected ? 'rgba(45,106,79,0.08)' : 'transparent'; }}
                            >
                              <Avatar name={c.name} color={c.avatarColor} size={32} online={c.online} />
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{c.role}</div>
                              </div>
                              <div style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, border: `2px solid ${selected ? '#2D6A4F' : 'var(--border-color)'}`, backgroundColor: selected ? '#2D6A4F' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                                {selected && <Check style={{ width: '11px', height: '11px', color: '#fff' }} />}
                              </div>
                            </button>
                          );
                        })}
                    </div>

                    <div style={{ padding: '8px 12px 12px', borderTop: '1px solid var(--border-color)' }}>
                      <button
                        disabled={groupSelected.size < 2}
                        onClick={() => { setGroupStep('name'); setNewChatSearch(''); }}
                        style={{ width: '100%', padding: '9px', borderRadius: '8px', border: 'none', cursor: groupSelected.size >= 2 ? 'pointer' : 'not-allowed', backgroundColor: groupSelected.size >= 2 ? '#2D6A4F' : 'var(--border-color)', color: '#fff', fontSize: '13px', fontWeight: 700, transition: 'opacity 0.15s' }}
                      >
                        {groupSelected.size < 2 ? 'Select at least 2 members' : `Next — ${groupSelected.size} selected`}
                      </button>
                    </div>
                  </>
                )}

                {/* ── Step: name the group ── */}
                {groupStep === 'name' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 16px 10px' }}>
                      <button onClick={() => setGroupStep('members')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: '2px', flexShrink: 0 }}>
                        <ChevronLeft style={{ width: '16px', height: '16px' }} />
                      </button>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>Name your group</span>
                      <button onClick={closeNewChat} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: '2px' }}>
                        <X style={{ width: '15px', height: '15px' }} />
                      </button>
                    </div>

                    {/* Selected members preview */}
                    <div style={{ padding: '0 12px 10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {INITIAL_CONVERSATIONS.filter(c => groupSelected.has(c.id)).map(c => (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px 3px 4px', borderRadius: '999px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-color)' }}>
                          <Avatar name={c.name} color={c.avatarColor} size={20} />
                          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{c.name.split(' ')[0]}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ padding: '0 12px 12px' }}>
                      <input
                        autoFocus
                        type="text"
                        placeholder="Group name..."
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreateGroup(); }}
                        style={{ width: '100%', height: '38px', padding: '0 12px', fontSize: '14px', borderRadius: '8px', outline: 'none', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)', color: 'var(--text-primary)', boxSizing: 'border-box', marginBottom: '10px' }}
                      />
                      <button
                        disabled={!groupName.trim()}
                        onClick={handleCreateGroup}
                        style={{ width: '100%', padding: '9px', borderRadius: '8px', border: 'none', cursor: groupName.trim() ? 'pointer' : 'not-allowed', backgroundColor: groupName.trim() ? '#2D6A4F' : 'var(--border-color)', color: '#fff', fontSize: '13px', fontWeight: 700, transition: 'opacity 0.15s' }}
                      >
                        Create Group
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '0 16px 12px', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '15px',
                height: '15px',
                color: 'var(--text-secondary)',
                pointerEvents: 'none',
              }}
            />
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
          {filteredConversations.map((conv) => {
            const isActive = conv.id === selectedId;
            const preview = getLastMessagePreview(conv);

            return (
              <button
                key={conv.id}
                onClick={() => handleSelectConversation(conv.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  backgroundColor: isActive ? 'var(--surface-elevated)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      'var(--surface-elevated)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                }}
              >
                {conv.isGroup ? (
                  <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: conv.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Users style={{ width: 18, height: 18, color: '#fff' }} />
                  </div>
                ) : (
                  <Avatar name={conv.name} color={conv.avatarColor} size={40} online={conv.online} />
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '160px',
                      }}
                    >
                      {conv.name}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', flexShrink: 0, marginLeft: '8px' }}>
                      {preview.time}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        marginBottom: '1px',
                        display: 'block',
                      }}
                    >
                      {conv.role}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {preview.text}
                    </span>
                    {conv.unread > 0 && (
                      <span
                        style={{
                          flexShrink: 0,
                          marginLeft: '8px',
                          backgroundColor: '#d4183d',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: 700,
                          borderRadius: '999px',
                          minWidth: '20px',
                          height: '20px',
                          padding: '0 6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
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
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          backgroundColor: 'var(--surface-white)',
        }}
      >
        {selectedConv ? (
          <>
            {/* Chat header */}
            <div
              style={{
                height: '64px',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 24px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--surface-white)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {selectedConv.isGroup ? (
                  <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: selectedConv.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Users style={{ width: 18, height: 18, color: '#fff' }} />
                  </div>
                ) : (
                  <Avatar name={selectedConv.name} color={selectedConv.avatarColor} size={40} online={selectedConv.online} />
                )}
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                    {selectedConv.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {selectedConv.isGroup
                        ? selectedConv.members?.map(m => m.name.split(' ')[0]).join(', ')
                        : selectedConv.role}
                    </span>
                    {!selectedConv.isGroup && (
                      <>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>·</span>
                        <span style={{ fontSize: '12px', fontWeight: 500, color: selectedConv.online ? '#22c55e' : 'var(--text-secondary)' }}>
                          {selectedConv.online ? 'Online' : 'Offline'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div />
            </div>

            {/* Messages area */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {(() => {
                const groups = groupMessagesByDate(selectedConv.messages);
                const allMsgs = selectedConv.messages;
                const lastMineIndex = getLastMineIndex(allMsgs);

                return groups.map((group) => (
                  <div key={group.label}>
                    <DateSeparator label={group.label} />
                    {group.msgs.map((msg) => {
                      const globalIndex = allMsgs.findIndex((m) => m.id === msg.id);
                      const isLastMine = globalIndex === lastMineIndex;
                      const isMe = msg.from === 'me';

                      return (
                        <div
                          key={msg.id}
                          style={{
                            display: 'flex',
                            flexDirection: isMe ? 'row-reverse' : 'row',
                            alignItems: 'flex-end',
                            gap: '8px',
                            marginBottom: '8px',
                          }}
                        >
                          {/* Their avatar */}
                          {!isMe && (
                            <div style={{ flexShrink: 0, marginBottom: isLastMine ? '20px' : '0' }}>
                              <Avatar
                                name={selectedConv.name}
                                color={selectedConv.avatarColor}
                                size={28}
                              />
                            </div>
                          )}

                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: isMe ? 'flex-end' : 'flex-start',
                              maxWidth: '60%',
                            }}
                          >
                            <div
                              style={{
                                padding: '10px 14px',
                                borderRadius: isMe
                                  ? '16px 16px 4px 16px'
                                  : '16px 16px 16px 4px',
                                backgroundColor: isMe ? 'var(--brand-green-text)' : 'var(--surface-elevated)',
                                color: isMe ? '#fff' : 'var(--text-primary)',
                                fontSize: '14px',
                                lineHeight: 1.5,
                                wordBreak: 'break-word',
                              }}
                            >
                              {msg.text}
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                marginTop: '3px',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: '11px',
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                {formatTime(msg.timestamp)}
                              </span>
                              {isMe && isLastMine && (
                                <span
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                    fontSize: '11px',
                                    color: 'var(--text-secondary)',
                                  }}
                                >
                                  <CheckCheck style={{ width: '12px', height: '12px' }} />
                                  Read
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
            <div
              style={{
                flexShrink: 0,
                borderTop: '1px solid var(--border-color)',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--surface-white)',
              }}
            >
              <button
                title="Attach file"
                style={{
                  width: '36px',
                  height: '36px',
                  flexShrink: 0,
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = 'transparent')
                }
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
                  <div
                    style={{
                      position: 'absolute', bottom: 'calc(100% + 8px)', right: 0,
                      width: '420px', backgroundColor: 'var(--surface-white)',
                      border: '1px solid var(--border-color)', borderRadius: '12px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.14)', zIndex: 40, overflow: 'hidden',
                    }}
                  >
                    {/* Category tabs — all fit without scrolling */}
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

                    {/* Emoji grid */}
                    <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '4px' }}>
                      {EMOJI_GROUPS[emojiTab].emojis.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => insertEmoji(emoji)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: '24px', padding: '6px', borderRadius: '8px',
                            lineHeight: 1, transition: 'background-color 0.1s',
                          }}
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
                  width: '36px',
                  height: '36px',
                  flexShrink: 0,
                  borderRadius: '999px',
                  border: 'none',
                  backgroundColor: inputValue.trim() ? 'var(--brand-green-text)' : 'var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
                  color: '#fff',
                  transition: 'background-color 0.15s',
                }}
              >
                <Send style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
          </>
        ) : (
          /* Empty state */
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              padding: '40px',
            }}
          >
            <div
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: 'rgba(45,106,79,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageSquare style={{ width: '40px', height: '40px', color: 'var(--brand-green-text)' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  margin: '0 0 8px',
                }}
              >
                Select a conversation
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
                Choose a staff member to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
