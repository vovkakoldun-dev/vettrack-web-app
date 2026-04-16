import { useParams, Link, useLocation, useNavigate } from 'react-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  ArrowLeft, Download, Share2, Printer, Copy, Mail, Check, Trash2,
  Heart, Thermometer, Activity, Wind, Gauge, Scale,
  Stethoscope, Pill, FlaskConical, CalendarCheck, FileText,
  AlertTriangle, ChevronRight, Clock, MapPin, Phone, User,
  Syringe, Image, Scissors, ClipboardList, Utensils, Camera, StickyNote, Shield,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '../components/ui/table';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '../components/ui/dropdown-menu';

// ─── Types ───────────────────────────────────────────────────

type RecordType = 'Visit' | 'Vaccination' | 'Lab Result' | 'Surgery' | 'Prescription' | 'Dental' | 'Imaging';
type RecordStatus = 'Final' | 'Pending Review' | 'Amended' | 'Draft';
type LabFlag = 'normal' | 'high' | 'low' | 'critical';

interface DetailedRecord {
  id: number;
  recordNumber: string;
  patient: {
    name: string; species: string; breed: string; dob: string; age: string;
    sex: string; weight: string; microchip: string; color: string; image: string;
  };
  owner: { name: string; email: string; phone: string; address: string };
  visit: {
    date: string; time: string; reason: string; vet: string; vetLicense: string;
    clinic: string; clinicAddress: string; clinicPhone: string; duration: string;
    recordType: RecordType; status: RecordStatus;
  };
  vitals: {
    weight: string; temperature: string; heartRate: string; respiratoryRate: string;
    bloodPressure: string; bodyConditionScore: string; painScore: string; hydrationStatus: string;
  };
  diagnosis: {
    primary: string; secondary: string[]; differentials: string[];
    notes: string; icdCodes: { code: string; description: string }[];
  };
  treatmentPlan: {
    procedures: { name: string; notes: string; status: string }[];
    instructions: string; restrictions: string[]; homeCarePlan: string;
  };
  medications: {
    name: string; dosage: string; frequency: string; route: string;
    duration: string; prescribedBy: string; startDate: string; notes: string;
  }[];
  labResults: {
    testName: string; result: string; referenceRange: string; unit: string;
    flag: LabFlag; date: string;
  }[];
  followUp: {
    nextVisitDate: string; nextVisitReason: string; notes: string; reminderSet: boolean;
  };
  // ── Additional tab data (fetched by pet_id + visit_date) ──
  vaccinations: {
    name: string; manufacturer: string; lotNumber: string; serialNumber: string;
    site: string; date: string; nextDue: string; notes: string; administeredBy: string;
  }[];
  imagingStudies: {
    title: string; modality: string; region: string; date: string;
    findings: string; impression: string; status: string;
    images: { url: string; label: string }[];
  }[];
  surgeries: {
    name: string; date: string; duration: string; surgeon: string;
    status: string; anesthesia: string; preOp: string; procedureNotes: string;
    postOp: string; complications: string; followUp: string;
  }[];
  treatmentPlans: {
    title: string; status: string; notes: string;
    goals: { text: string; progress: number; status: string }[];
    medications: { name: string; dose: string; purpose: string }[];
    milestones: { title: string; date: string; status: string; note: string }[];
  }[];
  dietPlans: {
    food: string; foodType: string; amount: string; meals: string;
    calories: string; targetWeight: string; waterNote: string;
    treatsNote: string; restrictions: { item: string; reason: string; severity: string }[];
    notes: string;
  }[];
  photos: {
    title: string; category: string; url: string; date: string; caption: string;
  }[];
  conditions: {
    name: string; severity: string; status: string; diagnosed: string;
    resolvedDate: string; notes: string;
  }[];
  allergies: string[];
  petTreatments: {
    name: string; date: string; vet: string; notes: string;
  }[];
  visitNotes: {
    type: string; content: string; date: string;
  }[];
  createdAt: string;
  lastModified: string;
  modifiedBy: string;
}

// ─── Color Maps ──────────────────────────────────────────────

const recordTypeColors: Record<RecordType, { bg: string; text: string }> = {
  Visit:        { bg: 'color-mix(in srgb, var(--brand-green-text) 12%, transparent)', text: 'var(--brand-green-text)' },
  Vaccination:  { bg: '#3B82F620', text: '#3B82F6' },
  'Lab Result': { bg: '#8B5CF620', text: '#8B5CF6' },
  Surgery:      { bg: '#EC489920', text: '#EC4899' },
  Prescription: { bg: '#F4A26120', text: '#F4A261' },
  Dental:       { bg: '#06B6D420', text: '#06B6D4' },
  Imaging:      { bg: '#6B728020', text: 'var(--text-secondary)' },
};

const statusColors: Record<RecordStatus, { bg: string; text: string }> = {
  Final:            { bg: '#74C69D20', text: 'var(--brand-green-text)' },
  'Pending Review': { bg: '#F4A26120', text: '#F4A261' },
  Amended:          { bg: '#3B82F620', text: '#3B82F6' },
  Draft:            { bg: '#6B728020', text: 'var(--text-secondary)' },
};

const labFlagColors: Record<LabFlag, { bg: string; text: string; label: string }> = {
  normal:   { bg: '#74C69D20', text: 'var(--brand-green-text)', label: 'Normal' },
  high:     { bg: '#F4A26120', text: '#F4A261', label: 'High' },
  low:      { bg: '#3B82F620', text: '#3B82F6', label: 'Low' },
  critical: { bg: '#d4183d20', text: '#d4183d', label: 'Critical' },
};


// ─── Helper Components ───────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2">
      <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{label}</span>
      <span className="text-[var(--text-primary)] text-right" style={{ fontSize: '14px', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 12%, transparent)', borderRadius: '8px' }}>
        <Icon className="w-4 h-4 text-[var(--brand-green-text)]" />
      </div>
      <h3 className="text-[var(--text-primary)]" style={{ fontSize: '18px', fontWeight: 600 }}>{title}</h3>
    </div>
  );
}

