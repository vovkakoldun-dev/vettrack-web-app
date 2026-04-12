import { useState, useEffect, useCallback } from 'react';
import {
  Receipt, Search, Download, CreditCard, DollarSign,
  Clock, AlertCircle, CheckCircle2, X, Smartphone,
  ChevronRight, FileText, Loader2,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useOwnerClient } from '../../hooks/useOwnerClient';
import { getOrgContext } from '../../hooks/useOrgContext';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

// ─── Types ────────────────────────────────────────────────────

type InvoiceStatus = 'Paid' | 'Pending' | 'Overdue' | 'Sent' | 'Partial';

interface LineItem {
  description: string;
  qty: number;
  unitPrice: number;
}

interface OwnerInvoice {
  id: string;          // supabase UUID
  invoiceNumber: string;
  petName: string;
  petImage: string;
  petBreed: string;
  service: string;
  date: string;
  dateISO: string;
  vet: string;
  status: InvoiceStatus;
  subtotal: number;
  taxAmount: number;
  total: number;
  items: LineItem[];
  paidDate?: string;
  dueDate: string;
  notes?: string;
}

// ─── Helpers ──────────────────────────────────────────────────

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

// ─── Status Config ────────────────────────────────────────────

type DisplayStatus = 'Paid' | 'Pending' | 'Overdue';

const STATUS_CFG: Record<DisplayStatus, { bg: string; color: string; label: string; Icon: typeof CheckCircle2 }> = {
  Paid:    { bg: 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)', color: 'var(--brand-green-text)', label: 'Paid',    Icon: CheckCircle2 },
  Pending: { bg: '#F4A26115', color: '#D97706', label: 'Pending', Icon: Clock },
  Overdue: { bg: '#d4183d15', color: '#d4183d', label: 'Overdue', Icon: AlertCircle },
};

function getDisplayStatus(s: InvoiceStatus): DisplayStatus {
  if (s === 'Paid') return 'Paid';
  if (s === 'Overdue') return 'Overdue';
  return 'Pending'; // Sent, Partial, Pending all show as "Pending"
}

// ─── Status Badge ─────────────────────────────────────────────

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const ds = getDisplayStatus(status);
  const c = STATUS_CFG[ds];
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

