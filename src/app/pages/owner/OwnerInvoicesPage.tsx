import { useState } from 'react';
import {
  Receipt, Search, Download, CreditCard, DollarSign,
  Clock, AlertCircle, CheckCircle2, X, Smartphone,
  ChevronRight, FileText,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

type InvoiceStatus = 'Paid' | 'Pending' | 'Overdue';

interface LineItem {
  service: string;
  description: string;
  qty: number;
  unitPrice: number;
}

interface OwnerInvoice {
  id: string;
  petName: string;
  petImage: string;
  petBreed: string;
  service: string;
  date: string;
  dateISO: string;
  vet: string;
  status: InvoiceStatus;
  subtotal: number;
  taxRate: number;
  items: LineItem[];
  paidDate?: string;
  dueDate: string;
  notes?: string;
}

// ─── Mock Data ────────────────────────────────────────────────

const MAX_IMAGE = 'https://images.unsplash.com/photo-1734966213753-1b361564bab4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb2xkZW4lMjByZXRyaWV2ZXIlMjBkb2clMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzMyNDMxMzB8MA&ixlib=rb-4.1.0&q=80&w=400';
const HUGO_IMAGE = 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400';

const OWNER_INVOICES: OwnerInvoice[] = [
  {
    id: 'INV-2026-001',
    petName: 'Max', petImage: MAX_IMAGE, petBreed: 'Golden Retriever',
    service: 'Annual Checkup', date: 'Mar 11, 2026', dateISO: '2026-03-11',
    vet: 'Dr. Sarah Chen', status: 'Paid', paidDate: 'Mar 14, 2026', dueDate: 'Mar 25, 2026',
    subtotal: 145, taxRate: 0.08,
    items: [
      { service: 'Annual Wellness Exam', description: 'Full physical examination', qty: 1, unitPrice: 85 },
      { service: 'DHPP Booster', description: 'Distemper/Parvo combination vaccine', qty: 1, unitPrice: 40 },
      { service: 'Heartworm Test', description: '4Dx Plus test', qty: 1, unitPrice: 20 },
    ],
  },
  {
    id: 'INV-2026-008',
    petName: 'Max', petImage: MAX_IMAGE, petBreed: 'Golden Retriever',
    service: 'Hip Consultation', date: 'Feb 20, 2026', dateISO: '2026-02-20',
    vet: 'Dr. Sarah Chen', status: 'Paid', paidDate: 'Feb 22, 2026', dueDate: 'Mar 6, 2026',
    subtotal: 95, taxRate: 0.08,
    items: [
      { service: 'Orthopedic Consultation', description: 'Hip dysplasia assessment', qty: 1, unitPrice: 65 },
      { service: 'Dasuquin Advanced', description: '90-count joint supplement (1 month)', qty: 1, unitPrice: 30 },
    ],
  },
  {
    id: 'INV-2026-014',
    petName: 'Max', petImage: MAX_IMAGE, petBreed: 'Golden Retriever',
    service: 'Dental Cleaning', date: 'Mar 14, 2026', dateISO: '2026-03-14',
    vet: 'Dr. Raj Patel', status: 'Pending', dueDate: 'Mar 28, 2026',
    subtotal: 250, taxRate: 0.08,
    notes: 'Includes pre-anesthetic bloodwork.',
    items: [
      { service: 'Dental Prophylaxis', description: 'Full dental scaling & polish under anesthesia', qty: 1, unitPrice: 180 },
      { service: 'Pre-Anesthetic Bloodwork', description: 'CBC + chemistry panel', qty: 1, unitPrice: 55 },
      { service: 'IV Fluid Support', description: 'During procedure', qty: 1, unitPrice: 15 },
    ],
  },
  {
    id: 'INV-2026-003',
    petName: 'Hugo', petImage: HUGO_IMAGE, petBreed: 'Persian Cat',
    service: 'Dental Cleaning', date: 'Jan 15, 2026', dateISO: '2026-01-15',
    vet: 'Dr. Sarah Chen', status: 'Paid', paidDate: 'Jan 18, 2026', dueDate: 'Jan 29, 2026',
    subtotal: 320, taxRate: 0.08,
    items: [
      { service: 'Dental Prophylaxis', description: 'Full dental cleaning under general anesthesia', qty: 1, unitPrice: 200 },
      { service: 'Tooth Extraction (Grade 3)', description: '1 molar extracted', qty: 1, unitPrice: 80 },
      { service: 'Post-Op Antibiotics', description: 'Clindamycin 10-day course', qty: 1, unitPrice: 40 },
    ],
  },
  {
    id: 'INV-2026-007',
    petName: 'Hugo', petImage: HUGO_IMAGE, petBreed: 'Persian Cat',
    service: 'FeLV & FVRCP Vaccines', date: 'Dec 10, 2025', dateISO: '2025-12-10',
    vet: 'Dr. Raj Patel', status: 'Paid', paidDate: 'Dec 10, 2025', dueDate: 'Dec 24, 2025',
    subtotal: 70, taxRate: 0.08,
    items: [
      { service: 'FeLV Vaccine', description: 'Feline leukemia virus booster', qty: 1, unitPrice: 35 },
      { service: 'FVRCP Vaccine', description: 'Rhinotracheitis/calicivirus/panleukopenia', qty: 1, unitPrice: 35 },
    ],
  },
  {
    id: 'INV-2026-019',
    petName: 'Hugo', petImage: HUGO_IMAGE, petBreed: 'Persian Cat',
    service: 'Urinalysis & Recheck', date: 'Feb 1, 2026', dateISO: '2026-02-01',
    vet: 'Dr. Sarah Chen', status: 'Overdue', dueDate: 'Feb 15, 2026',
    subtotal: 110, taxRate: 0.08,
    notes: 'Payment was due Feb 15. Please contact the clinic to arrange payment.',
    items: [
      { service: 'Urinalysis', description: 'Complete urinalysis with culture', qty: 1, unitPrice: 75 },
      { service: 'Follow-up Consultation', description: 'Dental recheck exam', qty: 1, unitPrice: 35 },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────

function calcTotal(inv: OwnerInvoice) {
  const tax = inv.subtotal * inv.taxRate;
  return inv.subtotal + tax;
}

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

// ─── Status Config ────────────────────────────────────────────

const STATUS_CFG: Record<InvoiceStatus, { bg: string; color: string; label: string; Icon: typeof CheckCircle2 }> = {
  Paid:    { bg: '#2D6A4F15', color: '#2D6A4F', label: 'Paid',    Icon: CheckCircle2 },
  Pending: { bg: '#F4A26115', color: '#D97706', label: 'Pending', Icon: Clock },
  Overdue: { bg: '#d4183d15', color: '#d4183d', label: 'Overdue', Icon: AlertCircle },
};

// ─── Status Badge ─────────────────────────────────────────────

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const c = STATUS_CFG[status];
  const Icon = c.Icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '4px 11px', borderRadius: '9999px',
      fontSize: '12px', fontWeight: 700,
      backgroundColor: c.bg, color: c.color,
    }}>
      <Icon style={{ width: 11, height: 11 }} />
      {c.label}
    </span>
  );
}

