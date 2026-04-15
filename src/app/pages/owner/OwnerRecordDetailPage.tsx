import { useParams, Link, useNavigate } from 'react-router';
import { useState, useEffect } from 'react';
import {
  ArrowLeft, Download, Printer, Copy, Check,
  Heart, Thermometer, Activity, Wind, Gauge, Scale,
  Stethoscope, Pill, FlaskConical, CalendarCheck, FileText,
  AlertTriangle, ChevronRight, Clock, MapPin, Phone, User, Lock,
  Clock3, Mail,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Separator } from '../../components/ui/separator';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '../../components/ui/table';
import { supabase } from '../../../lib/supabase';

// ─── Types ───────────────────────────────────────────────────

type RecordType = 'Visit' | 'Vaccination' | 'Lab Result' | 'Surgery' | 'Prescription' | 'Dental' | 'Imaging';
type RecordStatus = 'Final' | 'Pending Vet Review' | 'In Progress';
type LabFlag = 'normal' | 'high' | 'low' | 'critical';

interface DetailedRecord {
  id: string;
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

const statusColors: Record<RecordStatus, { bg: string; text: string; border: string }> = {
  'Final':              { bg: '#74C69D20', text: 'var(--brand-green-text)', border: '#74C69D40' },
  'Pending Vet Review': { bg: '#F4A26118', text: '#D97706',                 border: '#F4A26140' },
  'In Progress':        { bg: '#3B82F615', text: '#3B82F6',                 border: '#3B82F630' },
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

export default function OwnerRecordDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<DetailedRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);

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
        const visitDate = new Date(data.visit_date + 'T12:00:00');
        const meds: DetailedRecord['medications'] = await (async () => {
          try {
            const { data: medsData } = await supabase
              .from('medications')
              .select('name, dosage, frequency, route, duration_days, start_date, notes')
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
        })();
        const labs: DetailedRecord['labResults'] = await (async () => {
          try {
            const { data: labsData } = await supabase
              .from('lab_results')
              .select('test_name, result_value, reference_range, unit, flag, tested_at')
              .eq('record_id', data.id);
            if (labsData && labsData.length > 0) {
              const flagMap: Record<string, LabFlag> = { normal: 'normal', high: 'high', low: 'low', critical: 'critical' };
              return labsData.map((l: any) => ({
                testName: l.test_name || '—',
                result: l.result_value || 'Pending',
                referenceRange: l.reference_range || '—',
                unit: l.unit || '',
                flag: flagMap[l.flag] || 'normal',
                date: l.tested_at ? new Date(l.tested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
              }));
            }
            return [];
          } catch { return []; }
        })();
        setRecord({
          id: data.id,
          recordNumber: data.record_number || `VT-${data.id.slice(0, 8).toUpperCase()}`,
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
            const temp = rv?.temperature_c ? String((rv.temperature_c * 9 / 5 + 32).toFixed(1)) : null;
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
          medications: meds,
          labResults: labs,
          followUp: {
            nextVisitDate: data.follow_up_date ? new Date(data.follow_up_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
            nextVisitReason: data.follow_up_reason ?? '—',
            notes: data.follow_up_notes ?? '',
            reminderSet: !!data.follow_up_date,
          },
          createdAt: new Date(data.created_at).toLocaleString(),
          lastModified: new Date(data.updated_at).toLocaleString(),
          modifiedBy: '—',
        });
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: 'var(--brand-green-text)', borderRadius: '50%' }} />
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading record…</p>
      </div>
    );
  }

  if (!record) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        <FileText style={{ width: 48, height: 48, color: 'var(--text-secondary)', opacity: 0.5 }} />
        <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>Record not found</p>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>This record may have been removed or you don't have access.</p>
        <button
          onClick={() => navigate('/owner/records')}
          style={{ padding: '10px 20px', borderRadius: '10px', backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
        >
          ← Back to My Records
        </button>
      </div>
    );
  }

  const typeStyle = recordTypeColors[record.visit.recordType];
  const sttStyle  = statusColors[record.visit.status];
  const isLocked  = record.visit.status === 'Pending Vet Review' || record.visit.status === 'In Progress';

  // ── Locked / In-progress gate ────────────────────────────
  if (isLocked) {
    const isPendingReview = record.visit.status === 'Pending Vet Review';
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
        <div style={{ backgroundColor: 'var(--surface-white)', borderRadius: '20px', maxWidth: '480px', width: '100%', overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.10)', textAlign: 'center' }}>
          {/* Top accent */}
          <div style={{ height: 5, background: isPendingReview ? 'linear-gradient(90deg, #F4A261, #D97706)' : 'linear-gradient(90deg, #3B82F6, #8B5CF6)' }} />
          <div style={{ padding: '40px 36px 36px' }}>
            {/* Icon */}
            <div style={{ width: 72, height: 72, borderRadius: '50%', backgroundColor: isPendingReview ? '#F4A26118' : '#3B82F615', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              {isPendingReview
                ? <Lock style={{ width: 32, height: 32, color: '#D97706' }} />
                : <Clock3 style={{ width: 32, height: 32, color: '#3B82F6' }} />
              }
            </div>
            {/* Title */}
            <p style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px' }}>
              {isPendingReview ? 'Record Pending Vet Review' : 'Results In Progress'}
            </p>
            {/* Status badge */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '5px 14px', borderRadius: '9999px', fontSize: '13px', fontWeight: 700,
              backgroundColor: sttStyle.bg, color: sttStyle.text, border: `1px solid ${sttStyle.border}`,
              marginBottom: '18px',
            }}>
              {isPendingReview ? <Lock style={{ width: 12, height: 12 }} /> : <Clock3 style={{ width: 12, height: 12 }} />}
              {record.visit.status}
            </span>
            {/* Message */}
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '28px' }}>
              {isPendingReview
                ? 'This record is being reviewed by your veterinarian before it becomes available to you. You\'ll be notified once it\'s approved and ready to view.'
                : 'Your lab results are currently being processed. This usually takes 24–48 hours. You\'ll receive a notification once they\'re ready and reviewed by your vet.'
              }
            </p>
            {/* Record info pill */}
            <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-color)', marginBottom: '24px', display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                🐾 <strong style={{ color: 'var(--text-primary)' }}>{record.patient.name}</strong>
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                📋 {record.visit.recordType}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                📅 {record.visit.date}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                👩‍⚕️ {record.visit.vet}
              </span>
            </div>
            {/* CTA */}
            <button
              onClick={() => navigate('/owner/records')}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)', border: 'none', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
            >
              ← Back to My Records
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleCopyLink = () => {
    const url = `${window.location.origin}/owner/records/${id}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div className="max-w-[1200px] mx-auto p-8">
      {/* Back Link */}
      <Link
        to="/owner/records"
        className="inline-flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-green-text)] transition-colors mb-6"
        style={{ fontSize: '14px' }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Records
      </Link>

      {/* Header accent bar */}
      <div style={{ height: 4, borderRadius: '4px 4px 0 0', background: 'linear-gradient(90deg, var(--brand-green-text), #52B788)', marginBottom: '-1px' }} />

      {/* Header card */}
      <div
        className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-8"
        style={{ borderRadius: '0 0 12px 12px' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-[var(--text-primary)]" style={{ fontSize: '28px', fontWeight: 700 }}>{record.recordNumber}</h1>
              <span className="inline-block px-3 py-1" style={{ backgroundColor: typeStyle.bg, color: typeStyle.text, borderRadius: '9999px', fontSize: '13px', fontWeight: 600 }}>
                {record.visit.recordType}
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1" style={{ backgroundColor: sttStyle.bg, color: sttStyle.text, border: `1px solid ${sttStyle.border}`, borderRadius: '9999px', fontSize: '13px', fontWeight: 700 }}>
                {record.visit.status}
              </span>
              {/* Read Only badge */}
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1"
                style={{ backgroundColor: '#6B728015', color: 'var(--text-secondary)', borderRadius: '9999px', fontSize: '12px', fontWeight: 600, border: '1px solid var(--border-color)' }}
              >
                <Lock className="w-3 h-3" />
                Read Only
              </span>
            </div>
            <p className="text-[var(--text-secondary)]" style={{ fontSize: '15px' }}>
              {record.patient.name} • {record.visit.reason} • {record.visit.date}
            </p>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={() => window.print()}
              className="gap-2"
              style={{ backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)' }}
            >
              <Download className="w-4 h-4" />
              Download PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => window.print()}
              className="gap-2"
            >
              <Printer className="w-4 h-4" />
              Print
            </Button>
            <Button
              variant="outline"
              onClick={handleCopyLink}
              className="gap-2"
            >
              {linkCopied
                ? <><Check className="w-4 h-4 text-[var(--brand-green-text)]" /> Copied!</>
                : <><Copy className="w-4 h-4" /> Copy Link</>
              }
            </Button>
          </div>
        </div>
      </div>

      {/* ───────── Section 1: Patient Info + Visit Details ───────── */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Patient Info */}
        <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6" style={{ borderRadius: '12px' }}>
          <SectionHeader icon={User} title="Patient Information" />
          <div className="flex items-center gap-4 mb-4">
            <img src={record.patient.image} alt={record.patient.name} className="w-16 h-16 object-cover" style={{ borderRadius: '9999px' }} />
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
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
        <SectionHeader icon={Activity} title="Vitals" />
        <div className="grid grid-cols-4 gap-4">
          <VitalCard label="Weight" value={record.vitals.weight} icon={Scale} />
          <VitalCard label="Temperature" value={record.vitals.temperature} icon={Thermometer} />
          <VitalCard label="Heart Rate" value={record.vitals.heartRate} icon={Heart} isAbnormal={parseInt(record.vitals.heartRate) > 100} />
          <VitalCard label="Respiratory Rate" value={record.vitals.respiratoryRate} icon={Wind} isAbnormal={parseInt(record.vitals.respiratoryRate) > 24} />
          <VitalCard label="Blood Pressure" value={record.vitals.bloodPressure} icon={Gauge} isAbnormal={parseInt(record.vitals.bloodPressure) > 140} />
          <VitalCard label="Body Condition" value={record.vitals.bodyConditionScore} icon={Activity} />
          <VitalCard label="Pain Score" value={record.vitals.painScore} icon={AlertTriangle} isAbnormal={parseInt(record.vitals.painScore) > 3} />
          <VitalCard label="Hydration" value={record.vitals.hydrationStatus} icon={Activity} />
        </div>
      </div>

      {/* ───────── Section 3: Diagnosis ───────── */}
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

        {record.diagnosis.differentials.length > 0 && (
          <div className="mb-4">
            <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Differential Diagnoses</span>
            <ul className="mt-1 space-y-1">
              {record.diagnosis.differentials.map((d, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>•</span>
                  <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Separator className="my-4" />

        <div className="mb-4">
          <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Clinical Notes</span>
          <p className="text-[var(--text-primary)] mt-2 leading-relaxed" style={{ fontSize: '14px' }}>{record.diagnosis.notes}</p>
        </div>

        <Separator className="my-4" />

        <div>
          <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ICD Codes</span>
          <div className="mt-2 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Code</TableHead>
                  <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {record.diagnosis.icdCodes.map((code, i) => (
                  <TableRow key={i} className="hover:bg-[var(--surface-elevated)]">
                    <TableCell className="py-2 px-3">
                      <span className="inline-block px-2 py-0.5 bg-[var(--surface-elevated)] text-[var(--text-primary)]" style={{ borderRadius: '4px', fontSize: '13px', fontWeight: 600, fontFamily: 'monospace' }}>{code.code}</span>
                    </TableCell>
                    <TableCell className="py-2 px-3">
                      <span className="text-[var(--text-primary)]" style={{ fontSize: '13px' }}>{code.description}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* ───────── Section 4: Treatment Plan ───────── */}
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
        <SectionHeader icon={FileText} title="Treatment Plan" />

        <div className="mb-5 overflow-x-auto">
          <span className="text-[var(--text-secondary)] block mb-2" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Procedures</span>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Procedure</TableHead>
                <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Notes</TableHead>
                <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {record.treatmentPlan.procedures.map((proc, i) => (
                <TableRow key={i} className="hover:bg-[var(--surface-elevated)]">
                  <TableCell className="py-2 px-3">
                    <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 500 }}>{proc.name}</span>
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{proc.notes}</span>
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    <span className="inline-block px-2 py-0.5" style={{
                      backgroundColor: proc.status === 'Completed' ? '#74C69D20' : proc.status === 'Scheduled' ? '#3B82F620' : '#F4A26120',
                      color: proc.status === 'Completed' ? 'var(--brand-green-text)' : proc.status === 'Scheduled' ? '#3B82F6' : '#F4A261',
                      borderRadius: '9999px', fontSize: '12px', fontWeight: 600,
                    }}>
                      {proc.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Separator className="my-4" />

        <div className="mb-4">
          <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Post-Visit Instructions</span>
          <p className="text-[var(--text-primary)] mt-2 leading-relaxed" style={{ fontSize: '14px' }}>{record.treatmentPlan.instructions}</p>
        </div>

        <div className="mb-4">
          <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Activity Restrictions</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {record.treatmentPlan.restrictions.map((r, i) => (
              <span key={i} className="inline-block px-3 py-1 border border-[var(--border-color)] text-[var(--text-primary)]" style={{ borderRadius: '8px', fontSize: '13px' }}>
                {r}
              </span>
            ))}
          </div>
        </div>

        <div>
          <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Home Care Plan</span>
          <p className="text-[var(--text-primary)] mt-2 leading-relaxed" style={{ fontSize: '14px' }}>{record.treatmentPlan.homeCarePlan}</p>
        </div>
      </div>

      {/* ───────── Section 5: Medications ───────── */}
      {record.medications.length > 0 && (
        <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
          <SectionHeader icon={Pill} title="Medications" />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {['Medication', 'Dosage', 'Frequency', 'Route', 'Duration', 'Start Date', 'Notes'].map((h) => (
                    <TableHead key={h} className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {record.medications.map((med, i) => (
                  <TableRow key={i} className="hover:bg-[var(--surface-elevated)]">
                    <TableCell className="py-3 px-3">
                      <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>{med.name}</span>
                    </TableCell>
                    <TableCell className="py-3 px-3">
                      <span className="text-[var(--text-primary)]" style={{ fontSize: '13px' }}>{med.dosage}</span>
                    </TableCell>
                    <TableCell className="py-3 px-3">
                      <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{med.frequency}</span>
                    </TableCell>
                    <TableCell className="py-3 px-3">
                      <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{med.route}</span>
                    </TableCell>
                    <TableCell className="py-3 px-3">
                      <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{med.duration}</span>
                    </TableCell>
                    <TableCell className="py-3 px-3">
                      <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{med.startDate}</span>
                    </TableCell>
                    <TableCell className="py-3 px-3 max-w-[200px]">
                      <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>{med.notes}</span>
                    </TableCell>
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
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {['Test', 'Result', 'Reference Range', 'Unit', 'Flag'].map((h) => (
                    <TableHead key={h} className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {record.labResults.map((lab, i) => {
                  const flagStyle = labFlagColors[lab.flag];
                  return (
                    <TableRow key={i} className="hover:bg-[var(--surface-elevated)]">
                      <TableCell className="py-2.5 px-3">
                        <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 500 }}>{lab.testName}</span>
                      </TableCell>
                      <TableCell className="py-2.5 px-3">
                        <span style={{ fontSize: '14px', fontWeight: 600, color: flagStyle.text }}>{lab.result}</span>
                      </TableCell>
                      <TableCell className="py-2.5 px-3">
                        <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{lab.referenceRange}</span>
                      </TableCell>
                      <TableCell className="py-2.5 px-3">
                        <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{lab.unit}</span>
                      </TableCell>
                      <TableCell className="py-2.5 px-3">
                        <span className="inline-block px-2 py-0.5" style={{ backgroundColor: flagStyle.bg, color: flagStyle.text, borderRadius: '9999px', fontSize: '12px', fontWeight: 600 }}>
                          {flagStyle.label}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ───────── Section 7: Follow-Up ───────── */}
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
        <SectionHeader icon={CalendarCheck} title="Follow-Up" />
        <div className="grid grid-cols-2 gap-6">
          <div>
            <InfoRow label="Next Visit Date" value={record.followUp.nextVisitDate} />
            <InfoRow label="Reason" value={record.followUp.nextVisitReason} />
            <InfoRow label="Reminder Set" value={record.followUp.reminderSet ? 'Yes' : 'No'} />
          </div>
          <div>
            <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Additional Notes</span>
            <p className="text-[var(--text-primary)] mt-2 leading-relaxed" style={{ fontSize: '14px' }}>{record.followUp.notes}</p>
          </div>
        </div>
      </div>

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
