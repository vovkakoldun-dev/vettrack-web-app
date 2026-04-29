import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router';
import { Users, Calendar, Syringe, PawPrint, ChevronRight, ArrowUpRight, Search, X, Clock } from 'lucide-react';
import { ClientRow } from '../components/ClientRow';
import { AppointmentCard } from '../components/AppointmentCard';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useAppointments } from '../hooks/useAppointments';
import { useClients } from '../hooks/useClients';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../hooks/useProfile';
import { useTenantDb } from '../context/TenantContext';
import { ConnectionStatusBadge } from '../components/ConnectionStatusBadge';

// ─── Search result types ────────────────────────────────────

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

function useGlobalSearch(query: string, db: ReturnType<typeof useTenantDb>, debounceMs = 300) {
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

    // Step 1: Search clients and pets in parallel (tenant-scoped)
    const [clientsRes, petsRes] = await Promise.all([
      db
        .from('clients')
        .select('id, first_name, last_name, email, phone')
        .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
        .limit(6),
      db
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

    const orParts: string[] = [`reason.ilike.${pattern}`];
    if (clientIds.length > 0) orParts.push(`client_id.in.(${clientIds.join(',')})`);
    if (petIds.length > 0) orParts.push(`pet_id.in.(${petIds.join(',')})`);

    const appointmentsRes = await db
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

  // Read CSS custom properties from DOM
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

// ─── Page ─────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const db = useTenantDb();
  const { results: searchResults, loading: searchLoading, totalResults } = useGlobalSearch(searchQuery, db);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Selected clinic context ────────────────────────────────
  const [selectedClinic] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('selected_clinic') || '{}');
    } catch { return {}; }
  });
  const isDevClinic = selectedClinic.is_dev !== false; // default to dev if not set

  // ── Vet name from useProfile hook ─────────
  const { profile: doctorProfile } = useProfile('doctor');

  // ── Real data from Supabase ─────────────────────────────────
  const stats = useDashboardStats();
  const now = new Date();
  const today = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
  const { appointments: todayAppointments } = useAppointments(today);
  const { clients: allClients } = useClients();

  // Generate last 7 day labels
  const dayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  // Build a simple growth curve from 0 → current value over 7 points
  const buildSparkData = (current: number, growth: boolean) => {
    if (current === 0) return Array(7).fill(0);
    if (!growth) {
      // For metrics like vaccines due — show variation
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

  // Merge live stats into card configs
  const GLOW_CARDS = GLOW_CARD_CONFIG.map((c, i) => {
    const values = [stats.totalClients, stats.appointmentsToday, stats.vaccinesDueThisWeek, stats.activePets];
    const v = values[i];
    const sparkData = buildSparkData(v, c.trendPositive);
    // Ensure last point exactly matches current value
    sparkData[sparkData.length - 1] = v;
    return {
      ...c,
      value: v.toLocaleString(),
      trendLabel: 'Live data',
      data: sparkData,
      labels: dayLabels,
      annotationStart: sparkData[0].toLocaleString(),
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
    status: (['Healthy', 'Follow-up', 'Critical'].includes((c as any).health_status) ? (c as any).health_status : 'Healthy') as 'Healthy' | 'Follow-up' | 'Critical',
  }));

  // Today's appointments (exclude cancelled)
  const upcomingAppointments = todayAppointments
    .filter(a => a.status !== 'Cancelled')
    .slice(0, 4);

  const isSearching = searchQuery.trim().length > 0;

  return (
    <div className="max-w-[1440px] mx-auto p-8">
      {/* Welcome Header */}
      <div className="mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="text-[var(--text-primary)] mb-2">Welcome back, {doctorProfile.displayName || 'Doctor'} 👋</h1>
          <p className="text-[var(--text-secondary)]" style={{ fontSize: '16px', fontWeight: 400 }}>
            {selectedClinic.name
              ? `${selectedClinic.name} — Here's what's happening today.`
              : "Here's what's happening with your clinic today."}
          </p>
        </div>
        <ConnectionStatusBadge />
      </div>

      {/* ── Global Search ── */}
      <div className="relative mb-8" ref={searchContainerRef}>
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
          style={{ color: 'var(--text-secondary)', zIndex: 1 }}
        />
        <input
          ref={searchRef}
          data-tour="dash-search"
          type="text"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
          onFocus={() => { if (searchQuery.trim()) setSearchOpen(true); }}
          placeholder="Search clients, pets, appointments, services…"
          className="w-full bg-[var(--surface-white)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-shadow focus:outline-none"
          style={{
            height: '48px',
            borderRadius: '12px',
            paddingLeft: '44px',
            paddingRight: searchQuery ? '44px' : '16px',
            fontSize: '15px',
            boxShadow: isSearching && searchOpen ? '0 0 0 2px color-mix(in srgb, var(--brand-green-text) 25%, transparent)' : undefined,
            borderColor: isSearching && searchOpen ? 'color-mix(in srgb, var(--brand-green-text) 38%, transparent)' : undefined,
          }}
        />
        {searchQuery && (
          <button
            onClick={() => { setSearchQuery(''); setSearchOpen(false); searchRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--surface-elevated)] transition-colors"
            style={{ zIndex: 1 }}
          >
            <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        )}

        {/* ── Search Dropdown ── */}
        {isSearching && searchOpen && (
          <div
            className="absolute left-0 right-0 bg-[var(--surface-white)] border border-[var(--border-color)] overflow-hidden"
            style={{
              top: 'calc(100% + 6px)',
              borderRadius: '12px',
              boxShadow: '0 12px 40px -8px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.04)',
              zIndex: 50,
              maxHeight: '420px',
              overflowY: 'auto',
            }}
          >
            {searchLoading ? (
              <div className="px-5 py-8 text-center">
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Searching...</p>
              </div>
            ) : totalResults === 0 ? (
              <div className="px-5 py-8 text-center">
                <Search className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--border-color)' }} />
                <p className="text-[var(--text-primary)] mb-1" style={{ fontSize: '15px', fontWeight: 600 }}>No results found</p>
                <p className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>Try searching for a pet name, owner, or service</p>
              </div>
            ) : (
              <>
                {/* Client results */}
                {searchResults.clients.length > 0 && (
                  <div>
                    <div className="px-4 py-2.5 border-b border-[var(--border-color)] flex items-center gap-2" style={{ backgroundColor: 'var(--surface-elevated)' }}>
                      <Users className="w-3.5 h-3.5" style={{ color: 'var(--brand-green-text)' }} />
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        Clients · {searchResults.clients.length}
                      </span>
                    </div>
                    {searchResults.clients.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => { navigate(`/clients/${c.id}`); setSearchOpen(false); setSearchQuery(''); }}
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--surface-elevated)] transition-colors border-b border-[var(--border-color)]"
                      >
                        <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--brand-green-text) 9%, transparent)' }}>
                          <Users className="w-4 h-4" style={{ color: 'var(--brand-green-text)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{c.first_name} {c.last_name}</p>
                          <p className="truncate" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{c.email || c.phone || 'No contact info'}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Pet results */}
                {searchResults.pets.length > 0 && (
                  <div>
                    <div className="px-4 py-2.5 border-b border-[var(--border-color)] flex items-center gap-2" style={{ backgroundColor: 'var(--surface-elevated)' }}>
                      <PawPrint className="w-3.5 h-3.5" style={{ color: '#4ADE80' }} />
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        Pets · {searchResults.pets.length}
                      </span>
                    </div>
                    {searchResults.pets.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => { navigate(`/clients/${p.client_id}`); setSearchOpen(false); setSearchQuery(''); }}
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--surface-elevated)] transition-colors border-b border-[var(--border-color)]"
                      >
                        {p.photo_url ? (
                          <img src={p.photo_url} alt={p.name} className="w-8 h-8 object-cover flex-shrink-0 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: '#4ADE8018' }}>
                            <PawPrint className="w-4 h-4" style={{ color: '#4ADE80' }} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</p>
                          <p className="truncate" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {p.breed || p.species}{p.clients ? ` · ${p.clients.first_name} ${p.clients.last_name}` : ''}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Appointment results */}
                {searchResults.appointments.length > 0 && (
                  <div>
                    <div className="px-4 py-2.5 border-b border-[var(--border-color)] flex items-center gap-2" style={{ backgroundColor: 'var(--surface-elevated)' }}>
                      <Calendar className="w-3.5 h-3.5" style={{ color: '#F4A261' }} />
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        Appointments · {searchResults.appointments.length}
                      </span>
                    </div>
                    {searchResults.appointments.map((a) => (
                      <div
                        key={a.id}
                        onClick={() => { navigate('/appointments', { state: { openApptId: a.id } }); setSearchOpen(false); setSearchQuery(''); }}
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--surface-elevated)] transition-colors border-b border-[var(--border-color)]"
                      >
                        <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: '#F4A26118' }}>
                          <Calendar className="w-4 h-4" style={{ color: '#F4A261' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{a.pets?.name ?? 'Unknown pet'}</p>
                          <p className="truncate" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {a.clients ? `${a.clients.first_name} ${a.clients.last_name}` : '—'} · {a.services?.name ?? a.reason ?? '—'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0" style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                          <Clock className="w-3 h-3" />
                          {new Date(a.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        <span
                          className="flex-shrink-0 px-2 py-0.5"
                          style={{
                            fontSize: '11px', fontWeight: 600, borderRadius: '9999px',
                            backgroundColor: a.status === 'Confirmed' ? 'color-mix(in srgb, var(--brand-green-text) 9%, transparent)' : a.status === 'Completed' ? '#3B82F618' : a.status === 'Cancelled' ? '#d4183d18' : '#F4A26118',
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
        )}
      </div>

      {/* Dashboard content — hidden while searching */}
      {!isSearching && (<>
      {/* Glow Stat Cards */}
      <div data-tour="dash-stats" className="grid grid-cols-4 gap-5 mb-8">
        {GLOW_CARDS.map(card => (
          <GlowStatCard key={card.title} {...card} />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Recent Clients */}
        <div data-tour="dash-recent-clients" className="col-span-2 bg-[var(--surface-white)] border border-[var(--border-color)]" style={{ borderRadius: '12px' }}>
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
        <div data-tour="dash-today-appts" className="bg-[var(--surface-white)] border border-[var(--border-color)]" style={{ borderRadius: '12px' }}>
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
      </>)}
    </div>
  );
}
