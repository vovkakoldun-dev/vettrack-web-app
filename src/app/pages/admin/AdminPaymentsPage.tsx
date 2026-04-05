import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, Clock, AlertCircle, CheckCircle2,
  Search, Download, Eye, Bell, FileText,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { supabase } from '../../../lib/supabase';
import { getOrgContext } from '../../hooks/useOrgContext';

// ─── Types ────────────────────────────────────────────────────

type InvoiceStatus = 'Paid' | 'Pending' | 'Overdue' | 'Partial';

interface Invoice {
  id: string;
  supaId: string;
  client: string;
  clientId: string;
  pet: string;
  service: string;
  date: string;
  amount: string;
  status: InvoiceStatus;
}

interface InvoiceDetail {
  invoiceNumber: string;
  client: string;
  pet: string;
  service: string;
  date: string;
  dueDate: string;
  status: InvoiceStatus;
  total: number;
  lineItems: { description: string; quantity: number; unitPrice: number }[];
  payments: { amount: number; method: string; paidAt: string }[];
  notes: string;
}

// ─── (data loaded from Supabase) ──────────────────────────────

// ─── Status Badge ─────────────────────────────────────────────

const STATUS_STYLES: Record<InvoiceStatus, { bg: string; color: string }> = {
  Paid:    { bg: 'rgba(34,197,94,0.12)', color: '#16a34a' },
  Pending: { bg: '#F4A26115', color: '#D97706' },
  Overdue: { bg: '#d4183d15', color: '#d4183d' },
  Partial: { bg: '#3B82F615', color: '#3B82F6' },
};

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: '9999px',
      fontSize: '12px', fontWeight: 600,
      backgroundColor: s.bg, color: s.color,
      whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────

