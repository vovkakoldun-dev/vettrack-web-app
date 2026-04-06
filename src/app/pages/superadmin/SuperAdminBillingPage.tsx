import { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, CreditCard, AlertCircle,
  CheckCircle2, Clock, Download, ChevronDown, Search,
  ArrowUpRight, ArrowDownRight, Banknote, Percent, FileText, X, Receipt,
  Calendar, User, Hash,
} from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../../components/ui/select';
import { supabase } from '../../../lib/supabase';
import { getOrgContext } from '../../hooks/useOrgContext';
import { ConnectionStatusBadge } from '../../components/ConnectionStatusBadge';

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

// ─── Types & Style Config ─────────────────────────────────────

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
  // Detail fields for View modal
  subtotal: number; taxAmount: number; discountAmount: number;
  amountPaid: number; dueDate: string; paidAt: string | null;
  notes: string; invoiceUuid: string;
}

const SERVICE_COLORS = ['#818CF8', ACCENT, '#38BDF8', '#4ADE80', '#F472B6', '#94A3B8'];

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

  // Guard: empty data
  if (!data.length || !labels.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', color: 'var(--text-secondary)', fontSize: '14px' }}>
        No data available
      </div>
    );
  }

  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: PX + (i / Math.max(data.length - 1, 1)) * (W - PX * 2),
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
          <text key={i} x={PX + (i / Math.max(labels.length - 1, 1)) * (W - PX * 2)} y={H - 3}
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

  // Guard: empty data
  if (!data.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', color: 'var(--text-secondary)', fontSize: '14px' }}>
        No daily revenue data
      </div>
    );
  }

  const max = Math.max(...data.map(d => d.val)) || 1;
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

