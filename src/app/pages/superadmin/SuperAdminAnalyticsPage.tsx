import { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Calendar, Users, PawPrint,
  Download, ChevronDown, ChevronRight,
} from 'lucide-react';

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

// ─── Data ─────────────────────────────────────────────────────

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

const REVENUE_DATA = [28400, 31200, 29800, 33500, 35100, 36800, 38200, 40100, 42800, 45200, 47300, 48920];
const APPT_DATA    = [312,   334,   318,   356,   371,   389,   402,   421,   445,   468,   491,   510];
const PATIENTS_DATA= [1080,  1110,  1140,  1175,  1210,  1240,  1265,  1284,  1295,  1308,  1272,  1284];

const DAILY_APPTS = [
  { day: 'Mon 3/3',  val: 32 },
  { day: 'Tue 3/4',  val: 28 },
  { day: 'Wed 3/5',  val: 35 },
  { day: 'Thu 3/6',  val: 41 },
  { day: 'Fri 3/7',  val: 38 },
  { day: 'Mon 3/10', val: 29 },
  { day: 'Tue 3/11', val: 36 },
  { day: 'Wed 3/12', val: 33 },
  { day: 'Thu 3/13', val: 42 },
  { day: 'Fri 3/14', val: 38 },
  { day: 'Today',    val: 38 },
];

const SERVICES = [
  { name: 'Annual Checkup',  count: 124, color: '#818CF8', pct: 82 },
  { name: 'Vaccination',     count: 98,  color: '#38BDF8', pct: 65 },
  { name: 'Dental Cleaning', count: 67,  color: '#4ADE80', pct: 44 },
  { name: 'Follow-up',       count: 54,  color: '#F4A261', pct: 36 },
  { name: 'Surgery',         count: 31,  color: '#F472B6', pct: 21 },
  { name: 'Lab / X-Ray',     count: 28,  color: '#A78BFA', pct: 19 },
  { name: 'Emergency',       count: 18,  color: '#EF4444', pct: 12 },
];

