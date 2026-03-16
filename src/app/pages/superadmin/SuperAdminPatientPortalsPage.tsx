import { useState, useMemo, useEffect } from 'react';
import {
  Search, MonitorSmartphone, Users, UserCheck, UserX, AlertTriangle,
  Clock, Mail, Trash2, Bell, ChevronDown, ChevronUp, X, Shield,
  PawPrint, Calendar, LogIn, Send, CheckCircle2,
} from 'lucide-react';

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
  id: string;
  name: string;
  email: string;
  phone: string;
  initials: string;
  avatarColor: string;
  pets: string[];
  clinic: string;
  accountCreated: string; // ISO
  lastLogin: string;      // ISO
  status: AccountStatus;
  reminderSentAt?: string; // ISO — set when warning is sent
}

// ─── Helpers ──────────────────────────────────────────────────
function daysSince(iso: string): number {
  const ms = TODAY.getTime() - new Date(iso + 'T00:00:00').getTime();
  return Math.floor(ms / 86_400_000);
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function lastLoginLabel(iso: string) {
  const d = daysSince(iso);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 30)  return `${d} days ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${(d / 365).toFixed(1)}y ago`;
}

// ─── Mock Data ────────────────────────────────────────────────
const INITIAL_USERS: PortalUser[] = [
  // Active — recent logins
  { id: 'P001', name: 'John Smith',       email: 'john.smith@email.com',       phone: '(555) 100-0001', initials: 'JS', avatarColor: '#3B82F6', pets: ['Max', 'Bella'],        clinic: 'Downtown Hugory Vet',    accountCreated: '2023-02-10', lastLogin: '2026-03-14', status: 'Active' },
  { id: 'P002', name: 'Emily Johnson',    email: 'emily.j@email.com',          phone: '(555) 100-0002', initials: 'EJ', avatarColor: '#8B5CF6', pets: ['Luna'],               clinic: 'Downtown Hugory Vet',    accountCreated: '2022-11-05', lastLogin: '2026-03-12', status: 'Active' },
  { id: 'P003', name: 'Michael Brown',    email: 'mbrown@email.com',           phone: '(555) 100-0003', initials: 'MB', avatarColor: '#059669', pets: ['Cooper'],             clinic: 'Westside Animal Care',   accountCreated: '2023-06-18', lastLogin: '2026-03-10', status: 'Active' },
  { id: 'P004', name: 'Sarah Williams',   email: 'swilliams@email.com',        phone: '(555) 100-0004', initials: 'SW', avatarColor: '#EC4899', pets: ['Bella', 'Mochi'],     clinic: 'Downtown Hugory Vet',    accountCreated: '2022-08-22', lastLogin: '2026-03-08', status: 'Active' },
  { id: 'P005', name: 'James Wilson',     email: 'jwilson@email.com',          phone: '(555) 100-0005', initials: 'JW', avatarColor: '#F59E0B', pets: ['Rocky'],              clinic: 'Northpark Pet Hospital', accountCreated: '2023-01-15', lastLogin: '2026-03-05', status: 'Active' },
  { id: 'P006', name: 'Jessica Taylor',   email: 'jtaylor@email.com',          phone: '(555) 100-0006', initials: 'JT', avatarColor: '#6366F1', pets: ['Milo'],               clinic: 'Westside Animal Care',   accountCreated: '2023-04-30', lastLogin: '2026-02-28', status: 'Active' },
  { id: 'P007', name: 'Robert Anderson',  email: 'randerson@email.com',        phone: '(555) 100-0007', initials: 'RA', avatarColor: '#0EA5E9', pets: ['Daisy'],              clinic: 'Downtown Hugory Vet',    accountCreated: '2022-07-14', lastLogin: '2026-02-20', status: 'Active' },
  { id: 'P008', name: 'David Miller',     email: 'dmiller@email.com',          phone: '(555) 100-0008', initials: 'DM', avatarColor: '#10B981', pets: ['Charlie', 'Peanut'],  clinic: 'Northpark Pet Hospital', accountCreated: '2023-09-03', lastLogin: '2026-02-15', status: 'Active' },
  { id: 'P009', name: 'Karen Thomas',     email: 'kthomas@email.com',          phone: '(555) 100-0009', initials: 'KT', avatarColor: '#F472B6', pets: ['Buddy'],              clinic: 'Westside Animal Care',   accountCreated: '2023-03-20', lastLogin: '2026-01-30', status: 'Active' },
  { id: 'P010', name: 'Lisa Martinez',    email: 'lmartinez@email.com',        phone: '(555) 100-0010', initials: 'LM', avatarColor: '#A78BFA', pets: ['Simba', 'Nala'],      clinic: 'Downtown Hugory Vet',    accountCreated: '2022-12-01', lastLogin: '2026-01-18', status: 'Active' },
  { id: 'P011', name: 'Amanda White',     email: 'awhite@email.com',           phone: '(555) 100-0011', initials: 'AW', avatarColor: '#34D399', pets: ['Coco'],               clinic: 'Northpark Pet Hospital', accountCreated: '2023-05-11', lastLogin: '2026-01-05', status: 'Active' },
  { id: 'P012', name: 'Chris Davis',      email: 'cdavis@email.com',           phone: '(555) 100-0012', initials: 'CD', avatarColor: '#FB923C', pets: ['Zeus'],               clinic: 'Westside Animal Care',   accountCreated: '2022-10-28', lastLogin: '2025-12-22', status: 'Active' },
  { id: 'P013', name: 'Patricia Garcia',  email: 'pgarcia@email.com',          phone: '(555) 100-0013', initials: 'PG', avatarColor: '#C084FC', pets: ['Lola', 'Pepper'],     clinic: 'Downtown Hugory Vet',    accountCreated: '2023-07-07', lastLogin: '2025-12-10', status: 'Active' },
  { id: 'P014', name: 'Thomas Lee',       email: 'tlee@email.com',             phone: '(555) 100-0014', initials: 'TL', avatarColor: '#2DD4BF', pets: ['Shadow'],             clinic: 'Northpark Pet Hospital', accountCreated: '2023-08-19', lastLogin: '2025-11-28', status: 'Active' },
  { id: 'P015', name: 'Sandra Robinson',  email: 'srobinson@email.com',        phone: '(555) 100-0015', initials: 'SR', avatarColor: '#F97316', pets: ['Princess'],           clinic: 'Westside Animal Care',   accountCreated: '2022-06-30', lastLogin: '2025-10-15', status: 'Active' },

  // Inactive — last login > 1 year ago (before 2025-03-15)
  { id: 'P016', name: 'Margaret Hall',    email: 'mhall@email.com',            phone: '(555) 200-0001', initials: 'MH', avatarColor: '#9CA3AF', pets: ['Ginger'],             clinic: 'Downtown Hugory Vet',    accountCreated: '2022-04-05', lastLogin: '2025-03-01', status: 'Inactive' },
  { id: 'P017', name: 'George Harris',    email: 'gharris@email.com',          phone: '(555) 200-0002', initials: 'GH', avatarColor: '#6B7280', pets: ['Bruno', 'Fluffy'],    clinic: 'Westside Animal Care',   accountCreated: '2021-11-20', lastLogin: '2025-02-14', status: 'Inactive' },
  { id: 'P018', name: 'Dorothy Clark',    email: 'dclark@email.com',           phone: '(555) 200-0003', initials: 'DC', avatarColor: '#9CA3AF', pets: ['Whiskers'],           clinic: 'Northpark Pet Hospital', accountCreated: '2022-01-08', lastLogin: '2025-01-30', status: 'Inactive' },
  { id: 'P019', name: 'Edward Lewis',     email: 'elewis@email.com',           phone: '(555) 200-0004', initials: 'EL', avatarColor: '#6B7280', pets: ['Oreo'],               clinic: 'Downtown Hugory Vet',    accountCreated: '2021-09-14', lastLogin: '2024-12-05', status: 'Inactive' },
  { id: 'P020', name: 'Helen Walker',     email: 'hwalker@email.com',          phone: '(555) 200-0005', initials: 'HW', avatarColor: '#9CA3AF', pets: ['Snowball'],           clinic: 'Westside Animal Care',   accountCreated: '2022-03-22', lastLogin: '2024-10-18', status: 'Inactive' },
  { id: 'P021', name: 'Charles Young',    email: 'cyoung@email.com',           phone: '(555) 200-0006', initials: 'CY', avatarColor: '#6B7280', pets: ['Biscuit', 'Caramel'], clinic: 'Northpark Pet Hospital', accountCreated: '2021-07-03', lastLogin: '2024-08-22', status: 'Inactive' },
  { id: 'P022', name: 'Ruth King',        email: 'rking@email.com',            phone: '(555) 200-0007', initials: 'RK', avatarColor: '#9CA3AF', pets: ['Tiger'],              clinic: 'Downtown Hugory Vet',    accountCreated: '2022-05-17', lastLogin: '2024-06-10', status: 'Inactive' },

  // Warned — reminder already sent
  { id: 'P023', name: 'Frank Scott',      email: 'fscott@email.com',           phone: '(555) 300-0001', initials: 'FS', avatarColor: '#D97706', pets: ['Nugget'],             clinic: 'Westside Animal Care',   accountCreated: '2021-12-12', lastLogin: '2025-01-10', status: 'Warned', reminderSentAt: '2026-03-10' },
  { id: 'P024', name: 'Betty Green',      email: 'bgreen@email.com',           phone: '(555) 300-0002', initials: 'BG', avatarColor: '#D97706', pets: ['Maple'],              clinic: 'Northpark Pet Hospital', accountCreated: '2022-02-28', lastLogin: '2024-11-20', status: 'Warned', reminderSentAt: '2026-03-08' },

  // Suspended
  { id: 'P025', name: 'Howard Allen',     email: 'hallen@email.com',           phone: '(555) 400-0001', initials: 'HA', avatarColor: '#DC2626', pets: [],                     clinic: 'Downtown Hugory Vet',    accountCreated: '2021-05-19', lastLogin: '2024-03-01', status: 'Suspended' },
];

