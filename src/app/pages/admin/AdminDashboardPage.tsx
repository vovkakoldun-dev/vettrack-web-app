import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router';
import {
  CalendarDays, CheckCircle2, DollarSign, MessageSquare,
  TrendingUp, Clock, MoreHorizontal, Search, X, Users, ArrowRight, ArrowUpRight, UserCheck,
  Receipt, CreditCard, Banknote, Terminal, Plus, Trash2, Pencil, Lock, ChevronRight,
} from 'lucide-react';
import { useAppointmentStatus } from '../../context/AppointmentStatusContext';
import { SERVICE_PRICE_LIST } from '../../data/mockAppointments';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../../components/ui/select';

// ─── Types ────────────────────────────────────────────────────

type ApptStatus = 'Confirmed' | 'Patient Arrived' | 'Waiting for Doctor' | 'In Progress' | 'Ready for Billing' | 'Completed' | 'Cancelled' | 'Pending' | 'Late';
type PaymentStatus = 'Paid' | 'Pending' | 'Overdue';

// ─── Mock Data ────────────────────────────────────────────────

const TODAY_SCHEDULE = []

const RECENT_PAYMENTS = []

const UNREAD_MESSAGES = []

// ─── Status Badge ─────────────────────────────────────────────

const STATUS_STYLES: Record<ApptStatus, { bg: string; color: string }> = {
  'Confirmed':          { bg: '#2D6A4F15', color: '#2D6A4F' },
  'Patient Arrived':    { bg: '#2D6A4F15', color: '#2D6A4F' },
  'Waiting for Doctor': { bg: '#F4A26115', color: '#D97706' },
  'In Progress':        { bg: '#3B82F615', color: '#3B82F6' },
  'Ready for Billing':  { bg: '#8B5CF615', color: '#8B5CF6' },
  'Completed':          { bg: '#6B728015', color: '#6B7280' },
  'Cancelled':          { bg: '#d4183d15', color: '#d4183d' },
  'Pending':            { bg: '#F4A26115', color: '#F4A261' },
  'Late':               { bg: '#F9731615', color: '#F97316' },
};

const PAYMENT_STYLES: Record<PaymentStatus, { bg: string; color: string }> = {
  Paid:    { bg: '#2D6A4F15', color: '#2D6A4F' },
  Pending: { bg: '#F4A26115', color: '#F4A261' },
  Overdue: { bg: '#d4183d15', color: '#d4183d' },
};

function StatusBadge({ status }: { status: ApptStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: '9999px',
      fontSize: '12px', fontWeight: 600,
      backgroundColor: s.bg, color: s.color,
    }}>
      {status}
    </span>
  );
}

// ─── Glow Card Data ───────────────────────────────────────────

const ADMIN_GLOW_CARDS = [
  {
    title: "Today's Appts",
    subtitle: 'Today',
    metricLabel: 'Daily Volume',
    value: '0',
    trendLabel: '+8% this week',
    trendPositive: true,
    color: '#4ADE80',
    shadowColor: 'rgba(74,222,128,0.35)',
    icon: CalendarDays,
    data: [18, 21, 19, 23, 22, 20, 25, 24],
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Mon', 'Tue', 'Today'],
    unit: 'appts',
    annotationStart: '18',
    annotationEnd: '24',
    path: '/admin/bookings',
  },
  {
    title: 'Patients Arrived',
    subtitle: 'Arrived',
    metricLabel: 'Check-in Rate',
    value: '0',
    trendLabel: 'of 24 arrived',
    trendPositive: true,
    color: '#38BDF8',
    shadowColor: 'rgba(56,189,248,0.35)',
    icon: CheckCircle2,
    data: [0, 2, 3, 5, 6, 7, 8, 8],
    labels: ['8AM', '9AM', '10AM', '11AM', '12PM', '1PM', '2PM', 'Now'],
    unit: 'clients',
    annotationStart: '0',
    annotationEnd: '8',
    path: '/admin/bookings',
  },
  {
    title: 'Pending Payments',
    subtitle: 'Outstanding',
    metricLabel: 'Balance Due',
    value: '$1,240',
    trendLabel: '6 outstanding',
    trendPositive: false,
    color: '#F4A261',
    shadowColor: 'rgba(244,162,97,0.35)',
    icon: DollarSign,
    data: [800, 950, 1100, 850, 1200, 1050, 1300, 1240],
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Mon', 'Tue', 'Today'],
    unit: 'USD',
    annotationStart: '$800',
    annotationEnd: '$1,240',
    path: '/admin/payments',
  },
  {
    title: 'New Messages',
    subtitle: 'Unread',
    metricLabel: 'Inbox Volume',
    value: '0',
    trendLabel: '2 need reply',
    trendPositive: false,
    color: '#818CF8',
    shadowColor: 'rgba(129,140,248,0.35)',
    icon: MessageSquare,
    data: [3, 7, 4, 8, 5, 6, 9, 5],
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Mon', 'Tue', 'Today'],
    unit: 'msgs',
    annotationStart: '3',
    annotationEnd: '5',
    path: '/admin/communications',
  },
];

