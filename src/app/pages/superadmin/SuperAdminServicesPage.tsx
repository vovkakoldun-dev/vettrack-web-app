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
  Wellness:       { color: 'var(--brand-green-text)', bg: '#2D6A4F18', icon: Stethoscope   },
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

// ─── Mock Data ────────────────────────────────────────────────
const INITIAL_SERVICES: Service[] = [
  // Wellness
  { id: 's001', name: 'Annual Wellness Exam',         category: 'Wellness',      price: 85,   duration: 30, description: 'Comprehensive physical exam including weight, temperature, heart & lung auscultation, and full body assessment.', active: true,  popular: true,  taxable: false, sku: 'WEL-001' },
  { id: 's002', name: 'Puppy/Kitten Wellness Exam',   category: 'Wellness',      price: 75,   duration: 30, description: 'Initial health check for puppies and kittens under 6 months, includes parasite screening.', active: true,  popular: true,  taxable: false, sku: 'WEL-002' },
  { id: 's003', name: 'Senior Wellness Package',      category: 'Wellness',      price: 145,  duration: 45, description: 'Comprehensive exam for pets 7+ years including blood panel, urinalysis, and blood pressure.', active: true,  popular: false, taxable: false, sku: 'WEL-003' },
  { id: 's004', name: 'Progress/Recheck Exam',        category: 'Wellness',      price: 55,   duration: 20, description: 'Follow-up visit to assess response to treatment or monitor a diagnosed condition.', active: true,  popular: false, taxable: false, sku: 'WEL-004' },
  { id: 's005', name: 'Nutrition Consultation',       category: 'Wellness',      price: 65,   duration: 30, description: 'Dietary assessment and personalized nutrition plan for weight management or health conditions.', active: true,  popular: false, taxable: false, sku: 'WEL-005' },

  // Vaccinations
  { id: 's010', name: 'Rabies Vaccine (1-year)',      category: 'Vaccinations',  price: 28,   duration: 10, description: 'USDA-licensed killed-virus rabies vaccine. Required by law in most states.', active: true,  popular: true,  taxable: true,  sku: 'VAC-001' },
  { id: 's011', name: 'Rabies Vaccine (3-year)',      category: 'Vaccinations',  price: 32,   duration: 10, description: '3-year approved rabies vaccination for dogs and cats.', active: true,  popular: true,  taxable: true,  sku: 'VAC-002' },
  { id: 's012', name: 'DHPP (Dog Core Combo)',        category: 'Vaccinations',  price: 38,   duration: 10, description: 'Distemper, Hepatitis, Parvovirus, and Parainfluenza combination vaccine.', active: true,  popular: true,  taxable: true,  sku: 'VAC-003' },
  { id: 's013', name: 'Bordetella (Kennel Cough)',    category: 'Vaccinations',  price: 24,   duration: 10, description: 'Intranasal Bordetella bronchiseptica vaccine. Required for boarding and grooming.', active: true,  popular: false, taxable: true,  sku: 'VAC-004' },
  { id: 's014', name: 'FVRCP (Cat Core Combo)',       category: 'Vaccinations',  price: 34,   duration: 10, description: 'Feline Viral Rhinotracheitis, Calicivirus, and Panleukopenia combination.', active: true,  popular: true,  taxable: true,  sku: 'VAC-005' },
  { id: 's015', name: 'Feline Leukemia (FeLV)',       category: 'Vaccinations',  price: 36,   duration: 10, description: 'Annual FeLV vaccine for cats at risk of outdoor exposure.', active: true,  popular: false, taxable: true,  sku: 'VAC-006' },
  { id: 's016', name: 'Leptospirosis',                category: 'Vaccinations',  price: 30,   duration: 10, description: 'Protection against Leptospira bacteria. Recommended for dogs with outdoor exposure.', active: true,  popular: false, taxable: true,  sku: 'VAC-007' },
  { id: 's017', name: 'Lyme Disease',                 category: 'Vaccinations',  price: 34,   duration: 10, description: 'Recommended for dogs in tick-endemic regions or with outdoor lifestyle.', active: false, popular: false, taxable: true,  sku: 'VAC-008' },

  // Surgery
  { id: 's020', name: 'Spay — Cat',                  category: 'Surgery',       price: 320,  duration: 90, description: 'Ovariohysterectomy for female cats. Includes pre-anesthetic bloodwork and IV catheter.', active: true,  popular: true,  taxable: false, sku: 'SUR-001' },
  { id: 's021', name: 'Neuter — Cat',                category: 'Surgery',       price: 240,  duration: 60, description: 'Orchiectomy for male cats. Includes anesthesia and post-op monitoring.', active: true,  popular: true,  taxable: false, sku: 'SUR-002' },
  { id: 's022', name: 'Spay — Dog (Small, <20 lbs)', category: 'Surgery',       price: 420,  duration: 90, description: 'Ovariohysterectomy for small dogs. Includes complete surgical pack.', active: true,  popular: true,  taxable: false, sku: 'SUR-003' },
  { id: 's023', name: 'Spay — Dog (Med, 20–50 lbs)', category: 'Surgery',       price: 520,  duration: 120,description: 'Ovariohysterectomy for medium-sized dogs.', active: true,  popular: false, taxable: false, sku: 'SUR-004' },
  { id: 's024', name: 'Spay — Dog (Large, >50 lbs)', category: 'Surgery',       price: 640,  duration: 150,description: 'Ovariohysterectomy for large/giant breed dogs.', active: true,  popular: false, taxable: false, sku: 'SUR-005' },
  { id: 's025', name: 'Neuter — Dog (Small)',        category: 'Surgery',       price: 340,  duration: 60, description: 'Orchiectomy for small dogs under 20 lbs.', active: true,  popular: false, taxable: false, sku: 'SUR-006' },
  { id: 's026', name: 'TPLO (Cruciate Repair)',      category: 'Surgery',       price: 2800, duration: 180,description: 'Tibial Plateau Leveling Osteotomy for cranial cruciate ligament rupture. Includes implants.', active: true,  popular: false, taxable: false, sku: 'SUR-007' },
  { id: 's027', name: 'Soft Tissue Surgery (Minor)', category: 'Surgery',       price: 480,  duration: 90, description: 'Lump/mass removal, wound repair, eyelid procedures. Priced per procedure complexity.', active: true,  popular: false, taxable: false, sku: 'SUR-008' },
  { id: 's028', name: 'Exploratory Laparotomy',      category: 'Surgery',       price: 1600, duration: 180,description: 'Abdominal exploration for foreign body, GI obstruction, or organ biopsy.', active: true,  popular: false, taxable: false, sku: 'SUR-009' },

  // Dental
  { id: 's030', name: 'Dental Prophylaxis (Grade 1–2)', category: 'Dental',    price: 280,  duration: 60, description: 'Full scaling, polishing under anesthesia. Includes dental radiographs.', active: true,  popular: true,  taxable: false, sku: 'DEN-001' },
  { id: 's031', name: 'Dental Prophylaxis (Grade 3–4)', category: 'Dental',    price: 420,  duration: 90, description: 'Advanced periodontal treatment for severe tartar and gingival disease.', active: true,  popular: false, taxable: false, sku: 'DEN-002' },
  { id: 's032', name: 'Tooth Extraction (Simple)',   category: 'Dental',        price: 85,   duration: 20, description: 'Single tooth extraction, loosened or non-fragmented root.', active: true,  popular: false, taxable: false, sku: 'DEN-003' },
  { id: 's033', name: 'Tooth Extraction (Surgical)', category: 'Dental',        price: 160,  duration: 40, description: 'Surgical extraction requiring sectioning and alveoloplasty.', active: true,  popular: false, taxable: false, sku: 'DEN-004' },
  { id: 's034', name: 'Dental Radiograph (Full)',    category: 'Dental',        price: 95,   duration: 20, description: 'Full-mouth digital dental radiographs. Included with grade 3–4 prophylaxis.', active: true,  popular: false, taxable: false, sku: 'DEN-005' },

  // Lab & Imaging
  { id: 's040', name: 'CBC + Chemistry Panel',       category: 'Lab & Imaging', price: 145,  duration: 30, description: 'Complete blood count and comprehensive metabolic panel. In-house, same-day results.', active: true,  popular: true,  taxable: false, sku: 'LAB-001' },
  { id: 's041', name: 'Urinalysis (Complete)',       category: 'Lab & Imaging', price: 55,   duration: 15, description: 'Dipstick, sediment examination, and specific gravity.', active: true,  popular: false, taxable: false, sku: 'LAB-002' },
  { id: 's042', name: 'Thyroid Panel (T4)',          category: 'Lab & Imaging', price: 75,   duration: 15, description: 'Total T4 for hypothyroidism/hyperthyroidism screening.', active: true,  popular: false, taxable: false, sku: 'LAB-003' },
  { id: 's043', name: 'Radiograph — 2 Views',       category: 'Lab & Imaging', price: 140,  duration: 20, description: 'Digital radiographs, two projections. Orthopedic, thoracic, or abdominal.', active: true,  popular: true,  taxable: false, sku: 'LAB-004' },
  { id: 's044', name: 'Ultrasound — Abdominal',     category: 'Lab & Imaging', price: 320,  duration: 45, description: 'Real-time abdominal ultrasound including all organs. Includes report.', active: true,  popular: false, taxable: false, sku: 'LAB-005' },
  { id: 's045', name: 'Heartworm Test',              category: 'Lab & Imaging', price: 38,   duration: 10, description: 'Antigen test for Dirofilaria immitis. IDEXX 4Dx Plus.', active: true,  popular: true,  taxable: false, sku: 'LAB-006' },
  { id: 's046', name: 'Fecal Floatation',            category: 'Lab & Imaging', price: 32,   duration: 10, description: 'Centrifugal fecal floatation for intestinal parasites.', active: true,  popular: false, taxable: false, sku: 'LAB-007' },

  // Emergency
  { id: 's050', name: 'Emergency Exam Fee',          category: 'Emergency',     price: 145,  duration: 30, description: 'Triage and emergency consultation fee. Applied to treatment costs.', active: true,  popular: false, taxable: false, sku: 'EMR-001' },
  { id: 's051', name: 'After-Hours Surcharge',       category: 'Emergency',     price: 75,   duration: 0,  description: 'Applied to all services rendered outside normal business hours.', active: true,  popular: false, taxable: false, sku: 'EMR-002' },
  { id: 's052', name: 'IV Fluid Therapy (per 24h)',  category: 'Emergency',     price: 180,  duration: 0,  description: 'Intravenous fluid therapy including catheter placement and fluids.', active: true,  popular: false, taxable: false, sku: 'EMR-003' },
  { id: 's053', name: 'Hospitalization (per night)', category: 'Emergency',     price: 120,  duration: 0,  description: 'Overnight hospitalization with monitoring and basic nursing care.', active: true,  popular: false, taxable: false, sku: 'EMR-004' },
  { id: 's054', name: 'Oxygen Therapy (per hour)',   category: 'Emergency',     price: 45,   duration: 0,  description: 'Supplemental oxygen via cage, mask, or flow-by as needed.', active: false, popular: false, taxable: false, sku: 'EMR-005' },

  // Prescriptions
  { id: 's060', name: 'Prescription Dispensing Fee', category: 'Prescriptions', price: 18,   duration: 5,  description: 'Per-prescription fee for label preparation and dispensing.', active: true,  popular: false, taxable: true,  sku: 'RX-001' },
  { id: 's061', name: 'Prescription Diet Consult',   category: 'Prescriptions', price: 55,   duration: 20, description: 'Evaluation and prescription of therapeutic diets (renal, GI, weight mgmt).', active: true,  popular: false, taxable: false, sku: 'RX-002' },
  { id: 's062', name: 'Compounding Fee',             category: 'Prescriptions', price: 35,   duration: 10, description: 'Custom compounding of medications not available in standard forms.', active: true,  popular: false, taxable: true,  sku: 'RX-003' },

  // Specialist
  { id: 's070', name: 'Cardiology Consultation',     category: 'Specialist',    price: 380,  duration: 60, description: 'Cardiac evaluation including echocardiogram interpretation and management plan.', active: true,  popular: false, taxable: false, sku: 'SPC-001' },
  { id: 's071', name: 'Dermatology Consultation',    category: 'Specialist',    price: 280,  duration: 45, description: 'Skin/coat/ear evaluation, allergy testing, cytology.', active: true,  popular: false, taxable: false, sku: 'SPC-002' },
  { id: 's072', name: 'Ophthalmology Exam',          category: 'Specialist',    price: 220,  duration: 45, description: 'Slit-lamp, tonometry, fundoscopy, and ERG if indicated.', active: true,  popular: false, taxable: false, sku: 'SPC-003' },
  { id: 's073', name: 'Oncology Consultation',       category: 'Specialist',    price: 420,  duration: 60, description: 'Staging, biopsy review, and treatment planning for neoplastic disease.', active: false, popular: false, taxable: false, sku: 'SPC-004' },
];

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
  const [services, setServices] = useState<Service[]>(INITIAL_SERVICES);
  const [activeTab, setActiveTab] = useState<Category | 'All'>('All');
  const [search, setSearch]       = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [drawerService, setDrawerService] = useState<Service | null | 'new'>(null);
  const [unsaved, setUnsaved]     = useState(false);

  const updatePrice = (id: string, price: number) => {
    setServices(prev => prev.map(s => s.id === id ? { ...s, price } : s));
    setUnsaved(true);
  };

  const toggleActive = (id: string) => {
    setServices(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s));
    setUnsaved(true);
  };

  const saveService = (svc: Service) => {
    setServices(prev => {
      const idx = prev.findIndex(s => s.id === svc.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = svc; return n; }
      return [svc, ...prev];
    });
    setUnsaved(true);
  };

  const deleteService = (id: string) => {
    setServices(prev => prev.filter(s => s.id !== id));
    setUnsaved(true);
  };

  const duplicateService = (svc: Service) => {
    const copy: Service = { ...svc, id: `s${Date.now()}`, name: `${svc.name} (Copy)`, sku: `${svc.sku}-COPY`, active: false };
    setServices(prev => {
      const idx = prev.findIndex(s => s.id === svc.id);
      const n = [...prev];
      n.splice(idx + 1, 0, copy);
      return n;
    });
    setUnsaved(true);
  };

  const filtered = services.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.name.toLowerCase().includes(q) || s.sku.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
    const matchCat    = activeTab === 'All' || s.category === activeTab;
    const matchActive = showInactive || s.active;
    return matchSearch && matchCat && matchActive;
  });

  const totalActive  = services.filter(s => s.active).length;
  const avgPrice     = Math.round(services.filter(s => s.active).reduce((a, s) => a + s.price, 0) / totalActive);
  const highestPrice = [...services].sort((a, b) => b.price - a.price)[0];
  const popularCount = services.filter(s => s.popular && s.active).length;

  const catCounts = ALL_CATS.reduce((acc, cat) => {
    acc[cat] = services.filter(s => s.category === cat && (showInactive || s.active)).length;
    return acc;
  }, {} as Record<Category, number>);

  return (
    <div className="max-w-[1440px] mx-auto p-8">

      {/* ── Header ── */}
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
          {unsaved && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '9px', backgroundColor: `${ACCENT}15`, border: `1px solid ${ACCENT}40` }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: ACCENT, animation: 'star-blink 1.5s ease-in-out infinite' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: ACCENT_D }}>Unsaved changes</span>
              <button
                onClick={() => setUnsaved(false)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${ACCENT}`, backgroundColor: ACCENT, color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
              >
                <Check style={{ width: 11, height: 11 }} /> Save all
              </button>
            </div>
          )}
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
              ${Math.min(...filtered.map(s => s.price))} – ${Math.max(...filtered.map(s => s.price)).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

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