// ─── Status config ────────────────────────────────────────────
const STATUS_CFG: Record<AccountStatus, { color: string; bg: string; dot: string; label: string }> = {
  Active:    { color: '#16A34A', bg: '#22C55E15', dot: '#22C55E', label: 'Active'    },
  Inactive:  { color: '#6B7280', bg: '#6B728015', dot: '#9CA3AF', label: 'Inactive'  },
  Warned:    { color: '#D97706', bg: '#F59E0B18', dot: '#FBBF24', label: 'Warned'    },
  Suspended: { color: '#DC2626', bg: '#EF444415', dot: '#F87171', label: 'Suspended' },
};

const TABS = ['All', 'Active', 'Inactive', 'Warned', 'Suspended'] as const;
type Tab = typeof TABS[number];

const CLINICS = ['All Clinics', 'Downtown Hugory Vet', 'Westside Animal Care', 'Northpark Pet Hospital'];

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

// ─── Main Page ────────────────────────────────────────────────
export default function SuperAdminPatientPortalsPage() {
  const isDark = useDarkMode();
  const [users, setUsers]             = useState<PortalUser[]>(INITIAL_USERS);
  const [search, setSearch]           = useState('');
  const [tab, setTab]                 = useState<Tab>('All');
  const [clinicFilter, setClinicFilter] = useState('All Clinics');
  const [toast, setToast]             = useState<{ name: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ── Inactive = last login > 1 year ago AND status still Inactive
  const inactiveUsers = useMemo(
    () => users.filter(u => u.status === 'Inactive' && u.lastLogin < ONE_YEAR_AGO),
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
  const handleSendReminder = (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    setUsers(prev => prev.map(u =>
      u.id === id ? { ...u, status: 'Warned', reminderSentAt: '2026-03-15' } : u
    ));
    setToast({ name: user.name });
    setTimeout(() => setToast(null), 5000);
  };

  const handleRemoveAccount = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    setConfirmDeleteId(null);
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
              <SelectContent>{CLINICS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
                      No portal accounts match your filters.
                    </td>
                  </tr>
                )}
                {filtered.map((u, i) => {
                  const isOld = u.lastLogin < ONE_YEAR_AGO;
                  const dAgo  = daysSince(u.lastLogin);
                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: i < filtered.length - 1 ? '1px solid var(--border-color)' : 'none',
                        transition: 'background 0.12s',
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
                      <td style={{ padding: '14px 16px' }}>
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
    </div>
  );
}
