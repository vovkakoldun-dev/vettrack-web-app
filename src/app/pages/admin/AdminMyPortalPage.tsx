import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  CheckCircle2, Circle, Plus, X, ArrowRight,
  CreditCard, CalendarCheck, ClipboardList, PawPrint,
  Clock, Users, DollarSign,
  MessageSquare, ChevronRight,
  Phone, Mail, Zap, Camera, ArrowUpRight,
  ChevronLeft, ChevronRight as ChevronRightIcon, Send, AlertCircle,
  Palmtree, ThermometerSun, UtensilsCrossed, UsersRound, Briefcase, Pencil,
} from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Calendar } from '../../components/ui/calendar';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select';
import { useTenantDb } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { getOrgContext } from '../../hooks/useOrgContext';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import { AddClientDialog } from '../../components/AddClientDialog';
import { useClients, type AddClientValues } from '../../hooks/useClients';

// ─── GlowStatCard infrastructure (mirrored from MyPortalPage) ─

function buildSplinePath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = prev.x + (curr.x - prev.x) * 0.5;
    d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

function useDarkMode(): boolean {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains('dark'))
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

type GlowCardDef = {
  title: string; subtitle: string; metricLabel: string;
  value: string; trendLabel: string; trendPositive: boolean;
  color: string; shadowColor: string; icon: React.ElementType;
  data: number[]; labels: string[]; unit: string;
  annotationStart: string; annotationEnd: string;
  path: string;
};

