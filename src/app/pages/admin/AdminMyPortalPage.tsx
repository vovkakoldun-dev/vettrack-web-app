import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  CheckCircle2, Circle, Plus, X, ArrowRight,
  CreditCard, CalendarCheck, ClipboardList,
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
};

function GlowStatCard({
  title, subtitle, metricLabel, value, trendLabel, trendPositive,
  color, shadowColor, icon: Icon, data, labels, unit, annotationStart, annotationEnd,
}: GlowCardDef) {
  const dark = useDarkMode();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const VW = 320; const VH = 100; const PX = 24; const PY = 18;
  const min = Math.min(...data); const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: PX + (i / (data.length - 1)) * (VW - PX * 2),
    y: VH - PY - ((v - min) / range) * (VH - PY * 2),
  }));
  const linePath = buildSplinePath(pts);
  const first = pts[0]; const last = pts[pts.length - 1];
  const areaPath = linePath + ` L ${last.x} ${VH} L ${first.x} ${VH} Z`;
  const midY = VH / 2;
  const uid = title.replace(/\s+/g, '');

  const cardBg     = dark ? 'linear-gradient(145deg,#0D1B2A 0%,#0A1520 60%,#0D1B2A 100%)' : `linear-gradient(145deg,#ffffff 0%,#f8faff 60%,#ffffff 100%)`;
  const cardBorder = dark ? 'rgba(255,255,255,0.07)' : `${color}28`;
  const cardShadow = dark ? `0 0 0 1px rgba(255,255,255,0.04),0 20px 60px -10px ${shadowColor}` : `0 4px 32px -6px ${shadowColor},0 0 0 1px ${color}18`;
  const cornerGlow = dark ? `${color}18` : `${color}12`;
  const subtitleColor = dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.38)';
  const titleColor    = dark ? 'rgba(255,255,255,0.88)' : '#0F172A';
  const metricLabelColor = dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)';
  const valueColor    = dark ? '#ffffff' : '#0F172A';
  const btnBorder     = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const btnBg         = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const btnIconColor  = dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)';
  const dotHoleFill   = dark ? '#0D1B2A' : '#ffffff';
  const midLineStroke = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const annoStartFill = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  const annoEndFill   = dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)';
  const areaOpacity   = dark ? 0.22 : 0.14;
  const lineWhiteStop = dark ? '#ffffff' : color;
  const lineWhiteOpacity = dark ? 0.9 : 1;
  const glowOpacity1  = dark ? 0.35 : 0.28;
  const glowOpacity2  = dark ? 0.5  : 0.45;

  return (
    <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '18px', overflow: 'hidden', position: 'relative', boxShadow: cardShadow }}>
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
          <button style={{ width: '30px', height: '30px', borderRadius: '8px', border: `1px solid ${btnBorder}`, backgroundColor: btnBg, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
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
          <path d={linePath} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" opacity={glowOpacity1} filter={`url(#bloom-${uid})`} />
          <path d={linePath} fill="none" stroke={color} strokeWidth="5"  strokeLinecap="round" opacity={glowOpacity2} filter={`url(#bloom-${uid})`} />
          <path d={linePath} fill="none" stroke={`url(#line-${uid})`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={first.x} cy={first.y} r="4.5" fill={dotHoleFill} stroke={color} strokeWidth="2" />
          <circle cx={last.x}  cy={last.y}  r="5" fill={color} filter={`url(#bloom-${uid})`} />
          <circle cx={last.x}  cy={last.y}  r="4" fill="#ffffff" opacity="0.9" />
          {annotationStart && <text x={first.x + 8} y={first.y - 9} fill={annoStartFill} fontSize="9.5" fontWeight="700" fontFamily="system-ui">{annotationStart}</text>}
          {annotationEnd   && <text x={last.x  - 8} y={last.y  - 9} fill={annoEndFill}   fontSize="9.5" fontWeight="700" fontFamily="system-ui" textAnchor="end">{annotationEnd}</text>}
          {hoveredIdx !== null && (() => {
            const hx = pts[hoveredIdx].x; const hy = pts[hoveredIdx].y;
            return (<>
              <line x1={hx} y1={0} x2={hx} y2={VH} stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
              <circle cx={hx} cy={hy} r="8" fill={color} opacity="0.18" />
              <circle cx={hx} cy={hy} r="5" fill={color} filter={`url(#bloom-${uid})`} opacity="0.8" />
              <circle cx={hx} cy={hy} r="4" fill={color} />
              <circle cx={hx} cy={hy} r="2" fill="#fff" />
            </>);
          })()}
        </svg>
        {hoveredIdx !== null && (() => {
          const hx = pts[hoveredIdx].x; const hy = pts[hoveredIdx].y;
          const dotFromBottom = VH - hy;
          const tooltipBg = dark ? '#1a2a3a' : '#ffffff';
          const tooltipBorder = `${color}55`;
          const tooltipShadow = dark ? `0 4px 20px rgba(0,0,0,0.5),0 0 12px ${color}30` : `0 4px 20px rgba(0,0,0,0.12),0 0 10px ${color}20`;
          const labelCol = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
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
  type: BlockType;
  date: string; // 'YYYY-MM-DD'
  timeStart: string; // '8:00 AM'
  timeEnd: string;
  notes: string;
  status: BlockStatus;
}

const blockStyles: Record<BlockType, { bg: string; border: string; text: string; icon: React.ElementType }> = {
  'Work Hours':   { bg: '#2D6A4F15', border: 'var(--brand-green-text)', text: 'var(--brand-green-text)', icon: Briefcase },
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
  const now = new Date(2026, 2, 15);
  return date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

// ─── Mock Data ────────────────────────────────────────────────

const ADMIN_PROFILE = {
  name: 'Sarah Mitchell',
  role: 'Front Desk Admin',
  email: 'sarah.mitchell@vettrack.com',
  phone: '(555) 201-4400',
  shift: '8:00 AM – 5:00 PM',
  since: 'Jan 2022',
};

const GLOW_CARDS: GlowCardDef[] = [
  {
    title: 'Check-ins',         subtitle: 'This Week',
    metricLabel: 'Daily Average',
    value: '47',                trendLabel: '+8 vs last week', trendPositive: true,
    color: '#4ADE80',           shadowColor: 'rgba(74,222,128,0.35)',
    icon: CalendarCheck,
    data: [32, 35, 38, 40, 42, 44, 45, 47],
    labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun','Today'],
    unit: 'check-ins',          annotationStart: '32', annotationEnd: '+47',
  },
  {
    title: 'Payments',          subtitle: 'This Month',
    metricLabel: 'Revenue Collected',
    value: '$8.4k',             trendLabel: '+15% vs last month', trendPositive: true,
    color: '#38BDF8',           shadowColor: 'rgba(56,189,248,0.35)',
    icon: DollarSign,
    data: [5800, 6200, 6800, 7100, 7400, 7800, 8100, 8400],
    labels: ['W1','W2','W3','W4','W5','W6','W7','W8'],
    unit: 'USD',                annotationStart: '$5.8k', annotationEnd: '$8.4k',
  },
  {
    title: 'New Clients',       subtitle: 'This Month',
    metricLabel: 'Growth Rate',
    value: '24',                trendLabel: '+6 vs last month', trendPositive: true,
    color: '#818CF8',           shadowColor: 'rgba(129,140,248,0.35)',
    icon: Users,
    data: [12, 14, 15, 16, 18, 19, 22, 24],
    labels: ['Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'],
    unit: 'clients',            annotationStart: '12', annotationEnd: '+24',
  },
  {
    title: 'Response Time',     subtitle: 'Improvement',
    metricLabel: 'Avg. Time to Respond',
    value: '4 min',             trendLabel: '−2 min faster', trendPositive: false,
    color: '#FB7185',           shadowColor: 'rgba(251,113,133,0.35)',
    icon: Clock,
    data: [12, 10, 9, 8, 7, 6, 5, 4],
    labels: ['Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'],
    unit: 'min',                annotationStart: '12m', annotationEnd: '4m',
  },
];

interface Task { id: number; text: string; done: boolean; priority: 'high' | 'normal'; }

const INITIAL_TASKS: Task[] = [
  { id: 1, text: 'Confirm tomorrow\'s appointments via SMS',       done: false, priority: 'high'   },
  { id: 2, text: 'Process outstanding payment — Cooper (Brown)',   done: false, priority: 'high'   },
  { id: 3, text: 'Follow up on Luna\'s prescription refill',       done: false, priority: 'normal' },
  { id: 4, text: 'Update Rocky\'s contact details',                done: false, priority: 'normal' },
  { id: 5, text: 'Send post-visit survey to John Smith',           done: true,  priority: 'normal' },
  { id: 6, text: 'Block Dr. Chen\'s calendar for Mar 20',         done: true,  priority: 'normal' },
];

const TODAY_CHECKINS = [
  { time: '8:00 AM',  pet: 'Max',     owner: 'John Smith',     service: 'Annual Checkup',  status: 'Completed',   color: '#22c55e' },
  { time: '8:30 AM',  pet: 'Luna',    owner: 'Emily Johnson',  service: 'Vaccination',     status: 'Completed',   color: '#22c55e' },
  { time: '9:00 AM',  pet: 'Cooper',  owner: 'Michael Brown',  service: 'Dental Cleaning', status: 'In Progress', color: '#3B82F6' },
  { time: '9:30 AM',  pet: 'Bella',   owner: 'Sarah Williams', service: 'Follow-up',       status: 'Waiting',     color: '#F4A261' },
  { time: '10:00 AM', pet: 'Charlie', owner: 'David Miller',   service: 'Emergency',       status: 'Confirmed',   color: '#8B5CF6' },
  { time: '10:30 AM', pet: 'Rocky',   owner: 'James Wilson',   service: 'Vaccination',     status: 'Confirmed',   color: '#8B5CF6' },
];

const RECENT_ACTIVITY = [
  { icon: CreditCard,    color: '#22c55e', text: 'Payment processed',        sub: 'Max · $145.00',                  time: '9:05 AM'   },
  { icon: CalendarCheck, color: '#3B82F6', text: 'Appointment confirmed',     sub: 'Rocky · Mar 16, 10:30 AM',      time: '8:52 AM'   },
  { icon: MessageSquare, color: '#8B5CF6', text: 'Message sent',              sub: 'Appointment reminder · 6 clients', time: '8:30 AM' },
  { icon: Users,         color: '#F4A261', text: 'New client registered',     sub: 'Patricia Lee · 1 pet',           time: 'Yesterday' },
  { icon: Zap,           color: '#d4183d', text: 'Payment overdue flagged',   sub: 'Cooper · $250.00',               time: 'Yesterday' },
  { icon: CalendarCheck, color: '#06B6D4', text: 'Cancellation processed',    sub: 'Mrs. Patterson · 3:00 PM',       time: 'Yesterday' },
];

const QUICK_ACTIONS = [
  { icon: CreditCard,    label: 'Process Payment', color: '#2D6A4F', path: '/admin/payments'       },
  { icon: CalendarCheck, label: 'New Booking',      color: '#3B82F6', path: '/admin/bookings'       },
  { icon: Users,         label: 'Add Client',       color: '#8B5CF6', path: '/admin/clients'        },
  { icon: MessageSquare, label: 'Send Reminder',    color: '#F4A261', path: '/admin/communications' },
];

// ─── Page ─────────────────────────────────────────────────────

export default function AdminMyPortalPage() {
  const navigate = useNavigate();
  const [tasks, setTasks]   = useState<Task[]>(INITIAL_TASKS);
  const [newTask, setNewTask] = useState('');

  // Schedule + PTO state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(2026, 2, 15));
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>(INITIAL_BLOCKS);
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

  function toggleTask(id: number) { setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t)); }
  function addTask() { if (!newTask.trim()) return; setTasks(prev => [...prev, { id: Date.now(), text: newTask.trim(), done: false, priority: 'normal' }]); setNewTask(''); }
  function removeTask(id: number) { setTasks(prev => prev.filter(t => t.id !== id)); }

  const pending = tasks.filter(t => !t.done);
  const done    = tasks.filter(t => t.done);

  // Schedule computed values
  const dayBlocks = timeBlocks.filter((b) => isSameDay(b.date, selectedDate));
  const blockByTime = new Map(dayBlocks.map((b) => [b.timeStart, b]));
  const eventDates = new Set<string>(timeBlocks.map(b => b.date));
  const datesWithEvents = Array.from(eventDates).map((d) => new Date(d + 'T12:00:00'));

  const goToPrevDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d); };
  const goToNextDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d); };
  const goToToday = () => setSelectedDate(new Date(2026, 2, 15));

  const openBlockDialog = (type: BlockType, startH = '12:00', endH = '13:00') => {
    setBlockType(type);
    const ds = dateToStr(selectedDate);
    setBlockDateFrom(ds); setBlockDateTo(ds);
    setBlockTimeStart(startH); setBlockTimeEnd(endH);
    setBlockNotes(''); setBlockDialogOpen(true);
  };

  const handleSaveBlock = () => {
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
    let idCounter = nextBlockId;
    const cursor = new Date(start);
    while (cursor <= end) {
      newBlocks.push({ id: idCounter++, type: blockType, date: dateToStr(cursor),
        timeStart: from12(blockTimeStart), timeEnd: from12(blockTimeEnd),
        notes: blockNotes, status: isRequest ? 'Pending' : 'Confirmed' });
      cursor.setDate(cursor.getDate() + 1);
    }
    setTimeBlocks((prev) => [...prev, ...newBlocks]);
    setNextBlockId(idCounter);
    setBlockDialogOpen(false);
  };

  const PTO_ALLOWANCE = 20;
  const SICK_ALLOWANCE = 10;
  const ptoRequests = timeBlocks.filter((b) => b.type === 'PTO' || b.type === 'Sick Day');
  const ptoUsed = timeBlocks.filter((b) => b.type === 'PTO' && (b.status === 'Approved' || b.status === 'Confirmed')).length;
  const sickUsed = timeBlocks.filter((b) => b.type === 'Sick Day' && (b.status === 'Approved' || b.status === 'Confirmed')).length;
  const ptoPending = ptoRequests.filter((b) => b.status === 'Pending').length;
  const ptoLeft = PTO_ALLOWANCE - ptoUsed;
  const sickLeft = SICK_ALLOWANCE - sickUsed;

  return (
    <div className="max-w-[1440px] mx-auto p-8">

      {/* ── Profile Header (same style as Dr portal) ── */}
      <div
        className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-8 overflow-hidden"
        style={{ borderRadius: '12px', borderTop: '4px solid #2D6A4F' }}
      >
        <div className="flex items-center gap-6">
          {/* Avatar with camera overlay */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #3B82F6, #6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff' }}>
              SM
            </div>
            <button
              title="Change photo"
              style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: '50%', backgroundColor: '#2D6A4F', border: '2px solid var(--surface-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <Camera style={{ width: 11, height: 11, color: '#fff' }} />
            </button>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-[var(--text-primary)]" style={{ fontSize: '26px', fontWeight: 700 }}>{ADMIN_PROFILE.name}</h1>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', backgroundColor: '#2D6A4F18', color: 'var(--brand-green-text)', padding: '3px 10px', borderRadius: 999 }}>Admin</span>
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
                <Clock style={{ width: 12, height: 12 }} /> Shift: {ADMIN_PROFILE.shift}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Glow Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 24 }}>
        {GLOW_CARDS.map(card => <GlowStatCard key={card.title} {...card} />)}
      </div>

      {/* ── Quick Actions ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {QUICK_ACTIONS.map(a => {
          const Icon = a.icon;
          return (
            <button key={a.label} onClick={() => navigate(a.path)}
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
      <div className="grid gap-6 mb-6" style={{ gridTemplateColumns: '1fr 340px', alignItems: 'start' }}>

        {/* Left: Day Schedule */}
        <div>
          {/* Date Nav */}
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-4 mb-4 flex items-center justify-between" style={{ borderRadius: '12px' }}>
            <div className="flex items-center gap-2">
              <button onClick={goToPrevDay} className="p-1 hover:bg-[var(--surface-elevated)] transition-colors" style={{ borderRadius: '6px' }}>
                <ChevronLeft style={{ width: 20, height: 20, color: 'var(--text-secondary)' }} />
              </button>
              <CalendarCheck style={{ width: 20, height: 20, color: 'var(--brand-green-text)' }} />
              <h2 className="text-[var(--text-primary)]" style={{ fontSize: '18px', fontWeight: 600 }}>
                {isToday(selectedDate) ? 'Today, ' : ''}{formatDate(selectedDate)}
              </h2>
              <button onClick={goToNextDay} className="p-1 hover:bg-[var(--surface-elevated)] transition-colors" style={{ borderRadius: '6px' }}>
                <ChevronRightIcon style={{ width: 20, height: 20, color: 'var(--text-secondary)' }} />
              </button>
              {!isToday(selectedDate) && (
                <button onClick={goToToday} className="ml-2 px-3 py-1 text-[var(--brand-green-text)] border border-[#2D6A4F] hover:bg-[#2D6A4F10] transition-colors" style={{ borderRadius: '6px', fontSize: '13px', fontWeight: 500 }}>
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
            {SCHEDULE_SLOTS.map((slot, idx) => {
              const block = blockByTime.get(slot);
              const isLast = idx === SCHEDULE_SLOTS.length - 1;
              return (
                <div key={slot} className={`flex items-stretch ${!isLast ? 'border-b border-[var(--border-color)]' : ''}`}>
                  <div className="w-24 flex-shrink-0 px-3 py-3 flex items-center justify-end">
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>{slot}</span>
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
            })}
            </div>
          </div>
        </div>

        {/* Right: Mini Calendar + Time Off */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignSelf: 'stretch' }}>
          {/* Mini Calendar */}
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-4 flex justify-center" style={{ borderRadius: '12px' }}>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              modifiers={{ hasEvent: datesWithEvents }}
              modifiersStyles={{ hasEvent: { fontWeight: 700, textDecoration: 'underline', textDecorationColor: 'var(--brand-green-text)', textUnderlineOffset: '4px' } }}
            />
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
                  {ptoUsed} used · {ptoRequests.filter(r => r.type === 'PTO' && r.status === 'Pending').length > 0 ? `${ptoRequests.filter(r => r.type === 'PTO' && r.status === 'Pending').length} pending` : 'none pending'}
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
                  {sickUsed} used · {ptoRequests.filter(r => r.type === 'Sick Day' && r.status === 'Pending').length > 0 ? `${ptoRequests.filter(r => r.type === 'Sick Day' && r.status === 'Pending').length} pending` : 'none pending'}
                </p>
              </div>
            </div>

            {/* Requests list */}
            <h4 className="text-[var(--text-secondary)] mb-2" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Requests</h4>
            <div className="space-y-2">
              {ptoRequests.map((req) => {
                const rs = requestStatusStyles[req.status];
                const StatusIcon = rs.icon;
                const d = new Date(req.date + 'T12:00:00');
                return (
                  <div key={req.id} className="flex items-center gap-2 p-2 border border-[var(--border-color)]" style={{ borderRadius: '8px' }}>
                    <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: blockStyles[req.type].bg, borderRadius: '9999px' }}>
                      {(() => { const I = blockStyles[req.type].icon; return <I style={{ width: 14, height: 14, color: blockStyles[req.type].text }} />; })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[var(--text-primary)] truncate" style={{ fontSize: '13px', fontWeight: 600 }}>{req.type}</p>
                      <p className="text-[var(--text-secondary)]" style={{ fontSize: '11px' }}>{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5" style={{ backgroundColor: rs.bg, color: rs.text, borderRadius: '9999px', fontSize: '11px', fontWeight: 600 }}>
                      <StatusIcon style={{ width: 12, height: 12 }} />
                      {req.status}
                    </span>
                  </div>
                );
              })}
            </div>

            <Button onClick={() => openBlockDialog('PTO')} className="w-full mt-4 hover:opacity-90" style={{ backgroundColor: '#2D6A4F', color: '#fff', border: 'none', gap: '6px' }}>
              <Plus style={{ width: 16, height: 16 }} />
              Request Time Off
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 340px', gap: 20 }}>

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
            <button onClick={() => navigate('/admin')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>
              View all <ChevronRight style={{ width: 13, height: 13 }} />
            </button>
          </div>
          <div style={{ padding: '8px 0' }}>
            {TODAY_CHECKINS.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: i < TODAY_CHECKINS.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
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
            {RECENT_ACTIVITY.map((a, i) => {
              const Icon = a.icon;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i < RECENT_ACTIVITY.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
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
                      backgroundColor: d.enabled ? '#2D6A4F' : 'var(--border-color)', transition: 'background-color 0.2s',
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

    </div>
  );
}