// ─── Invoice Detail Modal ─────────────────────────────────────

function InvoiceModal({ inv, onClose }: { inv: OwnerInvoice; onClose: () => void }) {
  const [payMethod, setPayMethod] = useState<'card' | 'terminal' | 'cash'>('card');
  const [paid, setPaid] = useState(false);

  const tax   = inv.subtotal * inv.taxRate;
  const total = inv.subtotal + tax;

  if (paid) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 300,
        backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
      }}>
        <div style={{
          backgroundColor: 'var(--surface-white)', borderRadius: '16px',
          width: '100%', maxWidth: '480px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.2)', overflow: 'hidden',
        }}>
          <div style={{ height: '4px', background: 'linear-gradient(90deg, #2D6A4F, #52B788)' }} />
          <div style={{ padding: '40px 32px', textAlign: 'center' }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              backgroundColor: '#2D6A4F15', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <CheckCircle2 style={{ width: '36px', height: '36px', color: '#2D6A4F' }} />
            </div>
            <p style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Payment Successful
            </p>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              {fmt(total)} charged to card on file
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '28px' }}>
              A receipt has been sent to john.smith@email.com
            </p>
            <button
              onClick={onClose}
              style={{
                padding: '12px 32px', borderRadius: '10px',
                backgroundColor: '#2D6A4F', color: '#fff',
                border: 'none', cursor: 'pointer',
                fontSize: '15px', fontWeight: 700,
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--surface-white)', borderRadius: '16px',
          width: '100%', maxWidth: '520px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.2)', overflow: 'hidden',
          maxHeight: '90vh', overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Color stripe */}
        <div style={{ height: '4px', background: 'linear-gradient(90deg, #8B5CF6, #3B82F6)' }} />

        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              backgroundColor: '#8B5CF615',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Receipt style={{ width: '18px', height: '18px', color: '#8B5CF6' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Invoice {inv.id}
                </p>
                <StatusBadge status={inv.status} />
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {inv.petName} · {inv.date} · {inv.vet}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '30px', height: '30px', borderRadius: '8px',
              border: 'none', cursor: 'pointer',
              backgroundColor: 'var(--surface-elevated)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-secondary)',
            }}
          >
            <X style={{ width: '15px', height: '15px' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>

          {/* Pet row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '12px 14px', borderRadius: '10px',
            backgroundColor: 'var(--surface-elevated)',
            marginBottom: '20px',
          }}>
            <img
              src={inv.petImage} alt={inv.petName}
              style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{inv.petName}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{inv.petBreed}</p>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                Due Date
              </p>
              <p style={{
                fontSize: '13px', fontWeight: 700,
                color: inv.status === 'Overdue' ? '#d4183d' : 'var(--text-primary)',
              }}>
                {inv.dueDate}
              </p>
            </div>
          </div>

          {/* Overdue notice */}
          {inv.status === 'Overdue' && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px',
              backgroundColor: '#d4183d10', border: '1px solid #d4183d30',
              display: 'flex', alignItems: 'flex-start', gap: '8px',
              marginBottom: '16px',
            }}>
              <AlertCircle style={{ width: '15px', height: '15px', color: '#d4183d', marginTop: '1px', flexShrink: 0 }} />
              <p style={{ fontSize: '13px', color: '#d4183d', lineHeight: 1.5 }}>
                {inv.notes || 'This invoice is overdue. Please make a payment as soon as possible.'}
              </p>
            </div>
          )}

          {/* Line items */}
          <div style={{
            borderRadius: '10px', overflow: 'hidden',
            border: '1px solid var(--border-color)',
            marginBottom: '16px',
          }}>
            {/* Table header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr auto',
              padding: '10px 14px',
              backgroundColor: 'var(--surface-elevated)',
              borderBottom: '1px solid var(--border-color)',
            }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Service
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Amount
              </span>
            </div>

            {/* Line items */}
            {inv.items.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr auto',
                  padding: '12px 14px', alignItems: 'center',
                  borderBottom: idx < inv.items.length - 1 ? '1px solid var(--border-color)' : 'none',
                }}
              >
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {item.service}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {item.description}
                    {item.qty > 1 && ` × ${item.qty}`}
                  </p>
                </div>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {fmt(item.unitPrice * item.qty)}
                </span>
              </div>
            ))}

            {/* Totals */}
            <div style={{ borderTop: '1px solid var(--border-color)', padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Subtotal</span>
                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{fmt(inv.subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Tax ({(inv.taxRate * 100).toFixed(0)}%)</span>
                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{fmt(tax)}</span>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                paddingTop: '10px', borderTop: '1px solid var(--border-color)',
              }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Total</span>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#8B5CF6' }}>{fmt(total)}</span>
              </div>
            </div>
          </div>

          {/* Paid stamp */}
          {inv.status === 'Paid' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 14px', borderRadius: '8px',
              backgroundColor: '#2D6A4F10', border: '1px solid #2D6A4F30',
              marginBottom: '16px',
            }}>
              <CheckCircle2 style={{ width: '16px', height: '16px', color: '#2D6A4F', flexShrink: 0 }} />
              <p style={{ fontSize: '13px', color: '#2D6A4F', fontWeight: 600 }}>
                Paid on {inv.paidDate}
              </p>
            </div>
          )}

          {/* Payment section — only for unpaid */}
          {inv.status !== 'Paid' && (
            <>
              <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                Payment Method
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                {([
                  { id: 'card' as const,     label: 'Card on File',      Icon: CreditCard },
                  { id: 'terminal' as const, label: 'Use Card Machine',   Icon: Smartphone },
                  { id: 'cash' as const,     label: 'Cash',              Icon: DollarSign },
                ] as { id: 'card' | 'terminal' | 'cash'; label: string; Icon: typeof CreditCard }[]).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setPayMethod(id)}
                    style={{
                      padding: '10px 8px', borderRadius: '10px',
                      border: payMethod === id ? '2px solid #8B5CF6' : '1px solid var(--border-color)',
                      backgroundColor: payMethod === id ? '#8B5CF608' : 'var(--surface-elevated)',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: '6px',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Icon style={{ width: '18px', height: '18px', color: payMethod === id ? '#8B5CF6' : 'var(--text-secondary)' }} />
                    <span style={{
                      fontSize: '11px', fontWeight: 600,
                      color: payMethod === id ? '#8B5CF6' : 'var(--text-secondary)',
                      textAlign: 'center', lineHeight: 1.3,
                    }}>
                      {label}
                    </span>
                  </button>
                ))}
              </div>

              {payMethod === 'terminal' && (
                <div style={{
                  padding: '10px 14px', borderRadius: '8px',
                  backgroundColor: '#3B82F610', border: '1px solid #3B82F630',
                  marginBottom: '16px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <Smartphone style={{ width: '15px', height: '15px', color: '#3B82F6', flexShrink: 0 }} />
                  <p style={{ fontSize: '13px', color: '#3B82F6' }}>
                    Please visit the clinic or call <strong>(555) 123-4567</strong> to pay via card machine.
                  </p>
                </div>
              )}
              {payMethod === 'cash' && (
                <div style={{
                  padding: '10px 14px', borderRadius: '8px',
                  backgroundColor: '#F4A26110', border: '1px solid #F4A26130',
                  marginBottom: '16px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <DollarSign style={{ width: '15px', height: '15px', color: '#D97706', flexShrink: 0 }} />
                  <p style={{ fontSize: '13px', color: '#D97706' }}>
                    Cash payments accepted at the clinic during business hours.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex', gap: '10px', justifyContent: 'flex-end',
        }}>
          <button
            style={{
              padding: '10px 18px', borderRadius: '9px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--surface-elevated)',
              color: 'var(--text-secondary)',
              cursor: 'pointer', fontSize: '14px', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <Download style={{ width: '14px', height: '14px' }} />
            Download PDF
          </button>

          {inv.status !== 'Paid' && payMethod === 'card' && (
            <button
              onClick={() => setPaid(true)}
              style={{
                padding: '10px 22px', borderRadius: '9px',
                backgroundColor: '#8B5CF6', color: '#fff',
                border: 'none', cursor: 'pointer',
                fontSize: '14px', fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              <CreditCard style={{ width: '14px', height: '14px' }} />
              Pay {fmt(total)}
            </button>
          )}
          {inv.status !== 'Paid' && payMethod !== 'card' && (
            <button
              onClick={onClose}
              style={{
                padding: '10px 22px', borderRadius: '9px',
                backgroundColor: '#2D6A4F', color: '#fff',
                border: 'none', cursor: 'pointer',
                fontSize: '14px', fontWeight: 700,
              }}
            >
              Got It
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function OwnerInvoicesPage() {
  const [search, setSearch]             = useState('');
  const [petFilter, setPetFilter]       = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedInv, setSelectedInv]   = useState<OwnerInvoice | null>(null);

  const filtered = OWNER_INVOICES.filter(inv => {
    const q = search.toLowerCase();
    const matchQ = !q || inv.petName.toLowerCase().includes(q) || inv.id.toLowerCase().includes(q) || inv.service.toLowerCase().includes(q);
    const matchP = petFilter === 'all' || inv.petName === petFilter;
    const matchS = statusFilter === 'all' || inv.status === statusFilter;
    return matchQ && matchP && matchS;
  });

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    backgroundColor: 'var(--surface-white)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px', fontSize: '14px',
    color: 'var(--text-primary)', outline: 'none',
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
          My Invoices
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>
          Billing history for Max &amp; Hugo
        </p>
      </div>

      {/* ── Filters ── */}
      <div style={{
        display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center',
        marginBottom: '16px',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search style={{
            position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
            width: '14px', height: '14px', color: 'var(--text-secondary)',
          }} />
          <input
            type="text" placeholder="Search invoice, pet or service…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '32px', width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {/* Pet filter */}
        <select value={petFilter} onChange={e => setPetFilter(e.target.value)} style={inputStyle}>
          <option value="all">All Pets</option>
          <option value="Max">🐕 Max</option>
          <option value="Hugo">🐈 Hugo</option>
        </select>

        {/* Status filter */}
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={inputStyle}>
          <option value="all">All Statuses</option>
          <option value="Paid">✅ Paid</option>
          <option value="Pending">⏳ Pending</option>
          <option value="Overdue">🚨 Overdue</option>
        </select>

        {/* Download all */}
        <button style={{
          padding: '8px 16px', borderRadius: '8px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--surface-elevated)',
          color: 'var(--text-secondary)',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '6px',
          marginLeft: 'auto',
        }}>
          <Download style={{ width: '14px', height: '14px' }} />
          Export All
        </button>
      </div>

      {/* ── Invoice list ── */}
      <div style={{
        backgroundColor: 'var(--surface-white)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px', overflow: 'hidden',
      }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '44px 1fr 1fr 1fr 1fr auto',
          padding: '10px 16px',
          backgroundColor: 'var(--surface-elevated)',
          borderBottom: '1px solid var(--border-color)',
          gap: '12px',
        }}>
          {['', 'Invoice', 'Pet', 'Service', 'Date', 'Amount'].map((h, i) => (
            <span key={i} style={{
              fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {h}
            </span>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <FileText style={{ width: '32px', height: '32px', color: 'var(--text-secondary)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>No invoices found</p>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Try adjusting your filters</p>
          </div>
        )}

        {filtered.map((inv, idx) => {
          const total = calcTotal(inv);
          return (
            <div
              key={inv.id}
              onClick={() => setSelectedInv(inv)}
              style={{
                display: 'grid',
                gridTemplateColumns: '44px 1fr 1fr 1fr 1fr auto',
                padding: '14px 16px',
                borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-color)' : 'none',
                gap: '12px', alignItems: 'center',
                cursor: 'pointer', transition: 'background-color 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-elevated)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
            >
              {/* Pet avatar */}
              <img
                src={inv.petImage} alt={inv.petName}
                style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
              />

              {/* Invoice # */}
              <div>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#8B5CF6', fontFamily: 'monospace' }}>
                  {inv.id}
                </p>
                <StatusBadge status={inv.status} />
              </div>

              {/* Pet */}
              <div>
                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{inv.petName}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{inv.petBreed}</p>
              </div>

              {/* Service */}
              <p style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{inv.service}</p>

              {/* Date */}
              <div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{inv.date}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {inv.vet}
                </p>
              </div>

              {/* Amount + arrow */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>{fmt(total)}</p>
                  {inv.status === 'Paid' && (
                    <p style={{ fontSize: '11px', color: '#2D6A4F', fontWeight: 600 }}>Paid</p>
                  )}
                  {inv.status !== 'Paid' && (
                    <p style={{ fontSize: '11px', color: inv.status === 'Overdue' ? '#d4183d' : '#D97706', fontWeight: 600 }}>
                      Due {inv.dueDate}
                    </p>
                  )}
                </div>
                <ChevronRight style={{ width: '16px', height: '16px', color: 'var(--text-secondary)', flexShrink: 0 }} />
              </div>
            </div>
          );
        })}

        {/* Footer */}
        <div style={{
          padding: '12px 16px', borderTop: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Showing <strong style={{ color: 'var(--text-primary)' }}>{filtered.length}</strong> of{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{OWNER_INVOICES.length}</strong> invoices
          </p>
          {filtered.some(i => i.status !== 'Paid') && (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Click an invoice to view details &amp; pay
            </p>
          )}
        </div>
      </div>

      {/* ── Invoice Detail Modal ── */}
      {selectedInv && (
        <InvoiceModal inv={selectedInv} onClose={() => setSelectedInv(null)} />
      )}
    </div>
  );
}
