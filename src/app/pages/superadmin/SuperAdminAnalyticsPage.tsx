import { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Calendar, Users, PawPrint,
  Download, ChevronDown, ChevronRight, Pencil, Check, X,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { getOrgContext } from '../../hooks/useOrgContext';

// ─── Dark mode hook ───────────────────────────────────────────

function useDarkMode(): boolean {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

// ─── Spline helper ────────────────────────────────────────────

function spline(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i];
    const cpx = p.x + (c.x - p.x) * 0.5;
    d += ` C ${cpx} ${p.y}, ${cpx} ${c.y}, ${c.x} ${c.y}`;
  }
  return d;
}

const AVATAR_COLORS = ['#818CF8', '#38BDF8', '#F4A261', '#4ADE80', '#F472B6', '#A78BFA', '#EF4444'];

// ─── Helper functions ─────────────────────────────────────────

function getLast12Months(): { labels: string[]; starts: Date[] } {
  const now = new Date();
  const labels: string[] = [];
  const starts: Date[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(d.toLocaleDateString('en-US', { month: 'short' }));
    starts.push(d);
  }
  return { labels, starts };
}

// ─── KPI Card ─────────────────────────────────────────────────

function KpiCard({ label, value, trend, trendUp, sub, color, icon: Icon }: {
  label: string; value: string; trend: string; trendUp: boolean;
  sub: string; color: string; icon: React.ElementType;
}) {
  return (
    <div style={{
      backgroundColor: 'var(--surface-white)',
      border: '1px solid var(--border-color)',
      borderRadius: '14px', padding: '20px 22px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </p>
        <div style={{
          width: '34px', height: '34px', borderRadius: '9px',
          backgroundColor: `${color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon style={{ width: '16px', height: '16px', color }} />
        </div>
      </div>
      <p style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '6px' }}>
        {value}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '3px',
          padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700,
          backgroundColor: trendUp ? '#22C55E15' : '#EF444415',
          color: trendUp ? '#16A34A' : '#DC2626',
        }}>
          {trendUp ? <TrendingUp style={{ width: '10px', height: '10px' }} /> : <TrendingDown style={{ width: '10px', height: '10px' }} />}
          {trend}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{sub}</span>
      </div>
    </div>
  );
}

// ─── Line Chart ───────────────────────────────────────────────

function LineChart({ data, labels, color, label, prefix = '', suffix = '', viewBoxWidth = 600, viewBoxHeight = 200 }: {
  data: number[]; labels: string[]; color: string; label: string;
  prefix?: string; suffix?: string; viewBoxWidth?: number; viewBoxHeight?: number;
}) {
  const dark = useDarkMode();
  const [hovered, setHovered] = useState<number | null>(null);
  const W = viewBoxWidth, H = viewBoxHeight, PX = 48, PY = 20;

  if (!data.length || !labels.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', color: 'var(--text-secondary)', fontSize: '13px' }}>
        No data available
      </div>
    );
  }

  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;

  const pts = data.map((v, i) => ({
    x: PX + (i / (data.length - 1)) * (W - PX * 2),
    y: H - PY - ((v - min) / range) * (H - PY * 2),
  }));

  const linePath = spline(pts);
  const areaPath = linePath + ` L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`;
  const uid = label.replace(/\s+/g, '');

  const gridColor   = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const labelColor  = dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)';
  const tooltipBg   = dark ? '#1a2a3a' : '#ffffff';
  const tooltipBrd  = `${color}55`;

  const gridLines = 4;

  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setHovered(null)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair', overflow: 'visible' }}
        onMouseMove={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          const mx = ((e.clientX - rect.left) / rect.width) * W;
          let ni = 0, md = Infinity;
          pts.forEach((p, i) => { const d = Math.abs(p.x - mx); if (d < md) { md = d; ni = i; } });
          setHovered(ni);
        }}
      >
        <defs>
          <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity={dark ? 0.25 : 0.15} />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <filter id={`glow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          </filter>
        </defs>

        {/* Grid lines */}
        {Array.from({ length: gridLines }).map((_, i) => {
          const y = PY + (i / (gridLines - 1)) * (H - PY * 2);
          const val = max - (i / (gridLines - 1)) * range;
          return (
            <g key={i}>
              <line x1={PX} y1={y} x2={W - PX} y2={y} stroke={gridColor} strokeWidth="1" />
              <text x={PX - 6} y={y + 4} fill={labelColor} fontSize="11" textAnchor="end" fontFamily="system-ui">
                {prefix}{val >= 10000 ? (val / 1000).toFixed(0) + 'k' : val >= 1000 ? (val / 1000).toFixed(1) + 'k' : Math.round(val)}{suffix}
              </text>
            </g>
          );
        })}

        {/* Month labels */}
        {labels.map((l, i) => {
          const x = PX + (i / (labels.length - 1)) * (W - PX * 2);
          return (
            <text key={i} x={x} y={H - 2} fill={labelColor} fontSize="11" textAnchor="middle" fontFamily="system-ui">
              {l}
            </text>
          );
        })}

        {/* Area + line */}
        <path d={areaPath} fill={`url(#area-${uid})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" opacity="0.2" filter={`url(#glow-${uid})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Hover elements */}
        {hovered !== null && (() => {
          const hx = pts[hovered].x, hy = pts[hovered].y;
          return (
            <>
              <line x1={hx} y1={PY} x2={hx} y2={H - PY} stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
              <circle cx={hx} cy={hy} r="7" fill={color} opacity="0.18" />
              <circle cx={hx} cy={hy} r="4" fill={color} />
              <circle cx={hx} cy={hy} r="2" fill="#fff" />
            </>
          );
        })()}
      </svg>

      {/* Tooltip */}
      {hovered !== null && (() => {
        const hx = pts[hovered].x, hy = pts[hovered].y;
        const fromBottom = H - hy;
        return (
          <div style={{
            position: 'absolute',
            left: `${(hx / W) * 100}%`,
            bottom: `${((fromBottom + 14) / H) * 100}%`,
            transform: 'translateX(-50%)',
            pointerEvents: 'none', zIndex: 10,
            backgroundColor: tooltipBg,
            border: `1px solid ${tooltipBrd}`,
            borderRadius: '10px', padding: '7px 12px',
            boxShadow: `0 4px 20px rgba(0,0,0,0.15)`,
            whiteSpace: 'nowrap', backdropFilter: 'blur(8px)',
          }}>
            <div style={{ fontSize: '10px', color: labelColor, fontWeight: 600, marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {labels[hovered]}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color }}>
              {prefix}{data[hovered].toLocaleString()}{suffix}
            </div>
            <div style={{
              position: 'absolute', bottom: '-5px', left: '50%',
              width: '8px', height: '8px',
              backgroundColor: tooltipBg,
              borderRight: `1px solid ${tooltipBrd}`, borderBottom: `1px solid ${tooltipBrd}`,
              transform: 'translateX(-50%) rotate(45deg)',
            }} />
          </div>
        );
      })()}
    </div>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────

function BarChart({ data }: { data: { day: string; val: number }[] }) {
  const dark = useDarkMode();
  const [hovered, setHovered] = useState<number | null>(null);
  const color = '#F4A261';
  const colorToday = '#C2671A';

  if (!data.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', color: 'var(--text-secondary)', fontSize: '13px' }}>
        No data available
      </div>
    );
  }

  const max = Math.max(...data.map(d => d.val)) || 1;
  const W = 500, H = 160, PB = 24, PT = 10, BAR_W = 28;
  const gap = (W - data.length * BAR_W) / (data.length + 1);

  return (
    <div style={{ position: 'relative', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <defs>
          <filter id="bar-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          </filter>
        </defs>
        {data.map((d, i) => {
          const x = gap + i * (BAR_W + gap);
          const barH = ((d.val - 0) / max) * (H - PT - PB);
          const y = H - PB - barH;
          const isToday = d.day === 'Today';
          const isHov = hovered === i;
          const c = isToday ? colorToday : color;

          return (
            <g key={i}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Bar shadow/glow */}
              {isHov && <rect x={x} y={y} width={BAR_W} height={barH} rx="5" fill={c} opacity="0.3" filter="url(#bar-glow)" />}
              {/* Bar */}
              <rect x={x} y={y} width={BAR_W} height={barH} rx="5" fill={c} opacity={isHov ? 1 : isToday ? 0.9 : 0.6} />
              {/* Value label on hover */}
              {isHov && (
                <text x={x + BAR_W / 2} y={y - 6} fill={c} fontSize="12" fontWeight="700" textAnchor="middle" fontFamily="system-ui">
                  {d.val}
                </text>
              )}
              {/* Day label */}
              <text
                x={x + BAR_W / 2} y={H - 6}
                fill={dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)'}
                fontSize="10" textAnchor="middle" fontFamily="system-ui"
                fontWeight={isToday ? '700' : '400'}
              >
                {d.day.split(' ')[0]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Chart Card ───────────────────────────────────────────────

function ChartCard({ title, subtitle, children, action }: {
  title: string; subtitle: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div style={{
      backgroundColor: 'var(--surface-white)',
      border: '1px solid var(--border-color)',
      borderRadius: '14px', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 22px 14px',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <div>
          <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>{title}</p>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{subtitle}</p>
        </div>
        {action}
      </div>
      <div style={{ padding: '18px 22px' }}>
        {children}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

const RANGES = ['Last 7 days', 'Last 30 days', 'Last 12 months', 'All time'];

export default function SuperAdminAnalyticsPage() {
  const [range, setRange] = useState('Last 12 months');
  const [rangeOpen, setRangeOpen] = useState(false);

  // ─── State — initialised empty, populated from Supabase ───
  const [loading, setLoading] = useState(true);
  const [revenueYtd, setRevenueYtd] = useState(0);
  const [totalAppts, setTotalAppts] = useState(0);
  const [newPatients, setNewPatients] = useState(0);
  const [avgPerVisit, setAvgPerVisit] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState<number[]>([]);
  const [monthlyAppts, setMonthlyAppts] = useState<number[]>([]);
  const [monthLabels, setMonthLabels] = useState<string[]>([]);
  const [dailyAppts, setDailyAppts] = useState<{ day: string; val: number }[]>([]);
  const [services, setServices] = useState<{ name: string; count: number; color: string; pct: number }[]>([]);
  const [showAllServices, setShowAllServices] = useState(false);
  const [patientsData, setPatientsData] = useState<number[]>([]);
  const [doctorPerf, setDoctorPerf] = useState<{ name: string; initials: string; color: string; role: string; revenue: string; completed: number; pets: number }[]>([]);
  const [adminPerf, setAdminPerf] = useState<{ name: string; initials: string; color: string; role: string; booked: number; tasksCompleted: number }[]>([]);
  const [thisMonthRevenue, setThisMonthRevenue] = useState(0);
  const [thisMonthAppts, setThisMonthAppts] = useState(0);
  const [revenueTarget, setRevenueTarget] = useState(60000);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState('');
  const [revenueTrend, setRevenueTrend] = useState('—');
  const [revenueTrendUp, setRevenueTrendUp] = useState(true);
  const [apptsTrend, setApptsTrend] = useState('—');
  const [apptsTrendUp, setApptsTrendUp] = useState(true);
  const [patientsTrend, setPatientsTrend] = useState('—');
  const [patientsTrendUp, setPatientsTrendUp] = useState(true);
  const [avgTrend, setAvgTrend] = useState('—');
  const [avgTrendUp, setAvgTrendUp] = useState(true);
  const [totalActivePatients, setTotalActivePatients] = useState(0);
  const [dailyAvg, setDailyAvg] = useState(0);
  const [busiestDay, setBusiestDay] = useState({ label: '—', val: 0 });
  const [quietestDay, setQuietestDay] = useState({ label: '—', val: 0 });
  const [todayAppts, setTodayAppts] = useState(0);

  // ─── Load real data ───
  useEffect(() => {
    async function loadAnalytics() {
      try {
        const { organizationId } = await getOrgContext();
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const { labels, starts } = getLast12Months();

        // ── Load revenue target from org settings ──
        const { data: targetRow } = await supabase
          .from('organization_settings')
          .select('value')
          .eq('organization_id', organizationId)
          .eq('key', 'revenue_target')
          .maybeSingle();
        if (targetRow?.value) {
          const parsed = Number(targetRow.value);
          if (!isNaN(parsed) && parsed > 0) setRevenueTarget(parsed);
        }

        // ── Fetch all data in parallel ──
        const [invoicesRes, appointmentsRes, petsRes, serviceApptsRes, staffRes] = await Promise.all([
          supabase
            .from('invoices')
            .select('total, created_at, status, paid_at')
            .eq('organization_id', organizationId)
            .in('status', ['Paid', 'Sent', 'Partial', 'Overdue']),
          supabase
            .from('appointments')
            .select('id, scheduled_at, status, vet_id, type, duration_minutes')
            .eq('organization_id', organizationId),
          supabase
            .from('pets')
            .select('id, created_at')
            .eq('organization_id', organizationId),
          supabase
            .from('appointments')
            .select('reason, type')
            .eq('organization_id', organizationId),
          supabase
            .from('staff')
            .select('id, role, total_appointments, profiles:profiles!staff_profile_id_fkey(first_name, last_name)')
            .eq('organization_id', organizationId)
            .eq('status', 'Active')
            .neq('role', 'owner')
            .order('role'),
        ]);

        const invoices = invoicesRes.data || [];
        const appointments = appointmentsRes.data || [];
        const pets = petsRes.data || [];
        const serviceAppts = serviceApptsRes.data || [];
        const staffData = staffRes.data || [];

        // ── Revenue KPIs & Monthly Revenue ──
        const ytdInvoices = invoices.filter(inv => new Date(inv.created_at) >= new Date(startOfYear));
        const ytdRevenue = ytdInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
        setRevenueYtd(ytdRevenue);

        // Compute YTD appointment count & avg per visit locally (needed for staff revenue calc)
        const localYtdAppts = appointments.filter(a => new Date(a.scheduled_at) >= new Date(startOfYear)).length;
        const localAvgPerVisit = localYtdAppts > 0 && ytdRevenue > 0 ? ytdRevenue / localYtdAppts : 0;

        // Monthly revenue for last 12 months
        const monthlyRev = starts.map((start, i) => {
          const end = i < starts.length - 1 ? starts[i + 1] : new Date(now.getFullYear(), now.getMonth() + 1, 1);
          return invoices
            .filter(inv => {
              const d = new Date(inv.created_at);
              return d >= start && d < end;
            })
            .reduce((sum, inv) => sum + (inv.total || 0), 0);
        });
        setMonthlyRevenue(monthlyRev);
        setMonthLabels(labels);

        // This month revenue
        const thisMonthRev = monthlyRev[monthlyRev.length - 1] || 0;
        setThisMonthRevenue(thisMonthRev);

        // Revenue YoY trend
        const lastYearStart = new Date(now.getFullYear() - 1, 0, 1).toISOString();
        const lastYearEnd = new Date(now.getFullYear() - 1, now.getMonth() + 1, 0).toISOString();
        const lastYearRevenue = invoices
          .filter(inv => {
            const d = new Date(inv.created_at);
            return d >= new Date(lastYearStart) && d <= new Date(lastYearEnd);
          })
          .reduce((sum, inv) => sum + (inv.total || 0), 0);
        if (lastYearRevenue > 0) {
          const pct = ((ytdRevenue - lastYearRevenue) / lastYearRevenue) * 100;
          setRevenueTrend(`${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`);
          setRevenueTrendUp(pct >= 0);
        }

        // ── Appointments KPIs & Monthly ──
        setTotalAppts(appointments.length);

        const monthlyApptCounts = starts.map((start, i) => {
          const end = i < starts.length - 1 ? starts[i + 1] : new Date(now.getFullYear(), now.getMonth() + 1, 1);
          return appointments.filter(a => {
            const d = new Date(a.scheduled_at);
            return d >= start && d < end;
          }).length;
        });
        setMonthlyAppts(monthlyApptCounts);

        // This month appointments
        const thisMonthApptCount = monthlyApptCounts[monthlyApptCounts.length - 1] || 0;
        setThisMonthAppts(thisMonthApptCount);

        // Daily average this month
        const daysInMonth = now.getDate();
        setDailyAvg(daysInMonth > 0 ? Math.round(thisMonthApptCount / daysInMonth) : 0);

        // Appointments YoY trend
        const lastYearAppts = appointments.filter(a => {
          const d = new Date(a.scheduled_at);
          return d >= new Date(lastYearStart) && d <= new Date(lastYearEnd);
        }).length;
        if (lastYearAppts > 0) {
          const pct = ((appointments.length - lastYearAppts) / lastYearAppts) * 100;
          setApptsTrend(`${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`);
          setApptsTrendUp(pct >= 0);
        }

        // Daily appointments — last 14 days (including today)
        const dailyData: { day: string; val: number }[] = [];
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (let i = 13; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const isToday = i === 0;
          const label = isToday
            ? 'Today'
            : `${dayNames[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;
          const nextDay = new Date(d);
          nextDay.setDate(nextDay.getDate() + 1);
          const count = appointments.filter(a => {
            const ad = new Date(a.scheduled_at);
            return ad >= d && ad < nextDay;
          }).length;
          dailyData.push({ day: label, val: count });
        }
        setDailyAppts(dailyData);
        const nonZeroDays = dailyData.filter(d => d.day !== 'Today');
        const maxEntry = nonZeroDays.length > 0
          ? nonZeroDays.reduce((a, b) => b.val > a.val ? b : a, nonZeroDays[0])
          : dailyData[0];
        const minEntry = nonZeroDays.length > 0
          ? nonZeroDays.reduce((a, b) => b.val < a.val ? b : a, nonZeroDays[0])
          : dailyData[0];
        setBusiestDay({ label: maxEntry.day, val: maxEntry.val });
        setQuietestDay({ label: minEntry.day, val: minEntry.val });
        const todayEntry = dailyData.find(d => d.day === 'Today');
        setTodayAppts(todayEntry?.val ?? 0);

        // ── New Patients ──
        const newPets = pets.filter(p => new Date(p.created_at) >= new Date(startOfYear)).length;
        setNewPatients(newPets);

        // Patients YoY trend
        const lastYearPets = pets.filter(p => {
          const d = new Date(p.created_at);
          return d >= new Date(lastYearStart) && d <= new Date(lastYearEnd);
        }).length;
        if (lastYearPets > 0) {
          const pct = ((newPets - lastYearPets) / lastYearPets) * 100;
          setPatientsTrend(`${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`);
          setPatientsTrendUp(pct >= 0);
        }

        // ── Avg per Visit ──
        if (localAvgPerVisit > 0) {
          setAvgPerVisit(localAvgPerVisit);

          // Compare to last year avg
          if (lastYearAppts > 0 && lastYearRevenue > 0) {
            const lastYearAvg = lastYearRevenue / lastYearAppts;
            const pct = ((localAvgPerVisit - lastYearAvg) / lastYearAvg) * 100;
            setAvgTrend(`${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`);
            setAvgTrendUp(pct >= 0);
          }
        }

        // ── Services Breakdown ──
        if (serviceAppts.length > 0) {
          const typeCounts: Record<string, number> = {};
          serviceAppts.forEach((a: any) => {
            // Use reason field — split on "+", "&", "," to count each service separately
            // e.g. "Annual Checkup + Vaccination" → ["Annual Checkup", "Vaccination"]
            const raw = a.reason || a.type || 'Other';
            const parts = raw.split(/[+&,]/).map((s: string) => s.trim()).filter(Boolean);
            (parts.length > 0 ? parts : ['Other']).forEach((t: string) => {
              typeCounts[t] = (typeCounts[t] || 0) + 1;
            });
          });
          const serviceColors = ['#818CF8', '#38BDF8', '#4ADE80', '#F4A261', '#F472B6', '#A78BFA', '#EF4444'];
          const maxCount = Math.max(...Object.values(typeCounts));
          const sorted = Object.entries(typeCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count], idx) => ({
              name,
              count,
              color: serviceColors[idx % serviceColors.length],
              pct: maxCount > 0 ? Math.round((count / maxCount) * 100) : 0,
            }));
          setServices(sorted);
        }

        // ── Patient Growth ──
        const patientMonthly = starts.map((start, i) => {
          const end = i < starts.length - 1 ? starts[i + 1] : new Date(now.getFullYear(), now.getMonth() + 1, 1);
          return pets.filter(p => new Date(p.created_at) < end).length;
        });
        if (patientMonthly.some(v => v > 0)) {
          setPatientsData(patientMonthly);
          setTotalActivePatients(patientMonthly[patientMonthly.length - 1] || 0);
        }

        // ── Staff Performance — split doctors vs admin ──
        if (staffData.length > 0) {
          // Fetch appointments for this month to count completed & pets per vet
          const { data: monthApptData } = await supabase
            .from('appointments')
            .select('vet_id, pet_id, status')
            .eq('organization_id', organizationId)
            .gte('scheduled_at', startOfMonth);
          const monthAppts = monthApptData || [];

          // Fetch pets assigned to each vet (via assigned_vet_id on pets table)
          const { data: assignedPetsData } = await supabase
            .from('pets')
            .select('id, assigned_vet_id')
            .eq('organization_id', organizationId);
          const assignedPets = assignedPetsData || [];

          // Fetch tasks completed this month
          const { data: tasksData } = await supabase
            .from('tasks')
            .select('assigned_to_id, status')
            .eq('organization_id', organizationId);
          const tasks = tasksData || [];

          // Fetch invoices this month for per-vet revenue
          const thisMonthInvoices = invoices.filter(inv => new Date(inv.created_at) >= new Date(startOfMonth));

          const VET_ROLES = ['veterinarian', 'senior_veterinarian', 'specialist'];
          const ADMIN_ROLES = ['clinic_manager', 'receptionist', 'front_desk_manager', 'vet_technician', 'lead_vet_tech', 'groomer', 'lab_technician'];

          const doctors: typeof doctorPerf = [];
          const admins: typeof adminPerf = [];

          staffData.forEach((s: any, idx: number) => {
            const profile = s.profiles as { first_name: string; last_name: string } | null;
            const firstName = profile?.first_name || '';
            const lastName = profile?.last_name || '';
            const fullName = `${firstName} ${lastName}`.trim() || 'Unknown';
            const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '??';
            const role = s.role || 'staff';

            if (VET_ROLES.includes(role)) {
              const completed = monthAppts.filter(a => a.vet_id === s.id && a.status === 'Completed').length;
              const uniquePets = assignedPets.filter(p => p.assigned_vet_id === s.id).length;
              // Estimate revenue: completed appointments * avg per visit
              const rev = completed > 0 && localAvgPerVisit > 0
                ? `$${(completed * localAvgPerVisit).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                : completed > 0 ? `$${(thisMonthInvoices.reduce((sum, i) => sum + (i.total || 0), 0) / Math.max(monthAppts.filter(a => a.status === 'Completed').length, 1) * completed).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '$0';
              doctors.push({ name: fullName, initials, color: AVATAR_COLORS[idx % AVATAR_COLORS.length], role, revenue: rev, completed, pets: uniquePets });
            } else if (ADMIN_ROLES.includes(role)) {
              const booked = s.total_appointments || 0;
              const tasksCompleted = tasks.filter(t => t.assigned_to_id === s.id && t.status === 'Completed').length;
              admins.push({ name: fullName, initials, color: AVATAR_COLORS[idx % AVATAR_COLORS.length], role, booked, tasksCompleted });
            }
          });

          setDoctorPerf(doctors);
          setAdminPerf(admins);
        }
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, []);

  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const chartSubtitle = monthLabels.length > 0
    ? `${monthLabels[0]} ${new Date().getFullYear() - 1} – ${monthLabels[monthLabels.length - 1]} ${new Date().getFullYear()}`
    : '';

  const prevMonthAppts = monthlyAppts.length >= 2 ? monthlyAppts[monthlyAppts.length - 2] : 0;
  const apptProgressPct = prevMonthAppts > 0 ? Math.min((thisMonthAppts / prevMonthAppts) * 100, 100) : 0;

  // ─── Save revenue target ───
  async function saveRevenueTarget() {
    const val = Number(targetInput.replace(/[^0-9.]/g, ''));
    if (isNaN(val) || val <= 0) { setEditingTarget(false); return; }
    setRevenueTarget(val);
    setEditingTarget(false);
    const { organizationId } = await getOrgContext();
    await supabase
      .from('organization_settings')
      .upsert(
        { organization_id: organizationId, key: 'revenue_target', value: String(val), updated_at: new Date().toISOString() },
        { onConflict: 'organization_id,key' }
      );
  }

  // ─── PDF Export ───
  function handleExportPdf() {
    const now = new Date();
    const reportDate = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const revenueMax = Math.max(...(monthlyRevenue.length ? monthlyRevenue : [1]));
    const apptsMax = Math.max(...(monthlyAppts.length ? monthlyAppts : [1]));

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<title>HugoIT Analytics Report — ${currentMonth}</title>
<style>
  @page { size: A4; margin: 18mm 16mm 20mm 16mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a2332; font-size: 11px; line-height: 1.45; }
  .page-break { page-break-before: always; }

  /* Header */
  .header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 16px; border-bottom: 3px solid var(--brand-green-text); margin-bottom: 20px; }
  .logo { display: flex; align-items: center; gap: 12px; }
  .logo-icon { width: 44px; height: 44px; border-radius: 10px; background: linear-gradient(135deg, var(--brand-green-text), #4ADE80); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 18px; font-weight: 800; }
  .logo-text h1 { font-size: 20px; font-weight: 800; color: var(--brand-green-text); letter-spacing: -0.5px; }
  .logo-text p { font-size: 11px; color: #6b7280; }
  .header-right { text-align: right; }
  .header-right h2 { font-size: 14px; font-weight: 700; color: #1a2332; margin-bottom: 2px; }
  .header-right p { font-size: 10px; color: #6b7280; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }

  /* Section */
  .section { margin-bottom: 20px; }
  .section-title { font-size: 13px; font-weight: 700; color: var(--brand-green-text); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1.5px solid #e5e7eb; display: flex; align-items: center; gap: 8px; }
  .section-title::before { content: ''; width: 4px; height: 16px; border-radius: 2px; background: var(--brand-green-text); }

  /* KPI Grid */
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  .kpi-card { border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; }
  .kpi-label { font-size: 9px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
  .kpi-value { font-size: 22px; font-weight: 800; color: #1a2332; margin-bottom: 4px; }
  .kpi-trend { font-size: 10px; font-weight: 700; }
  .kpi-trend.up { color: #16a34a; }
  .kpi-trend.down { color: #dc2626; }
  .kpi-sub { font-size: 9px; color: #9ca3af; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { font-size: 9px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; text-align: left; padding: 8px 10px; border-bottom: 2px solid #e5e7eb; }
  td { padding: 9px 10px; border-bottom: 1px solid #f3f4f6; }
  tr:last-child td { border-bottom: none; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .fw700 { font-weight: 700; }
  .fw800 { font-weight: 800; }

  /* Bar charts (CSS-only) */
  .bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .bar-label { width: 36px; font-size: 10px; font-weight: 600; color: #6b7280; text-align: right; flex-shrink: 0; }
  .bar-track { flex: 1; height: 14px; background: #f3f4f6; border-radius: 7px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 7px; }
  .bar-val { width: 60px; font-size: 10px; font-weight: 700; color: #1a2332; }

  /* Service rows */
  .svc-row { display: flex; align-items: center; gap: 10px; margin-bottom: 7px; }
  .svc-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .svc-name { flex: 1; font-size: 11px; font-weight: 600; }
  .svc-count { font-size: 11px; font-weight: 700; width: 40px; text-align: right; }
  .svc-bar-track { width: 120px; height: 6px; background: #f3f4f6; border-radius: 3px; overflow: hidden; }
  .svc-bar-fill { height: 100%; border-radius: 3px; }

  /* 2-col layout */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

  /* Staff avatar */
  .avatar { width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: #fff; flex-shrink: 0; }
  .staff-cell { display: flex; align-items: center; gap: 8px; }
  .staff-name { font-weight: 600; font-size: 11px; }
  .staff-role { font-size: 9px; color: #6b7280; }

  /* Summary box */
  .summary-box { background: #f8faf9; border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 14px 18px; }
  .summary-row { display: flex; justify-content: space-between; padding: 4px 0; }
  .summary-label { color: #6b7280; }
  .summary-val { font-weight: 700; }

  /* Footer */
  .footer { position: fixed; bottom: 0; left: 0; right: 0; padding: 8px 16mm; font-size: 9px; color: #9ca3af; display: flex; justify-content: space-between; border-top: 1px solid #e5e7eb; }

  /* Progress to target */
  .target-bar { height: 10px; background: #f3f4f6; border-radius: 5px; overflow: hidden; margin: 6px 0; }
  .target-fill { height: 100%; border-radius: 5px; }
</style>
</head><body>

<!-- ═══ HEADER ═══ -->
<div class="header">
  <div class="logo">
    <div class="logo-icon">VT</div>
    <div class="logo-text">
      <h1>HugoIT</h1>
      <p>Veterinary Practice Management</p>
    </div>
  </div>
  <div class="header-right">
    <h2>Analytics Report</h2>
    <p>${reportDate}</p>
    <p style="margin-top:4px;">Period: ${chartSubtitle}</p>
    <span class="badge" style="background:color-mix(in srgb, var(--brand-green-text) 8%, transparent); color:var(--brand-green-text); margin-top:4px;">CONFIDENTIAL</span>
  </div>
</div>

<!-- ═══ KPI SUMMARY ═══ -->
<div class="section">
  <div class="section-title">Key Performance Indicators</div>
  <div class="kpi-grid">
    <div class="kpi-card" style="border-left: 3px solid #4ADE80;">
      <div class="kpi-label">Revenue (YTD)</div>
      <div class="kpi-value" style="color:var(--brand-green-text);">$${revenueYtd.toLocaleString()}</div>
      <span class="kpi-trend ${revenueTrendUp ? 'up' : 'down'}">${revenueTrend}</span>
      <span class="kpi-sub"> vs last year</span>
    </div>
    <div class="kpi-card" style="border-left: 3px solid #F4A261;">
      <div class="kpi-label">Total Appointments</div>
      <div class="kpi-value">${totalAppts.toLocaleString()}</div>
      <span class="kpi-trend ${apptsTrendUp ? 'up' : 'down'}">${apptsTrend}</span>
      <span class="kpi-sub"> vs last year</span>
    </div>
    <div class="kpi-card" style="border-left: 3px solid #818CF8;">
      <div class="kpi-label">New Patients</div>
      <div class="kpi-value">${newPatients.toLocaleString()}</div>
      <span class="kpi-trend ${patientsTrendUp ? 'up' : 'down'}">${patientsTrend}</span>
      <span class="kpi-sub"> this year</span>
    </div>
    <div class="kpi-card" style="border-left: 3px solid #38BDF8;">
      <div class="kpi-label">Avg per Visit</div>
      <div class="kpi-value">$${avgPerVisit.toFixed(2)}</div>
      <span class="kpi-trend ${avgTrendUp ? 'up' : 'down'}">${avgTrend}</span>
      <span class="kpi-sub"> revenue/visit</span>
    </div>
  </div>
</div>

<!-- ═══ REVENUE & APPOINTMENTS ═══ -->
<div class="section">
  <div class="two-col">
    <div>
      <div class="section-title">Monthly Revenue</div>
      <div class="summary-box" style="margin-bottom:12px;">
        <div class="summary-row">
          <span class="summary-label">This Month</span>
          <span class="summary-val" style="color:var(--brand-green-text);">$${thisMonthRevenue.toLocaleString()}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Monthly Target</span>
          <span class="summary-val">$${revenueTarget.toLocaleString()}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Target Progress</span>
          <span class="summary-val" style="color:#16a34a;">${((thisMonthRevenue / revenueTarget) * 100).toFixed(0)}%</span>
        </div>
        <div class="target-bar">
          <div class="target-fill" style="width:${Math.min((thisMonthRevenue / revenueTarget) * 100, 100)}%; background: linear-gradient(90deg, #4ADE80, #22C55E);"></div>
        </div>
      </div>
      ${monthLabels.map((m, i) => `<div class="bar-row">
        <span class="bar-label">${m}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${revenueMax > 0 ? ((monthlyRevenue[i] || 0) / revenueMax * 100) : 0}%; background: linear-gradient(90deg, #4ADE80, #22C55E);"></div></div>
        <span class="bar-val">$${(monthlyRevenue[i] || 0).toLocaleString()}</span>
      </div>`).join('')}
    </div>

    <div>
      <div class="section-title">Monthly Appointments</div>
      <div class="summary-box" style="margin-bottom:12px;">
        <div class="summary-row">
          <span class="summary-label">This Month</span>
          <span class="summary-val" style="color:#C2671A;">${thisMonthAppts.toLocaleString()}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Daily Average</span>
          <span class="summary-val">~${dailyAvg}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Busiest Day</span>
          <span class="summary-val">${busiestDay.label} (${busiestDay.val})</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Quietest Day</span>
          <span class="summary-val">${quietestDay.label} (${quietestDay.val})</span>
        </div>
      </div>
      ${monthLabels.map((m, i) => `<div class="bar-row">
        <span class="bar-label">${m}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${apptsMax > 0 ? ((monthlyAppts[i] || 0) / apptsMax * 100) : 0}%; background: linear-gradient(90deg, #F4A261, #C2671A);"></div></div>
        <span class="bar-val">${(monthlyAppts[i] || 0).toLocaleString()}</span>
      </div>`).join('')}
    </div>
  </div>
</div>

<!-- ═══ PAGE 2 ═══ -->
<div class="page-break"></div>
<div class="header" style="margin-top:0;">
  <div class="logo">
    <div class="logo-icon">VT</div>
    <div class="logo-text">
      <h1>HugoIT</h1>
      <p>Analytics Report — continued</p>
    </div>
  </div>
  <div class="header-right">
    <p>${reportDate}</p>
  </div>
</div>

<!-- ═══ SERVICES & DAILY VOLUME ═══ -->
<div class="section">
  <div class="two-col">
    <div>
      <div class="section-title">Services Breakdown</div>
      ${services.map(s => `<div class="svc-row">
        <div class="svc-dot" style="background:${s.color};"></div>
        <span class="svc-name">${s.name}</span>
        <span class="svc-count">${s.count}</span>
        <div class="svc-bar-track"><div class="svc-bar-fill" style="width:${s.pct}%; background:${s.color}; opacity:0.75;"></div></div>
      </div>`).join('')}
    </div>

    <div>
      <div class="section-title">Daily Appointment Volume</div>
      <div class="summary-box" style="margin-bottom:12px;">
        <div class="summary-row">
          <span class="summary-label">Today</span>
          <span class="summary-val" style="color:#C2671A;">${todayAppts} appointments</span>
        </div>
      </div>
      ${dailyAppts.map(d => {
        const dMax = Math.max(...dailyAppts.map(x => x.val), 1);
        return `<div class="bar-row">
        <span class="bar-label" style="width:56px;${d.day === 'Today' ? 'font-weight:800;color:#C2671A;' : ''}">${d.day.length > 8 ? d.day.substring(0, 8) : d.day}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(d.val / dMax) * 100}%; background:${d.day === 'Today' ? '#C2671A' : '#F4A261'};${d.day === 'Today' ? '' : 'opacity:0.65;'}"></div></div>
        <span class="bar-val" style="width:30px;">${d.val}</span>
      </div>`;
      }).join('')}
    </div>
  </div>
</div>

<!-- ═══ PATIENT GROWTH ═══ -->
<div class="section">
  <div class="section-title">Patient Growth</div>
  <div class="summary-box" style="margin-bottom:12px;">
    <div class="summary-row">
      <span class="summary-label">Total Active Patients</span>
      <span class="summary-val" style="color:#818CF8;">${totalActivePatients.toLocaleString()}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">New This Year</span>
      <span class="summary-val">${newPatients.toLocaleString()}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Growth Trend</span>
      <span class="summary-val ${patientsTrendUp ? 'up' : 'down'}" style="color:${patientsTrendUp ? '#16a34a' : '#dc2626'}">${patientsTrend} vs last year</span>
    </div>
  </div>
  <table>
    <tr>
      <th>Month</th>
      <th class="text-right">Total Patients</th>
      <th class="text-right">MoM Change</th>
    </tr>
    ${monthLabels.map((m, i) => {
      const val = patientsData[i] || 0;
      const prev = i > 0 ? (patientsData[i - 1] || 0) : val;
      const diff = val - prev;
      return `<tr>
      <td class="fw700">${m}</td>
      <td class="text-right fw700">${val.toLocaleString()}</td>
      <td class="text-right" style="color:${diff >= 0 ? '#16a34a' : '#dc2626'};">${diff >= 0 ? '+' : ''}${diff}</td>
    </tr>`;
    }).join('')}
  </table>
</div>

<!-- ═══ PAGE 3 ═══ -->
<div class="page-break"></div>
<div class="header" style="margin-top:0;">
  <div class="logo">
    <div class="logo-icon">VT</div>
    <div class="logo-text">
      <h1>HugoIT</h1>
      <p>Analytics Report — continued</p>
    </div>
  </div>
  <div class="header-right">
    <p>${reportDate}</p>
  </div>
</div>

<!-- ═══ STAFF PERFORMANCE — DOCTORS ═══ -->
<div class="section">
  <div class="section-title">Staff Performance — Doctors</div>
  <table>
    <tr>
      <th>Doctor</th>
      <th class="text-center">Completed</th>
      <th class="text-right">Revenue</th>
      <th class="text-center">Patients</th>
    </tr>
    ${doctorPerf.length === 0 ? '<tr><td colspan="4" class="text-center" style="color:#9ca3af;padding:16px;">No doctors found</td></tr>' : doctorPerf.map(s => {
      const roleLabel = s.role === 'senior_veterinarian' ? 'Sr. Veterinarian' : s.role === 'specialist' ? 'Specialist' : 'Veterinarian';
      return `<tr>
      <td>
        <div class="staff-cell">
          <div class="avatar" style="background:linear-gradient(135deg,${s.color}dd,${s.color}88);">${s.initials}</div>
          <div><div class="staff-name">${s.name}</div><div class="staff-role">${roleLabel}</div></div>
        </div>
      </td>
      <td class="text-center fw700">${s.completed}</td>
      <td class="text-right fw700" style="color:${s.revenue === '$0' ? '#9ca3af' : '#16a34a'};">${s.revenue}</td>
      <td class="text-center fw700" style="color:#818CF8;">${s.pets}</td>
    </tr>`;
    }).join('')}
  </table>
</div>

<!-- ═══ STAFF PERFORMANCE — ADMIN ═══ -->
<div class="section">
  <div class="section-title">Staff Performance — Admin & Operations</div>
  <table>
    <tr>
      <th>Staff Member</th>
      <th class="text-center">Total Appts</th>
      <th class="text-center">Tasks Done</th>
    </tr>
    ${adminPerf.length === 0 ? '<tr><td colspan="3" class="text-center" style="color:#9ca3af;padding:16px;">No admin staff found</td></tr>' : adminPerf.map(s => {
      const roleMap: Record<string, string> = {
        clinic_manager: 'Manager', receptionist: 'Receptionist', front_desk_manager: 'FD Manager',
        vet_technician: 'Vet Tech', lead_vet_tech: 'Lead Tech', groomer: 'Groomer', lab_technician: 'Lab Tech',
      };
      return `<tr>
      <td>
        <div class="staff-cell">
          <div class="avatar" style="background:linear-gradient(135deg,${s.color}dd,${s.color}88);">${s.initials}</div>
          <div><div class="staff-name">${s.name}</div><div class="staff-role">${roleMap[s.role] || s.role}</div></div>
        </div>
      </td>
      <td class="text-center fw700">${s.booked}</td>
      <td class="text-center fw700" style="color:${s.tasksCompleted > 0 ? '#16a34a' : '#9ca3af'};">${s.tasksCompleted}</td>
    </tr>`;
    }).join('')}
  </table>
</div>

<!-- ═══ REPORT SUMMARY ═══ -->
<div class="section" style="margin-top:24px;">
  <div class="section-title">Executive Summary</div>
  <div class="summary-box">
    <div class="summary-row"><span class="summary-label">Report Period</span><span class="summary-val">${chartSubtitle}</span></div>
    <div class="summary-row"><span class="summary-label">Year-to-Date Revenue</span><span class="summary-val" style="color:var(--brand-green-text);">$${revenueYtd.toLocaleString()}</span></div>
    <div class="summary-row"><span class="summary-label">Monthly Revenue Target</span><span class="summary-val">$${revenueTarget.toLocaleString()}</span></div>
    <div class="summary-row"><span class="summary-label">Target Achievement</span><span class="summary-val" style="color:#16a34a;">${((thisMonthRevenue / revenueTarget) * 100).toFixed(0)}%</span></div>
    <div class="summary-row"><span class="summary-label">Total Appointments</span><span class="summary-val">${totalAppts.toLocaleString()}</span></div>
    <div class="summary-row"><span class="summary-label">Active Patients</span><span class="summary-val" style="color:#818CF8;">${totalActivePatients.toLocaleString()}</span></div>
    <div class="summary-row"><span class="summary-label">New Patients (YTD)</span><span class="summary-val">${newPatients.toLocaleString()}</span></div>
    <div class="summary-row"><span class="summary-label">Active Doctors</span><span class="summary-val">${doctorPerf.length}</span></div>
    <div class="summary-row"><span class="summary-label">Admin Staff</span><span class="summary-val">${adminPerf.length}</span></div>
    <div class="summary-row"><span class="summary-label">Top Service</span><span class="summary-val">${services.length > 0 ? services[0].name + ' (' + services[0].count + ')' : '—'}</span></div>
  </div>
</div>

<!-- ═══ FOOTER ═══ -->
<div class="footer">
  <span>HugoIT Analytics Report · Generated ${reportDate}</span>
  <span>Confidential — For internal use only</span>
</div>

</body></html>`;

    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.print(); }, 400);
  }

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="max-w-[1440px] mx-auto p-8">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Analytics</h1>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Clinic-wide performance overview · {currentMonth}</p>
          </div>
        </div>
        {/* Skeleton KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{
              backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)',
              borderRadius: '14px', padding: '20px 22px', height: '130px',
            }}>
              <div style={{ width: '60%', height: '12px', borderRadius: '6px', backgroundColor: 'var(--border-color)', marginBottom: '14px', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ width: '40%', height: '28px', borderRadius: '8px', backgroundColor: 'var(--border-color)', marginBottom: '10px', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ width: '50%', height: '10px', borderRadius: '5px', backgroundColor: 'var(--border-color)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
          ))}
        </div>
        {/* Skeleton chart row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} style={{
              backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)',
              borderRadius: '14px', height: '340px',
            }}>
              <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ width: '50%', height: '14px', borderRadius: '7px', backgroundColor: 'var(--border-color)', marginBottom: '6px', animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div style={{ width: '35%', height: '10px', borderRadius: '5px', backgroundColor: 'var(--border-color)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              </div>
            </div>
          ))}
        </div>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto p-8">

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Analytics
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Clinic-wide performance overview · {currentMonth}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Range picker */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setRangeOpen(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 14px', borderRadius: '9px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--surface-white)',
                color: 'var(--text-primary)',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Calendar style={{ width: '14px', height: '14px', color: 'var(--text-secondary)' }} />
              {range}
              <ChevronDown style={{ width: '13px', height: '13px', color: 'var(--text-secondary)' }} />
            </button>
            {rangeOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                backgroundColor: 'var(--surface-white)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px', overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                zIndex: 50, minWidth: '160px',
              }}>
                {RANGES.map(r => (
                  <button
                    key={r}
                    onClick={() => { setRange(r); setRangeOpen(false); }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '9px 14px', fontSize: '13px', fontWeight: r === range ? 700 : 500,
                      color: r === range ? '#C2671A' : 'var(--text-primary)',
                      backgroundColor: r === range ? '#F4A26110' : 'transparent',
                      border: 'none', cursor: 'pointer',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleExportPdf}
            style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '9px',
            backgroundColor: '#F4A261', color: '#fff',
            border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600,
          }}>
            <Download style={{ width: '14px', height: '14px' }} />
            Export
          </button>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <KpiCard label="Revenue (YTD)"     value={`$${revenueYtd.toLocaleString()}`} trend={revenueTrend}  trendUp={revenueTrendUp} sub="vs last year"    color="#4ADE80" icon={DollarSign} />
        <KpiCard label="Total Appointments" value={totalAppts.toLocaleString()}       trend={apptsTrend}    trendUp={apptsTrendUp}   sub="vs last year"    color="#F4A261" icon={Calendar}   />
        <KpiCard label="New Patients"       value={newPatients.toLocaleString()}       trend={patientsTrend} trendUp={patientsTrendUp} sub="this year"       color="#818CF8" icon={PawPrint}   />
        <KpiCard label="Avg per Visit"      value={`$${avgPerVisit.toFixed(2)}`}      trend={avgTrend}      trendUp={avgTrendUp}      sub="revenue/visit"   color="#38BDF8" icon={Users}      />
      </div>

      {/* ── Main charts — 2 columns ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

        {/* Revenue trend */}
        <ChartCard
          title="Monthly Revenue"
          subtitle={chartSubtitle}
          action={(() => {
            const prev = monthlyRevenue.length >= 2 ? monthlyRevenue[monthlyRevenue.length - 2] : 0;
            const curr = monthlyRevenue.length >= 1 ? monthlyRevenue[monthlyRevenue.length - 1] : 0;
            const pct = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
            const up = pct >= 0;
            const Ic = up ? TrendingUp : TrendingDown;
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: up ? '#4ADE80' : '#EF4444' }}>
                <Ic style={{ width: '14px', height: '14px' }} />
                {up ? '+' : ''}{pct.toFixed(0)}% MoM
              </div>
            );
          })()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: '2px' }}>
                This Month
              </p>
              <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>${thisMonthRevenue.toLocaleString()}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: '2px' }}>
                Target
              </p>
              {editingTarget ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '24px', fontWeight: 800, color: '#4ADE80' }}>$</span>
                  <input
                    autoFocus
                    type="text"
                    value={targetInput}
                    onChange={e => setTargetInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveRevenueTarget(); if (e.key === 'Escape') setEditingTarget(false); }}
                    style={{
                      width: '120px', fontSize: '22px', fontWeight: 800, color: '#4ADE80',
                      backgroundColor: 'var(--surface-elevated)', border: '1.5px solid #4ADE80',
                      borderRadius: '8px', padding: '2px 8px', outline: 'none', textAlign: 'right',
                    }}
                  />
                  <button onClick={saveRevenueTarget} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#4ADE80' }}>
                    <Check style={{ width: '16px', height: '16px' }} />
                  </button>
                  <button onClick={() => setEditingTarget(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-secondary)' }}>
                    <X style={{ width: '16px', height: '16px' }} />
                  </button>
                </div>
              ) : (
                <p
                  onClick={() => { setTargetInput(revenueTarget.toLocaleString()); setEditingTarget(true); }}
                  style={{ fontSize: '24px', fontWeight: 800, color: '#4ADE80', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}
                  title="Click to edit target"
                >
                  ${revenueTarget.toLocaleString()}
                  <Pencil style={{ width: '14px', height: '14px', opacity: 0.5 }} />
                </p>
              )}
            </div>
          </div>

          {/* Progress to target */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ height: '6px', borderRadius: '9999px', backgroundColor: 'var(--border-color)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '9999px',
                background: 'linear-gradient(90deg, #4ADE80, #22C55E)',
                width: `${Math.min((thisMonthRevenue / revenueTarget) * 100, 100)}%`,
                transition: 'width 0.6s',
              }} />
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {((thisMonthRevenue / revenueTarget) * 100).toFixed(0)}% of monthly target reached
            </p>
          </div>

          <LineChart data={monthlyRevenue} labels={monthLabels} color="#4ADE80" label="Revenue" prefix="$" />
        </ChartCard>

        {/* Appointment volume */}
        <ChartCard
          title="Monthly Appointments"
          subtitle={chartSubtitle}
          action={(() => {
            const prev = monthlyAppts.length >= 2 ? monthlyAppts[monthlyAppts.length - 2] : 0;
            const curr = monthlyAppts.length >= 1 ? monthlyAppts[monthlyAppts.length - 1] : 0;
            const pct = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
            const up = pct >= 0;
            const Ic = up ? TrendingUp : TrendingDown;
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: up ? '#F4A261' : '#EF4444' }}>
                <Ic style={{ width: '14px', height: '14px' }} />
                {up ? '+' : ''}{pct.toFixed(0)}% growth
              </div>
            );
          })()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: '2px' }}>
                This Month
              </p>
              <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>{thisMonthAppts.toLocaleString()}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: '2px' }}>
                Daily Avg
              </p>
              <p style={{ fontSize: '24px', fontWeight: 800, color: '#F4A261' }}>~{dailyAvg}</p>
            </div>
          </div>
          <div style={{ height: '6px', borderRadius: '9999px', backgroundColor: 'var(--border-color)', overflow: 'hidden', marginBottom: '4px' }}>
            <div style={{
              height: '100%', borderRadius: '9999px',
              background: 'linear-gradient(90deg, #F4A261, #C2671A)',
              width: `${apptProgressPct}%`,
              transition: 'width 0.6s',
            }} />
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            {prevMonthAppts > 0 ? `${apptProgressPct.toFixed(0)}% of last month (${prevMonthAppts})` : ''}
          </p>
          <LineChart data={monthlyAppts} labels={monthLabels} color="#F4A261" label="Appointments" />
        </ChartCard>
      </div>

      {/* ── Second row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

        {/* Daily appointments - bar chart */}
        <ChartCard
          title="Daily Appointment Volume"
          subtitle="Last 14 days"
          action={
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Today highlighted in dark</span>
          }
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            {[
              { label: 'Busiest Day', value: busiestDay.label, val: String(busiestDay.val), color: '#F4A261' },
              { label: 'Quietest Day', value: quietestDay.label, val: String(quietestDay.val), color: '#818CF8' },
              { label: 'Today', value: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), val: String(todayAppts), color: '#C2671A' },
            ].map(s => (
              <div key={s.label}>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                  {s.label}
                </p>
                <p style={{ fontSize: '20px', fontWeight: 800, color: s.color }}>{s.val}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{s.value}</p>
              </div>
            ))}
          </div>
          <BarChart data={dailyAppts} />
        </ChartCard>

        {/* Service breakdown */}
        <ChartCard
          title="Services Breakdown"
          subtitle={`${currentMonth} · by appointment count`}
          action={
            <button style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)',
              background: 'none', border: 'none', cursor: 'pointer',
            }}>
              View all <ChevronRight style={{ width: '13px', height: '13px' }} />
            </button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(showAllServices ? services : services.slice(0, 6)).map(s => (
              <div key={s.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: s.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{s.count}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', minWidth: '32px', textAlign: 'right' }}>{s.pct}%</span>
                  </div>
                </div>
                <div style={{ height: '5px', borderRadius: '9999px', backgroundColor: 'var(--border-color)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: '9999px',
                    backgroundColor: s.color, width: `${s.pct}%`,
                    opacity: 0.75,
                    transition: 'width 0.5s',
                  }} />
                </div>
              </div>
            ))}
            {services.length > 6 && (
              <button
                onClick={() => setShowAllServices(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  fontSize: '12px', fontWeight: 600, color: 'var(--brand-green-text)',
                  background: 'none', border: '1px solid var(--border-color)',
                  borderRadius: '8px', padding: '8px 0', cursor: 'pointer',
                  marginTop: '4px',
                }}
              >
                {showAllServices ? 'Show less' : `Load more (${services.length - 6})`}
                <ChevronRight style={{ width: '13px', height: '13px', transform: showAllServices ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 0.2s' }} />
              </button>
            )}
          </div>
        </ChartCard>
      </div>

      {/* ── Patient growth (full width) ── */}
      <div style={{ marginBottom: '20px' }}>
        <ChartCard
          title="Patient Growth"
          subtitle={`Active registered patients — ${chartSubtitle}`}
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Active</p>
                <p style={{ fontSize: '20px', fontWeight: 800, color: '#818CF8' }}>{totalActivePatients.toLocaleString()}</p>
              </div>
            </div>
          }
        >
          <LineChart data={patientsData} labels={monthLabels} color="#818CF8" label="Patients" viewBoxWidth={1000} viewBoxHeight={240} />
        </ChartCard>
      </div>

      {/* ── Staff Performance ── */}
      <div style={{
        backgroundColor: 'var(--surface-white)',
        border: '1px solid var(--border-color)',
        borderRadius: '14px', overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px 14px',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <div>
            <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>Staff Performance</p>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{currentMonth}</p>
          </div>
        </div>

        {/* ── Doctors Section ── */}
        <div style={{
          padding: '12px 22px 8px',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#4ADE80' }} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Doctors
          </span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)', marginLeft: 4 }} />
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
          padding: '8px 22px',
          borderBottom: '1px solid var(--border-color)',
        }}>
          {['Doctor', 'Completed', 'Revenue', 'Patients'].map(h => (
            <span key={h} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {h}
            </span>
          ))}
        </div>

        {doctorPerf.length === 0 && (
          <div style={{ padding: '20px 22px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            No doctors found
          </div>
        )}
        {doctorPerf.map((s, idx) => (
          <div
            key={s.name}
            style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
              padding: '14px 22px', alignItems: 'center',
              borderBottom: idx < doctorPerf.length - 1 ? '1px solid var(--border-color)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: `linear-gradient(135deg, ${s.color}dd, ${s.color}88)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {s.initials}
              </div>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {s.role === 'senior_veterinarian' ? 'Sr. Veterinarian' : s.role === 'specialist' ? 'Specialist' : 'Veterinarian'}
                </p>
              </div>
            </div>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{s.completed}</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: s.revenue === '$0' ? 'var(--text-secondary)' : '#4ADE80' }}>
              {s.revenue}
            </span>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#818CF8' }}>{s.pets}</span>
          </div>
        ))}

        {/* ── Admin & Operations Section ── */}
        <div style={{
          padding: '16px 22px 8px',
          display: 'flex', alignItems: 'center', gap: '8px',
          borderTop: '2px solid var(--border-color)',
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#F4A261' }} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Admin & Operations
          </span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)', marginLeft: 4 }} />
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 1fr 1fr',
          padding: '8px 22px',
          borderBottom: '1px solid var(--border-color)',
        }}>
          {['Staff Member', 'Total Appts', 'Tasks Done'].map(h => (
            <span key={h} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {h}
            </span>
          ))}
        </div>

        {adminPerf.length === 0 && (
          <div style={{ padding: '20px 22px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            No admin staff found
          </div>
        )}
        {adminPerf.map((s, idx) => {
          const roleLabel: Record<string, string> = {
            clinic_manager: 'Manager', receptionist: 'Receptionist', front_desk_manager: 'FD Manager',
            superadmin: 'Super Admin', vet_technician: 'Vet Tech', lead_vet_tech: 'Lead Tech',
            groomer: 'Groomer', lab_technician: 'Lab Tech',
          };
          return (
            <div
              key={s.name}
              style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr',
                padding: '14px 22px', alignItems: 'center',
                borderBottom: idx < adminPerf.length - 1 ? '1px solid var(--border-color)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: `linear-gradient(135deg, ${s.color}dd, ${s.color}88)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>
                  {s.initials}
                </div>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{roleLabel[s.role] || s.role}</p>
                </div>
              </div>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{s.booked}</span>
              <span style={{ fontSize: '15px', fontWeight: 700, color: s.tasksCompleted > 0 ? '#4ADE80' : 'var(--text-secondary)' }}>{s.tasksCompleted}</span>
            </div>
          );
        })}
      </div>

    </div>
  );
}
