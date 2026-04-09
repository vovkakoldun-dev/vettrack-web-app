import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search, MonitorSmartphone, Users, UserCheck, UserX, AlertTriangle,
  Clock, Mail, Trash2, Bell, ChevronDown, ChevronUp, X, Shield,
  PawPrint, Calendar, LogIn, Send, CheckCircle2, Loader2,
  Phone, Copy, KeyRound, Building2, Activity,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenantDb } from '../../context/TenantContext';

// ─── Dark mode hook ───────────────────────────────────────────
function useDarkMode(): boolean {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../../components/ui/select';

// ─── Theme ────────────────────────────────────────────────────
const ACCENT    = '#F4A261';
const ACCENT_D  = '#C2671A';
const ACCENT_BG = '#F4A26112';
const TODAY     = new Date('2026-03-15');
const ONE_YEAR_AGO = '2025-03-15';

// ─── Types ────────────────────────────────────────────────────
type AccountStatus = 'Active' | 'Inactive' | 'Warned' | 'Suspended';

interface PortalUser {
  id: string;          // clients.id
  profileId: string;   // profiles.id (for user_sessions lookup)
  name: string;
  email: string;
  phone: string;
  initials: string;
  avatarColor: string;
  pets: string[];
  clinic: string;
  accountCreated: string; // ISO (date-only, YYYY-MM-DD)
  lastLogin: string | null; // ISO date-only or null if never logged in
  status: AccountStatus;
  reminderSentAt?: string; // ISO — set when warning is sent
}

// ─── Helpers ──────────────────────────────────────────────────
/** Convert an ISO timestamp (date or full timestamptz) to a YYYY-MM-DD string. */
function toDateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

function daysSince(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const ms = TODAY.getTime() - new Date(iso + 'T00:00:00').getTime();
  return Math.floor(ms / 86_400_000);
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function lastLoginLabel(iso: string | null) {
  if (!iso) return 'Never';
  const d = daysSince(iso);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 30)  return `${d} days ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${(d / 365).toFixed(1)}y ago`;
}

const AVATAR_PALETTE = ['#F4A261', '#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#06B6D4', '#EF4444'];
function avatarColorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
function initialsOf(first?: string | null, last?: string | null, fallback = '?'): string {
  const f = (first || '').trim();
  const l = (last || '').trim();
  const i = `${f[0] || ''}${l[0] || ''}`.toUpperCase();
  return i || fallback;
}

function normalizeStatus(raw: string | null | undefined, isActive: boolean): AccountStatus {
  if (!isActive) return 'Suspended';
  switch ((raw || '').toLowerCase()) {
    case 'inactive':  return 'Inactive';
    case 'warned':    return 'Warned';
    case 'suspended': return 'Suspended';
    case 'active':
    default:          return 'Active';
  }
}

// ─── Status config ────────────────────────────────────────────
const STATUS_CFG: Record<AccountStatus, { color: string; bg: string; dot: string; label: string }> = {
  Active:    { color: '#16A34A', bg: '#22C55E15', dot: '#22C55E', label: 'Active'    },
  Inactive:  { color: '#6B7280', bg: '#6B728015', dot: '#9CA3AF', label: 'Inactive'  },
  Warned:    { color: '#D97706', bg: '#F59E0B18', dot: '#FBBF24', label: 'Warned'    },
  Suspended: { color: '#DC2626', bg: '#EF444415', dot: '#F87171', label: 'Suspended' },
};

const TABS = ['All', 'Active', 'Inactive', 'Warned', 'Suspended'] as const;
type Tab = typeof TABS[number];

// Clinic dropdown options are now built dynamically from fetched data.

// ─── Sub-components ───────────────────────────────────────────
function AvatarCircle({ initials, color, size = 36 }: { initials: string; color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, ${color}, ${color}cc)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: size * 0.34, fontWeight: 700,
    }}>
      {initials}
    </div>
  );
}

