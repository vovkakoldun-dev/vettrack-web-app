import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { uploadAvatar, removeAvatar } from '../../hooks/useProfile';
import {
  User, Building2, Bell, Palette, Shield, CreditCard,
  Camera, Save, Eye, EyeOff, Trash2,
  CheckCircle2, AlertTriangle, Info,
  Monitor, Moon, Sun, Globe, Clock, Calendar,
  MessageSquare, Check, Plug, RefreshCw, ExternalLink,
  Copy, RotateCcw, Webhook, Zap, FlaskConical,
  Users, Settings2, Database, Server, ToggleLeft,
  Crown, Activity, FileText, Download, AlertCircle,
  Plus, Minus, UserPlus, UserMinus,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Switch } from '../../components/ui/switch';
import { Separator } from '../../components/ui/separator';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../../components/ui/select';

// ─── Theme ────────────────────────────────────────────────────
const ACCENT    = '#F4A261';
const ACCENT_D  = '#C2671A';
const ACCENT_BG = '#F4A26112';
const PRICE_PER_SEAT        = 30;
const FREE_CLIENT_TIER      = 1000;   // first 1 000 client profiles are free
const CLIENTS_PER_BLOCK     = 500;    // each additional block of 500 …
const PRICE_PER_CLIENT_BLOCK = 5;     // … costs $5 / month

// ─── Plan card star field (stable, pre-seeded) ────────────────
const PLAN_STARS = [
  { x: 8,  y: 12, s: 1.5, d: 0    }, { x: 18, y: 55, s: 1,   d: 0.6  },
  { x: 28, y: 28, s: 2,   d: 1.2  }, { x: 42, y: 70, s: 1.5, d: 0.3  },
  { x: 55, y: 18, s: 1,   d: 1.8  }, { x: 65, y: 82, s: 2,   d: 0.9  },
  { x: 72, y: 42, s: 1.5, d: 2.4  }, { x: 82, y: 10, s: 1,   d: 0.15 },
  { x: 90, y: 65, s: 2,   d: 1.5  }, { x: 12, y: 88, s: 1,   d: 2.1  },
  { x: 36, y: 50, s: 2.5, d: 0.75 }, { x: 50, y: 35, s: 1,   d: 3.0  },
  { x: 60, y: 58, s: 1.5, d: 0.45 }, { x: 75, y: 25, s: 1,   d: 2.7  },
  { x: 88, y: 88, s: 2,   d: 1.05 }, { x: 22, y: 72, s: 1,   d: 3.3  },
  { x: 48, y: 90, s: 1.5, d: 1.65 }, { x: 93, y: 42, s: 1,   d: 0.9  },
  { x: 5,  y: 45, s: 2,   d: 2.25 }, { x: 33, y: 8,  s: 1,   d: 1.35 },
  { x: 70, y: 72, s: 1.5, d: 2.85 }, { x: 15, y: 30, s: 1,   d: 0.5  },
  { x: 58, y: 5,  s: 2,   d: 3.6  }, { x: 80, y: 50, s: 1,   d: 1.9  },
  { x: 44, y: 15, s: 1.5, d: 2.0  },
] as const;

// ─── Types ────────────────────────────────────────────────────
type Section =
  | 'profile' | 'clinic' | 'roles' | 'notifications'
  | 'appearance' | 'security' | 'billing' | 'integrations' | 'system';

interface NavItem { id: Section; label: string; icon: React.ElementType; badge?: string }

const NAV_ITEMS: NavItem[] = [
  { id: 'billing',       label: 'Billing & Plan',  icon: CreditCard },
  { id: 'profile',       label: 'Profile',        icon: User },
  { id: 'clinic',        label: 'Clinic',          icon: Building2 },
  { id: 'roles',         label: 'Staff & Roles',   icon: Users },
  { id: 'notifications', label: 'Notifications',   icon: Bell },
  { id: 'appearance',    label: 'Appearance',      icon: Palette },
  { id: 'security',      label: 'Security',        icon: Shield },

  { id: 'integrations',  label: 'Integrations',    icon: Plug },
  { id: 'system',        label: 'System',          icon: Settings2 },
];

// ─── Staff data ───────────────────────────────────────────────
const INITIAL_STAFF = [
  { id: 1,  name: 'Dr. Sarah Chen',     role: 'Veterinarian',   email: 'sarah.chen@hugory.com',    initials: 'SC', color: '#818CF8', active: true  },
  { id: 2,  name: 'Dr. Raj Patel',      role: 'Veterinarian',   email: 'raj.patel@hugory.com',     initials: 'RP', color: '#38BDF8', active: true  },
  { id: 3,  name: 'Dr. Luis Garcia',    role: 'Veterinarian',   email: 'luis.garcia@hugory.com',   initials: 'LG', color: '#F4A261', active: true  },
  { id: 4,  name: 'Emma Thompson',      role: 'Front Desk',     email: 'emma.t@hugory.com',        initials: 'ET', color: '#4ADE80', active: true  },
  { id: 5,  name: 'James Wilson',       role: 'Front Desk',     email: 'james.w@hugory.com',       initials: 'JW', color: '#F472B6', active: true  },
  { id: 6,  name: 'Linda Rodriguez',    role: 'Vet Technician', email: 'linda.r@hugory.com',       initials: 'LR', color: '#A78BFA', active: true  },
  { id: 7,  name: 'Marcus Lee',         role: 'Vet Technician', email: 'marcus.l@hugory.com',      initials: 'ML', color: '#06B6D4', active: true  },
];

const ROLES = [
  { name: 'Administrator',    color: ACCENT,    bg: ACCENT_BG,    perms: ['Full clinic access', 'Manage staff', 'Billing access', 'Settings', 'Audit logs'] },
  { name: 'Veterinarian',     color: '#2D6A4F', bg: '#2D6A4F12',  perms: ['Records', 'Prescriptions', 'Lab orders', 'Own schedule', 'Client comms'] },
  { name: 'Vet Technician',   color: '#8B5CF6', bg: '#8B5CF615',  perms: ['View records', 'Vitals entry', 'Lab prep', 'Med admin', 'Schedule view'] },
  { name: 'Front Desk',       color: '#06B6D4', bg: '#06B6D415',  perms: ['Appointments', 'Check-in/out', 'Invoicing', 'Client portal', 'Basic reports'] },
  { name: 'Read-Only',        color: '#6B7280', bg: '#6B728015',  perms: ['View records only', 'View schedule', 'View reports'] },
];

const ALL_INTEGRATIONS = [
  { id: 'idexx',      name: 'IDEXX Laboratories',  description: 'Import CBC, chemistry, urinalysis results into patient records.', category: 'Lab Services',    status: 'connected' as const, lastSync: '2 min ago',  iconBg: '#EF444415', iconText: 'IDEXX', iconColor: '#EF4444' },
  { id: 'antech',     name: 'Antech Diagnostics',  description: 'Sync diagnostic lab results automatically.', category: 'Lab Services',    status: 'error'     as const, lastSync: '3 days ago', iconBg: '#3B82F615', iconText: 'ATC',  iconColor: '#3B82F6' },
  { id: 'stripe',     name: 'Stripe',              description: 'Accept card payments, recurring billing, and manage invoices.', category: 'Payments',        status: 'connected' as const, lastSync: '5 min ago',  iconBg: '#6366F115', iconText: 'STR',  iconColor: '#6366F1' },
  { id: 'quickbooks', name: 'QuickBooks Online',   description: 'Sync invoices, payments, and records with your accounting software.', category: 'Payments',  status: 'available' as const,                        iconBg: '#22C55E15', iconText: 'QB',   iconColor: '#22C55E' },
  { id: 'twilio',     name: 'Twilio SMS',          description: 'Send appointment reminders, vaccination alerts via SMS.', category: 'Communications', status: 'connected' as const, lastSync: '1 hour ago', iconBg: '#F4A26115', iconText: 'TW',   iconColor: '#F4A261' },
  { id: 'sendgrid',   name: 'SendGrid',            description: 'Transactional email for invoices, records, and communications.', category: 'Communications', status: 'connected' as const, lastSync: '30 min ago', iconBg: '#06B6D415', iconText: 'SG',  iconColor: '#06B6D4' },
  { id: 'gcal',       name: 'Google Calendar',     description: 'Two-way sync of appointments to clinic Google Calendar.', category: 'Calendar',        status: 'connected' as const, lastSync: '10 min ago', iconBg: '#3B82F615', iconText: 'GCal', iconColor: '#3B82F6' },
  { id: 'gdrive',     name: 'Google Drive',        description: 'Export records, X-rays, and reports to a linked Drive folder.', category: 'Storage',        status: 'available' as const,                        iconBg: '#22C55E15', iconText: 'GD',   iconColor: '#22C55E' },
];

type IntStatus = 'connected' | 'error' | 'available';

