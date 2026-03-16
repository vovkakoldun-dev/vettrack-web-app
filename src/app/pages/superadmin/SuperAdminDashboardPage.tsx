import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Crown, PawPrint, Calendar, DollarSign, Users,
  AlertTriangle, MoreHorizontal, Plus, FileText, Settings, BarChart2,
  CheckCircle2, ClipboardList, BookOpen, Lock, UserPlus, RefreshCw,
  ArrowUpRight, Bell, Umbrella, AlertCircle, X, Check, ChevronRight,
} from 'lucide-react';

// ─── Sparkline helpers ────────────────────────────────────────

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

// ─── Notifications Panel ──────────────────────────────────────

type NotifStatus = 'pending' | 'approved' | 'declined';

interface Notification {
  id: number;
  type: 'pto' | 'shift_swap' | 'overdue' | 'reassign';
  avatar: string;
  avatarColor: string;
  title: string;
  detail: string;
  meta: string;
  status: NotifStatus;
}

const INITIAL_NOTIFS: Notification[] = [
  {
    id: 1, type: 'pto', avatar: 'SP', avatarColor: '#8B5CF6',
    title: 'Priya Sharma — PTO Request',
    detail: 'Requesting time off Mar 20–22 (3 days)',
    meta: 'Submitted 2h ago · Front Desk',
    status: 'pending',
  },
  {
    id: 2, type: 'shift_swap', avatar: 'JW', avatarColor: '#3B82F6',
    title: 'James Wilson — Shift Swap',
    detail: 'Swap Saturday Mar 22 with Emma Thompson',
    meta: 'Submitted 4h ago · Front Desk',
    status: 'pending',
  },
  {
    id: 3, type: 'reassign', avatar: 'LG', avatarColor: '#F4A261',
    title: 'Dr. Garcia — Leave Coverage Needed',
    detail: '14 appointments Mar 18–22 need reassignment',
    meta: 'Leave approved · Veterinarian',
    status: 'pending',
  },
  {
    id: 4, type: 'overdue', avatar: '!', avatarColor: '#EF4444',
    title: '3 Invoices Overdue',
    detail: 'Michael Brown $250 · Lisa Martinez $250 · Karen Harris $130',
    meta: '$840 total · Oldest: Mar 8',
    status: 'pending',
  },
];

const NOTIF_TYPE_CFG = {
  pto:        { icon: Umbrella,     color: '#8B5CF6', bg: '#8B5CF615', label: 'PTO Request' },
  shift_swap: { icon: RefreshCw,    color: '#3B82F6', bg: '#3B82F615', label: 'Shift Swap' },
  reassign:   { icon: Calendar,     color: '#F4A261', bg: '#F4A26115', label: 'Coverage Needed' },
  overdue:    { icon: AlertCircle,  color: '#EF4444', bg: '#EF444415', label: 'Finance Alert' },
};

