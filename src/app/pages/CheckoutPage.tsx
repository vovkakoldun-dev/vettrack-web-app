import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ArrowLeft, ChevronRight, Receipt, CheckCircle2, Lock,
  Plus, X, Search, Pill, Send, ClipboardCheck, User, Clock,
  AlertTriangle, CalendarClock,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../components/ui/select';
import { MOCK_APPOINTMENTS, MEDICATION_PRICE_LIST } from '../data/mockAppointments';
import type { Appointment as MockAppt } from '../data/mockAppointments';
import { useActiveVisit } from '../context/ActiveVisitContext';
import { useAppointmentStatus } from '../context/AppointmentStatusContext';
import { supabase } from '../../lib/supabase';
import { getOrgContext } from '../hooks/useOrgContext';

// ─── Types ───────────────────────────────────────────────────

type CheckoutItem = { id: number; service: string; qty: number; unitPrice: number };
type MedItem = { id: number; name: string; dosage: string; qty: number; unitPrice: number; category: string };

// ─── Medication Search Combobox ───────────────────────────────

function MedSearchInput({ value, onSelect }: { value: string; onSelect: (name: string, dosage: string, price: number, category: string) => void }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const results = query.length > 0
    ? MEDICATION_PRICE_LIST.filter((m) => m.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : MEDICATION_PRICE_LIST.slice(0, 8);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1 }}>
      <div style={{ position: 'relative' }}>
        <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-secondary)', pointerEvents: 'none' }} />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search medication…"
          style={{
            width: '100%', height: 36, paddingLeft: 32, paddingRight: 10,
            borderRadius: 8, border: '1px solid var(--border-color)',
            backgroundColor: 'var(--surface-white)', color: 'var(--text-primary)',
            fontSize: 13, outline: 'none',
          }}
        />
      </div>
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: 4,
          maxHeight: 280, overflowY: 'auto',
        }}>
          {results.map((med) => (
            <button
              key={med.name}
              onMouseDown={(e) => { e.preventDefault(); setQuery(med.name); onSelect(med.name, med.defaultDosage, med.price, med.category); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '8px 12px', textAlign: 'left',
                borderBottom: '1px solid var(--border-color)', cursor: 'pointer',
                backgroundColor: 'transparent', border: 'none',
              }}
              className="hover:bg-[var(--surface-elevated)] transition-colors"
            >
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{med.name}</p>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{med.category} · {med.defaultDosage}/{med.unit}</p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-green-text)', flexShrink: 0, marginLeft: 12 }}>
                ${med.price.toFixed(2)}/{med.unit}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────

const serviceColors: Record<string, string> = {
  'Annual Checkup': 'var(--brand-green-text)',
  Checkup: 'var(--brand-green-text)',
  Vaccination: '#3B82F6',
  'Dental Cleaning': '#8B5CF6',
  'Follow-up': '#F4A261',
  Emergency: '#d4183d',
  Surgery: '#EC4899',
  Other: 'var(--text-secondary)',
};

function getDurationMin(start: string, end: string): number {
  const toMin = (t: string) => {
    const [tp, ap] = t.split(' ');
    let [h, m] = tp.split(':').map(Number);
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  };
  return toMin(end) - toMin(start);
}

// ─── Component ───────────────────────────────────────────────

export default function CheckoutPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clearVisit } = useActiveVisit();
  const { setApptStatus } = useAppointmentStatus();

  const mockAppt = MOCK_APPOINTMENTS.find((a) => String(a.id) === id);
  const [realAppt, setRealAppt] = useState<MockAppt | null>(null);
  const [loadingAppt, setLoadingAppt] = useState(!mockAppt);
  const [apptIds, setApptIds] = useState<{ petId?: string; clientId?: string; staffId?: string }>({});

  useEffect(() => {
    if (mockAppt || !id) return;
    (async () => {
      setLoadingAppt(true);
      const { data } = await supabase
        .from('appointments')
        .select('id, scheduled_at, duration_minutes, status, reason, notes, pets(id, name, species, breed, photo_url), clients(id, first_name, last_name), staff!appointments_vet_id_fkey(id, profiles:profiles!staff_profile_id_fkey(first_name, last_name))')
        .eq('id', id)
        .single();
      if (data) {
        const start = new Date(data.scheduled_at);
        const end = new Date(start.getTime() + (data.duration_minutes ?? 30) * 60000);
        const fmt = (d: Date) => {
          let h = d.getUTCHours();
          const m = d.getUTCMinutes();
          const ampm = h >= 12 ? 'PM' : 'AM';
          if (h > 12) h -= 12;
          if (h === 0) h = 12;
          return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
        };
        const y = start.getFullYear();
        const mo = (start.getMonth() + 1).toString().padStart(2, '0');
        const da = start.getDate().toString().padStart(2, '0');
        setRealAppt({
          id: 0,
          date: `${y}-${mo}-${da}`,
          timeStart: fmt(start),
          timeEnd: fmt(end),
          petName: data.pets?.name ?? '—',
          petImage: data.pets?.photo_url ?? '',
          ownerName: data.clients ? `${data.clients.first_name} ${data.clients.last_name}` : '—',
          species: data.pets?.species ?? '—',
          service: data.reason ?? '—',
          vet: (data as any).staff?.profiles ? `Dr. ${(data as any).staff.profiles.first_name} ${(data as any).staff.profiles.last_name}` : '—',
          status: (data.status as any) ?? 'In Progress',
          notes: data.notes ?? '',
        });
        setApptIds({
          petId: data.pets?.id,
          clientId: data.clients?.id,
          staffId: data.staff?.id,
        });
      }
      setLoadingAppt(false);
    })();
  }, [id, mockAppt]);

  const appt = mockAppt || realAppt;

  // ── Saved checkout draft (sessionStorage) ────────────────────
  const checkoutDraftKey = `checkout_draft_${id}`;
  const savedCheckoutDraft = useRef<Record<string, any> | null>(null);
  if (savedCheckoutDraft.current === null) {
    try {
      const raw = sessionStorage.getItem(checkoutDraftKey);
      savedCheckoutDraft.current = raw ? JSON.parse(raw) : {};
    } catch { savedCheckoutDraft.current = {}; }
  }
  const ckDraft = savedCheckoutDraft.current!;

  // ── State (restored from draft if available) ────────────────
  const [items, setItems] = useState<CheckoutItem[]>(
    ckDraft.items ?? [{ id: 1, service: 'Office Visit / Consultation', qty: 1, unitPrice: 65 }]
  );
  const [nextItemId, setNextItemId] = useState(ckDraft.nextItemId ?? 2);
  const [meds, setMeds] = useState<MedItem[]>(ckDraft.meds ?? []);
  const [nextMedId, setNextMedId] = useState(ckDraft.nextMedId ?? 1);
  const [serviceList, setServiceList] = useState<{ name: string; price: number }[]>([]);

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

    // Re-fetch when services are changed in the admin
    const handler = () => { fetchServices(); };
    window.addEventListener('serviceDataChanged', handler);
    return () => window.removeEventListener('serviceDataChanged', handler);
  }, []);
  const [completed, setCompleted] = useState(false);
  const [petHealthStatus, setPetHealthStatus] = useState<'Healthy' | 'Follow-up' | 'Critical'>(ckDraft.petHealthStatus ?? 'Healthy');

  // ── Auto-save checkout draft ────────────────────────────────
  const ckSaveRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (ckSaveRef.current) clearTimeout(ckSaveRef.current);
    ckSaveRef.current = setTimeout(() => {
      try {
        sessionStorage.setItem(checkoutDraftKey, JSON.stringify({
          items, nextItemId, meds, nextMedId, petHealthStatus,
        }));
      } catch {}
    }, 500);
    return () => { if (ckSaveRef.current) clearTimeout(ckSaveRef.current); };
  }, [checkoutDraftKey, items, nextItemId, meds, nextMedId, petHealthStatus]);

  if (loadingAppt) {
    return (
      <div className="max-w-[960px] mx-auto p-8 text-center">
        <p className="text-[var(--text-secondary)]" style={{ fontSize: '16px' }}>Loading checkout...</p>
      </div>
    );
  }

  if (!appt) {
    return (
      <div className="max-w-[960px] mx-auto p-8">
        <div
          className="bg-[var(--surface-white)] border border-[var(--border-color)] p-12 text-center"
          style={{ borderRadius: '12px' }}
        >
          <p className="text-[var(--text-primary)] mb-4" style={{ fontSize: '20px', fontWeight: 600 }}>
            Appointment not found
          </p>
          <Button variant="outline" onClick={() => navigate('/appointments')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Appointments
          </Button>
        </div>
      </div>
    );
  }

  const durationMin = getDurationMin(appt.timeStart, appt.timeEnd);
  const svcColor = serviceColors[appt.service] || serviceColors.Other;

  // Med helpers
  const addMed = () => {
    setMeds((prev) => [...prev, { id: nextMedId, name: '', dosage: '', qty: 1, unitPrice: 0, category: '' }]);
    setNextMedId((n) => n + 1);
  };
  const removeMed = (medId: number) => setMeds((prev) => prev.filter((m) => m.id !== medId));
  const updateMed = (medId: number, field: keyof MedItem, val: string | number) =>
    setMeds((prev) => prev.map((m) => m.id === medId ? { ...m, [field]: val } : m));
  const selectMedPreset = (medId: number, name: string, dosage: string, price: number, category: string) =>
    setMeds((prev) => prev.map((m) => m.id === medId ? { ...m, name, dosage, unitPrice: price, category } : m));

  // Invoice calculations
  const servicesSubtotal = items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);
  const medsSubtotal = meds.reduce((sum, m) => sum + m.qty * m.unitPrice, 0);
  const subtotal = servicesSubtotal + medsSubtotal;
  const tax = parseFloat((subtotal * 0.08).toFixed(2));
  const total = subtotal + tax;

  const addItem = () => {
    if (serviceList.length === 0) return;
    const first = serviceList[0];
    setItems((prev) => [...prev, { id: nextItemId, service: first.name, qty: 1, unitPrice: first.price }]);
    setNextItemId((n) => n + 1);
  };

  const removeItem = (itemId: number) => setItems((prev) => prev.filter((i) => i.id !== itemId));

  const updateService = (itemId: number, serviceName: string) => {
    const preset = serviceList.find((p) => p.name === serviceName);
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, service: serviceName, unitPrice: preset?.price ?? i.unitPrice }
          : i
      )
    );
  };

  const updateQty = (itemId: number, qty: number) => {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, qty: Math.max(1, qty) } : i)));
  };

  return (
    <div style={{ minHeight: '100%', backgroundColor: 'var(--bg-offwhite)', display: 'flex', flexDirection: 'column' }}>
      {/* ─── Header ─────────────────────────────────────── */}
      <div
        className="bg-[var(--surface-white)] border-b border-[var(--border-color)] sticky top-0 z-10"
        style={{ padding: '16px 32px' }}
      >
        <div className="max-w-[960px] mx-auto flex items-center gap-4">
          {/* Left: back + title */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => navigate(`/appointments/${id}/visit`)}
              className="p-2 hover:bg-[var(--surface-elevated)] transition-colors flex-shrink-0"
              style={{ borderRadius: '8px' }}
            >
              <ArrowLeft className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
            <Receipt className="w-5 h-5 text-[var(--brand-green-text)] flex-shrink-0" />
            <span className="text-[var(--text-primary)]" style={{ fontSize: '18px', fontWeight: 700 }}>
              Checkout
            </span>
          </div>

          {/* Center: step breadcrumb */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => navigate(`/appointments/${id}/visit`)}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--surface-elevated)] transition-colors"
              style={{ borderRadius: '8px' }}
            >
              <div
                style={{
                  width: 20, height: 20, borderRadius: '50%',
                  backgroundColor: '#74C69D',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <CheckCircle2 style={{ width: 12, height: 12, color: 'white' }} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--brand-green-text)' }}>Visit Notes</span>
            </button>
            <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
            <div
              className="flex items-center gap-2 px-3 py-1.5"
              style={{ borderRadius: '8px', backgroundColor: '#2D6A4F18' }}
            >
              <div
                style={{
                  width: 20, height: 20, borderRadius: '50%',
                  backgroundColor: '#2D6A4F',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 700, color: '#fff',
                  flexShrink: 0,
                }}
              >2</div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Checkout</span>
            </div>
          </div>

          {/* Right: date/time */}
          <div className="text-right flex-shrink-0">
            <p className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>
              {new Date(appt.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
            <p className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>
              {appt.timeStart} – {appt.timeEnd} · {durationMin} min
            </p>
          </div>
        </div>
      </div>

      {/* ─── Body ────────────────────────────────────────── */}
      <div className="max-w-[960px] mx-auto p-8 space-y-6">

        {/* ── Patient + Invoice Summary Card ── */}
        <div
          className="bg-[var(--surface-white)] border border-[var(--border-color)] p-5"
          style={{ borderRadius: '12px' }}
        >
          <div className="grid grid-cols-2 gap-6">
            {/* Left: patient info */}
            <div className="flex items-start gap-4">
              <Avatar className="w-14 h-14 flex-shrink-0">
                <AvatarImage src={appt.petImage} alt={appt.petName} className="object-cover" />
                <AvatarFallback style={{ fontSize: '18px', fontWeight: 700 }}>{appt.petName.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-[var(--text-primary)]" style={{ fontSize: '20px', fontWeight: 700 }}>{appt.petName}</p>
                <p className="text-[var(--text-secondary)]" style={{ fontSize: '13px', marginBottom: '8px' }}>
                  {appt.species} · {appt.ownerName}
                </p>
                <span
                  className="inline-block px-2.5 py-1 mr-2"
                  style={{
                    backgroundColor: svcColor + '18',
                    color: svcColor,
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {appt.service}
                </span>
                <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{appt.vet}</span>
              </div>
            </div>

            {/* Right: running total */}
            <div
              className="flex flex-col items-end justify-center p-4"
              style={{
                borderRadius: '10px',
                backgroundColor: '#2D6A4F08',
                border: '1.5px solid #2D6A4F25',
              }}
            >
              <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Invoice Total
              </p>
              <p style={{ fontSize: '34px', fontWeight: 800, color: 'var(--brand-green-text)', lineHeight: 1 }}>
                ${total.toFixed(2)}
              </p>
              <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '12px' }}>
                incl. tax ({subtotal > 0 ? `$${tax.toFixed(2)}` : '—'})
              </p>
            </div>
          </div>
        </div>

        {/* ── Services Rendered ── */}
        <div
          className="bg-[var(--surface-white)] border border-[var(--border-color)]"
          style={{ borderRadius: '12px', overflow: 'hidden' }}
        >
          {/* Section header */}
          <div
            className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]"
            style={{ backgroundColor: 'var(--surface-elevated)' }}
          >
            <div>
              <p className="text-[var(--text-primary)]" style={{ fontSize: '15px', fontWeight: 600 }}>Services & Treatments</p>
              <p className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>Add all services provided during this visit</p>
            </div>
            <button
              onClick={addItem}
              className="flex items-center gap-1.5 px-3 py-1.5 transition-colors hover:opacity-80"
              style={{
                borderRadius: '8px',
                border: '1.5px solid #2D6A4F',
                backgroundColor: '#2D6A4F10',
                color: 'var(--brand-green-text)',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              <Plus className="w-3.5 h-3.5" /> Add Service
            </button>
          </div>

          <div className="p-6">
            {/* Table header */}
            <div className="grid gap-3 px-2 mb-2" style={{ gridTemplateColumns: '3fr 70px 130px 90px 36px' }}>
              {['Service', 'Qty', 'Unit Price', 'Total', ''].map((h) => (
                <span key={h} className="text-[var(--text-secondary)]" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {h}
                </span>
              ))}
            </div>

            {/* Rows */}
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-3 items-center p-2 bg-[var(--surface-elevated)]"
                  style={{ gridTemplateColumns: '3fr 70px 130px 90px 36px', borderRadius: '8px' }}
                >
                  {/* Service selector */}
                  <Select value={item.service} onValueChange={(v) => updateService(item.id, v)}>
                    <SelectTrigger style={{ fontSize: '13px', height: '36px', borderRadius: '8px' }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceList.map((p) => (
                        <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Qty */}
                  <Input
                    type="number"
                    min={1}
                    value={item.qty}
                    onChange={(e) => updateQty(item.id, parseInt(e.target.value) || 1)}
                    style={{ fontSize: '13px', height: '36px', textAlign: 'center', borderRadius: '8px' }}
                  />

                  {/* Unit price — read-only */}
                  <div
                    className="flex items-center gap-1.5 px-3 h-9"
                    style={{
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--surface-white)',
                      cursor: 'not-allowed',
                    }}
                    title="Price set by administrator"
                  >
                    <Lock className="w-3 h-3 text-[var(--text-secondary)] flex-shrink-0" />
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      ${item.unitPrice.toFixed(2)}
                    </span>
                  </div>

                  {/* Total */}
                  <span className="text-right" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    ${(item.qty * item.unitPrice).toFixed(2)}
                  </span>

                  {/* Remove */}
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-1.5 text-[var(--text-secondary)] hover:text-[#d4183d] transition-colors flex items-center justify-center"
                    style={{ borderRadius: '6px' }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Medications Dispensed ── */}
        <div
          className="bg-[var(--surface-white)] border border-[var(--border-color)]"
          style={{ borderRadius: '12px', overflow: 'hidden' }}
        >
          <div
            className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]"
            style={{ backgroundColor: 'var(--surface-elevated)' }}
          >
            <div className="flex items-center gap-2">
              <Pill className="w-4 h-4 text-[#8B5CF6]" />
              <div>
                <p className="text-[var(--text-primary)]" style={{ fontSize: '15px', fontWeight: 600 }}>Medications Dispensed</p>
                <p className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>Search and add medications given during this visit</p>
              </div>
            </div>
            <button
              onClick={addMed}
              className="flex items-center gap-1.5 px-3 py-1.5 transition-colors hover:opacity-80"
              style={{
                borderRadius: '8px',
                border: '1.5px solid #8B5CF6',
                backgroundColor: '#8B5CF610',
                color: '#8B5CF6',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              <Plus className="w-3.5 h-3.5" /> Add Medication
            </button>
          </div>

          <div className="p-6">
            {meds.length === 0 ? (
              <div className="text-center py-8">
                <Pill className="w-8 h-8 mx-auto mb-2 text-[var(--border-color)]" />
                <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>No medications added yet</p>
                <p className="text-[var(--text-secondary)]" style={{ fontSize: '12px', marginTop: 4 }}>Click "Add Medication" to search and add dispensed medications</p>
              </div>
            ) : (
              <>
                {/* Table header */}
                <div className="grid gap-3 px-2 mb-2" style={{ gridTemplateColumns: '3fr 140px 70px 130px 90px 36px' }}>
                  {['Medication', 'Dosage', 'Qty', 'Unit Price', 'Total', ''].map((h) => (
                    <span key={h} className="text-[var(--text-secondary)]" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {h}
                    </span>
                  ))}
                </div>
                <div className="space-y-2">
                  {meds.map((med) => (
                    <div
                      key={med.id}
                      className="grid gap-3 items-center p-2 bg-[var(--surface-elevated)]"
                      style={{ gridTemplateColumns: '3fr 140px 70px 130px 90px 36px', borderRadius: '8px' }}
                    >
                      {/* Medication search */}
                      <MedSearchInput
                        value={med.name}
                        onSelect={(name, dosage, price, category) => selectMedPreset(med.id, name, dosage, price, category)}
                      />

                      {/* Dosage */}
                      <Input
                        placeholder="e.g. 250mg"
                        value={med.dosage}
                        onChange={(e) => updateMed(med.id, 'dosage', e.target.value)}
                        style={{ fontSize: '13px', height: '36px', borderRadius: '8px' }}
                      />

                      {/* Qty */}
                      <Input
                        type="number"
                        min={1}
                        value={med.qty}
                        onChange={(e) => updateMed(med.id, 'qty', parseInt(e.target.value) || 1)}
                        style={{ fontSize: '13px', height: '36px', textAlign: 'center', borderRadius: '8px' }}
                      />

                      {/* Unit price — read-only */}
                      <div
                        className="flex items-center gap-1.5 px-3 h-9"
                        style={{
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--surface-white)',
                          cursor: 'not-allowed',
                        }}
                        title="Price set by administrator"
                      >
                        <Lock className="w-3 h-3 text-[var(--text-secondary)] flex-shrink-0" />
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                          {med.unitPrice > 0 ? `$${med.unitPrice.toFixed(2)}` : '—'}
                        </span>
                      </div>

                      {/* Total */}
                      <span className="text-right" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {med.unitPrice > 0 ? `$${(med.qty * med.unitPrice).toFixed(2)}` : '—'}
                      </span>

                      {/* Remove */}
                      <button
                        onClick={() => removeMed(med.id)}
                        className="p-1.5 text-[var(--text-secondary)] hover:text-[#d4183d] transition-colors flex items-center justify-center"
                        style={{ borderRadius: '6px' }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Invoice Summary ── */}
        <div
          className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6"
          style={{ borderRadius: '12px' }}
        >
          <p className="text-[var(--text-primary)] mb-4" style={{ fontSize: '15px', fontWeight: 600 }}>Invoice Summary</p>
          <div className="ml-auto" style={{ maxWidth: '340px' }}>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Services</span>
                <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 500 }}>
                  ${servicesSubtotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Medications</span>
                <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 500 }}>
                  {medsSubtotal > 0 ? `$${medsSubtotal.toFixed(2)}` : '—'}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[var(--border-color)]">
                <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Subtotal</span>
                <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Tax (8%)</span>
                <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 500 }}>
                  {subtotal === 0 ? '—' : `$${tax.toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between pt-3 border-t border-[var(--border-color)]">
                <span className="text-[var(--text-primary)]" style={{ fontSize: '16px', fontWeight: 700 }}>Total</span>
                <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--brand-green-text)' }}>
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Pet Health Status Update ── */}
        <div
          className="bg-[var(--surface-white)] border border-[var(--border-color)]"
          style={{ borderRadius: '12px', overflow: 'hidden' }}
        >
          <div
            className="flex items-center gap-3 px-6 py-4 border-b border-[var(--border-color)]"
            style={{ backgroundColor: 'var(--surface-elevated)' }}
          >
            <div
              style={{
                width: 34, height: 34, borderRadius: '9px',
                backgroundColor: petHealthStatus === 'Healthy' ? '#2D6A4F15' : petHealthStatus === 'Critical' ? '#d4183d15' : '#F4A26115',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              {petHealthStatus === 'Healthy' && <CheckCircle2 style={{ width: 17, height: 17, color: '#2D6A4F' }} />}
              {petHealthStatus === 'Follow-up' && <CalendarClock style={{ width: 17, height: 17, color: '#F4A261' }} />}
              {petHealthStatus === 'Critical' && <AlertTriangle style={{ width: 17, height: 17, color: '#d4183d' }} />}
            </div>
            <div>
              <p className="text-[var(--text-primary)]" style={{ fontSize: '15px', fontWeight: 600 }}>Update Pet Health Status</p>
              <p className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>Set {appt.petName}'s current health status based on today's visit</p>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-3 gap-3">
              {([
                { value: 'Healthy' as const,   color: '#2D6A4F', bg: '#2D6A4F', label: 'Healthy',   desc: 'No concerns, all clear', emoji: '✅' },
                { value: 'Follow-up' as const, color: '#F4A261', bg: '#F4A261', label: 'Follow-up',  desc: 'Needs another visit',    emoji: '🔔' },
                { value: 'Critical' as const,  color: '#d4183d', bg: '#d4183d', label: 'Critical',   desc: 'Urgent attention needed', emoji: '🚨' },
              ]).map((opt) => {
                const active = petHealthStatus === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setPetHealthStatus(opt.value)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      padding: '16px 12px', borderRadius: '10px', cursor: 'pointer',
                      border: `2px solid ${active ? opt.color : 'var(--border-color)'}`,
                      backgroundColor: active ? `${opt.bg}12` : 'var(--surface-elevated)',
                      transition: 'all 0.15s', gap: '6px',
                    }}
                  >
                    <span style={{ fontSize: '22px' }}>{opt.emoji}</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: active ? opt.color : 'var(--text-primary)' }}>
                      {opt.label}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.3 }}>
                      {opt.desc}
                    </span>
                    {active && (
                      <span
                        style={{
                          fontSize: '10px', fontWeight: 700, color: opt.color,
                          backgroundColor: `${opt.bg}18`, padding: '2px 8px', borderRadius: '999px', marginTop: 2,
                        }}
                      >
                        SELECTED
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Reception Notice ── */}
        <div
          className="flex items-start gap-4 p-5 bg-[#FFF7ED] dark:bg-[#F4A26110] border-[1.5px] border-[#F4A26130] dark:border-[#F4A26130]"
          style={{ borderRadius: '12px' }}
        >
          <div
            className="flex-shrink-0 flex items-center justify-center bg-[#F4A26120] dark:bg-[#F4A26118]"
            style={{ width: 38, height: 38, borderRadius: '10px' }}
          >
            <User style={{ width: 18, height: 18, color: '#F4A261' }} />
          </div>
          <div>
            <p className="text-[#92400E] dark:text-[#FBD38D]" style={{ fontSize: '14px', fontWeight: 600, marginBottom: 4 }}>
              Payment is handled at the front desk
            </p>
            <p className="text-[#B45309] dark:text-[#F6AD55]" style={{ fontSize: '13px', lineHeight: 1.5 }}>
              When you complete this visit, the invoice summary will be sent to reception.
              The client will be directed to pay at the front desk. No payment is collected here.
            </p>
          </div>
        </div>

      </div>

      {/* ─── Sticky Footer ────────────────────────────────── */}
      <div
        className="sticky bottom-0 bg-[var(--surface-white)] border-t border-[var(--border-color)] mt-auto"
        style={{ padding: '14px 32px', zIndex: 20 }}
      >
        <div className="max-w-[960px] mx-auto flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate(`/appointments/${id}/visit`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Visit Notes
          </Button>
          <Button
            onClick={async () => {
              clearVisit();
              // Clear visit notes draft
              try { sessionStorage.removeItem(`visit_draft_${id}`); } catch {}
              try { sessionStorage.removeItem(`checkout_draft_${id}`); } catch {}
              setApptStatus(parseInt(id!) || 0, 'Ready for Billing');
              const { organizationId } = await getOrgContext();
              // Update Supabase status for real appointments
              if (id && id.includes('-')) {
                await supabase.from('appointments').update({ status: 'Completed' }).eq('id', id).eq('organization_id', organizationId);
              }

              // Persist pet health status to client profile
              if (apptIds.clientId) {
                await supabase.from('clients').update({ health_status: petHealthStatus }).eq('id', apptIds.clientId).eq('organization_id', organizationId);
              }

              // Create a "Ready for Billing" front-desk task
              if (appt) {
                try {
                  const today = new Date().toISOString().split('T')[0];
                  const totalServices = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
                  const totalMeds = meds.reduce((s, m) => s + m.qty * m.unitPrice, 0);
                  const grandTotal = totalServices + totalMeds;
                  await supabase.from('tasks').insert({
                    type: 'Owner Notification',
                    priority: 'High',
                    status: 'Pending',
                    due_date: today,
                    due_time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
                    pet_id: apptIds.petId || null,
                    client_id: apptIds.clientId || null,
                    assigned_by_id: apptIds.staffId || null,
                    visit_date: today,
                    doctor_notes: `Visit completed. Invoice total: $${grandTotal.toFixed(2)} (Services: $${totalServices.toFixed(2)}, Medications: $${totalMeds.toFixed(2)}). Please process payment at the front desk. Health status: ${petHealthStatus}.`,
                    tags: ['Billing', 'Visit Complete'],
                    organization_id: organizationId,
                  });
                  window.dispatchEvent(new Event('notifCountChanged'));
                } catch {}
              }

              setCompleted(true);
            }}
            style={{ backgroundColor: '#2D6A4F', color: '#fff', border: 'none', gap: '8px' }}
            className="hover:opacity-90"
          >
            <Send className="w-4 h-4" />
            Complete Visit &amp; Send to Reception
          </Button>
        </div>
      </div>

      {/* ─── Completion Overlay ────────────────────────────── */}
      {completed && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="bg-[var(--surface-white)] p-8 max-w-[480px] w-full mx-4"
            style={{ borderRadius: '16px', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}
          >
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div
                style={{
                  width: 72, height: 72, borderRadius: '50%',
                  backgroundColor: '#2D6A4F15',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ClipboardCheck style={{ width: 36, height: 36, color: '#2D6A4F' }} />
              </div>
            </div>

            {/* Title */}
            <p className="text-center text-[var(--text-primary)] mb-1" style={{ fontSize: '22px', fontWeight: 800 }}>
              Visit Complete!
            </p>
            <p className="text-center text-[var(--text-secondary)] mb-6" style={{ fontSize: '14px' }}>
              The visit has been recorded and the invoice was sent to reception.
            </p>

            {/* Summary strip */}
            <div
              className="flex items-center justify-between p-4 mb-6"
              style={{
                borderRadius: '10px',
                backgroundColor: 'var(--surface-elevated)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 flex-shrink-0">
                  <AvatarImage src={appt.petImage} alt={appt.petName} className="object-cover" />
                  <AvatarFallback style={{ fontSize: '14px', fontWeight: 700 }}>{appt.petName.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{appt.petName}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{appt.ownerName}</p>
                </div>
              </div>
              <div className="text-right">
                <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--brand-green-text)' }}>${total.toFixed(2)}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>invoice total</p>
              </div>
            </div>

            {/* Info rows */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 p-3" style={{ borderRadius: '8px', backgroundColor: '#2D6A4F08', border: '1px solid #2D6A4F20' }}>
                <Send style={{ width: 16, height: 16, color: '#2D6A4F', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Sent to Reception</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Front desk has the invoice — client will pay there</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3" style={{ borderRadius: '8px', backgroundColor: '#3B82F608', border: '1px solid #3B82F620' }}>
                <ClipboardCheck style={{ width: 16, height: 16, color: '#3B82F6', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Pet Record Updated</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Visit notes, diagnoses & medications saved · Status set to{' '}
                    <span style={{
                      fontWeight: 700,
                      color: petHealthStatus === 'Healthy' ? '#2D6A4F' : petHealthStatus === 'Critical' ? '#d4183d' : '#F4A261',
                    }}>
                      {petHealthStatus}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3" style={{ borderRadius: '8px', backgroundColor: '#F4A26108', border: '1px solid #F4A26120' }}>
                <Clock style={{ width: 16, height: 16, color: '#F4A261', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Appointment Closed</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Status set to Completed · {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate(`/clients`)}
              >
                View Client Record
              </Button>
              <Button
                className="flex-1"
                style={{ backgroundColor: '#2D6A4F', color: '#fff', border: 'none' }}
                onClick={() => navigate('/appointments')}
              >
                Back to Appointments
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