function StatCard({
  title, value, subtitle, icon: Icon, color, bg,
}: {
  title: string; value: string; subtitle: string;
  icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <div
      className="bg-[var(--surface-white)] border border-[var(--border-color)]"
      style={{ borderRadius: '12px', padding: '20px 24px' }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
        <p className="text-[var(--text-secondary)]" style={{ fontSize: '13px', fontWeight: 600 }}>
          {title}
        </p>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px',
          backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon style={{ width: '18px', height: '18px', color }} />
        </div>
      </div>
      <p style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px', lineHeight: 1, marginBottom: '4px' }}>
        {value}
      </p>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{subtitle}</p>
    </div>
  );
}

// Activity feed + stats are now fetched from Supabase

function formatRelTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} hr${diffH > 1 ? 's' : ''} ago`;
  if (diffH < 48) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface ActivityItem {
  id: string; label: string; text: string; time: string;
  icon: React.ElementType; color: string; bg: string;
}

interface PaymentStats {
  totalRevenue: number;
  pendingAmount: number;
  pendingCount: number;
  overdueAmount: number;
  overdueCount: number;
  collectedToday: number;
  collectedTodayCount: number;
}

interface MethodBreakdown {
  label: string; pct: number; color: string; amount: string;
}

// ─── Page ─────────────────────────────────────────────────────

export default function AdminPaymentsPage() {
  const [search, setSearch]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]   = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<PaymentStats>({ totalRevenue: 0, pendingAmount: 0, pendingCount: 0, overdueAmount: 0, overdueCount: 0, collectedToday: 0, collectedTodayCount: 0 });
  const [methods, setMethods] = useState<MethodBreakdown[]>([]);
  const [totalProcessed, setTotalProcessed] = useState(0);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const loadData = useCallback(async () => {
    const { organizationId } = await getOrgContext();
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    const monthStart = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-01`;

    // ── Invoices list ──
    const { data: invData } = await supabase
      .from('invoices')
      .select('id, invoice_number, total, status, created_at, notes, clients(id, first_name, last_name), appointments(id, reason, pets(id, name))')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    if (invData) {
      const mapped: Invoice[] = invData.map((inv: any) => ({
        id: inv.invoice_number || `INV-${inv.id?.substring(0, 8)}`,
        supaId: inv.id,
        client: inv.clients ? `${inv.clients.first_name} ${inv.clients.last_name}` : '—',
        clientId: inv.clients?.id || '',
        pet: inv.appointments?.pets?.name ?? '—',
        service: inv.appointments?.reason ?? inv.notes ?? '—',
        date: new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        amount: `$${inv.total?.toFixed(2) ?? '0.00'}`,
        status: (inv.status || 'Pending') as InvoiceStatus,
      }));
      setInvoices(mapped);

      // ── Stat cards from invoices ──
      let pendingAmt = 0, pendingCt = 0, overdueAmt = 0, overdueCt = 0;
      for (const inv of invData as any[]) {
        if (inv.status === 'Pending' || inv.status === 'Sent') { pendingAmt += Number(inv.total || 0); pendingCt++; }
        if (inv.status === 'Overdue') { overdueAmt += Number(inv.total || 0); overdueCt++; }
      }
      setStats(prev => ({ ...prev, pendingAmount: pendingAmt, pendingCount: pendingCt, overdueAmount: overdueAmt, overdueCount: overdueCt }));
    }

    // ── Payments (for revenue, collected today, methods, activity) ──
    const { data: payData } = await supabase
      .from('payments')
      .select('id, amount, method, paid_at, invoices!inner(id, invoice_number, client_id, clients!inner(first_name, last_name))')
      .order('paid_at', { ascending: false });
    if (payData) {
      // Revenue this month
      const monthPayments = (payData as any[]).filter(p => p.paid_at >= `${monthStart}T00:00:00`);
      const totalRev = monthPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

      // Collected today
      const todayPayments = (payData as any[]).filter(p => p.paid_at >= `${todayStr}T00:00:00`);
      const collectedToday = todayPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

      setStats(prev => ({
        ...prev,
        totalRevenue: totalRev,
        collectedToday,
        collectedTodayCount: todayPayments.length,
      }));

      // ── Payment methods breakdown ──
      const methodMap = new Map<string, number>();
      for (const p of monthPayments as any[]) {
        const m = p.method || 'Other';
        methodMap.set(m, (methodMap.get(m) || 0) + Number(p.amount || 0));
      }
      const total = totalRev || 1;
      const methodColors: Record<string, string> = {
        'Credit Card': '#3B82F6', 'Debit Card': '#3B82F6', 'Cash': '#2D6A4F',
        'Check': '#8B5CF6', 'Insurance': '#F4A261', 'Financing': '#06B6D4', 'Other': '#6B7280',
      };
      const breakdowns: MethodBreakdown[] = Array.from(methodMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([label, amt]) => ({
          label, pct: Math.round((amt / total) * 100),
          color: methodColors[label] || '#6B7280',
          amount: `$${amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        }));
      setMethods(breakdowns);
      setTotalProcessed(totalRev);

      // ── Recent activity from payments + invoices ──
      const acts: ActivityItem[] = [];
      for (const p of (payData as any[]).slice(0, 5)) {
        const client = p.invoices?.clients;
        const clientName = client ? `${client.first_name} ${client.last_name}` : 'Unknown';
        const dt = new Date(p.paid_at);
        acts.push({
          id: p.id, label: 'Payment',
          text: `Payment of $${Number(p.amount).toFixed(2)} received from ${clientName}`,
          time: formatRelTime(dt),
          icon: CheckCircle2, color: '#16a34a', bg: 'rgba(34,197,94,0.12)',
        });
      }

      // Add overdue invoices as activity items
      if (invData) {
        for (const inv of (invData as any[]).filter((i: any) => i.status === 'Overdue').slice(0, 2)) {
          const clientName = inv.clients ? `${inv.clients.first_name} ${inv.clients.last_name}` : 'Unknown';
          acts.push({
            id: `overdue-${inv.id}`, label: 'Overdue',
            text: `Invoice #${inv.invoice_number || inv.id?.substring(0, 8)} is now overdue — ${clientName}`,
            time: formatRelTime(new Date(inv.created_at)),
            icon: AlertCircle, color: '#d4183d', bg: '#d4183d15',
          });
        }
        // Add recent invoices created
        for (const inv of (invData as any[]).filter((i: any) => i.status === 'Sent' || i.status === 'Pending').slice(0, 2)) {
          const clientName = inv.clients ? `${inv.clients.first_name} ${inv.clients.last_name}` : 'Unknown';
          acts.push({
            id: `inv-${inv.id}`, label: 'Invoice',
            text: `Invoice #${inv.invoice_number || inv.id?.substring(0, 8)} sent to ${clientName}`,
            time: formatRelTime(new Date(inv.created_at)),
            icon: FileText, color: '#3B82F6', bg: '#3B82F615',
          });
        }
      }
      setActivity(acts.slice(0, 6));
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── View Invoice Dialog ────────────────────────────────────
  const [viewOpen, setViewOpen] = useState(false);
  const [viewDetail, setViewDetail] = useState<InvoiceDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const openViewDialog = async (inv: Invoice) => {
    setViewOpen(true);
    setViewLoading(true);
    setViewDetail(null);
    try {
      const { data } = await supabase
        .from('invoices')
        .select('id, invoice_number, total, status, created_at, due_date, notes, clients(first_name, last_name), appointments(reason, pets(name)), invoice_line_items(id, description, quantity, unit_price), payments(id, amount, method, paid_at)')
        .eq('id', inv.supaId)
        .single();
      if (data) {
        const d = data as any;
        setViewDetail({
          invoiceNumber: d.invoice_number || `INV-${d.id?.substring(0, 8)}`,
          client: d.clients ? `${d.clients.first_name} ${d.clients.last_name}` : '—',
          pet: d.appointments?.pets?.name ?? '—',
          service: d.appointments?.reason ?? '—',
          date: new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          dueDate: d.due_date ? new Date(d.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
          status: (d.status || 'Pending') as InvoiceStatus,
          total: Number(d.total || 0),
          lineItems: (d.invoice_line_items || []).map((li: any) => ({
            description: li.description, quantity: li.quantity, unitPrice: Number(li.unit_price),
          })),
          payments: (d.payments || []).map((p: any) => ({
            amount: Number(p.amount), method: p.method || 'Unknown',
            paidAt: new Date(p.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          })),
          notes: d.notes || '',
        });
      }
    } catch (err) {
      console.error('Failed to load invoice detail:', err);
    } finally {
      setViewLoading(false);
    }
  };

  const filtered = invoices.filter(inv => {
    const q = search.toLowerCase();
    const matchQ = !q || inv.client.toLowerCase().includes(q) || inv.pet.toLowerCase().includes(q) || inv.id.toLowerCase().includes(q);
    const matchS = !statusFilter || inv.status === statusFilter;
    const matchFrom = !dateFrom || inv.date >= new Date(dateFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const matchTo = !dateTo || inv.date <= new Date(dateTo).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return matchQ && matchS && matchFrom && matchTo;
  });

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    backgroundColor: 'var(--surface-white)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px', fontSize: '14px',
    color: 'var(--text-primary)', outline: 'none',
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '32px' }}>

      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="text-[var(--text-primary)]">Payments</h1>
          <p className="text-[var(--text-secondary)]" style={{ fontSize: '15px', marginTop: '4px' }}>
            Invoices, collections, and payment history
          </p>
        </div>
        <button
          style={{
            padding: '10px 20px', borderRadius: '9px',
            backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)',
            border: 'none', cursor: 'pointer',
            fontSize: '14px', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: '8px',
          }}
        >
          <FileText style={{ width: '16px', height: '16px' }} />
          Create Invoice
        </button>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '28px' }}>
        <StatCard
          title="Total Revenue (Month)"
          value={`$${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="this month"
          icon={TrendingUp}
          color="#2D6A4F"
          bg="#2D6A4F15"
        />
        <StatCard
          title="Pending"
          value={`$${stats.pendingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle={`${stats.pendingCount} invoice${stats.pendingCount !== 1 ? 's' : ''} pending`}
          icon={Clock}
          color="#D97706"
          bg="#F4A26115"
        />
        <StatCard
          title="Overdue"
          value={`$${stats.overdueAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle={`${stats.overdueCount} invoice${stats.overdueCount !== 1 ? 's' : ''} overdue`}
          icon={AlertCircle}
          color="#d4183d"
          bg="#d4183d15"
        />
        <StatCard
          title="Collected Today"
          value={`$${stats.collectedToday.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle={`${stats.collectedTodayCount} payment${stats.collectedTodayCount !== 1 ? 's' : ''} received`}
          icon={CheckCircle2}
          color="#3B82F6"
          bg="#3B82F615"
        />
      </div>

      {/* Filter Bar */}
      <div
        className="bg-[var(--surface-white)] border border-[var(--border-color)]"
        style={{ borderRadius: '12px', padding: '16px', marginBottom: '16px' }}
      >
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Search by client, pet, or invoice #..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: '32px', width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputStyle, flex: '0 0 auto' }}>
            <option value="">All Statuses</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Overdue">Overdue</option>
            <option value="Partial">Partial</option>
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inputStyle} placeholder="From" />
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inputStyle} placeholder="To" />
          </div>

          <button
            style={{
              marginLeft: 'auto', padding: '8px 16px', borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--surface-elevated)',
              color: 'var(--text-secondary)',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <Download style={{ width: '14px', height: '14px' }} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div
        className="bg-[var(--surface-white)] border border-[var(--border-color)]"
        style={{ borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr className="border-b border-[var(--border-color)]" style={{ backgroundColor: 'var(--bg-offwhite)' }}>
                {['Invoice #', 'Client', 'Pet', 'Service', 'Date', 'Amount', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left',
                    fontSize: '11px', fontWeight: 700,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv, idx) => (
                <tr
                  key={inv.id}
                  className="hover:bg-[var(--surface-elevated)] transition-colors"
                  style={{ borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-color)' : 'none' }}
                >
                  <td style={{ padding: '13px 16px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--brand-green-text)', fontFamily: 'monospace' }}>
                      {inv.id}
                    </span>
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{inv.client}</span>
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{inv.pet}</span>
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{inv.service}</span>
                  </td>
                  <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{inv.date}</span>
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{inv.amount}</span>
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <StatusBadge status={inv.status} />
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => openViewDialog(inv)} style={{
                        padding: '5px 11px', borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--surface-elevated)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: '4px',
                      }}>
                        <Eye style={{ width: '12px', height: '12px' }} />
                        View
                      </button>
                      {(inv.status === 'Pending' || inv.status === 'Overdue') && (
                        <button style={{
                          padding: '5px 11px', borderRadius: '6px',
                          border: 'none',
                          backgroundColor: inv.status === 'Overdue' ? '#d4183d' : '#F4A261',
                          color: '#fff',
                          cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                          display: 'flex', alignItems: 'center', gap: '4px',
                          whiteSpace: 'nowrap',
                        }}>
                          <Bell style={{ width: '12px', height: '12px' }} />
                          Remind
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div
          className="border-t border-[var(--border-color)] flex items-center justify-between"
          style={{ padding: '12px 16px' }}
        >
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Showing <strong style={{ color: 'var(--text-primary)' }}>{filtered.length}</strong> of{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{invoices.length}</strong> invoices
          </p>
        </div>
      </div>

      {/* Bottom row: Payment Methods + Recent Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

        {/* Payment Methods Breakdown */}
        <div
          className="bg-[var(--surface-white)] border border-[var(--border-color)]"
          style={{ borderRadius: '12px', padding: '24px' }}
        >
          <h3 className="text-[var(--text-primary)]" style={{ marginBottom: '20px' }}>Payment Methods</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {(methods.length > 0 ? methods : [{ label: 'No payments yet', pct: 0, color: '#6B7280', amount: '$0.00' }]).map(item => (
              <div key={item.label}>
                <div className="flex items-center justify-between" style={{ marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: item.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {item.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{item.amount}</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', minWidth: '36px', textAlign: 'right' }}>
                      {item.pct}%
                    </span>
                  </div>
                </div>
                <div style={{ height: '8px', borderRadius: '9999px', backgroundColor: 'var(--border-color)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: '9999px',
                    backgroundColor: item.color,
                    width: `${item.pct}%`,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>

          <div
            className="border-t border-[var(--border-color)]"
            style={{ marginTop: '20px', paddingTop: '16px' }}
          >
            <div className="flex items-center justify-between">
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Total Processed (Month)
              </span>
              <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                ${totalProcessed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div
          className="bg-[var(--surface-white)] border border-[var(--border-color)]"
          style={{ borderRadius: '12px', padding: '24px' }}
        >
          <h3 className="text-[var(--text-primary)]" style={{ marginBottom: '20px' }}>Recent Activity</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {activity.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No recent activity</p>
              </div>
            ) : activity.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex', gap: '14px', position: 'relative',
                    paddingBottom: idx < activity.length - 1 ? '20px' : '0',
                  }}
                >
                  {/* Timeline line */}
                  {idx < activity.length - 1 && (
                    <div style={{
                      position: 'absolute', left: '17px', top: '34px',
                      width: '2px', height: 'calc(100% - 14px)',
                      backgroundColor: 'var(--border-color)',
                    }} />
                  )}
                  {/* Icon */}
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '9999px',
                    backgroundColor: item.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, zIndex: 1,
                  }}>
                    <Icon style={{ width: '15px', height: '15px', color: item.color }} />
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, paddingTop: '7px' }}>
                    <span style={{
                      display: 'inline-flex', marginBottom: '3px',
                      padding: '1px 7px', borderRadius: '4px',
                      fontSize: '10px', fontWeight: 700,
                      backgroundColor: item.bg, color: item.color,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      {item.label}
                    </span>
                    <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      {item.text}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {item.time}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ── Invoice Detail Dialog ── */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText style={{ width: 16, height: 16, color: 'var(--brand-green-text)' }} />
              {viewDetail?.invoiceNumber || 'Invoice'}
            </DialogTitle>
          </DialogHeader>
          {viewLoading ? (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <div className="w-6 h-6 border-2 border-[var(--border-color)] border-t-[var(--brand-green-text)] rounded-full animate-spin mx-auto mb-3" />
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Loading…</p>
            </div>
          ) : viewDetail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Summary row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Client</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{viewDetail.client}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Pet</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{viewDetail.pet}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Service</p>
                  <p style={{ fontSize: 14, color: 'var(--text-primary)' }}>{viewDetail.service}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Status</p>
                  <StatusBadge status={viewDetail.status} />
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Created</p>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>{viewDetail.date}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Due Date</p>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>{viewDetail.dueDate}</p>
                </div>
              </div>

              {/* Line Items */}
              {viewDetail.lineItems.length > 0 && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Line Items</p>
                  <div className="border border-[var(--border-color)] overflow-hidden" style={{ borderRadius: 8 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-offwhite)' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Description</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Qty</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Price</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewDetail.lineItems.map((li, i) => (
                          <tr key={i} style={{ borderTop: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-primary)' }}>{li.description}</td>
                            <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'right' }}>{li.quantity}</td>
                            <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'right' }}>${li.unitPrice.toFixed(2)}</td>
                            <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right' }}>${(li.quantity * li.unitPrice).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Payments */}
              {viewDetail.payments.length > 0 && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Payments Received</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {viewDetail.payments.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-2 border border-[var(--border-color)]" style={{ borderRadius: 8 }}>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 style={{ width: 14, height: 14, color: '#22c55e' }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>${p.amount.toFixed(2)}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>via {p.method}</span>
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.paidAt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {viewDetail.notes && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Notes</p>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{viewDetail.notes}</p>
                </div>
              )}

              {/* Total */}
              <div className="border-t border-[var(--border-color)] flex items-center justify-between" style={{ paddingTop: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Invoice Total</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>${viewDetail.total.toFixed(2)}</span>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
