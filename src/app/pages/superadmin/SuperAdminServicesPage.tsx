import { useState, useRef, useEffect } from 'react';
import {
  Search, Plus, Check, X, Edit2, ToggleLeft, ToggleRight,
  Stethoscope, Syringe, Scissors, Sparkles, FlaskConical,
  AlertTriangle, Pill, Microscope, Clock, DollarSign, Tag,
  ChevronDown, Save, Trash2, Copy,
} from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../../components/ui/select';
import { useTenantDb } from '../../context/TenantContext';
import { getOrgContext } from '../../hooks/useOrgContext';

// ─── Theme ────────────────────────────────────────────────────
const ACCENT   = '#F4A261';
const ACCENT_D = '#C2671A';
const ACCENT_BG = '#F4A26112';

// ─── Types ────────────────────────────────────────────────────
type Category =
  | 'Wellness'
  | 'Vaccinations'
  | 'Surgery'
  | 'Dental'
  | 'Lab & Imaging'
  | 'Emergency'
  | 'Prescriptions'
  | 'Specialist';

interface Service {
  id: string;
  name: string;
  category: Category;
  price: number;
  duration: number; // minutes
  description: string;
  active: boolean;
  popular: boolean;
  taxable: boolean;
  sku: string;
}

// ─── Category config ──────────────────────────────────────────
const CAT_CONFIG: Record<Category, { color: string; bg: string; icon: React.ElementType }> = {
  Wellness:       { color: 'var(--brand-green-text)', bg: 'color-mix(in srgb, var(--brand-green-text) 9%, transparent)', icon: Stethoscope   },
  Vaccinations:   { color: '#3B82F6',                 bg: '#3B82F618', icon: Syringe       },
  Surgery:        { color: '#EC4899',                 bg: '#EC489918', icon: Scissors      },
  Dental:         { color: '#06B6D4',                 bg: '#06B6D418', icon: Sparkles      },
  'Lab & Imaging':{ color: '#8B5CF6',                 bg: '#8B5CF618', icon: FlaskConical  },
  Emergency:      { color: '#EF4444',                 bg: '#EF444418', icon: AlertTriangle },
  Prescriptions:  { color: ACCENT,                    bg: ACCENT_BG,   icon: Pill          },
  Specialist:     { color: '#6B7280',                 bg: '#6B728018', icon: Microscope    },
};

const ALL_CATS: Category[] = [
  'Wellness', 'Vaccinations', 'Surgery', 'Dental',
  'Lab & Imaging', 'Emergency', 'Prescriptions', 'Specialist',
];

// ─── DB → local mapping helper ───────────────────────────────
function mapDbService(s: Record<string, unknown>): Service {
  return {
    id: s.id as string,
    name: s.name as string,
    category: s.category as Category,
    price: s.price as number,
    duration: s.duration_minutes as number,
    description: (s.description as string) || '',
    active: s.is_active as boolean,
    popular: s.is_popular as boolean,
    taxable: s.is_taxable as boolean,
    sku: (s.sku as string) || '',
  };
}

// ─── Add Service Form (default) ───────────────────────────────
const BLANK_SERVICE: Omit<Service, 'id'> = {
  name: '', category: 'Wellness', price: 0, duration: 30,
  description: '', active: true, popular: false, taxable: false, sku: '',
};

// ─── Category Badge ───────────────────────────────────────────
function CatBadge({ cat }: { cat: Category }) {
  const cfg = CAT_CONFIG[cat];
  const Icon = cfg.icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600, backgroundColor: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
      <Icon style={{ width: 11, height: 11 }} />
      {cat}
    </span>
  );
}