function DonutChart({ segments, totalLabel }: { segments: { name: string; amount: number; color: string; pct: number }[]; totalLabel?: string }) {
  const [hov, setHov] = useState<number | null>(null);
  const R = 80, cx = 120, cy = 100, stroke = 28;
  let cumPct = 0;
  const circumference = 2 * Math.PI * R;

  // Guard: empty data
  if (!segments.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '180px', color: 'var(--text-secondary)', fontSize: '14px' }}>
        No service data
      </div>
    );
  }

  const totalAmount = segments.reduce((s, seg) => s + seg.amount, 0);

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
            <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text-primary)" fontSize="16" fontWeight="800" fontFamily="system-ui">
              {totalLabel || `$${(totalAmount / 1000).toFixed(1)}k`}
            </text>
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
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

  // ─── State — initialised empty, populated from Supabase ───
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<number[]>([]);
  const [monthlyCashflow, setMonthlyCashflow] = useState<number[]>([]);
  const [monthLabels, setMonthLabels] = useState<string[]>([]);
  const [dailyRevenue, setDailyRevenue] = useState<{ day: string; val: number }[]>([]);
  const [serviceRevenue, setServiceRevenue] = useState<{ name: string; amount: number; color: string; pct: number }[]>([]);
  const [forecastData, setForecastData] = useState<number[]>([]);
  const [forecastLabels, setForecastLabels] = useState<string[]>([]);
  const [forecastNextMonth, setForecastNextMonth] = useState(0);
  const [forecastGrowth, setForecastGrowth] = useState('0');
  const [forecastQ2, setForecastQ2] = useState(0);

  const [totalRevenue, setTotalRevenue] = useState(0);
  const [revenueGrowth, setRevenueGrowth] = useState('0');
  const [netCashflow, setNetCashflow] = useState(0);
  const [cashflowGrowth, setCashflowGrowth] = useState('0');
  const [outstandingAmt, setOutstandingAmt] = useState(0);
  const [outstandingCount, setOutstandingCount] = useState(0);
  const [overdueCnt, setOverdueCnt] = useState(0);
  const [collectionRate, setCollectionRate] = useState(0);

  // ─── Load real data ───
  useEffect(() => {
    async function loadBillingData() {
      try {
        const { organizationId } = await getOrgContext();
        const now = new Date();
        const { labels, starts } = getLast12Months();

        // ── Fetch data in parallel ──
        const [invoicesRes, appointmentsRes] = await Promise.all([
          supabase
            .from('invoices')
            .select('id, invoice_number, subtotal, tax_amount, discount_amount, total, amount_paid, status, created_at, due_date, paid_at, notes, clients(id, first_name, last_name)')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false }),
          supabase
            .from('appointments')
            .select('reason, type, scheduled_at')
            .eq('organization_id', organizationId),
        ]);

        const rawInvoices = (invoicesRes.data || []).filter(
          (inv: any) => inv.status !== 'Draft'
        );
        const appointmentsData = appointmentsRes.data || [];

        // ── Map invoices to display format ──
        // Map 'Sent' to 'Pending' for display
        const mappedInvoices: Invoice[] = rawInvoices.map((inv: any) => {
          let displayStatus = inv.status;
          if (displayStatus === 'Sent') displayStatus = 'Pending';
          // Ensure status is valid
          if (!['Paid', 'Pending', 'Overdue', 'Partial'].includes(displayStatus)) {
            displayStatus = 'Pending';
          }
          return {
            id: inv.invoice_number || `INV-${inv.id.slice(0, 8)}`,
            invoiceUuid: inv.id,
            client: inv.clients
              ? `${inv.clients.first_name || ''} ${inv.clients.last_name || ''}`.trim()
              : 'Unknown',
            pet: '',
            service: inv.notes || '\u2014',
            date: new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            dateISO: inv.created_at.split('T')[0],
            amount: inv.total || 0,
            status: displayStatus as InvoiceStatus,
            subtotal: inv.subtotal || inv.total || 0,
            taxAmount: inv.tax_amount || 0,
            discountAmount: inv.discount_amount || 0,
            amountPaid: inv.amount_paid || 0,
            dueDate: inv.due_date || '',
            paidAt: inv.paid_at || null,
            notes: inv.notes || '',
          };
        });
        setInvoices(mappedInvoices);

        // ── KPI: Revenue (invoices with status Paid, Partial, Sent/Pending) ──
        const revenueInvoices = rawInvoices.filter((inv: any) =>
          ['Paid', 'Partial', 'Sent', 'Pending'].includes(inv.status)
        );

        // Monthly revenue for last 12 months
        const monthlyRev = starts.map((start, i) => {
          const end = i < starts.length - 1 ? starts[i + 1] : new Date(now.getFullYear(), now.getMonth() + 1, 1);
          return revenueInvoices
            .filter((inv: any) => {
              const d = new Date(inv.created_at);
              return d >= start && d < end;
            })
            .reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);
        });
        setMonthlyRevenue(monthlyRev);
        setMonthLabels(labels);

        // Cashflow estimate: revenue - 60% expenses
        const monthlyCf = monthlyRev.map(r => Math.round(r * 0.4));
        setMonthlyCashflow(monthlyCf);

        // Current month revenue
        const currentRev = monthlyRev[monthlyRev.length - 1] || 0;
        const prevRev = monthlyRev[monthlyRev.length - 2] || 0;
        setTotalRevenue(currentRev);

        if (prevRev > 0) {
          setRevenueGrowth(((currentRev - prevRev) / prevRev * 100).toFixed(1));
        }

        // Net cashflow KPI
        const currentCf = monthlyCf[monthlyCf.length - 1] || 0;
        const prevCf = monthlyCf[monthlyCf.length - 2] || 0;
        setNetCashflow(currentCf);
        if (prevCf > 0) {
          setCashflowGrowth(((currentCf - prevCf) / prevCf * 100).toFixed(1));
        }

        // Outstanding & overdue
        const outstandingInvs = mappedInvoices.filter(i => i.status === 'Pending' || i.status === 'Overdue');
        setOutstandingAmt(outstandingInvs.reduce((s, i) => s + i.amount, 0));
        setOutstandingCount(outstandingInvs.length);
        const overdueCount = mappedInvoices.filter(i => i.status === 'Overdue').length;
        setOverdueCnt(overdueCount);

        // Collection rate
        const paidCnt = mappedInvoices.filter(i => i.status === 'Paid').length;
        setCollectionRate(mappedInvoices.length > 0 ? Math.round((paidCnt / mappedInvoices.length) * 100) : 0);

        // ── Daily Revenue — last ~11 working days ──
        const dailyData: { day: string; val: number }[] = [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        for (let i = 10; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const nextDay = new Date(d);
          nextDay.setDate(nextDay.getDate() + 1);
          const dayLabel = dayNames[d.getDay()];
          const dayTotal = revenueInvoices
            .filter((inv: any) => {
              const invDate = new Date(inv.created_at);
              return invDate >= d && invDate < nextDay;
            })
            .reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);
          dailyData.push({ day: dayLabel, val: dayTotal });
        }
        setDailyRevenue(dailyData);

        // ── Service Revenue Breakdown (from appointments) ──
        const serviceCounts: Record<string, number> = {};
        appointmentsData.forEach((appt: any) => {
          const name = appt.type || appt.reason || 'Other';
          serviceCounts[name] = (serviceCounts[name] || 0) + 1;
        });

        const totalAppts = appointmentsData.length || 1;
        const serviceEntries = Object.entries(serviceCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6);

        // Estimate service revenue proportionally from total revenue
        const totalServiceRev = monthlyRev.reduce((s, v) => s + v, 0);
        const serviceSegs = serviceEntries.map(([name, count], i) => {
          const pct = Math.round((count / totalAppts) * 100);
          return {
            name,
            amount: Math.round((count / totalAppts) * totalServiceRev),
            color: SERVICE_COLORS[i % SERVICE_COLORS.length],
            pct,
          };
        });
        // Ensure percentages add to ~100
        const pctSum = serviceSegs.reduce((s, seg) => s + seg.pct, 0);
        if (serviceSegs.length > 0 && pctSum !== 100) {
          serviceSegs[0].pct += (100 - pctSum);
        }
        setServiceRevenue(serviceSegs);

        // ── Forecast — based on last 3 months ──
        const last3 = monthlyRev.slice(-3);
        const avgGrowthRate = last3.length >= 2
          ? last3.slice(1).reduce((sum, val, i) => {
              const prev = last3[i];
              return sum + (prev > 0 ? (val - prev) / prev : 0);
            }, 0) / (last3.length - 1)
          : 0;

        const lastRev = monthlyRev[monthlyRev.length - 1] || 0;
        const forecastM1 = Math.round(lastRev * (1 + avgGrowthRate));
        const forecastM2 = Math.round(forecastM1 * (1 + avgGrowthRate));

        const fLabels = labels.slice(-3);
        const nextMonth1 = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const nextMonth2 = new Date(now.getFullYear(), now.getMonth() + 2, 1);
        fLabels.push(`${nextMonth1.toLocaleDateString('en-US', { month: 'short' })} (est)`);
        fLabels.push(`${nextMonth2.toLocaleDateString('en-US', { month: 'short' })} (est)`);

        setForecastData([...last3, forecastM1, forecastM2]);
        setForecastLabels(fLabels);
        setForecastNextMonth(forecastM1);
        setForecastGrowth(lastRev > 0 ? ((forecastM1 - lastRev) / lastRev * 100).toFixed(1) : '0');

        // Q2 estimate (sum of next 3 months projected)
        const forecastM3 = Math.round(forecastM2 * (1 + avgGrowthRate));
        setForecastQ2(forecastM1 + forecastM2 + forecastM3);

      } catch (err) {
        console.error('Failed to load billing data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadBillingData();
  }, []);

  // ─── Derived values ───
  const filtered = invoices.filter(inv => {
    const q = invoiceSearch.toLowerCase();
    const matchSearch = !q || inv.client.toLowerCase().includes(q) || inv.id.toLowerCase().includes(q) || inv.service.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="max-w-[1440px] mx-auto p-8">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Billing & Cashflow
            </h1>
            <p style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>
              Loading financial overview...
            </p>
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
        {/* Skeleton chart areas */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' }}>
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
        <div style={{
          backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)',
          borderRadius: '14px', height: '300px',
        }}>
          <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ width: '30%', height: '14px', borderRadius: '7px', backgroundColor: 'var(--border-color)', marginBottom: '6px', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ width: '20%', height: '10px', borderRadius: '5px', backgroundColor: 'var(--border-color)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        </div>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
      </div>
    );
  }

  const currentMonthName = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const dailyAvg = dailyRevenue.length > 0
    ? Math.round(dailyRevenue.reduce((s, d) => s + d.val, 0) / dailyRevenue.length)
    : 0;

  return (
    <div className="max-w-[1440px] mx-auto p-8">

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Billing & Cashflow
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>
            Financial overview
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ConnectionStatusBadge />
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
          sub="revenue − est. expenses"
          color="#4ADE80"
          icon={Banknote}
        />
        <KpiCard
          label="Outstanding"
          value={`$${outstandingAmt.toLocaleString()}`}
          trend={`${overdueCnt} overdue`}
          trendUp={false}
          sub={`${outstandingCount} invoices`}
          color="#EF4444"
          icon={AlertCircle}
        />
        <KpiCard
          label="Collection Rate"
          value={`${collectionRate}%`}
          trend={collectionRate >= 70 ? 'Good' : 'Low'}
          trendUp={collectionRate >= 70}
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
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Monthly revenue vs estimated net cashflow</p>
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
            <LineChart data={monthlyRevenue}  labels={monthLabels} color={ACCENT}   viewBoxWidth={700} viewBoxHeight={210} />
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <LineChart data={monthlyCashflow} labels={monthLabels} color="#4ADE80" viewBoxWidth={700} viewBoxHeight={210} dashed />
            </div>
          </div>
        </Card>

        {/* Revenue breakdown donut */}
        <Card>
          <SectionTitle>Revenue by Service</SectionTitle>
          <DonutChart segments={serviceRevenue} />
        </Card>
      </div>

      {/* ── Daily Revenue Bar + Forecast ── */}
      <div className="grid grid-cols-3 gap-5 mb-7">
        <Card style={{ gridColumn: 'span 2' }}>
          <SectionTitle>
            Daily Revenue — {currentMonthName}
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Avg: ${dailyAvg.toLocaleString()}/day
            </span>
          </SectionTitle>
          <DailyBar data={dailyRevenue} />
        </Card>

        {/* Forecast card */}
        <Card>
          <SectionTitle>Revenue Forecast</SectionTitle>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '-10px', marginBottom: '16px' }}>
            Based on recent growth trajectory
          </p>
          <LineChart
            data={forecastData}
            labels={forecastLabels}
            color="#818CF8"
            viewBoxWidth={320}
            viewBoxHeight={160}
          />
          {/* Projected total */}
          <div style={{ marginTop: '16px', padding: '14px 16px', borderRadius: '10px', background: `linear-gradient(135deg, #818CF815, #818CF808)`, border: '1px solid #818CF830' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
              Next Month Forecast
            </p>
            <p style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              ${forecastNextMonth.toLocaleString()}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {parseFloat(forecastGrowth) >= 0 ? '+' : ''}{forecastGrowth}% projected growth
            </p>
          </div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Q2 Est.</p>
              <p style={{ fontSize: '18px', fontWeight: 800, color: ACCENT }}>${(forecastQ2 / 1000).toFixed(0)}k</p>
              <p style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>est. total</p>
            </div>
            <div style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Growth</p>
              <p style={{ fontSize: '18px', fontWeight: 800, color: parseFloat(forecastGrowth) >= 0 ? '#4ADE80' : '#EF4444' }}>
                {parseFloat(forecastGrowth) >= 0 ? '+' : ''}{forecastGrowth}%
              </p>
              <p style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>projected</p>
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
              {filtered.length} of {invoices.length} invoices
              {overdueCnt > 0 && <span style={{ marginLeft: '10px', color: '#DC2626', fontWeight: 600 }}>{'\u00B7'} {overdueCnt} overdue</span>}
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
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Overdue">Overdue</SelectItem>
                <SelectItem value="Partial">Partial</SelectItem>
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
            const items = invoices.filter(i => i.status === s);
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
                  {items.length} {'\u00B7'} ${total.toLocaleString()}
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
              key={inv.id + '-' + i}
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
                <button
                  onClick={() => setViewInvoice(inv)}
                  style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)' }}
                >
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
            Showing {filtered.length} of {invoices.length} invoices
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total:</span>
            <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
              ${filtered.reduce((s, i) => s + i.amount, 0).toLocaleString()}.00
            </span>
          </div>
        </div>
      </Card>

      {/* ─── Invoice Detail Modal ──────────────────────────── */}
      {viewInvoice && (() => {
        const inv = viewInvoice;
        const balance = inv.amount - inv.amountPaid;
        const statusCfg = STATUS_STYLE[inv.status];
        const StatusIcon = statusCfg.icon;
        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 300, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
            onClick={e => { if (e.target === e.currentTarget) setViewInvoice(null); }}
          >
            <div
              style={{ backgroundColor: 'var(--surface-white)', borderRadius: 16, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.2)', overflow: 'hidden', maxHeight: '92vh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Accent bar */}
              <div style={{ height: 4, background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_D})`, flexShrink: 0 }} />

              {/* Header */}
              <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${ACCENT}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Receipt style={{ width: 17, height: 17, color: ACCENT }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Invoice {inv.id}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>{inv.client}</p>
                  </div>
                </div>
                <button
                  onClick={() => setViewInvoice(null)}
                  style={{ width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer', backgroundColor: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}
                >
                  <X style={{ width: 14, height: 14 }} />
                </button>
              </div>

              {/* Status + Amount */}
              <div style={{ padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <StatusIcon style={{ width: 16, height: 16, color: statusCfg.text }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: statusCfg.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{inv.status}</span>
                </div>
                <span style={{ fontSize: 26, fontWeight: 800, color: ACCENT }}>${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              {/* Details grid */}
              <div style={{ padding: '0 22px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 3px' }}>Client</p>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <User style={{ width: 13, height: 13, color: 'var(--text-secondary)' }} /> {inv.client}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 3px' }}>Invoice #</p>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'monospace' }}>
                    <Hash style={{ width: 13, height: 13, color: 'var(--text-secondary)' }} /> {inv.id}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 3px' }}>Issued</p>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Calendar style={{ width: 13, height: 13, color: 'var(--text-secondary)' }} /> {inv.date}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 3px' }}>Due Date</p>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Calendar style={{ width: 13, height: 13, color: 'var(--text-secondary)' }} /> {inv.dueDate ? new Date(inv.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </p>
                </div>
              </div>

              {/* Breakdown */}
              <div style={{ padding: '0 22px 16px' }}>
                <div style={{ borderRadius: 10, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                  <div style={{ padding: '9px 14px', backgroundColor: 'var(--surface-elevated)' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Breakdown</span>
                  </div>
                  {inv.service && inv.service !== '—' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{inv.service}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>${inv.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderTop: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Subtotal</span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>${inv.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  {inv.taxAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderTop: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Tax</span>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>${inv.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {inv.discountAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderTop: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: 13, color: 'var(--brand-green-text)' }}>Discount</span>
                      <span style={{ fontSize: 13, color: 'var(--brand-green-text)' }}>−${inv.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Total</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  {inv.amountPaid > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderTop: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: 13, color: 'var(--brand-green-text)', fontWeight: 600 }}>Amount Paid</span>
                      <span style={{ fontSize: 13, color: 'var(--brand-green-text)', fontWeight: 600 }}>${inv.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {balance > 0 && inv.status !== 'Paid' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderTop: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: 13, color: '#DC2626', fontWeight: 600 }}>Balance Due</span>
                      <span style={{ fontSize: 13, color: '#DC2626', fontWeight: 600 }}>${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Paid at info */}
              {inv.paidAt && (
                <div style={{ padding: '0 22px 16px' }}>
                  <p style={{ fontSize: 12, color: 'var(--brand-green-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <CheckCircle2 style={{ width: 13, height: 13 }} />
                    Paid on {new Date(inv.paidAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              )}

              {/* Notes */}
              {inv.notes && (
                <div style={{ padding: '0 22px 16px' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>Notes</p>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>{inv.notes}</p>
                </div>
              )}

              {/* Close button */}
              <div style={{ padding: '10px 22px 18px' }}>
                <button
                  onClick={() => setViewInvoice(null)}
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

    </div>
  );
}
