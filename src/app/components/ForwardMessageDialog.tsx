import { useEffect, useMemo, useState } from 'react';
import { Search, Forward, Loader2, Check, Users, Image as ImageIcon, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';

// ─── Public types ─────────────────────────────────────────────────────────────

/** A bare-minimum description of a message that can be forwarded. */
export interface ForwardableMessage {
  id: string;
  text: string;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  /**
   * Display name of the ORIGINAL sender, propagated to the forwarded copy so
   * the recipient can see "Forwarded from <name>". When forwarding a message
   * that was already forwarded, callers should pass through the existing
   * forwarded_from_name (preserve the original author chain) instead of the
   * intermediate forwarder.
   */
  forwardedFromName?: string;
}

/** A conversation row, shaped to match the existing ChatPage state. */
export interface ForwardableConversation {
  id: string;
  isGroup: boolean;
  otherName: string;
  otherProfileId: string;
  otherAvatarUrl?: string;
}

interface ForwardMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The message being forwarded. */
  message: ForwardableMessage | null;
  /** All of the current user's conversations (excluding the one the message is in is allowed; we still show it). */
  conversations: ForwardableConversation[];
  /** Conversation IDs to exclude (typically the one the message originates in). */
  excludeIds?: string[];
  /** Called when the user confirms forward. Implementation should insert one message per target. */
  onForward: (targetIds: string[], message: ForwardableMessage) => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS: string[] = [
  'var(--brand-green-text)', '#3B82F6', '#8B5CF6', '#EC4899', '#F4A261',
  '#06B6D4', '#DC2626', '#0891B2', '#7C3AED', '#059669',
];

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function previewText(msg: ForwardableMessage | null): string {
  if (!msg) return '';
  if (msg.imageUrl) return msg.text && msg.text !== '📷 Image' ? msg.text : '📷 Photo';
  if (msg.fileUrl && msg.fileName) return `📎 ${msg.fileName}`;
  return msg.text;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ForwardMessageDialog({
  open,
  onOpenChange,
  message,
  conversations,
  excludeIds = [],
  onForward,
}: ForwardMessageDialogProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [forwarding, setForwarding] = useState(false);
  const [done, setDone] = useState(false);

  // Reset state whenever the dialog closes
  useEffect(() => {
    if (!open) {
      // small delay so the user doesn't see the reset flicker mid-close animation
      const t = setTimeout(() => {
        setSearch('');
        setSelected(new Set());
        setForwarding(false);
        setDone(false);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations
      .filter(c => !excluded.has(c.id))
      .filter(c => !q || c.otherName.toLowerCase().includes(q));
  }, [conversations, excluded, search]);

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConfirm() {
    if (!message || selected.size === 0) return;
    setForwarding(true);
    try {
      await onForward(Array.from(selected), message);
      setDone(true);
      // Auto-close after a short success flash
      setTimeout(() => onOpenChange(false), 700);
    } catch (e) {
      console.error('[ForwardMessageDialog] forward failed:', e);
    } finally {
      setForwarding(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!forwarding) onOpenChange(v); }}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden [&>button]:top-[14px] [&>button]:right-[14px] [&>button]:w-8 [&>button]:h-8 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:rounded-[8px] [&>button]:!bg-[var(--surface-white)] [&>button]:!text-[var(--text-secondary)] [&>button]:!opacity-100 [&>button]:hover:!bg-[var(--surface-elevated)] [&>button]:!border [&>button]:!border-[var(--border-color)] [&>button]:transition-colors [&>button>svg]:w-4 [&>button>svg]:h-4"
        style={{ maxWidth: '480px', width: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div style={{ background: 'var(--surface-elevated)', padding: '18px 24px', flexShrink: 0, borderBottom: '1px solid var(--border-color)', borderLeft: '4px solid var(--brand-green-text)' }}>
          <DialogHeader>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '17px', fontWeight: 700 }}>
              <Forward style={{ width: '18px', height: '18px', color: 'var(--brand-green-text)' }} />
              Forward message
            </DialogTitle>
            <DialogDescription style={{ fontSize: '12px', marginTop: '2px' }}>
              Pick one or more conversations to forward this message to.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Message preview */}
        {message && (
          <div style={{ padding: '14px 24px 0' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 12px',
              borderRadius: '10px',
              backgroundColor: 'var(--surface-elevated)',
              border: '1px solid var(--border-color)',
              maxHeight: '88px', overflow: 'hidden',
            }}>
              {message.imageUrl ? (
                <img src={message.imageUrl} alt="" style={{ width: 44, height: 44, borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
              ) : message.fileUrl ? (
                <div style={{ width: 44, height: 44, borderRadius: '8px', backgroundColor: 'var(--surface-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText style={{ width: 20, height: 20, color: 'var(--text-secondary)' }} />
                </div>
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: '8px', backgroundColor: 'var(--surface-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ImageIcon style={{ width: 20, height: 20, color: 'var(--text-secondary)' }} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Message</span>
                  {message.forwardedFromName && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', textTransform: 'none', letterSpacing: 0, fontSize: '10px', fontWeight: 600, color: 'var(--brand-green-text)' }}>
                      <Forward style={{ width: '10px', height: '10px' }} />
                      from {message.forwardedFromName}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {previewText(message) || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>(empty)</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div style={{ padding: '14px 24px 8px', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
            <Input
              type="text"
              placeholder="Search conversations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '32px', height: '36px', fontSize: '13px' }}
            />
          </div>
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 8px', minHeight: '120px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '32px 12px', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {conversations.length === 0 ? 'No conversations available' : 'No matches'}
              </p>
            </div>
          ) : (
            filtered.map(conv => {
              const isSelected = selected.has(conv.id);
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => toggle(conv.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: isSelected ? 'color-mix(in srgb, var(--brand-green-text) 10%, transparent)' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background-color 0.15s',
                    marginBottom: '2px',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-elevated)'; }}
                  onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                >
                  {/* Avatar */}
                  {conv.isGroup ? (
                    <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'var(--brand-green-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Users style={{ width: 18, height: 18, color: '#fff' }} />
                    </div>
                  ) : conv.otherAvatarUrl ? (
                    <img src={conv.otherAvatarUrl} alt={conv.otherName} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: getAvatarColor(conv.otherProfileId || conv.id), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontSize: '12px', fontWeight: 700 }}>
                      {getInitials(conv.otherName)}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0, fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.otherName || 'Unknown'}
                  </div>
                  {/* Checkbox */}
                  <div style={{
                    width: 20, height: 20, borderRadius: '6px',
                    border: `2px solid ${isSelected ? 'var(--brand-green-text)' : 'var(--border-color)'}`,
                    backgroundColor: isSelected ? 'var(--brand-green-text)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.15s',
                  }}>
                    {isSelected && <Check style={{ width: 12, height: 12, color: '#fff', strokeWidth: 3 }} />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <DialogFooter style={{ padding: '14px 24px', borderTop: '1px solid var(--border-color)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {selected.size > 0 && `${selected.size} selected`}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={forwarding}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={forwarding || selected.size === 0 || done}
              style={{ minWidth: '120px', gap: '6px', backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)' }}
            >
              {forwarding ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Forwarding…</>
              ) : done ? (
                <><Check className="w-4 h-4" /> Forwarded</>
              ) : (
                <><Forward className="w-4 h-4" /> Forward{selected.size > 0 ? ` (${selected.size})` : ''}</>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
