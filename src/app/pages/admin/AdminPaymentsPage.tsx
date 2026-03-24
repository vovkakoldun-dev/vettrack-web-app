import { useState, useEffect } from 'react';
import {
  TrendingUp, Clock, AlertCircle, CheckCircle2,
  Search, Download, Eye, Bell, FileText,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';

// ─── Types ────────────────────────────────────────────────────

type InvoiceStatus = 'Paid' | 'Pending' | 'Overdue' | 'Partial';

interface Invoice {
  id: string;
  client: string;
  pet: string;
  service: string;
  date: string;
  amount: string;
  status: InvoiceStatus;
}

// ─── (data loaded from Supabase) ──────────────────────────────

// ─── Status Badge ─────────────────────────────────────────────

const STATUS_STYLES: Record<InvoiceStatus, { bg: string; color: string }> = {
  Paid:    { bg: '#2D6A4F15', color: '#2D6A4F' },
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

// ─── Activity Feed ──────────────────────────────────────────

const ACTIVITY = [
  { id: 1, label: 'Payment', text: 'Payment of $120.00 received from Sarah Johnson', time: '10 min ago', icon: CheckCircle2, color: '#2D6A4F', bg: '#2D6A4F15' },
  { id: 2, label: 'Invoice', text: 'Invoice #INV-0042 sent to Mark Davis', time: '25 min ago', icon: FileText, color: '#3B82F6', bg: '#3B82F615' },
  { id: 3, label: 'Overdue', text: 'Invoice #INV-0038 is now overdue — Lisa Park', time: '1 hr ago', icon: AlertCircle, color: '#d4183d', bg: '#d4183d15' },
  { id: 4, label: 'Payment', text: 'Payment of $85.00 received from Tom Wilson', time: '2 hrs ago', icon: CheckCircle2, color: '#2D6A4F', bg: '#2D6A4F15' },
  { id: 5, label: 'Reminder', text: 'Payment reminder sent to Emily Carter', time: '3 hrs ago', icon: Bell, color: '#D97706', bg: '#F4A26115' },
];

// ─── Page ─────────────────────────────────────────────────────

export default function AdminPaymentsPage() {
  const [search, setSearch]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]   = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('invoices')
        .select('id, invoice_number, total, status, created_at, notes, clients(id, first_name, last_name), appointments(id, reason, pets(id, name))')
        .order('created_at', { ascending: false });
      if (data) {
        const mapped: Invoice[] = data.map((inv: any) => ({
          id: inv.invoice_number,
          client: inv.clients ? `${inv.clients.first_name} ${inv.clients.last_name}` : '—',
          pet: inv.appointments?.pets?.name ?? '—',
          service: inv.appointments?.reason ?? inv.notes ?? '—',
          date: new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          amount: `$${inv.total?.toFixed(2) ?? '0.00'}`,
          status: (inv.status || 'Pending') as InvoiceStatus,
        }));
        setInvoices(mapped);
      }
    })();
  }, []);

  const filtered = invoices.filter(inv => {
    const q = search.toLowerCase();
    const matchQ = !q || inv.client.toLowerCase().includes(q) || inv.pet.toLowerCase().includes(q) || inv.id.toLowerCase().includes(q);
    const matchS  = !statusFilter || inv.status === statusFilter;
    return matchQ && matchS;
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
            backgroundColor: '#2D6A4F', color: '#fff',
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
          value="$18,420"
          subtitle="+8% from last month"
          icon={TrendingUp}
          color="#2D6A4F"
          bg="#2D6A4F15"
        />
        <StatCard
          title="Pending"
          value="$3,150"
          subtitle="14 invoices pending"
          icon={Clock}
          color="#D97706"
          bg="#F4A26115"
        />
        <StatCard
          title="Overdue"
          value="$840"
          subtitle="3 invoices overdue"
          icon={AlertCircle}
          color="#d4183d"
          bg="#d4183d15"
        />
        <StatCard
          title="Collected Today"
          value="$620"
          subtitle="4 payments received"
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
                      <button style={{
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
            {[
              { label: 'Credit / Debit Card', pct: 58, color: '#3B82F6', amount: '$10,684' },
              { label: 'Cash',                pct: 32, color: '#2D6A4F', amount: '$5,894'  },
              { label: 'Pet Insurance',       pct: 10, color: '#8B5CF6', amount: '$1,842'  },
            ].map(item => (
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
                $18,420
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
            {ACTIVITY.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex', gap: '14px', position: 'relative',
                    paddingBottom: idx < ACTIVITY.length - 1 ? '20px' : '0',
                  }}
                >
                  {/* Timeline line */}
                  {idx < ACTIVITY.length - 1 && (
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
    </div>
  );
}
