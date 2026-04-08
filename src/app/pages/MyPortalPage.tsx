import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTenantDb } from '../context/TenantContext';
import { useAuth } from '../context/AuthContext';
import { uploadAvatar, removeAvatar } from '../hooks/useProfile';
import { getOrgContext } from '../hooks/useOrgContext';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useActiveVisit } from '../context/ActiveVisitContext';
import {
  Users, Calendar as CalendarIcon, ClipboardCheck, Clock,
  ChevronRight, ChevronLeft, Plus, Play,
  Syringe, Stethoscope, Pill, Scissors,
  UtensilsCrossed, Palmtree, ThermometerSun, Briefcase, UsersRound,
  AlertCircle, CheckCircle2, Send, ArrowUpRight, Camera, Pencil, Trash2, X,
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import { AddClientDialog } from '../components/AddClientDialog';
import { useClients } from '../hooks/useClients';
import { Calendar } from '../components/ui/calendar';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../components/ui/select';

// ─── Types ───────────────────────────────────────────────────

type BlockType = 'Lunch Break' | 'PTO' | 'Sick Day' | 'Meeting' | 'Personal' | 'Work Hours';
type BlockStatus = 'Confirmed' | 'Pending' | 'Approved' | 'Denied';

interface TimeBlock {
  id: number;
  dbId?: string; // Supabase UUID
  type: BlockType;
  date: string;
  timeStart: string;
  timeEnd: string;
  notes: string;
  status: BlockStatus;
}

interface Appointment {
  id: number;
  dbId?: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  petName: string;
  petImage: string;
  ownerName: string;
  service: string;
  clientArrived?: boolean;
  durationMinutes?: number;
}

// ─── Mock Data ───────────────────────────────────────────────

const VET_PROFILE = {
  name: '',
  role: '',
  specialization: '',
  email: '',
  phone: '',
  licenseNo: '',
  joinedDate: '',
  image: '',
};

const MY_APPOINTMENTS: Appointment[] = [
  {
    id: 1, date: '2026-03-11', timeStart: '9:00 AM', timeEnd: '9:30 AM',
    petName: 'Max', petImage: 'https://images.unsplash.com/photo-1734966213753-1b361564bab4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb2xkZW4lMjByZXRyaWV2ZXIlMjBkb2clMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzMyNDMxMzB8MA&ixlib=rb-4.1.0&q=80&w=400',
    ownerName: 'John Smith', service: 'Annual Checkup', clientArrived: true,
  },
  {
    id: 3, date: '2026-03-11', timeStart: '10:30 AM', timeEnd: '11:00 AM',
    petName: 'Cooper', petImage: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',
    ownerName: 'Michael Brown', service: 'Dental Cleaning',
  },
  {
    id: 4, date: '2026-03-11', timeStart: '11:30 AM', timeEnd: '12:00 PM',
    petName: 'Bella', petImage: 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?w=400',
    ownerName: 'Sarah Williams', service: 'Follow-up',
  },
  {
    id: 7, date: '2026-03-11', timeStart: '3:00 PM', timeEnd: '3:30 PM',
    petName: 'Milo', petImage: 'https://images.unsplash.com/photo-1589883661923-6476cb0ae9f2?w=400',
    ownerName: 'Jessica Taylor', service: 'Checkup',
  },
  {
    id: 8, date: '2026-03-11', timeStart: '3:30 PM', timeEnd: '4:00 PM',
    petName: 'Daisy', petImage: 'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=400',
    ownerName: 'Robert Anderson', service: 'Surgery',
  },
  {
    id: 9, date: '2026-03-12', timeStart: '9:00 AM', timeEnd: '9:30 AM',
    petName: 'Oliver', petImage: 'https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=400',
    ownerName: 'Lisa Martinez', service: 'Dental Cleaning',
  },
  {
    id: 10, date: '2026-03-12', timeStart: '10:00 AM', timeEnd: '10:30 AM',
    petName: 'Buddy', petImage: 'https://images.unsplash.com/photo-1558788353-f76d92427f16?w=400',
    ownerName: 'Kevin Lee', service: 'Follow-up',
  },
  {
    id: 11, date: '2026-03-13', timeStart: '11:00 AM', timeEnd: '11:30 AM',
    petName: 'Coco', petImage: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400',
    ownerName: 'Amanda White', service: 'Vaccination',
  },
];

const INITIAL_BLOCKS: TimeBlock[] = [
  { id: 1, type: 'Work Hours', date: '2026-03-11', timeStart: '8:00 AM', timeEnd: '8:30 AM', notes: 'Morning prep & chart review', status: 'Confirmed' },
  { id: 2, type: 'Lunch Break', date: '2026-03-11', timeStart: '12:00 PM', timeEnd: '1:00 PM', notes: '', status: 'Confirmed' },
  { id: 3, type: 'Meeting', date: '2026-03-11', timeStart: '2:00 PM', timeEnd: '2:30 PM', notes: 'Team standup — case reviews', status: 'Confirmed' },
  { id: 4, type: 'Lunch Break', date: '2026-03-12', timeStart: '12:00 PM', timeEnd: '1:00 PM', notes: '', status: 'Confirmed' },
  { id: 5, type: 'PTO', date: '2026-03-17', timeStart: '8:00 AM', timeEnd: '5:00 PM', notes: 'Family day — full day off', status: 'Approved' },
  { id: 6, type: 'PTO', date: '2026-03-21', timeStart: '8:00 AM', timeEnd: '5:00 PM', notes: 'Personal appointment', status: 'Pending' },
  { id: 7, type: 'Sick Day', date: '2026-03-05', timeStart: '8:00 AM', timeEnd: '5:00 PM', notes: 'Flu — stayed home', status: 'Approved' },
];

const MY_PATIENTS = [
  { id: 1, petImage: 'https://images.unsplash.com/photo-1734966213753-1b361564bab4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb2xkZW4lMjByZXRyaWV2ZXIlMjBkb2clMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzMyNDMxMzB8MA&ixlib=rb-4.1.0&q=80&w=400', petName: 'Max', ownerName: 'John Smith', species: 'Dog', breed: 'Golden Retriever', lastVisit: 'Mar 11, 2026', status: 'Healthy' as const },
  { id: 3, petImage: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400', petName: 'Cooper', ownerName: 'Michael Brown', species: 'Dog', breed: 'Beagle', lastVisit: 'Mar 11, 2026', status: 'Follow-up' as const },
  { id: 4, petImage: 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?w=400', petName: 'Bella', ownerName: 'Sarah Williams', species: 'Cat', breed: 'Siamese', lastVisit: 'Mar 11, 2026', status: 'Healthy' as const },
  { id: 7, petImage: 'https://images.unsplash.com/photo-1589883661923-6476cb0ae9f2?w=400', petName: 'Milo', ownerName: 'Jessica Taylor', species: 'Cat', breed: 'Maine Coon', lastVisit: 'Mar 10, 2026', status: 'Healthy' as const },
  { id: 8, petImage: 'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=400', petName: 'Daisy', ownerName: 'Robert Anderson', species: 'Dog', breed: 'Labrador', lastVisit: 'Mar 11, 2026', status: 'Critical' as const },
  { id: 11, petImage: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400', petName: 'Coco', ownerName: 'Amanda White', species: 'Dog', breed: 'Poodle', lastVisit: 'Mar 9, 2026', status: 'Healthy' as const },
];

const RECENT_ACTIVITY = [
  { description: 'Completed annual checkup for Max', time: '2 hours ago', icon: Stethoscope, color: 'var(--brand-green-text)' },
  { description: 'Administered FVRCP booster to Milo', time: '3 hours ago', icon: Syringe, color: '#3B82F6' },
  { description: 'Performed dental cleaning on Cooper', time: '5 hours ago', icon: Scissors, color: '#EC4899' },
  { description: 'Prescribed pain medication for Daisy', time: 'Yesterday', icon: Pill, color: '#F4A261' },
  { description: 'Post-surgery follow-up with Bella', time: 'Yesterday', icon: Stethoscope, color: 'var(--brand-green-text)' },
];

// ─── Style Maps ──────────────────────────────────────────────

const blockStyles: Record<BlockType, { bg: string; border: string; text: string; icon: typeof UtensilsCrossed }> = {
  'Lunch Break': { bg: '#F4A26115', border: '#F4A261', text: '#B45309', icon: UtensilsCrossed },
  PTO: { bg: '#3B82F615', border: '#3B82F6', text: '#1D4ED8', icon: Palmtree },
  'Sick Day': { bg: '#d4183d15', border: '#d4183d', text: '#d4183d', icon: ThermometerSun },
  Meeting: { bg: '#8B5CF615', border: '#8B5CF6', text: '#6D28D9', icon: UsersRound },
  Personal: { bg: '#6B728015', border: 'var(--text-secondary)', text: 'var(--text-primary)', icon: Briefcase },
  'Work Hours': { bg: 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)', border: 'var(--brand-green-text)', text: 'var(--brand-green-text)', icon: Briefcase },
};

const requestStatusStyles: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  Approved: { bg: '#74C69D20', text: 'var(--brand-green-text)', icon: CheckCircle2 },
  Pending: { bg: '#F4A26120', text: '#F4A261', icon: AlertCircle },
  Denied: { bg: '#d4183d20', text: '#d4183d', icon: AlertCircle },
  Confirmed: { bg: '#74C69D20', text: 'var(--brand-green-text)', icon: CheckCircle2 },
};

const patientStatusStyles: Record<string, { bg: string; text: string }> = {
  Healthy: { bg: '#74C69D20', text: 'var(--brand-green-text)' },
  'Follow-up': { bg: '#F4A26120', text: '#F4A261' },
  Critical: { bg: '#d4183d20', text: '#d4183d' },
};

// ─── Helpers ─────────────────────────────────────────────────

const SCHEDULE_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const totalMin = i * 30;
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

/** Convert 24h time string (e.g. "13:30" or "13:30:00") to 12h (e.g. "1:30 PM") */
function to12Hour(t24: string): string {
  let [h, m] = t24.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${(m ?? 0).toString().padStart(2, '0')} ${ap}`;
}

function isSameDay(dateStr: string, date: Date): boolean {
  const parts = dateStr.split('-');
  return (
    parseInt(parts[0]) === date.getFullYear() &&
    parseInt(parts[1]) === date.getMonth() + 1 &&
    parseInt(parts[2]) === date.getDate()
  );
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

// ─── Glow Stat Card ──────────────────────────────────────────

// GLOW_CARDS is now computed inside the component with real data

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

// Watches document.documentElement for class changes to detect dark mode
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

type GlowCardData = {
  title: string; subtitle: string; metricLabel: string; value: string;
  trendLabel: string; trendPositive: boolean; color: string; shadowColor: string;
  icon: React.ElementType; data: number[]; labels: string[]; unit: string;
  annotationStart: string; annotationEnd: string;
  onArrowClick?: () => void;
};

function GlowStatCard({
  title, subtitle, metricLabel, value, trendLabel, trendPositive,
  color, shadowColor, icon: Icon, data, labels, unit, annotationStart, annotationEnd,
  onArrowClick,
}: GlowCardData) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const VW = 320;
  const VH = 100;
  const PX = 24;
  const PY = 18;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pts = data.map((v, i) => ({
    x: PX + (i / (data.length - 1)) * (VW - PX * 2),
    y: VH - PY - ((v - min) / range) * (VH - PY * 2),
  }));

  const linePath = buildSplinePath(pts);
  const first = pts[0];
  const last = pts[pts.length - 1];
  const areaPath = linePath + ` L ${last.x} ${VH} L ${first.x} ${VH} Z`;
  const midY = VH / 2;
  const uid = title.replace(/[^a-zA-Z0-9]/g, '');

  // ── Read CSS custom properties for theme-aware tokens ──────
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
    <div
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        borderRadius: '18px',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: cardShadow,
      }}
    >
      {/* Radial accent glow in top-right corner */}
      <div style={{
        position: 'absolute', top: '-40px', right: '-40px',
        width: '140px', height: '140px', borderRadius: '50%',
        background: `radial-gradient(circle, ${cornerGlow} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ padding: '20px 20px 0' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '12px',
              background: `linear-gradient(135deg, ${color}25 0%, ${color}12 100%)`,
              border: `1px solid ${color}35`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 14px ${color}25`,
            }}>
              <Icon style={{ width: '19px', height: '19px', color }} />
            </div>
            <div>
              <p style={{ fontSize: '10px', color: subtitleColor, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: '3px' }}>
                {subtitle}
              </p>
              <p style={{ fontSize: '14px', color: titleColor, fontWeight: 700, lineHeight: 1 }}>
                {title}
              </p>
            </div>
          </div>
          <button onClick={onArrowClick} style={{
            width: '30px', height: '30px', borderRadius: '8px',
            border: `1px solid ${btnBorder}`,
            backgroundColor: btnBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <ArrowUpRight style={{ width: '14px', height: '14px', color: btnIconColor }} />
          </button>
        </div>

        {/* Metric label */}
        <p style={{ fontSize: '10px', color: metricLabelColor, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: '6px' }}>
          {metricLabel}
        </p>

        {/* Value + trend badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <span style={{ fontSize: '32px', fontWeight: 800, color: valueColor, letterSpacing: '-0.02em', lineHeight: 1 }}>
            {value}
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '4px 9px', borderRadius: '7px',
            background: trendPositive ? 'rgba(74,222,128,0.15)' : 'rgba(251,113,133,0.15)',
            color: trendPositive ? '#22c55e' : '#ef4444',
            fontSize: '11px', fontWeight: 700,
            border: `1px solid ${trendPositive ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
          }}>
            {trendPositive ? '↑' : '↓'} {trendLabel}
          </span>
        </div>
      </div>

      {/* Chart — bleeds to all 3 sides, wrapped for tooltip positioning */}
      <div
        style={{ position: 'relative' }}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: '100px', display: 'block', cursor: 'crosshair' }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * VW;
            let nearestIdx = 0;
            let minDist = Infinity;
            pts.forEach((pt, i) => {
              const dist = Math.abs(pt.x - mouseX);
              if (dist < minDist) { minDist = dist; nearestIdx = i; }
            });
            setHoveredIdx(nearestIdx);
          }}
        >
          <defs>
            <filter id={`bloom-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            </filter>
            <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={areaOpacity} />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`line-${uid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={color} stopOpacity="0.6" />
              <stop offset="45%" stopColor={lineWhiteStop} stopOpacity={lineWhiteOpacity} />
              <stop offset="100%" stopColor={color} stopOpacity="1" />
            </linearGradient>
          </defs>

          {/* Dashed mid-line */}
          <line x1={PX} y1={midY} x2={VW - PX} y2={midY}
            stroke={midLineStroke} strokeWidth="1" strokeDasharray="5 5" />

          {/* Area fill */}
          <path d={areaPath} fill={`url(#area-${uid})`} />

          {/* Outer glow halo */}
          {glowOpacity1 > 0 && <path d={linePath} fill="none" stroke={color} strokeWidth="10"
            strokeLinecap="round" opacity={glowOpacity1} filter={`url(#bloom-${uid})`} />}

          {/* Inner tight glow */}
          {glowOpacity2 > 0 && <path d={linePath} fill="none" stroke={color} strokeWidth="5"
            strokeLinecap="round" opacity={glowOpacity2} filter={`url(#bloom-${uid})`} />}

          {/* Sharp line */}
          <path d={linePath} fill="none" stroke={`url(#line-${uid})`} strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" />

          {/* Start dot (hollow) */}
          <circle cx={first.x} cy={first.y} r="4.5" fill={dotHoleFill} stroke={color} strokeWidth="2" />

          {/* End dot (filled + glowing) */}
          <circle cx={last.x} cy={last.y} r="5" fill={color} filter={glowOpacity1 > 0 ? `url(#bloom-${uid})` : undefined} />
          <circle cx={last.x} cy={last.y} r="4" fill="#ffffff" opacity="0.9" />

          {/* Annotations */}
          {annotationStart && (
            <text x={first.x + 8} y={first.y - 9}
              fill={annoStartFill} fontSize="9.5" fontWeight="700" fontFamily="system-ui">
              {annotationStart}
            </text>
          )}
          {annotationEnd && (
            <text x={last.x - 8} y={last.y - 9}
              fill={annoEndFill} fontSize="9.5" fontWeight="700" fontFamily="system-ui" textAnchor="end">
              {annotationEnd}
            </text>
          )}

          {/* Hover crosshair + pulse dot */}
          {hoveredIdx !== null && (() => {
            const hx = pts[hoveredIdx].x;
            const hy = pts[hoveredIdx].y;
            return (
              <>
                {/* Vertical crosshair */}
                <line x1={hx} y1={0} x2={hx} y2={VH}
                  stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
                {/* Outer pulse ring */}
                <circle cx={hx} cy={hy} r="8" fill={color} opacity="0.18" />
                {/* Filled dot */}
                <circle cx={hx} cy={hy} r="5" fill={color} filter={glowOpacity1 > 0 ? `url(#bloom-${uid})` : undefined} opacity="0.8" />
                <circle cx={hx} cy={hy} r="4" fill={color} />
                {/* White center */}
                <circle cx={hx} cy={hy} r="2" fill="#fff" />
              </>
            );
          })()}
        </svg>

        {/* Floating tooltip */}
        {hoveredIdx !== null && (() => {
          const hx = pts[hoveredIdx].x;
          const hy = pts[hoveredIdx].y;
          // SVG is exactly 100px tall with VH=100, so 1 unit = 1px
          const dotFromBottom = VH - hy; // px from bottom of SVG
          const tooltipBg = v('--stat-card-dot-fill', '#0D1B2A');
          const tooltipBorder = `${color}55`;
          const tooltipShadow = `0 4px 20px rgba(0,0,0,0.4), 0 0 12px ${color}30`;
          const labelCol = v('--stat-card-text-muted', 'rgba(255,255,255,0.45)');
          const valCol = color;
          const unitCol = v('--stat-card-text-label', 'rgba(255,255,255,0.4)');

          return (
            <div
              style={{
                position: 'absolute',
                left: `${(hx / VW) * 100}%`,
                bottom: `${dotFromBottom + 14}px`,
                transform: 'translateX(-50%)',
                pointerEvents: 'none',
                zIndex: 20,
                backgroundColor: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: '10px',
                padding: '7px 11px',
                boxShadow: tooltipShadow,
                whiteSpace: 'nowrap',
                backdropFilter: 'blur(8px)',
                transition: 'opacity 0.1s',
              }}
            >
              {/* Period label */}
              <div style={{ fontSize: '10px', color: labelCol, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '2px' }}>
                {labels[hoveredIdx]}
              </div>
              {/* Value + unit */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '18px', fontWeight: 800, color: valCol, lineHeight: 1 }}>
                  {data[hoveredIdx]}
                </span>
                <span style={{ fontSize: '10px', fontWeight: 600, color: unitCol }}>
                  {unit}
                </span>
              </div>
              {/* Arrow pointing down */}
              <div style={{
                position: 'absolute',
                bottom: '-5px',
                left: '50%',
                width: '9px',
                height: '9px',
                backgroundColor: tooltipBg,
                borderRight: `1px solid ${tooltipBorder}`,
                borderBottom: `1px solid ${tooltipBorder}`,
                transform: 'translateX(-50%) rotate(45deg)',
              }} />
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────

export default function MyPortalPage() {
  const db = useTenantDb();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { startVisit } = useActiveVisit();
  const dashStats = useDashboardStats();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [blocksLoaded, setBlocksLoaded] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // ── Vet profile from Supabase ──
  const [vetProfile, setVetProfile] = useState(VET_PROFILE);
  const [vetId, setVetId] = useState<string | null>(null);
  const [profileImage, setProfileImage] = useState('');
  const [ptoAllowance, setPtoAllowance] = useState(20);
  const [sickAllowance, setSickAllowance] = useState(10);
  const [recentActivity, setRecentActivity] = useState<{ description: string; time: string; icon: typeof Stethoscope; color: string }[]>([]);

  // ── Photo upload ──
  const photoInputRef = useRef<HTMLInputElement>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);

  // Auto-scroll schedule to current time slot on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scheduleRef.current) {
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const slotIdx = Math.floor(nowMin / 30);
        const slotHeight = scheduleRef.current.scrollHeight / 48;
        const targetScroll = Math.max(0, slotIdx * slotHeight - scheduleRef.current.clientHeight / 3);
        scheduleRef.current.scrollTop = targetScroll;
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Helper to get staff ID (avoids stale state after HMR)
  const getStaffId = async () => {
    if (vetId) return vetId;
    if (!user) return null;
    const { data } = await db.from('profiles').select('id')
      .eq('id', user.id)
      .single();
    if (data) { setVetId(data.id); return data.id; }
    return null;
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const staffId = await getStaffId();
    if (!staffId) { alert('Could not find staff record'); return; }
    try {
      const publicUrl = await uploadAvatar(staffId, file, 'doctor');
      setProfileImage(publicUrl);
      setVetProfile(prev => ({ ...prev, image: publicUrl }));
    } catch (err: any) {
      alert(err.message);
    }
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handleDeletePhoto = async () => {
    if (!profileImage) return;
    if (!confirm('Remove your profile photo?')) return;
    const staffId = await getStaffId();
    if (!staffId) return;
    try {
      await removeAvatar(staffId, 'doctor');
      setProfileImage('');
      setVetProfile(prev => ({ ...prev, image: '' }));
    } catch (err: any) {
      console.error('Delete error:', err);
    }
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  // ── Real appointments from Supabase ──
  const [realAppointments, setRealAppointments] = useState<Appointment[]>([]);

  // Real clients from Supabase
  const [realPatients, setRealPatients] = useState<any[]>([]);
  const PATIENTS_PAGE_SIZE = 20;
  const [patientsShown, setPatientsShown] = useState(PATIENTS_PAGE_SIZE);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const { addClient, refetch: refetchClients } = useClients();

  // Refetch patients assigned to this vet
  const refetchPatients = async (staffId?: string) => {
    const sid = staffId || vetId;
    if (!sid) return;
    const { data: petData } = await db
      .from('pets')
      .select('id, name, species, breed, photo_url, assigned_vet_id, client_id, clients(id, first_name, last_name, health_status)')
      .eq('assigned_vet_id', sid);
    if (petData) {
      const rows = petData.map((pet: any) => ({
        clientId: pet.clients?.id || null,
        petId: pet.id,
        petImage: pet.photo_url || '',
        petName: pet.name ?? '—',
        ownerName: pet.clients ? `${pet.clients.first_name} ${pet.clients.last_name}` : '—',
        species: pet.species ?? '—',
        breed: pet.breed ?? '—',
        lastVisit: '—',
        status: (['Healthy', 'Follow-up', 'Critical'].includes(pet.clients?.health_status ?? '') ? pet.clients.health_status : 'Healthy') as 'Healthy' | 'Follow-up' | 'Critical',
      }));
      setRealPatients(rows);
    }
  };

  const handleAddClient = async (values: any) => {
    const { data, error } = await addClient(values);
    if (!error && data) {
      // Refetch patients after a delay to allow the pet record to be created by the dialog
      setTimeout(() => {
        refetchClients();
        refetchPatients();
        // Trigger sidebar notification badge update
        window.dispatchEvent(new CustomEvent('notifCountChanged'));
      }, 800);
      return (data as any).id as string;
    }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Fetch vet profile from profiles table (single source of truth for identity)
      const { data: profileData } = await db
        .from('profiles')
        .select('id, first_name, last_name, email, phone, avatar_url, role')
        .eq('id', user.id)
        .single();
      // Fetch operational data from staff table
      const { data: staffData } = await db
        .from('staff')
        .select('id, created_at, pto_allowance, sick_allowance')
        .eq('id', user.id)
        .single();
      if (profileData && staffData) {
        setVetId(profileData.id);
        const joinDate = new Date(staffData.created_at);
        setVetProfile({
          name: `Dr. ${profileData.first_name} ${profileData.last_name}`,
          role: (profileData.role || 'veterinarian').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          specialization: 'Small Animal Medicine',
          email: profileData.email || '—',
          phone: profileData.phone || '—',
          licenseNo: `DVM-${joinDate.getFullYear()}-${profileData.id.slice(0, 5).toUpperCase()}`,
          joinedDate: joinDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          image: profileData.avatar_url || '',
        });
        setProfileImage(profileData.avatar_url || '');
        setPtoAllowance(staffData.pto_allowance ?? 20);
        setSickAllowance(staffData.sick_allowance ?? 10);

        // Fetch appointments for this vet
        const { data: apptData } = await db
          .from('appointments')
          .select('id, scheduled_at, duration_minutes, status, reason, notes, pets(id, name, species, breed, photo_url), clients(id, first_name, last_name, phone)')
          .eq('vet_id', staffData.id)
          .order('scheduled_at', { ascending: true });
        if (apptData) {
          const mapped: Appointment[] = apptData.map((a: any, i: number) => {
            const start = new Date(a.scheduled_at);
            const end = new Date(start.getTime() + (a.duration_minutes ?? 30) * 60000);
            const fmtLocal = (d: Date) => {
              let h = d.getHours();
              const m = d.getMinutes();
              const ampm = h >= 12 ? 'PM' : 'AM';
              if (h > 12) h -= 12;
              if (h === 0) h = 12;
              return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
            };
            const y = start.getFullYear();
            const mo = (start.getMonth() + 1).toString().padStart(2, '0');
            const da = start.getDate().toString().padStart(2, '0');
            return {
              id: i + 1,
              dbId: a.id,
              date: `${y}-${mo}-${da}`,
              timeStart: fmtLocal(start),
              timeEnd: fmtLocal(end),
              petName: a.pets?.name ?? '—',
              petImage: a.pets?.photo_url ?? '',
              ownerName: a.clients ? `${a.clients.first_name} ${a.clients.last_name}` : '—',
              service: a.reason ?? '—',
              clientArrived: a.status === 'In Progress',
              durationMinutes: a.duration_minutes ?? 30,
            };
          });
          setRealAppointments(mapped);
        }

        // Fetch recent activity from appointments + vaccinations
        const activities: { description: string; time: string; icon: typeof Stethoscope; color: string; ts: number }[] = [];

        // Recent appointments (last 7 days, any status)
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const { data: recentAppts } = await db
          .from('appointments')
          .select('scheduled_at, status, reason, pets(name)')
          .eq('vet_id', staffData.id)
          .gte('scheduled_at', sevenDaysAgo)
          .order('scheduled_at', { ascending: false })
          .limit(10);
        for (const a of (recentAppts || [])) {
          const petName = (a.pets as any)?.name || 'patient';
          const reason = a.reason || 'Visit';
          const status = a.status || '';
          let desc = '';
          let icon = Stethoscope;
          let color = 'var(--brand-green-text)';
          if (status === 'Completed') {
            desc = `Completed ${reason.toLowerCase()} for ${petName}`;
          } else if (status === 'Cancelled') {
            desc = `Cancelled appointment for ${petName}`;
            color = '#94A3B8';
          } else if (status === 'In Progress') {
            desc = `In-progress visit with ${petName}`;
            color = '#3B82F6';
            icon = ClipboardCheck;
          } else {
            desc = `Scheduled ${reason.toLowerCase()} for ${petName}`;
            color = '#3B82F6';
            icon = CalendarIcon;
          }
          activities.push({ description: desc, time: a.scheduled_at, icon, color, ts: new Date(a.scheduled_at).getTime() });
        }

        // Recent vaccinations
        const { data: recentVax } = await db
          .from('vaccinations')
          .select('administered_date, vaccine_name, pets(name)')
          .gte('administered_date', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
          .order('administered_date', { ascending: false })
          .limit(5);
        for (const v of (recentVax || [])) {
          const petName = (v.pets as any)?.name || 'patient';
          activities.push({
            description: `Administered ${v.vaccine_name} to ${petName}`,
            time: v.administered_date,
            icon: Syringe,
            color: '#3B82F6',
            ts: new Date(v.administered_date).getTime(),
          });
        }

        // Sort by timestamp descending, take top 5, format time
        activities.sort((a, b) => b.ts - a.ts);
        const now = Date.now();
        const formatted = activities.slice(0, 5).map((a) => {
          const diff = now - a.ts;
          const hours = Math.floor(diff / 3600000);
          const days = Math.floor(diff / 86400000);
          let timeStr: string;
          if (hours < 1) timeStr = 'Just now';
          else if (hours < 24) timeStr = `${hours} hour${hours > 1 ? 's' : ''} ago`;
          else if (days === 1) timeStr = 'Yesterday';
          else if (days < 7) timeStr = `${days} days ago`;
          else timeStr = new Date(a.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return { description: a.description, time: timeStr, icon: a.icon, color: a.color };
        });
        setRecentActivity(formatted);

        // Fetch patients assigned to this vet
        await refetchPatients(staffData.id);

        // Fetch time blocks for this vet from DB
        const { data: blockData } = await db
          .from('staff_time_blocks')
          .select('id, type, date, time_start, time_end, notes, status')
          .eq('staff_id', staffData.id)
          .order('date', { ascending: true });
        if (blockData && blockData.length > 0) {
          const dbBlocks: TimeBlock[] = blockData.map((b: any, i: number) => ({
            id: 1000 + i,
            dbId: b.id,
            type: b.type as BlockType,
            date: b.date,
            timeStart: b.time_start ? to12Hour(b.time_start) : '8:00 AM',
            timeEnd: b.time_end ? to12Hour(b.time_end) : '5:00 PM',
            notes: b.notes || '',
            status: (b.status || 'Confirmed') as BlockStatus,
          }));
          setTimeBlocks(dbBlocks);
          setNextBlockId(2000);
        }
        setBlocksLoaded(true);
      }
      setDataLoaded(true);
    })();
  }, [user]);

  // Listen for profile changes from settings pages → update vet profile card instantly
  useEffect(() => {
    const handleProfileChanged = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (!d) return;
      setVetProfile(prev => ({
        ...prev,
        name: `Dr. ${d.firstName ?? prev.name.replace(/^Dr\.\s*/, '').split(' ')[0]} ${d.lastName ?? prev.name.replace(/^Dr\.\s*/, '').split(' ').slice(1).join(' ')}`.trim(),
        email: d.email ?? prev.email,
        phone: d.phone ?? prev.phone,
      }));
    };
    const handlePhotoChanged = (e: Event) => {
      const d = (e as CustomEvent).detail;
      const url = d?.photo_url ?? d?.avatar_url ?? '';
      setProfileImage(url);
      setVetProfile(prev => ({ ...prev, image: url }));
    };
    window.addEventListener('doctorProfileChanged', handleProfileChanged);
    window.addEventListener('staffPhotoChanged', handlePhotoChanged);
    return () => {
      window.removeEventListener('doctorProfileChanged', handleProfileChanged);
      window.removeEventListener('staffPhotoChanged', handlePhotoChanged);
    };
  }, []);

  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockType, setBlockType] = useState<BlockType>('Lunch Break');
  const todayStr = `${new Date().getFullYear()}-${(new Date().getMonth()+1).toString().padStart(2,'0')}-${new Date().getDate().toString().padStart(2,'0')}`;
  const [blockDateFrom, setBlockDateFrom] = useState(todayStr);
  const [blockDateTo, setBlockDateTo] = useState(todayStr);
  const [blockTimeStart, setBlockTimeStart] = useState('12:00');
  const [blockTimeEnd, setBlockTimeEnd] = useState('13:00');
  const [blockNotes, setBlockNotes] = useState('');
  const [nextBlockId, setNextBlockId] = useState(10);

  // ── Compute real stats for glow cards ──
  const totalPatients = realPatients.length;
  const totalAppts = realAppointments.length;
  const completedAppts = realAppointments.filter(a => {
    const d = a.date;
    const today = dateToStr(new Date());
    return d <= today;
  }).length;
  const avgDuration = totalAppts > 0 ? Math.round(
    realAppointments.reduce((sum, _) => sum + 30, 0) / totalAppts
  ) : 0;

  // Generate last 7 day labels for sparkline hover tooltips
  const dayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  // Build a growth curve from 0 → current value over 7 points
  const buildSparkData = (current: number, growth: boolean) => {
    if (current === 0) return Array(7).fill(0);
    if (!growth) {
      // For metrics like avg duration — show variation
      return Array.from({ length: 7 }, (_, i) => {
        const t = i / 6;
        return Math.round(current * (0.3 + t * 0.7 + Math.sin(t * Math.PI) * 0.15));
      });
    }
    // Growth curve
    return Array.from({ length: 7 }, (_, i) => {
      const t = i / 6;
      return Math.round(current * (t * t * 0.6 + t * 0.4));
    });
  };

  const patientsSparkData = buildSparkData(totalPatients, true);
  patientsSparkData[patientsSparkData.length - 1] = totalPatients;
  const apptsSparkData = buildSparkData(totalAppts, true);
  apptsSparkData[apptsSparkData.length - 1] = totalAppts;
  const completedSparkData = buildSparkData(completedAppts, true);
  completedSparkData[completedSparkData.length - 1] = completedAppts;
  const durationSparkData = buildSparkData(avgDuration, false);
  durationSparkData[durationSparkData.length - 1] = avgDuration;

  const glowCards = [
    {
      title: 'My Patients',
      subtitle: 'All Time',
      metricLabel: 'Total Assigned',
      value: `${totalPatients}`,
      trendLabel: totalPatients > 0 ? `${totalPatients} total` : 'No patients yet',
      trendPositive: true,
      color: '#818CF8',
      shadowColor: 'rgba(129,140,248,0.35)',
      icon: Users,
      data: patientsSparkData,
      labels: dayLabels,
      unit: 'patients',
      annotationStart: patientsSparkData[0].toLocaleString(),
      annotationEnd: `${totalPatients}`,
      onArrowClick: () => navigate('/clients'),
    },
    {
      title: 'Appointments',
      subtitle: 'Total',
      metricLabel: 'All Booked',
      value: `${totalAppts}`,
      trendLabel: totalAppts > 0 ? `${totalAppts} booked` : 'None yet',
      trendPositive: true,
      color: '#38BDF8',
      shadowColor: 'rgba(56,189,248,0.35)',
      icon: CalendarIcon,
      data: apptsSparkData,
      labels: dayLabels,
      unit: 'appts',
      annotationStart: apptsSparkData[0].toLocaleString(),
      annotationEnd: `${totalAppts}`,
      onArrowClick: () => navigate('/appointments'),
    },
    {
      title: 'Completed',
      subtitle: 'Past Visits',
      metricLabel: 'Done',
      value: `${completedAppts}`,
      trendLabel: totalAppts > 0 ? `${Math.round((completedAppts / totalAppts) * 100)}% done` : 'None yet',
      trendPositive: true,
      color: '#4ADE80',
      shadowColor: 'rgba(74,222,128,0.35)',
      icon: ClipboardCheck,
      data: completedSparkData,
      labels: dayLabels,
      unit: 'done',
      annotationStart: completedSparkData[0].toLocaleString(),
      annotationEnd: `${completedAppts}`,
    },
    {
      title: 'Vaccines Due',
      subtitle: 'This Week',
      metricLabel: 'Due Within 7 Days',
      value: String(dashStats.vaccinesDueThisWeek),
      trendLabel: `${dashStats.vaccinesDueThisWeek} due`,
      trendPositive: false,
      color: '#FB7185',
      shadowColor: 'rgba(251,113,133,0.35)',
      icon: Syringe,
      data: buildSparkData(dashStats.vaccinesDueThisWeek, false),
      labels: dayLabels,
      unit: 'vaccines',
      annotationStart: '0',
      annotationEnd: String(dashStats.vaccinesDueThisWeek),
    },
  ];

  // Day data
  const activeAppts = realAppointments;
  const dayAppts = activeAppts.filter((a) => isSameDay(a.date, selectedDate));
  const dayBlocks = timeBlocks.filter((b) => isSameDay(b.date, selectedDate) && b.status !== 'Denied');
  // Helper: convert 12h time to minutes since midnight
  const slotToMin = (slot12: string) => {
    const t24 = to24Hour(slot12);
    const [h, m] = t24.split(':').map(Number);
    return h * 60 + m;
  };

  // Build slot maps — a block/appt occupies a slot if it overlaps that slot's 30-min window at all
  // Slot window: [slotMin, slotMin+30). Item window: [startMin, endMin).
  // Overlap condition: startMin < slotMin+30 && endMin > slotMin
  const apptBySlot = new Map<string, Appointment>();   // first (primary) slot for appointment
  const busyApptSlots = new Map<string, Appointment>(); // continuation slots
  const blockBySlot = new Map<string, TimeBlock>();     // first (primary) slot for block
  const busyBlockSlots = new Map<string, TimeBlock>();  // continuation slots

  dayAppts.forEach((a) => {
    const aStart = slotToMin(a.timeStart);
    const aEnd = slotToMin(a.timeEnd);
    let first = true;
    SCHEDULE_SLOTS.forEach((slot) => {
      const sm = slotToMin(slot);
      if (aStart < sm + 30 && aEnd > sm) {
        if (first) { apptBySlot.set(slot, a); first = false; }
        else { busyApptSlots.set(slot, a); }
      }
    });
  });

  dayBlocks.forEach((b) => {
    const bStart = slotToMin(b.timeStart);
    const bEnd = slotToMin(b.timeEnd);
    let first = true;
    SCHEDULE_SLOTS.forEach((slot) => {
      const sm = slotToMin(slot);
      if (bStart < sm + 30 && bEnd > sm) {
        if (first) { blockBySlot.set(slot, b); first = false; }
        else { busyBlockSlots.set(slot, b); }
      }
    });
  });

  // Dates with events (for calendar dots)
  const eventDates = new Set<string>();
  activeAppts.forEach((a) => eventDates.add(a.date));
  timeBlocks.forEach((b) => eventDates.add(b.date));
  const datesWithEvents = Array.from(eventDates).map((d) => new Date(d + 'T12:00:00'));

  // Time off summary
  const PTO_ALLOWANCE = ptoAllowance;
  const SICK_ALLOWANCE = sickAllowance;
  const ptoRequests = timeBlocks.filter((b) => b.type === 'PTO' || b.type === 'Sick Day');
  const ptoPending = ptoRequests.filter((b) => b.status === 'Pending').length;
  const ptoApproved = ptoRequests.filter((b) => b.status === 'Approved').length;

  // Group consecutive same-type, same-status PTO blocks into date ranges (deduplicate first)
  const ptoGroups = (() => {
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
    const groups: { type: BlockType; status: BlockStatus; startDate: string; endDate: string; blocks: TimeBlock[] }[] = [];
    for (const block of sorted) {
      const last = groups[groups.length - 1];
      if (last && last.type === block.type && last.status === block.status) {
        const prev = new Date(last.endDate + 'T12:00:00');
        prev.setDate(prev.getDate() + 1);
        const prevStr = prev.toISOString().slice(0, 10);
        if (block.date === prevStr) {
          last.endDate = block.date;
          last.blocks.push(block);
          continue;
        }
      }
      groups.push({ type: block.type, status: block.status, startDate: block.date, endDate: block.date, blocks: [block] });
    }
    return groups;
  })();
  const ptoUsed = timeBlocks.filter((b) => b.type === 'PTO' && (b.status === 'Approved' || b.status === 'Confirmed')).length;
  const sickUsed = timeBlocks.filter((b) => b.type === 'Sick Day' && (b.status === 'Approved' || b.status === 'Confirmed')).length;
  const ptoLeft = PTO_ALLOWANCE - ptoUsed;
  const sickLeft = SICK_ALLOWANCE - sickUsed;

  // Navigation
  const goToPrevDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d); };
  const goToNextDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d); };
  const goToToday = () => setSelectedDate(new Date());

  // Quick booking helpers
  const openBlockDialog = (type: BlockType, startH = '12:00', endH = '13:00') => {
    setBlockType(type);
    const ds = dateToStr(selectedDate);
    setBlockDateFrom(ds);
    setBlockDateTo(ds);
    setBlockTimeStart(startH);
    setBlockTimeEnd(endH);
    setBlockNotes('');
    setBlockDialogOpen(true);
  };

  // ── Edit / Delete block state ──
  const [editingBlock, setEditingBlock] = useState<TimeBlock | null>(null);
  const [editBlockDialogOpen, setEditBlockDialogOpen] = useState(false);
  const [editBlockType, setEditBlockType] = useState<BlockType>('Lunch Break');
  const [editBlockDate, setEditBlockDate] = useState('');
  const [editBlockTimeStart, setEditBlockTimeStart] = useState('');
  const [editBlockTimeEnd, setEditBlockTimeEnd] = useState('');
  const [editBlockNotes, setEditBlockNotes] = useState('');

  const openEditBlockDialog = (block: TimeBlock) => {
    setEditingBlock(block);
    setEditBlockType(block.type);
    setEditBlockDate(block.date);
    setEditBlockTimeStart(to24Hour(block.timeStart));
    setEditBlockTimeEnd(to24Hour(block.timeEnd));
    setEditBlockNotes(block.notes);
    setEditBlockDialogOpen(true);
  };

  const handleUpdateBlock = async () => {
    if (!editingBlock) return;
    // Validate end > start
    if (editBlockTimeEnd <= editBlockTimeStart) {
      alert('End time must be after start time.');
      return;
    }
    const isRequest = editBlockType === 'PTO' || editBlockType === 'Sick Day';
    const updated: TimeBlock = {
      ...editingBlock,
      type: editBlockType,
      date: editBlockDate,
      timeStart: to12Hour(editBlockTimeStart),
      timeEnd: to12Hour(editBlockTimeEnd),
      notes: editBlockNotes,
      status: isRequest ? (editingBlock.status === 'Confirmed' ? 'Pending' : editingBlock.status) : 'Confirmed',
    };
    // Update local state
    setTimeBlocks((prev) => prev.map((b) => b.id === editingBlock.id ? updated : b));
    // Update in Supabase
    if (editingBlock.dbId) {
      db.from('staff_time_blocks').update({
        type: editBlockType,
        date: editBlockDate,
        time_start: editBlockTimeStart || null,
        time_end: editBlockTimeEnd || null,
        notes: editBlockNotes || null,
        status: updated.status,
      }).eq('id', editingBlock.dbId).then(({ error }) => {
        if (error) console.warn('Block update error:', error.message);
      });
    }
    setEditBlockDialogOpen(false);
    setEditingBlock(null);
  };

  const handleDeleteBlock = async () => {
    if (!editingBlock) return;
    // Remove from local state
    setTimeBlocks((prev) => prev.filter((b) => b.id !== editingBlock.id));
    // Delete from Supabase
    if (editingBlock.dbId) {
      db.from('staff_time_blocks').delete().eq('id', editingBlock.dbId).then(({ error }) => {
        if (error) console.warn('Block delete error:', error.message);
      });
    }
    setEditBlockDialogOpen(false);
    setEditingBlock(null);
  };

  const handleCancelPtoGroup = async (blocks: TimeBlock[]) => {
    if (!blocks.length) return;
    const blockIds = new Set(blocks.map((b) => b.id));
    // Optimistic: remove all blocks in the group from local state
    setTimeBlocks((prev) => prev.filter((b) => !blockIds.has(b.id)));
    // Delete all from staff_time_blocks
    const dbIds = blocks.map((b) => b.dbId).filter(Boolean) as string[];
    if (dbIds.length) {
      db.from('staff_time_blocks').delete().in('id', dbIds).then(({ error }) => {
        if (error) console.warn('PTO group delete error:', error.message);
      });
    }
    // Delete matching pending_request(s)
    if (user?.id) {
      const ptoType = blocks[0].type === 'PTO' ? 'pto' : 'shift_swap';
      // Build a date string from the first block to match the pending_request detail
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
    // Validate end > start
    if (blockTimeEnd <= blockTimeStart) {
      alert('End time must be after start time.');
      return;
    }
    const orgCtx = await getOrgContext();
    const isRequest = blockType === 'PTO' || blockType === 'Sick Day';
    const start = new Date(blockDateFrom + 'T12:00:00');
    const end = new Date(blockDateTo + 'T12:00:00');
    const newBlocks: TimeBlock[] = [];
    const dbRows: object[] = [];
    let idCounter = nextBlockId;
    const cursor = new Date(start);
    while (cursor <= end) {
      const dateStr = dateToStr(cursor);
      newBlocks.push({
        id: idCounter++,
        type: blockType,
        date: dateStr,
        timeStart: to12Hour(blockTimeStart),
        timeEnd: to12Hour(blockTimeEnd),
        notes: blockNotes,
        status: isRequest ? 'Pending' : 'Confirmed',
      });
      dbRows.push({
        organization_id: orgCtx.organizationId,
        clinic_id: orgCtx.clinicId,
        staff_id: vetId,
        type: blockType,
        date: dateStr,
        time_start: blockTimeStart || null,
        time_end: blockTimeEnd || null,
        notes: blockNotes || null,
        status: isRequest ? 'Pending' : 'Confirmed',
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    // Save to Supabase and get IDs back
    const { data: inserted, error } = await db.from('staff_time_blocks').insert(dbRows).select('id');
    if (error) {
      console.warn('Block save error:', error.message);
    } else if (inserted) {
      // Attach DB IDs to new blocks
      inserted.forEach((row: any, i: number) => {
        if (newBlocks[i]) newBlocks[i].dbId = row.id;
      });
    }
    // If PTO or Sick Day, also create a pending_request for Super Admin
    if (isRequest) {
      const initials = vetProfile.name.replace('Dr. ', '').split(' ').map(w => w[0]?.toUpperCase() || '').join('').slice(0, 2);
      const dateRange = blockDateFrom === blockDateTo
        ? new Date(blockDateFrom + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : `${new Date(blockDateFrom + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${new Date(blockDateTo + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      const dayCount = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
      await db.from('pending_requests').insert({
        organization_id: orgCtx.organizationId,
        type: blockType === 'PTO' ? 'pto' : 'shift_swap',
        avatar: initials,
        avatar_color: blockType === 'PTO' ? '#3B82F6' : '#d4183d',
        title: `${vetProfile.name} — ${blockType}`,
        detail: `Requesting ${blockType.toLowerCase()} ${dateRange} (${dayCount} day${dayCount > 1 ? 's' : ''})${blockNotes ? ' — ' + blockNotes : ''}`,
        meta: `Submitted just now · Veterinarian`,
        status: 'pending',
        requester_id: user?.id || null,
      });
    }
    setTimeBlocks((prev) => [...prev, ...newBlocks]);
    setNextBlockId(idCounter);
    setBlockDialogOpen(false);
  };

  return (
    <div className="max-w-[1440px] mx-auto p-8">
      {/* ─── Section 1: Profile Header ─────────────────── */}
      <div
        className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-8 overflow-hidden"
        style={{ borderRadius: '12px', borderTop: '4px solid var(--brand-green-text)' }}
      >
        <div className="flex items-center gap-6">
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {profileImage ? (
              <img
                src={profileImage}
                alt={vetProfile.name}
                className="w-16 h-16 object-cover"
                style={{ borderRadius: '50%' }}
              />
            ) : (
              <div
                className="w-16 h-16 flex items-center justify-center"
                style={{ borderRadius: '50%', backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 12%, transparent)', color: 'var(--brand-green-text)', fontSize: '20px', fontWeight: 700 }}
              >
                {vetProfile.name.split(' ').filter(w => w[0] && w[0] === w[0].toUpperCase()).map(w => w[0]).join('').slice(0, 2)}
              </div>
            )}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoUpload}
            />
            {profileImage ? (
              <button
                title="Remove photo"
                onClick={handleDeletePhoto}
                style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 22, height: 22, borderRadius: '50%',
                  backgroundColor: '#d4183d', border: '2px solid var(--surface-white)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', padding: 0,
                }}
              >
                <Trash2 style={{ width: 11, height: 11, color: '#fff' }} />
              </button>
            ) : (
              <button
                title="Upload photo"
                onClick={() => { if (photoInputRef.current) { photoInputRef.current.value = ''; photoInputRef.current.click(); } }}
                style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 22, height: 22, borderRadius: '50%',
                  backgroundColor: 'var(--brand-green-text)', border: '2px solid var(--surface-white)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', padding: 0,
                }}
              >
                <Camera style={{ width: 11, height: 11, color: '#fff' }} />
              </button>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-[var(--text-primary)]" style={{ fontSize: '26px', fontWeight: 700 }}>{vetProfile.name}</h1>
            <p className="text-[var(--brand-green-text)]" style={{ fontSize: '15px', fontWeight: 600 }}>{vetProfile.role} · {vetProfile.specialization}</p>
            <div className="flex items-center gap-3 flex-wrap mt-1">
              <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{vetProfile.email}</span>
              <span className="text-[var(--border-color)]">|</span>
              <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{vetProfile.phone}</span>
              <span className="text-[var(--border-color)]">|</span>
              <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>License {vetProfile.licenseNo}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Section 2: Performance Stats ─────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {glowCards.map((card) => (
          <GlowStatCard key={card.title} {...card} />
        ))}
      </div>

      {/* ─── Section 3: My Schedule ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 mb-8" style={{ alignItems: 'start' }}>
        {/* Left: Day Schedule */}
        <div>
          {/* Date Nav */}
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-4 mb-4 flex flex-wrap items-center justify-between gap-3" style={{ borderRadius: '12px' }}>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={goToPrevDay} className="p-1 hover:bg-[var(--surface-elevated)] transition-colors" style={{ borderRadius: '6px' }}>
                <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
              <CalendarIcon className="w-5 h-5 text-[var(--brand-green-text)]" />
              <h2 className="text-[var(--text-primary)]" style={{ fontSize: '18px', fontWeight: 600 }}>
                {isToday(selectedDate) ? 'Today, ' : ''}{formatDate(selectedDate)}
              </h2>
              <button onClick={goToNextDay} className="p-1 hover:bg-[var(--surface-elevated)] transition-colors" style={{ borderRadius: '6px' }}>
                <ChevronRight className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
              {!isToday(selectedDate) && (
                <button onClick={goToToday} className="ml-2 px-3 py-1 text-[var(--brand-green-text)] border border-[var(--brand-green-text)] hover:bg-[color-mix(in_srgb,var(--brand-green-text)_6%,transparent)] transition-colors" style={{ borderRadius: '6px', fontSize: '13px', fontWeight: 500 }}>
                  Today
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{dayAppts.length} appointments · {dayBlocks.length} blocks</span>
              <Button size="sm" onClick={() => openBlockDialog('Lunch Break')}>
                <Plus className="w-4 h-4" /> Block Time
              </Button>
            </div>
          </div>

          {/* Time Slot Grid */}
          {(() => {
            // Find the current time slot for "now" indicator
            const now = new Date();
            const nowMin = now.getHours() * 60 + now.getMinutes();
            const viewingToday = isToday(selectedDate);
            // Current slot: the slot whose 30-min window contains "now"
            const currentSlotIdx = viewingToday
              ? SCHEDULE_SLOTS.findIndex((slot) => {
                  const sm = slotToMin(slot);
                  return nowMin >= sm && nowMin < sm + 30;
                })
              : -1;
            // Position of the red line within the current slot (0–100%)
            const currentSlotStart = currentSlotIdx >= 0 ? slotToMin(SCHEDULE_SLOTS[currentSlotIdx]) : 0;
            const linePercent = currentSlotIdx >= 0 ? ((nowMin - currentSlotStart) / 30) * 100 : 0;

            return (
          <div ref={scheduleRef} className="bg-[var(--surface-white)] border border-[var(--border-color)] overflow-hidden" style={{ borderRadius: '12px', overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
            {SCHEDULE_SLOTS.map((slot, idx) => {
              const appt = apptBySlot.get(slot);
              const busyAppt = busyApptSlots.get(slot);
              const block = blockBySlot.get(slot);
              const isLast = idx === SCHEDULE_SLOTS.length - 1;
              const isCurrent = idx === currentSlotIdx;

              return (
                <div
                  key={slot}
                  className={`flex items-stretch ${!isLast ? 'border-b border-[var(--border-color)]' : ''}`}
                  style={{
                    position: 'relative',
                    backgroundColor: isCurrent ? 'color-mix(in srgb, var(--brand-green-text) 3%, transparent)' : undefined,
                  }}
                >
                  {/* Current time indicator line */}
                  {isCurrent && (
                    <div
                      style={{
                        position: 'absolute',
                        top: `${linePercent}%`,
                        left: 0,
                        right: 0,
                        height: '2px',
                        backgroundColor: '#ef4444',
                        zIndex: 10,
                        pointerEvents: 'none',
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        left: '88px',
                        top: '-4px',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: '#ef4444',
                      }} />
                    </div>
                  )}
                  {/* Time Label */}
                  <div className="w-24 flex-shrink-0 px-3 py-3 flex items-center justify-end">
                    <span style={{ fontSize: '13px', color: isCurrent ? '#ef4444' : 'var(--text-secondary)', fontWeight: isCurrent ? 600 : 500 }}>
                      {isCurrent ? to12Hour(`${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`) : slot}
                    </span>
                  </div>

                  {/* Slot Content */}
                  {appt ? (
                    appt.clientArrived ? (
                      /* ── Arrived client: badge + Start Appointment CTA ── */
                      <div
                        className="flex-1 m-1 px-3 py-3 flex flex-col gap-2.5"
                        style={{
                          backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)',
                          borderLeft: '4px solid var(--brand-green-text)',
                          borderRadius: '8px',
                          boxShadow: '0 0 0 1px color-mix(in srgb, var(--brand-green-text) 19%, transparent)',
                        }}
                      >
                        {/* Pet info row */}
                        <div className="flex items-center gap-3">
                          <div className="relative flex-shrink-0">
                            {appt.petImage ? (
                              <img src={appt.petImage} alt={appt.petName} className="w-9 h-9 object-cover" style={{ borderRadius: '9999px' }} />
                            ) : (
                              <div className="w-9 h-9 flex items-center justify-center font-semibold" style={{ borderRadius: '9999px', backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)', fontSize: '12px' }}>{appt.petName.slice(0, 2).toUpperCase()}</div>
                            )}
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white" style={{ borderRadius: '9999px' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{appt.petName}</p>
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5"
                                style={{
                                  backgroundColor: '#22c55e18',
                                  color: '#16a34a',
                                  borderRadius: '9999px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  border: '1px solid #22c55e40',
                                }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                                Client arrived
                              </span>
                            </div>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{appt.ownerName} · {appt.service}</p>
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flexShrink: 0 }}>{appt.timeStart} – {appt.timeEnd}</span>
                        </div>

                        {/* Start Appointment CTA */}
                        <button
                          onClick={() => {
                            startVisit({
                              apptId: appt.dbId || appt.id,
                              petName: appt.petName,
                              petImage: appt.petImage,
                              ownerName: appt.ownerName,
                              service: appt.service,
                              durationMinutes: appt.durationMinutes ?? 30,
                            });
                            navigate(`/appointments/${appt.dbId || appt.id}/visit`);
                          }}
                          className="w-full flex items-center justify-center gap-2 py-2 transition-all hover:opacity-90 active:scale-[0.98]"
                          style={{
                            backgroundColor: 'var(--brand-green-text)',
                            color: 'var(--on-brand-green)',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 600,
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <Play className="w-3.5 h-3.5" style={{ fill: 'var(--on-brand-green)' }} />
                          Start Appointment
                        </button>
                      </div>
                    ) : (
                      /* ── Regular appointment block ── */
                      <div
                        className="flex-1 m-1 px-3 py-2.5 flex items-center gap-3"
                        style={{ backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 6%, transparent)', borderLeft: '4px solid var(--brand-green-text)', borderRadius: '8px' }}
                      >
                        {appt.petImage ? (
                          <img src={appt.petImage} alt={appt.petName} className="w-8 h-8 object-cover flex-shrink-0" style={{ borderRadius: '9999px' }} />
                        ) : (
                          <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center font-semibold" style={{ borderRadius: '9999px', backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)', fontSize: '12px' }}>{appt.petName.slice(0, 2).toUpperCase()}</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{appt.petName}</p>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{appt.ownerName} · {appt.service}</p>
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{appt.timeStart} – {appt.timeEnd}</span>
                      </div>
                    )
                  ) : busyAppt ? (
                    <div
                      className="flex-1 m-1 px-3 py-2.5 flex items-center gap-3"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 3%, transparent)', borderLeft: '4px solid color-mix(in srgb, var(--brand-green-text) 38%, transparent)', borderRadius: '8px', opacity: 0.7 }}
                    >
                      {busyAppt.petImage ? (
                        <img src={busyAppt.petImage} alt={busyAppt.petName} className="w-7 h-7 object-cover flex-shrink-0" style={{ borderRadius: '9999px' }} />
                      ) : (
                        <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center font-semibold" style={{ borderRadius: '9999px', backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)', fontSize: '11px' }}>{busyAppt.petName.slice(0, 2).toUpperCase()}</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>{busyAppt.petName} · {busyAppt.service} (cont.)</p>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{busyAppt.timeStart} – {busyAppt.timeEnd}</span>
                    </div>
                  ) : block ? (
                    (() => {
                      const blockEnd = slotToMin(block.timeEnd);
                      const slotEnd = slotToMin(slot) + 30;
                      const hasGap = blockEnd < slotEnd;
                      const gapStart24 = `${Math.floor(blockEnd / 60).toString().padStart(2, '0')}:${(blockEnd % 60).toString().padStart(2, '0')}`;
                      const gapEnd24 = `${Math.floor(slotEnd / 60).toString().padStart(2, '0')}:${(slotEnd % 60).toString().padStart(2, '0')}`;
                      return (
                        <div className="flex-1 m-1 flex gap-1">
                          <div
                            className={`${hasGap ? 'flex-1' : 'flex-1'} px-3 py-2.5 flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity`}
                            style={{
                              backgroundColor: blockStyles[block.type].bg,
                              borderLeft: `4px solid ${blockStyles[block.type].border}`,
                              borderRadius: '8px',
                            }}
                            onClick={() => openEditBlockDialog(block)}
                          >
                            {(() => { const Icon = blockStyles[block.type].icon; return <Icon className="w-4 h-4 flex-shrink-0" style={{ color: blockStyles[block.type].text }} />; })()}
                            <div className="flex-1 min-w-0">
                              <p style={{ fontSize: '14px', fontWeight: 600, color: blockStyles[block.type].text }}>{block.type}</p>
                              {block.notes && <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{block.notes}</p>}
                            </div>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{block.timeStart} – {block.timeEnd}</span>
                          </div>
                          {hasGap && (
                            <button
                              className="px-2 flex items-center justify-center hover:bg-[var(--surface-elevated)] transition-colors"
                              style={{ borderRadius: '8px', border: '1px dashed var(--border-color)' }}
                              onClick={() => openBlockDialog('Lunch Break', gapStart24, gapEnd24)}
                              title={`Block ${to12Hour(gapStart24)} – ${to12Hour(gapEnd24)}`}
                            >
                              <Plus className="w-4 h-4 text-[var(--text-secondary)]" />
                            </button>
                          )}
                        </div>
                      );
                    })()
                  ) : busyBlockSlots.has(slot) ? (
                    (() => {
                      const bb = busyBlockSlots.get(slot)!;
                      return (
                        <div
                          className="flex-1 m-1 px-3 py-2.5 flex items-center gap-3 cursor-pointer hover:opacity-60 transition-opacity"
                          style={{
                            backgroundColor: blockStyles[bb.type].bg,
                            borderLeft: `4px solid ${blockStyles[bb.type].border}`,
                            borderRadius: '8px',
                            opacity: 0.7,
                          }}
                          onClick={() => openEditBlockDialog(bb)}
                        >
                          {(() => { const Icon = blockStyles[bb.type].icon; return <Icon className="w-4 h-4 flex-shrink-0" style={{ color: blockStyles[bb.type].text }} />; })()}
                          <div className="flex-1 min-w-0">
                            <p style={{ fontSize: '13px', fontWeight: 500, color: blockStyles[bb.type].text }}>{bb.type} (cont.)</p>
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{bb.timeStart} – {bb.timeEnd}</span>
                        </div>
                      );
                    })()
                  ) : (
                    <div
                      className="flex-1 m-1 px-3 py-3 cursor-pointer hover:bg-[var(--surface-elevated)] transition-colors flex items-center"
                      style={{ borderRadius: '8px' }}
                      onClick={() => {
                        const t24 = to24Hour(slot);
                        const [sh, sm] = t24.split(':').map(Number);
                        const eh = sm === 30 ? sh + 1 : sh;
                        const em = sm === 30 ? 0 : 30;
                        openBlockDialog('Lunch Break', t24, `${eh.toString().padStart(2, '0')}:${em.toString().padStart(2, '0')}`);
                      }}
                    >
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Available</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
            );
          })()}

          {/* My Patients Table */}
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] mt-4" style={{ borderRadius: '12px' }}>
            <div className="p-5 border-b border-[var(--border-color)] flex items-center justify-between">
              <h3 className="text-[var(--text-primary)]" style={{ fontSize: '18px', fontWeight: 600 }}>My Patients</h3>
              <Link to="/clients" className="text-[var(--text-secondary)] flex items-center gap-1 hover:opacity-75 transition-opacity" style={{ fontSize: '12px', fontWeight: 600 }}>
                View all <ChevronRight className="w-[13px] h-[13px]" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-color)]">
                    {['Pet', 'Owner', 'Species', 'Last Visit', 'Status'].map((h) => (
                      <th key={h} className="py-3 px-4 text-left">
                        <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px', fontWeight: 600 }}>{h}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {realPatients.slice(0, patientsShown).map((p, idx) => {
                    const s = patientStatusStyles[p.status] || patientStatusStyles.Healthy;
                    return (
                      <tr
                        key={p.petId || p.clientId || idx}
                        className="border-b border-[var(--border-color)] last:border-0 hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
                        onClick={() => {
                          if (p.clientId) {
                            navigate(`/clients/${p.clientId}${p.petId ? `?petId=${p.petId}` : ''}`);
                          }
                        }}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {p.petImage ? (
                              <img src={p.petImage} alt={p.petName} className="w-8 h-8 object-cover" style={{ borderRadius: '9999px' }} />
                            ) : (
                              <div className="w-8 h-8 flex items-center justify-center bg-[var(--brand-green-bg)] text-[var(--brand-green-text)]" style={{ borderRadius: '9999px', fontSize: '11px', fontWeight: 700 }}>
                                {(p.petName || '?')[0].toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>{p.petName}</p>
                              <p className="text-[var(--text-secondary)]" style={{ fontSize: '11px' }}>{p.breed}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4"><span className="text-[var(--text-primary)]" style={{ fontSize: '14px' }}>{p.ownerName}</span></td>
                        <td className="py-3 px-4"><span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{p.species}</span></td>
                        <td className="py-3 px-4"><span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{p.lastVisit || '—'}</span></td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2.5 py-1" style={{ backgroundColor: s.bg, color: s.text, borderRadius: '9999px', fontSize: '12px', fontWeight: 600 }}>{p.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {realPatients.length > patientsShown && (
              <div className="p-4 border-t border-[var(--border-color)] flex items-center justify-between gap-3">
                <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>
                  Showing {patientsShown} of {realPatients.length}
                </span>
                <button
                  onClick={() => setPatientsShown(n => Math.min(n + PATIENTS_PAGE_SIZE, realPatients.length))}
                  className="px-4 py-2 hover:opacity-90 transition-opacity"
                  style={{
                    background: 'var(--surface-elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  Load more
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Calendar + Quick Actions + Time Off */}
        <div className="space-y-5">
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

          {/* Recent Activity */}
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-5" style={{ borderRadius: '12px' }}>
            <h3 className="text-[var(--text-primary)] mb-4" style={{ fontSize: '16px', fontWeight: 600 }}>Recent Activity</h3>
            <div className="space-y-4">
              {recentActivity.length === 0 && (
                <p className="text-[var(--text-secondary)] text-center py-4" style={{ fontSize: '13px' }}>No recent activity</p>
              )}
              {recentActivity.map((activity, idx) => {
                const Icon = activity.icon;
                return (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center mt-0.5" style={{ backgroundColor: `${activity.color}15`, borderRadius: '9999px' }}>
                      <Icon className="w-4 h-4" style={{ color: activity.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 500 }}>{activity.description}</p>
                      <p className="text-[var(--text-secondary)] mt-0.5" style={{ fontSize: '12px' }}>{activity.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Time Off Summary */}
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-5" style={{ borderRadius: '12px' }}>
            <h3 className="text-[var(--text-primary)] mb-4" style={{ fontSize: '16px', fontWeight: 600 }}>Time Off</h3>

            {/* Days Left Counters */}
            <div className="space-y-3 mb-4">
              {/* PTO */}
              <div className="p-3 border border-[var(--border-color)]" style={{ borderRadius: '10px' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Palmtree className="w-4 h-4 text-[#1D4ED8]" />
                    <span className="text-[var(--text-primary)]" style={{ fontSize: '13px', fontWeight: 600 }}>PTO</span>
                  </div>
                  <span className="text-[var(--text-primary)]" style={{ fontSize: '15px', fontWeight: 700 }}>{ptoLeft} <span className="text-[var(--text-secondary)]" style={{ fontSize: '11px', fontWeight: 400 }}>/ {PTO_ALLOWANCE} days left</span></span>
                </div>
                <div className="w-full h-2 bg-[var(--border-color)] overflow-hidden" style={{ borderRadius: '9999px' }}>
                  <div className="h-full bg-[#3B82F6] transition-all" style={{ width: `${(ptoUsed / PTO_ALLOWANCE) * 100}%`, borderRadius: '9999px' }} />
                </div>
                <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '11px' }}>{ptoUsed} used · {ptoGroups.filter(g => g.type === 'PTO' && g.status === 'Pending').length > 0 ? `${ptoGroups.filter(g => g.type === 'PTO' && g.status === 'Pending').length} pending` : 'none pending'}</p>
              </div>

              {/* Sick Days */}
              <div className="p-3 border border-[var(--border-color)]" style={{ borderRadius: '10px' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <ThermometerSun className="w-4 h-4 text-[#d4183d]" />
                    <span className="text-[var(--text-primary)]" style={{ fontSize: '13px', fontWeight: 600 }}>Sick Days</span>
                  </div>
                  <span className="text-[var(--text-primary)]" style={{ fontSize: '15px', fontWeight: 700 }}>{sickLeft} <span className="text-[var(--text-secondary)]" style={{ fontSize: '11px', fontWeight: 400 }}>/ {SICK_ALLOWANCE} days left</span></span>
                </div>
                <div className="w-full h-2 bg-[var(--border-color)] overflow-hidden" style={{ borderRadius: '9999px' }}>
                  <div className="h-full bg-[#d4183d] transition-all" style={{ width: `${(sickUsed / SICK_ALLOWANCE) * 100}%`, borderRadius: '9999px' }} />
                </div>
                <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '11px' }}>{sickUsed} used · {ptoGroups.filter(g => g.type === 'Sick Day' && g.status === 'Pending').length > 0 ? `${ptoGroups.filter(g => g.type === 'Sick Day' && g.status === 'Pending').length} pending` : 'none pending'}</p>
              </div>
            </div>

            {/* Request List */}
            <h4 className="text-[var(--text-secondary)] mb-2" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Requests</h4>
            <div className="space-y-2">
              {ptoGroups.map((group, gi) => {
                const rs = requestStatusStyles[group.status];
                const StatusIcon = rs.icon;
                const startD = new Date(group.startDate + 'T12:00:00');
                const endD = new Date(group.endDate + 'T12:00:00');
                const isSameDay = group.startDate === group.endDate;
                const dayCount = group.blocks.length;
                const dateLabel = isSameDay
                  ? startD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : `${startD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                return (
                  <div key={`${group.type}-${group.startDate}-${gi}`} className="flex items-center gap-2 p-2 border border-[var(--border-color)]" style={{ borderRadius: '8px' }}>
                    <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: blockStyles[group.type].bg, borderRadius: '9999px' }}>
                      {(() => { const I = blockStyles[group.type].icon; return <I className="w-3.5 h-3.5" style={{ color: blockStyles[group.type].text }} />; })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[var(--text-primary)] truncate" style={{ fontSize: '13px', fontWeight: 600 }}>{group.type}{!isSameDay ? ` (${dayCount} days)` : ''}</p>
                      <p className="text-[var(--text-secondary)]" style={{ fontSize: '11px' }}>{dateLabel}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5" style={{ backgroundColor: rs.bg, color: rs.text, borderRadius: '9999px', fontSize: '11px', fontWeight: 600 }}>
                      <StatusIcon className="w-3 h-3" />
                      {group.status}
                    </span>
                    {group.status === 'Pending' && (
                      <button
                        onClick={() => handleCancelPtoGroup(group.blocks)}
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

            <Button
              onClick={() => openBlockDialog('PTO')}
              className="w-full mt-4 hover:opacity-90"
              style={{ backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)', border: 'none', gap: '6px' }}
            >
              <Plus className="w-4 h-4" />
              Request Time Off
            </Button>
          </div>
        </div>
      </div>

      {/* My Patients is inside the left column of the grid above */}

      {/* ─── Block Time Dialog ────────────────────────── */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {blockType === 'PTO' || blockType === 'Sick Day' ? (
                <><Send className="w-4 h-4 text-[var(--brand-green-text)]" /> Request {blockType}</>
              ) : (
                <><Plus className="w-4 h-4 text-[var(--brand-green-text)]" /> Block Time</>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Type</label>
              <Select value={blockType} onValueChange={(v) => {
                const t = v as BlockType;
                setBlockType(t);
                // Auto-set sensible default times per type
                if (t === 'Work Hours') { setBlockTimeStart('08:00'); setBlockTimeEnd('17:00'); }
                else if (t === 'Lunch Break') { setBlockTimeStart('12:00'); setBlockTimeEnd('13:00'); }
                else if (t === 'PTO' || t === 'Sick Day') { setBlockTimeStart('08:00'); setBlockTimeEnd('17:00'); }
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['Lunch Break', 'Meeting', 'Work Hours', 'Personal', 'PTO', 'Sick Day'] as BlockType[]).map((t) => {
                    const s = blockStyles[t];
                    const Icon = s.icon;
                    return (
                      <SelectItem key={t} value={t}>
                        <span className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5" style={{ color: s.border }} />
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
                <AlertCircle className="w-4 h-4 text-[#F4A261] flex-shrink-0" />
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

      {/* ─── Edit / Delete Block Dialog ─────────────── */}
      <Dialog open={editBlockDialogOpen} onOpenChange={setEditBlockDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-[var(--brand-green-text)]" /> Edit Block
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Type</label>
              <Select value={editBlockType} onValueChange={(v) => setEditBlockType(v as BlockType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['Lunch Break', 'Meeting', 'Work Hours', 'Personal', 'PTO', 'Sick Day'] as BlockType[]).map((t) => {
                    const s = blockStyles[t];
                    const Icon = s.icon;
                    return <SelectItem key={t} value={t}><span className="flex items-center gap-2"><Icon className="w-3.5 h-3.5" style={{ color: s.text }} />{t}</span></SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Date</label>
              <Input type="date" value={editBlockDate} onChange={(e) => setEditBlockDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Start Time</label>
                <Input type="time" value={editBlockTimeStart} onChange={(e) => setEditBlockTimeStart(e.target.value)} />
              </div>
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>End Time</label>
                <Input type="time" value={editBlockTimeEnd} onChange={(e) => setEditBlockTimeEnd(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Notes</label>
              <Textarea placeholder="Optional notes..." value={editBlockNotes} onChange={(e) => setEditBlockNotes(e.target.value)} className="min-h-16" />
            </div>
          </div>
          <DialogFooter className="flex !justify-between">
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              onClick={handleDeleteBlock}
            >
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditBlockDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateBlock}>Save Changes</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AddClientDialog open={addClientOpen} onOpenChange={setAddClientOpen} onSave={handleAddClient} />
    </div>
  );
}