// ─── Shared components ────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6" style={{ borderRadius: '12px' }}>
      {children}
    </div>
  );
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[200px_1fr] gap-6 items-start py-5 border-b border-[var(--border-color)] last:border-0">
      <div>
        <p className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>{label}</p>
        {hint && <p className="text-[var(--text-secondary)] mt-0.5" style={{ fontSize: '12px' }}>{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-[var(--border-color)] last:border-0">
      <div className="pr-6">
        <p className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>{label}</p>
        <p className="text-[var(--text-secondary)] mt-0.5" style={{ fontSize: '13px' }}>{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SaveBar({ onSave, saved }: { onSave: () => void; saved: boolean }) {
  return (
    <div className="flex items-center justify-end gap-3 pt-4">
      {saved && (
        <span className="flex items-center gap-1.5" style={{ fontSize: '14px', color: ACCENT_D }}>
          <CheckCircle2 className="w-4 h-4" /> Saved
        </span>
      )}
      <Button variant="outline" size="sm">Discard</Button>
      <Button size="sm" onClick={onSave} style={{ backgroundColor: ACCENT, borderColor: ACCENT }}>
        <Save className="w-4 h-4" /> Save changes
      </Button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

export default function SuperAdminSettingsPage() {
  const [active, setActive] = useState<Section>('profile');
  const [savedSection, setSavedSection] = useState<Section | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState('');

  const save = (s: Section) => { setSavedSection(s); setTimeout(() => setSavedSection(null), 3000); };
  const saved = (s: Section) => savedSection === s;

  const saveSecurity = async () => {
    if (!currentPw || !newPw || newPw !== confirmPw || newPw.length < 12) return;
    setSaving(true);
    setPwError(null);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser?.email) { setSaving(false); setPwError('Unable to verify user.'); return; }
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: authUser.email, password: currentPw });
    if (signInErr) { setSaving(false); setPwError('Current password is incorrect.'); return; }
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPw });
    setSaving(false);
    if (updateErr) { setPwError(updateErr.message); return; }
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    save('security');
  };

  // Profile
  const [profileId, setProfileId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [phone,     setPhone]     = useState('');
  const [profileRole, setProfileRole] = useState('');

  // Load the superadmin profile from Supabase (by role, not auth user)
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone, role, avatar_url')
        .eq('role', 'superadmin')
        .single();
      if (data) {
        setProfileId(data.id);
        setFirstName(data.first_name || '');
        setLastName(data.last_name || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
        setProfileRole(data.role || '');
        setAvatarUrl(data.avatar_url || '');
      }
      setProfileLoading(false);
    })();
  }, []);

  // Save profile to Supabase
  async function saveProfile() {
    if (!profileId) return;
    await supabase
      .from('profiles')
      .update({ first_name: firstName, last_name: lastName, email, phone })
      .eq('id', profileId);
    save('profile');
  }

  // Clinic
  const [clinicName,    setClinicName]    = useState('Hugory Animal Hospital');
  const [clinicAddress, setClinicAddress] = useState('1247 Maple Street');
  const [clinicCity,    setClinicCity]    = useState('Austin');
  const [clinicState,   setClinicState]   = useState('TX');
  const [clinicZip,     setClinicZip]     = useState('78701');
  const [clinicPhone,   setClinicPhone]   = useState('(512) 555-0192');
  const [clinicEmail,   setClinicEmail]   = useState('info@hugory.com');
  const [clinicWebsite, setClinicWebsite] = useState('www.hugory.com');
  const [clinicTax,     setClinicTax]     = useState('47-2891034');
  const [timezone,      setTimezone]      = useState('America/Chicago');
  const [hours, setHours] = useState([
    { day: 'Monday',    open: true,  from: '08:00', to: '18:00' },
    { day: 'Tuesday',   open: true,  from: '08:00', to: '18:00' },
    { day: 'Wednesday', open: true,  from: '08:00', to: '18:00' },
    { day: 'Thursday',  open: true,  from: '08:00', to: '18:00' },
    { day: 'Friday',    open: true,  from: '08:00', to: '17:00' },
    { day: 'Saturday',  open: true,  from: '09:00', to: '13:00' },
    { day: 'Sunday',    open: false, from: '09:00', to: '13:00' },
  ]);

  // Notifications
  const [notifs, setNotifs] = useState({
    apptNew:       { email: true,  sms: true,  inApp: true  },
    apptCancel:    { email: true,  sms: false, inApp: true  },
    apptReminder:  { email: true,  sms: true,  inApp: true  },
    labReady:      { email: true,  sms: false, inApp: true  },
    labCritical:   { email: true,  sms: true,  inApp: true  },
    paymentRecv:   { email: true,  sms: false, inApp: true  },
    invoiceOverdue:{ email: true,  sms: false, inApp: true  },
    securityAlert: { email: true,  sms: true,  inApp: true  },
  });
  const toggleNotif = (k: keyof typeof notifs, ch: 'email'|'sms'|'inApp') =>
    setNotifs(p => ({ ...p, [k]: { ...p[k], [ch]: !p[k][ch] } }));

  // Appearance
  const [themeMode,         setThemeMode]         = useState<'light'|'dark'|'system'>('light');
  const [dateFormat,        setDateFormat]         = useState('MM/DD/YYYY');
  const [timeFormat,        setTimeFormat]         = useState('12h');
  const [language,          setLanguage]           = useState('en-US');
  const [compactMode,       setCompactMode]        = useState(false);
  const [animationsEnabled, setAnimationsEnabled]  = useState(true);

  // Security
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw,     setShowNewPw]     = useState(false);
  const [currentPw,     setCurrentPw]     = useState('');
  const [newPw,         setNewPw]         = useState('');
  const [confirmPw,     setConfirmPw]     = useState('');
  const [pwError,       setPwError]       = useState<string | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [twoFaEnabled,  setTwoFaEnabled]  = useState(true);
  const [sessionTimeout,setSessionTimeout]= useState('8h');
  const [auditEnabled,  setAuditEnabled]  = useState(true);

  // Billing — per-seat model
  const [staff, setStaff] = useState(INITIAL_STAFF);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole,  setInviteRole]  = useState('Veterinarian');
  // Client profiles tier
  const [clientCount, setClientCount] = useState(1247);
  const activeSeats = staff.filter(s => s.active).length;
  const monthlyTotal = activeSeats * PRICE_PER_SEAT;
  // Client profile tier cost
  const paidClientBlocks  = Math.max(0, Math.ceil((clientCount - FREE_CLIENT_TIER) / CLIENTS_PER_BLOCK));
  const clientProfileCost = paidClientBlocks * PRICE_PER_CLIENT_BLOCK;
  const grandTotal        = monthlyTotal + clientProfileCost;

  const removeStaff = (id: number) =>
    setStaff(prev => prev.map(s => s.id === id ? { ...s, active: false } : s));
  const restoreStaff = (id: number) =>
    setStaff(prev => prev.map(s => s.id === id ? { ...s, active: true } : s));
  const inviteStaff = () => {
    if (!inviteEmail.trim()) return;
    const parts = inviteEmail.split('@')[0].split('.');
    const initials = parts.map((p: string) => p[0]?.toUpperCase() ?? '').join('').slice(0, 2);
    const colors = ['#818CF8','#38BDF8','#4ADE80','#F472B6','#A78BFA','#06B6D4'];
    setStaff(prev => [...prev, {
      id: Date.now(),
      name: inviteEmail,
      role: inviteRole,
      email: inviteEmail,
      initials,
      color: colors[prev.length % colors.length],
      active: true,
    }]);
    setInviteEmail('');
  };

  // Integrations
  const [intStatuses, setIntStatuses] = useState<Record<string, IntStatus>>(
    () => Object.fromEntries(ALL_INTEGRATIONS.map(i => [i.id, i.status]))
  );
  const [apiKeyCopied,  setApiKeyCopied]  = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [showSecret,    setShowSecret]    = useState(false);
  const copyText = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setter(true); setTimeout(() => setter(false), 2000);
  };

  // System
  const [maintenanceMode,  setMaintenanceMode]  = useState(false);
  const [retentionYears,   setRetentionYears]   = useState('7');
  const [backupFreq,       setBackupFreq]        = useState('daily');
  const [featureFlags, setFeatureFlags] = useState({
    newBookingFlow:  true,
    aiDiagnosis:     false,
    clientVideoCall: false,
    advancedReports: true,
  });

  return (
    <div className="max-w-[1440px] mx-auto p-8">
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <Crown style={{ width: '20px', height: '20px', color: ACCENT }} />
          <h1 className="text-[var(--text-primary)]">Settings</h1>
        </div>
        <p className="text-[var(--text-secondary)]" style={{ fontSize: '16px' }}>
          Manage your account, clinic details, staff, and subscription.
        </p>
      </div>

      <div className="flex gap-8 items-start">

        {/* Left nav */}
        <aside className="w-56 flex-shrink-0 sticky top-8">
          <nav className="bg-[var(--surface-white)] border border-[var(--border-color)] p-2" style={{ borderRadius: '12px' }}>
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = active === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 mb-0.5 last:mb-0 transition-colors"
                  style={{
                    borderRadius: '8px', textAlign: 'left',
                    backgroundColor: isActive ? ACCENT_BG : 'transparent',
                    color: isActive ? ACCENT_D : 'var(--text-secondary)',
                  }}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" style={{ color: isActive ? ACCENT : undefined }} />
                  <span style={{ fontSize: '14px', fontWeight: isActive ? 600 : 400, flex: 1 }}>{item.label}</span>
                  {item.badge && (
                    <span style={{
                      backgroundColor: '#d4183d', color: '#fff', borderRadius: '9999px',
                      fontSize: '11px', fontWeight: 700, minWidth: '18px', height: '18px',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
                    }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Right content */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* ═══════════════════════════════════════════ PROFILE */}
          {active === 'profile' && (
            profileLoading ? (
              <SectionCard>
                <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Loading profile...</p>
              </SectionCard>
            ) : (
            <>
              <SectionCard>
                <h3 className="text-[var(--text-primary)] mb-1">Profile photo</h3>
                <p className="text-[var(--text-secondary)] mb-5" style={{ fontSize: '14px' }}>
                  Shown on records, audit logs, and staff views.
                </p>
                <div className="flex items-center gap-5">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={`${firstName} ${lastName}`} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{
                      width: 80, height: 80, borderRadius: '50%',
                      background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_D})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '24px', fontWeight: 800, color: '#fff', flexShrink: 0,
                    }}>{(firstName[0] || '').toUpperCase()}{(lastName[0] || '').toUpperCase()}</div>
                  )}
                  <div className="space-y-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = async (ev: any) => {
                        const file = ev.target.files?.[0];
                        if (!file || !profileId) return;
                        try {
                          const publicUrl = await uploadAvatar(profileId, file, 'admin');
                          setAvatarUrl(publicUrl);
                        } catch (err: any) {
                          alert(err.message);
                        }
                      };
                      input.click();
                    }}>
                      <Camera className="w-4 h-4" /> Upload photo
                    </Button>
                    {avatarUrl && (
                      <Button variant="ghost" size="sm" className="text-[#d4183d] hover:text-[#d4183d]" onClick={async () => {
                        if (!profileId || !confirm('Remove profile photo?')) return;
                        try {
                          await removeAvatar(profileId, 'admin');
                          setAvatarUrl('');
                        } catch (err: any) {
                          console.error('Delete error:', err);
                        }
                      }}>
                        <Trash2 className="w-4 h-4" /> Remove
                      </Button>
                    )}
                  </div>
                  <p className="ml-auto text-right text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>
                    JPG, GIF or PNG · Max 2 MB<br />Recommended: 400×400 px
                  </p>
                </div>
              </SectionCard>

              <SectionCard>
                <div className="flex items-center gap-2 mb-1">
                  <Crown style={{ width: 16, height: 16, color: ACCENT }} />
                  <h3 className="text-[var(--text-primary)]">Personal information</h3>
                </div>
                <Separator className="mb-2 mt-2" />
                <FieldRow label="Full name">
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" />
                    <Input value={lastName}  onChange={e => setLastName(e.target.value)}  placeholder="Last name" />
                  </div>
                </FieldRow>
                <FieldRow label="Email address" hint="Used for login and alerts">
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
                </FieldRow>
                <FieldRow label="Phone number" hint="Used for 2FA and critical alerts">
                  <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
                </FieldRow>
                <FieldRow label="Role" hint="System-assigned">
                  <span style={{ padding: '4px 12px', borderRadius: '9999px', backgroundColor: ACCENT_BG, color: ACCENT_D, fontSize: '13px', fontWeight: 700 }}>
                    {profileRole === 'superadmin' ? 'Super Administrator' : profileRole === 'clinic_manager' ? 'Clinic Manager' : profileRole === 'veterinarian' ? 'Veterinarian' : profileRole || 'Staff'}
                  </span>
                </FieldRow>
                <SaveBar onSave={saveProfile} saved={saved('profile')} />
              </SectionCard>
            </>
            )
          )}

          {/* ════════════════════════════════════════════ CLINIC */}
          {active === 'clinic' && (
            <>
              <SectionCard>
                <h3 className="text-[var(--text-primary)] mb-1">Clinic branding</h3>
                <p className="text-[var(--text-secondary)] mb-5" style={{ fontSize: '14px' }}>
                  Your logo appears on invoices, records, and the client portal.
                </p>
                <div className="flex items-center gap-5">
                  <div style={{ width: 80, height: 80, borderRadius: '12px', background: `${ACCENT_BG}`, border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Building2 className="w-8 h-8" style={{ color: ACCENT }} />
                  </div>
                  <div className="space-y-2">
                    <Button variant="outline" size="sm"><Camera className="w-4 h-4" /> Upload logo</Button>
                    <Button variant="ghost" size="sm" className="text-[#d4183d] hover:text-[#d4183d]"><Trash2 className="w-4 h-4" /> Remove</Button>
                  </div>
                  <p className="ml-auto text-right text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>PNG or SVG recommended<br />Min 200×200 px · Max 2 MB</p>
                </div>
              </SectionCard>

              <SectionCard>
                <h3 className="text-[var(--text-primary)] mb-1">Clinic details</h3>
                <p className="text-[var(--text-secondary)] mb-2" style={{ fontSize: '14px' }}>Used on patient records, invoices, and your public profile.</p>
                <Separator className="mb-2" />
                <FieldRow label="Clinic name">
                  <Input value={clinicName} onChange={e => setClinicName(e.target.value)} />
                </FieldRow>
                <FieldRow label="Street address">
                  <Input value={clinicAddress} onChange={e => setClinicAddress(e.target.value)} />
                </FieldRow>
                <FieldRow label="City / State / ZIP">
                  <div className="grid grid-cols-[1fr_80px_100px] gap-3">
                    <Input value={clinicCity}  onChange={e => setClinicCity(e.target.value)}  placeholder="City" />
                    <Input value={clinicState} onChange={e => setClinicState(e.target.value)} placeholder="State" />
                    <Input value={clinicZip}   onChange={e => setClinicZip(e.target.value)}   placeholder="ZIP" />
                  </div>
                </FieldRow>
                <FieldRow label="Phone">
                  <Input type="tel" value={clinicPhone} onChange={e => setClinicPhone(e.target.value)} />
                </FieldRow>
                <FieldRow label="Email">
                  <Input type="email" value={clinicEmail} onChange={e => setClinicEmail(e.target.value)} />
                </FieldRow>
                <FieldRow label="Website">
                  <Input value={clinicWebsite} onChange={e => setClinicWebsite(e.target.value)} />
                </FieldRow>
                <FieldRow label="Tax ID / EIN" hint="Used on invoices">
                  <Input value={clinicTax} onChange={e => setClinicTax(e.target.value)} />
                </FieldRow>
                <FieldRow label="Timezone">
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                      <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
                <SaveBar onSave={() => save('clinic')} saved={saved('clinic')} />
              </SectionCard>

              {/* Business hours */}
              <SectionCard>
                <h3 className="text-[var(--text-primary)] mb-1">Business hours</h3>
                <p className="text-[var(--text-secondary)] mb-5" style={{ fontSize: '14px' }}>
                  Clients will only see available booking slots within these times.
                </p>
                <div className="space-y-1">
                  <div className="grid grid-cols-[140px_48px_1fr] gap-4 pb-2 border-b border-[var(--border-color)]">
                    {['DAY', 'OPEN', 'HOURS'].map(h => (
                      <span key={h} className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600 }}>{h}</span>
                    ))}
                  </div>
                  {hours.map((h, idx) => (
                    <div key={h.day} className="grid grid-cols-[140px_48px_1fr] gap-4 items-center py-3 border-b border-[var(--border-color)] last:border-0">
                      <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: h.open ? 600 : 400 }}>{h.day}</span>
                      <Switch checked={h.open} onCheckedChange={v => setHours(p => p.map((x, i) => i === idx ? { ...x, open: v } : x))} />
                      {h.open ? (
                        <div className="flex items-center gap-2">
                          <Input type="time" value={h.from} onChange={e => setHours(p => p.map((x, i) => i === idx ? { ...x, from: e.target.value } : x))} className="w-32" />
                          <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>to</span>
                          <Input type="time" value={h.to} onChange={e => setHours(p => p.map((x, i) => i === idx ? { ...x, to: e.target.value } : x))} className="w-32" />
                        </div>
                      ) : (
                        <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Closed</span>
                      )}
                    </div>
                  ))}
                </div>
                <SaveBar onSave={() => save('clinic')} saved={saved('clinic')} />
              </SectionCard>
            </>
          )}

          {/* ══════════════════════════════════════ STAFF & ROLES */}
          {active === 'roles' && (
            <>
              <SectionCard>
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-[#3B82F6] flex-shrink-0 mt-0.5" />
                  <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>
                    Role permissions control what each staff member can see and do. Changes take effect on next login.
                    Adding or removing staff also updates your billing — each active member is ${PRICE_PER_SEAT}/month.
                  </p>
                </div>
              </SectionCard>

              {ROLES.map(role => (
                <SectionCard key={role.name}>
                  <div className="flex items-start justify-between gap-4">
                    <div style={{ flex: 1 }}>
                      <div className="flex items-center gap-3 mb-3">
                        <span style={{ padding: '3px 12px', borderRadius: '9999px', fontSize: '13px', fontWeight: 700, backgroundColor: role.bg, color: role.color }}>
                          {role.name}
                        </span>
                        <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>
                          {staff.filter(s => s.active && s.role.replace(' ', '') === role.name.replace(' ', '')).length} members
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {role.perms.map(p => (
                          <span key={p} className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--surface-elevated)] border border-[var(--border-color)]" style={{ borderRadius: '8px', fontSize: '12px', color: 'var(--text-primary)' }}>
                            <Check style={{ width: 11, height: 11, color: role.color }} />{p}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" variant="outline">Edit permissions</Button>
                    </div>
                  </div>
                </SectionCard>
              ))}

              <SectionCard>
                <h3 className="text-[var(--text-primary)] mb-1">Access policies</h3>
                <Separator className="mb-2 mt-2" />
                <ToggleRow label="Require 2FA for all staff" description="All staff must enable two-factor authentication to access the system" checked={true} onChange={() => {}} />
                <ToggleRow label="Allow client record export" description="Staff can download patient records as PDFs directly from the record view" checked={true} onChange={() => {}} />
                <ToggleRow label="Front desk billing access" description="Front desk can view (but not edit) payment and invoice data" checked={true} onChange={() => {}} />
                <SaveBar onSave={() => save('roles')} saved={saved('roles')} />
              </SectionCard>
            </>
          )}

          {/* ════════════════════════════════════ NOTIFICATIONS */}
          {active === 'notifications' && (
            <>
              <SectionCard>
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-[#3B82F6] flex-shrink-0 mt-0.5" />
                  <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>
                    Choose how you receive notifications. SMS may incur carrier charges. In-app notifications appear in the bell icon.
                  </p>
                </div>
              </SectionCard>

              {([
                { title: 'Appointments', rows: [
                  { key: 'apptNew'       as const, label: 'New booking',       desc: 'When a client books a new appointment' },
                  { key: 'apptCancel'    as const, label: 'Cancellation',       desc: 'When a client cancels their appointment' },
                  { key: 'apptReminder'  as const, label: 'Reminder (1 hour)', desc: 'Reminder 1 hour before each appointment' },
                ]},
                { title: 'Lab Results', rows: [
                  { key: 'labReady'      as const, label: 'Result ready',      desc: 'When lab results are available for review' },
                  { key: 'labCritical'   as const, label: 'Critical value',    desc: 'Immediate alert for out-of-range critical values' },
                ]},
                { title: 'Billing', rows: [
                  { key: 'paymentRecv'   as const, label: 'Payment received',  desc: 'When a client completes a payment' },
                  { key: 'invoiceOverdue'as const, label: 'Invoice overdue',   desc: 'Invoices unpaid for more than 30 days' },
                ]},
                { title: 'Security', rows: [
                  { key: 'securityAlert' as const, label: 'Security alert',    desc: 'Failed logins or suspicious activity' },
                ]},
              ] as Array<{ title: string; rows: Array<{ key: keyof typeof notifs; label: string; desc: string }> }>).map(group => (
                <SectionCard key={group.title}>
                  <h3 className="text-[var(--text-primary)] mb-1">{group.title}</h3>
                  <Separator className="mb-4" />
                  <div className="grid grid-cols-[1fr_80px_80px_80px] gap-4 pb-2 border-b border-[var(--border-color)]">
                    <span />
                    {['Email','SMS','In-app'].map(ch => (
                      <span key={ch} className="text-center text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600 }}>{ch}</span>
                    ))}
                  </div>
                  {group.rows.map(({ key, label, desc }) => (
                    <div key={key} className="grid grid-cols-[1fr_80px_80px_80px] gap-4 items-center py-3.5 border-b border-[var(--border-color)] last:border-0">
                      <div>
                        <p className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>{label}</p>
                        <p className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>{desc}</p>
                      </div>
                      {(['email','sms','inApp'] as const).map(ch => (
                        <div key={ch} className="flex justify-center">
                          <Switch checked={notifs[key][ch]} onCheckedChange={() => toggleNotif(key, ch)} />
                        </div>
                      ))}
                    </div>
                  ))}
                </SectionCard>
              ))}

              <div className="flex justify-end">
                <Button onClick={() => save('notifications')} style={{ backgroundColor: ACCENT, borderColor: ACCENT }}>
                  <Save className="w-4 h-4" /> Save preferences
                </Button>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════ APPEARANCE */}
          {active === 'appearance' && (
            <>
              <SectionCard>
                <h3 className="text-[var(--text-primary)] mb-1">Theme</h3>
                <p className="text-[var(--text-secondary)] mb-5" style={{ fontSize: '14px' }}>Choose light, dark, or follow your system preference.</p>
                <div className="grid grid-cols-3 gap-4">
                  {([
                    { value: 'light',  label: 'Light',  Icon: Sun,     preview: '#FFFFFF' },
                    { value: 'dark',   label: 'Dark',   Icon: Moon,    preview: '#0F172A' },
                    { value: 'system', label: 'System', Icon: Monitor, preview: 'linear-gradient(135deg, #FFFFFF 50%, #0F172A 50%)' },
                  ] as const).map(({ value, label, Icon, preview }) => {
                    const sel = themeMode === value;
                    return (
                      <button key={value} onClick={() => setThemeMode(value)} className="p-4 border transition-all text-left" style={{ borderRadius: '10px', borderColor: sel ? ACCENT : 'var(--border-color)', backgroundColor: sel ? ACCENT_BG : 'var(--surface-elevated)' }}>
                        <div className="w-full h-16 mb-3 border border-[var(--border-color)]" style={{ borderRadius: '8px', background: preview }} />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" style={{ color: sel ? ACCENT : 'var(--text-secondary)' }} />
                            <span style={{ fontSize: '14px', fontWeight: 600, color: sel ? ACCENT_D : 'var(--text-primary)' }}>{label}</span>
                          </div>
                          {sel && <Check className="w-4 h-4" style={{ color: ACCENT }} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </SectionCard>

              <SectionCard>
                <h3 className="text-[var(--text-primary)] mb-1">Regional & format</h3>
                <Separator className="mb-2 mt-2" />
                <FieldRow label="Language">
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger><Globe className="w-4 h-4 mr-2 text-[var(--text-secondary)]" /><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en-US">English (United States)</SelectItem>
                      <SelectItem value="en-GB">English (United Kingdom)</SelectItem>
                      <SelectItem value="es-ES">Español</SelectItem>
                      <SelectItem value="fr-FR">Français</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
                <FieldRow label="Date format">
                  <Select value={dateFormat} onValueChange={setDateFormat}>
                    <SelectTrigger><Calendar className="w-4 h-4 mr-2 text-[var(--text-secondary)]" /><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
                <FieldRow label="Time format">
                  <Select value={timeFormat} onValueChange={setTimeFormat}>
                    <SelectTrigger><Clock className="w-4 h-4 mr-2 text-[var(--text-secondary)]" /><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12h">12-hour (2:30 PM)</SelectItem>
                      <SelectItem value="24h">24-hour (14:30)</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
                <SaveBar onSave={() => save('appearance')} saved={saved('appearance')} />
              </SectionCard>

              <SectionCard>
                <h3 className="text-[var(--text-primary)] mb-1">Display</h3>
                <Separator className="mb-2 mt-2" />
                <ToggleRow label="Compact mode" description="Reduce spacing in tables and lists to show more data" checked={compactMode} onChange={setCompactMode} />
                <ToggleRow label="Animations" description="Motion and transitions throughout the interface" checked={animationsEnabled} onChange={setAnimationsEnabled} />
              </SectionCard>
            </>
          )}

          {/* ════════════════════════════════════════ SECURITY */}
          {active === 'security' && (
            <>
              <SectionCard>
                <h3 className="text-[var(--text-primary)] mb-1">Change password</h3>
                <Separator className="mb-4 mt-2" />
                <FieldRow label="Current password">
                  <div className="flex gap-2">
                    <Input type={showCurrentPw ? 'text' : 'password'} value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Current password" />
                    <Button variant="outline" size="sm" onClick={() => setShowCurrentPw(!showCurrentPw)}>
                      {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </FieldRow>
                <FieldRow label="New password" hint="Minimum 12 characters">
                  <div className="flex gap-2">
                    <Input type={showNewPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="New password" />
                    <Button variant="outline" size="sm" onClick={() => setShowNewPw(!showNewPw)}>
                      {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  {newPw.length > 0 && (
                    <div className="flex gap-1.5 mt-2 items-center">
                      {[4, 8, 12].map(n => (
                        <div key={n} className="h-1 flex-1 rounded-full" style={{ backgroundColor: newPw.length >= n ? (newPw.length >= 12 ? '#22C55E' : ACCENT) : 'var(--border-color)' }} />
                      ))}
                      <span className="text-[var(--text-secondary)] ml-2" style={{ fontSize: '12px' }}>
                        {newPw.length < 4 ? 'Too short' : newPw.length < 8 ? 'Weak' : newPw.length < 12 ? 'Good' : 'Strong'}
                      </span>
                    </div>
                  )}
                </FieldRow>
                <FieldRow label="Confirm password">
                  <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Confirm new password"
                    style={{ borderColor: confirmPw.length > 0 && confirmPw !== newPw ? '#EF4444' : undefined }} />
                  {confirmPw.length > 0 && confirmPw !== newPw && (
                    <p style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px' }}>Passwords do not match</p>
                  )}
                </FieldRow>
                <div className="pt-4 flex justify-end flex-col items-end">
                  {pwError && <p className="text-[#d4183d] mt-2 mb-2" style={{ fontSize: '13px' }}>{pwError}</p>}
                  <Button
                    disabled={!currentPw || !newPw || newPw !== confirmPw || newPw.length < 12 || saving}
                    onClick={saveSecurity}
                    style={{ backgroundColor: ACCENT, borderColor: ACCENT }}
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Updating…' : 'Update password'}
                  </Button>
                </div>
              </SectionCard>

              <SectionCard>
                <h3 className="text-[var(--text-primary)] mb-1">Authentication</h3>
                <Separator className="mb-2 mt-2" />
                <ToggleRow label="Two-factor authentication (2FA)" description="Adds a second verification step on every login" checked={twoFaEnabled} onChange={setTwoFaEnabled} />
                <ToggleRow label="Full audit logging" description="Log all admin actions — record access, config changes, staff edits" checked={auditEnabled} onChange={setAuditEnabled} />
                <FieldRow label="Session timeout" hint="Auto-logout after inactivity">
                  <Select value={sessionTimeout} onValueChange={setSessionTimeout}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1h">1 hour</SelectItem>
                      <SelectItem value="2h">2 hours</SelectItem>
                      <SelectItem value="4h">4 hours</SelectItem>
                      <SelectItem value="8h">8 hours (recommended)</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
                <SaveBar onSave={() => save('security')} saved={saved('security')} />
              </SectionCard>

              {/* Audit log */}
              <SectionCard>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4" style={{ color: ACCENT }} />
                    <h3 className="text-[var(--text-primary)]">Recent audit log</h3>
                  </div>
                  <Button size="sm" variant="outline"><Download className="w-3.5 h-3.5" /> Export</Button>
                </div>
                <Separator className="mb-4 mt-2" />
                {[
                  { time: 'Today 09:14 AM', action: 'Signed in',                   meta: 'MacBook Pro · Austin, TX',     icon: CheckCircle2, color: '#22C55E' },
                  { time: 'Today 09:16 AM', action: 'Updated role permissions',    meta: 'Front Desk → billing access',  icon: Users,        color: ACCENT   },
                  { time: 'Today 08:50 AM', action: 'Approved PTO request',        meta: 'Emma Thompson · Mar 18–22',    icon: CheckCircle2, color: '#3B82F6' },
                  { time: 'Mar 14 6:30 PM', action: 'Failed login blocked',        meta: 'Unknown · New York, NY',       icon: AlertCircle,  color: '#EF4444' },
                  { time: 'Mar 14 2:10 PM', action: 'Exported analytics report',   meta: 'Revenue · Jan–Mar 2026',       icon: FileText,     color: '#8B5CF6' },
                ].map((e, i) => {
                  const Icon = e.icon;
                  return (
                    <div key={i} className="flex items-start gap-3 py-3 border-b border-[var(--border-color)] last:border-0">
                      <div style={{ width: 30, height: 30, borderRadius: '8px', backgroundColor: `${e.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon style={{ width: 14, height: 14, color: e.color }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{e.action}</p>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{e.meta}</p>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flexShrink: 0 }}>{e.time}</span>
                    </div>
                  );
                })}
              </SectionCard>
            </>
          )}

          {/* ═══════════════════════════════════ BILLING & PLAN */}
          {active === 'billing' && (
            <>
              {/* Plan summary card */}
              <div style={{
                position: 'relative',
                background: 'linear-gradient(145deg, #1e1108 0%, #2a1a08 40%, #1a1208 70%, #0e0a04 100%)',
                borderRadius: '20px', padding: '28px 32px',
                border: `1.5px solid ${ACCENT}40`,
                animation: 'plan-card-glow-pulse 4s ease-in-out infinite',
                overflow: 'hidden',
              }}>
                {/* Ambient glow blobs */}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: '20px', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: '-30%', left: '20%', width: '60%', height: '80%', background: `radial-gradient(ellipse, ${ACCENT}18 0%, transparent 65%)`, filter: 'blur(20px)' }} />
                  <div style={{ position: 'absolute', bottom: '-20%', right: '10%', width: '50%', height: '70%', background: 'radial-gradient(ellipse, #C2671A12 0%, transparent 65%)', filter: 'blur(24px)' }} />
                  <div style={{ position: 'absolute', top: '40%', left: '-10%', width: '40%', height: '60%', background: 'radial-gradient(ellipse, #F4A26108 0%, transparent 65%)', filter: 'blur(16px)' }} />
                </div>
                {/* Shimmer top border */}
                <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px', background: `linear-gradient(90deg, transparent, ${ACCENT}80, transparent)`, animation: 'shimmer-border 3s ease-in-out infinite', borderRadius: '9999px' }} />
                {/* Star field */}
                {PLAN_STARS.map((star, i) => (
                  <div key={i} style={{
                    position: 'absolute',
                    left: `${star.x}%`,
                    top: `${star.y}%`,
                    width: `${star.s}px`,
                    height: `${star.s}px`,
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                    animation: `${i % 3 === 0 ? 'star-drift' : 'star-blink'} ${2.5 + star.d}s ease-in-out ${star.d}s infinite`,
                    pointerEvents: 'none',
                  }} />
                ))}
                {/* Content */}
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <Crown style={{ width: 20, height: 20, color: ACCENT }} />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pro Plan</span>
                      <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700, backgroundColor: '#22C55E20', color: '#4ADE80' }}>Active</span>
                    </div>
                    <p style={{ fontSize: '42px', fontWeight: 900, color: '#fff', letterSpacing: '-1px', lineHeight: 1 }}>
                      ${grandTotal.toLocaleString()}
                      <span style={{ fontSize: '16px', fontWeight: 400, color: 'rgba(255,255,255,0.5)', letterSpacing: 0 }}>/month</span>
                    </p>
                    <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)', marginTop: '6px' }}>
                      Staff: ${monthlyTotal} + Clients: ${clientProfileCost}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Next renewal</p>
                    <p style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>Apr 1, 2026</p>
                  </div>
                </div>

                {/* Usage bars */}
                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative', zIndex: 1 }}>
                  {/* Seat usage */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>STAFF SEATS</span>
                      <span style={{ fontSize: '12px', color: ACCENT, fontWeight: 700 }}>{activeSeats} active × ${PRICE_PER_SEAT} = ${monthlyTotal}/mo</span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '9999px', backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: '9999px',
                        background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_D})`,
                        width: `${(activeSeats / Math.max(staff.length, 1)) * 100}%`,
                        transition: 'width 0.4s',
                      }} />
                    </div>
                  </div>
                  {/* Client profiles */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>CLIENT PROFILES</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: clientCount > FREE_CLIENT_TIER ? '#60A5FA' : '#4ADE80' }}>
                        {clientCount.toLocaleString()} profiles · {clientCount <= FREE_CLIENT_TIER ? 'Free tier' : `+${paidClientBlocks} block${paidClientBlocks !== 1 ? 's' : ''} = $${clientProfileCost}/mo`}
                      </span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '9999px', backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: '9999px',
                        background: clientCount > FREE_CLIENT_TIER
                          ? 'linear-gradient(90deg, #3B82F6, #6366F1)'
                          : 'linear-gradient(90deg, #22C55E, #16A34A)',
                        width: `${Math.min((clientCount / (FREE_CLIENT_TIER + CLIENTS_PER_BLOCK * Math.max(paidClientBlocks + 1, 2))) * 100, 100)}%`,
                        transition: 'width 0.4s',
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>0</span>
                      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>1 000 free</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pricing info */}
              <SectionCard>
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="w-4 h-4" style={{ color: ACCENT }} />
                  <h3 className="text-[var(--text-primary)]">How billing works</h3>
                </div>
                <Separator className="mb-4 mt-2" />
                {/* Staff seats row */}
                <p className="text-[var(--text-secondary)]" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Staff seats</p>
                <div className="grid grid-cols-3 gap-4 mb-5">
                  {[
                    { label: 'Price per member', value: `$${PRICE_PER_SEAT}`,  sub: 'per month',      color: ACCENT },
                    { label: 'Active members',   value: `${activeSeats}`,      sub: 'billable seats', color: '#3B82F6' },
                    { label: 'Staff subtotal',   value: `$${monthlyTotal}`,    sub: 'per month',      color: '#4ADE80' },
                  ].map(s => (
                    <div key={s.label} style={{ padding: '16px', borderRadius: '10px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                      <p className="text-[var(--text-secondary)]" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>{s.label}</p>
                      <p style={{ fontSize: '26px', fontWeight: 900, color: s.color, letterSpacing: '-0.5px' }}>{s.value}</p>
                      <p className="text-[var(--text-secondary)]" style={{ fontSize: '12px', marginTop: '4px' }}>{s.sub}</p>
                    </div>
                  ))}
                </div>
                {/* Client profiles row */}
                <p className="text-[var(--text-secondary)]" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Client profiles</p>
                <div className="grid grid-cols-4 gap-4 mb-5">
                  {[
                    { label: 'Free tier',          value: '1 000',                                                    sub: 'profiles included',       color: '#4ADE80' },
                    { label: 'Price per 500 more',  value: `$${PRICE_PER_CLIENT_BLOCK}`,                              sub: 'per block / month',        color: ACCENT },
                    { label: 'Your profiles',       value: clientCount.toLocaleString(),                               sub: 'current total',           color: '#3B82F6' },
                    { label: 'Client subtotal',     value: `$${clientProfileCost}`,                                   sub: paidClientBlocks === 0 ? 'free tier' : `${paidClientBlocks} paid block${paidClientBlocks !== 1 ? 's' : ''}`, color: clientProfileCost > 0 ? '#818CF8' : '#4ADE80' },
                  ].map(s => (
                    <div key={s.label} style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                      <p className="text-[var(--text-secondary)]" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>{s.label}</p>
                      <p style={{ fontSize: '22px', fontWeight: 900, color: s.color, letterSpacing: '-0.5px' }}>{s.value}</p>
                      <p className="text-[var(--text-secondary)]" style={{ fontSize: '11px', marginTop: '4px' }}>{s.sub}</p>
                    </div>
                  ))}
                </div>
                {/* Grand total banner */}
                <div style={{ padding: '14px 20px', borderRadius: '10px', backgroundColor: `${ACCENT}10`, border: `1.5px solid ${ACCENT}30`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: ACCENT_D, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Monthly total</p>
                    <p className="text-[var(--text-secondary)]" style={{ fontSize: '12px', marginTop: '2px' }}>
                      Staff ${monthlyTotal} + Clients ${clientProfileCost}
                    </p>
                  </div>
                  <p style={{ fontSize: '32px', fontWeight: 900, color: ACCENT, letterSpacing: '-1px' }}>${grandTotal}</p>
                </div>
                <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: `${ACCENT}0a`, border: `1px solid ${ACCENT}25` }}>
                  <p className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>
                    <span style={{ fontWeight: 700, color: ACCENT_D }}>Tip:</span> The first 1 000 client profiles are always free. Beyond that, each block of 500 additional profiles adds $5/month. Staff seats are billed per active member — deactivating a member removes them from the next billing cycle.
                  </p>
                </div>
              </SectionCard>

              {/* Team members / seat management */}
              <SectionCard>
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <h3 className="text-[var(--text-primary)]">Team members</h3>
                    <p className="text-[var(--text-secondary)] mt-0.5" style={{ fontSize: '13px' }}>
                      Each active member uses one paid seat · {activeSeats} active · ${monthlyTotal}/month (staff only)
                    </p>
                  </div>
                  <div style={{
                    padding: '8px 16px', borderRadius: '10px',
                    backgroundColor: ACCENT_BG, border: `1px solid ${ACCENT}30`,
                  }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: ACCENT_D, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Monthly cost</p>
                    <p style={{ fontSize: '22px', fontWeight: 900, color: ACCENT, textAlign: 'center', letterSpacing: '-0.5px' }}>${monthlyTotal}</p>
                  </div>
                </div>
                <Separator className="mb-4 mt-3" />

                {/* Active members */}
                <div style={{ marginBottom: '8px' }}>
                  <p className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                    Active — {activeSeats} seats × ${PRICE_PER_SEAT} = <span style={{ color: ACCENT_D }}>${monthlyTotal}/mo</span>
                  </p>
                  <div className="space-y-2">
                    {staff.filter(s => s.active).map(member => (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 p-3 border border-[var(--border-color)] bg-[var(--surface-elevated)]"
                        style={{ borderRadius: '10px' }}
                      >
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: `linear-gradient(135deg, ${member.color}dd, ${member.color}77)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '12px', fontWeight: 700, color: '#fff', flexShrink: 0,
                        }}>
                          {member.initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{member.name}</p>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{member.role} · {member.email}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: ACCENT_D }}>${PRICE_PER_SEAT}/mo</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeStaff(member.id)}
                            className="text-[#d4183d] hover:text-[#d4183d]"
                            title="Remove seat"
                          >
                            <UserMinus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Inactive / deactivated members */}
                {staff.filter(s => !s.active).length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <p className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                      Deactivated — no charge
                    </p>
                    <div className="space-y-2">
                      {staff.filter(s => !s.active).map(member => (
                        <div
                          key={member.id}
                          className="flex items-center gap-3 p-3 border border-[var(--border-color)]"
                          style={{ borderRadius: '10px', opacity: 0.6 }}
                        >
                          <div style={{
                            width: 36, height: 36, borderRadius: '50%',
                            backgroundColor: 'var(--surface-elevated)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0,
                          }}>
                            {member.initials}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{member.name}</p>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{member.role} · deactivated</p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => restoreStaff(member.id)}>
                            <UserPlus className="w-3.5 h-3.5" /> Re-activate
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Invite new member */}
                <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
                  <p className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>
                    Invite new member <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-secondary)' }}>— adds +${PRICE_PER_SEAT}/mo to your plan</span>
                  </p>
                  <div className="flex gap-3">
                    <Input
                      type="email"
                      placeholder="colleague@email.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && inviteStaff()}
                      style={{ flex: 1 }}
                    />
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger style={{ width: '160px' }}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Veterinarian">Veterinarian</SelectItem>
                        <SelectItem value="Vet Technician">Vet Technician</SelectItem>
                        <SelectItem value="Front Desk">Front Desk</SelectItem>
                        <SelectItem value="Administrator">Administrator</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={inviteStaff} style={{ backgroundColor: ACCENT, borderColor: ACCENT }}>
                      <UserPlus className="w-4 h-4" /> Invite
                    </Button>
                  </div>
                  <p className="text-[var(--text-secondary)]" style={{ fontSize: '12px', marginTop: '8px' }}>
                    An invitation email will be sent. They'll have access once they accept and set up their account.
                  </p>
                </div>
              </SectionCard>

              {/* Client Profiles */}
              <SectionCard>
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <h3 className="text-[var(--text-primary)]">Client profiles</h3>
                    <p className="text-[var(--text-secondary)] mt-0.5" style={{ fontSize: '13px' }}>
                      First 1 000 free · then $5/month per 500 profiles · currently {clientCount.toLocaleString()} profiles
                    </p>
                  </div>
                  <div style={{
                    padding: '8px 16px', borderRadius: '10px',
                    backgroundColor: clientProfileCost > 0 ? '#818CF815' : '#22C55E15',
                    border: `1px solid ${clientProfileCost > 0 ? '#818CF840' : '#22C55E40'}`,
                  }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: clientProfileCost > 0 ? '#818CF8' : '#16A34A', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
                      Client cost
                    </p>
                    <p style={{ fontSize: '22px', fontWeight: 900, color: clientProfileCost > 0 ? '#818CF8' : '#4ADE80', textAlign: 'center', letterSpacing: '-0.5px' }}>
                      ${clientProfileCost}/mo
                    </p>
                  </div>
                </div>
                <Separator className="mb-5 mt-3" />

                {/* Tier ladder */}
                <div style={{ marginBottom: '24px' }}>
                  <p className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
                    Pricing tiers
                  </p>
                  {[
                    { range: '0 – 1 000',   price: 'Free',  active: clientCount <= FREE_CLIENT_TIER },
                    { range: '1 001 – 1 500', price: '$5/mo', active: clientCount > 1000 && clientCount <= 1500 },
                    { range: '1 501 – 2 000', price: '$10/mo', active: clientCount > 1500 && clientCount <= 2000 },
                    { range: '2 001 – 2 500', price: '$15/mo', active: clientCount > 2000 && clientCount <= 2500 },
                    { range: '2 501+',        price: '+$5 per 500', active: clientCount > 2500 },
                  ].map((tier, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 py-2.5 px-3 mb-1.5"
                      style={{
                        borderRadius: '8px',
                        backgroundColor: tier.active ? `${ACCENT}10` : 'var(--surface-elevated)',
                        border: tier.active ? `1.5px solid ${ACCENT}40` : '1px solid var(--border-color)',
                      }}
                    >
                      {tier.active ? (
                        <div style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: `${ACCENT}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Users style={{ width: 11, height: 11, color: ACCENT }} />
                        </div>
                      ) : (
                        <div style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: 'var(--border-color)', flexShrink: 0 }} />
                      )}
                      <span style={{ flex: 1, fontSize: '13px', color: tier.active ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: tier.active ? 600 : 400 }}>
                        {tier.range} profiles
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: tier.active ? ACCENT_D : 'var(--text-secondary)' }}>
                        {tier.price}
                      </span>
                      {tier.active && (
                        <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '10px', fontWeight: 700, backgroundColor: `${ACCENT}20`, color: ACCENT_D }}>
                          Current
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Manual count adjuster */}
                <div style={{ paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
                  <p className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>
                    Adjust profile count
                  </p>
                  <p className="text-[var(--text-secondary)]" style={{ fontSize: '13px', marginBottom: '16px' }}>
                    Simulate how your billing changes as your client base grows.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      onClick={() => setClientCount(c => Math.max(0, c - CLIENTS_PER_BLOCK))}
                      style={{
                        width: 36, height: 36, borderRadius: '8px', border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--surface-elevated)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--text-primary)', fontSize: '18px', fontWeight: 700,
                      }}
                    >
                      <Minus style={{ width: 14, height: 14 }} />
                    </button>
                    <div style={{ flex: 1 }}>
                      <input
                        type="range"
                        min={0}
                        max={5000}
                        step={CLIENTS_PER_BLOCK}
                        value={clientCount}
                        onChange={e => setClientCount(Number(e.target.value))}
                        style={{ width: '100%', accentColor: ACCENT }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>0</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>2 500</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>5 000</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setClientCount(c => Math.min(5000, c + CLIENTS_PER_BLOCK))}
                      style={{
                        width: 36, height: 36, borderRadius: '8px', border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--surface-elevated)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--text-primary)', fontSize: '18px', fontWeight: 700,
                      }}
                    >
                      <Plus style={{ width: 14, height: 14 }} />
                    </button>
                    <div style={{ minWidth: '120px', padding: '8px 14px', borderRadius: '10px', backgroundColor: ACCENT_BG, border: `1px solid ${ACCENT}30`, textAlign: 'center' }}>
                      <p style={{ fontSize: '11px', fontWeight: 700, color: ACCENT_D, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Profiles</p>
                      <p style={{ fontSize: '20px', fontWeight: 900, color: ACCENT, letterSpacing: '-0.5px' }}>{clientCount.toLocaleString()}</p>
                    </div>
                  </div>
                  {clientCount > FREE_CLIENT_TIER && (
                    <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#818CF810', border: '1px solid #818CF830' }}>
                      <p className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>
                        <span style={{ fontWeight: 700, color: '#818CF8' }}>{clientCount.toLocaleString()} profiles</span> — {clientCount - FREE_CLIENT_TIER} over the free tier
                        ({paidClientBlocks} block{paidClientBlocks !== 1 ? 's' : ''} × ${PRICE_PER_CLIENT_BLOCK}) = <span style={{ fontWeight: 700, color: '#818CF8' }}>${clientProfileCost}/month</span>
                      </p>
                    </div>
                  )}
                  {clientCount <= FREE_CLIENT_TIER && (
                    <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#22C55E10', border: '1px solid #22C55E30' }}>
                      <p className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>
                        <span style={{ fontWeight: 700, color: '#4ADE80' }}>{clientCount.toLocaleString()} profiles</span> — within the free tier. You can grow to {FREE_CLIENT_TIER.toLocaleString()} profiles at no extra cost.
                      </p>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Payment method */}
              <SectionCard>
                <h3 className="text-[var(--text-primary)] mb-1">Payment method</h3>
                <Separator className="mb-4 mt-2" />
                <div className="flex items-center gap-4 p-4 border border-[var(--border-color)] bg-[var(--surface-elevated)]" style={{ borderRadius: '10px', marginBottom: '12px' }}>
                  <div style={{ width: 44, height: 28, borderRadius: '6px', background: 'linear-gradient(135deg, #1A1A6E, #3B4BC8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '8px', fontWeight: 800, color: '#fff', letterSpacing: '0.5px' }}>VISA</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Visa ending in 4242</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Expires 08/2027 · Billing to v.cross@hugory.com</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">Edit</Button>
                    <Button size="sm" variant="outline">Replace</Button>
                  </div>
                </div>
                <Button size="sm" variant="outline">+ Add backup payment method</Button>
              </SectionCard>

              {/* Invoice history */}
              <SectionCard>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-[var(--text-primary)]">Invoice history</h3>
                  <Button size="sm" variant="outline"><Download className="w-3.5 h-3.5" /> Export all</Button>
                </div>
                <Separator className="mb-4 mt-2" />
                {[
                  { date: 'Mar 1, 2026', seats: 7, clients: 1247, inv: 'INV-2026-003' },
                  { date: 'Feb 1, 2026', seats: 7, clients: 1100, inv: 'INV-2026-002' },
                  { date: 'Jan 1, 2026', seats: 6, clients:  980, inv: 'INV-2026-001' },
                  { date: 'Dec 1, 2025', seats: 6, clients:  870, inv: 'INV-2025-012' },
                ].map((inv, i) => {
                  const staffCost  = inv.seats * PRICE_PER_SEAT;
                  const cBlocks    = Math.max(0, Math.ceil((inv.clients - FREE_CLIENT_TIER) / CLIENTS_PER_BLOCK));
                  const clientCost = cBlocks * PRICE_PER_CLIENT_BLOCK;
                  const total      = staffCost + clientCost;
                  return (
                    <div key={i} className="flex items-center gap-4 py-3 border-b border-[var(--border-color)] last:border-0">
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{inv.inv}</p>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {inv.date} · {inv.seats} staff × ${PRICE_PER_SEAT}
                          {clientCost > 0 && ` + ${inv.clients.toLocaleString()} clients ($${clientCost})`}
                          {clientCost === 0 && ` · ${inv.clients.toLocaleString()} clients (free)`}
                        </p>
                      </div>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>${total}.00</span>
                      <span style={{ padding: '2px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600, backgroundColor: '#22C55E15', color: '#16A34A' }}>Paid</span>
                      <Button size="sm" variant="ghost"><Download className="w-4 h-4" /></Button>
                    </div>
                  );
                })}
              </SectionCard>
            </>
          )}

          {/* ════════════════════════════════════ INTEGRATIONS */}
          {active === 'integrations' && (
            <>
              <SectionCard>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[var(--text-primary)] mb-1">Connected integrations</h3>
                    <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>
                      {ALL_INTEGRATIONS.filter(i => intStatuses[i.id] === 'connected').length} active ·{' '}
                      {ALL_INTEGRATIONS.filter(i => intStatuses[i.id] === 'error').length > 0 ? `${ALL_INTEGRATIONS.filter(i => intStatuses[i.id] === 'error').length} need attention` : 'all healthy'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface-elevated)]" style={{ borderRadius: '8px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: ACCENT }} />
                    <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>
                      {ALL_INTEGRATIONS.filter(i => intStatuses[i.id] === 'connected').length} connected
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-5">
                  {ALL_INTEGRATIONS.filter(i => intStatuses[i.id] === 'connected').map(intg => (
                    <div key={intg.id} className="flex items-center gap-3 p-3 border border-[var(--border-color)] bg-[var(--surface-elevated)]" style={{ borderRadius: '10px' }}>
                      <div className="w-9 h-9 flex items-center justify-center flex-shrink-0" style={{ borderRadius: '8px', backgroundColor: intg.iconBg }}>
                        <span style={{ fontSize: '9px', fontWeight: 800, color: intg.iconColor, letterSpacing: '-0.5px' }}>{intg.iconText}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[var(--text-primary)] truncate" style={{ fontSize: '13px', fontWeight: 600 }}>{intg.name}</p>
                        <p className="text-[var(--text-secondary)]" style={{ fontSize: '11px' }}>Synced {intg.lastSync}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              {ALL_INTEGRATIONS.filter(i => intStatuses[i.id] === 'error').map(intg => (
                <div key={intg.id} className="flex items-start gap-4 p-4 border" style={{ borderRadius: '12px', borderColor: '#d4183d40', backgroundColor: '#d4183d08' }}>
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#d4183d' }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{intg.name} — connection error</p>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 2 }}>Last successful sync {intg.lastSync}. Re-authenticate to restore.</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button variant="outline" size="sm" onClick={() => setIntStatuses(p => ({ ...p, [intg.id]: 'connected' }))}><RefreshCw className="w-3.5 h-3.5" /> Reconnect</Button>
                    <Button variant="ghost" size="sm" onClick={() => setIntStatuses(p => ({ ...p, [intg.id]: 'available' }))} className="text-[#d4183d] hover:text-[#d4183d]">Dismiss</Button>
                  </div>
                </div>
              ))}

              {[...new Set(ALL_INTEGRATIONS.map(i => i.category))].map(cat => (
                <SectionCard key={cat}>
                  <div className="flex items-center gap-2 mb-1">
                    {cat === 'Lab Services'   && <FlaskConical className="w-4 h-4 text-[#8B5CF6]" />}
                    {cat === 'Payments'       && <CreditCard   className="w-4 h-4 text-[#22C55E]" />}
                    {cat === 'Communications' && <MessageSquare className="w-4 h-4 text-[#06B6D4]" />}
                    {cat === 'Calendar'       && <Calendar     className="w-4 h-4 text-[#3B82F6]" />}
                    {cat === 'Storage'        && <Database      className="w-4 h-4" style={{ color: ACCENT }} />}
                    <h3 className="text-[var(--text-primary)]">{cat}</h3>
                  </div>
                  <Separator className="mb-4" />
                  <div className="space-y-3">
                    {ALL_INTEGRATIONS.filter(i => i.category === cat).map(intg => {
                      const status = intStatuses[intg.id];
                      return (
                        <div key={intg.id} className="flex items-center gap-4 p-4 border border-[var(--border-color)] transition-colors" style={{ borderRadius: '10px', backgroundColor: status === 'connected' ? 'var(--surface-elevated)' : 'transparent', borderColor: status === 'error' ? '#d4183d40' : undefined }}>
                          <div className="w-12 h-12 flex items-center justify-center flex-shrink-0" style={{ borderRadius: '10px', backgroundColor: intg.iconBg, border: '1px solid var(--border-color)' }}>
                            <span style={{ fontSize: '10px', fontWeight: 800, color: intg.iconColor, letterSpacing: '-0.5px' }}>{intg.iconText}</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="flex items-center gap-2 mb-0.5">
                              <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{intg.name}</p>
                              {status === 'connected' && <span style={{ padding: '1px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700, backgroundColor: '#22C55E15', color: '#16A34A' }}>● Connected</span>}
                              {status === 'error'     && <span style={{ padding: '1px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700, backgroundColor: '#EF444415', color: '#EF4444' }}>⚠ Error</span>}
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{intg.description}</p>
                            {status === 'connected' && intg.lastSync && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 4 }}>Last synced: {intg.lastSync}</p>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {status === 'available' && <Button size="sm" style={{ backgroundColor: ACCENT, borderColor: ACCENT }} onClick={() => setIntStatuses(p => ({ ...p, [intg.id]: 'connected' }))}><Plug className="w-3.5 h-3.5" /> Connect</Button>}
                            {status === 'error'     && <Button size="sm" onClick={() => setIntStatuses(p => ({ ...p, [intg.id]: 'connected' }))}><RefreshCw className="w-3.5 h-3.5" /> Reconnect</Button>}
                            {status === 'connected' && (
                              <>
                                <Button variant="outline" size="sm">Configure</Button>
                                <Button variant="ghost" size="sm" onClick={() => setIntStatuses(p => ({ ...p, [intg.id]: 'available' }))} className="text-[#d4183d] hover:text-[#d4183d]">Disconnect</Button>
                              </>
                            )}
                            <a href="#" className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><ExternalLink className="w-3.5 h-3.5" /></a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              ))}

              <SectionCard>
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4" style={{ color: ACCENT }} />
                  <h3 className="text-[var(--text-primary)]">API access</h3>
                </div>
                <p className="text-[var(--text-secondary)] mb-2" style={{ fontSize: '14px' }}>Full read/write API key for your clinic. Keep this secret.</p>
                <Separator className="mb-4" />
                <FieldRow label="API key" hint="Treat this like a password">
                  <div className="flex gap-2">
                    <Input readOnly value="vtk_live_••••••••••••••••••••••••••••••••" className="font-mono" style={{ fontSize: '13px' }} />
                    <Button variant="outline" size="sm" onClick={() => copyText('vtk_live_sk_1234567890abcdef', setApiKeyCopied)}>
                      {apiKeyCopied ? <Check className="w-4 h-4" style={{ color: ACCENT }} /> : <Copy className="w-4 h-4" />}
                      {apiKeyCopied ? 'Copied' : 'Copy'}
                    </Button>
                    <Button variant="outline" size="sm"><RotateCcw className="w-4 h-4" /> Rotate</Button>
                  </div>
                  <p className="text-[var(--text-secondary)] mt-1.5" style={{ fontSize: '12px' }}>Generated Mar 1, 2026 · Last used 2 hours ago</p>
                </FieldRow>
                <FieldRow label="Webhook secret" hint="Verify payloads came from Hugory">
                  <div className="flex gap-2">
                    <Input readOnly value={showSecret ? 'whsec_8f3kLp2mNqR9xTvW4yZaB6cD1eF7gH0i' : 'whsec_••••••••••••••••••••••••••••'} className="font-mono" style={{ fontSize: '13px' }} />
                    <Button variant="outline" size="sm" onClick={() => setShowSecret(!showSecret)}>
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => copyText('whsec_8f3kLp2mNqR9xTvW4yZaB6cD1eF7gH0i', setWebhookCopied)}>
                      {webhookCopied ? <Check className="w-4 h-4" style={{ color: ACCENT }} /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </FieldRow>
              </SectionCard>
            </>
          )}

          {/* ═════════════════════════════════════════ SYSTEM */}
          {active === 'system' && (
            <>
              <div style={{
                padding: '16px 20px', borderRadius: '12px',
                border: maintenanceMode ? `2px solid ${ACCENT}` : '1px solid var(--border-color)',
                backgroundColor: maintenanceMode ? ACCENT_BG : 'var(--surface-white)',
              }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <Server style={{ width: 20, height: 20, color: maintenanceMode ? ACCENT : 'var(--text-secondary)', flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Maintenance mode</p>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {maintenanceMode ? '⚠ Active — clients and staff cannot access the platform.' : 'When enabled, shows a maintenance page to clients and staff.'}
                      </p>
                    </div>
                  </div>
                  <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
                </div>
              </div>

              <SectionCard>
                <div className="flex items-center gap-2 mb-1">
                  <ToggleLeft className="w-4 h-4" style={{ color: ACCENT }} />
                  <h3 className="text-[var(--text-primary)]">Feature flags</h3>
                </div>
                <p className="text-[var(--text-secondary)] mb-2" style={{ fontSize: '14px' }}>Enable or disable features for your clinic. Beta features may be unstable.</p>
                <Separator className="mb-2" />
                <ToggleRow label="New booking flow" description="Updated appointment booking UI with multi-slot and real-time availability" checked={featureFlags.newBookingFlow} onChange={v => setFeatureFlags(p => ({ ...p, newBookingFlow: v }))} />
                <ToggleRow label="AI diagnosis suggestions" description="Beta — surfaces potential differentials based on symptoms during visits" checked={featureFlags.aiDiagnosis} onChange={v => setFeatureFlags(p => ({ ...p, aiDiagnosis: v }))} />
                <ToggleRow label="Client video consultations" description="Beta — allow clients to book video calls with vets via the client portal" checked={featureFlags.clientVideoCall} onChange={v => setFeatureFlags(p => ({ ...p, clientVideoCall: v }))} />
                <ToggleRow label="Advanced analytics" description="Expanded analytics with revenue forecasting and staff benchmarks" checked={featureFlags.advancedReports} onChange={v => setFeatureFlags(p => ({ ...p, advancedReports: v }))} />
                <SaveBar onSave={() => save('system')} saved={saved('system')} />
              </SectionCard>

              <SectionCard>
                <div className="flex items-center gap-2 mb-1">
                  <Database className="w-4 h-4" style={{ color: ACCENT }} />
                  <h3 className="text-[var(--text-primary)]">Data retention & backup</h3>
                </div>
                <Separator className="mb-2 mt-2" />
                <FieldRow label="Records retention" hint="HIPAA minimum: 7 years">
                  <Select value={retentionYears} onValueChange={setRetentionYears}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 years (HIPAA minimum)</SelectItem>
                      <SelectItem value="10">10 years</SelectItem>
                      <SelectItem value="15">15 years</SelectItem>
                      <SelectItem value="forever">Indefinite</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
                <FieldRow label="Backup frequency">
                  <Select value={backupFreq} onValueChange={setBackupFreq}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily (recommended)</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
                <FieldRow label="Last backup">
                  <div className="flex items-center gap-3">
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Mar 15, 2026 — 3:00 AM</span>
                    <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700, backgroundColor: '#22C55E15', color: '#16A34A' }}>Success</span>
                    <Button size="sm" variant="outline"><Download className="w-3.5 h-3.5" /> Download</Button>
                  </div>
                </FieldRow>
                <SaveBar onSave={() => save('system')} saved={saved('system')} />
              </SectionCard>

              <SectionCard>
                <h3 style={{ color: '#d4183d', marginBottom: '4px' }}>Danger zone</h3>
                <p className="text-[var(--text-secondary)] mb-4" style={{ fontSize: '14px' }}>These actions are irreversible.</p>
                <div className="space-y-3">
                  {[
                    { label: 'Export all data',    desc: 'Download all patient records, invoices, and staff data.',            action: 'Export',  danger: false },
                    { label: 'Delete clinic',      desc: 'Permanently delete this clinic and all associated data. Cannot be undone.', action: 'Delete clinic', danger: true },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between p-4 border border-[var(--border-color)]" style={{ borderRadius: '10px', borderColor: item.danger ? '#d4183d30' : undefined }}>
                      <div>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: item.danger ? '#d4183d' : 'var(--text-primary)' }}>{item.label}</p>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 2 }}>{item.desc}</p>
                      </div>
                      <Button size="sm" variant="outline" className={item.danger ? 'text-[#d4183d] border-[#d4183d40] hover:text-[#d4183d]' : ''} style={{ flexShrink: 0, marginLeft: '16px' }}>
                        {item.action}
                      </Button>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