function GlowStatCard({
  title, subtitle, metricLabel, value, trendLabel, trendPositive,
  color, shadowColor, icon: Icon, data, labels, unit, annotationStart, annotationEnd, path,
}: GlowCardDef) {
  const navigate = useNavigate();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const VW = 320; const VH = 100; const PX = 24; const PY = 18;
  const min = Math.min(...data); const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((val, i) => ({
    x: PX + (i / (data.length - 1)) * (VW - PX * 2),
    y: VH - PY - ((val - min) / range) * (VH - PY * 2),
  }));
  const linePath = buildSplinePath(pts);
  const first = pts[0]; const last = pts[pts.length - 1];
  const areaPath = linePath + ` L ${last.x} ${VH} L ${first.x} ${VH} Z`;
  const midY = VH / 2;
  const uid = title.replace(/[^a-zA-Z0-9]/g, '');

  // Read CSS custom properties for theme-aware tokens
  const cs = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  const v = (name: string, fallback: string) => cs?.getPropertyValue(name).trim() || fallback;

  const cardBg = `linear-gradient(145deg, ${v('--stat-card-bg-from','#0D1B2A')} 0%, ${v('--stat-card-bg-mid','#0A1520')} 60%, ${v('--stat-card-bg-to','#0D1B2A')} 100%)`;
  const borderAlpha = parseFloat(v('--stat-card-border-alpha', '0.07'));
  const cardBorder = `${color}${Math.round(borderAlpha * 255).toString(16).padStart(2, '0')}`;
  const cardShadow = `0 0 0 1px ${cardBorder}, 0 20px 60px -10px ${shadowColor}`;
  const cornerGlow = `${color}18`;
  const subtitleColor = v('--stat-card-text-muted', 'rgba(255,255,255,0.35)');
  const titleColor = v('--stat-card-text', '#ffffff');
  const metricLabelColor = v('--stat-card-text-label', 'rgba(255,255,255,0.3)');
  const valueColor = v('--stat-card-text', '#ffffff');
  const btnBorder = v('--stat-card-btn-border', 'rgba(255,255,255,0.1)');
  const btnBg = v('--stat-card-btn-bg', 'rgba(255,255,255,0.04)');
  const btnIconColor = v('--stat-card-btn-icon', 'rgba(255,255,255,0.35)');
  const dotHoleFill = v('--stat-card-dot-fill', '#0D1B2A');
  const midLineStroke = v('--stat-card-midline', 'rgba(255,255,255,0.07)');
  const annoStartFill = v('--stat-card-anno-start', 'rgba(255,255,255,0.45)');
  const annoEndFill = v('--stat-card-anno-end', 'rgba(255,255,255,0.9)');
  const areaOpacity = parseFloat(v('--stat-card-area-opacity', '0.22'));
  const useAccentLine = parseFloat(v('--stat-card-use-accent-line', '0'));
  const lineWhiteStop = useAccentLine ? color : '#ffffff';
  const lineWhiteOpacity = parseFloat(v('--stat-card-line-white-opacity', '0.9'));
  const glowOpacity1 = parseFloat(v('--stat-card-glow1', '0.35'));
  const glowOpacity2 = parseFloat(v('--stat-card-glow2', '0.5'));

  return (
    <div onClick={() => navigate(path)} style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '18px', overflow: 'hidden', position: 'relative', boxShadow: cardShadow, cursor: 'pointer' }}>
      <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '140px', height: '140px', borderRadius: '50%', background: `radial-gradient(circle,${cornerGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: `linear-gradient(135deg,${color}25 0%,${color}12 100%)`, border: `1px solid ${color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 14px ${color}25` }}>
              <Icon style={{ width: '19px', height: '19px', color }} />
            </div>
            <div>
              <p style={{ fontSize: '10px', color: subtitleColor, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: '3px' }}>{subtitle}</p>
              <p style={{ fontSize: '14px', color: titleColor, fontWeight: 700, lineHeight: 1 }}>{title}</p>
            </div>
          </div>
          <button onClick={e => { e.stopPropagation(); navigate(path); }} style={{ width: '30px', height: '30px', borderRadius: '8px', border: `1px solid ${btnBorder}`, backgroundColor: btnBg, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowUpRight style={{ width: '14px', height: '14px', color: btnIconColor }} />
          </button>
        </div>
        <p style={{ fontSize: '10px', color: metricLabelColor, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: '6px' }}>{metricLabel}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <span style={{ fontSize: '32px', fontWeight: 800, color: valueColor, letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 9px', borderRadius: '7px', background: trendPositive ? 'rgba(74,222,128,0.15)' : 'rgba(251,113,133,0.15)', color: trendPositive ? '#22c55e' : '#ef4444', fontSize: '11px', fontWeight: 700, border: `1px solid ${trendPositive ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
            {trendPositive ? '↑' : '↓'} {trendLabel}
          </span>
        </div>
      </div>
      <div style={{ position: 'relative' }} onMouseLeave={() => setHoveredIdx(null)}>
        <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" style={{ width: '100%', height: '100px', display: 'block', cursor: 'crosshair' }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * VW;
            let nearestIdx = 0; let minDist = Infinity;
            pts.forEach((pt, i) => { const dist = Math.abs(pt.x - mouseX); if (dist < minDist) { minDist = dist; nearestIdx = i; } });
            setHoveredIdx(nearestIdx);
          }}
        >
          <defs>
            <filter id={`bloom-${uid}`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" /></filter>
            <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={areaOpacity} /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient>
            <linearGradient id={`line-${uid}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={color} stopOpacity="0.6" /><stop offset="45%" stopColor={lineWhiteStop} stopOpacity={lineWhiteOpacity} /><stop offset="100%" stopColor={color} stopOpacity="1" /></linearGradient>
          </defs>
          <line x1={PX} y1={midY} x2={VW - PX} y2={midY} stroke={midLineStroke} strokeWidth="1" strokeDasharray="5 5" />
          <path d={areaPath} fill={`url(#area-${uid})`} />
          {glowOpacity1 > 0 && <path d={linePath} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" opacity={glowOpacity1} filter={`url(#bloom-${uid})`} />}
          {glowOpacity2 > 0 && <path d={linePath} fill="none" stroke={color} strokeWidth="5"  strokeLinecap="round" opacity={glowOpacity2} filter={`url(#bloom-${uid})`} />}
          <path d={linePath} fill="none" stroke={`url(#line-${uid})`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={first.x} cy={first.y} r="4.5" fill={dotHoleFill} stroke={color} strokeWidth="2" />
          <circle cx={last.x}  cy={last.y}  r="5" fill={color} filter={glowOpacity1 > 0 ? `url(#bloom-${uid})` : undefined} />
          <circle cx={last.x}  cy={last.y}  r="4" fill="#ffffff" opacity="0.9" />
          {annotationStart && <text x={first.x + 8} y={first.y - 9} fill={annoStartFill} fontSize="9.5" fontWeight="700" fontFamily="system-ui">{annotationStart}</text>}
          {annotationEnd   && <text x={last.x  - 8} y={last.y  - 9} fill={annoEndFill}   fontSize="9.5" fontWeight="700" fontFamily="system-ui" textAnchor="end">{annotationEnd}</text>}
          {hoveredIdx !== null && (() => {
            const hx = pts[hoveredIdx].x; const hy = pts[hoveredIdx].y;
            return (<>
              <line x1={hx} y1={0} x2={hx} y2={VH} stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
              <circle cx={hx} cy={hy} r="8" fill={color} opacity="0.18" />
              <circle cx={hx} cy={hy} r="5" fill={color} filter={glowOpacity1 > 0 ? `url(#bloom-${uid})` : undefined} opacity="0.8" />
              <circle cx={hx} cy={hy} r="4" fill={color} />
              <circle cx={hx} cy={hy} r="2" fill="#fff" />
            </>);
          })()}
        </svg>
        {hoveredIdx !== null && (() => {
          const hx = pts[hoveredIdx].x; const hy = pts[hoveredIdx].y;
          const dotFromBottom = VH - hy;
          const tooltipBg = v('--stat-card-dot-fill', '#0D1B2A');
          const tooltipBorder = `${color}55`;
          const tooltipShadow = `0 4px 20px rgba(0,0,0,0.4), 0 0 12px ${color}30`;
          const labelCol = v('--stat-card-text-muted', 'rgba(255,255,255,0.45)');
          return (
            <div style={{ position: 'absolute', left: `${(hx / VW) * 100}%`, bottom: `${dotFromBottom + 14}px`, transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 20, backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '10px', padding: '7px 11px', boxShadow: tooltipShadow, whiteSpace: 'nowrap', backdropFilter: 'blur(8px)' }}>
              <div style={{ fontSize: '10px', color: labelCol, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '2px' }}>{labels[hoveredIdx]}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '18px', fontWeight: 800, color, lineHeight: 1 }}>{data[hoveredIdx]}</span>
                <span style={{ fontSize: '10px', fontWeight: 600, color: labelCol }}>{unit}</span>
              </div>
              <div style={{ position: 'absolute', bottom: '-5px', left: '50%', width: '9px', height: '9px', backgroundColor: tooltipBg, borderRight: `1px solid ${tooltipBorder}`, borderBottom: `1px solid ${tooltipBorder}`, transform: 'translateX(-50%) rotate(45deg)' }} />
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── Schedule + PTO Types & Constants ─────────────────────────

type BlockType = 'Work Hours' | 'Lunch Break' | 'Meeting' | 'Personal' | 'PTO' | 'Sick Day';
type BlockStatus = 'Confirmed' | 'Pending' | 'Approved' | 'Denied';

interface TimeBlock {
  id: number;
  dbId?: string; // Supabase UUID
  type: BlockType;
  date: string; // 'YYYY-MM-DD'
  timeStart: string; // '8:00 AM'
  timeEnd: string;
  notes: string;
  status: BlockStatus;
}

const blockStyles: Record<BlockType, { bg: string; border: string; text: string; icon: React.ElementType }> = {
  'Work Hours':   { bg: 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)', border: 'var(--brand-green-text)', text: 'var(--brand-green-text)', icon: Briefcase },
  'Lunch Break':  { bg: '#F4A26115', border: '#F4A261',                  text: '#B45309',                 icon: UtensilsCrossed },
  'Meeting':      { bg: '#8B5CF615', border: '#8B5CF6',                  text: '#6D28D9',                 icon: UsersRound },
  'Personal':     { bg: '#6B728015', border: 'var(--text-secondary)',    text: 'var(--text-primary)',      icon: Briefcase },
  'PTO':          { bg: '#3B82F615', border: '#3B82F6',                  text: '#1D4ED8',                 icon: Palmtree },
  'Sick Day':     { bg: '#d4183d15', border: '#d4183d',                  text: '#d4183d',                 icon: ThermometerSun },
};

const requestStatusStyles: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  Approved:  { bg: '#74C69D20', text: 'var(--brand-green-text)', icon: CheckCircle2 },
  Pending:   { bg: '#F4A26120', text: '#F4A261',                 icon: AlertCircle  },
  Denied:    { bg: '#d4183d20', text: '#d4183d',                 icon: AlertCircle  },
  Confirmed: { bg: '#74C69D20', text: 'var(--brand-green-text)', icon: CheckCircle2 },
};

type WorkDay = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
type WorkDaySchedule = { enabled: boolean; start: string; end: string };
type WorkSchedule = Record<WorkDay, WorkDaySchedule>;

const WORK_DAYS: WorkDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DEFAULT_WORK_SCHEDULE: WorkSchedule = {
  Mon: { enabled: true,  start: '08:00', end: '17:00' },
  Tue: { enabled: true,  start: '08:00', end: '17:00' },
  Wed: { enabled: true,  start: '08:00', end: '17:00' },
  Thu: { enabled: true,  start: '08:00', end: '17:00' },
  Fri: { enabled: true,  start: '08:00', end: '17:00' },
  Sat: { enabled: false, start: '09:00', end: '13:00' },
  Sun: { enabled: false, start: '09:00', end: '13:00' },
};

const INITIAL_BLOCKS: TimeBlock[] = [
  { id: 1, type: 'Work Hours',  date: '2026-03-11', timeStart: '8:00 AM',  timeEnd: '12:00 PM', notes: 'Morning shift', status: 'Confirmed' },
  { id: 2, type: 'Lunch Break', date: '2026-03-11', timeStart: '12:00 PM', timeEnd: '1:00 PM',  notes: '',              status: 'Confirmed' },
  { id: 3, type: 'Work Hours',  date: '2026-03-11', timeStart: '1:00 PM',  timeEnd: '5:00 PM',  notes: 'Afternoon shift',status: 'Confirmed' },
  { id: 4, type: 'Meeting',     date: '2026-03-12', timeStart: '9:00 AM',  timeEnd: '9:30 AM',  notes: 'Morning standup — case reviews', status: 'Confirmed' },
  { id: 5, type: 'Lunch Break', date: '2026-03-12', timeStart: '12:00 PM', timeEnd: '1:00 PM',  notes: '',              status: 'Confirmed' },
  { id: 6, type: 'PTO',         date: '2026-03-17', timeStart: '8:00 AM',  timeEnd: '5:00 PM',  notes: 'Family day — full day off', status: 'Approved'  },
  { id: 7, type: 'PTO',         date: '2026-03-21', timeStart: '8:00 AM',  timeEnd: '5:00 PM',  notes: 'Personal appointment',      status: 'Pending'   },
  { id: 8, type: 'Sick Day',    date: '2026-03-05', timeStart: '8:00 AM',  timeEnd: '5:00 PM',  notes: 'Flu — stayed home',         status: 'Approved'  },
];

// Schedule slots: 8:00 AM → 6:00 PM in 30-min increments (20 slots)
const SCHEDULE_SLOTS = Array.from({ length: 20 }, (_, i) => {
  const totalMin = 8 * 60 + i * 30;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
});

function to24Hour(time12: string): string {
  const [timePart, ampm] = time12.split(' ');
  let [h, m] = timePart.split(':').map(Number);
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function isSameDay(dateStr: string, date: Date): boolean {
  const parts = dateStr.split('-');
  return (parseInt(parts[0]) === date.getFullYear() &&
          parseInt(parts[1]) === date.getMonth() + 1 &&
          parseInt(parts[2]) === date.getDate());
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function isToday(date: Date): boolean {
  const now = new Date();
  return date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

function formatActivityTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (diffH < 48) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Mock Data ────────────────────────────────────────────────

type AdminProfile = {
  name: string;
  role: string;
  email: string;
  phone: string;
  photo_url: string;
  shift: string;
  since: string;
};

const DEFAULT_ADMIN_PROFILE: AdminProfile = {
  name: 'Sarah Mitchell',
  role: 'Front Desk Admin',
  email: 'sarah.mitchell@vettrack.com',
  phone: '(555) 201-4400',
  photo_url: '',
  shift: '8:00 AM – 5:00 PM',
  since: 'Jan 2022',
};

// GLOW_CARDS are now built dynamically inside the component using useDashboardStats

// Task interface matching Supabase tasks table
interface PortalTask { id: string; text: string; done: boolean; priority: 'high' | 'normal'; }

// TODAY_CHECKINS are now fetched from Supabase inside the component

// RECENT_ACTIVITY is now fetched from Supabase inside the component

const QUICK_ACTIONS = [
  { icon: CreditCard,    label: 'Process Payment', color: 'var(--brand-green-text)', path: '/admin/payments'       },
  { icon: CalendarCheck, label: 'New Booking',      color: '#3B82F6', path: '/admin/bookings'       },
  { icon: Users,         label: 'Add Client',       color: '#8B5CF6', path: '/admin/clients'        },
  { icon: MessageSquare, label: 'Send Reminder',    color: '#F4A261', path: '/admin/communications' },
];

// ─── Page ─────────────────────────────────────────────────────

export default function AdminMyPortalPage() {
  const db = useTenantDb();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks]   = useState<PortalTask[]>([]);
  const [newTask, setNewTask] = useState('');
  const [tasksLoading, setTasksLoading] = useState(true);
  const [ADMIN_PROFILE, setAdminProfile] = useState<AdminProfile>(DEFAULT_ADMIN_PROFILE);
  const [profileLoading, setProfileLoading] = useState(true);
  const [ptoAllowance, setPtoAllowance] = useState(20);
  const [sickAllowance, setSickAllowance] = useState(10);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const { addClient, refetch: refetchClients } = useClients();

  const handleAddClient = async (values: AddClientValues): Promise<string | void> => {
    const { data, error } = await addClient(values);
    if (!error && data) return (data as any).id as string;
  };

  // ─── Single parallel data fetch on mount ─────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { organizationId } = await getOrgContext();
      const now = new Date();
      const today = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString();

      const [profileRes, tasksRes, checkinsRes, paymentsRes, apptsRes, newClientsRes, timeBlocksRes, staffRes] = await Promise.all([
        // Profile
        db.from('profiles').select('id, first_name, last_name, email, phone, avatar_url, role').eq('id', user.id).single(),
        // Tasks
        db.from('tasks').select('id, type, priority, status, due_date, doctor_notes, pet:pets!tasks_pet_org_fkey(name), client:clients!tasks_client_org_fkey(first_name, last_name)').eq('organization_id', organizationId).order('due_date', { ascending: true }).limit(10),
        // Today's check-ins
        db.from('appointments').select('id, scheduled_at, status, reason, pets!inner(name, clients!inner(first_name, last_name)), services(name)').eq('organization_id', organizationId).gte('scheduled_at', `${today}T00:00:00`).lte('scheduled_at', `${today}T23:59:59`).order('scheduled_at', { ascending: true }).limit(8),
        // Recent payments
        db.from('payments').select('id, amount, method, paid_at, invoices!inner(id, client_id, clients!inner(first_name, last_name, pets(name)))').gte('paid_at', weekAgoStr).order('paid_at', { ascending: false }).limit(3),
        // Recent appointments
        db.from('appointments').select('id, status, scheduled_at, pets!inner(name, clients!inner(first_name, last_name))').eq('organization_id', organizationId).gte('scheduled_at', weekAgoStr).in('status', ['Confirmed', 'Completed', 'Cancelled']).order('scheduled_at', { ascending: false }).limit(3),
        // New clients
        db.from('clients').select('id, first_name, last_name, created_at, pets(id)').eq('organization_id', organizationId).gte('created_at', weekAgoStr).order('created_at', { ascending: false }).limit(2),
        // Time blocks
        db.from('staff_time_blocks').select('*').eq('organization_id', organizationId).eq('staff_id', user.id).order('date'),
        // Staff record (PTO/sick allowance)
        db.from('staff').select('pto_allowance, sick_allowance').eq('id', user.id).single(),
      ]);

      // Profile
      if (profileRes.data) {
        const data = profileRes.data;
        setAdminProfile({
          name: (data.first_name && data.last_name) ? `${data.first_name} ${data.last_name}` : 'Sarah Mitchell',
          role: 'Front Desk Admin',
          email: data.email || 'sarah.mitchell@vettrack.com',
          phone: data.phone || '(555) 201-4400',
          photo_url: data.avatar_url || '',
          shift: '8:00 AM – 5:00 PM',
          since: 'Jan 2022',
        });
      }
      setProfileLoading(false);

      // PTO / Sick allowance from staff record
      if (staffRes.data) {
        setPtoAllowance(staffRes.data.pto_allowance ?? 20);
        setSickAllowance(staffRes.data.sick_allowance ?? 10);
      }

      // Tasks
      if (tasksRes.data) {
        setTasks(tasksRes.data.map((t: any) => {
          const petName = t.pet?.name || '';
          const clientName = t.client ? `${t.client.first_name} ${t.client.last_name}`.trim() : '';
          const parts: string[] = [t.type];
          if (petName) parts.push(petName);
          else if (clientName) parts.push(clientName);
          const label = parts.join(' — ') + (t.doctor_notes ? ` · ${t.doctor_notes}` : '');
          return { id: t.id, text: label, done: t.status === 'Completed', priority: (t.priority === 'Urgent' || t.priority === 'High') ? 'high' as const : 'normal' as const };
        }));
      }
      setTasksLoading(false);

      // Today's check-ins
      if (checkinsRes.data) {
        const statusColorMap: Record<string, string> = {
          'Completed': '#22c55e', 'In Progress': '#3B82F6', 'Confirmed': '#8B5CF6',
          'Scheduled': '#8B5CF6', 'Cancelled': '#6B7280', 'No Show': '#d4183d',
        };
        setTodayCheckins(checkinsRes.data.map((a: any) => {
          const dt = new Date(a.scheduled_at);
          return {
            time: dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
            pet: a.pets?.name || 'Unknown',
            owner: `${a.pets?.clients?.first_name || ''} ${a.pets?.clients?.last_name || ''}`.trim() || 'Unknown',
            service: a.services?.name || a.reason || 'Appointment',
            status: a.status || 'Scheduled',
            color: statusColorMap[a.status] || '#8B5CF6',
            apptId: a.id,
          };
        }));
      }

      // Recent activity (combine payments + appts + clients)
      const activities: ActivityRow[] = [];
      if (paymentsRes.data) {
        for (const p of paymentsRes.data as any[]) {
          const client = p.invoices?.clients;
          const petName = client?.pets?.[0]?.name || '';
          const clientName = `${client?.first_name || ''} ${client?.last_name || ''}`.trim();
          const dt = new Date(p.paid_at);
          activities.push({ icon: CreditCard, color: '#22c55e', text: 'Payment processed', sub: `${petName || clientName} · $${Number(p.amount).toFixed(2)}`, time: formatActivityTime(dt), link: '/admin/payments' });
        }
      }
      if (apptsRes.data) {
        for (const a of apptsRes.data as any[]) {
          const petName = a.pets?.name || '';
          const dt = new Date(a.scheduled_at);
          const timeStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          if (a.status === 'Cancelled') {
            activities.push({ icon: CalendarCheck, color: '#06B6D4', text: 'Cancellation processed', sub: `${petName} · ${dateStr}`, time: formatActivityTime(dt), link: '/admin/bookings' });
          } else {
            activities.push({ icon: CalendarCheck, color: '#3B82F6', text: `Appointment ${a.status.toLowerCase()}`, sub: `${petName} · ${dateStr}, ${timeStr}`, time: formatActivityTime(dt), link: '/admin/bookings' });
          }
        }
      }
      if (newClientsRes.data) {
        for (const c of newClientsRes.data as any[]) {
          const dt = new Date(c.created_at);
          const petCount = c.pets?.length || 0;
          activities.push({ icon: Users, color: '#F4A261', text: 'New client registered', sub: `${c.first_name} ${c.last_name} · ${petCount} pet${petCount !== 1 ? 's' : ''}`, time: formatActivityTime(dt), link: `/admin/clients/${c.id}` });
        }
      }
      setRecentActivity(activities.slice(0, 6));

      // Time blocks
      if (timeBlocksRes.data && timeBlocksRes.data.length > 0) {
        const from12 = (t24: string) => {
          if (!t24) return '8:00 AM';
          let [h, m] = t24.split(':').map(Number);
          const ap = h >= 12 ? 'PM' : 'AM';
          if (h > 12) h -= 12; if (h === 0) h = 12;
          return `${h}:${m.toString().padStart(2, '0')} ${ap}`;
        };
        setTimeBlocks(timeBlocksRes.data.map((b: any, i: number) => ({
          id: i + 1,
          dbId: b.id,
          type: b.type as BlockType,
          date: b.date,
          timeStart: from12(b.time_start),
          timeEnd: from12(b.time_end),
          notes: b.notes || '',
          status: (b.status || 'Confirmed') as BlockStatus,
        })));
        setNextBlockId(timeBlocksRes.data.length + 1);
      }
    })();
  }, [user]);

  // Listen for profile changes from settings pages → update admin profile card instantly
  useEffect(() => {
    const handleProfileChanged = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (!d) return;
      setAdminProfile(prev => ({
        ...prev,
        name: (d.firstName && d.lastName) ? `${d.firstName} ${d.lastName}` : prev.name,
        email: d.email ?? prev.email,
        phone: d.phone ?? prev.phone,
      }));
    };
    const handlePhotoChanged = (e: Event) => {
      const d = (e as CustomEvent).detail;
      const url = d?.photo_url ?? d?.avatar_url ?? '';
      setAdminProfile(prev => ({ ...prev, photo_url: url }));
    };
    window.addEventListener('adminProfileChanged', handleProfileChanged);
    window.addEventListener('adminPhotoChanged', handlePhotoChanged);
    return () => {
      window.removeEventListener('adminProfileChanged', handleProfileChanged);
      window.removeEventListener('adminPhotoChanged', handlePhotoChanged);
    };
  }, []);

  // ─── Tasks (Supabase) ────────────────────────────────────────
  const loadTasks = useCallback(async () => {
    try {
      const { organizationId } = await getOrgContext();
      const { data } = await db
        .from('tasks')
        .select('id, type, priority, status, due_date, doctor_notes, pet:pets!tasks_pet_org_fkey(name), client:clients!tasks_client_org_fkey(first_name, last_name)')
        .eq('organization_id', organizationId)
        .order('due_date', { ascending: true })
        .limit(10);
      if (data) {
        setTasks(data.map((t: any) => {
          const petName = t.pet?.name || '';
          const clientName = t.client ? `${t.client.first_name} ${t.client.last_name}`.trim() : '';
          const parts: string[] = [t.type];
          if (petName) parts.push(petName);
          else if (clientName) parts.push(clientName);
          const label = parts.join(' — ') + (t.doctor_notes ? ` · ${t.doctor_notes}` : '');
          return {
            id: t.id,
            text: label,
            done: t.status === 'Completed',
            priority: (t.priority === 'Urgent' || t.priority === 'High') ? 'high' as const : 'normal' as const,
          };
        }));
      }
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  // ─── Dashboard Stats (Supabase) ──────────────────────────────
  const dashStats = useDashboardStats();

  const dayLabels = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }), []);

  const buildSparkData = useCallback((current: number, growth: boolean) => {
    if (current === 0) return Array(7).fill(0);
    if (!growth) {
      return Array.from({ length: 7 }, (_, i) => {
        const t = i / 6;
        return Math.round(current * (0.3 + t * 0.7 + Math.sin(t * Math.PI) * 0.15));
      });
    }
    return Array.from({ length: 7 }, (_, i) => {
      const t = i / 6;
      return Math.round(current * (0.55 + t * 0.45 + Math.sin(t * Math.PI * 0.8) * 0.12));
    });
  }, []);

  const glowCards = useMemo<GlowCardDef[]>(() => {
    const apptData = buildSparkData(dashStats.appointmentsToday, true);
    apptData[apptData.length - 1] = dashStats.appointmentsToday;
    const clientData = buildSparkData(dashStats.totalClients, true);
    clientData[clientData.length - 1] = dashStats.totalClients;
    const petData = buildSparkData(dashStats.activePets, true);
    petData[petData.length - 1] = dashStats.activePets;
    const vaccData = buildSparkData(dashStats.vaccinesDueThisWeek, false);
    vaccData[vaccData.length - 1] = dashStats.vaccinesDueThisWeek;

    const pctChange = (current: number, previous: number): { label: string; positive: boolean } => {
      if (previous === 0) return current > 0 ? { label: '+100%', positive: true } : { label: 'No change', positive: true };
      const pct = Math.round(((current - previous) / previous) * 100);
      if (pct === 0) return { label: 'No change', positive: true };
      return { label: `${pct > 0 ? '+' : ''}${pct}%`, positive: pct > 0 };
    };

    const apptTrend = pctChange(dashStats.appointmentsToday, dashStats.appointmentsYesterday);
    const clientTrend = pctChange(dashStats.totalClients, dashStats.clientsLastMonth);
    const petTrend = pctChange(dashStats.activePets, dashStats.petsLastMonth);
    const vaccTrend = pctChange(dashStats.vaccinesDueThisWeek, dashStats.vaccinesLastWeek);

    return [
      {
        title: "Today's Check-ins", subtitle: 'Appointments',
        metricLabel: 'Scheduled Today', value: String(dashStats.appointmentsToday),
        trendLabel: `${apptTrend.label} vs yesterday`, trendPositive: apptTrend.positive,
        color: '#4ADE80', shadowColor: 'rgba(74,222,128,0.35)',
        icon: CalendarCheck,
        data: apptData, labels: dayLabels, unit: 'appts',
        annotationStart: apptData[0].toLocaleString(), annotationEnd: String(dashStats.appointmentsToday),
        path: '/admin/bookings',
      },
      {
        title: 'Total Clients', subtitle: 'All Time',
        metricLabel: 'Registered Clients', value: String(dashStats.totalClients),
        trendLabel: `${clientTrend.label} vs last month`, trendPositive: clientTrend.positive,
        color: '#38BDF8', shadowColor: 'rgba(56,189,248,0.35)',
        icon: Users,
        data: clientData, labels: dayLabels, unit: 'clients',
        annotationStart: clientData[0].toLocaleString(), annotationEnd: String(dashStats.totalClients),
        path: '/admin/clients',
      },
      {
        title: 'Active Pets', subtitle: 'Registered',
        metricLabel: 'Total Active', value: String(dashStats.activePets),
        trendLabel: `${petTrend.label} vs last month`, trendPositive: petTrend.positive,
        color: '#818CF8', shadowColor: 'rgba(129,140,248,0.35)',
        icon: PawPrint,
        data: petData, labels: dayLabels, unit: 'pets',
        annotationStart: petData[0].toLocaleString(), annotationEnd: String(dashStats.activePets),
        path: '/admin/clients',
      },
      {
        title: 'Vaccines Due', subtitle: 'This Week',
        metricLabel: 'Due Within 7 Days', value: String(dashStats.vaccinesDueThisWeek),
        trendLabel: `${vaccTrend.label} vs last week`, trendPositive: !vaccTrend.positive,
        color: '#FB7185', shadowColor: 'rgba(251,113,133,0.35)',
        icon: Clock,
        data: vaccData, labels: dayLabels, unit: 'vaccines',
        annotationStart: vaccData[0].toLocaleString(), annotationEnd: String(dashStats.vaccinesDueThisWeek),
        path: '/admin/bookings',
      },
    ];
  }, [dashStats, dayLabels, buildSparkData]);

  // ─── Today's Check-ins (Supabase) ──────────────────────────
  interface CheckInRow { time: string; pet: string; owner: string; service: string; status: string; color: string; apptId: string; }
  const [todayCheckins, setTodayCheckins] = useState<CheckInRow[]>([]);


  // ─── Recent Activity (Supabase) ────────────────────────────
  interface ActivityRow { icon: React.ElementType; color: string; text: string; sub: string; time: string; link: string; }
  const [recentActivity, setRecentActivity] = useState<ActivityRow[]>([]);

  // Schedule + PTO state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockType, setBlockType] = useState<BlockType>('Lunch Break');
  const [blockDateFrom, setBlockDateFrom] = useState('2026-03-15');
  const [blockDateTo, setBlockDateTo] = useState('2026-03-15');
  const [blockTimeStart, setBlockTimeStart] = useState('12:00');
  const [blockTimeEnd, setBlockTimeEnd] = useState('13:00');
  const [blockNotes, setBlockNotes] = useState('');
  const [nextBlockId, setNextBlockId] = useState(10);
  const [workHoursDialogOpen, setWorkHoursDialogOpen] = useState(false);
  const [workSchedule, setWorkSchedule] = useState<WorkSchedule>(DEFAULT_WORK_SCHEDULE);

  async function toggleTask(id: string) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const newDone = !task.done;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: newDone } : t));
    try {
      const { organizationId } = await getOrgContext();
      await db.from('tasks').update({
        status: newDone ? 'Completed' : 'Pending',
        completed_at: newDone ? new Date().toLocaleString() : null,
      }).eq('id', id).eq('organization_id', organizationId);
    } catch (err) {
      console.error('Failed to toggle task:', err);
      setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !newDone } : t));
    }
  }
  async function addTask() {
    if (!newTask.trim()) return;
    try {
      const { organizationId } = await getOrgContext();
      const { data, error } = await db.from('tasks').insert({
        organization_id: organizationId,
        type: 'General',
        priority: 'Normal',
        status: 'Pending',
        due_date: new Date().toISOString().split('T')[0],
        doctor_notes: newTask.trim(),
      }).select('id').single();
      if (error) throw error;
      if (data) {
        setTasks(prev => [...prev, { id: data.id, text: `General · ${newTask.trim()}`, done: false, priority: 'normal' }]);
      }
      setNewTask('');
    } catch (err) {
      console.error('Failed to add task:', err);
    }
  }
  async function removeTask(id: string) {
    const removed = tasks.find(t => t.id === id);
    setTasks(prev => prev.filter(t => t.id !== id));
    try {
      const { organizationId } = await getOrgContext();
      await db.from('tasks').delete().eq('id', id).eq('organization_id', organizationId);
    } catch (err) {
      console.error('Failed to remove task:', err);
      if (removed) setTasks(prev => [...prev, removed]);
    }
  }

  const pending = tasks.filter(t => !t.done);
  const done    = tasks.filter(t => t.done);

  // Schedule computed values
  const dayBlocks = timeBlocks.filter((b) => isSameDay(b.date, selectedDate) && b.status !== 'Denied');
  const blockByTime = new Map(dayBlocks.map((b) => [b.timeStart, b]));
  const eventDates = new Set<string>(timeBlocks.filter(b => b.status !== 'Denied').map(b => b.date));
  const datesWithEvents = Array.from(eventDates).map((d) => new Date(d + 'T12:00:00'));

  // Derive today's shift from work schedule
  const todayDayKey = (['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] as const)[new Date().getDay()] as WorkDay;
  const todaySchedule = workSchedule[todayDayKey];
  const todayShift = todaySchedule.enabled
    ? (() => {
        const fmt = (t: string) => { const [h, m] = t.split(':').map(Number); const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h; return `${h12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
        return `${fmt(todaySchedule.start)} – ${fmt(todaySchedule.end)}`;
      })()
    : 'Day Off';

  const goToPrevDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d); };
  const goToNextDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d); };
  const goToToday = () => setSelectedDate(new Date());

  const openBlockDialog = (type: BlockType, startH = '12:00', endH = '13:00') => {
    setBlockType(type);
    const ds = dateToStr(selectedDate);
    setBlockDateFrom(ds); setBlockDateTo(ds);
    setBlockTimeStart(startH); setBlockTimeEnd(endH);
    setBlockNotes(''); setBlockDialogOpen(true);
  };

  const handleCancelPtoGroup = async (blocks: TimeBlock[]) => {
    if (!blocks.length) return;
    const blockIds = new Set(blocks.map((b) => b.id));
    setTimeBlocks((prev) => prev.filter((b) => !blockIds.has(b.id)));
    const dbIds = blocks.map((b) => b.dbId).filter(Boolean) as string[];
    if (dbIds.length) {
      db.from('staff_time_blocks').delete().in('id', dbIds).then(({ error }) => {
        if (error) console.warn('PTO group delete error:', error.message);
      });
    }
    if (user?.id) {
      const ptoType = blocks[0].type === 'PTO' ? 'pto' : 'shift_swap';
      const firstDateStr = new Date(blocks[0].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      db.from('pending_requests').delete()
        .eq('requester_id', user.id)
        .eq('type', ptoType)
        .eq('status', 'pending')
        .ilike('detail', `%${firstDateStr}%`)
        .then(({ error }) => {
          if (error) console.warn('Pending request delete error:', error.message);
        });
    }
  };

  const handleSaveBlock = async () => {
    const from12 = (t24: string) => {
      let [h, m] = t24.split(':').map(Number);
      const ap = h >= 12 ? 'PM' : 'AM';
      if (h > 12) h -= 12; if (h === 0) h = 12;
      return `${h}:${m.toString().padStart(2, '0')} ${ap}`;
    };
    const isRequest = blockType === 'PTO' || blockType === 'Sick Day';
    const start = new Date(blockDateFrom + 'T12:00:00');
    const end = new Date(blockDateTo + 'T12:00:00');
    const newBlocks: TimeBlock[] = [];
    const dbRows: object[] = [];
    let idCounter = nextBlockId;
    const orgCtx = await getOrgContext();
    const cursor = new Date(start);
    while (cursor <= end) {
      const dateStr = dateToStr(cursor);
      newBlocks.push({ id: idCounter++, type: blockType, date: dateStr,
        timeStart: from12(blockTimeStart), timeEnd: from12(blockTimeEnd),
        notes: blockNotes, status: isRequest ? 'Pending' : 'Confirmed' });
      dbRows.push({
        organization_id: orgCtx.organizationId,
        clinic_id: orgCtx.clinicId,
        staff_id: user?.id || null,
        type: blockType,
        date: dateStr,
        time_start: blockTimeStart || null,
        time_end: blockTimeEnd || null,
        notes: blockNotes || null,
        status: isRequest ? 'Pending' : 'Confirmed',
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    // Save to Supabase
    const { data: inserted, error } = await db.from('staff_time_blocks').insert(dbRows).select('id');
    if (error) {
      console.warn('Block save error:', error.message);
    } else if (inserted) {
      inserted.forEach((row: any, i: number) => {
        if (newBlocks[i]) newBlocks[i].dbId = row.id;
      });
    }
    // If PTO or Sick Day, create a pending_request for Super Admin
    if (isRequest) {
      const initials = ADMIN_PROFILE.name.split(' ').map(w => w[0]?.toUpperCase() || '').join('').slice(0, 2);
      const dateRange = blockDateFrom === blockDateTo
        ? new Date(blockDateFrom + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : `${new Date(blockDateFrom + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${new Date(blockDateTo + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      const dayCount = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
      await db.from('pending_requests').insert({
        organization_id: orgCtx.organizationId,
        type: blockType === 'PTO' ? 'pto' : 'shift_swap',
        avatar: initials,
        avatar_color: blockType === 'PTO' ? '#3B82F6' : '#d4183d',
        title: `${ADMIN_PROFILE.name} — ${blockType}`,
        detail: `Requesting ${blockType.toLowerCase()} ${dateRange} (${dayCount} day${dayCount > 1 ? 's' : ''})${blockNotes ? ' — ' + blockNotes : ''}`,
        meta: `Submitted just now · ${ADMIN_PROFILE.role}`,
        status: 'pending',
        requester_id: user?.id || null,
      });
    }
    setTimeBlocks((prev) => [...prev, ...newBlocks]);
    setNextBlockId(idCounter);
    setBlockDialogOpen(false);
  };

  const PTO_ALLOWANCE = ptoAllowance;
  const SICK_ALLOWANCE = sickAllowance;
  const ptoRequests = timeBlocks.filter((b) => b.type === 'PTO' || b.type === 'Sick Day');
  const ptoUsed = timeBlocks.filter((b) => b.type === 'PTO' && (b.status === 'Approved' || b.status === 'Confirmed')).length;
  const sickUsed = timeBlocks.filter((b) => b.type === 'Sick Day' && (b.status === 'Approved' || b.status === 'Confirmed')).length;
  const ptoPending = ptoRequests.filter((b) => b.status === 'Pending').length;
  const ptoLeft = PTO_ALLOWANCE - ptoUsed;
  const sickLeft = SICK_ALLOWANCE - sickUsed;

  // Group consecutive PTO/Sick Day blocks into single request ranges (deduplicate first)
  const groupedRequests = (() => {
    // Deduplicate: keep one block per unique date+type+status
    const seen = new Set<string>();
    const deduped = ptoRequests.filter((b) => {
      const key = `${b.date}-${b.type}-${b.status}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const sorted = [...deduped].sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      if (a.status !== b.status) return a.status.localeCompare(b.status);
      return a.date.localeCompare(b.date);
    });
    const groups: { type: BlockType; status: string; dateFrom: string; dateTo: string; days: number; blocks: typeof sorted }[] = [];
    for (const block of sorted) {
      const last = groups[groups.length - 1];
      if (last && last.type === block.type && last.status === block.status) {
        const prev = new Date(last.dateTo + 'T12:00:00');
        prev.setDate(prev.getDate() + 1);
        if (dateToStr(prev) === block.date) {
          last.dateTo = block.date;
          last.days += 1;
          last.blocks.push(block);
          continue;
        }
      }
      groups.push({ type: block.type, status: block.status, dateFrom: block.date, dateTo: block.date, days: 1, blocks: [block] });
    }
    return groups;
  })();

  if (profileLoading) {
    return (
      <div className="max-w-[1440px] mx-auto p-8 flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-[var(--border-color)] border-t-[var(--brand-green-text)] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Loading portal…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto p-8">

      {/* ── Profile Header (same style as Dr portal) ── */}
      <div
        className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-8 overflow-hidden"
        style={{ borderRadius: '12px', borderTop: '4px solid var(--brand-green-text)' }}
      >
        <div className="flex items-center gap-6">
          {/* Avatar with camera overlay */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {(() => {
              const initials = ADMIN_PROFILE.name.split(' ').map(w => w[0]).join('').substring(0, 2);
              return ADMIN_PROFILE.photo_url ? (
                <img src={ADMIN_PROFILE.photo_url} alt={ADMIN_PROFILE.name} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #3B82F6, #6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff' }}>
                  {initials}
                </div>
              );
            })()}
            <button
              title="Change photo"
              onClick={() => navigate('/admin/settings')}
              style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: '50%', backgroundColor: 'var(--brand-green-text)', border: '2px solid var(--surface-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <Camera style={{ width: 11, height: 11, color: 'var(--on-brand-green)' }} />
            </button>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-[var(--text-primary)]" style={{ fontSize: '26px', fontWeight: 700 }}>{ADMIN_PROFILE.name}</h1>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 9%, transparent)', color: 'var(--brand-green-text)', padding: '3px 10px', borderRadius: 999 }}>Admin</span>
            </div>
            <p className="text-[var(--brand-green-text)]" style={{ fontSize: '15px', fontWeight: 600, marginBottom: 4 }}>
              {ADMIN_PROFILE.role} · Since {ADMIN_PROFILE.since}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[var(--text-secondary)] flex items-center gap-1" style={{ fontSize: '13px' }}>
                <Mail style={{ width: 12, height: 12 }} /> {ADMIN_PROFILE.email}
              </span>
              <span className="text-[var(--border-color)]">|</span>
              <span className="text-[var(--text-secondary)] flex items-center gap-1" style={{ fontSize: '13px' }}>
                <Phone style={{ width: 12, height: 12 }} /> {ADMIN_PROFILE.phone}
              </span>
              <span className="text-[var(--border-color)]">|</span>
              <span className="text-[var(--text-secondary)] flex items-center gap-1" style={{ fontSize: '13px' }}>
                <Clock style={{ width: 12, height: 12 }} /> Shift: {todayShift}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Glow Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 20, marginBottom: 24 }}>
        {glowCards.map(card => <GlowStatCard key={card.title} {...card} />)}
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 12, marginBottom: 24 }}>
        {QUICK_ACTIONS.map(a => {
          const Icon = a.icon;
          return (
            <button key={a.label} onClick={() => {
              if (a.label === 'Add Client') setAddClientOpen(true);
              else if (a.label === 'New Booking') navigate(a.path, { state: { openNewAppt: true } });
              else navigate(a.path);
            }}
              className="bg-[var(--surface-white)] border border-[var(--border-color)] rounded-xl hover:border-[var(--brand-green-text)] transition-colors"
              style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: `${a.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon style={{ width: 18, height: 18, color: a.color }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{a.label}</span>
              <ArrowRight style={{ width: 15, height: 15, color: 'var(--text-secondary)', flexShrink: 0 }} />
            </button>
          );
        })}
      </div>

      {/* ── Schedule Section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 mb-6" style={{ alignItems: 'start' }}>

        {/* Left: Day Schedule */}
        <div>
          {/* Date Nav */}
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-4 mb-4 flex flex-wrap items-center justify-between gap-3" style={{ borderRadius: '12px' }}>
            <div className="flex items-center gap-2">
              <button onClick={goToPrevDay} className="p-1 hover:bg-[var(--surface-elevated)] transition-colors" style={{ borderRadius: '6px' }}>
                <ChevronLeft style={{ width: 20, height: 20, color: 'var(--text-secondary)' }} />
              </button>
              <CalendarCheck style={{ width: 20, height: 20, color: 'var(--brand-green-text)' }} />
              <h2 className="text-[var(--text-primary)] whitespace-nowrap" style={{ fontSize: '18px', fontWeight: 600 }}>
                {isToday(selectedDate) ? 'Today, ' : ''}{formatDate(selectedDate)}
              </h2>
              <button onClick={goToNextDay} className="p-1 hover:bg-[var(--surface-elevated)] transition-colors" style={{ borderRadius: '6px' }}>
                <ChevronRightIcon style={{ width: 20, height: 20, color: 'var(--text-secondary)' }} />
              </button>
              {!isToday(selectedDate) && (
                <button onClick={goToToday} className="ml-2 px-3 py-1 text-[var(--brand-green-text)] border border-[var(--brand-green-text)] hover:bg-[color-mix(in_srgb,var(--brand-green-text)_6%,transparent)] transition-colors" style={{ borderRadius: '6px', fontSize: '13px', fontWeight: 500 }}>
                  Today
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{dayBlocks.length} blocks</span>
              <Button size="sm" variant="outline" onClick={() => setWorkHoursDialogOpen(true)}>
                <Pencil style={{ width: 14, height: 14 }} /> Work Hours
              </Button>
              <Button size="sm" onClick={() => openBlockDialog('Work Hours')}>
                <Plus style={{ width: 16, height: 16 }} /> Block Time
              </Button>
            </div>
          </div>

          {/* Time Slot Grid */}
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] overflow-hidden" style={{ borderRadius: '12px' }}>
            <div style={{ maxHeight: '796px', overflowY: 'auto' }}>
            {(() => {
              // Determine working hours for the selected date
              const selDayKey = (['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] as const)[selectedDate.getDay()] as WorkDay;
              const selDaySchedule = workSchedule[selDayKey];
              const isDayOff = !selDaySchedule.enabled;
              const shiftStart24 = selDaySchedule.start || '08:00';
              const shiftEnd24 = selDaySchedule.end || '17:00';
              return SCHEDULE_SLOTS.map((slot, idx) => {
              const block = blockByTime.get(slot);
              const isLast = idx === SCHEDULE_SLOTS.length - 1;
              const slot24 = to24Hour(slot);
              const inShift = !isDayOff && slot24 >= shiftStart24 && slot24 < shiftEnd24;
              // Green border only on slots with actual blocks; available slots stay clean
              const slotBorder = (inShift && block) ? '3px solid var(--brand-green-text)' : '3px solid transparent';
              const slotOpacity = inShift ? 1 : 0.5;
              return (
                <div key={slot} className={`flex items-stretch ${!isLast ? 'border-b border-[var(--border-color)]' : ''}`}
                  style={{ borderLeft: slotBorder, opacity: slotOpacity }}>
                  <div className="w-24 flex-shrink-0 px-3 py-3 flex items-center justify-end">
                    <span style={{ fontSize: '13px', color: inShift ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: inShift ? 600 : 500 }}>{slot}</span>
                  </div>
                  {block ? (
                    <div className="flex-1 m-1 px-3 py-2.5 flex items-center gap-3"
                      style={{ backgroundColor: blockStyles[block.type].bg, borderLeft: `4px solid ${blockStyles[block.type].border}`, borderRadius: '8px' }}>
                      {(() => { const Icon = blockStyles[block.type].icon; return <Icon style={{ width: 16, height: 16, flexShrink: 0, color: blockStyles[block.type].text }} />; })()}
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: '14px', fontWeight: 600, color: blockStyles[block.type].text, margin: 0 }}>{block.type}</p>
                        {block.notes && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>{block.notes}</p>}
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{block.timeStart} – {block.timeEnd}</span>
                    </div>
                  ) : (
                    <div className="flex-1 m-1 px-3 py-3 cursor-pointer hover:bg-[var(--surface-elevated)] transition-colors flex items-center" style={{ borderRadius: '8px' }}
                      onClick={() => {
                        const t24 = to24Hour(slot);
                        const [sh, sm] = t24.split(':').map(Number);
                        const eh = sm === 30 ? sh + 1 : sh;
                        const em = sm === 30 ? 0 : 30;
                        openBlockDialog('Work Hours', t24, `${eh.toString().padStart(2, '0')}:${em.toString().padStart(2, '0')}`);
                      }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Available</span>
                    </div>
                  )}
                </div>
              );
            });
            })()}
            </div>
          </div>
        </div>

        {/* Right: Mini Calendar + Time Off */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignSelf: 'stretch' }}>
          {/* Mini Calendar */}
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-4" style={{ borderRadius: '12px' }}>
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                onSelect={(date) => { if (date) { setSelectedDate(date); setCalendarMonth(date); } }}
                modifiers={{ hasEvent: datesWithEvents }}
                modifiersStyles={{
                  hasEvent: { fontWeight: 700, textDecoration: 'underline', textDecorationColor: 'var(--brand-green-text)', textUnderlineOffset: '4px' },
                }}
              />
            </div>
            {(calendarMonth.getMonth() !== new Date().getMonth() || calendarMonth.getFullYear() !== new Date().getFullYear()) && (
              <button
                onClick={() => { const t = new Date(); setSelectedDate(t); setCalendarMonth(t); }}
                className="w-full mt-2 py-1.5 text-center transition-colors hover:bg-[color-mix(in_srgb,var(--brand-green-text)_6%,transparent)]"
                style={{
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--brand-green-text)',
                  border: '1px solid var(--brand-green-text)',
                }}
              >
                <ChevronLeft className="w-3.5 h-3.5 inline -ml-0.5 mr-0.5" />
                Back to Today
              </button>
            )}
          </div>

          {/* Time Off Summary */}
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-5" style={{ borderRadius: '12px', flex: 1 }}>
            <h3 className="text-[var(--text-primary)] mb-4" style={{ fontSize: '16px', fontWeight: 600 }}>Time Off</h3>

            <div className="space-y-3 mb-4">
              {/* PTO */}
              <div className="p-3 border border-[var(--border-color)]" style={{ borderRadius: '10px' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Palmtree style={{ width: 16, height: 16, color: '#1D4ED8' }} />
                    <span className="text-[var(--text-primary)]" style={{ fontSize: '13px', fontWeight: 600 }}>PTO</span>
                  </div>
                  <span className="text-[var(--text-primary)]" style={{ fontSize: '15px', fontWeight: 700 }}>
                    {ptoLeft} <span className="text-[var(--text-secondary)]" style={{ fontSize: '11px', fontWeight: 400 }}>/ {PTO_ALLOWANCE} days left</span>
                  </span>
                </div>
                <div className="w-full h-2 bg-[var(--border-color)] overflow-hidden" style={{ borderRadius: '9999px' }}>
                  <div className="h-full bg-[#3B82F6] transition-all" style={{ width: `${(ptoUsed / PTO_ALLOWANCE) * 100}%`, borderRadius: '9999px' }} />
                </div>
                <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '11px' }}>
                  {ptoUsed} used · {groupedRequests.filter(r => r.type === 'PTO' && r.status === 'Pending').length > 0 ? `${groupedRequests.filter(r => r.type === 'PTO' && r.status === 'Pending').length} pending` : 'none pending'}
                </p>
              </div>

              {/* Sick Days */}
              <div className="p-3 border border-[var(--border-color)]" style={{ borderRadius: '10px' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <ThermometerSun style={{ width: 16, height: 16, color: '#d4183d' }} />
                    <span className="text-[var(--text-primary)]" style={{ fontSize: '13px', fontWeight: 600 }}>Sick Days</span>
                  </div>
                  <span className="text-[var(--text-primary)]" style={{ fontSize: '15px', fontWeight: 700 }}>
                    {sickLeft} <span className="text-[var(--text-secondary)]" style={{ fontSize: '11px', fontWeight: 400 }}>/ {SICK_ALLOWANCE} days left</span>
                  </span>
                </div>
                <div className="w-full h-2 bg-[var(--border-color)] overflow-hidden" style={{ borderRadius: '9999px' }}>
                  <div className="h-full bg-[#d4183d] transition-all" style={{ width: `${(sickUsed / SICK_ALLOWANCE) * 100}%`, borderRadius: '9999px' }} />
                </div>
                <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '11px' }}>
                  {sickUsed} used · {groupedRequests.filter(r => r.type === 'Sick Day' && r.status === 'Pending').length > 0 ? `${groupedRequests.filter(r => r.type === 'Sick Day' && r.status === 'Pending').length} pending` : 'none pending'}
                </p>
              </div>
            </div>

            {/* Requests list */}
            <h4 className="text-[var(--text-secondary)] mb-2" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Requests</h4>
            <div className="space-y-2">
              {groupedRequests.map((grp) => {
                const rs = requestStatusStyles[grp.status];
                const StatusIcon = rs.icon;
                const fromDate = new Date(grp.dateFrom + 'T12:00:00');
                const toDate = new Date(grp.dateTo + 'T12:00:00');
                const dateLabel = grp.dateFrom === grp.dateTo
                  ? fromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : `${fromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${toDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                return (
                  <div key={`${grp.type}-${grp.dateFrom}-${grp.id}`} className="flex items-center gap-2 p-2 border border-[var(--border-color)]" style={{ borderRadius: '8px' }}>
                    <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: blockStyles[grp.type].bg, borderRadius: '9999px' }}>
                      {(() => { const I = blockStyles[grp.type].icon; return <I style={{ width: 14, height: 14, color: blockStyles[grp.type].text }} />; })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[var(--text-primary)] truncate" style={{ fontSize: '13px', fontWeight: 600 }}>
                        {grp.type}{grp.days > 1 ? ` (${grp.days} days)` : ''}
                      </p>
                      <p className="text-[var(--text-secondary)]" style={{ fontSize: '11px' }}>{dateLabel}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5" style={{ backgroundColor: rs.bg, color: rs.text, borderRadius: '9999px', fontSize: '11px', fontWeight: 600 }}>
                      <StatusIcon style={{ width: 12, height: 12 }} />
                      {grp.status}
                    </span>
                    {grp.status === 'Pending' && (
                      <button
                        onClick={() => handleCancelPtoGroup(grp.blocks)}
                        className="flex-shrink-0 w-6 h-6 flex items-center justify-center hover:bg-[var(--bg-offwhite)] transition-colors"
                        style={{ borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                        title="Cancel request"
                      >
                        <X className="w-3.5 h-3.5 text-[var(--text-secondary)] hover:text-[#d4183d]" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <Button onClick={() => openBlockDialog('PTO')} className="w-full mt-4 hover:opacity-90" style={{ backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)', border: 'none', gap: '6px' }}>
              <Plus style={{ width: 16, height: 16 }} />
              Request Time Off
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr_1fr_340px]" style={{ gap: 20 }}>

        {/* Tasks */}
        <div className="bg-[var(--surface-white)] border border-[var(--border-color)] rounded-xl overflow-hidden">
          <div className="border-b border-[var(--border-color)] flex items-center justify-between" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardList style={{ width: 16, height: 16, color: 'var(--brand-green-text)' }} />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>My Tasks</h3>
              {pending.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, backgroundColor: '#d4183d15', color: '#d4183d', borderRadius: 999, padding: '2px 7px' }}>{pending.length} pending</span>
              )}
            </div>
          </div>
          <div style={{ padding: '12px 14px 8px' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <Input placeholder="Add a task..." value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addTask(); }} style={{ fontSize: 13, height: 34 }} />
              <button onClick={addTask} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, color: 'var(--text-secondary)' }}>
                <Plus style={{ width: 15, height: 15 }} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
              {pending.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, backgroundColor: t.priority === 'high' ? 'rgba(212,24,61,0.04)' : 'transparent', border: t.priority === 'high' ? '1px solid rgba(212,24,61,0.12)' : '1px solid transparent' }}>
                  <button onClick={() => toggleTask(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, color: 'var(--text-secondary)', display: 'flex' }}><Circle style={{ width: 17, height: 17 }} /></button>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>{t.text}</span>
                  {t.priority === 'high' && <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#d4183d', backgroundColor: '#d4183d15', borderRadius: 4, padding: '2px 5px', flexShrink: 0 }}>urgent</span>}
                  <button onClick={() => removeTask(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, color: 'var(--text-secondary)', display: 'flex', opacity: 0.5 }}><X style={{ width: 13, height: 13 }} /></button>
                </div>
              ))}
              {done.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', padding: '4px 10px', margin: 0 }}>Completed ({done.length})</p>
                  {done.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8 }}>
                      <button onClick={() => toggleTask(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, color: '#22c55e', display: 'flex' }}><CheckCircle2 style={{ width: 17, height: 17 }} /></button>
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'line-through', lineHeight: 1.4 }}>{t.text}</span>
                      <button onClick={() => removeTask(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, color: 'var(--text-secondary)', display: 'flex', opacity: 0.4 }}><X style={{ width: 13, height: 13 }} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Today's Check-ins */}
        <div className="bg-[var(--surface-white)] border border-[var(--border-color)] rounded-xl overflow-hidden">
          <div className="border-b border-[var(--border-color)] flex items-center justify-between" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarCheck style={{ width: 16, height: 16, color: 'var(--brand-green-text)' }} />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Today's Check-ins</h3>
            </div>
            <button onClick={() => navigate('/admin/bookings')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>
              View all <ChevronRight style={{ width: 13, height: 13 }} />
            </button>
          </div>
          <div style={{ padding: '8px 0' }}>
            {todayCheckins.length === 0 ? (
              <div style={{ padding: '24px 20px', textAlign: 'center' }}>
                <CalendarCheck style={{ width: 28, height: 28, color: 'var(--text-secondary)', margin: '0 auto 8px', opacity: 0.4 }} />
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>No appointments today</p>
              </div>
            ) : todayCheckins.map((c, i) => (
              <div key={i} onClick={() => navigate('/admin/bookings')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: i < todayCheckins.length - 1 ? '1px solid var(--border-color)' : 'none', cursor: 'pointer', transition: 'background-color 0.15s' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 60, flexShrink: 0 }}>{c.time}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{c.pet} <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>· {c.owner}</span></p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>{c.service}</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: c.color, backgroundColor: `${c.color}15`, borderRadius: 999, padding: '3px 9px', flexShrink: 0, whiteSpace: 'nowrap' }}>{c.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-[var(--surface-white)] border border-[var(--border-color)] rounded-xl overflow-hidden">
          <div className="border-b border-[var(--border-color)]" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap style={{ width: 16, height: 16, color: 'var(--brand-green-text)' }} />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Recent Activity</h3>
            </div>
          </div>
          <div style={{ padding: '8px 0' }}>
            {recentActivity.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                <Zap style={{ width: 28, height: 28, color: 'var(--text-secondary)', margin: '0 auto 8px', opacity: 0.4 }} />
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>No recent activity</p>
              </div>
            ) : recentActivity.map((a, i) => {
              const Icon = a.icon;
              return (
                <div key={i} onClick={() => navigate(a.link)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i < recentActivity.length - 1 ? '1px solid var(--border-color)' : 'none', cursor: 'pointer', transition: 'background-color 0.15s' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: `${a.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon style={{ width: 15, height: 15, color: a.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{a.text}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.sub}</p>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>{a.time}</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Block Time / PTO Request Dialog */}
      {/* ── Work Hours Dialog ── */}
      <Dialog open={workHoursDialogOpen} onOpenChange={setWorkHoursDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil style={{ width: 16, height: 16, color: 'var(--brand-green-text)' }} />
              Edit Work Hours
            </DialogTitle>
          </DialogHeader>
          <p className="text-[var(--text-secondary)]" style={{ fontSize: '13px', marginTop: '-4px', marginBottom: '4px' }}>
            Set your regular working schedule. This is used as your default availability.
          </p>
          <div className="space-y-2 py-2">
            {WORK_DAYS.map((day) => {
              const d = workSchedule[day];
              return (
                <div key={day} className="flex items-center gap-3 p-3 border border-[var(--border-color)]" style={{ borderRadius: '10px', opacity: d.enabled ? 1 : 0.55 }}>
                  {/* Toggle */}
                  <button
                    onClick={() => setWorkSchedule(prev => ({ ...prev, [day]: { ...prev[day], enabled: !prev[day].enabled } }))}
                    style={{
                      width: 36, height: 20, borderRadius: 9999, flexShrink: 0, position: 'relative', cursor: 'pointer', border: 'none',
                      backgroundColor: d.enabled ? 'var(--brand-green-text)' : 'var(--border-color)', transition: 'background-color 0.2s',
                    }}
                  >
                    <div style={{ position: 'absolute', top: 3, left: d.enabled ? 19 : 3, width: 14, height: 14, borderRadius: 9999, backgroundColor: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </button>
                  {/* Day label */}
                  <span style={{ width: 36, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>{day}</span>
                  {/* Time inputs */}
                  {d.enabled ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        type="time" value={d.start} disabled={!d.enabled}
                        onChange={(e) => setWorkSchedule(prev => ({ ...prev, [day]: { ...prev[day], start: e.target.value } }))}
                        style={{ fontSize: '13px', height: 32 }}
                      />
                      <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px', flexShrink: 0 }}>to</span>
                      <Input
                        type="time" value={d.end} disabled={!d.enabled}
                        onChange={(e) => setWorkSchedule(prev => ({ ...prev, [day]: { ...prev[day], end: e.target.value } }))}
                        style={{ fontSize: '13px', height: 32 }}
                      />
                      <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', flexShrink: 0, minWidth: 48 }}>
                        {(() => {
                          const [sh, sm] = d.start.split(':').map(Number);
                          const [eh, em] = d.end.split(':').map(Number);
                          const hrs = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
                          return hrs > 0 ? `${hrs}h` : '';
                        })()}
                      </span>
                    </div>
                  ) : (
                    <span className="flex-1 text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>Day off</span>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkHoursDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => setWorkHoursDialogOpen(false)}>Save Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {blockType === 'PTO' || blockType === 'Sick Day' ? (
                <><Send style={{ width: 16, height: 16, color: 'var(--brand-green-text)' }} /> Request {blockType}</>
              ) : (
                <><Plus style={{ width: 16, height: 16, color: 'var(--brand-green-text)' }} /> Block Time</>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Type</label>
              <Select value={blockType} onValueChange={(v) => setBlockType(v as BlockType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['Work Hours', 'Lunch Break', 'Meeting', 'Personal', 'PTO', 'Sick Day'] as BlockType[]).map((t) => {
                    const s = blockStyles[t];
                    const Icon = s.icon;
                    return (
                      <SelectItem key={t} value={t}>
                        <span className="flex items-center gap-2">
                          <Icon style={{ width: 14, height: 14, color: s.border }} />
                          {t}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>From</label>
                <Input type="date" value={blockDateFrom} onChange={(e) => { setBlockDateFrom(e.target.value); if (e.target.value > blockDateTo) setBlockDateTo(e.target.value); }} />
              </div>
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>To</label>
                <Input type="date" value={blockDateTo} onChange={(e) => setBlockDateTo(e.target.value)} min={blockDateFrom} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Start Time</label>
                <Input type="time" value={blockTimeStart} onChange={(e) => setBlockTimeStart(e.target.value)} />
              </div>
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>End Time</label>
                <Input type="time" value={blockTimeEnd} onChange={(e) => setBlockTimeEnd(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Notes</label>
              <Textarea placeholder="Optional notes..." value={blockNotes} onChange={(e) => setBlockNotes(e.target.value)} className="min-h-16" />
            </div>
            {(blockType === 'PTO' || blockType === 'Sick Day') && (
              <div className="flex items-center gap-2 p-3 bg-[#F4A26110]" style={{ borderRadius: '8px' }}>
                <AlertCircle style={{ width: 16, height: 16, color: '#F4A261', flexShrink: 0 }} />
                <p className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>
                  This will be sent as a request and requires manager approval.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveBlock}>
              {blockType === 'PTO' || blockType === 'Sick Day' ? 'Send Request' : 'Save Block'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddClientDialog open={addClientOpen} onOpenChange={(open) => { setAddClientOpen(open); if (!open) setTimeout(() => { refetchClients(); }, 300); }} onSave={handleAddClient} />

    </div>
  );
}
