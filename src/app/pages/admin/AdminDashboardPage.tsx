import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router';
import {
  CalendarDays, CheckCircle2, DollarSign, MessageSquare,
  TrendingUp, Clock, MoreHorizontal, Search, X, Users, ArrowRight, ArrowUpRight, UserCheck,
  Receipt, CreditCard, Banknote, Terminal, Plus, Trash2, Pencil, Lock, ChevronRight, PawPrint,
} from 'lucide-react';
import { useAppointmentStatus } from '../../context/AppointmentStatusContext';
import { getOrgContext } from '../../hooks/useOrgContext';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../../components/ui/select';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import { useAppointments } from '../../hooks/useAppointments';
import { useClients } from '../../hooks/useClients';
import { supabase } from '../../../lib/supabase';
import { useProfile } from '../../hooks/useProfile';
import { ConnectionStatusBadge } from '../../components/ConnectionStatusBadge';

// ─── Global Search ───────────────────────────────────────────

interface SearchResultClient {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
}

interface SearchResultPet {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  photo_url: string | null;
  client_id: string;
  clients: { id: string; first_name: string; last_name: string } | null;
}

interface SearchResultAppointment {
  id: string;
  scheduled_at: string;
  status: string;
  reason: string | null;
  pets: { id: string; name: string } | null;
  clients: { id: string; first_name: string; last_name: string } | null;
  services: { id: string; name: string } | null;
}

interface SearchResults {
  clients: SearchResultClient[];
  pets: SearchResultPet[];
  appointments: SearchResultAppointment[];
}