// ─── Inline price editor ──────────────────────────────────────
function PriceCell({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) ref.current?.select(); }, [editing]);

  function commit() {
    const n = parseFloat(draft);
    if (!isNaN(n) && n >= 0) onSave(Math.round(n * 100) / 100);
    setEditing(false);
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>$</span>
        <input
          ref={ref}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          style={{ width: '80px', fontSize: '14px', fontWeight: 700, color: ACCENT_D, border: `1.5px solid ${ACCENT}`, borderRadius: '6px', padding: '3px 6px', outline: 'none', backgroundColor: ACCENT_BG }}
        />
      </div>
    );
  }
  return (
    <button
      onClick={() => { setDraft(String(value)); setEditing(true); }}
      style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px', borderRadius: '6px' }}
      className="hover:bg-[var(--surface-elevated)] transition-colors group"
      title="Click to edit price"
    >
      <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>${value.toLocaleString()}</span>
      <Edit2 style={{ width: 11, height: 11, color: 'var(--text-secondary)', opacity: 0 }} className="group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ─── Add / Edit Drawer ────────────────────────────────────────
function ServiceDrawer({
  service, onSave, onClose,
}: {
  service: Service | null;
  onSave: (s: Service) => void;
  onClose: () => void;
}) {
  const isNew = !service;
  const [form, setForm] = useState<Omit<Service, 'id'>>(
    service ? { ...service } : { ...BLANK_SERVICE }
  );
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  function handleSubmit() {
    if (!form.name.trim() || form.price < 0) return;
    onSave({
      ...form,
      id: service?.id ?? `s${Date.now()}`,
      sku: form.sku || `CUSTOM-${Date.now()}`,
    });
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 40, backdropFilter: 'blur(2px)' }}
      />
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px', zIndex: 50,
        backgroundColor: 'var(--surface-white)', borderLeft: '1px solid var(--border-color)',
        display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
      }}>
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {isNew ? 'Add Service' : 'Edit Service'}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {isNew ? 'Create a new service or treatment' : `Editing ${service.sku}`}
            </p>
          </div>
          <button onClick={onClose} style={{ padding: '6px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--surface-elevated)', cursor: 'pointer' }}>
            <X style={{ width: 16, height: 16, color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Name */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>Service Name *</label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Annual Wellness Exam" />
          </div>
          {/* Category */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>Category *</label>
            <Select value={form.category} onValueChange={v => set('category', v as Category)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALL_CATS.map(c => (
                  <SelectItem key={c} value={c}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {(() => { const Icon = CAT_CONFIG[c].icon; return <Icon style={{ width: 14, height: 14, color: CAT_CONFIG[c].color }} />; })()}
                      {c}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Price + Duration */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>Price ($) *</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '14px' }}>$</span>
                <Input
                  type="number" min="0" step="0.01"
                  value={form.price}
                  onChange={e => set('price', parseFloat(e.target.value) || 0)}
                  style={{ paddingLeft: '24px' }}
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>Duration (min)</label>
              <Input
                type="number" min="0" step="5"
                value={form.duration}
                onChange={e => set('duration', parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
          {/* SKU */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>SKU / Code</label>
            <Input value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="e.g. WEL-001" />
          </div>
          {/* Description */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>Description</label>
            <Textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Describe what this service includes..."
              rows={3}
            />
          </div>
          {/* Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {([
              { key: 'active' as const,   label: 'Active',   desc: 'Service is bookable and shown on invoices' },
              { key: 'popular' as const,  label: 'Popular',  desc: 'Mark as a commonly requested service' },
              { key: 'taxable' as const,  label: 'Taxable',  desc: 'Apply sales tax to this service' },
            ] as const).map(t => (
              <div key={t.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '10px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-color)' }}>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{t.label}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t.desc}</p>
                </div>
                <button
                  onClick={() => set(t.key, !form[t.key])}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                >
                  {form[t.key]
                    ? <ToggleRight style={{ width: 28, height: 28, color: ACCENT }} />
                    : <ToggleLeft  style={{ width: 28, height: 28, color: 'var(--text-secondary)' }} />}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px', flexShrink: 0 }}>
          <Button variant="outline" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!form.name.trim()}
            style={{ flex: 2, backgroundColor: ACCENT, borderColor: ACCENT, gap: '6px' }}
          >
            <Save style={{ width: 14, height: 14 }} />
            {isNew ? 'Add Service' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function SuperAdminServicesPage() {
  const db = useTenantDb();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<Category | 'All'>('All');
  const [search, setSearch]       = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [drawerService, setDrawerService] = useState<Service | null | 'new'>(null);

  // ── Fetch from Supabase ──
  async function fetchServices() {
    setLoading(true);
    try {
      const { organizationId } = await getOrgContext();
      const { data, error } = await db
        .from('services')
        .select('*')
        .eq('organization_id', organizationId)
        .order('sort_order', { ascending: true });
      if (!error && data) {
        setServices(data.map(mapDbService));
      }
    } catch (e) {
      console.error('Failed to fetch services:', e);
    }
    setLoading(false);
  }

  useEffect(() => { fetchServices(); }, []);

  // ── Notify other components ──
  const dispatchChange = () => window.dispatchEvent(new CustomEvent('serviceDataChanged'));

  // ── CRUD helpers ──
  const updatePrice = async (id: string, price: number) => {
    setServices(prev => prev.map(s => s.id === id ? { ...s, price } : s));
    try {
      const { organizationId } = await getOrgContext();
      await db.from('services').update({ price }).eq('id', id).eq('organization_id', organizationId);
      dispatchChange();
    } catch (e) {
      console.error('Failed to update price:', e);
      fetchServices();
    }
  };

  const toggleActive = async (id: string) => {
    const svc = services.find(s => s.id === id);
    if (!svc) return;
    setServices(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s));
    try {
      const { organizationId } = await getOrgContext();
      await db.from('services').update({ is_active: !svc.active }).eq('id', id).eq('organization_id', organizationId);
      dispatchChange();
    } catch (e) {
      console.error('Failed to toggle active:', e);
      fetchServices();
    }
  };

  const saveService = async (svc: Service) => {
    // Optimistic local update
    setServices(prev => {
      const idx = prev.findIndex(s => s.id === svc.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = svc; return n; }
      return [svc, ...prev];
    });

    try {
      const { organizationId } = await getOrgContext();
      const isExisting = services.some(s => s.id === svc.id);

      if (isExisting) {
        // Update existing service
        await db.from('services').update({
          name: svc.name,
          category: svc.category,
          price: svc.price,
          duration_minutes: svc.duration,
          description: svc.description,
          is_active: svc.active,
          is_popular: svc.popular,
          is_taxable: svc.taxable,
          sku: svc.sku,
        }).eq('id', svc.id).eq('organization_id', organizationId);
      } else {
        // Insert new service
        const { data } = await db.from('services').insert({
          organization_id: organizationId,
          name: svc.name,
          category: svc.category,
          price: svc.price,
          duration_minutes: svc.duration,
          description: svc.description,
          is_active: svc.active,
          is_popular: svc.popular,
          is_taxable: svc.taxable,
          sku: svc.sku,
          sort_order: services.length,
        }).select().single();

        // Replace temp id with DB-generated id
        if (data) {
          setServices(prev => prev.map(s => s.id === svc.id ? mapDbService(data) : s));
        }
      }
      dispatchChange();
    } catch (e) {
      console.error('Failed to save service:', e);
      fetchServices();
    }
  };

  const deleteService = async (id: string) => {
    setServices(prev => prev.filter(s => s.id !== id));
    try {
      const { organizationId } = await getOrgContext();
      await db.from('services').delete().eq('id', id).eq('organization_id', organizationId);
      dispatchChange();
    } catch (e) {
      console.error('Failed to delete service:', e);
      fetchServices();
    }
  };

  const duplicateService = async (svc: Service) => {
    const newName = `${svc.name} (Copy)`;
    try {
      const { organizationId } = await getOrgContext();
      const { data } = await db.from('services').insert({
        organization_id: organizationId,
        name: newName,
        category: svc.category,
        price: svc.price,
        duration_minutes: svc.duration,
        description: svc.description,
        is_active: true,
        is_popular: false,
        is_taxable: svc.taxable,
        sku: '',
        sort_order: services.length,
      }).select().single();
      if (data) {
        const mapped = mapDbService(data);
        setServices(prev => {
          const idx = prev.findIndex(s => s.id === svc.id);
          const n = [...prev];
          n.splice(idx + 1, 0, mapped);
          return n;
        });
      }
      dispatchChange();
    } catch (e) {
      console.error('Failed to duplicate service:', e);
      fetchServices();
    }
  };

  const filtered = services.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.name.toLowerCase().includes(q) || s.sku.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
    const matchCat    = activeTab === 'All' || s.category === activeTab;
    const matchActive = showInactive || s.active;
    return matchSearch && matchCat && matchActive;
  });

  const totalActive  = services.filter(s => s.active).length;
  const avgPrice     = totalActive > 0 ? Math.round(services.filter(s => s.active).reduce((a, s) => a + s.price, 0) / totalActive) : 0;
  const highestPrice = [...services].sort((a, b) => b.price - a.price)[0];
  const popularCount = services.filter(s => s.popular && s.active).length;

  const catCounts = ALL_CATS.reduce((acc, cat) => {
    acc[cat] = services.filter(s => s.category === cat && (showInactive || s.active)).length;
    return acc;
  }, {} as Record<Category, number>);

  return (
    <div className="max-w-[1440px] mx-auto p-8">

      {/* ── Loading skeleton ── */}
      {loading && (
        <>
          {/* Header skeleton */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
            <div>
              <div style={{ width: '260px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--surface-elevated)', marginBottom: '8px' }} />
              <div style={{ width: '360px', height: '16px', borderRadius: '6px', backgroundColor: 'var(--surface-elevated)' }} />
            </div>
            <div style={{ width: '130px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--surface-elevated)' }} />
          </div>
          {/* KPI cards skeleton */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px 18px' }}>
                <div style={{ width: '80px', height: '11px', borderRadius: '4px', backgroundColor: 'var(--surface-elevated)', marginBottom: '14px' }} />
                <div style={{ width: '60px', height: '24px', borderRadius: '6px', backgroundColor: 'var(--surface-elevated)', marginBottom: '6px' }} />
                <div style={{ width: '100px', height: '12px', borderRadius: '4px', backgroundColor: 'var(--surface-elevated)' }} />
              </div>
            ))}
          </div>
          {/* Category tabs skeleton */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
            {[70, 90, 70, 60, 100, 85, 100, 80].map((w, i) => (
              <div key={i} style={{ width: `${w}px`, height: '34px', borderRadius: '9px', backgroundColor: 'var(--surface-elevated)' }} />
            ))}
          </div>
          {/* Table skeleton */}
          <div style={{ backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '11px 20px', backgroundColor: 'var(--surface-elevated)', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ width: '100%', height: '14px' }} />
            </div>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2.5fr 140px 100px 80px 70px 90px 100px', gap: '0', padding: '14px 20px', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ width: `${140 + (i % 3) * 40}px`, height: '14px', borderRadius: '4px', backgroundColor: 'var(--surface-elevated)', marginBottom: '6px' }} />
                  <div style={{ width: `${200 + (i % 2) * 60}px`, height: '12px', borderRadius: '4px', backgroundColor: 'var(--surface-elevated)' }} />
                </div>
                <div style={{ width: '80px', height: '22px', borderRadius: '9999px', backgroundColor: 'var(--surface-elevated)' }} />
                <div style={{ width: '50px', height: '14px', borderRadius: '4px', backgroundColor: 'var(--surface-elevated)' }} />
                <div style={{ width: '35px', height: '14px', borderRadius: '4px', backgroundColor: 'var(--surface-elevated)' }} />
                <div style={{ width: '25px', height: '14px', borderRadius: '4px', backgroundColor: 'var(--surface-elevated)' }} />
                <div style={{ width: '60px', height: '22px', borderRadius: '9999px', backgroundColor: 'var(--surface-elevated)' }} />
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[1, 2, 3].map(j => (
                    <div key={j} style={{ width: '25px', height: '25px', borderRadius: '6px', backgroundColor: 'var(--surface-elevated)' }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Header ── */}
      {!loading && (
      <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Services & Pricing
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>
            Manage all clinic services, treatments, and procedures with their prices.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Button
            onClick={() => setDrawerService('new')}
            style={{ backgroundColor: ACCENT, borderColor: ACCENT, gap: '6px' }}
          >
            <Plus style={{ width: 15, height: 15 }} /> Add Service
          </Button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Services',    value: `${totalActive}`,          sub: `${services.length - totalActive} inactive`, icon: Tag,         color: ACCENT      },
          { label: 'Average Price',     value: `$${avgPrice}`,            sub: 'across active services', icon: DollarSign,  color: '#4ADE80'   },
          { label: 'Highest Price',     value: `$${highestPrice?.price.toLocaleString() ?? 0}`, sub: highestPrice?.name ?? '', icon: Stethoscope, color: '#818CF8'   },
          { label: 'Popular Services',  value: `${popularCount}`,         sub: 'marked as popular', icon: Sparkles,    color: '#F472B6'   },
        ].map(s => (
          <div key={s.label} style={{ backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
              <div style={{ width: 30, height: 30, borderRadius: '8px', backgroundColor: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <s.icon style={{ width: 14, height: 14, color: s.color }} />
              </div>
            </div>
            <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>{s.value}</p>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Category Tabs ── */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {(['All', ...ALL_CATS] as (Category | 'All')[]).map(cat => {
          const isActive = activeTab === cat;
          const count    = cat === 'All' ? services.filter(s => showInactive || s.active).length : catCounts[cat as Category];
          const cfg      = cat === 'All' ? null : CAT_CONFIG[cat as Category];
          const Icon     = cfg?.icon;
          return (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '9px', border: '1px solid',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                backgroundColor: isActive ? (cfg ? cfg.bg : ACCENT_BG) : 'var(--surface-white)',
                borderColor:     isActive ? (cfg ? cfg.color : ACCENT)  : 'var(--border-color)',
                color:           isActive ? (cfg ? cfg.color : ACCENT_D) : 'var(--text-secondary)',
              }}
            >
              {Icon && <Icon style={{ width: 13, height: 13 }} />}
              {cat}
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '1px 6px', borderRadius: '9999px', backgroundColor: isActive ? (cfg ? cfg.color : ACCENT) : 'var(--surface-elevated)', color: isActive ? '#fff' : 'var(--text-secondary)' }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Search + Filters ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '340px' }}>
          <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-secondary)' }} />
          <Input
            placeholder="Search by name, SKU, or description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '32px' }}
          />
        </div>
        <button
          onClick={() => setShowInactive(!showInactive)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: showInactive ? '#6B728015' : 'var(--surface-white)', cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: showInactive ? 'var(--text-primary)' : 'var(--text-secondary)', transition: 'all 0.15s' }}
        >
          {showInactive ? <ToggleRight style={{ width: 16, height: 16, color: ACCENT }} /> : <ToggleLeft style={{ width: 16, height: 16 }} />}
          Show inactive
        </button>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
          {filtered.length} service{filtered.length !== 1 ? 's' : ''} shown
        </p>
      </div>

      {/* ── Services Table ── */}
      <div style={{ backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: '14px', overflow: 'hidden' }}>
        {/* Table Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 140px 100px 80px 70px 90px 100px', gap: '0', padding: '11px 20px', backgroundColor: 'var(--surface-elevated)', borderBottom: '1px solid var(--border-color)' }}>
          {['Service', 'Category', 'Price', 'Duration', 'Tax', 'Status', 'Actions'].map(h => (
            <span key={h} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div style={{ padding: '56px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
            No services match your filters.
          </div>
        ) : filtered.map((svc, i) => (
          <div
            key={svc.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '2.5fr 140px 100px 80px 70px 90px 100px',
              gap: '0', padding: '14px 20px', alignItems: 'center',
              borderBottom: i < filtered.length - 1 ? '1px solid var(--border-color)' : undefined,
              opacity: svc.active ? 1 : 0.55,
              backgroundColor: !svc.active ? 'var(--surface-elevated)' : undefined,
              transition: 'opacity 0.2s',
            }}
            className={svc.active ? 'hover:bg-[var(--surface-elevated)] transition-colors' : ''}
          >
            {/* Name + meta */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{svc.name}</span>
                {svc.popular && (
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 7px', borderRadius: '9999px', backgroundColor: '#F472B618', color: '#F472B6' }}>Popular</span>
                )}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{svc.description}</p>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{svc.sku}</span>
            </div>

            {/* Category */}
            <div><CatBadge cat={svc.category} /></div>

            {/* Price — inline editable */}
            <div>
              <PriceCell value={svc.price} onSave={v => updatePrice(svc.id, v)} />
            </div>

            {/* Duration */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {svc.duration > 0 ? (
                <>
                  <Clock style={{ width: 12, height: 12, color: 'var(--text-secondary)' }} />
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{svc.duration}m</span>
                </>
              ) : (
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>—</span>
              )}
            </div>

            {/* Tax */}
            <div>
              {svc.taxable
                ? <span style={{ fontSize: '12px', fontWeight: 600, color: '#3B82F6' }}>Yes</span>
                : <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>No</span>}
            </div>

            {/* Status toggle */}
            <div>
              <button
                onClick={() => toggleActive(svc.id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  padding: '4px 10px', borderRadius: '9999px', border: '1px solid',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                  backgroundColor: svc.active ? '#22C55E15' : '#6B728012',
                  borderColor:     svc.active ? '#22C55E40' : '#6B728030',
                  color:           svc.active ? '#16A34A'   : 'var(--text-secondary)',
                }}
              >
                {svc.active
                  ? <Check style={{ width: 10, height: 10 }} />
                  : <X     style={{ width: 10, height: 10 }} />}
                {svc.active ? 'Active' : 'Inactive'}
              </button>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => setDrawerService(svc)}
                title="Edit"
                style={{ padding: '5px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}
                className="hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Edit2 style={{ width: 13, height: 13 }} />
              </button>
              <button
                onClick={() => duplicateService(svc)}
                title="Duplicate"
                style={{ padding: '5px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}
                className="hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Copy style={{ width: 13, height: 13 }} />
              </button>
              <button
                onClick={() => deleteService(svc.id)}
                title="Delete"
                style={{ padding: '5px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', cursor: 'pointer', color: '#EF4444', display: 'flex' }}
                className="hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                <Trash2 style={{ width: 13, height: 13 }} />
              </button>
            </div>
          </div>
        ))}

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Showing {filtered.length} of {services.length} services · {services.filter(s => !s.active).length} inactive
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Price range:</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              ${filtered.length > 0 ? Math.min(...filtered.map(s => s.price)) : 0} – ${filtered.length > 0 ? Math.max(...filtered.map(s => s.price)).toLocaleString() : 0}
            </span>
          </div>
        </div>
      </div>

      </>
      )}

      {/* ── Drawer ── */}
      {drawerService !== null && (
        <ServiceDrawer
          service={drawerService === 'new' ? null : drawerService}
          onSave={saveService}
          onClose={() => setDrawerService(null)}
        />
      )}

    </div>
  );
}