function NotificationsPanel() {
  const [notifs, setNotifs] = useState<Notification[]>(INITIAL_NOTIFS);
  const pending = notifs.filter(n => n.status === 'pending');

  function approve(id: number) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, status: 'approved' } : n));
  }
  function decline(id: number) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, status: 'declined' } : n));
  }
  function dismiss(id: number) {
    setNotifs(prev => prev.filter(n => n.id !== id));
  }

  if (notifs.length === 0) return null;

  return (
    <div style={{
      backgroundColor: 'var(--surface-white)',
      border: '1px solid var(--border-color)',
      borderRadius: '14px',
      overflow: 'hidden',
      marginBottom: '24px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '9px',
            backgroundColor: '#F4A26115',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Bell style={{ width: '15px', height: '15px', color: '#C2671A' }} />
          </div>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Pending Requests
          </span>
          {pending.length > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: '22px', height: '22px', borderRadius: '9999px',
              backgroundColor: '#EF4444', color: '#fff',
              fontSize: '11px', fontWeight: 700, padding: '0 6px',
            }}>
              {pending.length}
            </span>
          )}
        </div>
        <button style={{
          fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)',
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '4px',
        }}>
          View all <ChevronRight style={{ width: '13px', height: '13px' }} />
        </button>
      </div>

      {/* Notification rows */}
      {notifs.map((n, idx) => {
        const cfg = NOTIF_TYPE_CFG[n.type];
        const TypeIcon = cfg.icon;
        const isDone = n.status !== 'pending';

        return (
          <div
            key={n.id}
            style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '14px 18px',
              borderBottom: idx < notifs.length - 1 ? '1px solid var(--border-color)' : 'none',
              opacity: isDone ? 0.5 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {/* Avatar */}
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: `linear-gradient(135deg, ${n.avatarColor}dd, ${n.avatarColor}88)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              fontSize: '13px', fontWeight: 700, color: '#fff',
            }}>
              {n.avatar}
            </div>

            {/* Type badge + text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '2px 8px', borderRadius: '9999px',
                  backgroundColor: cfg.bg, color: cfg.color,
                  fontSize: '11px', fontWeight: 700,
                }}>
                  <TypeIcon style={{ width: '10px', height: '10px' }} />
                  {cfg.label}
                </span>
                {isDone && (
                  <span style={{
                    fontSize: '11px', fontWeight: 700,
                    color: n.status === 'approved' ? '#22C55E' : '#EF4444',
                  }}>
                    {n.status === 'approved' ? '✓ Approved' : '✕ Declined'}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {n.title}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '1px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {n.detail}
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0 0', opacity: 0.7 }}>
                {n.meta}
              </p>
            </div>

            {/* Actions */}
            {!isDone ? (
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                {n.type !== 'overdue' && (
                  <button
                    onClick={() => approve(n.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      padding: '7px 14px', borderRadius: '8px',
                      backgroundColor: '#22C55E15', color: '#16A34A',
                      border: '1px solid #22C55E30',
                      fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    <Check style={{ width: '12px', height: '12px' }} />
                    Approve
                  </button>
                )}
                {n.type === 'overdue' && (
                  <button
                    onClick={() => approve(n.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      padding: '7px 14px', borderRadius: '8px',
                      backgroundColor: '#EF444415', color: '#DC2626',
                      border: '1px solid #EF444430',
                      fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    <ChevronRight style={{ width: '12px', height: '12px' }} />
                    Review
                  </button>
                )}
                {n.type !== 'overdue' && (
                  <button
                    onClick={() => decline(n.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      padding: '7px 14px', borderRadius: '8px',
                      backgroundColor: 'var(--surface-elevated)', color: 'var(--text-secondary)',
                      border: '1px solid var(--border-color)',
                      fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    <X style={{ width: '12px', height: '12px' }} />
                    Decline
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={() => dismiss(n.id)}
                style={{
                  width: '28px', height: '28px', borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--surface-elevated)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0, color: 'var(--text-secondary)',
                }}
              >
                <X style={{ width: '13px', height: '13px' }} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Glow Card Data ───────────────────────────────────────────

const GLOW_CARDS = [
  {
    title: 'Total Patients',
    subtitle: 'Active',
    metricLabel: 'Patient Growth',
    value: '1,284',
    trendLabel: '+12 this week',
    trendPositive: true,
    color: '#818CF8',
    shadowColor: 'rgba(129,140,248,0.35)',
    icon: PawPrint,
    data: [1080, 1110, 1140, 1175, 1210, 1240, 1265, 1284],
    labels: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
    unit: 'patients',
    annotationStart: '1,080',
    annotationEnd: '1,284',
    path: '/superadmin/staff',
  },
  {
    title: 'Appointments',
    subtitle: 'Today',
    metricLabel: 'Daily Volume',
    value: '38',
    trendLabel: '6 in progress',
    trendPositive: true,
    color: '#F4A261',
    shadowColor: 'rgba(244,162,97,0.35)',
    icon: Calendar,
    data: [28, 31, 26, 34, 29, 36, 33, 38],
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Mon', 'Tue', 'Today'],
    unit: 'appts',
    annotationStart: '28',
    annotationEnd: '38',
    path: '/superadmin/appointments',
  },
  {
    title: 'Monthly Revenue',
    subtitle: 'March 2026',
    metricLabel: 'Revenue Growth',
    value: '$48,920',
    trendLabel: '+8% vs last month',
    trendPositive: true,
    color: '#4ADE80',
    shadowColor: 'rgba(74,222,128,0.35)',
    icon: DollarSign,
    data: [38200, 40100, 42800, 41500, 43900, 45200, 47300, 48920],
    labels: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
    unit: 'USD',
    annotationStart: '$38k',
    annotationEnd: '$48.9k',
    path: '/superadmin/billing',
  },
  {
    title: 'Active Staff',
    subtitle: 'On Roster',
    metricLabel: 'Headcount',
    value: '12',
    trendLabel: '3 doctors, 9 admin',
    trendPositive: true,
    color: '#38BDF8',
    shadowColor: 'rgba(56,189,248,0.35)',
    icon: Users,
    data: [8, 9, 9, 10, 10, 11, 12, 12],
    labels: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
    unit: 'staff',
    annotationStart: '8',
    annotationEnd: '12',
    path: '/superadmin/staff',
  },
];

// ─── GlowStatCard ─────────────────────────────────────────────

function GlowStatCard({
  title, subtitle, metricLabel, value, trendLabel, trendPositive,
  color, shadowColor, icon: Icon, data, labels, unit,
  annotationStart, annotationEnd, path,
}: (typeof GLOW_CARDS)[0]) {
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
  const last  = pts[pts.length - 1];
  const areaPath = linePath + ` L ${last.x} ${VH} L ${first.x} ${VH} Z`;
  const midY = VH / 2;
  const uid  = title.replace(/\s+/g, '');

  const cardBg      = dark
    ? 'linear-gradient(145deg, #0D1B2A 0%, #0A1520 60%, #0D1B2A 100%)'
    : 'linear-gradient(145deg, #ffffff 0%, #f8faff 60%, #ffffff 100%)';
  const cardBorder  = dark ? 'rgba(255,255,255,0.07)' : `${color}28`;
  const cardShadow  = dark
    ? `0 0 0 1px rgba(255,255,255,0.04), 0 20px 60px -10px ${shadowColor}`
    : `0 4px 32px -6px ${shadowColor}, 0 0 0 1px ${color}18`;
  const cornerGlow  = dark ? `${color}18` : `${color}12`;
  const subtitleColor   = dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.38)';
  const titleColor      = dark ? 'rgba(255,255,255,0.88)' : '#0F172A';
  const metricLabelColor= dark ? 'rgba(255,255,255,0.3)'  : 'rgba(0,0,0,0.35)';
  const valueColor      = dark ? '#ffffff' : '#0F172A';
  const btnBorder       = dark ? 'rgba(255,255,255,0.1)'  : 'rgba(0,0,0,0.1)';
  const btnBg           = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const btnIconColor    = dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)';
  const dotHoleFill     = dark ? '#0D1B2A' : '#ffffff';
  const midLineStroke   = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const annoStartFill   = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  const annoEndFill     = dark ? 'rgba(255,255,255,0.9)'  : 'rgba(0,0,0,0.8)';
  const areaOpacity     = dark ? 0.22 : 0.14;
  const lineWhiteStop   = dark ? '#ffffff' : color;
  const lineWhiteOpacity= dark ? 0.9 : 1;
  const glowOpacity1    = dark ? 0.35 : 0.28;
  const glowOpacity2    = dark ? 0.5  : 0.45;

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
        (e.currentTarget as HTMLElement).style.boxShadow = dark
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
          }}>
            {trendPositive ? '↑' : '↓'} {trendLabel}
          </span>
        </div>
      </div>

      {/* Sparkline chart */}
      <div style={{ position: 'relative' }} onMouseLeave={() => setHoveredIdx(null)}>
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: '100px', display: 'block', cursor: 'crosshair' }}
          onMouseMove={e => {
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
              <stop offset="0%"   stopColor={color} stopOpacity={areaOpacity} />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`line-${uid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor={color}          stopOpacity="0.6" />
              <stop offset="45%"  stopColor={lineWhiteStop}  stopOpacity={lineWhiteOpacity} />
              <stop offset="100%" stopColor={color}          stopOpacity="1" />
            </linearGradient>
          </defs>

          <line x1={PX} y1={midY} x2={VW - PX} y2={midY}
            stroke={midLineStroke} strokeWidth="1" strokeDasharray="5 5" />
          <path d={areaPath} fill={`url(#area-${uid})`} />
          <path d={linePath} fill="none" stroke={color} strokeWidth="10"
            strokeLinecap="round" opacity={glowOpacity1} filter={`url(#bloom-${uid})`} />
          <path d={linePath} fill="none" stroke={color} strokeWidth="5"
            strokeLinecap="round" opacity={glowOpacity2} filter={`url(#bloom-${uid})`} />
          <path d={linePath} fill="none" stroke={`url(#line-${uid})`} strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={first.x} cy={first.y} r="4.5" fill={dotHoleFill} stroke={color} strokeWidth="2" />
          <circle cx={last.x}  cy={last.y}  r="5"   fill={color} filter={`url(#bloom-${uid})`} />
          <circle cx={last.x}  cy={last.y}  r="4"   fill="#ffffff" opacity="0.9" />
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

        {/* Hover tooltip */}
        {hoveredIdx !== null && (() => {
          const hx = pts[hoveredIdx].x;
          const hy = pts[hoveredIdx].y;
          const dotFromBottom = VH - hy;
          const tooltipBg     = dark ? '#1a2a3a' : '#ffffff';
          const tooltipBorder = `${color}55`;
          const tooltipShadow = dark
            ? `0 4px 20px rgba(0,0,0,0.5), 0 0 12px ${color}30`
            : `0 4px 20px rgba(0,0,0,0.12), 0 0 10px ${color}20`;
          const labelCol = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
          const unitCol  = dark ? 'rgba(255,255,255,0.4)'  : 'rgba(0,0,0,0.35)';
          return (
            <div style={{
              position: 'absolute',
              left: `${(hx / VW) * 100}%`,
              bottom: `${dotFromBottom + 14}px`,
              transform: 'translateX(-50%)',
              pointerEvents: 'none', zIndex: 20,
              backgroundColor: tooltipBg,
              border: `1px solid ${tooltipBorder}`,
              borderRadius: '10px', padding: '7px 11px',
              boxShadow: tooltipShadow,
              whiteSpace: 'nowrap', backdropFilter: 'blur(8px)',
            }}>
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

// ─── Staff rows ───────────────────────────────────────────────

type StaffStatus = 'On Duty' | 'On Leave' | 'Active' | 'Off Today';

const STAFF_ROWS: {
  name: string;
  role: string;
  appts: string;
  status: StaffStatus;
  lastActive: string;
}[] = [
  { name: 'Dr. Sarah Chen',  role: 'Veterinarian', appts: '12', status: 'On Duty',  lastActive: 'Now' },
  { name: 'Dr. Raj Patel',   role: 'Veterinarian', appts: '9',  status: 'On Duty',  lastActive: '5m ago' },
  { name: 'Dr. Luis Garcia', role: 'Veterinarian', appts: '0',  status: 'On Leave', lastActive: 'Mar 12' },
  { name: 'Emma Thompson',   role: 'Front Desk',   appts: '—',  status: 'Active',   lastActive: 'Now' },
  { name: 'James Wilson',    role: 'Front Desk',   appts: '—',  status: 'Active',   lastActive: '2m ago' },
  { name: 'Priya Sharma',    role: 'Front Desk',   appts: '—',  status: 'Off Today', lastActive: 'Yesterday' },
];

const STATUS_DOT: Record<StaffStatus, { dot: string; bg: string; color: string }> = {
  'On Duty':  { dot: '#22C55E', bg: '#22C55E18', color: '#15803D' },
  'On Leave': { dot: '#F59E0B', bg: '#F59E0B18', color: '#92400E' },
  'Active':   { dot: '#22C55E', bg: '#22C55E18', color: '#15803D' },
  'Off Today':{ dot: '#EF4444', bg: '#EF444418', color: '#B91C1C' },
};

// ─── Activity feed ────────────────────────────────────────────

const ACTIVITY_FEED = [
  { icon: CheckCircle2, iconColor: '#22C55E', text: 'Payment received — John Smith $145', time: '9:42 AM' },
  { icon: ClipboardList, iconColor: '#3B82F6', text: 'Record finalized — Max (Dr. Chen)', time: '9:30 AM' },
  { icon: BookOpen,     iconColor: '#8B5CF6', text: 'New booking — Hugo · Dental Cleaning', time: '9:15 AM' },
  { icon: Lock,         iconColor: '#F4A261', text: 'Portal request approved — Max checkup', time: '8:50 AM' },
  { icon: AlertTriangle,iconColor: '#EF4444', text: 'Invoice overdue — Michael Brown $250', time: '8:30 AM' },
  { icon: UserPlus,     iconColor: '#6B7280', text: 'New patient registered — Luna (Emily J.)', time: '8:00 AM' },
];

// ─── Quick actions ────────────────────────────────────────────

const QUICK_ACTIONS = [
  { icon: Plus,      label: 'Add Staff Member', primary: true },
  { icon: FileText,  label: 'Create Invoice',   primary: false },
  { icon: Settings,  label: 'System Settings',  primary: false },
  { icon: BarChart2, label: 'Generate Report',  primary: false },
];

// ─── Component ────────────────────────────────────────────────

export default function SuperAdminDashboardPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-[1440px] mx-auto p-8">

      {/* ── Page Header ── */}
      <div
        style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          marginBottom: '28px', flexWrap: 'wrap', gap: '16px',
        }}
      >
        <div>
          <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '28px', height: '28px', borderRadius: '8px',
                backgroundColor: '#F4A26118',
                border: '1px solid #F4A26140',
              }}
            >
              <Crown style={{ width: '14px', height: '14px', color: '#C2671A' }} />
            </div>
            <h1
              style={{
                fontSize: '26px', fontWeight: 700,
                color: 'var(--text-primary)', margin: 0,
              }}
            >
              Good morning, Victoria 👋
            </h1>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
            Sunday, March 15, 2026
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', borderRadius: '8px',
              backgroundColor: 'var(--surface-elevated)',
              border: '1px solid var(--border-color)',
              fontSize: '13px', color: 'var(--text-secondary)',
            }}
          >
            <RefreshCw style={{ width: '12px', height: '12px' }} />
            Last sync: just now
          </div>
          <button
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '8px',
              backgroundColor: '#F4A261', color: '#fff',
              border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600,
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#E07B2A'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#F4A261'}
          >
            <BarChart2 style={{ width: '14px', height: '14px' }} />
            Export Report
          </button>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '20px',
          marginBottom: '28px',
        }}
      >
        {GLOW_CARDS.map(card => (
          <GlowStatCard key={card.title} {...card} />
        ))}
      </div>

      {/* ── Pending Requests ── */}
      <NotificationsPanel />

      {/* ── Two-column main area ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '60% 40%',
          gap: '20px',
          marginBottom: '24px',
        }}
      >
        {/* ── Left: Staff Overview ── */}
        <div
          style={{
            backgroundColor: 'var(--surface-white)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between"
            style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}
          >
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Staff Overview
            </h2>
            <button
              onClick={() => navigate('/superadmin/staff')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)',
                padding: 0, display: 'flex', alignItems: 'center', gap: '4px',
              }}
            >
              View all <ChevronRight style={{ width: '13px', height: '13px' }} />
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-elevated)' }}>
                  {['Name', 'Role', "Today's Appts", 'Status', 'Last Active', ''].map((col) => (
                    <th
                      key={col}
                      style={{
                        padding: '10px 16px',
                        textAlign: 'left',
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STAFF_ROWS.map((row, i) => {
                  const s = STATUS_DOT[row.status];
                  return (
                    <tr
                      key={row.name}
                      style={{
                        borderTop: i === 0 ? 'none' : '1px solid var(--border-color)',
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-elevated)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {row.name}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {row.role}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--text-primary)', textAlign: 'center' }}>
                        {row.appts}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '3px 10px', borderRadius: '9999px',
                            fontSize: '12px', fontWeight: 600,
                            backgroundColor: s.bg, color: s.color,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: s.dot, flexShrink: 0 }} />
                          {row.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {row.lastActive}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: '4px', borderRadius: '6px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--text-secondary)',
                          }}
                          className="hover:bg-[var(--surface-elevated)] transition-colors"
                        >
                          <MoreHorizontal style={{ width: '16px', height: '16px' }} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Right column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* ── Financial Snapshot ── */}
          <div
            style={{
              backgroundColor: 'var(--surface-white)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '20px',
            }}
          >
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px' }}>
              Financial Snapshot
            </h2>

            {/* Bar rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {/* This month */}
              <div>
                <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>This month</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>$48,920</span>
                </div>
                <div style={{ height: '8px', backgroundColor: 'var(--surface-elevated)', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '75%', backgroundColor: '#22C55E', borderRadius: '9999px' }} />
                </div>
              </div>

              {/* Last month */}
              <div>
                <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Last month</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>$45,200</span>
                </div>
                <div style={{ height: '8px', backgroundColor: 'var(--surface-elevated)', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '70%', backgroundColor: '#94A3B8', borderRadius: '9999px' }} />
                </div>
              </div>

              {/* Target label */}
              <div className="flex items-center justify-between">
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Target</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>$60,000</span>
              </div>
            </div>

            {/* Chips row */}
            <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600,
                  backgroundColor: '#22C55E18', color: '#15803D',
                }}
              >
                Paid $41,380
              </span>
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600,
                  backgroundColor: '#F4A26118', color: '#C2671A',
                }}
              >
                Pending $4,700
              </span>
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600,
                  backgroundColor: '#EF444418', color: '#B91C1C',
                }}
              >
                Overdue $840
              </span>
            </div>
          </div>

          {/* ── Today's Activity Feed ── */}
          <div
            style={{
              backgroundColor: 'var(--surface-white)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '20px',
              flex: 1,
            }}
          >
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px' }}>
              Today's Activity
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {ACTIVITY_FEED.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3"
                    style={{
                      padding: '10px 0',
                      borderBottom: i < ACTIVITY_FEED.length - 1 ? '1px solid var(--border-color)' : 'none',
                    }}
                  >
                    <div
                      style={{
                        width: '28px', height: '28px', borderRadius: '8px',
                        backgroundColor: `${item.iconColor}15`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon style={{ width: '14px', height: '14px', color: item.iconColor }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: '0 0 2px', fontWeight: 500, lineHeight: 1.4 }}>
                        {item.text}
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                        {item.time}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
        }}
      >
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '14px 16px',
                borderRadius: '10px',
                border: action.primary ? 'none' : '1px solid var(--border-color)',
                backgroundColor: action.primary ? '#F4A261' : 'var(--surface-white)',
                color: action.primary ? '#fff' : 'var(--text-primary)',
                fontSize: '14px', fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                if (action.primary) {
                  el.style.backgroundColor = '#E07B2A';
                } else {
                  el.style.backgroundColor = 'var(--surface-elevated)';
                }
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                if (action.primary) {
                  el.style.backgroundColor = '#F4A261';
                } else {
                  el.style.backgroundColor = 'var(--surface-white)';
                }
              }}
            >
              <Icon style={{ width: '16px', height: '16px' }} />
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
