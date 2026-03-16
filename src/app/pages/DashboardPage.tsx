import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router';
import { Users, Calendar, Syringe, PawPrint, ChevronRight, ArrowUpRight, Search, X, Clock } from 'lucide-react';
import { ClientRow } from '../components/ClientRow';
import { AppointmentCard } from '../components/AppointmentCard';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useAppointments } from '../hooks/useAppointments';
import { useClients } from '../hooks/useClients';

// ─── Glow Card Config (values injected at runtime) ────────────

const GLOW_CARD_CONFIG = [
  {
    title: 'Total Clients',
    subtitle: 'All Time',
    metricLabel: 'Client Growth',
    trendPositive: true,
    color: '#818CF8',
    shadowColor: 'rgba(129,140,248,0.35)',
    icon: Users,
    data: [0, 0],
    labels: ['—', 'Now'],
    unit: 'clients',
    path: '/clients',
  },
  {
    title: 'Appointments',
    subtitle: 'Today',
    metricLabel: 'Daily Volume',
    trendPositive: true,
    color: '#F4A261',
    shadowColor: 'rgba(244,162,97,0.35)',
    icon: Calendar,
    data: [0, 0],
    labels: ['—', 'Today'],
    unit: 'appts',
    path: '/appointments',
  },
  {
    title: 'Vaccines Due',
    subtitle: 'This Week',
    metricLabel: 'Overdue Risk',
    trendPositive: false,
    color: '#38BDF8',
    shadowColor: 'rgba(56,189,248,0.35)',
    icon: Syringe,
    data: [0, 0],
    labels: ['—', 'Now'],
    unit: 'due',
    path: '/vaccines',
  },
  {
    title: 'Active Pets',
    subtitle: 'Registered',
    metricLabel: 'Pet Population',
    trendPositive: true,
    color: '#4ADE80',
    shadowColor: 'rgba(74,222,128,0.35)',
    icon: PawPrint,
    data: [0, 0],
    labels: ['—', 'Now'],
    unit: 'pets',
    path: '/pets',
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

interface GlowStatCardProps {
  title: string; subtitle: string; metricLabel: string; value: string;
  trendLabel: string; trendPositive: boolean; color: string; shadowColor: string;
  icon: React.ElementType; data: number[]; labels: string[]; unit: string;
  annotationStart?: string; annotationEnd?: string; path: string;
}

function GlowStatCard({
  title, subtitle, metricLabel, value, trendLabel, trendPositive,
  color, shadowColor, icon: Icon, data, labels, unit,
  annotationStart, annotationEnd, path,
}: GlowStatCardProps) {
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
  const uid = title.replace(/\s+/g, '');

  // Theme-aware tokens
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
          <circle cx={last.x} cy={last.y} r="4" fill={dark ? '#ffffff' : '#ffffff'} opacity="0.9" />

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

// ─── Page ─────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Real data from Supabase ─────────────────────────────────
  const stats = useDashboardStats();
  const today = new Date().toISOString().split('T')[0];
  const { appointments: todayAppointments } = useAppointments(today);
  const { clients: allClients } = useClients();

  // Merge live stats into card configs
  const GLOW_CARDS = GLOW_CARD_CONFIG.map((c, i) => {
    const values = [stats.totalClients, stats.appointmentsToday, stats.vaccinesDueThisWeek, stats.activePets];
    const v = values[i];
    return {
      ...c,
      value: v.toLocaleString(),
      trendLabel: 'Live data',
      data: [0, v],
      annotationStart: '0',
      annotationEnd: v.toLocaleString(),
    };
  });

  // Recent 5 clients for dashboard table
  const recentClients = allClients.slice(0, 5).map(c => ({
    id: c.id,
    petImage: c.pets?.[0]?.photo_url ?? '',
    petName: c.pets?.[0]?.name ?? '—',
    ownerName: `${c.first_name} ${c.last_name}`,
    breed: c.pets?.[0]?.breed ?? c.pets?.[0]?.species ?? '—',
    lastVisit: new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    status: (c.portal_status ?? 'Healthy') as 'Healthy' | 'Follow-up' | 'Critical',
  }));

  // Today's upcoming appointments
  const upcomingAppointments = todayAppointments
    .filter(a => a.status !== 'Cancelled' && a.status !== 'Completed')
    .slice(0, 4);

  // ── Search ──────────────────────────────────────────────────
  const q = searchQuery.trim().toLowerCase();
  const matchedClients = q
    ? recentClients.filter(
        (c) =>
          c.petName.toLowerCase().includes(q) ||
          c.ownerName.toLowerCase().includes(q) ||
          c.breed.toLowerCase().includes(q)
      )
    : [];
  const matchedAppointments = q
    ? todayAppointments.filter(
        (a) =>
          (a.pets?.name ?? '').toLowerCase().includes(q) ||
          (a.clients ? `${a.clients.first_name} ${a.clients.last_name}` : '').toLowerCase().includes(q) ||
          (a.services?.name ?? '').toLowerCase().includes(q)
      )
    : [];
  const hasResults = matchedClients.length > 0 || matchedAppointments.length > 0;
  const isSearching = q.length > 0;

  return (
    <div className="max-w-[1440px] mx-auto p-8">
      {/* Welcome Header */}
      <div className="mb-6">
        <h1 className="text-[var(--text-primary)] mb-2">Welcome back, Dr. Chen 👋</h1>
        <p className="text-[var(--text-secondary)]" style={{ fontSize: '16px', fontWeight: 400 }}>
          Here's what's happening with your clinic today.
        </p>
      </div>

      {/* ── Global Search ── */}
      <div className="relative mb-8">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
          style={{ color: 'var(--text-secondary)' }}
        />
        <input
          ref={searchRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search clients, pets, appointments, services…"
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
            className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--surface-elevated)] transition-colors"
          >
            <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        )}
      </div>

      {/* ── Search Results ── */}
      {isSearching ? (
        <div className="space-y-6">
          {!hasResults ? (
            <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-12 text-center" style={{ borderRadius: '12px' }}>
              <Search className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--border-color)' }} />
              <p className="text-[var(--text-primary)] mb-1" style={{ fontSize: '16px', fontWeight: 600 }}>No results found</p>
              <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Try searching for a pet name, owner, or service</p>
            </div>
          ) : (
            <>
              {/* Client results */}
              {matchedClients.length > 0 && (
                <div className="bg-[var(--surface-white)] border border-[var(--border-color)]" style={{ borderRadius: '12px', overflow: 'hidden' }}>
                  <div className="px-5 py-3 border-b border-[var(--border-color)] flex items-center gap-2">
                    <Users className="w-4 h-4" style={{ color: 'var(--brand-green-text)' }} />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Clients · {matchedClients.length}
                    </span>
                  </div>
                  {matchedClients.map((c, i) => (
                    <div
                      key={c.id}
                      onClick={() => navigate(`/clients/${c.id}`)}
                      className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-[var(--surface-elevated)] transition-colors"
                      style={{ borderTop: i > 0 ? '1px solid var(--border-color)' : undefined }}
                    >
                      <img src={c.petImage} alt={c.petName} className="w-10 h-10 object-cover flex-shrink-0" style={{ borderRadius: '9999px' }} />
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{c.petName}</p>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{c.ownerName} · {c.breed}</p>
                      </div>
                      <span
                        className="flex-shrink-0 px-2.5 py-0.5"
                        style={{
                          fontSize: '12px', fontWeight: 600, borderRadius: '9999px',
                          backgroundColor: c.status === 'Healthy' ? '#2D6A4F18' : '#F4A26118',
                          color: c.status === 'Healthy' ? 'var(--brand-green-text)' : '#F4A261',
                        }}
                      >
                        {c.status}
                      </span>
                      <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
                    </div>
                  ))}
                </div>
              )}

              {/* Appointment results */}
              {matchedAppointments.length > 0 && (
                <div className="bg-[var(--surface-white)] border border-[var(--border-color)]" style={{ borderRadius: '12px', overflow: 'hidden' }}>
                  <div className="px-5 py-3 border-b border-[var(--border-color)] flex items-center gap-2">
                    <Calendar className="w-4 h-4" style={{ color: '#F4A261' }} />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Appointments · {matchedAppointments.length}
                    </span>
                  </div>
                  {matchedAppointments.map((a, i) => (
                    <div
                      key={a.id}
                      onClick={() => navigate('/appointments', { state: { openApptId: a.id } })}
                      className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-[var(--surface-elevated)] transition-colors"
                      style={{ borderTop: i > 0 ? '1px solid var(--border-color)' : undefined }}
                    >
                      <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: '#2D6A4F18' }}>
                        <PawPrint className="w-5 h-5" style={{ color: 'var(--brand-green-text)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{a.pets?.name ?? '—'}</p>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {a.clients ? `${a.clients.first_name} ${a.clients.last_name}` : '—'} · {a.services?.name ?? '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(a.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </div>
                      <span
                        className="flex-shrink-0 px-2.5 py-0.5"
                        style={{
                          fontSize: '12px', fontWeight: 600, borderRadius: '9999px',
                          backgroundColor: a.status === 'Confirmed' ? '#2D6A4F18' : a.status === 'Completed' ? '#3B82F618' : a.status === 'Cancelled' ? '#d4183d18' : '#F4A26118',
                          color: a.status === 'Confirmed' ? 'var(--brand-green-text)' : a.status === 'Completed' ? '#3B82F6' : a.status === 'Cancelled' ? '#d4183d' : '#F4A261',
                        }}
                      >
                        {a.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <>
      {/* Glow Stat Cards */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        {GLOW_CARDS.map(card => (
          <GlowStatCard key={card.title} {...card} />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Recent Clients */}
        <div className="col-span-2 bg-[var(--surface-white)] border border-[var(--border-color)]" style={{ borderRadius: '12px' }}>
          <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between">
            <h3 className="text-[var(--text-primary)]">Recent Clients</h3>
            <Link
              to="/clients"
              className="flex items-center gap-1 text-[var(--text-secondary)] hover:opacity-75 transition-opacity"
              style={{ fontSize: '12px', fontWeight: 600 }}
            >
              View all <ChevronRight className="w-[13px] h-[13px]" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            {recentClients.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--border-color)' }} />
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>No clients yet — add your first client</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-color)]">
                    {['Pet Name', 'Owner', 'Breed', 'Added', 'Status'].map((h) => (
                      <th key={h} className="py-3 px-4 text-left">
                        <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px', fontWeight: 600 }}>{h}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentClients.map((client) => (
                    <ClientRow
                      key={client.id}
                      {...client}
                      onClick={() => navigate(`/clients/${client.id}`)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Today's Appointments */}
        <div className="bg-[var(--surface-white)] border border-[var(--border-color)]" style={{ borderRadius: '12px' }}>
          <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between">
            <div>
              <h3 className="text-[var(--text-primary)]">Today's Appointments</h3>
              <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '14px', fontWeight: 400 }}>
                {stats.appointmentsToday} scheduled
              </p>
            </div>
            <Link
              to="/appointments"
              className="flex items-center gap-1 text-[var(--text-secondary)] hover:opacity-75 transition-opacity flex-shrink-0"
              style={{ fontSize: '12px', fontWeight: 600 }}
            >
              View all <ChevronRight className="w-[13px] h-[13px]" />
            </Link>
          </div>
          <div className="p-4 space-y-3">
            {upcomingAppointments.length === 0 ? (
              <div className="py-8 text-center">
                <Calendar className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--border-color)' }} />
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>No appointments today</p>
              </div>
            ) : upcomingAppointments.map((appt) => (
              <AppointmentCard
                key={appt.id}
                time={new Date(appt.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                petName={appt.pets?.name ?? '—'}
                ownerName={appt.clients ? `${appt.clients.first_name} ${appt.clients.last_name}` : '—'}
                service={appt.services?.name ?? appt.reason ?? '—'}
                petImage={appt.pets?.photo_url ?? ''}
                onClick={() => navigate('/appointments', { state: { openApptId: appt.id } })}
              />
            ))}
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