function StatusBadge({ status }: { status: AccountStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
      color: cfg.color, backgroundColor: cfg.bg,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

// ─── Inactive Alert Panel ─────────────────────────────────────
function InactivePanel({
  users, isDark,
  onSendReminder,
  onRemoveAccount,
}: {
  users: PortalUser[];
  isDark: boolean;
  onSendReminder: (id: string) => void;
  onRemoveAccount: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);

  if (users.length === 0) return null;

  // ── Dark-mode-aware palette
  const panelBg       = isDark ? '#1C1208'         : '#FFFBEB';
  const panelBorder   = isDark ? '#F59E0B35'        : '#FCD34D';
  const iconBg        = isDark ? '#2A1A06'          : '#FEF3C7';
  const titleColor    = isDark ? '#FCD34D'          : '#92400E';
  const subColor      = isDark ? '#F59E0B99'        : '#B45309';
  const rowBorder     = isDark ? '#F59E0B1A'        : '#FDE68A';
  const nameColor     = isDark ? '#FBBF24'          : '#78350F';
  const metaColor     = isDark ? '#F59E0B99'        : '#92400E';
  const warnBtnBg     = isDark ? '#2A1A06'          : '#FEF3C7';
  const warnBtnBorder = isDark ? '#F59E0B50'        : '#FCD34D';
  const warnBtnText   = isDark ? '#FBBF24'          : '#92400E';
  const warnBtnHover  = isDark ? '#3A2208'          : '#FDE68A';
  const removeBtnBg   = isDark ? '#2A0C0C'          : '#FEF2F2';
  const removeBtnBdr  = isDark ? '#F8717150'        : '#FCA5A5';
  const removeBtnHov  = isDark ? '#3A1010'          : '#FEE2E2';

  return (
    <div style={{
      backgroundColor: panelBg,
      border: `1.5px solid ${panelBorder}`,
      borderRadius: 16,
      marginBottom: 24,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', padding: '16px 20px', background: 'none', border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
          textAlign: 'left',
        }}
      >
        <div style={{
          width: 38, height: 38, borderRadius: 10, backgroundColor: iconBg,
          border: `1px solid ${panelBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <AlertTriangle style={{ width: 18, height: 18, color: '#D97706' }} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: titleColor, margin: 0 }}>
            {users.length} Inactive Account{users.length !== 1 ? 's' : ''} — No activity for 1+ year
          </p>
          <p style={{ fontSize: 12, color: subColor, margin: '2px 0 0' }}>
            These accounts haven't been used since before {fmtDate(ONE_YEAR_AGO)}. You can send a warning or remove the account.
          </p>
        </div>
        <div style={{ flexShrink: 0, color: '#D97706' }}>
          {expanded ? <ChevronUp style={{ width: 18, height: 18 }} /> : <ChevronDown style={{ width: 18, height: 18 }} />}
        </div>
      </button>

      {/* Rows */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${panelBorder}` }}>
          {users.map((u, i) => {
            const d = daysSince(u.lastLogin);
            const isConfirming = confirming === u.id;
            return (
              <div
                key={u.id}
                style={{
                  padding: '14px 20px',
                  borderBottom: i < users.length - 1 ? `1px solid ${rowBorder}` : 'none',
                  display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                  backgroundColor: panelBg,
                }}
              >
                <AvatarCircle initials={u.initials} color={u.avatarColor} size={40} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: nameColor, margin: '0 0 2px' }}>{u.name}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                    <span style={{ fontSize: 12, color: metaColor }}>
                      <Mail style={{ width: 11, height: 11, display: 'inline', marginRight: 3 }} />{u.email}
                    </span>
                    <span style={{ fontSize: 12, color: metaColor }}>
                      <Clock style={{ width: 11, height: 11, display: 'inline', marginRight: 3 }} />Last login: {fmtDate(u.lastLogin)} ({d} days ago)
                    </span>
                    {u.pets.length > 0 && (
                      <span style={{ fontSize: 12, color: metaColor }}>
                        <PawPrint style={{ width: 11, height: 11, display: 'inline', marginRight: 3 }} />{u.pets.join(', ')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => onSendReminder(u.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                      borderRadius: 8, border: `1px solid ${warnBtnBorder}`,
                      backgroundColor: warnBtnBg, color: warnBtnText,
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = warnBtnHover; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = warnBtnBg; }}
                  >
                    <Bell style={{ width: 13, height: 13 }} />
                    Send Warning
                  </button>

                  {!isConfirming ? (
                    <button
                      onClick={() => setConfirming(u.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                        borderRadius: 8, border: `1px solid ${removeBtnBdr}`,
                        backgroundColor: removeBtnBg, color: '#DC2626',
                        fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = removeBtnHov; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = removeBtnBg; }}
                    >
                      <Trash2 style={{ width: 13, height: 13 }} />
                      Remove Account
                    </button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#DC2626' }}>Confirm?</span>
                      <button
                        onClick={() => { onRemoveAccount(u.id); setConfirming(null); }}
                        style={{
                          padding: '6px 12px', borderRadius: 8, border: 'none',
                          backgroundColor: '#DC2626', color: '#fff',
                          fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        Yes, Remove
                      </button>
                      <button
                        onClick={() => setConfirming(null)}
                        style={{
                          width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border-color)',
                          backgroundColor: 'transparent', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <X style={{ width: 13, height: 13 }} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Reminder Sent Toast ──────────────────────────────────────
function ReminderToast({ name, onDismiss }: { name: string; onDismiss: () => void }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 100,
      backgroundColor: 'var(--surface-white)',
      border: '1.5px solid #22C55E40',
      borderRadius: 14, padding: '14px 18px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
      display: 'flex', alignItems: 'center', gap: 12,
      animation: 'slideUp 0.22s cubic-bezier(0.4,0,0.2,1)',
      minWidth: 320,
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#22C55E15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Send style={{ width: 16, height: 16, color: '#16A34A' }} />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Warning sent to {name}</p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
          They've been notified — account will be deactivated in 5 days if no action.
        </p>
      </div>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
        <X style={{ width: 15, height: 15 }} />
      </button>
    </div>
  );
}

// ─── Portal Detail Dialog ─────────────────────────────────────
function PortalDetailDialog({
  user, onClose, onSendReminder, onRemoveAccount, onSendResetEmail,
}: {
  user: PortalUser;
  onClose: () => void;
  onSendReminder: (id: string) => void;
  onRemoveAccount: (id: string) => void;
  onSendResetEmail: (email: string) => Promise<void>;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [resetSending, setResetSending] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSendReset = async () => {
    if (!user.email) return;
    setResetSending(true);
    try {
      await onSendResetEmail(user.email);
      setResetSent(true);
      setTimeout(() => setResetSent(false), 4000);
    } catch (e) {
      console.error('[PortalDetailDialog] reset failed:', e);
    } finally {
      setResetSending(false);
    }
  };

  const cfg = STATUS_CFG[user.status];
  const daysSinceLogin = daysSince(user.lastLogin);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, animation: 'fadeIn 0.15s ease',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="portal-detail-title"
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--surface-white)',
          borderRadius: 18,
          maxWidth: 560, width: '100%',
          maxHeight: '90vh', overflowY: 'auto',
          border: '1px solid var(--border-color)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
          animation: 'slideUp 0.22s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Header with gradient avatar */}
        <div style={{
          padding: '24px 24px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'flex-start', gap: 16,
        }}>
          <AvatarCircle initials={user.initials} color={user.avatarColor} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2
                id="portal-detail-title"
                style={{
                  fontSize: 20, fontWeight: 800, color: 'var(--text-primary)',
                  margin: 0, lineHeight: 1.2,
                }}
              >{user.name}</h2>
              <StatusBadge status={user.status} />
            </div>
            <p style={{
              fontSize: 13, color: 'var(--text-secondary)',
              margin: '4px 0 0', wordBreak: 'break-all',
            }}>{user.email || 'No email'}</p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 34, height: 34, borderRadius: 10,
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--surface-elevated)',
              cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-secondary)',
            }}
            title="Close"
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* ── Contact ── */}
          <section>
            <SectionLabel icon={Mail}>Contact</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <DetailRow
                icon={Mail}
                label="Email"
                value={user.email || '—'}
                action={user.email ? {
                  label: copied === 'email' ? '✓' : 'Copy',
                  onClick: () => copyToClipboard(user.email, 'email'),
                } : undefined}
              />
              <DetailRow
                icon={Phone}
                label="Phone"
                value={user.phone || '—'}
                action={user.phone ? {
                  label: copied === 'phone' ? '✓' : 'Copy',
                  onClick: () => copyToClipboard(user.phone, 'phone'),
                } : undefined}
              />
            </div>
          </section>

          {/* ── Clinic ── */}
          <section>
            <SectionLabel icon={Building2}>Clinic</SectionLabel>
            <p style={{
              fontSize: 14, color: 'var(--text-primary)', margin: 0,
              padding: '10px 12px', backgroundColor: 'var(--surface-elevated)',
              borderRadius: 10, border: '1px solid var(--border-color)',
            }}>
              {user.clinic}
            </p>
          </section>

          {/* ── Pets ── */}
          <section>
            <SectionLabel icon={PawPrint}>
              Pets ({user.pets.length})
            </SectionLabel>
            {user.pets.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {user.pets.map(p => (
                  <span key={p} style={{
                    fontSize: 12, fontWeight: 600, padding: '6px 12px',
                    borderRadius: 20, backgroundColor: 'var(--surface-elevated)',
                    color: 'var(--text-primary)', border: '1px solid var(--border-color)',
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}>
                    <PawPrint style={{ width: 12, height: 12, color: ACCENT_D }} />{p}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{
                fontSize: 13, color: 'var(--text-secondary)', margin: 0,
                fontStyle: 'italic',
              }}>No pets registered</p>
            )}
          </section>

          {/* ── Account Activity ── */}
          <section>
            <SectionLabel icon={Activity}>Account activity</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <DetailRow icon={Calendar} label="Created" value={fmtDate(user.accountCreated)} />
              <DetailRow
                icon={LogIn}
                label="Last login"
                value={
                  user.lastLogin
                    ? `${lastLoginLabel(user.lastLogin)} · ${fmtDate(user.lastLogin)}`
                    : 'Never logged in'
                }
                valueColor={
                  user.lastLogin === null ? '#DC2626'
                  : daysSinceLogin > 365 ? '#D97706'
                  : 'var(--text-primary)'
                }
              />
              {user.reminderSentAt && (
                <DetailRow
                  icon={Bell}
                  label="Warning sent"
                  value={fmtDate(user.reminderSentAt)}
                  valueColor="#B45309"
                />
              )}
            </div>
          </section>

          {/* ── Password ── */}
          <section>
            <SectionLabel icon={KeyRound}>Password</SectionLabel>
            <div style={{
              padding: '14px 14px', backgroundColor: 'var(--surface-elevated)',
              borderRadius: 12, border: '1px dashed var(--border-color)',
            }}>
              <p style={{
                fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 10px',
                lineHeight: 1.45,
              }}>
                Passwords are hashed by Supabase Auth and cannot be viewed. Send a
                password reset email — the user will receive a secure link to set a new one.
              </p>
              <button
                onClick={handleSendReset}
                disabled={!user.email || resetSending || resetSent}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '9px 16px', borderRadius: 9, border: 'none',
                  backgroundColor: resetSent ? '#22C55E' : ACCENT,
                  color: '#fff', fontSize: 13, fontWeight: 700,
                  cursor: resetSending || resetSent || !user.email ? 'default' : 'pointer',
                  opacity: !user.email ? 0.5 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {resetSending ? (
                  <>
                    <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                    Sending…
                  </>
                ) : resetSent ? (
                  <>
                    <CheckCircle2 style={{ width: 14, height: 14 }} />
                    Reset email sent
                  </>
                ) : (
                  <>
                    <Send style={{ width: 14, height: 14 }} />
                    Send Password Reset Email
                  </>
                )}
              </button>
            </div>
          </section>
        </div>

        {/* Footer actions */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid var(--border-color)',
          display: 'flex', gap: 8, justifyContent: 'space-between',
          flexWrap: 'wrap', backgroundColor: 'var(--surface-elevated)',
          borderBottomLeftRadius: 18, borderBottomRightRadius: 18,
        }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {user.status === 'Inactive' && (
              <button
                onClick={() => onSendReminder(user.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                  borderRadius: 9, border: '1px solid #FCD34D',
                  backgroundColor: '#FEF9C3', color: '#92400E',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                <Bell style={{ width: 13, height: 13 }} />
                Send Warning
              </button>
            )}
            {confirmingRemove ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#DC2626' }}>Remove this account?</span>
                <button
                  onClick={() => { onRemoveAccount(user.id); onClose(); }}
                  style={{
                    padding: '7px 12px', borderRadius: 8, border: 'none',
                    backgroundColor: '#DC2626', color: '#fff',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}
                >Yes, Remove</button>
                <button
                  onClick={() => setConfirmingRemove(false)}
                  style={{
                    width: 28, height: 28, borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    background: 'transparent', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <X style={{ width: 13, height: 13 }} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingRemove(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                  borderRadius: 9, border: '1px solid #FCA5A5',
                  backgroundColor: '#FEF2F2', color: '#DC2626',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                <Trash2 style={{ width: 13, height: 13 }} />
                Remove Account
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px', borderRadius: 9,
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--surface-white)', color: 'var(--text-primary)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dialog sub-components ────────────────────────────────────
function SectionLabel({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      marginBottom: 8,
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.06em', color: 'var(--text-secondary)',
    }}>
      <Icon style={{ width: 12, height: 12 }} />
      {children}
    </div>
  );
}

function DetailRow({
  icon: Icon, label, value, valueColor, action,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  valueColor?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px', borderRadius: 8,
      backgroundColor: 'var(--surface-elevated)',
      border: '1px solid var(--border-color)',
    }}>
      <Icon style={{ width: 14, height: 14, color: 'var(--text-secondary)', flexShrink: 0 }} />
      <span style={{
        fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
        minWidth: 70, flexShrink: 0,
      }}>{label}</span>
      <span style={{
        fontSize: 13, fontWeight: 500,
        color: valueColor || 'var(--text-primary)',
        flex: 1, wordBreak: 'break-word', minWidth: 0,
      }}>{value}</span>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            padding: '4px 10px', borderRadius: 6,
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--surface-white)',
            color: 'var(--text-secondary)',
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function SuperAdminPatientPortalsPage() {
  const isDark = useDarkMode();
  const db = useTenantDb();
  const [users, setUsers]             = useState<PortalUser[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [tab, setTab]                 = useState<Tab>('All');
  const [clinicFilter, setClinicFilter] = useState('All Clinics');
  const [clinicOptions, setClinicOptions] = useState<string[]>(['All Clinics']);
  const [toast, setToast]             = useState<{ name: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<PortalUser | null>(null);

  // Send a Supabase password reset email for a given address.
  const handleSendResetEmail = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      console.error('[PortalsPage] resetPasswordForEmail failed:', error);
      throw error;
    }
  }, []);

  // ── Fetch portal accounts from Supabase ─────────────────────
  const fetchPortalUsers = useCallback(async () => {
    try {
      // 1. Pull every client row that has a linked profile (= a real portal account).
      const { data: clientRows, error: cErr } = await db
        .from('clients')
        .select(
          'id, profile_id, first_name, last_name, email, phone, avatar_color, ' +
          'portal_status, portal_last_login_at, portal_reminder_sent_at, ' +
          'created_at, is_active, clinic:clinics(name)'
        )
        .not('profile_id', 'is', null)
        .order('created_at', { ascending: false });

      if (cErr) {
        console.error('[PortalsPage] failed to fetch clients:', cErr);
        setUsers([]);
        return;
      }

      const rows = (clientRows || []) as any[];
      const clientIds  = rows.map(r => r.id);
      const profileIds = rows.map(r => r.profile_id).filter(Boolean) as string[];

      // 2. Pull pet names for those clients in a single query.
      const petsByClient: Record<string, string[]> = {};
      if (clientIds.length > 0) {
        const { data: petRows } = await db
          .from('pets')
          .select('client_id, name')
          .in('client_id', clientIds);
        for (const p of (petRows || []) as any[]) {
          if (!petsByClient[p.client_id]) petsByClient[p.client_id] = [];
          if (p.name) petsByClient[p.client_id].push(p.name);
        }
      }

      // 3. Pull most-recent user_sessions activity per linked profile (presence
      //    heartbeat = best proxy for "last login" when portal_last_login_at is null).
      //    user_sessions has no organization_id, so use raw supabase.
      const lastActiveByProfile: Record<string, string> = {};
      if (profileIds.length > 0) {
        const { data: sessRows } = await supabase
          .from('user_sessions')
          .select('user_id, last_active_at')
          .in('user_id', profileIds);
        for (const s of (sessRows || []) as any[]) {
          const cur = lastActiveByProfile[s.user_id];
          if (!cur || (s.last_active_at && s.last_active_at > cur)) {
            lastActiveByProfile[s.user_id] = s.last_active_at;
          }
        }
      }

      // 4. Map → PortalUser
      const mapped: PortalUser[] = rows.map(r => {
        const lastLogin =
          toDateOnly(r.portal_last_login_at) ||
          toDateOnly(lastActiveByProfile[r.profile_id]) ||
          null;
        const clinicName = (r.clinic && (r.clinic as any).name) || '—';
        const fullName = `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Unknown';
        return {
          id: r.id,
          profileId: r.profile_id,
          name: fullName,
          email: r.email || '',
          phone: r.phone || '',
          initials: initialsOf(r.first_name, r.last_name),
          avatarColor: r.avatar_color || avatarColorFor(r.id),
          pets: petsByClient[r.id] || [],
          clinic: clinicName,
          accountCreated: toDateOnly(r.created_at) || '',
          lastLogin,
          status: normalizeStatus(r.portal_status, !!r.is_active),
          reminderSentAt: toDateOnly(r.portal_reminder_sent_at) || undefined,
        };
      });

      setUsers(mapped);

      // Build the unique clinic-name dropdown options from what's actually in the data.
      const uniqueClinics = Array.from(new Set(mapped.map(u => u.clinic).filter(c => c && c !== '—'))).sort();
      setClinicOptions(['All Clinics', ...uniqueClinics]);
    } catch (e) {
      console.error('[PortalsPage] fetchPortalUsers crashed:', e);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    setLoading(true);
    fetchPortalUsers();
  }, [fetchPortalUsers]);

  // ── Inactive = last login > 1 year ago AND status still Inactive
  const inactiveUsers = useMemo(
    () => users.filter(u => u.status === 'Inactive' && (u.lastLogin === null || u.lastLogin < ONE_YEAR_AGO)),
    [users]
  );

  // ── Filtered table rows
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(u => {
      const matchQ      = !q || `${u.name} ${u.email} ${u.phone} ${u.pets.join(' ')}`.toLowerCase().includes(q);
      const matchClinic = clinicFilter === 'All Clinics' || u.clinic === clinicFilter;
      const matchTab    = tab === 'All' || u.status === tab;
      return matchQ && matchClinic && matchTab;
    });
  }, [users, search, tab, clinicFilter]);

  const tabCounts = useMemo(() =>
    TABS.reduce((acc, t) => {
      acc[t] = t === 'All' ? users.length : users.filter(u => u.status === t).length;
      return acc;
    }, {} as Record<Tab, number>)
  , [users]);

  // ── Stats
  const totalActive    = users.filter(u => u.status === 'Active').length;
  const totalInactive  = users.filter(u => u.status === 'Inactive').length;
  const totalWarned    = users.filter(u => u.status === 'Warned').length;
  const totalSuspended = users.filter(u => u.status === 'Suspended').length;

  // ── Handlers
  const handleSendReminder = async (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    const nowIso = new Date().toISOString();
    // Optimistic UI update
    setUsers(prev => prev.map(u =>
      u.id === id ? { ...u, status: 'Warned', reminderSentAt: nowIso.slice(0, 10) } : u
    ));
    setToast({ name: user.name });
    setTimeout(() => setToast(null), 5000);
    // Persist to Supabase
    const { error } = await db
      .from('clients')
      .update({ portal_status: 'Warned', portal_reminder_sent_at: nowIso })
      .eq('id', id);
    if (error) {
      console.error('[PortalsPage] failed to persist Warned status:', error);
    }
  };

  const handleRemoveAccount = async (id: string) => {
    // Optimistic UI removal
    setUsers(prev => prev.filter(u => u.id !== id));
    setConfirmDeleteId(null);
    // Soft-delete: deactivate the portal account (NOT a hard delete).
    const { error } = await db
      .from('clients')
      .update({ is_active: false, portal_status: 'Suspended' })
      .eq('id', id);
    if (error) {
      console.error('[PortalsPage] failed to deactivate client:', error);
      // Roll back the optimistic removal so the user knows it failed.
      fetchPortalUsers();
    }
  };

  const STATS = [
    { label: 'Total Portals',    value: users.length,    icon: MonitorSmartphone, color: ACCENT,    bg: ACCENT_BG,    sub: 'registered accounts' },
    { label: 'Active',           value: totalActive,     icon: UserCheck,         color: '#16A34A', bg: '#22C55E15',  sub: 'used in last year' },
    { label: 'Inactive',         value: totalInactive,   icon: Clock,             color: '#6B7280', bg: '#6B728015',  sub: 'no login >1 year' },
    { label: 'Warned / At Risk', value: totalWarned + totalSuspended, icon: AlertTriangle, color: '#D97706', bg: '#F59E0B18', sub: 'reminder sent or suspended' },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', padding: '32px 32px 48px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* ── Page Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>
              Patient Portals
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
              Manage client portal accounts — monitor activity and deactivate inactive users
            </p>
          </div>
          {inactiveUsers.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
              borderRadius: 10,
              backgroundColor: isDark ? '#2A1A06' : '#FEF3C7',
              border: `1px solid ${isDark ? '#F59E0B50' : '#FCD34D'}`,
            }}>
              <AlertTriangle style={{ width: 15, height: 15, color: '#D97706', flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#FBBF24' : '#92400E' }}>
                {inactiveUsers.length} inactive account{inactiveUsers.length !== 1 ? 's' : ''} need attention
              </span>
            </div>
          )}
        </div>

        {/* ── Stat Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          {STATS.map(s => (
            <div key={s.label} style={{
              backgroundColor: 'var(--surface-white)', borderRadius: 16, padding: '20px',
              border: '1px solid var(--border-color)', display: 'flex', alignItems: 'flex-start', gap: 14,
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <s.icon style={{ width: 20, height: 20, color: s.color }} />
              </div>
              <div>
                <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 2px', lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px' }}>{s.label}</p>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>{s.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Inactive Alert Panel ── */}
        <InactivePanel
          users={inactiveUsers}
          isDark={isDark}
          onSendReminder={handleSendReminder}
          onRemoveAccount={handleRemoveAccount}
        />

        {/* ── Main Table Card ── */}
        <div style={{ backgroundColor: 'var(--surface-white)', borderRadius: 20, border: '1px solid var(--border-color)', overflow: 'hidden' }}>

          {/* Toolbar */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 240px' }}>
              <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: 'var(--text-secondary)' }} />
              <Input
                placeholder="Search by name, email, pet name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 36, height: 38 }}
              />
            </div>
            <Select value={clinicFilter} onValueChange={setClinicFilter}>
              <SelectTrigger style={{ width: 210, height: 38 }}><SelectValue /></SelectTrigger>
              <SelectContent>{clinicOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Status tabs */}
          <div style={{ padding: '0 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 2, overflowX: 'auto' }}>
            {TABS.map(t => {
              const active = tab === t;
              const cfg = t !== 'All' ? STATUS_CFG[t as AccountStatus] : null;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: '12px 14px', border: 'none', cursor: 'pointer', background: 'transparent',
                    whiteSpace: 'nowrap', fontSize: 13, fontWeight: active ? 700 : 500,
                    color: active ? (cfg?.color ?? ACCENT_D) : 'var(--text-secondary)',
                    borderBottom: active ? `2px solid ${cfg?.dot ?? ACCENT}` : '2px solid transparent',
                    transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {t}
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20,
                    backgroundColor: active ? (cfg?.bg ?? ACCENT_BG) : 'var(--surface-elevated)',
                    color: active ? (cfg?.color ?? ACCENT_D) : 'var(--text-secondary)',
                  }}>{tabCounts[t]}</span>
                </button>
              );
            })}
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-elevated)' }}>
                  {['Account Holder', 'Clinic', 'Pets', 'Account Created', 'Last Login', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{
                      padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
                      letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-color)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                        Loading portal accounts…
                      </span>
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
                      {users.length === 0
                        ? 'No portal accounts yet. They\'ll appear here once a pet owner creates a portal account.'
                        : 'No portal accounts match your filters.'}
                    </td>
                  </tr>
                )}
                {!loading && filtered.map((u, i) => {
                  const isOld = u.lastLogin !== null && u.lastLogin < ONE_YEAR_AGO;
                  return (
                    <tr
                      key={u.id}
                      onClick={() => setSelectedUser(u)}
                      style={{
                        borderBottom: i < filtered.length - 1 ? '1px solid var(--border-color)' : 'none',
                        transition: 'background 0.12s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Account Holder */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <AvatarCircle initials={u.initials} color={u.avatarColor} size={38} />
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 1px' }}>{u.name}</p>
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Clinic */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{u.clinic}</span>
                      </td>

                      {/* Pets */}
                      <td style={{ padding: '14px 16px' }}>
                        {u.pets.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {u.pets.map(p => (
                              <span key={p} style={{
                                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                                backgroundColor: 'var(--surface-elevated)', color: 'var(--text-primary)',
                                display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap',
                              }}>
                                <PawPrint style={{ width: 10, height: 10, color: ACCENT_D }} />{p}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No pets</span>
                        )}
                      </td>

                      {/* Account Created */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{fmtDate(u.accountCreated)}</span>
                      </td>

                      {/* Last Login */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <p style={{
                          fontSize: 13, fontWeight: isOld ? 700 : 400,
                          color: isOld ? '#D97706' : 'var(--text-primary)', margin: '0 0 1px',
                        }}>
                          {isOld && <Clock style={{ width: 11, height: 11, display: 'inline', marginRight: 4 }} />}
                          {lastLoginLabel(u.lastLogin)}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>{fmtDate(u.lastLogin)}</p>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <StatusBadge status={u.status} />
                        {u.status === 'Warned' && u.reminderSentAt && (
                          <p style={{ fontSize: 10, color: '#B45309', margin: '3px 0 0', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <CheckCircle2 style={{ width: 10, height: 10 }} />
                            Warning sent {fmtDate(u.reminderSentAt)}
                          </p>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 16px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {/* Send reminder — show for Inactive only */}
                          {u.status === 'Inactive' && (
                            <button
                              onClick={() => handleSendReminder(u.id)}
                              title="Send deactivation warning"
                              style={{
                                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                                borderRadius: 7,
                                border: `1px solid ${isDark ? '#F59E0B50' : '#FCD34D'}`,
                                backgroundColor: isDark ? '#2A1A06' : '#FEF9C3',
                                color: isDark ? '#FBBF24' : '#92400E',
                                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = isDark ? '#3A2208' : '#FDE68A'}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = isDark ? '#2A1A06' : '#FEF9C3'}
                            >
                              <Bell style={{ width: 12, height: 12 }} /> Warn
                            </button>
                          )}

                          {/* Remove account */}
                          {confirmDeleteId === u.id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626' }}>Sure?</span>
                              <button
                                onClick={() => handleRemoveAccount(u.id)}
                                style={{ padding: '5px 10px', borderRadius: 7, border: 'none', backgroundColor: '#DC2626', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                              >Yes</button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}
                              >
                                <X style={{ width: 11, height: 11 }} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(u.id)}
                              title="Remove account"
                              style={{
                                width: 28, height: 28, borderRadius: 7,
                                border: `1px solid ${isDark ? '#F8717150' : '#FCA5A5'}`,
                                backgroundColor: isDark ? '#2A0C0C' : '#FEF2F2',
                                color: '#DC2626', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = isDark ? '#3A1010' : '#FEE2E2'}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = isDark ? '#2A0C0C' : '#FEF2F2'}
                            >
                              <Trash2 style={{ width: 13, height: 13 }} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div style={{
            padding: '14px 20px', borderTop: '1px solid var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Showing <strong style={{ color: 'var(--text-primary)' }}>{filtered.length}</strong> of <strong style={{ color: 'var(--text-primary)' }}>{users.length}</strong> accounts
            </span>
            <div style={{ display: 'flex', gap: 16 }}>
              {(['Active', 'Inactive', 'Warned', 'Suspended'] as AccountStatus[]).map(s => {
                const cnt = users.filter(u => u.status === s).length;
                if (cnt === 0) return null;
                const cfg = STATUS_CFG[s];
                return (
                  <span key={s} style={{ fontSize: 12, color: cfg.color, fontWeight: 600 }}>
                    {s}: {cnt}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Toast notification ── */}
      {toast && <ReminderToast name={toast.name} onDismiss={() => setToast(null)} />}

      {/* ── Portal Detail Dialog ── */}
      {selectedUser && (
        <PortalDetailDialog
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onSendReminder={(id) => { handleSendReminder(id); }}
          onRemoveAccount={(id) => { handleRemoveAccount(id); }}
          onSendResetEmail={handleSendResetEmail}
        />
      )}
    </div>
  );
}