function VitalCard({ label, value, icon: Icon, isAbnormal }: { label: string; value: string; icon: React.ElementType; isAbnormal?: boolean }) {
  const color = isAbnormal ? '#F4A261' : 'var(--brand-green-text)';
  return (
    <div className="p-4 border border-[var(--border-color)]" style={{ borderRadius: '8px' }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <p style={{ fontSize: '16px', fontWeight: 600, color }}>{value}</p>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────

export default function RecordDetailPage() {
  const { id } = useParams();
  const { pathname } = useLocation();
  const basePath = pathname.startsWith('/admin') ? '/admin/records' : '/records';
  const [realRecord, setRealRecord] = useState<DetailedRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('medical_records')
        .select('*, pets(id, name, species, breed, photo_url, date_of_birth, sex, weight_kg, color, microchip_no), clients(id, first_name, last_name, email, phone), staff!medical_records_vet_id_fkey(id, profiles:profiles!staff_profile_id_fkey(first_name, last_name)), record_vitals(weight_kg, temperature_c, heart_rate_bpm, respiratory_rate_bpm, blood_pressure_systolic, blood_pressure_diastolic, body_condition_score, pain_score, hydration_status), record_diagnoses(type, description, icd_code, notes), record_treatments(procedure_name, description, post_visit_instructions, activity_restrictions, home_care_plan)')
        .eq('id', id)
        .single();
      if (data) {
        // ── Fetch ALL related tab data in parallel ──
        const petId = data.pet_id;
        const vDate = data.visit_date;
        const [
          { data: vaxData }, { data: imgData }, { data: surgData },
          { data: planData }, { data: dietData }, { data: photoData },
          { data: condData }, { data: allergyData }, { data: petTxData },
          { data: noteData },
        ] = await Promise.all([
          supabase.from('vaccinations').select('*').eq('pet_id', petId).eq('administered_date', vDate),
          supabase.from('imaging_studies').select('*, imaging_study_files(*)').eq('pet_id', petId).eq('study_date', vDate),
          supabase.from('surgeries').select('*').eq('pet_id', petId).eq('surgery_date', vDate),
          supabase.from('treatment_plans').select('*, treatment_plan_goals(*), treatment_plan_milestones(*), treatment_plan_medications(*)').eq('pet_id', petId).eq('status', 'active'),
          supabase.from('diet_plans').select('*, diet_restrictions(*)').eq('pet_id', petId).eq('status', 'active'),
          supabase.from('pet_photos').select('*').eq('pet_id', petId).eq('photo_date', vDate),
          supabase.from('pet_conditions').select('*').eq('pet_id', petId).eq('status', 'active'),
          supabase.from('pet_allergies').select('*').eq('pet_id', petId),
          supabase.from('pet_treatments').select('*').eq('pet_id', petId).eq('date', vDate),
          supabase.from('pet_notes').select('*').eq('pet_id', petId).gte('created_at', vDate + 'T00:00:00').lte('created_at', vDate + 'T23:59:59'),
        ]);

        const visitDate = new Date(data.visit_date + 'T12:00:00');
        setRealRecord({
          id: 0,
          recordNumber: data.record_number,
          patient: (() => {
            const pet = data.pets;
            let age = '—';
            let dobStr = '—';
            if (pet?.date_of_birth) {
              const dob = new Date(pet.date_of_birth + 'T12:00:00');
              dobStr = dob.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              const now = new Date();
              const years = now.getFullYear() - dob.getFullYear();
              const months = now.getMonth() - dob.getMonth();
              const totalMonths = years * 12 + months;
              age = totalMonths >= 12 ? `${Math.floor(totalMonths / 12)} years, ${totalMonths % 12} months` : `${totalMonths} months`;
            }
            const weightKg = pet?.weight_kg;
            const weightStr = weightKg ? `${weightKg} kg (${(weightKg * 2.205).toFixed(1)} lbs)` : '—';
            return {
              name: pet?.name ?? '—',
              species: pet?.species ?? '—',
              breed: pet?.breed ?? '—',
              dob: dobStr,
              age,
              sex: pet?.sex ?? '—',
              weight: weightStr,
              microchip: pet?.microchip_no ?? '—',
              color: pet?.color ?? '—',
              image: pet?.photo_url ?? '',
            };
          })(),
          owner: {
            name: data.clients ? `${data.clients.first_name} ${data.clients.last_name}` : '—',
            email: data.clients?.email ?? '—',
            phone: data.clients?.phone ?? '—',
            address: '—',
          },
          visit: {
            date: visitDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            time: (() => {
              if (!data.visit_time) return '—';
              const parts = data.visit_time.split(':');
              let h = parseInt(parts[0], 10);
              const m = parts[1] || '00';
              const ampm = h >= 12 ? 'PM' : 'AM';
              if (h > 12) h -= 12;
              if (h === 0) h = 12;
              return `${h}:${m} ${ampm}`;
            })(),
            reason: data.reason ?? '—',
            vet: (data as any).staff?.profiles ? `Dr. ${(data as any).staff.profiles.first_name} ${(data as any).staff.profiles.last_name}` : '—',
            vetLicense: '—',
            clinic: 'HugoIT Veterinary Clinic',
            clinicAddress: '—',
            clinicPhone: '—',
            duration: data.duration_minutes ? `${data.duration_minutes} minutes` : '—',
            recordType: (data.record_type || 'Visit') as RecordType,
            status: (data.status || 'Final') as RecordStatus,
          },
          vitals: (() => {
            const rv = Array.isArray((data as any).record_vitals) ? (data as any).record_vitals[0] : (data as any).record_vitals;
            const weight = rv?.weight_kg ? String(rv.weight_kg) : null;
            const temp = rv?.temperature_c ? String((rv.temperature_c * 9/5 + 32).toFixed(1)) : null;
            const hr = rv?.heart_rate_bpm ? String(rv.heart_rate_bpm) : null;
            const rr = rv?.respiratory_rate_bpm ? String(rv.respiratory_rate_bpm) : null;
            const bpSys = rv?.blood_pressure_systolic;
            const bpDia = rv?.blood_pressure_diastolic;
            const bcs = rv?.body_condition_score ? String(rv.body_condition_score) : null;
            const ps = rv?.pain_score ? String(rv.pain_score) : null;
            const hydration = rv?.hydration_status || null;
            return {
              weight: weight ? `${weight} kg` : '—',
              temperature: temp ? `${temp}°F` : '—',
              heartRate: hr ? `${hr} bpm` : '—',
              respiratoryRate: rr ? `${rr} brpm` : '—',
              bloodPressure: bpSys && bpDia ? `${bpSys}/${bpDia} mmHg` : '—',
              bodyConditionScore: bcs ? `${bcs}/9` : '—',
              painScore: ps ? `${ps}/10` : '—',
              hydrationStatus: hydration || '—',
            };
          })(),
          diagnosis: (() => {
            const dxRows = (data as any).record_diagnoses || [];
            const primaryDx = dxRows.find((d: any) => d.type === 'primary')?.description || '—';
            const secondary = dxRows.filter((d: any) => d.type === 'secondary').map((d: any) => d.description);
            const differentials = dxRows.filter((d: any) => d.type === 'differential').map((d: any) => d.description);
            const icdCodes = dxRows.filter((d: any) => d.icd_code).map((d: any) => ({ code: d.icd_code, description: d.description || '' }));
            return {
              primary: primaryDx,
              secondary,
              differentials,
              notes: (data as any).clinical_notes || dxRows.map((d: any) => d.notes).filter(Boolean).join('\n') || '',
              icdCodes,
            };
          })(),
          treatmentPlan: (() => {
            const txRows = (data as any).record_treatments || [];
            const procedures = txRows.map((t: any) => ({ name: t.procedure_name || '—', notes: t.description || '', status: 'Completed' }));
            const instructions = txRows.map((t: any) => t.post_visit_instructions).filter(Boolean).join('\n') || '';
            const restrictions = txRows.map((t: any) => t.activity_restrictions).filter(Boolean);
            const homeCarePlan = txRows.map((t: any) => t.home_care_plan).filter(Boolean).join('\n') || '';
            return { procedures, instructions, restrictions, homeCarePlan };
          })(),
          medications: await (async () => {
            try {
              const { data: medsData } = await supabase
                .from('medications')
                .select('name, dosage, frequency, route, duration_days, start_date, notes, prescribed_by')
                .eq('record_id', data.id);
              if (medsData && medsData.length > 0) {
                return medsData.map((m: any) => ({
                  name: m.name || '—', dosage: m.dosage || '—', frequency: m.frequency || '—',
                  route: m.route || '—', duration: m.duration_days ? `${m.duration_days} days` : '—',
                  prescribedBy: '—', startDate: m.start_date || data.visit_date || '—', notes: m.notes || '',
                }));
              }
              return [];
            } catch { return []; }
          })(),
          labResults: await (async () => {
            try {
              const { data: labs } = await supabase
                .from('lab_results')
                .select('test_name, result_value, reference_range, unit, flag, tested_at')
                .eq('record_id', data.id);
              if (labs && labs.length > 0) {
                const flagMap: Record<string, LabFlag> = { normal: 'normal', high: 'high', low: 'low', critical: 'critical' };
                return labs.map((l: any) => ({
                  testName: l.test_name || '—',
                  result: l.result_value || 'Pending',
                  referenceRange: l.reference_range || '—',
                  unit: l.unit || '',
                  flag: flagMap[l.flag] || 'Normal',
                  date: l.tested_at ? new Date(l.tested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
                }));
              }
            } catch {}
            return [];
          })(),
          followUp: {
            nextVisitDate: data.follow_up_date ? new Date(data.follow_up_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
            nextVisitReason: data.follow_up_reason ?? '—',
            notes: data.follow_up_notes ?? '',
            reminderSet: !!data.follow_up_date,
          },
          // ── Additional tab data ──
          vaccinations: (vaxData || []).map((v: any) => ({
            name: v.vaccine_name || '—', manufacturer: v.manufacturer || '—',
            lotNumber: v.lot_number || '—', serialNumber: v.serial_number || '—',
            site: v.injection_site || '—', date: v.administered_date || '—',
            nextDue: v.next_due_date || '—', notes: v.notes || '',
            administeredBy: '—',
          })),
          imagingStudies: (imgData || []).map((s: any) => ({
            title: s.title || '—', modality: s.modality || '—', region: s.region || '—',
            date: s.study_date || '—', findings: s.findings || '', impression: s.impression || '',
            status: s.status || '—',
            images: (s.imaging_study_files || []).map((f: any) => ({ url: f.file_url || '', label: f.view_label || f.file_name || '' })),
          })),
          surgeries: (surgData || []).map((s: any) => ({
            name: s.name || '—', date: s.surgery_date || '—',
            duration: s.duration_minutes ? `${s.duration_minutes} min` : '—',
            surgeon: '—', status: s.status || '—', anesthesia: s.anesthesia || '—',
            preOp: s.pre_op || '', procedureNotes: s.procedure_notes || '',
            postOp: s.post_op || '', complications: s.complications || '', followUp: s.follow_up || '',
          })),
          treatmentPlans: (planData || []).map((p: any) => ({
            title: p.title || '—', status: p.status || '—', notes: p.notes || '',
            goals: (p.treatment_plan_goals || []).map((g: any) => ({ text: g.text || '—', progress: g.progress || 0, status: g.status || '—' })),
            medications: (p.treatment_plan_medications || []).map((m: any) => ({ name: m.name || '—', dose: m.dose || '—', purpose: m.purpose || '' })),
            milestones: (p.treatment_plan_milestones || []).map((ms: any) => ({ title: ms.title || '—', date: ms.milestone_date || '—', status: ms.status || '—', note: ms.note || '' })),
          })),
          dietPlans: (dietData || []).map((d: any) => ({
            food: [d.food_brand, d.food_name].filter(Boolean).join(' ') || '—',
            foodType: d.food_type || '—', amount: d.daily_amount || '—',
            meals: d.meals ? `${d.meals} per day` : '—', calories: d.calories ? `${d.calories} kcal` : '—',
            targetWeight: d.target_weight_kg ? `${d.target_weight_kg} kg` : '—',
            waterNote: d.water_note || '', treatsNote: d.treats_note || '',
            restrictions: (d.diet_restrictions || []).map((r: any) => ({ item: r.item || '—', reason: r.reason || '', severity: r.severity || '—' })),
            notes: d.notes || '',
          })),
          photos: (photoData || []).map((p: any) => ({
            title: p.title || '—', category: p.category || 'general',
            url: p.file_url || '', date: p.photo_date || '—', caption: p.caption || '',
          })),
          conditions: (condData || []).map((c: any) => ({
            name: c.name || '—', severity: c.severity || '—', status: c.status || '—',
            diagnosed: c.date_diagnosed || '—', resolvedDate: c.resolved_date || '', notes: c.notes || '',
          })),
          allergies: (allergyData || []).map((a: any) => a.name || '—'),
          petTreatments: (petTxData || []).map((t: any) => ({
            name: t.name || '—', date: t.date || '—', vet: t.vet || '—', notes: t.notes || '',
          })),
          visitNotes: (noteData || []).map((n: any) => ({
            type: n.type || 'vet', content: n.content || '',
            date: n.created_at ? new Date(n.created_at).toLocaleString() : '—',
          })),
          createdAt: new Date(data.created_at).toLocaleString(),
          lastModified: new Date(data.updated_at).toLocaleString(),
          modifiedBy: '—',
        });
      }
      setLoading(false);
    })();
  }, [id]);

  const navigate = useNavigate();
  const record = realRecord;
  const [linkCopied, setLinkCopied] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto p-8 flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-[var(--border-color)] border-t-[var(--brand-green-text)] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Loading record…</p>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="max-w-[1200px] mx-auto p-8 flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <FileText className="w-10 h-10 text-[var(--text-secondary)] mx-auto mb-4" style={{ opacity: 0.4 }} />
          <h2 className="text-[var(--text-primary)] mb-2" style={{ fontSize: '20px', fontWeight: 600 }}>Record not found</h2>
          <p className="text-[var(--text-secondary)] mb-6" style={{ fontSize: '14px' }}>This record may have been deleted or doesn't exist.</p>
          <Link to={basePath} className="inline-flex items-center gap-2 text-[var(--brand-green-text)] hover:underline" style={{ fontSize: '14px', fontWeight: 500 }}>
            <ArrowLeft className="w-4 h-4" /> Back to Records
          </Link>
        </div>
      </div>
    );
  }

  const typeStyle = recordTypeColors[record.visit.recordType];
  const sttStyle = statusColors[record.visit.status];

  const handleCopyLink = () => {
    const url = `${window.location.origin}${basePath}/${id}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleEmailShare = () => {
    const url = `${window.location.origin}${basePath}/${id}`;
    const subject = encodeURIComponent(`Medical Record — ${record.patient.name}`);
    const body = encodeURIComponent(`View the medical record for ${record.patient.name}: ${url}`);
    window.open(`mailto:${record.owner.email}?subject=${subject}&body=${body}`);
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    // Delete related records first, then the main record
    await Promise.all([
      supabase.from('record_vitals').delete().eq('record_id', id),
      supabase.from('record_diagnoses').delete().eq('record_id', id),
      supabase.from('record_treatments').delete().eq('record_id', id),
      supabase.from('medications').delete().eq('record_id', id),
      supabase.from('lab_results').delete().eq('record_id', id),
    ]);
    await supabase.from('medical_records').delete().eq('id', id);
    navigate(basePath, { replace: true });
  };

  return (
    <div className="max-w-[1200px] mx-auto p-8">
      {/* Back Link */}
      <Link to={basePath} className="inline-flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-green-text)] transition-colors mb-6" style={{ fontSize: '14px' }}>
        <ArrowLeft className="w-4 h-4" />
        Back to Records
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-[var(--text-primary)]" style={{ fontSize: '28px', fontWeight: 700 }}>{record.recordNumber}</h1>
            <span className="inline-block px-3 py-1" style={{ backgroundColor: typeStyle.bg, color: typeStyle.text, borderRadius: '9999px', fontSize: '13px', fontWeight: 600 }}>
              {record.visit.recordType}
            </span>
            <span className="inline-block px-3 py-1" style={{ backgroundColor: sttStyle.bg, color: sttStyle.text, borderRadius: '9999px', fontSize: '13px', fontWeight: 600 }}>
              {record.visit.status}
            </span>
          </div>
          <p className="text-[var(--text-secondary)]" style={{ fontSize: '15px' }}>
            {record.patient.name} • {record.visit.reason} • {record.visit.date}
          </p>
        </div>
        {/* CTA Export / Share Buttons */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              const r = record;
              const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

              const vitalsRows = [
                ['Weight', r.vitals.weight], ['Temperature', r.vitals.temperature],
                ['Heart Rate', r.vitals.heartRate], ['Respiratory Rate', r.vitals.respiratoryRate],
                ['Blood Pressure', r.vitals.bloodPressure], ['Body Condition', r.vitals.bodyConditionScore],
                ['Pain Score', r.vitals.painScore], ['Hydration', r.vitals.hydrationStatus],
              ].filter(([, v]) => v && v !== '—').map(([k, v]) => `<div><span class="label">${k}</span><span class="value">${v}</span></div>`).join('');

              const medsHtml = r.medications.length > 0
                ? r.medications.map(m => `<tr><td><strong>${m.name}</strong></td><td>${m.dosage}</td><td>${m.frequency}</td><td>${m.route}</td><td>${m.duration}</td><td>${m.notes || '—'}</td></tr>`).join('')
                : '<tr><td colspan="6" class="empty">No medications prescribed</td></tr>';

              const labsHtml = r.labResults.length > 0
                ? r.labResults.map(l => {
                    const flagClass = l.flag === 'critical' ? 'badge-critical' : l.flag === 'high' ? 'badge-high' : l.flag === 'low' ? 'badge-low' : 'badge-normal';
                    return `<tr><td>${l.testName}</td><td><strong>${l.result}</strong> ${l.unit}</td><td>${l.referenceRange}</td><td><span class="badge ${flagClass}">${l.flag}</span></td><td>${l.date}</td></tr>`;
                  }).join('')
                : '<tr><td colspan="5" class="empty">No lab results</td></tr>';

              const proceduresHtml = r.treatmentPlan.procedures.length > 0
                ? r.treatmentPlan.procedures.map(p => `<tr><td>${p.name}</td><td>${p.notes || '—'}</td><td><span class="badge badge-normal">${p.status}</span></td></tr>`).join('')
                : '<tr><td colspan="3" class="empty">No procedures recorded</td></tr>';

              const icdHtml = r.diagnosis.icdCodes.length > 0
                ? r.diagnosis.icdCodes.map(c => `<span class="icd-tag">${c.code} — ${c.description}</span>`).join(' ')
                : '';

              // ── Helpers for new tab sections ──
              const hasDiagnosis = r.diagnosis.primary && r.diagnosis.primary !== '—';
              const hasTreatment = r.treatmentPlan.procedures.length > 0 || r.treatmentPlan.instructions || r.treatmentPlan.homeCarePlan;
              const hasMeds = r.medications.length > 0;
              const hasLabs = r.labResults.length > 0;
              const hasFollowUp = r.followUp.nextVisitDate !== '—';

              const vaxHtml = r.vaccinations.length > 0
                ? r.vaccinations.map(v => `<tr><td><strong>${v.name}</strong></td><td>${v.manufacturer}</td><td>${v.lotNumber}</td><td>${v.site}</td><td>${v.date}</td><td>${v.nextDue}</td><td>${v.notes || '—'}</td></tr>`).join('')
                : '';
              const imgHtml = r.imagingStudies.map(s => {
                const imgs = s.images.length > 0 ? `<p style="font-size:11px;color:#888;margin-top:4px;">${s.images.length} image(s) attached</p>` : '';
                return `<div style="background:#f8faf9;border:1px solid #dce8e0;border-radius:8px;padding:12px;margin-bottom:8px;">
                  <div style="display:flex;justify-content:space-between;"><strong>${s.title}</strong><span class="badge badge-normal">${s.status}</span></div>
                  <p style="font-size:12px;color:#666;margin-top:4px;">${s.modality} · ${s.region} · ${s.date}</p>
                  ${s.findings ? `<div class="dx-notes" style="margin-top:8px;">${s.findings}</div>` : ''}
                  ${s.impression ? `<p style="font-size:13px;color:#444;margin-top:6px;"><strong>Impression:</strong> ${s.impression}</p>` : ''}
                  ${imgs}
                </div>`;
              }).join('');
              const surgHtml = r.surgeries.map(s => {
                return `<div style="background:#f8faf9;border:1px solid #dce8e0;border-radius:8px;padding:12px;margin-bottom:8px;">
                  <div style="display:flex;justify-content:space-between;"><strong>${s.name}</strong><span class="badge ${s.status === 'Recovered' ? 'badge-normal' : s.status === 'Complications' ? 'badge-critical' : 'badge-high'}">${s.status}</span></div>
                  <p style="font-size:12px;color:#666;margin-top:4px;">${s.date} · ${s.duration}${s.anesthesia !== '—' ? ` · Anesthesia: ${s.anesthesia}` : ''}</p>
                  ${s.procedureNotes ? `<div class="dx-notes" style="margin-top:8px;">${s.procedureNotes}</div>` : ''}
                  ${s.postOp ? `<p style="font-size:13px;color:#444;margin-top:6px;"><strong>Post-Op:</strong> ${s.postOp}</p>` : ''}
                  ${s.complications ? `<p style="font-size:13px;color:#d4183d;margin-top:4px;"><strong>Complications:</strong> ${s.complications}</p>` : ''}
                </div>`;
              }).join('');
              const planHtml = r.treatmentPlans.map(p => {
                const goalsHtml = p.goals.length > 0 ? p.goals.map(g => `<li>${g.text} — <em>${g.progress}%</em></li>`).join('') : '';
                const planMedsHtml = p.medications.length > 0 ? p.medications.map(m => `<li><strong>${m.name}</strong> ${m.dose} — ${m.purpose}</li>`).join('') : '';
                return `<div style="background:#f8faf9;border:1px solid #dce8e0;border-radius:8px;padding:12px;margin-bottom:8px;">
                  <div style="display:flex;justify-content:space-between;"><strong>${p.title}</strong><span class="badge badge-normal">${p.status}</span></div>
                  ${goalsHtml ? `<div style="margin-top:8px;"><strong style="font-size:12px;">Goals:</strong><ul style="margin:4px 0 0 18px;font-size:13px;">${goalsHtml}</ul></div>` : ''}
                  ${planMedsHtml ? `<div style="margin-top:8px;"><strong style="font-size:12px;">Medications:</strong><ul style="margin:4px 0 0 18px;font-size:13px;">${planMedsHtml}</ul></div>` : ''}
                  ${p.notes ? `<p style="font-size:13px;color:#444;margin-top:8px;">${p.notes}</p>` : ''}
                </div>`;
              }).join('');
              const dietHtml = r.dietPlans.map(d => {
                const restrictHtml = d.restrictions.length > 0 ? d.restrictions.map(rx => `<span style="display:inline-block;background:#fff3cd;color:#856404;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;margin:2px 4px 2px 0;">${rx.item}</span>`).join('') : '';
                return `<div style="background:#f8faf9;border:1px solid #dce8e0;border-radius:8px;padding:12px;margin-bottom:8px;">
                  <strong>${d.food}</strong> (${d.foodType})
                  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px;font-size:12px;">
                    <div><span class="label">Amount</span><br/><strong>${d.amount}</strong></div>
                    <div><span class="label">Meals</span><br/><strong>${d.meals}</strong></div>
                    <div><span class="label">Calories</span><br/><strong>${d.calories}</strong></div>
                  </div>
                  ${d.targetWeight !== '—' ? `<p style="font-size:12px;color:#666;margin-top:6px;">Target Weight: <strong>${d.targetWeight}</strong></p>` : ''}
                  ${restrictHtml ? `<div style="margin-top:8px;"><strong style="font-size:12px;">Restrictions:</strong><br/>${restrictHtml}</div>` : ''}
                  ${d.notes ? `<p style="font-size:13px;color:#444;margin-top:6px;">${d.notes}</p>` : ''}
                </div>`;
              }).join('');
              const condHtml = r.conditions.length > 0 || r.allergies.length > 0;
              const notesHtml = r.visitNotes.length > 0
                ? r.visitNotes.map(n => `<div style="background:#f8faf9;border-left:3px solid ${n.type === 'vet' ? '#2d6a4f' : '#3b82f6'};padding:10px 12px;border-radius:0 8px 8px 0;margin-bottom:6px;"><span style="font-size:11px;color:#888;text-transform:uppercase;">${n.type === 'vet' ? 'Vet Note' : 'Client Note'} — ${n.date}</span><p style="font-size:13px;color:#333;margin-top:4px;white-space:pre-wrap;">${n.content}</p></div>`).join('')
                : '';

              const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Medical Record — ${r.patient.name} — ${r.recordNumber}</title>
              <style>
                @page { margin: 18mm; size: A4; }
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; line-height: 1.5; }
                .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid #2d6a4f; padding-bottom: 14px; margin-bottom: 20px; }
                .header h1 { font-size: 20px; color: #2d6a4f; }
                .header .meta { text-align: right; font-size: 11px; color: #666; line-height: 1.6; }
                .record-badge { display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; }
                .badge-type { background: #e8f5e9; color: #2d6a4f; }
                .badge-status { background: #e3f2fd; color: #1565c0; margin-left: 6px; }
                .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
                .card { background: #f8faf9; border: 1px solid #dce8e0; border-radius: 10px; padding: 16px; }
                .card h2 { font-size: 14px; color: #2d6a4f; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; }
                .card .row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 13px; }
                .card .row .label { color: #888; }
                .card .row .val { color: #333; font-weight: 500; }
                .pet-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
                .pet-photo { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid #2d6a4f; }
                .pet-photo-placeholder { width: 48px; height: 48px; border-radius: 50%; background: #2d6a4f; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; }
                .pet-row h3 { font-size: 16px; margin: 0; }
                .pet-row .sub { font-size: 12px; color: #666; }
                .vitals-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 20px; }
                .vitals-grid > div { background: #f0f5f2; padding: 8px 10px; border-radius: 8px; }
                .vitals-grid .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #888; font-weight: 600; display: block; }
                .vitals-grid .value { font-size: 14px; color: #333; font-weight: 600; }
                .section { margin-bottom: 18px; page-break-inside: avoid; }
                .section h2 { font-size: 14px; color: #2d6a4f; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; border-bottom: 1px solid #e8e8e8; padding-bottom: 4px; }
                .dx-primary { font-size: 15px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
                .dx-secondary { font-size: 13px; color: #555; }
                .dx-notes { font-size: 13px; color: #444; margin-top: 8px; line-height: 1.6; white-space: pre-wrap; background: #fafafa; padding: 10px; border-radius: 8px; border-left: 3px solid #2d6a4f; }
                .icd-tag { display: inline-block; background: #e8edf5; color: #3b5998; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin: 2px 4px 2px 0; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 12px; }
                th { background: #f0f5f2; color: #2d6a4f; text-align: left; padding: 6px 10px; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
                td { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; color: #444; }
                tr:last-child td { border-bottom: none; }
                .empty { text-align: center; color: #aaa; font-style: italic; padding: 12px; }
                .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
                .badge-normal { background: #d4edda; color: #155724; }
                .badge-high { background: #fff3cd; color: #856404; }
                .badge-low { background: #cce5ff; color: #004085; }
                .badge-critical { background: #f8d7da; color: #721c24; }
                .instructions { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; font-size: 13px; line-height: 1.6; margin-bottom: 10px; }
                .followup { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; font-size: 13px; }
                .footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 11px; color: #999; text-align: center; }
                .no-print { text-align: center; margin-top: 24px; }
                @media print { .no-print { display: none; } body { padding: 0; } }
              </style></head><body>
              <div class="header">
                <div>
                  <h1>HugoIT &mdash; Medical Record</h1>
                  <div style="margin-top:6px;">
                    <span class="record-badge badge-type">${r.visit.recordType}</span>
                    <span class="record-badge badge-status">${r.visit.status}</span>
                  </div>
                </div>
                <div class="meta">
                  Record: <strong>${r.recordNumber || '—'}</strong><br/>
                  ${r.visit.date} ${r.visit.time !== '—' ? '· ' + r.visit.time : ''}<br/>
                  Generated: ${today}
                </div>
              </div>

              <div class="two-col">
                <div class="card">
                  <div class="pet-row">
                    ${r.patient.image ? `<img src="${r.patient.image}" class="pet-photo" alt="${r.patient.name}" />` : `<div class="pet-photo-placeholder">${(r.patient.name || '?')[0]}</div>`}
                    <div>
                      <h3>${r.patient.name}</h3>
                      <p class="sub">${r.patient.species} · ${r.patient.breed} · ${r.patient.sex}</p>
                    </div>
                  </div>
                  <div class="row"><span class="label">Age</span><span class="val">${r.patient.age}</span></div>
                  <div class="row"><span class="label">Weight</span><span class="val">${r.patient.weight}</span></div>
                  <div class="row"><span class="label">Microchip</span><span class="val">${r.patient.microchip}</span></div>
                  <div class="row"><span class="label">Color</span><span class="val">${r.patient.color}</span></div>
                </div>
                <div class="card">
                  <h2>Owner & Visit</h2>
                  <div class="row"><span class="label">Owner</span><span class="val">${r.owner.name}</span></div>
                  <div class="row"><span class="label">Email</span><span class="val">${r.owner.email}</span></div>
                  <div class="row"><span class="label">Phone</span><span class="val">${r.owner.phone}</span></div>
                  <div class="row"><span class="label">Vet</span><span class="val">${r.visit.vet}</span></div>
                  <div class="row"><span class="label">Reason</span><span class="val">${r.visit.reason}</span></div>
                  <div class="row"><span class="label">Duration</span><span class="val">${r.visit.duration}</span></div>
                  <div class="row"><span class="label">Clinic</span><span class="val">${r.visit.clinic}</span></div>
                </div>
              </div>

              ${vitalsRows ? `<div class="section"><h2>Vitals</h2><div class="vitals-grid">${vitalsRows}</div></div>` : ''}

              ${hasDiagnosis ? `<div class="section">
                <h2>Diagnosis</h2>
                <p class="dx-primary">${r.diagnosis.primary}</p>
                ${r.diagnosis.secondary.length > 0 ? `<p class="dx-secondary">Secondary: ${r.diagnosis.secondary.join(', ')}</p>` : ''}
                ${r.diagnosis.differentials.length > 0 ? `<p class="dx-secondary">Differentials: ${r.diagnosis.differentials.join(', ')}</p>` : ''}
                ${icdHtml ? `<div style="margin-top:6px;">${icdHtml}</div>` : ''}
                ${r.diagnosis.notes ? `<div class="dx-notes">${r.diagnosis.notes}</div>` : ''}
              </div>` : ''}

              ${hasTreatment ? `<div class="section">
                <h2>Treatment & Procedures</h2>
                ${r.treatmentPlan.procedures.length > 0 ? `<table><thead><tr><th>Procedure</th><th>Notes</th><th>Status</th></tr></thead><tbody>${proceduresHtml}</tbody></table>` : ''}
                ${r.treatmentPlan.instructions ? `<div class="instructions"><strong>Owner Instructions:</strong><br/>${r.treatmentPlan.instructions}</div>` : ''}
                ${r.treatmentPlan.restrictions.length > 0 ? `<p style="font-size:13px;color:#444;margin-bottom:8px;"><strong>Restrictions:</strong> ${r.treatmentPlan.restrictions.join(', ')}</p>` : ''}
                ${r.treatmentPlan.homeCarePlan ? `<p style="font-size:13px;color:#444;"><strong>Home Care:</strong> ${r.treatmentPlan.homeCarePlan}</p>` : ''}
              </div>` : ''}

              ${hasMeds ? `<div class="section">
                <h2>Medications Prescribed</h2>
                <table><thead><tr><th>Medication</th><th>Dosage</th><th>Frequency</th><th>Route</th><th>Duration</th><th>Notes</th></tr></thead><tbody>${medsHtml}</tbody></table>
              </div>` : ''}

              ${hasLabs ? `<div class="section">
                <h2>Lab Results</h2>
                <table><thead><tr><th>Test</th><th>Result</th><th>Reference</th><th>Flag</th><th>Date</th></tr></thead><tbody>${labsHtml}</tbody></table>
              </div>` : ''}

              ${vaxHtml ? `<div class="section">
                <h2>Vaccinations</h2>
                <table><thead><tr><th>Vaccine</th><th>Manufacturer</th><th>Lot #</th><th>Site</th><th>Date</th><th>Next Due</th><th>Notes</th></tr></thead><tbody>${vaxHtml}</tbody></table>
              </div>` : ''}

              ${r.imagingStudies.length > 0 ? `<div class="section">
                <h2>Imaging Studies</h2>
                ${imgHtml}
              </div>` : ''}

              ${r.surgeries.length > 0 ? `<div class="section">
                <h2>Surgeries</h2>
                ${surgHtml}
              </div>` : ''}

              ${r.treatmentPlans.length > 0 ? `<div class="section">
                <h2>Treatment Plans</h2>
                ${planHtml}
              </div>` : ''}

              ${r.dietPlans.length > 0 ? `<div class="section">
                <h2>Diet & Nutrition</h2>
                ${dietHtml}
              </div>` : ''}

              ${condHtml ? `<div class="section">
                <h2>Medical Conditions & Allergies</h2>
                ${r.conditions.length > 0 ? `<div style="margin-bottom:10px;">
                  <strong style="font-size:12px;">Active Conditions:</strong>
                  <table style="margin-top:6px;"><thead><tr><th>Condition</th><th>Severity</th><th>Diagnosed</th><th>Notes</th></tr></thead>
                  <tbody>${r.conditions.map(c => `<tr><td><strong>${c.name}</strong></td><td><span class="badge ${c.severity === 'severe' ? 'badge-critical' : c.severity === 'moderate' ? 'badge-high' : 'badge-normal'}">${c.severity}</span></td><td>${c.diagnosed}</td><td>${c.notes || '—'}</td></tr>`).join('')}</tbody></table>
                </div>` : ''}
                ${r.allergies.length > 0 ? `<div><strong style="font-size:12px;">Allergies:</strong><div style="margin-top:6px;">${r.allergies.map(a => `<span style="display:inline-block;background:#f8d7da;color:#721c24;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;margin:2px 4px 2px 0;">${a}</span>`).join('')}</div></div>` : ''}
              </div>` : ''}

              ${notesHtml ? `<div class="section">
                <h2>Visit Notes</h2>
                ${notesHtml}
              </div>` : ''}

              ${r.photos.length > 0 ? `<div class="section">
                <h2>Photos</h2>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
                  ${r.photos.map(p => `<div style="text-align:center;"><img src="${p.url}" style="width:100%;max-height:200px;object-fit:cover;border-radius:8px;border:1px solid #dce8e0;" /><p style="font-size:11px;color:#666;margin-top:4px;">${p.title}${p.caption ? ` — ${p.caption}` : ''}</p></div>`).join('')}
                </div>
              </div>` : ''}

              ${hasFollowUp ? `<div class="section">
                <h2>Follow-Up</h2>
                <div class="followup">
                  <strong>Next Visit:</strong> ${r.followUp.nextVisitDate} — ${r.followUp.nextVisitReason}<br/>
                  ${r.followUp.notes ? `<strong>Notes:</strong> ${r.followUp.notes}` : ''}
                </div>
              </div>` : ''}

              <div class="footer">
                HugoIT Veterinary Management &mdash; Confidential Medical Record &mdash; ${today}<br/>
                <span style="font-size:10px;">Record created: ${r.createdAt} · Last modified: ${r.lastModified}</span>
              </div>

              <div class="no-print">
                <button onclick="window.print()" style="padding:10px 28px;background:#2d6a4f;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600;">Print / Save as PDF</button>
              </div>
              </body></html>`;

              const w = window.open('', '_blank');
              if (w) { w.document.write(html); w.document.close(); }
            }}
            className="gap-2"
            style={{ backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)' }}
          >
            <Download className="w-4 h-4" />
            Export PDF
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Share2 className="w-4 h-4" />
                Share
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCopyLink}>
                {linkCopied ? <Check className="w-4 h-4 mr-2 text-[var(--brand-green-text)]" /> : <Copy className="w-4 h-4 mr-2" />}
                {linkCopied ? 'Link Copied!' : 'Copy Link'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleEmailShare}>
                <Mail className="w-4 h-4 mr-2" />
                Email to Owner
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-2" />
                Print Record
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div style={{ position: 'relative' }}>
            <Button
              variant="outline"
              className="gap-2"
              style={{ borderColor: '#EF4444', color: '#EF4444' }}
              onClick={() => setDeleteConfirmOpen(true)}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
            {deleteConfirmOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40, backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setDeleteConfirmOpen(false)} />
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 50,
                  width: 320, padding: 20, borderRadius: 12,
                  backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 style={{ width: 18, height: 18, color: '#EF4444' }} />
                    </div>
                    <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Delete Record?</h4>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
                    This will permanently delete record <strong style={{ color: 'var(--text-primary)' }}>{record.id}</strong> and all associated data (vitals, diagnoses, treatments, medications, lab results). This action cannot be undone.
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setDeleteConfirmOpen(false)}
                      style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >Cancel</button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', backgroundColor: '#EF4444', color: '#fff', fontSize: 13, fontWeight: 700, cursor: deleting ? 'wait' : 'pointer', opacity: deleting ? 0.7 : 1 }}
                    >{deleting ? 'Deleting…' : 'Delete Record'}</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ───────── Section 1: Patient Info + Visit Details ───────── */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Patient Info */}
        <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6" style={{ borderRadius: '12px' }}>
          <SectionHeader icon={User} title="Patient Information" />
          <div className="flex items-center gap-4 mb-4">
            {record.patient.image ? (
              <img src={record.patient.image} alt={record.patient.name} className="w-16 h-16 object-cover" style={{ borderRadius: '9999px' }} />
            ) : (
              <div className="w-16 h-16 flex items-center justify-center text-white font-bold flex-shrink-0" style={{ borderRadius: '9999px', backgroundColor: 'var(--brand-green-text)', fontSize: '18px' }}>{record.patient.name.slice(0, 2).toUpperCase()}</div>
            )}
            <div>
              <p className="text-[var(--text-primary)]" style={{ fontSize: '20px', fontWeight: 700 }}>{record.patient.name}</p>
              <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{record.patient.species} • {record.patient.breed}</p>
            </div>
          </div>
          <Separator className="my-3" />
          <InfoRow label="Date of Birth" value={record.patient.dob} />
          <InfoRow label="Age" value={record.patient.age} />
          <InfoRow label="Sex" value={record.patient.sex} />
          <InfoRow label="Weight" value={record.patient.weight} />
          <InfoRow label="Color" value={record.patient.color} />
          <InfoRow label="Microchip" value={record.patient.microchip} />
        </div>

        {/* Visit Details */}
        <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6" style={{ borderRadius: '12px' }}>
          <SectionHeader icon={Stethoscope} title="Visit Details" />
          <InfoRow label="Date" value={record.visit.date} />
          <InfoRow label="Time" value={record.visit.time} />
          <InfoRow label="Reason for Visit" value={record.visit.reason} />
          <InfoRow label="Duration" value={record.visit.duration} />
          <Separator className="my-3" />
          <InfoRow label="Attending Veterinarian" value={record.visit.vet} />
          <InfoRow label="License Number" value={record.visit.vetLicense} />
          <Separator className="my-3" />
          <div className="flex items-center gap-2 mt-2">
            <MapPin className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{record.visit.clinic}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 pl-6">
            <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{record.visit.clinicAddress}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Phone className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{record.visit.clinicPhone}</span>
          </div>
        </div>
      </div>

      {/* Owner Info Strip */}
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-5 mb-6" style={{ borderRadius: '12px' }}>
        <div className="flex items-center gap-8 flex-wrap">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>Owner:</span>
            <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>{record.owner.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{record.owner.phone}</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{record.owner.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{record.owner.address}</span>
          </div>
        </div>
      </div>

      {/* ───────── Section 2: Vitals ───────── */}
      {[record.vitals.weight, record.vitals.temperature, record.vitals.heartRate, record.vitals.respiratoryRate].some(v => v && v !== '—') && (
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
        <SectionHeader icon={Activity} title="Vitals" />
        <div className="grid grid-cols-4 gap-4">
          {record.vitals.weight !== '—' && <VitalCard label="Weight" value={record.vitals.weight} icon={Scale} />}
          {record.vitals.temperature !== '—' && <VitalCard label="Temperature" value={record.vitals.temperature} icon={Thermometer} />}
          {record.vitals.heartRate !== '—' && <VitalCard label="Heart Rate" value={record.vitals.heartRate} icon={Heart} isAbnormal={parseInt(record.vitals.heartRate) > 100} />}
          {record.vitals.respiratoryRate !== '—' && <VitalCard label="Respiratory Rate" value={record.vitals.respiratoryRate} icon={Wind} isAbnormal={parseInt(record.vitals.respiratoryRate) > 24} />}
          {record.vitals.bloodPressure !== '—' && <VitalCard label="Blood Pressure" value={record.vitals.bloodPressure} icon={Gauge} isAbnormal={parseInt(record.vitals.bloodPressure) > 140} />}
          {record.vitals.bodyConditionScore !== '—' && <VitalCard label="Body Condition" value={record.vitals.bodyConditionScore} icon={Activity} />}
          {record.vitals.painScore !== '—' && <VitalCard label="Pain Score" value={record.vitals.painScore} icon={AlertTriangle} isAbnormal={parseInt(record.vitals.painScore) > 3} />}
          {record.vitals.hydrationStatus !== '—' && <VitalCard label="Hydration" value={record.vitals.hydrationStatus} icon={Activity} />}
        </div>
      </div>
      )}

      {/* ───────── Section 3: Diagnosis ───────── */}
      {record.diagnosis.primary && record.diagnosis.primary !== '—' && (
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
        <SectionHeader icon={Stethoscope} title="Diagnosis" />
        <div className="mb-4">
          <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Primary Diagnosis</span>
          <p className="text-[var(--text-primary)] mt-1" style={{ fontSize: '16px', fontWeight: 600 }}>{record.diagnosis.primary}</p>
        </div>
        {record.diagnosis.secondary.length > 0 && (
          <div className="mb-4">
            <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Secondary Findings</span>
            <ul className="mt-1 space-y-1">
              {record.diagnosis.secondary.map((s, i) => (
                <li key={i} className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] mt-0.5 flex-shrink-0" />
                  <span className="text-[var(--text-primary)]" style={{ fontSize: '14px' }}>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {record.diagnosis.notes && (
          <>
            <Separator className="my-4" />
            <div className="mb-4">
              <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Clinical Notes</span>
              <p className="text-[var(--text-primary)] mt-2 leading-relaxed" style={{ fontSize: '14px' }}>{record.diagnosis.notes}</p>
            </div>
          </>
        )}
        {record.diagnosis.icdCodes.length > 0 && (
          <>
            <Separator className="my-4" />
            <div>
              <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ICD Codes</span>
              <div className="mt-2 overflow-x-auto">
                <Table>
                  <TableHeader><TableRow className="hover:bg-transparent">
                    <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Code</TableHead>
                    <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Description</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {record.diagnosis.icdCodes.map((code, i) => (
                      <TableRow key={i} className="hover:bg-[var(--surface-elevated)]">
                        <TableCell className="py-2 px-3"><span className="inline-block px-2 py-0.5 bg-[var(--surface-elevated)] text-[var(--text-primary)]" style={{ borderRadius: '4px', fontSize: '13px', fontWeight: 600, fontFamily: 'monospace' }}>{code.code}</span></TableCell>
                        <TableCell className="py-2 px-3"><span className="text-[var(--text-primary)]" style={{ fontSize: '13px' }}>{code.description}</span></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}
      </div>
      )}

      {/* ───────── Section 4: Treatment Plan ───────── */}
      {(record.treatmentPlan.procedures.length > 0 || record.treatmentPlan.instructions || record.treatmentPlan.homeCarePlan) && (
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
        <SectionHeader icon={FileText} title="Treatment Plan" />
        {record.treatmentPlan.procedures.length > 0 && (
          <div className="mb-5 overflow-x-auto">
            <span className="text-[var(--text-secondary)] block mb-2" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Procedures</span>
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent">
                <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Procedure</TableHead>
                <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Notes</TableHead>
                <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {record.treatmentPlan.procedures.map((proc, i) => (
                  <TableRow key={i} className="hover:bg-[var(--surface-elevated)]">
                    <TableCell className="py-2 px-3"><span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 500 }}>{proc.name}</span></TableCell>
                    <TableCell className="py-2 px-3"><span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{proc.notes}</span></TableCell>
                    <TableCell className="py-2 px-3"><span className="inline-block px-2 py-0.5" style={{ backgroundColor: proc.status === 'Completed' ? '#74C69D20' : '#F4A26120', color: proc.status === 'Completed' ? 'var(--brand-green-text)' : '#F4A261', borderRadius: '9999px', fontSize: '12px', fontWeight: 600 }}>{proc.status}</span></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {record.treatmentPlan.instructions && (
          <><Separator className="my-4" /><div className="mb-4">
            <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Post-Visit Instructions</span>
            <p className="text-[var(--text-primary)] mt-2 leading-relaxed" style={{ fontSize: '14px' }}>{record.treatmentPlan.instructions}</p>
          </div></>
        )}
        {record.treatmentPlan.restrictions.length > 0 && (
          <div className="mb-4">
            <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Activity Restrictions</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {record.treatmentPlan.restrictions.map((r, i) => (
                <span key={i} className="inline-block px-3 py-1 border border-[var(--border-color)] text-[var(--text-primary)]" style={{ borderRadius: '8px', fontSize: '13px' }}>{r}</span>
              ))}
            </div>
          </div>
        )}
        {record.treatmentPlan.homeCarePlan && (
          <div>
            <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Home Care Plan</span>
            <p className="text-[var(--text-primary)] mt-2 leading-relaxed" style={{ fontSize: '14px' }}>{record.treatmentPlan.homeCarePlan}</p>
          </div>
        )}
      </div>
      )}

      {/* ───────── Section 5: Medications ───────── */}
      {record.medications.length > 0 && (
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
        <SectionHeader icon={Pill} title="Medications Prescribed" />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="hover:bg-transparent">
              {['Medication', 'Dosage', 'Frequency', 'Route', 'Duration', 'Start Date', 'Notes'].map((h) => (
                <TableHead key={h} className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</TableHead>
              ))}
            </TableRow></TableHeader>
            <TableBody>
              {record.medications.map((med, i) => (
                <TableRow key={i} className="hover:bg-[var(--surface-elevated)]">
                  <TableCell className="py-3 px-3"><span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>{med.name}</span></TableCell>
                  <TableCell className="py-3 px-3"><span className="text-[var(--text-primary)]" style={{ fontSize: '13px' }}>{med.dosage}</span></TableCell>
                  <TableCell className="py-3 px-3"><span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{med.frequency}</span></TableCell>
                  <TableCell className="py-3 px-3"><span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{med.route}</span></TableCell>
                  <TableCell className="py-3 px-3"><span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{med.duration}</span></TableCell>
                  <TableCell className="py-3 px-3"><span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{med.startDate}</span></TableCell>
                  <TableCell className="py-3 px-3 max-w-[200px]"><span className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>{med.notes}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      )}

      {/* ───────── Section 6: Lab Results ───────── */}
      {record.labResults.length > 0 && (
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
        <SectionHeader icon={FlaskConical} title="Lab Results" />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="hover:bg-transparent">
              {['Test', 'Result', 'Reference Range', 'Unit', 'Flag'].map((h) => (
                <TableHead key={h} className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</TableHead>
              ))}
            </TableRow></TableHeader>
            <TableBody>
              {record.labResults.map((lab, i) => {
                const flagStyle = labFlagColors[lab.flag];
                return (
                  <TableRow key={i} className="hover:bg-[var(--surface-elevated)]">
                    <TableCell className="py-2.5 px-3"><span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 500 }}>{lab.testName}</span></TableCell>
                    <TableCell className="py-2.5 px-3"><span style={{ fontSize: '14px', fontWeight: 600, color: flagStyle.text }}>{lab.result}</span></TableCell>
                    <TableCell className="py-2.5 px-3"><span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{lab.referenceRange}</span></TableCell>
                    <TableCell className="py-2.5 px-3"><span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{lab.unit}</span></TableCell>
                    <TableCell className="py-2.5 px-3"><span className="inline-block px-2 py-0.5" style={{ backgroundColor: flagStyle.bg, color: flagStyle.text, borderRadius: '9999px', fontSize: '12px', fontWeight: 600 }}>{flagStyle.label}</span></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
      )}

      {/* ───────── Section 7: Vaccinations ───────── */}
      {record.vaccinations.length > 0 && (
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
        <SectionHeader icon={Syringe} title="Vaccinations" />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="hover:bg-transparent">
              {['Vaccine', 'Manufacturer', 'Lot #', 'Injection Site', 'Date', 'Next Due', 'Notes'].map((h) => (
                <TableHead key={h} className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</TableHead>
              ))}
            </TableRow></TableHeader>
            <TableBody>
              {record.vaccinations.map((v, i) => (
                <TableRow key={i} className="hover:bg-[var(--surface-elevated)]">
                  <TableCell className="py-3 px-3"><span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>{v.name}</span></TableCell>
                  <TableCell className="py-3 px-3"><span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{v.manufacturer}</span></TableCell>
                  <TableCell className="py-3 px-3"><span className="text-[var(--text-secondary)]" style={{ fontSize: '13px', fontFamily: 'monospace' }}>{v.lotNumber}</span></TableCell>
                  <TableCell className="py-3 px-3"><span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{v.site}</span></TableCell>
                  <TableCell className="py-3 px-3"><span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{v.date}</span></TableCell>
                  <TableCell className="py-3 px-3"><span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{v.nextDue}</span></TableCell>
                  <TableCell className="py-3 px-3 max-w-[200px]"><span className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>{v.notes}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      )}

      {/* ───────── Section 8: Imaging Studies ───────── */}
      {record.imagingStudies.length > 0 && (
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
        <SectionHeader icon={Image} title="Imaging Studies" />
        <div className="space-y-4">
          {record.imagingStudies.map((study, i) => (
            <div key={i} className="border border-[var(--border-color)] p-4" style={{ borderRadius: '10px' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[var(--text-primary)]" style={{ fontSize: '15px', fontWeight: 600 }}>{study.title}</span>
                <span className="inline-block px-2 py-0.5" style={{ backgroundColor: study.status === 'reviewed' ? '#74C69D20' : '#F4A26120', color: study.status === 'reviewed' ? 'var(--brand-green-text)' : '#F4A261', borderRadius: '9999px', fontSize: '12px', fontWeight: 600 }}>{study.status}</span>
              </div>
              <p className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{study.modality} · {study.region} · {study.date}</p>
              {study.findings && <div className="mt-3 p-3 bg-[var(--surface-elevated)]" style={{ borderRadius: '8px', borderLeft: '3px solid var(--brand-green-text)' }}><span className="text-[var(--text-secondary)]" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>Findings</span><p className="text-[var(--text-primary)] mt-1" style={{ fontSize: '13px' }}>{study.findings}</p></div>}
              {study.impression && <p className="text-[var(--text-secondary)] mt-2" style={{ fontSize: '13px' }}><strong>Impression:</strong> {study.impression}</p>}
              {study.images.length > 0 && <div className="flex gap-2 mt-3">{study.images.map((img, j) => (<img key={j} src={img.url} alt={img.label} className="object-cover" style={{ width: 100, height: 100, borderRadius: 8, border: '1px solid var(--border-color)' }} />))}</div>}
            </div>
          ))}
        </div>
      </div>
      )}

      {/* ───────── Section 9: Surgeries ───────── */}
      {record.surgeries.length > 0 && (
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
        <SectionHeader icon={Scissors} title="Surgeries" />
        <div className="space-y-4">
          {record.surgeries.map((s, i) => (
            <div key={i} className="border border-[var(--border-color)] p-4" style={{ borderRadius: '10px' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[var(--text-primary)]" style={{ fontSize: '15px', fontWeight: 600 }}>{s.name}</span>
                <span className="inline-block px-2 py-0.5" style={{ backgroundColor: s.status === 'Recovered' ? '#74C69D20' : s.status === 'Complications' ? '#d4183d20' : '#F4A26120', color: s.status === 'Recovered' ? 'var(--brand-green-text)' : s.status === 'Complications' ? '#d4183d' : '#F4A261', borderRadius: '9999px', fontSize: '12px', fontWeight: 600 }}>{s.status}</span>
              </div>
              <p className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{s.date} · {s.duration}{s.anesthesia !== '—' ? ` · Anesthesia: ${s.anesthesia}` : ''}</p>
              {s.procedureNotes && <div className="mt-3 p-3 bg-[var(--surface-elevated)]" style={{ borderRadius: '8px', borderLeft: '3px solid var(--brand-green-text)' }}><span className="text-[var(--text-secondary)]" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>Procedure Notes</span><p className="text-[var(--text-primary)] mt-1" style={{ fontSize: '13px' }}>{s.procedureNotes}</p></div>}
              {s.postOp && <p className="text-[var(--text-secondary)] mt-2" style={{ fontSize: '13px' }}><strong>Post-Op:</strong> {s.postOp}</p>}
              {s.complications && <p className="mt-2" style={{ fontSize: '13px', color: '#d4183d' }}><strong>Complications:</strong> {s.complications}</p>}
            </div>
          ))}
        </div>
      </div>
      )}

      {/* ───────── Section 10: Treatment Plans ───────── */}
      {record.treatmentPlans.length > 0 && (
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
        <SectionHeader icon={ClipboardList} title="Treatment Plans" />
        <div className="space-y-4">
          {record.treatmentPlans.map((plan, i) => (
            <div key={i} className="border border-[var(--border-color)] p-4" style={{ borderRadius: '10px' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[var(--text-primary)]" style={{ fontSize: '15px', fontWeight: 600 }}>{plan.title}</span>
                <span className="inline-block px-2 py-0.5" style={{ backgroundColor: '#74C69D20', color: 'var(--brand-green-text)', borderRadius: '9999px', fontSize: '12px', fontWeight: 600 }}>{plan.status}</span>
              </div>
              {plan.goals.length > 0 && <div className="mt-3"><span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Goals</span><div className="mt-2 space-y-2">{plan.goals.map((g, j) => (<div key={j} className="flex items-center gap-3"><div className="flex-1"><p className="text-[var(--text-primary)]" style={{ fontSize: '13px' }}>{g.text}</p><div className="mt-1 h-1.5 w-full bg-[var(--surface-elevated)]" style={{ borderRadius: 4 }}><div style={{ width: `${g.progress}%`, height: '100%', backgroundColor: 'var(--brand-green-text)', borderRadius: 4 }} /></div></div><span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600 }}>{g.progress}%</span></div>))}</div></div>}
              {plan.medications.length > 0 && <div className="mt-3"><span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Plan Medications</span><div className="mt-1 space-y-1">{plan.medications.map((m, j) => (<p key={j} className="text-[var(--text-primary)]" style={{ fontSize: '13px' }}><strong>{m.name}</strong> {m.dose} — <em className="text-[var(--text-secondary)]">{m.purpose}</em></p>))}</div></div>}
              {plan.notes && <p className="text-[var(--text-secondary)] mt-3" style={{ fontSize: '13px' }}>{plan.notes}</p>}
            </div>
          ))}
        </div>
      </div>
      )}

      {/* ───────── Section 11: Diet & Nutrition ───────── */}
      {record.dietPlans.length > 0 && (
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
        <SectionHeader icon={Utensils} title="Diet & Nutrition" />
        <div className="space-y-4">
          {record.dietPlans.map((d, i) => (
            <div key={i} className="border border-[var(--border-color)] p-4" style={{ borderRadius: '10px' }}>
              <span className="text-[var(--text-primary)]" style={{ fontSize: '15px', fontWeight: 600 }}>{d.food}</span>
              <span className="text-[var(--text-secondary)] ml-2" style={{ fontSize: '13px' }}>({d.foodType})</span>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <div><span className="text-[var(--text-secondary)]" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>Amount</span><p className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>{d.amount}</p></div>
                <div><span className="text-[var(--text-secondary)]" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>Meals</span><p className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>{d.meals}</p></div>
                <div><span className="text-[var(--text-secondary)]" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>Calories</span><p className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>{d.calories}</p></div>
              </div>
              {d.targetWeight !== '—' && <p className="text-[var(--text-secondary)] mt-2" style={{ fontSize: '13px' }}>Target Weight: <strong className="text-[var(--text-primary)]">{d.targetWeight}</strong></p>}
              {d.restrictions.length > 0 && <div className="mt-3"><span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Restrictions</span><div className="flex flex-wrap gap-2 mt-1">{d.restrictions.map((rx, j) => (<span key={j} className="inline-block px-2.5 py-1" style={{ backgroundColor: '#FEF3C720', border: '1px solid #F59E0B40', color: '#92400E', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>{rx.item}</span>))}</div></div>}
              {d.notes && <p className="text-[var(--text-secondary)] mt-3" style={{ fontSize: '13px' }}>{d.notes}</p>}
            </div>
          ))}
        </div>
      </div>
      )}

      {/* ───────── Section 12: Conditions & Allergies ───────── */}
      {(record.conditions.length > 0 || record.allergies.length > 0) && (
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
        <SectionHeader icon={Shield} title="Medical Conditions & Allergies" />
        {record.conditions.length > 0 && (
          <div className="mb-4">
            <span className="text-[var(--text-secondary)] block mb-2" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Conditions</span>
            <div className="overflow-x-auto">
              <Table><TableHeader><TableRow className="hover:bg-transparent">
                {['Condition', 'Severity', 'Diagnosed', 'Notes'].map((h) => (<TableHead key={h} className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</TableHead>))}
              </TableRow></TableHeader><TableBody>
                {record.conditions.map((c, i) => (<TableRow key={i} className="hover:bg-[var(--surface-elevated)]">
                  <TableCell className="py-2 px-3"><span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>{c.name}</span></TableCell>
                  <TableCell className="py-2 px-3"><span className="inline-block px-2 py-0.5" style={{ backgroundColor: c.severity === 'severe' ? '#d4183d20' : c.severity === 'moderate' ? '#F4A26120' : '#74C69D20', color: c.severity === 'severe' ? '#d4183d' : c.severity === 'moderate' ? '#F4A261' : 'var(--brand-green-text)', borderRadius: '9999px', fontSize: '12px', fontWeight: 600 }}>{c.severity}</span></TableCell>
                  <TableCell className="py-2 px-3"><span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{c.diagnosed}</span></TableCell>
                  <TableCell className="py-2 px-3"><span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{c.notes}</span></TableCell>
                </TableRow>))}
              </TableBody></Table>
            </div>
          </div>
        )}
        {record.allergies.length > 0 && (
          <div>
            <span className="text-[var(--text-secondary)] block mb-2" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Allergies</span>
            <div className="flex flex-wrap gap-2">
              {record.allergies.map((a, i) => (<span key={i} className="inline-block px-3 py-1" style={{ backgroundColor: '#FEE2E220', border: '1px solid #EF444440', color: '#991B1B', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>{a}</span>))}
            </div>
          </div>
        )}
      </div>
      )}

      {/* ───────── Section 13: Visit Notes ───────── */}
      {record.visitNotes.length > 0 && (
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
        <SectionHeader icon={StickyNote} title="Visit Notes" />
        <div className="space-y-3">
          {record.visitNotes.map((n, i) => (
            <div key={i} className="p-4" style={{ borderRadius: '8px', borderLeft: `3px solid ${n.type === 'vet' ? 'var(--brand-green-text)' : '#3B82F6'}`, backgroundColor: 'var(--surface-elevated)' }}>
              <span className="text-[var(--text-secondary)]" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{n.type === 'vet' ? 'Vet Note' : 'Client Note'} — {n.date}</span>
              <p className="text-[var(--text-primary)] mt-2" style={{ fontSize: '14px', whiteSpace: 'pre-wrap' }}>{n.content}</p>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* ───────── Section 14: Photos ───────── */}
      {record.photos.length > 0 && (
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
        <SectionHeader icon={Camera} title="Photos" />
        <div className="grid grid-cols-4 gap-3">
          {record.photos.map((p, i) => (
            <div key={i} className="text-center">
              <img src={p.url} alt={p.title} className="w-full object-cover" style={{ height: 140, borderRadius: 10, border: '1px solid var(--border-color)' }} />
              <p className="text-[var(--text-primary)] mt-2" style={{ fontSize: '12px', fontWeight: 600 }}>{p.title}</p>
              {p.caption && <p className="text-[var(--text-secondary)]" style={{ fontSize: '11px' }}>{p.caption}</p>}
            </div>
          ))}
        </div>
      </div>
      )}

      {/* ───────── Section 15: Follow-Up ───────── */}
      {record.followUp.nextVisitDate !== '—' && (
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
        <SectionHeader icon={CalendarCheck} title="Follow-Up" />
        <div className="grid grid-cols-2 gap-6">
          <div>
            <InfoRow label="Next Visit Date" value={record.followUp.nextVisitDate} />
            <InfoRow label="Reason" value={record.followUp.nextVisitReason} />
            <InfoRow label="Reminder Set" value={record.followUp.reminderSet ? 'Yes' : 'No'} />
          </div>
          {record.followUp.notes && (
          <div>
            <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Additional Notes</span>
            <p className="text-[var(--text-primary)] mt-2 leading-relaxed" style={{ fontSize: '14px' }}>{record.followUp.notes}</p>
          </div>
          )}
        </div>
      </div>
      )}

      {/* ───────── Footer: Metadata ───────── */}
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6" style={{ borderRadius: '12px' }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--text-secondary)]" />
              <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>Created: {record.createdAt}</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--text-secondary)]" />
              <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>Last Modified: {record.lastModified} by {record.modifiedBy}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
