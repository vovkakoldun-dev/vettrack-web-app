import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { supabase } from '../../lib/supabase';
import {
  Users, Calendar as CalendarIcon, ClipboardCheck, Clock,
  ChevronRight, ChevronLeft, Plus, Play,
  Syringe, Stethoscope, Pill, Scissors,
  UtensilsCrossed, Palmtree, ThermometerSun, Briefcase, UsersRound,
  AlertCircle, CheckCircle2, Send, ArrowUpRight, Camera, Pencil, Trash2,
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
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
  date: string;
  timeStart: string;
  timeEnd: string;
  petName: string;
  petImage: string;
  ownerName: string;
  service: string;
  clientArrived?: boolean;
}

// ─── Mock Data ───────────────────────────────────────────────

const VET_PROFILE = {
  name: 'Dr. Sarah Chen',
  role: 'Lead Veterinarian',
  specialization: 'Small Animal Medicine',
  email: 'sarah.chen@vettrack.com',
  phone: '(555) 234-5678',
  licenseNo: 'DVM-2018-04521',
  joinedDate: 'March 2018',
  image:
    'https://images.unsplash.com/photo-1640161415278-a5ac46f82d04?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjB2ZXRlcmluYXJpYW4lMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzMyODYxNTB8MA&ixlib=rb-4.1.0&q=80&w=1080',
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
  'Work Hours': { bg: '#2D6A4F15', border: 'var(--brand-green-text)', text: 'var(--brand-green-text)', icon: Briefcase },
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

const GLOW_CARDS = [
  {
    title: 'My Patients',
    subtitle: 'All Time',
    metricLabel: 'Growth Rate',
    value: '186',
    trendLabel: '+8 this month',
    trendPositive: true,
    color: '#818CF8',
    shadowColor: 'rgba(129,140,248,0.35)',
    icon: Users,
    data: [142, 148, 150, 157, 163, 170, 178, 186],
    labels: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
    unit: 'patients',
    annotationStart: '142',
    annotationEnd: '+186',
  },
  {
    title: 'Appointments',
    subtitle: 'This Week',
    metricLabel: 'Weekly Volume',
    value: '32',
    trendLabel: '+4 vs last week',
    trendPositive: true,
    color: '#38BDF8',
    shadowColor: 'rgba(56,189,248,0.35)',
    icon: CalendarIcon,
    data: [22, 25, 24, 28, 26, 29, 28, 32],
    labels: ['W−7', 'W−6', 'W−5', 'W−4', 'W−3', 'W−2', 'W−1', 'Now'],
    unit: 'appts',
    annotationStart: '22',
    annotationEnd: '+32',
  },
  {
    title: 'Procedures Done',
    subtitle: 'Monthly',
    metricLabel: 'Completion Rate',
    value: '1,247',
    trendLabel: '+15 this month',
    trendPositive: true,
    color: '#4ADE80',
    shadowColor: 'rgba(74,222,128,0.35)',
    icon: ClipboardCheck,
    data: [95, 102, 110, 108, 115, 118, 120, 124],
    labels: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
    unit: 'done',
    annotationStart: '95',
    annotationEnd: '+124',
  },
  {
    title: 'Avg. Consult',
    subtitle: 'Improvement',
    metricLabel: 'Time Efficiency',
    value: '24 min',
    trendLabel: '−2 min faster',
    trendPositive: false,
    color: '#FB7185',
    shadowColor: 'rgba(251,113,133,0.35)',
    icon: Clock,
    data: [32, 30, 29, 28, 27, 26, 25, 24],
    labels: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
    unit: 'min',
    annotationStart: '32m',
    annotationEnd: '24m',
  },
];

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

function GlowStatCard({
  title, subtitle, metricLabel, value, trendLabel, trendPositive,
  color, shadowColor, icon: Icon, data, labels, unit, annotationStart, annotationEnd,
}: (typeof GLOW_CARDS)[0]) {
  const dark = useDarkMode();
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
  const uid = title.replace(/\s+/g, '');

  // ── Theme-aware tokens ──────────────────────────────────────
  const cardBg = dark
    ? 'linear-gradient(145deg, #0D1B2A 0%, #0A1520 60%, #0D1B2A 100%)'
    : `linear-gradient(145deg, #ffffff 0%, #f8faff 60%, #ffffff 100%)`;
  const cardBorder = dark ? 'rgba(255,255,255,0.07)' : `${color}28`;
  const cardShadow = dark
    ? `0 0 0 1px rgba(255,255,255,0.04), 0 20px 60px -10px ${shadowColor}`
    : `0 4px 32px -6px ${shadowColor}, 0 0 0 1px ${color}18`;
  const cornerGlow = dark ? `${color}18` : `${color}12`;
  const subtitleColor = dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.38)';
  const titleColor = dark ? 'rgba(255,255,255,0.88)' : '#0F172A';
  const metricLabelColor = dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)';
  const valueColor = dark ? '#ffffff' : '#0F172A';
  const btnBorder = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const btnBg = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const btnIconColor = dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)';
  const dotHoleFill = dark ? '#0D1B2A' : '#ffffff';
  const dotEndFill = dark ? '#ffffff' : '#ffffff';
  const midLineStroke = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const annoStartFill = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  const annoEndFill = dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)';
  const areaOpacity = dark ? 0.22 : 0.14;
  const lineWhiteStop = dark ? '#ffffff' : color;
  const lineWhiteOpacity = dark ? 0.9 : 1;
  const glowOpacity1 = dark ? 0.35 : 0.28;
  const glowOpacity2 = dark ? 0.5 : 0.45;

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
          <button style={{
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
          <path d={linePath} fill="none" stroke={color} strokeWidth="10"
            strokeLinecap="round" opacity={glowOpacity1} filter={`url(#bloom-${uid})`} />

          {/* Inner tight glow */}
          <path d={linePath} fill="none" stroke={color} strokeWidth="5"
            strokeLinecap="round" opacity={glowOpacity2} filter={`url(#bloom-${uid})`} />

          {/* Sharp line */}
          <path d={linePath} fill="none" stroke={`url(#line-${uid})`} strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" />

          {/* Start dot (hollow) */}
          <circle cx={first.x} cy={first.y} r="4.5" fill={dotHoleFill} stroke={color} strokeWidth="2" />

          {/* End dot (filled + glowing) */}
          <circle cx={last.x} cy={last.y} r="5" fill={color} filter={`url(#bloom-${uid})`} />
          <circle cx={last.x} cy={last.y} r="4" fill={dotEndFill} opacity="0.9" />

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
                <circle cx={hx} cy={hy} r="5" fill={color} filter={`url(#bloom-${uid})`} opacity="0.8" />
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
          const tooltipBg = dark ? '#1a2a3a' : '#ffffff';
          const tooltipBorder = `${color}55`;
          const tooltipShadow = dark
            ? `0 4px 20px rgba(0,0,0,0.5), 0 0 12px ${color}30`
            : `0 4px 20px rgba(0,0,0,0.12), 0 0 10px ${color}20`;
          const labelCol = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
          const valCol = color;
          const unitCol = dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';

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
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>(INITIAL_BLOCKS);
  const [blocksLoaded, setBlocksLoaded] = useState(false);

  // ── Vet profile from Supabase ──
  const [vetProfile, setVetProfile] = useState(VET_PROFILE);
  const [vetId, setVetId] = useState<string | null>(null);

  // ── Real appointments from Supabase ──
  const [realAppointments, setRealAppointments] = useState<Appointment[]>([]);

  // Real clients from Supabase
  const [realPatients, setRealPatients] = useState<any[]>([]);
  const [addClientOpen, setAddClientOpen] = useState(false);

  useEffect(() => {
    (async () => {
      // Fetch vet profile (first staff member)
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, first_name, last_name, role, email, phone, created_at')
        .limit(1)
        .single();
      if (staffData) {
        setVetId(staffData.id);
        const joinDate = new Date(staffData.created_at);
        setVetProfile({
          name: `Dr. ${staffData.first_name} ${staffData.last_name}`,
          role: (staffData.role || 'veterinarian').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          specialization: 'Small Animal Medicine',
          email: staffData.email || '—',
          phone: staffData.phone || '—',
          licenseNo: `DVM-${joinDate.getFullYear()}-${staffData.id.slice(0, 5).toUpperCase()}`,
          joinedDate: joinDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          image: '',
        });

        // Fetch appointments for this vet
        const { data: apptData } = await supabase
          .from('appointments')
          .select('id, scheduled_at, duration_minutes, status, reason, notes, pets(id, name, species, breed, photo_url), clients(id, first_name, last_name, phone)')
          .eq('vet_id', staffData.id)
          .order('scheduled_at', { ascending: true });
        if (apptData) {
          const mapped: Appointment[] = apptData.map((a: any, i: number) => {
            const start = new Date(a.scheduled_at);
            const end = new Date(start.getTime() + (a.duration_minutes ?? 30) * 60000);
            const fmtUTC = (d: Date) => {
              let h = d.getUTCHours();
              const m = d.getUTCMinutes();
              const ampm = h >= 12 ? 'PM' : 'AM';
              if (h > 12) h -= 12;
              if (h === 0) h = 12;
              return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
            };
            const y = start.getUTCFullYear();
            const mo = (start.getUTCMonth() + 1).toString().padStart(2, '0');
            const da = start.getUTCDate().toString().padStart(2, '0');
            return {
              id: i + 1,
              date: `${y}-${mo}-${da}`,
              timeStart: fmtUTC(start),
              timeEnd: fmtUTC(end),
              petName: a.pets?.name ?? '—',
              petImage: a.pets?.photo_url ?? '',
              ownerName: a.clients ? `${a.clients.first_name} ${a.clients.last_name}` : '—',
              service: a.reason ?? '—',
            };
          });
          setRealAppointments(mapped);
        }

        // Fetch patients assigned to this vet
        const { data: petData } = await supabase
          .from('pets')
          .select('id, name, species, breed, photo_url, assigned_vet_id, client_id, clients(id, first_name, last_name, health_status)')
          .eq('assigned_vet_id', staffData.id);
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

        // Fetch time blocks for this vet from DB
        const { data: blockData } = await supabase
          .from('staff_time_blocks')
          .select('id, type, date, time_start, time_end, notes, status')
          .eq('staff_id', staffData.id)
          .order('date', { ascending: true });
        if (blockData && blockData.length > 0) {
          const from12 = (t24: string) => {
            let [h, m] = t24.split(':').map(Number);
            const ap = h >= 12 ? 'PM' : 'AM';
            if (h > 12) h -= 12;
            if (h === 0) h = 12;
            return `${h}:${m.toString().padStart(2, '0')} ${ap}`;
          };
          const dbBlocks: TimeBlock[] = blockData.map((b: any, i: number) => ({
            id: 1000 + i,
            dbId: b.id,
            type: b.type as BlockType,
            date: b.date,
            timeStart: b.time_start ? from12(b.time_start) : '8:00 AM',
            timeEnd: b.time_end ? from12(b.time_end) : '5:00 PM',
            notes: b.notes || '',
            status: (b.status || 'Confirmed') as BlockStatus,
          }));
          setTimeBlocks(dbBlocks);
          setNextBlockId(2000);
        }
        setBlocksLoaded(true);
      }
    })();
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

  // Day data
  const activeAppts = realAppointments.length > 0 ? realAppointments : MY_APPOINTMENTS;
  const dayAppts = activeAppts.filter((a) => isSameDay(a.date, selectedDate));
  const dayBlocks = timeBlocks.filter((b) => isSameDay(b.date, selectedDate));
  const apptByTime = new Map(dayAppts.map((a) => [a.timeStart, a]));
  const blockByTime = new Map(dayBlocks.map((b) => [b.timeStart, b]));

  // Helper: convert 12h time to minutes since midnight
  const slotToMin = (slot12: string) => {
    const t24 = to24Hour(slot12);
    const [h, m] = t24.split(':').map(Number);
    return h * 60 + m;
  };

  // Build busy-appointment map: appointments spanning multiple slots
  const busyApptSlots = new Map<string, Appointment>();
  dayAppts.forEach((a) => {
    const startMin = slotToMin(a.timeStart);
    const endMin = slotToMin(a.timeEnd);
    SCHEDULE_SLOTS.forEach((slot) => {
      const sm = slotToMin(slot);
      if (sm > startMin && sm < endMin) {
        busyApptSlots.set(slot, a);
      }
    });
  });

  // Build busy-block map: blocks spanning multiple slots show on intermediate slots too
  const busyBlockSlots = new Map<string, TimeBlock>();
  dayBlocks.forEach((b) => {
    const startMin = slotToMin(b.timeStart);
    const endMin = slotToMin(b.timeEnd);
    SCHEDULE_SLOTS.forEach((slot) => {
      const sm = slotToMin(slot);
      if (sm > startMin && sm < endMin) {
        busyBlockSlots.set(slot, b);
      }
    });
  });

  // Dates with events (for calendar dots)
  const eventDates = new Set<string>();
  activeAppts.forEach((a) => eventDates.add(a.date));
  timeBlocks.forEach((b) => eventDates.add(b.date));
  const datesWithEvents = Array.from(eventDates).map((d) => new Date(d + 'T12:00:00'));

  // Time off summary
  const PTO_ALLOWANCE = 20;
  const SICK_ALLOWANCE = 10;
  const ptoRequests = timeBlocks.filter((b) => b.type === 'PTO' || b.type === 'Sick Day');
  const ptoPending = ptoRequests.filter((b) => b.status === 'Pending').length;
  const ptoApproved = ptoRequests.filter((b) => b.status === 'Approved').length;
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
    const from12 = (t24: string) => {
      let [h, m] = t24.split(':').map(Number);
      const ap = h >= 12 ? 'PM' : 'AM';
      if (h > 12) h -= 12;
      if (h === 0) h = 12;
      return `${h}:${m.toString().padStart(2, '0')} ${ap}`;
    };
    const isRequest = editBlockType === 'PTO' || editBlockType === 'Sick Day';
    const updated: TimeBlock = {
      ...editingBlock,
      type: editBlockType,
      date: editBlockDate,
      timeStart: from12(editBlockTimeStart),
      timeEnd: from12(editBlockTimeEnd),
      notes: editBlockNotes,
      status: isRequest ? (editingBlock.status === 'Confirmed' ? 'Pending' : editingBlock.status) : 'Confirmed',
    };
    // Update local state
    setTimeBlocks((prev) => prev.map((b) => b.id === editingBlock.id ? updated : b));
    // Update in Supabase
    if (editingBlock.dbId) {
      supabase.from('staff_time_blocks').update({
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
      supabase.from('staff_time_blocks').delete().eq('id', editingBlock.dbId).then(({ error }) => {
        if (error) console.warn('Block delete error:', error.message);
      });
    }
    setEditBlockDialogOpen(false);
    setEditingBlock(null);
  };

  const handleSaveBlock = async () => {
    const from12 = (t24: string) => {
      let [h, m] = t24.split(':').map(Number);
      const ap = h >= 12 ? 'PM' : 'AM';
      if (h > 12) h -= 12;
      if (h === 0) h = 12;
      return `${h}:${m.toString().padStart(2, '0')} ${ap}`;
    };
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
        timeStart: from12(blockTimeStart),
        timeEnd: from12(blockTimeEnd),
        notes: blockNotes,
        status: isRequest ? 'Pending' : 'Confirmed',
      });
      dbRows.push({
        organization_id: '00000000-0000-0000-0000-000000000001',
        clinic_id: '00000000-0000-0000-0000-000000000002',
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
    const { data: inserted, error } = await supabase.from('staff_time_blocks').insert(dbRows).select('id');
    if (error) {
      console.warn('Block save error:', error.message);
    } else if (inserted) {
      // Attach DB IDs to new blocks
      inserted.forEach((row: any, i: number) => {
        if (newBlocks[i]) newBlocks[i].dbId = row.id;
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
        style={{ borderRadius: '12px', borderTop: '4px solid #2D6A4F' }}
      >
        <div className="flex items-center gap-6">
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar className="w-16 h-16">
              <AvatarImage src={vetProfile.image} alt={vetProfile.name} className="object-cover" />
              <AvatarFallback>{vetProfile.name.split(' ').filter(w => w[0] && w[0] === w[0].toUpperCase()).map(w => w[0]).join('').slice(0, 2)}</AvatarFallback>
            </Avatar>
            <button
              title="Change photo"
              style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 22, height: 22, borderRadius: '50%',
                backgroundColor: '#2D6A4F', border: '2px solid var(--surface-white)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0,
              }}
            >
              <Camera style={{ width: 11, height: 11, color: '#fff' }} />
            </button>
          </div>
          <div className="flex-1">
            <h1 className="text-[var(--text-primary)]" style={{ fontSize: '26px', fontWeight: 700 }}>{vetProfile.name}</h1>
            <p className="text-[var(--brand-green-text)]" style={{ fontSize: '15px', fontWeight: 600 }}>{vetProfile.role} · {vetProfile.specialization}</p>
            <div className="flex items-center gap-3 mt-1">
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
      <div className="grid grid-cols-4 gap-5 mb-8">
        {GLOW_CARDS.map((card) => (
          <GlowStatCard key={card.title} {...card} />
        ))}
      </div>

      {/* ─── Section 3: My Schedule ───────────────────── */}
      <div className="grid gap-6 mb-8" style={{ gridTemplateColumns: '1fr 340px' }}>
        {/* Left: Day Schedule */}
        <div>
          {/* Date Nav */}
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-4 mb-4 flex items-center justify-between" style={{ borderRadius: '12px' }}>
            <div className="flex items-center gap-2">
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
                <button onClick={goToToday} className="ml-2 px-3 py-1 text-[var(--brand-green-text)] border border-[#2D6A4F] hover:bg-[#2D6A4F10] transition-colors" style={{ borderRadius: '6px', fontSize: '13px', fontWeight: 500 }}>
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
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] overflow-hidden" style={{ borderRadius: '12px' }}>
            {SCHEDULE_SLOTS.map((slot, idx) => {
              const appt = apptByTime.get(slot);
              const busyAppt = busyApptSlots.get(slot);
              const block = blockByTime.get(slot);
              const isLast = idx === SCHEDULE_SLOTS.length - 1;

              return (
                <div key={slot} className={`flex items-stretch ${!isLast ? 'border-b border-[var(--border-color)]' : ''}`}>
                  {/* Time Label */}
                  <div className="w-24 flex-shrink-0 px-3 py-3 flex items-center justify-end">
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>{slot}</span>
                  </div>

                  {/* Slot Content */}
                  {appt ? (
                    appt.clientArrived ? (
                      /* ── Arrived client: badge + Start Appointment CTA ── */
                      <div
                        className="flex-1 m-1 px-3 py-3 flex flex-col gap-2.5"
                        style={{
                          backgroundColor: '#2D6A4F14',
                          borderLeft: '4px solid #2D6A4F',
                          borderRadius: '8px',
                          boxShadow: '0 0 0 1px #2D6A4F30',
                        }}
                      >
                        {/* Pet info row */}
                        <div className="flex items-center gap-3">
                          <div className="relative flex-shrink-0">
                            <img src={appt.petImage} alt={appt.petName} className="w-9 h-9 object-cover" style={{ borderRadius: '9999px' }} />
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
                          onClick={() => navigate(`/appointments/${appt.id}/visit`)}
                          className="w-full flex items-center justify-center gap-2 py-2 transition-all hover:opacity-90 active:scale-[0.98]"
                          style={{
                            backgroundColor: '#2D6A4F',
                            color: '#ffffff',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 600,
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          Start Appointment
                        </button>
                      </div>
                    ) : (
                      /* ── Regular appointment block ── */
                      <div
                        className="flex-1 m-1 px-3 py-2.5 flex items-center gap-3"
                        style={{ backgroundColor: '#2D6A4F10', borderLeft: '4px solid #2D6A4F', borderRadius: '8px' }}
                      >
                        {appt.petImage ? (
                          <img src={appt.petImage} alt={appt.petName} className="w-8 h-8 object-cover flex-shrink-0" style={{ borderRadius: '9999px' }} />
                        ) : (
                          <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-white font-semibold" style={{ borderRadius: '9999px', backgroundColor: '#2D6A4F', fontSize: '12px' }}>{appt.petName.slice(0, 2).toUpperCase()}</div>
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
                      style={{ backgroundColor: '#2D6A4F08', borderLeft: '4px solid #2D6A4F60', borderRadius: '8px', opacity: 0.7 }}
                    >
                      {busyAppt.petImage ? (
                        <img src={busyAppt.petImage} alt={busyAppt.petName} className="w-7 h-7 object-cover flex-shrink-0" style={{ borderRadius: '9999px' }} />
                      ) : (
                        <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center text-white font-semibold" style={{ borderRadius: '9999px', backgroundColor: '#2D6A4F', fontSize: '11px' }}>{busyAppt.petName.slice(0, 2).toUpperCase()}</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>{busyAppt.petName} · {busyAppt.service} (cont.)</p>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{busyAppt.timeStart} – {busyAppt.timeEnd}</span>
                    </div>
                  ) : block ? (
                    <div
                      className="flex-1 m-1 px-3 py-2.5 flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
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
        </div>

        {/* Right: Calendar + Quick Actions + Time Off */}
        <div className="space-y-5">
          {/* Mini Calendar */}
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-4 flex justify-center" style={{ borderRadius: '12px' }}>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              modifiers={{ hasEvent: datesWithEvents }}
              modifiersStyles={{
                hasEvent: { fontWeight: 700, textDecoration: 'underline', textDecorationColor: 'var(--brand-green-text)', textUnderlineOffset: '4px' },
              }}
            />
          </div>

          {/* Recent Activity */}
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-5" style={{ borderRadius: '12px' }}>
            <h3 className="text-[var(--text-primary)] mb-4" style={{ fontSize: '16px', fontWeight: 600 }}>Recent Activity</h3>
            <div className="space-y-4">
              {RECENT_ACTIVITY.map((activity, idx) => {
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
                <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '11px' }}>{ptoUsed} used · {ptoPending > 0 ? `${ptoRequests.filter(r => r.type === 'PTO' && r.status === 'Pending').length} pending` : 'none pending'}</p>
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
                <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '11px' }}>{sickUsed} used · {ptoRequests.filter(r => r.type === 'Sick Day' && r.status === 'Pending').length > 0 ? `${ptoRequests.filter(r => r.type === 'Sick Day' && r.status === 'Pending').length} pending` : 'none pending'}</p>
              </div>
            </div>

            {/* Request List */}
            <h4 className="text-[var(--text-secondary)] mb-2" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Requests</h4>
            <div className="space-y-2">
              {ptoRequests.map((req) => {
                const rs = requestStatusStyles[req.status];
                const StatusIcon = rs.icon;
                const d = new Date(req.date + 'T12:00:00');
                return (
                  <div key={req.id} className="flex items-center gap-2 p-2 border border-[var(--border-color)]" style={{ borderRadius: '8px' }}>
                    <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: blockStyles[req.type].bg, borderRadius: '9999px' }}>
                      {(() => { const I = blockStyles[req.type].icon; return <I className="w-3.5 h-3.5" style={{ color: blockStyles[req.type].text }} />; })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[var(--text-primary)] truncate" style={{ fontSize: '13px', fontWeight: 600 }}>{req.type}</p>
                      <p className="text-[var(--text-secondary)]" style={{ fontSize: '11px' }}>{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5" style={{ backgroundColor: rs.bg, color: rs.text, borderRadius: '9999px', fontSize: '11px', fontWeight: 600 }}>
                      <StatusIcon className="w-3 h-3" />
                      {req.status}
                    </span>
                  </div>
                );
              })}
            </div>

            <Button
              onClick={() => openBlockDialog('PTO')}
              className="w-full mt-4 hover:opacity-90"
              style={{ backgroundColor: '#2D6A4F', color: '#fff', border: 'none', gap: '6px' }}
            >
              <Plus className="w-4 h-4" />
              Request Time Off
            </Button>
          </div>
        </div>

        {/* My Patients Table — aligned with schedule column */}
        <div className="bg-[var(--surface-white)] border border-[var(--border-color)]" style={{ borderRadius: '12px' }}>
          <div className="p-5 border-b border-[var(--border-color)] flex items-center justify-between">
            <h3 className="text-[var(--text-primary)]" style={{ fontSize: '18px', fontWeight: 600 }}>My Patients</h3>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                onClick={() => navigate('/clients')}
                variant="outline"
                style={{ fontSize: '12px' }}
              >
                <Plus className="w-3.5 h-3.5" /> Add Client
              </Button>
              <Link to="/clients" className="text-[var(--text-secondary)] flex items-center gap-1 hover:opacity-75 transition-opacity" style={{ fontSize: '12px', fontWeight: 600 }}>
                View all <ChevronRight className="w-[13px] h-[13px]" />
              </Link>
            </div>
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
                {(realPatients.length > 0 ? realPatients : MY_PATIENTS.map(p => ({ ...p, clientId: null, petId: null }))).map((p, idx) => {
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
        </div>
      </div>

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
              <Select value={blockType} onValueChange={(v) => setBlockType(v as BlockType)}>
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
    </div>
  );
}