function InvoiceModal({ inv, onClose, onPaid }: { inv: OwnerInvoice; onClose: () => void; onPaid: () => void }) {
  const [payMethod, setPayMethod] = useState<'card' | 'terminal' | 'cash'>('card');
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(inv.status === 'Paid');

  const total = inv.total;

  const handleStripeCheckout = async () => {
    setPaying(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const token = authSession?.access_token;
      if (!token) { alert('Please log in to pay.'); setPaying(false); return; }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            invoice_id: inv.id,
            success_url: `${window.location.origin}/owner/invoices?payment=success&invoice=${inv.id}`,
            cancel_url: `${window.location.origin}/owner/invoices?payment=cancelled`,
          }),
        }
      );
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to create checkout session');
      }
    } catch (err) {
      console.error('Stripe checkout error:', err);
      alert('Payment failed. Please try again.');
    } finally {
      setPaying(false);
    }
  };

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
          <div style={{ height: '4px', background: 'linear-gradient(90deg, var(--brand-green-text), #52B788)' }} />
          <div style={{ padding: '40px 32px', textAlign: 'center' }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <CheckCircle2 style={{ width: '36px', height: '36px', color: 'var(--brand-green-text)' }} />
            </div>
            <p style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Payment Successful
            </p>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              {fmt(total)} paid via Stripe
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '28px' }}>
              A receipt has been sent to your email
            </p>
            <button
              onClick={() => { onPaid(); onClose(); }}
              style={{
                padding: '12px 32px', borderRadius: '10px',
                backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)',
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
                  Invoice {inv.invoiceNumber}
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
            {inv.petImage && (
              <img
                src={inv.petImage} alt={inv.petName}
                style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              />
            )}
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
                    {item.description}
                  </p>
                  {item.qty > 1 && (
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      × {item.qty}
                    </p>
                  )}
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
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Tax</span>
                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{fmt(inv.taxAmount)}</span>
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
              backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--brand-green-text) 19%, transparent)',
              marginBottom: '16px',
            }}>
              <CheckCircle2 style={{ width: '16px', height: '16px', color: 'var(--brand-green-text)', flexShrink: 0 }} />
              <p style={{ fontSize: '13px', color: 'var(--brand-green-text)', fontWeight: 600 }}>
                Paid{inv.paidDate ? ` on ${inv.paidDate}` : ''}
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
                  { id: 'card' as const,     label: 'Pay Online',          Icon: CreditCard },
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
              onClick={handleStripeCheckout}
              disabled={paying}
              style={{
                padding: '10px 22px', borderRadius: '9px',
                backgroundColor: '#8B5CF6', color: '#fff',
                border: 'none', cursor: paying ? 'not-allowed' : 'pointer',
                opacity: paying ? 0.7 : 1,
                fontSize: '14px', fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              {paying ? (
                <>
                  <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />
                  Redirecting…
                </>
              ) : (
                <>
                  <CreditCard style={{ width: '14px', height: '14px' }} />
                  Pay {fmt(total)}
                </>
              )}
            </button>
          )}
          {inv.status !== 'Paid' && payMethod !== 'card' && (
            <button
              onClick={onClose}
              style={{
                padding: '10px 22px', borderRadius: '9px',
                backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)',
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
  const { user } = useAuth();
  const { clientId } = useOwnerClient();
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedInv, setSelectedInv]   = useState<OwnerInvoice | null>(null);
  const [invoices, setInvoices]         = useState<OwnerInvoice[]>([]);
  const [loading, setLoading]           = useState(true);

  // Check for payment success from Stripe redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const loadInvoices = useCallback(async () => {
    if (!clientId) { setLoading(false); return; }
    try {
      const { organizationId } = await getOrgContext();
      const { data } = await supabase
        .from('invoices')
        .select(`
          id, invoice_number, subtotal, tax_amount, total, status, created_at, due_date, paid_at, notes,
          appointments(id, reason, scheduled_at, pets(id, name, species, breed, image_url), staff:staff!appointments_vet_id_fkey(profiles!staff_profile_id_fkey(first_name, last_name))),
          invoice_line_items(id, description, quantity, unit_price)
        `)
        .eq('organization_id', organizationId)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (data) {
        const mapped: OwnerInvoice[] = data.map((inv: any) => {
          const appt = inv.appointments;
          const pet = appt?.pets;
          const vetProfile = appt?.staff?.profiles;
          const vetName = vetProfile ? `Dr. ${vetProfile.first_name} ${vetProfile.last_name}`.trim() : '—';
          return {
            id: inv.id,
            invoiceNumber: inv.invoice_number || `INV-${inv.id.substring(0, 8)}`,
            petName: pet?.name || '—',
            petImage: pet?.image_url || '',
            petBreed: pet?.breed || pet?.species || '',
            service: appt?.reason || inv.notes || '—',
            date: new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            dateISO: inv.created_at,
            vet: vetName,
            status: (inv.status || 'Pending') as InvoiceStatus,
            subtotal: Number(inv.subtotal || 0),
            taxAmount: Number(inv.tax_amount || 0),
            total: Number(inv.total || 0),
            items: (inv.invoice_line_items || []).map((li: any) => ({
              description: li.description,
              qty: li.quantity || 1,
              unitPrice: Number(li.unit_price || 0),
            })),
            paidDate: inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : undefined,
            dueDate: inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
            notes: inv.notes || undefined,
          };
        });
        setInvoices(mapped);
      }
    } catch (err) {
      console.error('loadInvoices error:', err);
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const filtered = invoices.filter(inv => {
    const q = search.toLowerCase();
    const matchQ = !q || inv.petName.toLowerCase().includes(q) || inv.invoiceNumber.toLowerCase().includes(q) || inv.service.toLowerCase().includes(q);
    const matchS = statusFilter === 'all' || getDisplayStatus(inv.status) === statusFilter;
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
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
          My Invoices
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>
          View and pay your veterinary invoices
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

        {/* Status filter */}
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={inputStyle}>
          <option value="all">All Statuses</option>
          <option value="Paid">Paid</option>
          <option value="Pending">Pending</option>
          <option value="Overdue">Overdue</option>
        </select>
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

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <div className="w-6 h-6 border-2 border-[var(--border-color)] border-t-[var(--brand-green-text)] rounded-full animate-spin mx-auto mb-3" />
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Loading invoices…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <FileText style={{ width: '32px', height: '32px', color: 'var(--text-secondary)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>No invoices found</p>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {invoices.length === 0 ? 'You have no invoices yet' : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          filtered.map((inv, idx) => (
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
              {inv.petImage ? (
                <img
                  src={inv.petImage} alt={inv.petName}
                  style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  backgroundColor: 'var(--surface-elevated)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)',
                }}>
                  {inv.petName.charAt(0)}
                </div>
              )}

              {/* Invoice # */}
              <div>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#8B5CF6', fontFamily: 'monospace' }}>
                  {inv.invoiceNumber}
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
                  <p style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>{fmt(inv.total)}</p>
                  {inv.status === 'Paid' ? (
                    <p style={{ fontSize: '11px', color: 'var(--brand-green-text)', fontWeight: 600 }}>Paid</p>
                  ) : (
                    <p style={{ fontSize: '11px', color: inv.status === 'Overdue' ? '#d4183d' : '#D97706', fontWeight: 600 }}>
                      Due {inv.dueDate}
                    </p>
                  )}
                </div>
                <ChevronRight style={{ width: '16px', height: '16px', color: 'var(--text-secondary)', flexShrink: 0 }} />
              </div>
            </div>
          ))
        )}

        {/* Footer */}
        <div style={{
          padding: '12px 16px', borderTop: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Showing <strong style={{ color: 'var(--text-primary)' }}>{filtered.length}</strong> of{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{invoices.length}</strong> invoices
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
        <InvoiceModal inv={selectedInv} onClose={() => setSelectedInv(null)} onPaid={loadInvoices} />
      )}

      {/* Spinner animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
