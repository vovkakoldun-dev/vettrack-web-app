import { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, CreditCard, AlertCircle,
  CheckCircle2, Clock, Download, ChevronDown, Search,
  ArrowUpRight, ArrowDownRight, Banknote, Percent, FileText,
} from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../../components/ui/select';

// ─── Accent ───────────────────────────────────────────────────
const ACCENT   = '#F4A261';
const ACCENT_D = '#C2671A';

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

const REVENUE   = [28400, 31200, 29800, 33500, 35100, 36800, 38200, 40100, 42800, 45200, 47300, 48920];
const EXPENSES  = [18200, 19400, 18900, 20100, 21200, 21800, 22400, 23100, 24200, 25600, 26100, 26840];
const CASHFLOW  = REVENUE.map((r, i) => r - EXPENSES[i]);  // net
const FORECAST  = [...REVENUE.slice(-3), 51200, 53400];
const F_MONTHS  = ['Jan', 'Feb', 'Mar', 'Apr (est)', 'May (est)'];

const DAILY_REVENUE = [
  { day: 'Mon', val: 1820 }, { day: 'Tue', val: 1540 }, { day: 'Wed', val: 2100 },
  { day: 'Thu', val: 2480 }, { day: 'Fri', val: 2240 }, { day: 'Mon', val: 1680 },
  { day: 'Tue', val: 2020 }, { day: 'Wed', val: 1940 }, { day: 'Thu', val: 2560 },
  { day: 'Fri', val: 2340 }, { day: 'Sat', val: 1200 },
];

const SERVICE_REVENUE = [
  { name: 'Wellness Visits',    amount: 14820, color: '#818CF8', pct: 30 },
  { name: 'Surgery & Procedures', amount: 12340, color: ACCENT,   pct: 25 },
  { name: 'Vaccinations',       amount:  8960, color: '#38BDF8', pct: 18 },
  { name: 'Dental',             amount:  7410, color: '#4ADE80', pct: 15 },
  { name: 'Lab & Imaging',      amount:  4930, color: '#F472B6', pct: 10 },
  { name: 'Other',              amount:   460, color: '#94A3B8', pct:  1 },
] as const;

type InvoiceStatus = 'Paid' | 'Pending' | 'Overdue' | 'Partial';

const STATUS_STYLE: Record<InvoiceStatus, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  Paid:    { bg: '#22C55E15', text: '#16A34A',  icon: CheckCircle2 },
  Pending: { bg: '#F4A26118', text: '#D97706',  icon: Clock },
  Overdue: { bg: '#EF444415', text: '#DC2626',  icon: AlertCircle },
  Partial: { bg: '#3B82F615', text: '#2563EB',  icon: CreditCard },
};

interface Invoice {
  id: string; client: string; pet: string; service: string;
  date: string; dateISO: string; amount: number; status: InvoiceStatus;
}