const STAFF_PERF = [
  { name: 'Dr. Sarah Chen',  role: 'Veterinarian', appts: 148, revenue: '$18,420', rating: 4.9, initials: 'SC', color: '#818CF8' },
  { name: 'Dr. Raj Patel',   role: 'Veterinarian', appts: 132, revenue: '$16,890', rating: 4.8, initials: 'RP', color: '#38BDF8' },
  { name: 'Dr. Luis Garcia', role: 'Veterinarian', appts: 89,  revenue: '$11,340', rating: 4.7, initials: 'LG', color: '#F4A261' },
  { name: 'Emma Thompson',   role: 'Front Desk',   appts: 231, revenue: '—',       rating: 4.8, initials: 'ET', color: '#4ADE80' },
  { name: 'James Wilson',    role: 'Front Desk',   appts: 208, revenue: '—',       rating: 4.6, initials: 'JW', color: '#F472B6' },
];

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
  const max = Math.max(...data.map(d => d.val));
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

  return (
    <div className="max-w-[1440px] mx-auto p-8">

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Analytics
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Clinic-wide performance overview · March 2026
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

          <button style={{
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
        <KpiCard label="Revenue (YTD)"     value="$438,420" trend="+14%"  trendUp sub="vs last year"    color="#4ADE80" icon={DollarSign} />
        <KpiCard label="Total Appointments" value="4,810"   trend="+8.3%" trendUp sub="vs last year"    color="#F4A261" icon={Calendar}   />
        <KpiCard label="New Patients"       value="342"     trend="+22%"  trendUp sub="this year"       color="#818CF8" icon={PawPrint}   />
        <KpiCard label="Avg per Visit"      value="$91.15"  trend="+5.2%" trendUp sub="revenue/visit"   color="#38BDF8" icon={Users}      />
      </div>

      {/* ── Main charts — 2 columns ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

        {/* Revenue trend */}
        <ChartCard
          title="Monthly Revenue"
          subtitle="Apr 2025 – Mar 2026"
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#4ADE80' }}>
              <TrendingUp style={{ width: '14px', height: '14px' }} />
              +8% MoM
            </div>
          }
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: '2px' }}>
                This Month
              </p>
              <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>$48,920</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: '2px' }}>
                Target
              </p>
              <p style={{ fontSize: '24px', fontWeight: 800, color: '#4ADE80' }}>$60,000</p>
            </div>
          </div>

          {/* Progress to target */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ height: '6px', borderRadius: '9999px', backgroundColor: 'var(--border-color)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '9999px',
                background: 'linear-gradient(90deg, #4ADE80, #22C55E)',
                width: `${(48920 / 60000) * 100}%`,
                transition: 'width 0.6s',
              }} />
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {((48920 / 60000) * 100).toFixed(0)}% of monthly target reached
            </p>
          </div>

          <LineChart data={REVENUE_DATA} labels={MONTHS} color="#4ADE80" label="Revenue" prefix="$" />
        </ChartCard>

        {/* Appointment volume */}
        <ChartCard
          title="Monthly Appointments"
          subtitle="Apr 2025 – Mar 2026"
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#F4A261' }}>
              <TrendingUp style={{ width: '14px', height: '14px' }} />
              +63% growth
            </div>
          }
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: '2px' }}>
                This Month
              </p>
              <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>510</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: '2px' }}>
                Daily Avg
              </p>
              <p style={{ fontSize: '24px', fontWeight: 800, color: '#F4A261' }}>~23</p>
            </div>
          </div>
          <div style={{ height: '6px', borderRadius: '9999px', backgroundColor: 'var(--border-color)', overflow: 'hidden', marginBottom: '16px' }}>
            <div style={{ height: '100%', borderRadius: '9999px', background: 'linear-gradient(90deg, #F4A261, #C2671A)', width: '85%' }} />
          </div>
          <LineChart data={APPT_DATA} labels={MONTHS} color="#F4A261" label="Appointments" />
        </ChartCard>
      </div>

      {/* ── Second row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

        {/* Daily appointments - bar chart */}
        <ChartCard
          title="Daily Appointment Volume"
          subtitle="Last 11 working days"
          action={
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Today highlighted in dark</span>
          }
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            {[
              { label: 'Busiest Day', value: 'Thu 3/13', val: '42', color: '#F4A261' },
              { label: 'Quietest Day', value: 'Tue 3/4', val: '28', color: '#818CF8' },
              { label: 'Today', value: 'Mar 15', val: '38', color: '#C2671A' },
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
          <BarChart data={DAILY_APPTS} />
        </ChartCard>

        {/* Service breakdown */}
        <ChartCard
          title="Services Breakdown"
          subtitle="March 2026 · by appointment count"
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
            {SERVICES.map(s => (
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
          </div>
        </ChartCard>
      </div>

      {/* ── Patient growth (full width) ── */}
      <div style={{ marginBottom: '20px' }}>
        <ChartCard
          title="Patient Growth"
          subtitle="Active registered patients — Apr 2025 to Mar 2026"
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Active</p>
                <p style={{ fontSize: '20px', fontWeight: 800, color: '#818CF8' }}>1,284</p>
              </div>
            </div>
          }
        >
          <LineChart data={PATIENTS_DATA} labels={MONTHS} color="#818CF8" label="Patients" viewBoxWidth={1000} viewBoxHeight={240} />
        </ChartCard>
      </div>

      {/* ── Staff performance table ── */}
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
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>March 2026 · appointments, revenue & satisfaction</p>
          </div>
          <button style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)',
            background: 'none', border: 'none', cursor: 'pointer',
          }}>
            View all <ChevronRight style={{ width: '13px', height: '13px' }} />
          </button>
        </div>

        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
          padding: '10px 22px',
          backgroundColor: 'var(--surface-elevated)',
          borderBottom: '1px solid var(--border-color)',
        }}>
          {['Staff Member', 'Appointments', 'Revenue', 'Rating', 'Utilisation'].map(h => (
            <span key={h} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {h}
            </span>
          ))}
        </div>

        {STAFF_PERF.map((s, idx) => (
          <div
            key={s.name}
            style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
              padding: '14px 22px', alignItems: 'center',
              borderBottom: idx < STAFF_PERF.length - 1 ? '1px solid var(--border-color)' : 'none',
            }}
          >
            {/* Name */}
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
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{s.role}</p>
              </div>
            </div>

            {/* Appointments */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{s.appts}</span>
            </div>

            {/* Revenue */}
            <span style={{ fontSize: '14px', fontWeight: 600, color: s.revenue === '—' ? 'var(--text-secondary)' : '#4ADE80' }}>
              {s.revenue}
            </span>

            {/* Rating */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '16px' }}>⭐</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{s.rating}</span>
            </div>

            {/* Utilisation bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{Math.round((s.appts / 160) * 100)}%</span>
              </div>
              <div style={{ height: '5px', borderRadius: '9999px', backgroundColor: 'var(--border-color)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '9999px',
                  backgroundColor: s.color,
                  width: `${Math.min((s.appts / 160) * 100, 100)}%`,
                  opacity: 0.75,
                }} />
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