function useGlobalSearch(query: string, debounceMs = 300) {
  const [results, setResults] = useState<SearchResults>({ clients: [], pets: [], appointments: [] });
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    const term = q.trim();
    if (!term) {
      setResults({ clients: [], pets: [], appointments: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    const pattern = `%${term}%`;

    // Step 1: Search clients and pets in parallel
    const [clientsRes, petsRes] = await Promise.all([
      supabase
        .from('clients')
        .select('id, first_name, last_name, email, phone')
        .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
        .limit(6),
      supabase
        .from('pets')
        .select('id, name, species, breed, photo_url, client_id, clients(id, first_name, last_name)')
        .or(`name.ilike.${pattern},species.ilike.${pattern},breed.ilike.${pattern}`)
        .limit(6),
    ]);

    const matchedClients = (clientsRes.data as SearchResultClient[]) ?? [];
    const matchedPets = (petsRes.data as SearchResultPet[]) ?? [];

    // Step 2: Search appointments by reason, OR by matched client/pet IDs
    const clientIds = matchedClients.map(c => c.id);
    const petIds = matchedPets.map(p => p.id);

    // Build OR filter for appointments: reason match + client_id match + pet_id match
    const orParts: string[] = [`reason.ilike.${pattern}`];
    if (clientIds.length > 0) orParts.push(`client_id.in.(${clientIds.join(',')})`);
    if (petIds.length > 0) orParts.push(`pet_id.in.(${petIds.join(',')})`);

    const appointmentsRes = await supabase
      .from('appointments')
      .select('id, scheduled_at, status, reason, pets(id, name), clients(id, first_name, last_name), services(id, name)')
      .or(orParts.join(','))
      .order('scheduled_at', { ascending: false })
      .limit(6);

    setResults({
      clients: matchedClients,
      pets: matchedPets,
      appointments: (appointmentsRes.data as SearchResultAppointment[]) ?? [],
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const term = query.trim();
    if (!term) {
      setResults({ clients: [], pets: [], appointments: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(() => search(term), debounceMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, debounceMs, search]);

  const totalResults = results.clients.length + results.pets.length + results.appointments.length;
  return { results, loading, totalResults };
}

// ─── Types ────────────────────────────────────────────────────

type ApptStatus = 'Confirmed' | 'Patient Arrived' | 'Waiting for Doctor' | 'In Progress' | 'Ready for Billing' | 'Completed' | 'Cancelled' | 'Pending' | 'Late';
type PaymentStatus = 'Paid' | 'Pending' | 'Overdue';

// (Recent payments & unread messages are fetched from Supabase inside the component)

// ─── Status Badge ─────────────────────────────────────────────

const STATUS_STYLES: Record<ApptStatus, { bg: string; color: string }> = {
  'Confirmed':          { bg: 'rgba(34,197,94,0.12)', color: '#22C55E' },
  'Patient Arrived':    { bg: 'rgba(34,197,94,0.12)', color: '#22C55E' },
  'Waiting for Doctor': { bg: '#F4A26115', color: '#D97706' },
  'In Progress':        { bg: '#3B82F615', color: '#3B82F6' },
  'Ready for Billing':  { bg: '#8B5CF615', color: '#8B5CF6' },
  'Completed':          { bg: '#6B728015', color: '#6B7280' },
  'Cancelled':          { bg: '#d4183d15', color: '#d4183d' },
  'Pending':            { bg: '#F4A26115', color: '#F4A261' },
  'Late':               { bg: '#F9731615', color: '#F97316' },
};

const PAYMENT_STYLES: Record<PaymentStatus, { bg: string; color: string }> = {
  Paid:    { bg: 'rgba(34,197,94,0.12)', color: '#22C55E' },
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

// ─── Glow Card type (for GlowStatCard) ───────────────────────
type GlowCardData = {
  title: string; subtitle: string; metricLabel: string; value: string;
  trendLabel: string; trendPositive: boolean; color: string; shadowColor: string;
  icon: React.ElementType; data: number[]; labels: string[]; unit: string;
  annotationStart: string; annotationEnd: string; path: string;
};

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
}: GlowCardData) {
  const navigate = useNavigate();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const VW = 320;
  const VH = 100;
  const PX = 24;
  const PY = 18;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pts = data.map((val, i) => ({
    x: PX + (i / (data.length - 1)) * (VW - PX * 2),
    y: VH - PY - ((val - min) / range) * (VH - PY * 2),
  }));

  const linePath = buildSplinePath(pts);
  const first = pts[0];
  const last = pts[pts.length - 1];
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
          `0 0 0 1px ${cardBorder}, 0 24px 70px -10px ${shadowColor}`;
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
                <line x1={hx} y1={0} x2={hx} y2={VH}
                  stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
                <circle cx={hx} cy={hy} r="8" fill={color} opacity="0.18" />
                <circle cx={hx} cy={hy} r="5" fill={color} filter={glowOpacity1 > 0 ? `url(#bloom-${uid})` : undefined} opacity="0.8" />
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
          const tooltipBg = v('--stat-card-dot-fill', '#0D1B2A');
          const tooltipBorder = `${color}55`;
          const tooltipShadow = `0 4px 20px rgba(0,0,0,0.4), 0 0 12px ${color}30`;
          const labelCol = v('--stat-card-text-muted', 'rgba(255,255,255,0.45)');
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

// ─── Page ─────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { overrides, setApptStatus } = useAppointmentStatus();

  // ── Admin name from useProfile hook ──
  const { profile: adminProfile } = useProfile('admin');

  // ── Supabase hooks ──────────────────────────────────────────
  const dashStats = useDashboardStats();
  const todayStr = useMemo(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }, []);
  const { appointments: supaApptsToday, updateStatus } = useAppointments(todayStr);
  const { clients: supaClients } = useClients();

  // Map Supabase appointments → TODAY_SCHEDULE shape
  const TODAY_SCHEDULE = useMemo(() =>
    supaApptsToday.map((a, idx) => {
      const dt = new Date(a.scheduled_at);
      // Use local time — scheduled_at is stored with tz offset
      const h = dt.getHours();
      const m = dt.getMinutes();
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const time = `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
      return {
        id: idx + 1,
        dbId: a.id,
        time,
        pet: a.pets?.name ?? '—',
        owner: a.clients ? `${a.clients.first_name} ${a.clients.last_name}` : '—',
        phone: a.clients?.phone ?? '—',
        service: a.services?.name ?? a.reason ?? '—',
        vet: a.staff?.profiles ? `Dr. ${a.staff.profiles.last_name}` : '—',
        status: (a.status as ApptStatus) || 'Pending',
      };
    }),
    [supaApptsToday],
  );

  // Map Supabase clients → ALL_CLIENTS shape for search
  const ALL_CLIENTS = useMemo(() =>
    supaClients.map((c, idx) => {
      const pet = c.pets?.[0];
      return {
        id: idx + 1,
        clientId: c.id,
        name: `${c.first_name} ${c.last_name}`,
        pet: pet?.name ?? '—',
        petType: pet?.breed ?? pet?.species ?? '—',
        petPhoto: pet?.photo_url || '',
        phone: c.phone ?? '—',
        balance: '$0',
      };
    }),
    [supaClients],
  );

  const ALL_BOOKINGS = useMemo(() =>
    TODAY_SCHEDULE.map((a) => ({ ...a, phone: a.phone, date: 'Today' })),
    [TODAY_SCHEDULE],
  );

  // Generate 7-day date labels for sparkline hover
  const dayLabels = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }), []);

  // Build growth curve from 0 → value over 7 points
  const buildSparkData = (current: number, growth: boolean) => {
    if (current === 0) return Array(7).fill(0);
    if (!growth) {
      return Array.from({ length: 7 }, (_, i) => {
        const t = i / 6;
        return Math.round(current * (0.3 + t * 0.7 + Math.sin(t * Math.PI) * 0.15));
      });
    }
    return Array.from({ length: 7 }, (_, i) => {
      const t = i / 6;
      return Math.round(current * (t * t * 0.6 + t * 0.4));
    });
  };

  // Build dynamic glow cards
  const glowCards = useMemo(() => {
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
        title: "Today's Appts",
        subtitle: 'Today',
        metricLabel: 'Daily Volume',
        value: String(dashStats.appointmentsToday),
        trendLabel: `${apptTrend.label} vs yesterday`,
        trendPositive: apptTrend.positive,
        color: '#4ADE80',
        shadowColor: 'rgba(74,222,128,0.35)',
        icon: CalendarDays,
        data: apptData,
        labels: dayLabels,
        unit: 'appts',
        annotationStart: apptData[0].toLocaleString(),
        annotationEnd: String(dashStats.appointmentsToday),
        path: '/admin/bookings',
      },
      {
        title: 'Total Clients',
        subtitle: 'Clients',
        metricLabel: 'Client Count',
        value: String(dashStats.totalClients),
        trendLabel: `${clientTrend.label} vs last month`,
        trendPositive: clientTrend.positive,
        color: '#38BDF8',
        shadowColor: 'rgba(56,189,248,0.35)',
        icon: CheckCircle2,
        data: clientData,
        labels: dayLabels,
        unit: 'clients',
        annotationStart: clientData[0].toLocaleString(),
        annotationEnd: String(dashStats.totalClients),
        path: '/admin/clients',
      },
      {
        title: 'Active Pets',
        subtitle: 'Registered',
        metricLabel: 'Total Active',
        value: String(dashStats.activePets),
        trendLabel: `${petTrend.label} vs last month`,
        trendPositive: petTrend.positive,
        color: '#818CF8',
        shadowColor: 'rgba(129,140,248,0.35)',
        icon: PawPrint,
        data: petData,
        labels: dayLabels,
        unit: 'pets',
        annotationStart: petData[0].toLocaleString(),
        annotationEnd: String(dashStats.activePets),
        path: '/admin/clients',
      },
      {
        title: 'Vaccines Due',
        subtitle: 'This Week',
        metricLabel: 'Due Within 7 Days',
        value: String(dashStats.vaccinesDueThisWeek),
        trendLabel: `${vaccTrend.label} vs last week`,
        trendPositive: !vaccTrend.positive,
        color: '#FB7185',
        shadowColor: 'rgba(251,113,133,0.35)',
        icon: Clock,
        data: vaccData,
        labels: dayLabels,
        unit: 'vaccines',
        annotationStart: vaccData[0].toLocaleString(),
        annotationEnd: String(dashStats.vaccinesDueThisWeek),
        path: '/admin/bookings',
      },
    ];
  }, [dashStats, dayLabels]);

  const [checkedIn, setCheckedIn] = useState<Set<number>>(new Set());
  const [now, setNow] = useState(() => new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const { results: searchResults, loading: searchLoading, totalResults } = useGlobalSearch(searchQuery);
  const [arrivedToast, setArrivedToast] = useState<{ pet: string; vet: string } | null>(null);
  const [billModal, setBillModal] = useState<{ id: number; pet: string; owner: string; service: string; vet: string } | null>(null);
  const [payMethod, setPayMethod] = useState<'card' | 'terminal' | 'cash'>('card');
  const [billPaid, setBillPaid] = useState<Set<number>>(new Set());
  const [invoiceEditing, setInvoiceEditing] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState<{ id: number; label: string; desc: string; price: number }[]>([]);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [serviceList, setServiceList] = useState<{ name: string; price: number }[]>([]);
  const [viewModal, setViewModal] = useState<(typeof TODAY_SCHEDULE)[0] | null>(null);

  // ── Fetch services from Supabase (same pattern as CheckoutPage) ──
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const { organizationId } = await getOrgContext();
        const { data } = await supabase
          .from('services')
          .select('name, price')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .order('sort_order', { ascending: true });
        if (data && data.length > 0) {
          setServiceList(data);
        }
      } catch (e) {
        console.error('Failed to load services:', e);
      }
    };
    fetchServices();

    const handler = () => { fetchServices(); };
    window.addEventListener('serviceDataChanged', handler);
    return () => window.removeEventListener('serviceDataChanged', handler);
  }, []);

  // ── Recent Payments (from Supabase) ──────────────────────────
  interface RecentPayment { id: string; pet: string; petPhoto: string; owner: string; amount: string; method: string; status: PaymentStatus; clientId: string; }
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('payments')
          .select('id, amount, method, paid_at, invoices!inner(id, status, client_id, clients!inner(first_name, last_name, pets(name, photo_url)))')
          .order('paid_at', { ascending: false })
          .limit(5);
        if (data) {
          setRecentPayments(data.map((p: any) => {
            const inv = p.invoices;
            const client = inv?.clients;
            const pet = client?.pets?.[0];
            const petName = pet?.name ?? '—';
            const petPhoto = pet?.photo_url || '';
            const ownerName = client ? `${client.first_name} ${client.last_name}` : '—';
            const status: PaymentStatus = inv?.status === 'Paid' ? 'Paid' : inv?.status === 'Overdue' ? 'Overdue' : 'Pending';
            return {
              id: p.id,
              pet: petName,
              petPhoto,
              owner: ownerName,
              amount: `$${Number(p.amount).toFixed(2)}`,
              method: p.method || 'Card',
              status,
              clientId: inv?.client_id || '',
            };
          }));
        }
      } catch (e) {
        console.error('Error loading payments:', e);
      }
    })();
  }, []);

  // ── Unread Messages (from Supabase chat) ─────────────────────
  interface UnreadMsg { id: string; name: string; initials: string; preview: string; time: string; conversationId: string; }
  const [unreadMessages, setUnreadMessages] = useState<UnreadMsg[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!adminProfile?.id) return;
    (async () => {
      try {
        const { organizationId: orgId } = await getOrgContext();
        const { data: parts } = await supabase
          .from('conversation_participants')
          .select('conversation_id, last_read_at')
          .eq('organization_id', orgId)
          .eq('profile_id', adminProfile.id);
        if (!parts || parts.length === 0) { setUnreadCount(0); return; }

        let allUnread: UnreadMsg[] = [];
        for (const part of parts) {
          const lastRead = part.last_read_at || '1970-01-01T00:00:00Z';
          const { data: msgs } = await supabase
            .from('messages')
            .select('id, content, created_at, sender_id, profiles:profiles!messages_sender_org_fkey(first_name, last_name)')
            .eq('organization_id', orgId)
            .eq('conversation_id', part.conversation_id)
            .gt('created_at', lastRead)
            .neq('sender_id', adminProfile.id)
            .order('created_at', { ascending: false })
            .limit(3);
          if (msgs) {
            for (const m of msgs) {
              const sender = m.profiles as any;
              const name = sender ? `${sender.first_name} ${sender.last_name}` : 'Unknown';
              const initials = sender ? `${(sender.first_name?.[0] || '')}${(sender.last_name?.[0] || '')}` : '??';
              const created = new Date(m.created_at);
              const diffMin = Math.floor((Date.now() - created.getTime()) / 60000);
              let time = '';
              if (diffMin < 1) time = 'Just now';
              else if (diffMin < 60) time = `${diffMin}m ago`;
              else if (diffMin < 1440) time = `${Math.floor(diffMin / 60)}h ago`;
              else time = created.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              allUnread.push({ id: m.id, name, initials, preview: m.content || '', time, conversationId: part.conversation_id });
            }
          }
        }
        setUnreadMessages(allUnread.slice(0, 5));
        setUnreadCount(allUnread.length);
      } catch (e) {
        console.error('Error loading unread messages:', e);
      }
    })();
  }, [adminProfile?.id]);

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

  async function handleCheckIn(id: number) {
    const appt = TODAY_SCHEDULE.find(a => a.id === id);
    if (!appt) return;
    setCheckedIn(prev => new Set([...prev, id]));
    setApptStatus(id, 'Waiting for Doctor');
    // Persist to database (enum: 'In Progress' is the closest valid status for check-in)
    await updateStatus(appt.dbId, 'In Progress');
    if (appt) {
      setArrivedToast({ pet: appt.pet, vet: appt.vet });
      setTimeout(() => setArrivedToast(null), 4000);
    }
  }

  // ── Search ──────────────────────────────────────────────────
  const isSearching = searchQuery.trim().length > 0;
  const hasResults = totalResults > 0;

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '32px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <h1 className="text-[var(--text-primary)]" style={{ marginBottom: '6px' }}>
            {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}, {adminProfile.firstName || 'there'} 👋
          </h1>
          <p className="text-[var(--text-secondary)]" style={{ fontSize: '16px' }}>
            Here's your clinic overview for today
          </p>
        </div>
        <ConnectionStatusBadge />
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
            boxShadow: isSearching ? '0 0 0 2px color-mix(in srgb, var(--brand-green-text) 25%, transparent)' : undefined,
            borderColor: isSearching ? 'color-mix(in srgb, var(--brand-green-text) 38%, transparent)' : undefined,
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
          {searchLoading ? (
            <div
              className="bg-[var(--surface-white)] border border-[var(--border-color)]"
              style={{ borderRadius: '12px', padding: '48px', textAlign: 'center' }}
            >
              <div style={{
                width: 28, height: 28, border: '3px solid var(--border-color)',
                borderTopColor: 'var(--brand-green-text)', borderRadius: '50%',
                animation: 'spin 0.7s linear infinite', margin: '0 auto 12px',
              }} />
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Searching…</p>
            </div>
          ) : !hasResults ? (
            <div
              className="bg-[var(--surface-white)] border border-[var(--border-color)]"
              style={{ borderRadius: '12px', padding: '48px', textAlign: 'center' }}
            >
              <Search style={{ width: '40px', height: '40px', color: 'var(--border-color)', margin: '0 auto 12px' }} />
              <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>No results found</p>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Try searching for a client name, pet, breed, or appointment reason</p>
            </div>
          ) : (
            <>
              {/* Client results */}
              {searchResults.clients.length > 0 && (
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
                      Clients · {searchResults.clients.length}
                    </span>
                  </div>
                  {searchResults.clients.map((c, i) => (
                    <div
                      key={c.id}
                      onClick={() => navigate(`/admin/clients/${c.id}`)}
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
                          background: 'linear-gradient(135deg, var(--brand-green-text), #74C69D)',
                          fontSize: '13px',
                        }}
                      >
                        {(c.first_name?.[0] || '') + (c.last_name?.[0] || '')}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{c.first_name} {c.last_name}</p>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{c.email || '—'}</p>
                      </div>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flexShrink: 0 }}>{c.phone || '—'}</span>
                      <ArrowRight style={{ width: '14px', height: '14px', color: 'var(--text-secondary)', flexShrink: 0 }} />
                    </div>
                  ))}
                </div>
              )}

              {/* Pet results */}
              {searchResults.pets.length > 0 && (
                <div
                  className="bg-[var(--surface-white)] border border-[var(--border-color)]"
                  style={{ borderRadius: '12px', overflow: 'hidden' }}
                >
                  <div
                    className="border-b border-[var(--border-color)] flex items-center gap-2"
                    style={{ padding: '12px 20px' }}
                  >
                    <PawPrint style={{ width: '14px', height: '14px', color: '#F4A261' }} />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Pets · {searchResults.pets.length}
                    </span>
                  </div>
                  {searchResults.pets.map((p, i) => (
                    <div
                      key={p.id}
                      onClick={() => p.client_id ? navigate(`/admin/clients/${p.client_id}`) : undefined}
                      className="flex items-center gap-4 cursor-pointer hover:bg-[var(--surface-elevated)] transition-colors"
                      style={{
                        padding: '14px 20px',
                        borderTop: i > 0 ? '1px solid var(--border-color)' : undefined,
                      }}
                    >
                      {p.photo_url ? (
                        <img
                          src={p.photo_url}
                          alt={p.name}
                          className="flex-shrink-0 object-cover"
                          style={{ width: '40px', height: '40px', borderRadius: '9999px' }}
                        />
                      ) : (
                        <div
                          className="flex items-center justify-center text-white font-bold flex-shrink-0"
                          style={{
                            width: '40px', height: '40px', borderRadius: '9999px',
                            background: 'linear-gradient(135deg, #F4A261, #E76F51)',
                            fontSize: '13px',
                          }}
                        >
                          {p.name.slice(0, 2)}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</p>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {p.species}{p.breed ? ` · ${p.breed}` : ''}
                          {p.clients ? ` — ${p.clients.first_name} ${p.clients.last_name}` : ''}
                        </p>
                      </div>
                      <ArrowRight style={{ width: '14px', height: '14px', color: 'var(--text-secondary)', flexShrink: 0 }} />
                    </div>
                  ))}
                </div>
              )}

              {/* Appointment results */}
              {searchResults.appointments.length > 0 && (
                <div
                  className="bg-[var(--surface-white)] border border-[var(--border-color)]"
                  style={{ borderRadius: '12px', overflow: 'hidden' }}
                >
                  <div
                    className="border-b border-[var(--border-color)] flex items-center gap-2"
                    style={{ padding: '12px 20px' }}
                  >
                    <CalendarDays style={{ width: '14px', height: '14px', color: '#3B82F6' }} />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Appointments · {searchResults.appointments.length}
                    </span>
                  </div>
                  {searchResults.appointments.map((a, i) => {
                    const dt = new Date(a.scheduled_at);
                    const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    const timeStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                    const s = STATUS_STYLES[(a.status as ApptStatus)] || STATUS_STYLES['Pending'];
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
                          {a.pets?.name?.slice(0, 2) || '??'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {a.pets?.name || 'Unknown Pet'}
                            {a.clients ? ` — ${a.clients.first_name} ${a.clients.last_name}` : ''}
                          </p>
                          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {a.services?.name || a.reason || 'Appointment'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                          <Clock style={{ width: '13px', height: '13px' }} />
                          {dateStr} · {timeStr}
                        </div>
                        <span style={{
                          padding: '3px 10px', borderRadius: '9999px',
                          fontSize: '12px', fontWeight: 600,
                          backgroundColor: s.bg, color: s.color, flexShrink: 0,
                        }}>
                          {a.status}
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
      <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: '20px', marginBottom: '28px' }}>
        {glowCards.map(card => (
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
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
                      {(effectiveStatus === 'Confirmed' || effectiveStatus === 'Late' || effectiveStatus === 'Scheduled' || effectiveStatus === 'Pending') ? (
                        <button
                          onClick={() => handleCheckIn(appt.id)}
                          style={{
                            padding: '6px 12px', borderRadius: '7px',
                            backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)',
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
      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '24px' }}>

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
            {recentPayments.length === 0 ? (
              <div style={{ padding: '32px 24px', textAlign: 'center' }}>
                <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: 'var(--text-secondary)' }} />
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>No recent payments</p>
              </div>
            ) : recentPayments.map((payment, idx) => {
              const ps = PAYMENT_STYLES[payment.status];
              return (
                <div
                  key={payment.id}
                  className="flex items-center gap-4 hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
                  style={{
                    padding: '14px 24px',
                    borderBottom: idx < recentPayments.length - 1 ? '1px solid var(--border-color)' : 'none',
                  }}
                  onClick={() => navigate('/admin/payments')}
                >
                  {payment.petPhoto ? (
                    <img
                      src={payment.petPhoto}
                      alt={payment.pet}
                      className="flex-shrink-0 object-cover"
                      style={{ width: '38px', height: '38px', borderRadius: '9999px' }}
                    />
                  ) : (
                    <div
                      className="flex items-center justify-center text-white font-bold flex-shrink-0"
                      style={{
                        width: '38px', height: '38px', borderRadius: '9999px',
                        background: 'linear-gradient(135deg, var(--brand-green-text), #74C69D)',
                        fontSize: '12px',
                      }}
                    >
                      {payment.pet.slice(0, 1)}
                    </div>
                  )}
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
              {unreadCount > 0 && (
                <span style={{
                  padding: '2px 8px', borderRadius: '9999px',
                  backgroundColor: '#d4183d15', color: '#d4183d',
                  fontSize: '12px', fontWeight: 700,
                }}>
                  {unreadCount}
                </span>
              )}
            </div>
            <Link
              to="/admin/chat"
              className="flex items-center gap-1 text-[var(--text-secondary)] hover:opacity-75 transition-opacity"
              style={{ fontSize: '12px', fontWeight: 600 }}
            >
              View all <ChevronRight className="w-[13px] h-[13px]" />
            </Link>
          </div>
          <div style={{ padding: '8px 0' }}>
            {unreadMessages.length === 0 ? (
              <div style={{ padding: '32px 24px', textAlign: 'center' }}>
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: 'var(--text-secondary)' }} />
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>No unread messages</p>
              </div>
            ) : unreadMessages.map((msg, idx) => (
              <div
                key={msg.id}
                className="flex items-start gap-3 hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
                style={{
                  padding: '14px 24px',
                  borderBottom: idx < unreadMessages.length - 1 ? '1px solid var(--border-color)' : 'none',
                }}
                onClick={() => navigate('/admin/chat')}
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
          const preset = serviceList.find(p => p.name === newItemLabel);
          const price = preset?.price ?? 0;
          setInvoiceItems(prev => [...prev, { id: Date.now(), label: newItemLabel, desc: '', price }]);
          setNewItemLabel('');
          setNewItemPrice('');
        };

        const removeInvoiceItem = (id: number) =>
          setInvoiceItems(prev => prev.filter(i => i.id !== id));

        const updateItemService = (id: number, serviceName: string) => {
          const preset = serviceList.find(p => p.name === serviceName);
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
                              {serviceList.map(p => (
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
                          const preset = serviceList.find(p => p.name === v);
                          setNewItemPrice(String(preset?.price ?? ''));
                        }}>
                          <SelectTrigger style={{ fontSize: 13, height: 34, borderRadius: 7, border: '1.5px dashed #8B5CF650', backgroundColor: 'var(--surface-white)' }}>
                            <SelectValue placeholder="Select a service to add…" />
                          </SelectTrigger>
                          <SelectContent className="max-h-64 !z-[500]">
                            {serviceList.map(p => (
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
            border: '1.5px solid color-mix(in srgb, var(--brand-green-text) 25%, transparent)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.16), 0 0 0 1px color-mix(in srgb, var(--brand-green-text) 8%, transparent)',
            overflow: 'hidden',
            animation: 'slideUp 0.25s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <div style={{ height: 3, background: 'linear-gradient(90deg, var(--brand-green-text), #74C69D)' }} />
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
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