const INVOICES: Invoice[] = [
  { id: 'INV-2026-042', client: 'John Smith',      pet: 'Max',     service: 'Annual Wellness',   date: 'Mar 14, 2026', dateISO: '2026-03-14', amount: 145,  status: 'Paid'    },
  { id: 'INV-2026-041', client: 'Emily Johnson',   pet: 'Luna',    service: 'Renal Check',        date: 'Mar 14, 2026', dateISO: '2026-03-14', amount: 210,  status: 'Pending' },
  { id: 'INV-2026-040', client: 'Michael Brown',   pet: 'Cooper',  service: 'TPLO Surgery',       date: 'Mar 10, 2026', dateISO: '2026-03-10', amount: 2480, status: 'Partial' },
  { id: 'INV-2026-039', client: 'Sarah Williams',  pet: 'Bella',   service: 'Dental Prophylaxis', date: 'Mar 8, 2026',  dateISO: '2026-03-08', amount: 380,  status: 'Paid'    },
  { id: 'INV-2026-038', client: 'James Wilson',    pet: 'Rocky',   service: 'GI Foreign Body',    date: 'Mar 3, 2026',  dateISO: '2026-03-03', amount: 1840, status: 'Paid'    },
  { id: 'INV-2026-037', client: 'Jessica Taylor',  pet: 'Milo',    service: 'Cardiac Workup',     date: 'Mar 7, 2026',  dateISO: '2026-03-07', amount: 560,  status: 'Overdue' },
  { id: 'INV-2026-036', client: 'Robert Anderson', pet: 'Daisy',   service: 'Ultrasound',         date: 'Feb 26, 2026', dateISO: '2026-02-26', amount: 290,  status: 'Paid'    },
  { id: 'INV-2026-035', client: 'David Miller',    pet: 'Charlie', service: 'Dermatology Consult',date: 'Mar 5, 2026',  dateISO: '2026-03-05', amount: 175,  status: 'Paid'    },
  { id: 'INV-2026-034', client: 'Karen Thomas',    pet: 'Buddy',   service: 'Vaccination Bundle', date: 'Feb 28, 2026', dateISO: '2026-02-28', amount: 95,   status: 'Pending' },
  { id: 'INV-2026-033', client: 'Lisa Martinez',   pet: 'Simba',   service: 'Weight Mgmt Plan',   date: 'Feb 20, 2026', dateISO: '2026-02-20', amount: 85,   status: 'Overdue' },
  { id: 'INV-2026-032', client: 'Amanda White',    pet: 'Coco',    service: 'Spay Procedure',     date: 'Feb 15, 2026', dateISO: '2026-02-15', amount: 420,  status: 'Paid'    },
  { id: 'INV-2026-031', client: 'Chris Davis',     pet: 'Zeus',    service: 'Ortho Consultation', date: 'Feb 12, 2026', dateISO: '2026-02-12', amount: 220,  status: 'Paid'    },
];

// ─── KPI Card ─────────────────────────────────────────────────