// ─── Helpers ──────────────────────────────────────────────────

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

// ─── GlowStatCard ─────────────────────────────────────────────

function GlowStatCard({
  title, subtitle, metricLabel, value, trendLabel, trendPositive,
  color, shadowColor, icon: Icon, data, labels, unit,
  annotationStart, annotationEnd, path,
}: (typeof ADMIN_GLOW_CARDS)[0]) {
  const dark = useDarkMode();
  const navigate = useNavigate();
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

  const cardBg = dark
    ? 'linear-gradient(145deg, #0D1B2A 0%, #0A1520 60%, #0D1B2A 100%)'
    : 'linear-gradient(145deg, #ffffff 0%, #f8faff 60%, #ffffff 100%)';
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
      onClick={() => navigate(path)}
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        borderRadius: '18px',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: cardShadow,
        cursor: 'pointer',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLElement).style.boxShadow =
          dark
            ? `0 0 0 1px rgba(255,255,255,0.07), 0 24px 70px -10px ${shadowColor}`
            : `0 8px 40px -6px ${shadowColor}, 0 0 0 1px ${color}30`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLElement).style.boxShadow = cardShadow;
      }}
    >
      {/* Corner glow */}
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
          <button
            onClick={e => { e.stopPropagation(); navigate(path); }}
            style={{
              width: '30px', height: '30px', borderRadius: '8px',
              border: `1px solid ${btnBorder}`,
              backgroundColor: btnBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
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
            whiteSpace: 'nowrap',
          }}>
            {trendPositive ? '↑' : '↓'} {trendLabel}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div
        style={{ position: 'relative' }}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: '100px', display: 'block', cursor: 'crosshair' }}
          onMouseMove={(e) => {
            e.stopPropagation();
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
                <line x1={hx} y1={0} x2={hx} y2={VH}
                  stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
                <circle cx={hx} cy={hy} r="8" fill={color} opacity="0.18" />
                <circle cx={hx} cy={hy} r="5" fill={color} filter={`url(#bloom-${uid})`} opacity="0.8" />
                <circle cx={hx} cy={hy} r="4" fill={color} />
                <circle cx={hx} cy={hy} r="2" fill="#fff" />
              </>
            );
          })()}
        </svg>

        {/* Floating tooltip */}
        {hoveredIdx !== null && (() => {
          const hx = pts[hoveredIdx].x;
          const hy = pts[hoveredIdx].y;
          const dotFromBottom = VH - hy;
          const tooltipBg = dark ? '#1a2a3a' : '#ffffff';
          const tooltipBorder = `${color}55`;
          const tooltipShadow = dark
            ? `0 4px 20px rgba(0,0,0,0.5), 0 0 12px ${color}30`
            : `0 4px 20px rgba(0,0,0,0.12), 0 0 10px ${color}20`;
          const labelCol = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
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
              }}
            >
              <div style={{ fontSize: '10px', color: labelCol, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '2px' }}>
                {labels[hoveredIdx]}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '18px', fontWeight: 800, color, lineHeight: 1 }}>
                  {data[hoveredIdx].toLocaleString()}
                </span>
                <span style={{ fontSize: '10px', fontWeight: 600, color: unitCol }}>
                  {unit}
                </span>
              </div>
              <div style={{
                position: 'absolute', bottom: '-5px', left: '50%',
                width: '9px', height: '9px',
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

// ─── Search-matched types ─────────────────────────────────────

const ALL_CLIENTS = [
  { id: 1, name: 'John Smith',      pet: 'Max',     petType: 'Golden Retriever', phone: '(555) 234-5678', balance: '$0'    },
  { id: 2, name: 'Emily Johnson',   pet: 'Luna',    petType: 'Tabby Cat',        phone: '(555) 345-6789', balance: '$85'   },
  { id: 3, name: 'Michael Brown',   pet: 'Cooper',  petType: 'Beagle',           phone: '(555) 456-7890', balance: '$0'    },
  { id: 4, name: 'Sarah Williams',  pet: 'Bella',   petType: 'Siamese Cat',      phone: '(555) 567-8901', balance: '$250'  },
  { id: 5, name: 'David Miller',    pet: 'Charlie', petType: 'Corgi',            phone: '(555) 678-9012', balance: '$0'    },
  { id: 6, name: 'James Wilson',    pet: 'Rocky',   petType: 'Labrador',         phone: '(555) 789-0123', balance: '$120'  },
  { id: 7, name: 'Jessica Taylor',  pet: 'Milo',    petType: 'Poodle',           phone: '(555) 890-1234', balance: '$0'    },
  { id: 8, name: 'Robert Anderson', pet: 'Daisy',   petType: 'Border Collie',    phone: '(555) 901-2345', balance: '$320'  },
];

const ALL_BOOKINGS = TODAY_SCHEDULE.map((a) => ({
  ...a,
  phone: '(555) 100-0000',
  date: 'Today',
}));

// ─── Page ─────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { overrides, setApptStatus } = useAppointmentStatus();
  const [checkedIn, setCheckedIn] = useState<Set<number>>(new Set());
  const [now, setNow] = useState(() => new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const [arrivedToast, setArrivedToast] = useState<{ pet: string; vet: string } | null>(null);
  const [billModal, setBillModal] = useState<{ id: number; pet: string; owner: string; service: string; vet: string } | null>(null);
  const [payMethod, setPayMethod] = useState<'card' | 'terminal' | 'cash'>('card');
  const [billPaid, setBillPaid] = useState<Set<number>>(new Set());
  const [invoiceEditing, setInvoiceEditing] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState<{ id: number; label: string; desc: string; price: number }[]>([]);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [viewModal, setViewModal] = useState<(typeof TODAY_SCHEDULE)[0] | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // ── Initialize invoice items when bill modal opens ──────────
  useEffect(() => {
    if (billModal) {
      const SERVICE_PRICES: Record<string, number> = {
        'Annual Checkup': 85, 'Checkup': 65, 'Vaccination': 55,
        'Dental Cleaning': 180, 'Follow-up': 55, 'Emergency': 220,
        'Surgery Consult': 150, 'Surgery': 480, 'Other': 75,
      };
      const basePrice = SERVICE_PRICES[billModal.service] ?? 85;
      setInvoiceItems([{ id: Date.now(), label: billModal.service, desc: billModal.vet, price: basePrice }]);
      setInvoiceEditing(false);
      setNewItemLabel('');
      setNewItemPrice('');
      setPayMethod('card');
    }
  }, [billModal?.id]);

  function isApptLate(timeStr: string): boolean {
    const [timePart, period] = timeStr.split(' ');
    const [h, m] = timePart.split(':').map(Number);
    const hours = period === 'PM' && h !== 12 ? h + 12 : period === 'AM' && h === 12 ? 0 : h;
    const apptMinutes = hours * 60 + m;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return nowMinutes > apptMinutes;
  }

  function handleCheckIn(id: number) {
    const appt = TODAY_SCHEDULE.find(a => a.id === id);
    setCheckedIn(prev => new Set([...prev, id]));
    setApptStatus(id, 'Waiting for Doctor');
    if (appt) {
      setArrivedToast({ pet: appt.pet, vet: appt.vet });
      setTimeout(() => setArrivedToast(null), 4000);
    }
  }

  // ── Search ──────────────────────────────────────────────────
  const q = searchQuery.trim().toLowerCase();
  const matchedClients = q
    ? ALL_CLIENTS.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.pet.toLowerCase().includes(q) ||
          c.petType.toLowerCase().includes(q)
      )
    : [];
  const matchedBookings = q
    ? ALL_BOOKINGS.filter(
        (a) =>
          a.pet.toLowerCase().includes(q) ||
          a.owner.toLowerCase().includes(q) ||
          a.service.toLowerCase().includes(q) ||
          a.vet.toLowerCase().includes(q)
      )
    : [];
  const hasResults = matchedClients.length > 0 || matchedBookings.length > 0;
  const isSearching = q.length > 0;

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '32px' }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 className="text-[var(--text-primary)]" style={{ marginBottom: '6px' }}>
          Good morning, Sarah 👋
        </h1>
        <p className="text-[var(--text-secondary)]" style={{ fontSize: '16px' }}>
          Here's your clinic overview for today
        </p>
      </div>

      {/* ── Global Search ── */}
      <div style={{ position: 'relative', marginBottom: '28px' }}>
        <Search
          style={{
            position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
            width: '16px', height: '16px', color: 'var(--text-secondary)', pointerEvents: 'none',
          }}
        />
        <input
          ref={searchRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search clients, pets, bookings, vets…"
          className="w-full bg-[var(--surface-white)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-shadow focus:outline-none"
          style={{
            height: '48px',
            borderRadius: '12px',
            paddingLeft: '44px',
            paddingRight: searchQuery ? '44px' : '16px',
            fontSize: '15px',
            boxShadow: isSearching ? '0 0 0 2px #2D6A4F40' : undefined,
            borderColor: isSearching ? '#2D6A4F60' : undefined,
          }}
        />
        {searchQuery && (
          <button
            onClick={() => { setSearchQuery(''); searchRef.current?.focus(); }}
            style={{
              position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
              width: '28px', height: '28px', borderRadius: '9999px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
            }}
            className="hover:bg-[var(--surface-elevated)] transition-colors"
          >
            <X style={{ width: '14px', height: '14px' }} />
          </button>
        )}
      </div>

      {/* ── Search Results ── */}
      {isSearching ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {!hasResults ? (
            <div
              className="bg-[var(--surface-white)] border border-[var(--border-color)]"
              style={{ borderRadius: '12px', padding: '48px', textAlign: 'center' }}
            >
              <Search style={{ width: '40px', height: '40px', color: 'var(--border-color)', margin: '0 auto 12px' }} />
              <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>No results found</p>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Try searching for a client name, pet, service, or vet</p>
            </div>
          ) : (
            <>
              {/* Client results */}
              {matchedClients.length > 0 && (
                <div
                  className="bg-[var(--surface-white)] border border-[var(--border-color)]"
                  style={{ borderRadius: '12px', overflow: 'hidden' }}
                >
                  <div
                    className="border-b border-[var(--border-color)] flex items-center gap-2"
                    style={{ padding: '12px 20px' }}
                  >
                    <Users style={{ width: '14px', height: '14px', color: 'var(--brand-green-text)' }} />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Clients · {matchedClients.length}
                    </span>
                  </div>
                  {matchedClients.map((c, i) => (
                    <div
                      key={c.id}
                      onClick={() => navigate('/admin/clients')}
                      className="flex items-center gap-4 cursor-pointer hover:bg-[var(--surface-elevated)] transition-colors"
                      style={{
                        padding: '14px 20px',
                        borderTop: i > 0 ? '1px solid var(--border-color)' : undefined,
                      }}
                    >
                      <div
                        className="flex items-center justify-center text-white font-bold flex-shrink-0"
                        style={{
                          width: '40px', height: '40px', borderRadius: '9999px',
                          background: 'linear-gradient(135deg, #2D6A4F, #74C69D)',
                          fontSize: '13px',
                        }}
                      >
                        {c.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</p>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{c.pet} · {c.petType}</p>
                      </div>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flexShrink: 0 }}>{c.phone}</span>
                      {parseFloat(c.balance.replace('$', '')) > 0 && (
                        <span style={{
                          padding: '3px 10px', borderRadius: '9999px',
                          fontSize: '12px', fontWeight: 600,
                          backgroundColor: '#d4183d15', color: '#d4183d', flexShrink: 0,
                        }}>
                          Owes {c.balance}
                        </span>
                      )}
                      <ArrowRight style={{ width: '14px', height: '14px', color: 'var(--text-secondary)', flexShrink: 0 }} />
                    </div>
                  ))}
                </div>
              )}

              {/* Booking results */}
              {matchedBookings.length > 0 && (
                <div
                  className="bg-[var(--surface-white)] border border-[var(--border-color)]"
                  style={{ borderRadius: '12px', overflow: 'hidden' }}
                >
                  <div
                    className="border-b border-[var(--border-color)] flex items-center gap-2"
                    style={{ padding: '12px 20px' }}
                  >
                    <CalendarDays style={{ width: '14px', height: '14px', color: '#F4A261' }} />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Today's Bookings · {matchedBookings.length}
                    </span>
                  </div>
                  {matchedBookings.map((a, i) => {
                    const contextStatus2 = overrides[a.id] as ApptStatus | undefined;
                    const effectiveStatus: ApptStatus =
                      billPaid.has(a.id) ? 'Completed'
                      : contextStatus2 ?? (
                          a.status === 'Confirmed' && isApptLate(a.time) ? 'Late'
                          : a.status
                        );
                    const s = STATUS_STYLES[effectiveStatus];
                    return (
                      <div
                        key={a.id}
                        onClick={() => navigate('/admin/bookings')}
                        className="flex items-center gap-4 cursor-pointer hover:bg-[var(--surface-elevated)] transition-colors"
                        style={{
                          padding: '14px 20px',
                          borderTop: i > 0 ? '1px solid var(--border-color)' : undefined,
                        }}
                      >
                        <div
                          className="flex items-center justify-center text-white font-bold flex-shrink-0"
                          style={{
                            width: '40px', height: '40px', borderRadius: '9999px',
                            background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
                            fontSize: '13px',
                          }}
                        >
                          {a.pet.slice(0, 2)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{a.pet}</p>
                          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{a.owner} · {a.service}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                          <Clock style={{ width: '13px', height: '13px' }} />
                          {a.time} · {a.vet}
                        </div>
                        <span style={{
                          padding: '3px 10px', borderRadius: '9999px',
                          fontSize: '12px', fontWeight: 600,
                          backgroundColor: s.bg, color: s.color, flexShrink: 0,
                        }}>
                          {effectiveStatus}
                        </span>
                        <ArrowRight style={{ width: '14px', height: '14px', color: 'var(--text-secondary)', flexShrink: 0 }} />
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <>

      {/* Glow Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '28px' }}>
        {ADMIN_GLOW_CARDS.map(card => (
          <GlowStatCard key={card.title} {...card} />
        ))}
      </div>

      {/* Today's Schedule */}
      <div
        className="bg-[var(--surface-white)] border border-[var(--border-color)]"
        style={{ borderRadius: '12px', marginBottom: '24px', overflow: 'hidden' }}
      >
        <div
          className="border-b border-[var(--border-color)] flex items-center justify-between"
          style={{ padding: '20px 24px' }}
        >
          <div>
            <h3 className="text-[var(--text-primary)]">Today's Schedule</h3>
            <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px', marginTop: '2px' }}>
              {TODAY_SCHEDULE.length} appointments scheduled for today
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Mar 14, 2026
            </span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr className="border-b border-[var(--border-color)]" style={{ backgroundColor: 'var(--bg-offwhite)' }}>
                {['Time', 'Pet', 'Owner', 'Phone', 'Service', 'Vet', 'Status', 'Action'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '12px 16px', textAlign: 'left',
                      fontSize: '12px', fontWeight: 700,
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TODAY_SCHEDULE.map((appt, idx) => {
                const contextStatus = overrides[appt.id] as ApptStatus | undefined;
                const effectiveStatus: ApptStatus =
                  billPaid.has(appt.id) ? 'Completed'
                  : contextStatus ?? (
                      appt.status === 'Confirmed' && isApptLate(appt.time) ? 'Late'
                      : appt.status
                    );

                return (
                  <tr
                    key={appt.id}
                    className="border-b border-[var(--border-color)] hover:bg-[var(--surface-elevated)] transition-colors"
                    style={{ borderBottom: idx === TODAY_SCHEDULE.length - 1 ? 'none' : undefined }}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <div className="flex items-center gap-1.5">
                        <Clock style={{ width: '13px', height: '13px', color: 'var(--text-secondary)', flexShrink: 0 }} />
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                          {appt.time}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {appt.pet}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        {appt.owner}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {appt.phone}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                        {appt.service}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {appt.vet}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <StatusBadge status={effectiveStatus} />
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {(effectiveStatus === 'Confirmed' || effectiveStatus === 'Late') ? (
                        <button
                          onClick={() => handleCheckIn(appt.id)}
                          style={{
                            padding: '6px 12px', borderRadius: '7px',
                            backgroundColor: '#2D6A4F', color: '#fff',
                            border: 'none', cursor: 'pointer',
                            fontSize: '13px', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: '5px',
                            transition: 'opacity 0.15s', whiteSpace: 'nowrap',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                        >
                          <UserCheck style={{ width: '13px', height: '13px' }} />
                          Patient Arrived
                        </button>
                      ) : effectiveStatus === 'Ready for Billing' ? (
                        <button
                          onClick={() => setBillModal({ id: appt.id, pet: appt.pet, owner: appt.owner, service: appt.service, vet: appt.vet })}
                          style={{
                            padding: '6px 12px', borderRadius: '7px',
                            backgroundColor: '#8B5CF6', color: '#fff',
                            border: 'none', cursor: 'pointer',
                            fontSize: '13px', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: '5px',
                            transition: 'opacity 0.15s', whiteSpace: 'nowrap',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                        >
                          <Receipt style={{ width: '13px', height: '13px' }} />
                          Show Bill
                        </button>
                      ) : effectiveStatus === 'Completed' ? (
                        <button
                          onClick={() => setViewModal(appt)}
                          style={{
                            padding: '6px 14px', borderRadius: '7px',
                            backgroundColor: 'var(--surface-elevated)', color: 'var(--text-secondary)',
                            border: '1px solid var(--border-color)', cursor: 'pointer',
                            fontSize: '13px', fontWeight: 600,
                            transition: 'opacity 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                        >
                          View
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom row: Recent Payments + Unread Messages */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

        {/* Recent Payments */}
        <div
          className="bg-[var(--surface-white)] border border-[var(--border-color)]"
          style={{ borderRadius: '12px', overflow: 'hidden' }}
        >
          <div className="border-b border-[var(--border-color)] flex items-center justify-between" style={{ padding: '20px 24px' }}>
            <h3 className="text-[var(--text-primary)]">Recent Payments</h3>
            <Link
              to="/admin/payments"
              className="flex items-center gap-1 text-[var(--text-secondary)] hover:opacity-75 transition-opacity"
              style={{ fontSize: '12px', fontWeight: 600 }}
            >
              View all <ChevronRight className="w-[13px] h-[13px]" />
            </Link>
          </div>
          <div style={{ padding: '8px 0' }}>
            {RECENT_PAYMENTS.map((payment, idx) => {
              const ps = PAYMENT_STYLES[payment.status];
              return (
                <div
                  key={payment.id}
                  className="flex items-center gap-4 hover:bg-[var(--surface-elevated)] transition-colors"
                  style={{
                    padding: '14px 24px',
                    borderBottom: idx < RECENT_PAYMENTS.length - 1 ? '1px solid var(--border-color)' : 'none',
                  }}
                >
                  <div
                    className="flex items-center justify-center text-white font-bold flex-shrink-0"
                    style={{
                      width: '38px', height: '38px', borderRadius: '9999px',
                      background: 'linear-gradient(135deg, #2D6A4F, #74C69D)',
                      fontSize: '12px',
                    }}
                  >
                    {payment.pet.slice(0, 1)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {payment.pet}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {payment.owner}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {payment.amount}
                    </span>
                    <span style={{
                      padding: '3px 10px', borderRadius: '9999px',
                      fontSize: '12px', fontWeight: 600,
                      backgroundColor: ps.bg, color: ps.color,
                    }}>
                      {payment.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Unread Messages */}
        <div
          className="bg-[var(--surface-white)] border border-[var(--border-color)]"
          style={{ borderRadius: '12px', overflow: 'hidden' }}
        >
          <div className="border-b border-[var(--border-color)] flex items-center justify-between" style={{ padding: '20px 24px' }}>
            <div className="flex items-center gap-2">
              <h3 className="text-[var(--text-primary)]">Unread Messages</h3>
              <span style={{
                padding: '2px 8px', borderRadius: '9999px',
                backgroundColor: '#d4183d15', color: '#d4183d',
                fontSize: '12px', fontWeight: 700,
              }}>
                5
              </span>
            </div>
            <Link
              to="/admin/communications"
              className="flex items-center gap-1 text-[var(--text-secondary)] hover:opacity-75 transition-opacity"
              style={{ fontSize: '12px', fontWeight: 600 }}
            >
              View all <ChevronRight className="w-[13px] h-[13px]" />
            </Link>
          </div>
          <div style={{ padding: '8px 0' }}>
            {UNREAD_MESSAGES.map((msg, idx) => (
              <div
                key={msg.id}
                className="flex items-start gap-3 hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
                style={{
                  padding: '14px 24px',
                  borderBottom: idx < UNREAD_MESSAGES.length - 1 ? '1px solid var(--border-color)' : 'none',
                }}
              >
                <div
                  className="flex items-center justify-center text-white font-bold flex-shrink-0"
                  style={{
                    width: '38px', height: '38px', borderRadius: '9999px',
                    background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
                    fontSize: '12px',
                  }}
                >
                  {msg.initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: '2px' }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {msg.name}
                    </p>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flexShrink: 0, marginLeft: '8px' }}>
                      {msg.time}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    Re: {msg.pet}
                  </p>
                  <p style={{
                    fontSize: '13px', color: 'var(--text-secondary)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    marginTop: '2px',
                  }}>
                    {msg.preview}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

        </>
      )}

      {/* ─── View Modal (Completed appointments) ────── */}
      {viewModal && (() => {
        const SERVICE_PRICES: Record<string, number> = {
          'Annual Checkup': 85, 'Checkup': 65, 'Vaccination': 55,
          'Dental Cleaning': 180, 'Follow-up': 55, 'Emergency': 220,
          'Surgery Consult': 150, 'Surgery': 480, 'Other': 75,
        };
        const basePrice = SERVICE_PRICES[viewModal.service] ?? 85;
        const tax = parseFloat((basePrice * 0.08).toFixed(2));
        const total = basePrice + tax;

        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 300, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
            onClick={() => setViewModal(null)}
          >
            <div
              style={{ backgroundColor: 'var(--surface-white)', borderRadius: 16, width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.2)', overflow: 'hidden' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Top bar */}
              <div style={{ height: 4, background: 'linear-gradient(90deg, #6B7280, #9CA3AF)' }} />

              {/* Header */}
              <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Appointment Overview</p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{viewModal.time} · {viewModal.service}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ padding: '3px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 600, backgroundColor: '#6B728015', color: '#6B7280' }}>
                    Completed
                  </span>
                  <button onClick={() => setViewModal(null)} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer', backgroundColor: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Patient row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ borderRadius: 10, border: '1px solid var(--border-color)', padding: '12px 14px' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Patient</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{viewModal.pet}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{viewModal.owner}</p>
                  </div>
                  <div style={{ borderRadius: 10, border: '1px solid var(--border-color)', padding: '12px 14px' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Vet</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{viewModal.vet}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{viewModal.service}</p>
                  </div>
                </div>

                {/* Details row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ borderRadius: 10, border: '1px solid var(--border-color)', padding: '12px 14px' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Time</p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{viewModal.time}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Mar 15, 2026</p>
                  </div>
                  <div style={{ borderRadius: 10, border: '1px solid var(--border-color)', padding: '12px 14px' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Phone</p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{viewModal.phone}</p>
                  </div>
                </div>

                {/* Invoice summary */}
                <div style={{ borderRadius: 10, border: '1px solid var(--border-color)', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Invoice Total</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{viewModal.service} + 8% tax</p>
                  </div>
                  <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand-green-text)' }}>${total.toFixed(2)}</span>
                </div>

                <button
                  onClick={() => setViewModal(null)}
                  style={{
                    width: '100%', padding: '10px', borderRadius: 10,
                    border: '1px solid var(--border-color)', cursor: 'pointer',
                    backgroundColor: 'var(--surface-elevated)', color: 'var(--text-secondary)',
                    fontSize: 13, fontWeight: 600, transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── Bill Modal ──────────────────────────────── */}
      {billModal && (() => {
        const subtotal = invoiceItems.reduce((s, item) => s + item.price, 0);
        const tax = parseFloat((subtotal * 0.08).toFixed(2));
        const total = subtotal + tax;

        const addInvoiceItem = () => {
          if (!newItemLabel) return;
          const preset = SERVICE_PRICE_LIST.find(p => p.name === newItemLabel);
          const price = preset?.price ?? 0;
          setInvoiceItems(prev => [...prev, { id: Date.now(), label: newItemLabel, desc: '', price }]);
          setNewItemLabel('');
          setNewItemPrice('');
        };

        const removeInvoiceItem = (id: number) =>
          setInvoiceItems(prev => prev.filter(i => i.id !== id));

        const updateItemService = (id: number, serviceName: string) => {
          const preset = SERVICE_PRICE_LIST.find(p => p.name === serviceName);
          setInvoiceItems(prev => prev.map(i =>
            i.id === id ? { ...i, label: serviceName, price: preset?.price ?? i.price } : i
          ));
        };

        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 300, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
            onClick={e => { if (e.target === e.currentTarget) setBillModal(null); }}
          >
            <div
              style={{ backgroundColor: 'var(--surface-white)', borderRadius: 16, width: '100%', maxWidth: 500, boxShadow: '0 24px 64px rgba(0,0,0,0.2)', overflow: 'hidden', maxHeight: '92vh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Top accent bar */}
              <div style={{ height: 4, background: 'linear-gradient(90deg, #8B5CF6, #3B82F6)', flexShrink: 0 }} />

              {/* Header */}
              <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#8B5CF615', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Receipt style={{ width: 17, height: 17, color: '#8B5CF6' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Invoice Summary</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>{billModal.pet} · {billModal.owner}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => setInvoiceEditing(e => !e)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8,
                      border: invoiceEditing ? '1.5px solid #8B5CF6' : '1.5px solid var(--border-color)',
                      backgroundColor: invoiceEditing ? '#8B5CF610' : 'var(--surface-elevated)',
                      color: invoiceEditing ? '#8B5CF6' : 'var(--text-secondary)',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <Pencil style={{ width: 12, height: 12 }} />
                    {invoiceEditing ? 'Done' : 'Edit'}
                  </button>
                  <button onClick={() => setBillModal(null)} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer', backgroundColor: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>

              {/* Line items */}
              <div style={{ padding: '16px 22px' }}>
                <div style={{ borderRadius: 10, border: `1.5px solid ${invoiceEditing ? '#8B5CF630' : 'var(--border-color)'}`, overflow: 'hidden', marginBottom: 16, transition: 'border-color 0.2s' }}>
                  {/* Table header */}
                  <div style={{ display: 'grid', gridTemplateColumns: invoiceEditing ? '1fr 100px 36px' : '1fr auto', padding: '9px 14px', backgroundColor: invoiceEditing ? '#8B5CF608' : 'var(--surface-elevated)', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Service</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Amount</span>
                    {invoiceEditing && <span />}
                  </div>

                  {/* Existing line items */}
                  {invoiceItems.map((item, idx) => (
                    <div
                      key={item.id}
                      style={{ display: 'grid', gridTemplateColumns: invoiceEditing ? '1fr 110px 36px' : '1fr auto', padding: '11px 14px', borderTop: '1px solid var(--border-color)', gap: 8, alignItems: 'center' }}
                    >
                      {invoiceEditing ? (
                        <>
                          {/* Service select — matches CheckoutPage */}
                          <Select value={item.label} onValueChange={v => updateItemService(item.id, v)}>
                            <SelectTrigger style={{ fontSize: 13, height: 34, borderRadius: 7 }}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-64 !z-[500]">
                              {SERVICE_PRICE_LIST.map(p => (
                                <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {/* Price — read-only with lock, just like CheckoutPage */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 10px', height: 34, borderRadius: 7, border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)', cursor: 'not-allowed' }} title="Price set by administrator">
                            <Lock style={{ width: 11, height: 11, color: 'var(--text-secondary)', flexShrink: 0 }} />
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>${item.price.toFixed(2)}</span>
                          </div>

                          {/* Remove */}
                          <button
                            onClick={() => removeInvoiceItem(item.id)}
                            disabled={invoiceItems.length === 1 && idx === 0}
                            style={{ width: 32, height: 32, borderRadius: 8, border: 'none', backgroundColor: invoiceItems.length === 1 ? 'transparent' : '#d4183d12', color: invoiceItems.length === 1 ? 'var(--border-color)' : '#d4183d', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: invoiceItems.length === 1 ? 'not-allowed' : 'pointer' }}
                          >
                            <Trash2 style={{ width: 14, height: 14 }} />
                          </button>
                        </>
                      ) : (
                        <>
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{item.label}</p>
                            {item.desc && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>{item.desc}</p>}
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right', alignSelf: 'center' }}>${item.price.toFixed(2)}</span>
                        </>
                      )}
                    </div>
                  ))}

                  {/* Add item row (edit mode only) */}
                  {invoiceEditing && (
                    <div style={{ padding: '10px 14px', borderTop: '1px dashed #8B5CF630', backgroundColor: '#8B5CF604', display: 'flex', gap: 8, alignItems: 'center' }}>
                      {/* Service dropdown — same price list as CheckoutPage */}
                      <div style={{ flex: 1 }}>
                        <Select value={newItemLabel} onValueChange={v => {
                          setNewItemLabel(v);
                          const preset = SERVICE_PRICE_LIST.find(p => p.name === v);
                          setNewItemPrice(String(preset?.price ?? ''));
                        }}>
                          <SelectTrigger style={{ fontSize: 13, height: 34, borderRadius: 7, border: '1.5px dashed #8B5CF650', backgroundColor: 'var(--surface-white)' }}>
                            <SelectValue placeholder="Select a service to add…" />
                          </SelectTrigger>
                          <SelectContent className="max-h-64 !z-[500]">
                            {SERVICE_PRICE_LIST.map(p => (
                              <SelectItem key={p.name} value={p.name}>
                                <span className="flex items-center justify-between gap-8 w-full">
                                  <span>{p.name}</span>
                                  <span style={{ color: 'var(--text-secondary)', fontSize: 12, marginLeft: 'auto' }}>${p.price.toFixed(2)}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Auto-filled price preview */}
                      {newItemLabel && newItemPrice && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 10px', height: 34, borderRadius: 7, border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)', whiteSpace: 'nowrap' }}>
                          <Lock style={{ width: 11, height: 11, color: 'var(--text-secondary)', flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>${parseFloat(newItemPrice).toFixed(2)}</span>
                        </div>
                      )}

                      {/* Add button */}
                      <button
                        onClick={addInvoiceItem}
                        disabled={!newItemLabel}
                        style={{ width: 34, height: 34, borderRadius: 8, border: 'none', backgroundColor: newItemLabel ? '#8B5CF6' : 'var(--surface-elevated)', color: newItemLabel ? '#fff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: newItemLabel ? 'pointer' : 'not-allowed', flexShrink: 0, transition: 'all 0.15s' }}
                        title="Add to invoice"
                      >
                        <Plus style={{ width: 15, height: 15 }} />
                      </button>
                    </div>
                  )}

                  {/* Totals */}
                  <div style={{ padding: '9px 14px 12px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Subtotal</span>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>${subtotal.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Tax (8%)</span>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>${tax.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--border-color)', marginTop: 2 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Total</span>
                      <span style={{ fontSize: 20, fontWeight: 800, color: '#8B5CF6' }}>${total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment method */}
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Payment Method</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
                  {([
                    { key: 'card' as const,     label: 'Card on File', Icon: CreditCard },
                    { key: 'terminal' as const,  label: 'Card Machine', Icon: Terminal },
                    { key: 'cash' as const,      label: 'Cash',         Icon: Banknote },
                  ]).map(({ key, label, Icon }) => {
                    const active = payMethod === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setPayMethod(key)}
                        style={{
                          padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                          border: `2px solid ${active ? '#8B5CF6' : 'var(--border-color)'}`,
                          backgroundColor: active ? '#8B5CF610' : 'var(--surface-elevated)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                          transition: 'all 0.15s',
                        }}
                      >
                        <Icon style={{ width: 18, height: 18, color: active ? '#8B5CF6' : 'var(--text-secondary)' }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: active ? '#8B5CF6' : 'var(--text-secondary)' }}>{label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Process button */}
                <button
                  onClick={() => {
                    setBillPaid(prev => new Set([...prev, billModal.id]));
                    setBillModal(null);
                  }}
                  style={{
                    width: '100%', padding: '13px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    backgroundColor: '#8B5CF6', color: '#fff', fontSize: 14, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  <CheckCircle2 style={{ width: 16, height: 16 }} />
                  Process Payment · ${total.toFixed(2)}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── Patient Arrived Toast ──────────────────── */}
      {arrivedToast && (
        <div
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 200,
            maxWidth: 360, borderRadius: 14,
            backgroundColor: 'var(--surface-white)',
            border: '1.5px solid #2D6A4F40',
            boxShadow: '0 8px 32px rgba(0,0,0,0.16), 0 0 0 1px rgba(45,106,79,0.08)',
            overflow: 'hidden',
            animation: 'slideUp 0.25s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <div style={{ height: 3, background: 'linear-gradient(90deg, #2D6A4F, #74C69D)' }} />
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#2D6A4F15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              <UserCheck style={{ width: 16, height: 16, color: 'var(--brand-green-text)' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>Waiting for Doctor</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {arrivedToast.pet} is waiting — {arrivedToast.vet} has been notified.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