function KpiCard({ label, value, trend, trendUp, sub, color, icon: Icon }: {
  label: string; value: string; trend: string; trendUp: boolean;
  sub?: string; color: string; icon: React.ElementType;
}) {
  return (
    <div style={{
      backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)',
      borderRadius: '14px', padding: '20px 22px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </p>
        <div style={{ width: 34, height: 34, borderRadius: '9px', backgroundColor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: 16, height: 16, color }} />
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
          {trendUp
            ? <ArrowUpRight style={{ width: 10, height: 10 }} />
            : <ArrowDownRight style={{ width: 10, height: 10 }} />}
          {trend}
        </span>
        {sub && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{sub}</span>}
      </div>
    </div>
  );
}

// ─── Line Chart ───────────────────────────────────────────────

function LineChart({ data, labels, color, prefix = '$', dashed = false, viewBoxWidth = 700, viewBoxHeight = 200 }: {
  data: number[]; labels: string[]; color: string;
  prefix?: string; dashed?: boolean; viewBoxWidth?: number; viewBoxHeight?: number;
}) {
  const dark = useDarkMode();
  const [hovered, setHovered] = useState<number | null>(null);
  const W = viewBoxWidth, H = viewBoxHeight, PX = 56, PY = 20;

  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: PX + (i / (data.length - 1)) * (W - PX * 2),
    y: H - PY - ((v - min) / range) * (H - PY * 2),
  }));

  const linePath = spline(pts);
  const areaPath = linePath + ` L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`;
  const uid = `lc-${color.replace('#', '')}-${dashed ? 'd' : 's'}`;

  const gridColor  = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const labelColor = dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)';
  const tooltipBg  = dark ? '#1a2a3a' : '#ffffff';

  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setHovered(null)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible', cursor: 'crosshair' }}
        onMouseMove={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          const mx = ((e.clientX - rect.left) / rect.width) * W;
          let ni = 0, md = Infinity;
          pts.forEach((p, i) => { const d = Math.abs(p.x - mx); if (d < md) { md = d; ni = i; } });
          setHovered(ni);
        }}
      >
        <defs>
          <linearGradient id={`ag-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity={dark ? 0.22 : 0.12} />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0,1,2,3].map(i => {
          const y   = PY + (i / 3) * (H - PY * 2);
          const val = max - (i / 3) * range;
          return (
            <g key={i}>
              <line x1={PX} y1={y} x2={W - PX} y2={y} stroke={gridColor} strokeWidth="1" />
              <text x={PX - 6} y={y + 4} fill={labelColor} fontSize="11" textAnchor="end" fontFamily="system-ui">
                {prefix}{val >= 1000 ? `${(val / 1000).toFixed(val >= 10000 ? 0 : 1)}k` : Math.round(val)}
              </text>
            </g>
          );
        })}
        {labels.map((l, i) => (
          <text key={i} x={PX + (i / (labels.length - 1)) * (W - PX * 2)} y={H - 3}
            fill={labelColor} fontSize="11" textAnchor="middle" fontFamily="system-ui">{l}</text>
        ))}
        {!dashed && <path d={areaPath} fill={`url(#ag-${uid})`} />}
        <path d={linePath} fill="none" stroke={color} strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={dashed ? '6 4' : undefined} strokeOpacity={dashed ? 0.7 : 1} />
        {hovered !== null && (() => {
          const { x: hx, y: hy } = pts[hovered];
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
      {hovered !== null && (() => {
        const { x: hx, y: hy } = pts[hovered];
        return (
          <div style={{
            position: 'absolute',
            left: `${(hx / W) * 100}%`,
            bottom: `${(((H - hy) + 14) / H) * 100}%`,
            transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 10,
            backgroundColor: tooltipBg, border: `1px solid ${color}55`,
            borderRadius: '10px', padding: '7px 12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)', whiteSpace: 'nowrap',
          }}>
            <div style={{ fontSize: '10px', color: labelColor, fontWeight: 600, marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{labels[hovered]}</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color }}>
              {prefix}{data[hovered].toLocaleString()}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Bar Chart (daily revenue) ────────────────────────────────

function DailyBar({ data }: { data: { day: string; val: number }[] }) {
  const dark = useDarkMode();
  const [hov, setHov] = useState<number | null>(null);
  const W = 600, H = 160, PY = 20, PX = 10;
  const max = Math.max(...data.map(d => d.val));
  const bW = (W - PX * 2) / data.length;

  const labelColor = dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)';
  const tooltipBg  = dark ? '#1a2a3a' : '#ffffff';

  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setHov(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
        {data.map((d, i) => {
          const bH   = ((d.val / max) * (H - PY * 2 - 20));
          const x    = PX + i * bW + bW * 0.15;
          const bw   = bW * 0.7;
          const y    = H - PY - bH - 16;
          const isH  = hov === i;
          return (
            <g key={i} onMouseEnter={() => setHov(i)}>
              <rect x={x} y={y} width={bw} height={bH} rx="4"
                fill={isH ? ACCENT : `${ACCENT}55`}
                style={{ transition: 'fill 0.15s', cursor: 'default' }} />
              {isH && (
                <text x={x + bw / 2} y={y - 5} textAnchor="middle" fill={ACCENT} fontSize="12" fontWeight="700" fontFamily="system-ui">
                  ${(d.val / 1000).toFixed(1)}k
                </text>
              )}
              <text x={x + bw / 2} y={H - 3} textAnchor="middle" fill={labelColor} fontSize="9" fontFamily="system-ui">{d.day}</text>
            </g>
          );
        })}
      </svg>
      {hov !== null && (() => {
        const d  = data[hov];
        const bW2 = (W - PX * 2) / data.length;
        const cx = PX + hov * bW2 + bW2 / 2;
        const bH = ((d.val / max) * (H - PY * 2 - 20));
        const cy = H - PY - bH - 16;
        return (
          <div style={{
            position: 'absolute',
            left: `${(cx / W) * 100}%`,
            bottom: `${(((H - cy) + 10) / H) * 100}%`,
            transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 10,
            backgroundColor: tooltipBg, border: `1px solid ${ACCENT}55`,
            borderRadius: '8px', padding: '6px 10px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)', whiteSpace: 'nowrap',
          }}>
            <p style={{ fontSize: '11px', color: labelColor, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d.day}</p>
            <p style={{ fontSize: '16px', fontWeight: 800, color: ACCENT }}>${d.val.toLocaleString()}</p>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Donut Chart ──────────────────────────────────────────────

function DonutChart({ segments }: { segments: { name: string; amount: number; color: string; pct: number }[] }) {
  const [hov, setHov] = useState<number | null>(null);
  const R = 80, cx = 120, cy = 100, stroke = 28;
  let cumPct = 0;
  const circumference = 2 * Math.PI * R;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
      <svg width="240" height="200" style={{ flexShrink: 0 }}>
        {segments.map((seg, i) => {
          const dashOffset = circumference * (1 - seg.pct / 100);
          const rotation   = -90 + (cumPct / 100) * 360;
          cumPct += seg.pct;
          const isH = hov === i;
          return (
            <circle
              key={i}
              cx={cx} cy={cy} r={R}
              fill="none"
              stroke={seg.color}
              strokeWidth={isH ? stroke + 4 : stroke}
              strokeDasharray={`${(seg.pct / 100) * circumference} ${circumference}`}
              strokeDashoffset={0}
              transform={`rotate(${rotation} ${cx} ${cy})`}
              style={{ transition: 'stroke-width 0.15s', cursor: 'pointer' }}
              onMouseEnter={() => setHov(i)}
              onMouseLeave={() => setHov(null)}
            />
          );
        })}
        {/* Center label */}
        {hov !== null ? (
          <>
            <text x={cx} y={cy - 8} textAnchor="middle" fill="var(--text-primary)" fontSize="13" fontWeight="800" fontFamily="system-ui">
              ${(segments[hov].amount / 1000).toFixed(1)}k
            </text>
            <text x={cx} y={cy + 8} textAnchor="middle" fill="var(--text-secondary)" fontSize="10" fontFamily="system-ui">
              {segments[hov].pct}%
            </text>
            <text x={cx} y={cy + 24} textAnchor="middle" fill="var(--text-secondary)" fontSize="9" fontFamily="system-ui">
              {segments[hov].name}
            </text>
          </>
        ) : (
          <>
            <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text-primary)" fontSize="16" fontWeight="800" fontFamily="system-ui">$48.9k</text>
            <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--text-secondary)" fontSize="10" fontFamily="system-ui">Total Revenue</text>
          </>
        )}
      </svg>
      <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {segments.map((seg, i) => (
          <div
            key={i}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', opacity: hov === null || hov === i ? 1 : 0.45, transition: 'opacity 0.15s' }}
            onMouseEnter={() => setHov(i)}
            onMouseLeave={() => setHov(null)}
          >
            <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: seg.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-secondary)' }}>{seg.name}</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>${(seg.amount / 1000).toFixed(1)}k</span>
            <span style={{ fontSize: '11px', color: seg.color, fontWeight: 600, minWidth: '30px', textAlign: 'right' }}>{seg.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const s = STATUS_STYLE[status];
  const Icon = s.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 700,
      backgroundColor: s.bg, color: s.text,
    }}>
      <Icon style={{ width: 11, height: 11 }} />
      {status}
    </span>
  );
}

// ─── Section Card ─────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)',
      borderRadius: '14px', padding: '22px 24px', ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{children}</h2>
      {action}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function SuperAdminBillingPage() {
  const [period,        setPeriod]        = useState('last12');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [statusFilter,  setStatusFilter]  = useState<string>('all');

  const totalRevenue   = REVENUE[REVENUE.length - 1];
  const prevRevenue    = REVENUE[REVENUE.length - 2];
  const revenueGrowth  = (((totalRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1);

  const totalExpenses  = EXPENSES[EXPENSES.length - 1];
  const netCashflow    = totalRevenue - totalExpenses;
  const prevCashflow   = REVENUE[REVENUE.length - 2] - EXPENSES[EXPENSES.length - 2];
  const cashflowGrowth = (((netCashflow - prevCashflow) / prevCashflow) * 100).toFixed(1);

  const outstanding    = INVOICES.filter(i => i.status === 'Pending' || i.status === 'Overdue');
  const outstandingAmt = outstanding.reduce((s, i) => s + i.amount, 0);
  const overdueCnt     = INVOICES.filter(i => i.status === 'Overdue').length;
  const paidCnt        = INVOICES.filter(i => i.status === 'Paid').length;
  const collectionRate = Math.round((paidCnt / INVOICES.length) * 100);

  const filtered = INVOICES.filter(inv => {
    const q = invoiceSearch.toLowerCase();
    const matchSearch = !q || inv.client.toLowerCase().includes(q) || inv.id.toLowerCase().includes(q) || inv.service.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="max-w-[1440px] mx-auto p-8">

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Billing & Cashflow
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>
            Hugory Animal Hospital · financial overview
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger style={{ width: '170px' }}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="last12">Last 12 months</SelectItem>
              <SelectItem value="thisYear">This year</SelectItem>
              <SelectItem value="lastYear">Last year</SelectItem>
              <SelectItem value="q1">Q1 2026</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" style={{ gap: '6px' }}>
            <Download className="w-4 h-4" /> Export
          </Button>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-4 gap-5 mb-7">
        <KpiCard
          label="Monthly Revenue"
          value={`$${(totalRevenue / 1000).toFixed(1)}k`}
          trend={`${revenueGrowth}%`}
          trendUp={parseFloat(revenueGrowth) >= 0}
          sub="vs last month"
          color={ACCENT}
          icon={DollarSign}
        />
        <KpiCard
          label="Net Cashflow"
          value={`$${(netCashflow / 1000).toFixed(1)}k`}
          trend={`${cashflowGrowth}%`}
          trendUp={parseFloat(cashflowGrowth) >= 0}
          sub="revenue − expenses"
          color="#4ADE80"
          icon={Banknote}
        />
        <KpiCard
          label="Outstanding"
          value={`$${outstandingAmt.toLocaleString()}`}
          trend={`${overdueCnt} overdue`}
          trendUp={false}
          sub={`${outstanding.length} invoices`}
          color="#EF4444"
          icon={AlertCircle}
        />
        <KpiCard
          label="Collection Rate"
          value={`${collectionRate}%`}
          trend="+2% this month"
          trendUp={true}
          sub="paid on time"
          color="#818CF8"
          icon={Percent}
        />
      </div>

      {/* ── Revenue + Cashflow Charts ── */}
      <div className="grid grid-cols-3 gap-5 mb-7">
        <Card style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Revenue & Cashflow</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Monthly revenue vs net cashflow</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: 10, height: 3, borderRadius: '9999px', backgroundColor: ACCENT }} />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Revenue</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: 10, height: 3, borderRadius: '9999px', backgroundColor: '#4ADE80' }} />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Net cashflow</span>
              </div>
            </div>
          </div>
          {/* Two overlapping line charts */}
          <div style={{ position: 'relative' }}>
            <LineChart data={REVENUE}   labels={MONTHS} color={ACCENT}   viewBoxWidth={700} viewBoxHeight={210} />
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <LineChart data={CASHFLOW} labels={MONTHS} color="#4ADE80" viewBoxWidth={700} viewBoxHeight={210} dashed />
            </div>
          </div>
        </Card>

        {/* Revenue breakdown donut */}
        <Card>
          <SectionTitle>Revenue by Service</SectionTitle>
          <DonutChart segments={SERVICE_REVENUE as unknown as { name: string; amount: number; color: string; pct: number }[]} />
        </Card>
      </div>

      {/* ── Daily Revenue Bar + Forecast ── */}
      <div className="grid grid-cols-3 gap-5 mb-7">
        <Card style={{ gridColumn: 'span 2' }}>
          <SectionTitle>
            Daily Revenue — March 2026
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Avg: ${Math.round(DAILY_REVENUE.reduce((s,d) => s + d.val, 0) / DAILY_REVENUE.length).toLocaleString()}/day
            </span>
          </SectionTitle>
          <DailyBar data={DAILY_REVENUE} />
        </Card>

        {/* Forecast card */}
        <Card>
          <SectionTitle>Revenue Forecast</SectionTitle>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '-10px', marginBottom: '16px' }}>
            Based on current growth trajectory
          </p>
          <LineChart
            data={FORECAST}
            labels={F_MONTHS}
            color="#818CF8"
            viewBoxWidth={320}
            viewBoxHeight={160}
          />
          {/* Projected total */}
          <div style={{ marginTop: '16px', padding: '14px 16px', borderRadius: '10px', background: `linear-gradient(135deg, #818CF815, #818CF808)`, border: '1px solid #818CF830' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Apr 2026 Forecast</p>
            <p style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>$51,200</p>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>+4.7% projected growth</p>
          </div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Q2 2026</p>
              <p style={{ fontSize: '18px', fontWeight: 800, color: ACCENT }}>$159k</p>
              <p style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>est. total</p>
            </div>
            <div style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>YoY Growth</p>
              <p style={{ fontSize: '18px', fontWeight: 800, color: '#4ADE80' }}>+18%</p>
              <p style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>vs 2025</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Invoices Table ── */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Invoices</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {filtered.length} of {INVOICES.length} invoices
              {overdueCnt > 0 && <span style={{ marginLeft: '10px', color: '#DC2626', fontWeight: 600 }}>· {overdueCnt} overdue</span>}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-secondary)' }} />
              <Input
                placeholder="Search invoices..."
                value={invoiceSearch}
                onChange={e => setInvoiceSearch(e.target.value)}
                style={{ paddingLeft: '32px', width: '220px' }}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger style={{ width: '150px' }}><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Paid">✅ Paid</SelectItem>
                <SelectItem value="Pending">⏳ Pending</SelectItem>
                <SelectItem value="Overdue">🔴 Overdue</SelectItem>
                <SelectItem value="Partial">🔵 Partial</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" style={{ gap: '6px' }}>
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Summary strip */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {(['Paid', 'Pending', 'Overdue', 'Partial'] as InvoiceStatus[]).map(s => {
            const items = INVOICES.filter(i => i.status === s);
            const total = items.reduce((acc, i) => acc + i.amount, 0);
            const cfg   = STATUS_STYLE[s];
            const Icon  = cfg.icon;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px',
                  borderRadius: '9px', border: `1px solid ${statusFilter === s ? cfg.text : 'var(--border-color)'}`,
                  backgroundColor: statusFilter === s ? cfg.bg : 'var(--surface-elevated)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <Icon style={{ width: 13, height: 13, color: cfg.text }} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: cfg.text }}>{s}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {items.length} · ${total.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr 1fr 110px 90px 100px', gap: '0', padding: '10px 16px', backgroundColor: 'var(--surface-elevated)', borderBottom: '1px solid var(--border-color)' }}>
            {['Invoice', 'Client', 'Service', 'Date', 'Amount', 'Status', ''].map(h => (
              <span key={h} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
            ))}
          </div>
          {filtered.map((inv, i) => (
            <div
              key={inv.id}
              style={{
                display: 'grid', gridTemplateColumns: '140px 1fr 1fr 1fr 110px 90px 100px',
                gap: '0', padding: '13px 16px', alignItems: 'center',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--border-color)' : undefined,
                backgroundColor: inv.status === 'Overdue' ? '#EF444406' : undefined,
              }}
              className="hover:bg-[var(--surface-elevated)] transition-colors"
            >
              <span style={{ fontSize: '13px', fontWeight: 600, color: ACCENT_D, fontFamily: 'monospace' }}>{inv.id}</span>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{inv.client}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{inv.pet}</p>
              </div>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{inv.service}</span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{inv.date}</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>${inv.amount.toLocaleString()}.00</span>
              <StatusBadge status={inv.status} />
              <div style={{ display: 'flex', gap: '6px' }}>
                <button style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  View
                </button>
                {inv.status === 'Overdue' && (
                  <button style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid #EF444430`, backgroundColor: '#EF444410', cursor: 'pointer', fontSize: '12px', color: '#DC2626', fontWeight: 600 }}>
                    Remind
                  </button>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
              No invoices match your filters.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Showing {filtered.length} of {INVOICES.length} invoices
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total:</span>
            <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
              ${filtered.reduce((s, i) => s + i.amount, 0).toLocaleString()}.00
            </span>
          </div>
        </div>
      </Card>

    </div>
  );
}
