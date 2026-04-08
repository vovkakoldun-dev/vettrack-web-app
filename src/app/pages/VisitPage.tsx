import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useActiveVisit } from '../context/ActiveVisitContext';
import {
  ArrowLeft, ClipboardList, ChevronRight,
  Scale, Thermometer, Heart, Activity, AlertCircle,
  Plus, X, Timer, ExternalLink,
  CheckSquare, Phone, Pill, FlaskConical, Bell, Calendar, FileText, Syringe, Shield, Ban,
  Download, Eye, CheckCircle2, Clock, Save, Loader2, Camera, Scissors, ImageIcon, Utensils, StickyNote, ClipboardCheck,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { MOCK_APPOINTMENTS, LAB_TESTS } from '../data/mockAppointments';
import type { Appointment as MockAppt } from '../data/mockAppointments';
import { supabase } from '../../lib/supabase';
import { useTenantDb } from '../context/TenantContext';
import { getOrgContext } from '../hooks/useOrgContext';
import { useAuth } from '../context/AuthContext';
import {
  InjectionsTab,
  XRayTab,
  SurgeryTab,
  PlanTab,
  DietTab,
  PhotosTab,
} from './ClientDetailPage';

// ─── Types ───────────────────────────────────────────────────

type MedRow = { id: number; name: string; dosage: string; freq: string; route: string; duration: string };

type FrontDeskTaskType =
  | 'Follow-up Call'
  | 'Medication Refill'
  | 'Lab Follow-up'
  | 'Schedule Appointment'
  | 'Owner Notification'
  | 'Prescription Ready'
  | 'Referral'
  | 'Home Care Check';

type FrontDeskTask = {
  id: number;
  type: FrontDeskTaskType;
  priority: 'Urgent' | 'High' | 'Normal' | 'Low';
  dueDate: string;
  dueTime: string;
  notes: string;
};

const FRONT_DESK_TASK_TYPES: FrontDeskTaskType[] = [
  'Follow-up Call', 'Medication Refill', 'Lab Follow-up',
  'Schedule Appointment', 'Owner Notification', 'Prescription Ready',
  'Referral', 'Home Care Check',
];

const TASK_TYPE_ICON: Record<FrontDeskTaskType, React.ElementType> = {
  'Follow-up Call':       Phone,
  'Medication Refill':    Pill,
  'Lab Follow-up':        FlaskConical,
  'Schedule Appointment': Calendar,
  'Owner Notification':   Bell,
  'Prescription Ready':   FileText,
  'Referral':             ExternalLink,
  'Home Care Check':      Heart,
};

const PRIORITY_CONFIG = {
  Urgent: { color: '#d4183d', bg: '#d4183d15' },
  High:   { color: '#F59E0B', bg: '#F59E0B15' },
  Normal: { color: '#22C55E', bg: '#22C55E15' },
  Low:    { color: '#6B7280', bg: '#6B728012' },
} as const;

// ─── Helpers ─────────────────────────────────────────────────

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

/** Format elapsed seconds as "MM:SS" */
function formatElapsed(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

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

const BODY_SYSTEMS = [
  'Eyes', 'Ears', 'Nose / Throat', 'Teeth / Gums',
  'Skin / Coat', 'Lymph Nodes', 'Heart / Lungs', 'Abdomen',
  'Musculoskeletal', 'Neurological', 'Urogenital', 'Rectum / Anal',
];

// ─── Section Header ──────────────────────────────────────────

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div
      className="bg-[var(--surface-white)] border border-[var(--border-color)]"
      style={{ borderRadius: '12px', overflow: 'hidden' }}
    >
      <div
        className="flex items-center gap-2.5 px-6 py-4 border-b border-[var(--border-color)]"
        style={{ backgroundColor: 'var(--surface-elevated)' }}
      >
        <span className="text-[var(--brand-green-text)]">{icon}</span>
        <span className="text-[var(--text-primary)]" style={{ fontSize: '15px', fontWeight: 600 }}>{title}</span>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────

export default function VisitPage() {
  const db = useTenantDb();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeVisit, advanceToCheckout, clearVisit } = useActiveVisit();
  const { user } = useAuth();

  const mockAppt = MOCK_APPOINTMENTS.find((a) => String(a.id) === id);
  const [realAppt, setRealAppt] = useState<MockAppt | null>(null);
  const [loadingAppt, setLoadingAppt] = useState(!mockAppt);

  // IDs for linking tasks to real DB records
  const [apptIds, setApptIds] = useState<{ petId?: string; clientId?: string; staffId?: string }>({});

  useEffect(() => {
    if (mockAppt || !id) return;
    (async () => {
      setLoadingAppt(true);
      const { data } = await db
        .from('appointments')
        .select('id, scheduled_at, duration_minutes, status, reason, notes, pets(id, name, species, breed, photo_url), clients(id, first_name, last_name), staff!appointments_vet_org_fkey(id, profiles:profiles!staff_profile_org_fkey(first_name, last_name))')
        .eq('id', id)
        .single();
      if (data) {
        const start = new Date(data.scheduled_at);
        const end = new Date(start.getTime() + (data.duration_minutes ?? 30) * 60000);
        const fmt = (d: Date) => {
          let h = d.getHours();
          const m = d.getMinutes();
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

  // ── Saved form draft (sessionStorage) ────────────────────────
  const draftKey = `visit_draft_${id}`;
  const savedDraft = useRef<Record<string, any> | null>(null);
  if (savedDraft.current === null) {
    try {
      const raw = sessionStorage.getItem(draftKey);
      savedDraft.current = raw ? JSON.parse(raw) : {};
    } catch { savedDraft.current = {}; }
  }
  const draft = savedDraft.current!;

  // ── Form state (restored from draft if available) ──────────
  const [chiefComplaint, setChiefComplaint] = useState(draft.chiefComplaint ?? '');

  // Vitals
  const [weight, setWeight] = useState(draft.weight ?? '');
  const [temp, setTemp] = useState(draft.temp ?? '');
  const [heartRate, setHeartRate] = useState(draft.heartRate ?? '');
  const [respRate, setRespRate] = useState(draft.respRate ?? '');
  const [painScore, setPainScore] = useState(draft.painScore ?? '');
  const [bcs, setBcs] = useState(draft.bcs ?? '');

  // Physical exam
  const [examNotes, setExamNotes] = useState(draft.examNotes ?? '');
  const [systemsWnl, setSystemsWnl] = useState<Record<string, boolean>>(
    draft.systemsWnl ?? Object.fromEntries(BODY_SYSTEMS.map((s) => [s, true]))
  );

  // Diagnosis
  const [primaryDx, setPrimaryDx] = useState(draft.primaryDx ?? '');
  const [secondaryDx, setSecondaryDx] = useState(draft.secondaryDx ?? '');
  const [dxNotes, setDxNotes] = useState(draft.dxNotes ?? '');
  const [icdCode, setIcdCode] = useState(draft.icdCode ?? '');
  const [dxSuggestions, setDxSuggestions] = useState<string[]>([]);
  const [dxFocusField, setDxFocusField] = useState<'primary' | 'secondary' | null>(null);

  // Lab tests
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set(draft.selectedTests ?? []));
  const [testNotes, setTestNotes] = useState<Record<string, string>>(draft.testNotes ?? {});

  // Medications
  const [meds, setMeds] = useState<MedRow[]>(draft.meds ?? []);
  const [nextMedId, setNextMedId] = useState(draft.nextMedId ?? 1);

  // Treatment
  const [procedures, setProcedures] = useState(draft.procedures ?? '');
  const [ownerInstructions, setOwnerInstructions] = useState(draft.ownerInstructions ?? '');

  // Follow-up
  const [followUpDate, setFollowUpDate] = useState(draft.followUpDate ?? '');
  const [followUpReason, setFollowUpReason] = useState(draft.followUpReason ?? '');
  const [followUpNotes, setFollowUpNotes] = useState(draft.followUpNotes ?? '');

  // Vaccination fields (only for Vaccination appointments)
  const [vaccineName, setVaccineName] = useState(draft.vaccineName ?? '');
  const [vaccineManufacturer, setVaccineManufacturer] = useState(draft.vaccineManufacturer ?? '');
  const [vaccineLotNumber, setVaccineLotNumber] = useState(draft.vaccineLotNumber ?? '');
  const [vaccineSerialNumber, setVaccineSerialNumber] = useState(draft.vaccineSerialNumber ?? '');
  const [vaccineExpiryDate, setVaccineExpiryDate] = useState(draft.vaccineExpiryDate ?? '');
  const [vaccineNextDueDate, setVaccineNextDueDate] = useState(draft.vaccineNextDueDate ?? '');
  const [vaccineInjectionSite, setVaccineInjectionSite] = useState(draft.vaccineInjectionSite ?? '');
  const [vaccineNotes, setVaccineNotes] = useState(draft.vaccineNotes ?? '');

  // Front Desk Tasks
  const [frontDeskTasks, setFrontDeskTasks] = useState<FrontDeskTask[]>(draft.frontDeskTasks ?? []);
  const [nextTaskId, setNextTaskId] = useState(draft.nextTaskId ?? 1);

  // ── Auto-save draft to sessionStorage ──────────────────────
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        sessionStorage.setItem(draftKey, JSON.stringify({
          chiefComplaint, weight, temp, heartRate, respRate, painScore, bcs,
          examNotes, systemsWnl,
          primaryDx, secondaryDx, dxNotes, icdCode,
          selectedTests: Array.from(selectedTests), testNotes,
          meds, nextMedId,
          procedures, ownerInstructions,
          followUpDate, followUpReason, followUpNotes,
          vaccineName, vaccineManufacturer, vaccineLotNumber, vaccineSerialNumber,
          vaccineExpiryDate, vaccineNextDueDate, vaccineInjectionSite, vaccineNotes,
          frontDeskTasks, nextTaskId,
        }));
      } catch {}
    }, 500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [
    draftKey, chiefComplaint, weight, temp, heartRate, respRate, painScore, bcs,
    examNotes, systemsWnl,
    primaryDx, secondaryDx, dxNotes, icdCode,
    selectedTests, testNotes,
    meds, nextMedId,
    procedures, ownerInstructions,
    followUpDate, followUpReason, followUpNotes,
    vaccineName, vaccineManufacturer, vaccineLotNumber, vaccineSerialNumber,
    vaccineExpiryDate, vaccineNextDueDate, vaccineInjectionSite, vaccineNotes,
    frontDeskTasks, nextTaskId,
  ]);

  // ── Cancel appointment ──────────────────────────────────────
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const CANCEL_REASONS = [
    'Owner requested cancellation',
    'Pet no-show',
    'Emergency rescheduled',
    'Doctor unavailable',
    'Duplicate booking',
    'Pet condition improved',
    'Other',
  ];

  const handleCancelAppointment = async () => {
    if (!cancelReason.trim()) return;
    setCancelling(true);
    try {
      const { organizationId } = await getOrgContext();
      // Update appointment status + add cancellation note
      if (id && id.includes('-')) {
        await db.from('appointments')
          .update({ status: 'Cancelled', notes: `Cancelled: ${cancelReason}` })
          .eq('id', id)
          .eq('organization_id', organizationId);
      }
      // Clear visit draft and active visit widget
      try { sessionStorage.removeItem(draftKey); } catch {}
      clearVisit();
      navigate('/appointments');
    } catch (e) {
      console.error('Cancel appointment error:', e);
    }
    setCancelling(false);
    setShowCancelDialog(false);
  };

  // ── VeNom diagnosis autocomplete ──
  const dxTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const searchDiagnoses = useCallback(async (query: string) => {
    if (query.length < 2) { setDxSuggestions([]); return; }
    const { data } = await db
      .from('vet_conditions_reference')
      .select('name')
      .eq('type', 'diagnosis')
      .ilike('name', `%${query}%`)
      .limit(15);
    if (data) setDxSuggestions(data.map((r: any) => r.name));
  }, []);

  const handleDxInput = (val: string, setter: (v: string) => void, field: 'primary' | 'secondary') => {
    setter(val);
    setDxFocusField(field);
    if (dxTimerRef.current) clearTimeout(dxTimerRef.current);
    dxTimerRef.current = setTimeout(() => searchDiagnoses(val), 250);
  };

  // ── Elapsed timer — resumes from activeVisit.startedAt so it survives navigation ──
  const [elapsedSec, setElapsedSec] = useState(() => {
    if (activeVisit?.startedAt) {
      return Math.max(0, Math.floor((Date.now() - activeVisit.startedAt.getTime()) / 1000));
    }
    return 0;
  });
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeVisit?.startedAt) {
        setElapsedSec(Math.max(0, Math.floor((Date.now() - activeVisit.startedAt.getTime()) / 1000)));
      } else {
        setElapsedSec((s) => s + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeVisit]);

  if (loadingAppt) {
    return (
      <div className="max-w-[960px] mx-auto p-4 sm:p-6 md:p-8 text-center">
        <p className="text-[var(--text-secondary)]" style={{ fontSize: '16px' }}>Loading appointment...</p>
      </div>
    );
  }

  if (!appt) {
    return (
      <div className="max-w-[960px] mx-auto p-4 sm:p-6 md:p-8">
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
  const svcColor = serviceColors[appt.service] || (() => {
    // For combo services like "Annual Checkup + Vaccination", use the first service's color
    const parts = appt.service.split(' + ');
    for (const p of parts) { if (serviceColors[p.trim()]) return serviceColors[p.trim()]; }
    return serviceColors.Other;
  })();
  const hasVaccination = appt.service.includes('Vaccination');
  const isVaccinationOnly = appt.service === 'Vaccination';
  const isComboVaccination = hasVaccination && !isVaccinationOnly;

  const COMMON_VACCINES = [
    'Rabies (1-year)', 'Rabies (3-year)', 'DHPP (Distemper combo)',
    'Bordetella', 'Leptospirosis', 'Canine Influenza (H3N2/H3N8)',
    'Lyme Disease', 'FVRCP (Feline Distemper)', 'FeLV (Feline Leukemia)',
    'FIV (Feline Immunodeficiency)',
  ];

  const INJECTION_SITES = [
    'Right Front Leg', 'Left Front Leg', 'Right Rear Leg', 'Left Rear Leg',
    'Right Shoulder', 'Left Shoulder', 'Intranasal', 'Subcutaneous (Scruff)',
  ];

  const toggleTest = (testId: string) => {
    setSelectedTests((prev) => {
      const next = new Set(prev);
      if (next.has(testId)) {
        next.delete(testId);
        setTestNotes((n) => { const c = { ...n }; delete c[testId]; return c; });
      } else {
        next.add(testId);
      }
      return next;
    });
  };

  const addMed = () => {
    setMeds((prev) => [...prev, { id: nextMedId, name: '', dosage: '', freq: '', route: '', duration: '' }]);
    setNextMedId((n) => n + 1);
  };
  const removeMed = (id: number) => setMeds((prev) => prev.filter((m) => m.id !== id));
  const updateMed = (id: number, field: keyof MedRow, val: string) =>
    setMeds((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: val } : m)));

  const addFrontDeskTask = () => {
    setFrontDeskTasks((prev) => [...prev, { id: nextTaskId, type: 'Follow-up Call', priority: 'Normal', dueDate: '', dueTime: '', notes: '' }]);
    setNextTaskId((n) => n + 1);
  };
  const removeFrontDeskTask = (id: number) => setFrontDeskTasks((prev) => prev.filter((t) => t.id !== id));
  const updateFrontDeskTask = <K extends keyof FrontDeskTask>(id: number, field: K, val: FrontDeskTask[K]) =>
    setFrontDeskTasks((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: val } : t)));

  // Group lab tests by category
  const labByCategory = LAB_TESTS.reduce<Record<string, typeof LAB_TESTS>>((acc, t) => {
    (acc[t.category] = acc[t.category] || []).push(t);
    return acc;
  }, {});

  return (
    <div className="w-full min-w-0 overflow-x-hidden" style={{ minHeight: '100%', backgroundColor: 'var(--bg-offwhite)', display: 'flex', flexDirection: 'column' }}>
      {/* ─── Header ─────────────────────────────────────── */}
      <div className="bg-[var(--surface-white)] border-b border-[var(--border-color)] sticky top-0 z-10 px-4 sm:px-6 md:px-8 py-3 sm:py-4 min-w-0">
        <div className="max-w-[960px] mx-auto flex flex-wrap items-center gap-x-3 gap-y-2">
          {/* Left: back + title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => navigate('/appointments')}
              className="p-2 hover:bg-[var(--surface-elevated)] transition-colors flex-shrink-0"
              style={{ borderRadius: '8px' }}
            >
              <ArrowLeft className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
            <ClipboardList className="w-5 h-5 text-[var(--brand-green-text)] flex-shrink-0" />
            <span className="text-[var(--text-primary)] truncate" style={{ fontSize: '18px', fontWeight: 700 }}>
              Visit Notes
            </span>
          </div>

          {/* Center: step breadcrumb — hidden on small screens */}
          <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
            <div
              className="flex items-center gap-2 px-3 py-1.5"
              style={{ borderRadius: '8px', backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 9%, transparent)' }}
            >
              <div
                style={{
                  width: 20, height: 20, borderRadius: '50%',
                  backgroundColor: 'var(--brand-green-text)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 700, color: 'var(--on-brand-green)',
                  flexShrink: 0,
                }}
              >1</div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Visit Notes</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
            <div className="flex items-center gap-2 px-3 py-1.5">
              <div
                style={{
                  width: 20, height: 20, borderRadius: '50%',
                  backgroundColor: 'var(--border-color)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)',
                  flexShrink: 0,
                }}
              >2</div>
              <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-secondary)' }}>Checkout</span>
            </div>
          </div>

          {/* Right: date/time + elapsed timer */}
          <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
            {/* Elapsed timer pill */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5"
              style={{
                backgroundColor: elapsedSec >= durationMin * 60 ? '#f43f5e18' : 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)',
                border: `1px solid ${elapsedSec >= durationMin * 60 ? '#f43f5e50' : 'color-mix(in srgb, var(--brand-green-text) 25%, transparent)'}`,
                borderRadius: '8px',
              }}
            >
              <Timer
                className="w-3.5 h-3.5"
                style={{ color: elapsedSec >= durationMin * 60 ? '#f43f5e' : 'var(--brand-green-text)' }}
              />
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: elapsedSec >= durationMin * 60 ? '#f43f5e' : 'var(--brand-green-text)',
                }}
              >
                {formatElapsed(elapsedSec)}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '2px' }}>
                / {durationMin} min
              </span>
            </div>

            <div className="text-right">
              <p className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>
                {new Date(appt.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
              <p className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>
                {appt.timeStart} – {appt.timeEnd}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Body ────────────────────────────────────────── */}
      <div className="w-full max-w-[960px] mx-auto p-4 sm:p-6 md:p-8 space-y-6 min-w-0">

        {/* ── Patient Info Card ── */}
        <div
          className="bg-[var(--surface-white)] border border-[var(--border-color)]"
          style={{ borderRadius: '12px', borderLeft: '4px solid var(--brand-green-text)', overflow: 'hidden' }}
        >
          <div className="p-4 sm:p-5 flex flex-wrap items-center gap-4 sm:gap-5">
            <Avatar className="w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0">
              <AvatarImage src={appt.petImage} alt={appt.petName} className="object-cover" />
              <AvatarFallback style={{ fontSize: '20px', fontWeight: 700 }}>{appt.petName.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[var(--text-primary)] truncate" style={{ fontSize: '22px', fontWeight: 700 }}>{appt.petName}</p>
                {appt.clientId && (
                  <Link
                    to={`/clients/${appt.clientId}`}
                    className="inline-flex items-center gap-1 transition-colors hover:opacity-80"
                    style={{
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--brand-green-text)',
                      backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)',
                      borderRadius: '6px',
                      padding: '3px 8px',
                      textDecoration: 'none',
                    }}
                    title="View pet profile"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Pet Profile
                  </Link>
                )}
              </div>
              <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>
                {appt.species} · Owner: {appt.ownerName}
              </p>
            </div>
            <div className="flex flex-row md:flex-col items-start md:items-end gap-2 flex-shrink-0 basis-full md:basis-auto flex-wrap">
              <span
                className="inline-block px-3 py-1"
                style={{
                  backgroundColor: svcColor + '18',
                  color: svcColor,
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                {appt.service}
              </span>
              <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{appt.vet}</span>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1"
                style={{
                  backgroundColor: '#3B82F615',
                  color: '#3B82F6',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#3B82F6', display: 'inline-block' }} />
                Visit In Progress
              </span>
            </div>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════
            TABS — General holds all visit-specific form fields,
            other tabs render the pet-profile components directly
            so data flows into the same Supabase tables.
            ═════════════════════════════════════════════════════════ */}
        <Tabs defaultValue="general" className="min-w-0 w-full">
          <div className="w-full max-w-full overflow-x-auto min-w-0" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
            <TabsList className="w-auto inline-flex">
              <TabsTrigger value="general"><ClipboardList className="w-3.5 h-3.5" />General</TabsTrigger>
              <TabsTrigger value="injections"><Syringe className="w-3.5 h-3.5" />Injections</TabsTrigger>
              <TabsTrigger value="xray"><ImageIcon className="w-3.5 h-3.5" />X-Ray</TabsTrigger>
              <TabsTrigger value="surgery"><Scissors className="w-3.5 h-3.5" />Surgery</TabsTrigger>
              <TabsTrigger value="plan"><ClipboardCheck className="w-3.5 h-3.5" />Plan</TabsTrigger>
              <TabsTrigger value="diet"><Utensils className="w-3.5 h-3.5" />Diet</TabsTrigger>
              <TabsTrigger value="lab"><FlaskConical className="w-3.5 h-3.5" />Lab</TabsTrigger>
              <TabsTrigger value="notes"><StickyNote className="w-3.5 h-3.5" />Notes</TabsTrigger>
              <TabsTrigger value="photos"><Camera className="w-3.5 h-3.5" />Photos</TabsTrigger>
              <TabsTrigger value="tasks"><CheckSquare className="w-3.5 h-3.5" />Front Desk Tasks</TabsTrigger>
            </TabsList>
          </div>

          {/* ═══════════════ GENERAL TAB ═══════════════ */}
          <TabsContent value="general" className="space-y-6 mt-4">

        {/* ── Section 1: Chief Complaint ── */}
        <SectionCard icon={<ClipboardList className="w-4 h-4" />} title="Chief Complaint">
          <Textarea
            placeholder="Describe the primary reason for today's visit…"
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            style={{ minHeight: '90px', resize: 'vertical' }}
          />
        </SectionCard>

        {/* ── Section 2: Vitals ── */}
        <SectionCard icon={<Heart className="w-4 h-4" />} title="Vitals">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Weight (kg)', value: weight, set: setWeight, placeholder: 'e.g. 12.5', icon: <Scale className="w-3.5 h-3.5" style={{ color: '#F4A261' }} />, hint: 'Normal: varies by breed' },
              { label: 'Temperature (°F)', value: temp, set: setTemp, placeholder: 'e.g. 101.5', icon: <Thermometer className="w-3.5 h-3.5" style={{ color: '#EC4899' }} />, hint: 'Normal: 101.0 – 102.5 °F' },
              { label: 'Heart Rate (bpm)', value: heartRate, set: setHeartRate, placeholder: 'e.g. 80', icon: <Heart className="w-3.5 h-3.5" style={{ color: '#d4183d' }} />, hint: 'Normal dog: 60–140, cat: 140–220' },
              { label: 'Respiratory Rate (brpm)', value: respRate, set: setRespRate, placeholder: 'e.g. 22', icon: <Activity className="w-3.5 h-3.5" style={{ color: '#38BDF8' }} />, hint: 'Normal: 15–30 brpm' },
              { label: 'Pain Score (0–10)', value: painScore, set: setPainScore, placeholder: '0 = none, 10 = severe', icon: <AlertCircle className="w-3.5 h-3.5" style={{ color: '#F59E0B' }} />, hint: '0 = no pain, 10 = max pain' },
              { label: 'Body Condition Score (1–9)', value: bcs, set: setBcs, placeholder: 'e.g. 5', icon: <Activity className="w-3.5 h-3.5" style={{ color: '#8B5CF6' }} />, hint: '1 = emaciated, 9 = obese, 5 = ideal' },
            ].map(({ label, value, set, placeholder, icon, hint }) => (
              <div key={label}>
                <label
                  className="flex items-center gap-1.5 mb-1.5 text-[var(--text-secondary)]"
                  style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}
                >
                  {icon}{label}
                </label>
                <Input
                  placeholder={placeholder}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  style={{ borderRadius: '8px' }}
                />
                <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '11px' }}>{hint}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ── Vaccination-specific form ── */}
        {hasVaccination && (
          <SectionCard icon={<Syringe className="w-4 h-4" />} title="Vaccination Details">
            <div className="space-y-5">
              {/* Vaccine Name */}
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '13px', fontWeight: 600 }}>
                  Vaccine Name <span style={{ color: '#d4183d' }}>*</span>
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {COMMON_VACCINES.map(v => (
                    <button
                      key={v}
                      onClick={() => setVaccineName(v)}
                      className="px-3 py-1.5 transition-all"
                      style={{
                        borderRadius: '9999px',
                        border: `1.5px solid ${vaccineName === v ? '#3B82F6' : 'var(--border-color)'}`,
                        backgroundColor: vaccineName === v ? '#3B82F618' : 'transparent',
                        color: vaccineName === v ? '#3B82F6' : 'var(--text-secondary)',
                        fontSize: '13px', fontWeight: vaccineName === v ? 600 : 400,
                      }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <Input
                  placeholder="Or type a custom vaccine name…"
                  value={vaccineName}
                  onChange={e => setVaccineName(e.target.value)}
                  style={{ borderRadius: '8px', maxWidth: '400px' }}
                />
              </div>

              {/* Manufacturer + Lot + Serial */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[var(--text-secondary)] mb-1.5 block" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Manufacturer
                  </label>
                  <Input
                    placeholder="e.g. Zoetis, Merck, Boehringer"
                    value={vaccineManufacturer}
                    onChange={e => setVaccineManufacturer(e.target.value)}
                    style={{ borderRadius: '8px' }}
                  />
                </div>
                <div>
                  <label className="text-[var(--text-secondary)] mb-1.5 block" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Lot Number
                  </label>
                  <Input
                    placeholder="e.g. A1234B"
                    value={vaccineLotNumber}
                    onChange={e => setVaccineLotNumber(e.target.value)}
                    style={{ borderRadius: '8px' }}
                  />
                </div>
                <div>
                  <label className="text-[var(--text-secondary)] mb-1.5 block" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Serial Number
                  </label>
                  <Input
                    placeholder="e.g. SN-98765"
                    value={vaccineSerialNumber}
                    onChange={e => setVaccineSerialNumber(e.target.value)}
                    style={{ borderRadius: '8px' }}
                  />
                </div>
              </div>

              {/* Injection Site */}
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '13px', fontWeight: 600 }}>
                  Injection Site
                </label>
                <div className="flex flex-wrap gap-2">
                  {INJECTION_SITES.map(site => (
                    <button
                      key={site}
                      onClick={() => setVaccineInjectionSite(site)}
                      className="px-3 py-1.5 transition-all"
                      style={{
                        borderRadius: '9999px',
                        border: `1.5px solid ${vaccineInjectionSite === site ? '#3B82F6' : 'var(--border-color)'}`,
                        backgroundColor: vaccineInjectionSite === site ? '#3B82F618' : 'transparent',
                        color: vaccineInjectionSite === site ? '#3B82F6' : 'var(--text-secondary)',
                        fontSize: '13px', fontWeight: vaccineInjectionSite === site ? 600 : 400,
                      }}
                    >
                      {site}
                    </button>
                  ))}
                </div>
              </div>

              {/* Expiry + Next Due */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[var(--text-secondary)] mb-1.5 block" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <Shield className="w-3.5 h-3.5 inline mr-1" style={{ color: '#F59E0B' }} />
                    Vaccine Expiry Date
                  </label>
                  <Input
                    type="date"
                    value={vaccineExpiryDate}
                    onChange={e => setVaccineExpiryDate(e.target.value)}
                    style={{ borderRadius: '8px' }}
                  />
                </div>
                <div>
                  <label className="text-[var(--text-secondary)] mb-1.5 block" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <Calendar className="w-3.5 h-3.5 inline mr-1" style={{ color: 'var(--brand-green-text)' }} />
                    Next Due Date
                  </label>
                  <Input
                    type="date"
                    value={vaccineNextDueDate}
                    onChange={e => setVaccineNextDueDate(e.target.value)}
                    style={{ borderRadius: '8px' }}
                  />
                  <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '11px' }}>When should the pet receive the next booster?</p>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '13px', fontWeight: 600 }}>
                  Notes
                </label>
                <Textarea
                  placeholder="Adverse reactions, observations, special instructions…"
                  value={vaccineNotes}
                  onChange={e => setVaccineNotes(e.target.value)}
                  style={{ minHeight: '80px', resize: 'vertical' }}
                />
              </div>
            </div>
          </SectionCard>
        )}

        {!isVaccinationOnly && (<>
        {/* ── Section 3: Physical Examination ── */}
        <SectionCard icon={<Activity className="w-4 h-4" />} title="Physical Examination">
          <Textarea
            placeholder="General exam findings…"
            value={examNotes}
            onChange={(e) => setExamNotes(e.target.value)}
            style={{ minHeight: '80px', resize: 'vertical', marginBottom: '16px' }}
          />
          <p className="text-[var(--text-secondary)] mb-3" style={{ fontSize: '13px', fontWeight: 600 }}>
            Body Systems — check "WNL" for Within Normal Limits (unchecked = abnormal findings)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {BODY_SYSTEMS.map((sys) => {
              const wnl = systemsWnl[sys] ?? true;
              return (
                <button
                  key={sys}
                  onClick={() => setSystemsWnl((prev) => ({ ...prev, [sys]: !prev[sys] }))}
                  className="flex items-center gap-2 px-3 py-2 text-left transition-colors"
                  style={{
                    borderRadius: '8px',
                    border: `1.5px solid ${wnl ? 'color-mix(in srgb, var(--brand-green-text) 25%, transparent)' : '#d4183d40'}`,
                    backgroundColor: wnl ? 'color-mix(in srgb, var(--brand-green-text) 3%, transparent)' : '#d4183d08',
                  }}
                >
                  <div
                    style={{
                      width: 16, height: 16, borderRadius: '4px',
                      border: `2px solid ${wnl ? 'var(--brand-green-text)' : '#d4183d'}`,
                      backgroundColor: wnl ? 'var(--brand-green-text)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {wnl && <span style={{ color: 'var(--on-brand-green)', fontSize: '10px', lineHeight: 1, fontWeight: 700 }}>✓</span>}
                  </div>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: wnl ? 'var(--text-primary)' : '#d4183d',
                    }}
                  >
                    {sys}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: wnl ? 'var(--brand-green-text)' : '#d4183d',
                      marginLeft: 'auto',
                    }}
                  >
                    {wnl ? 'WNL' : 'ABN'}
                  </span>
                </button>
              );
            })}
          </div>
        </SectionCard>

        {/* ── Section 4: Diagnosis ── */}
        <SectionCard icon={<ClipboardList className="w-4 h-4" />} title="Diagnosis">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div style={{ position: 'relative' }}>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '13px', fontWeight: 600 }}>
                Primary Diagnosis
              </label>
              <Input
                placeholder="Start typing to search VeNom codes…"
                value={primaryDx}
                onChange={(e) => handleDxInput(e.target.value, setPrimaryDx, 'primary')}
                onFocus={() => { setDxFocusField('primary'); if (primaryDx.length >= 2) searchDiagnoses(primaryDx); }}
                onBlur={() => setTimeout(() => setDxFocusField(null), 200)}
                style={{ borderRadius: '8px' }}
                autoComplete="off"
              />
              {dxFocusField === 'primary' && dxSuggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, maxHeight: 220, overflowY: 'auto', backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: 8, marginTop: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                  {dxSuggestions.map((s) => (
                    <button key={s} type="button" onMouseDown={() => { setPrimaryDx(s); setDxSuggestions([]); setDxFocusField(null); }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 13, color: 'var(--text-primary)', border: 'none', background: 'none', cursor: 'pointer' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >{s}</button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '13px', fontWeight: 600 }}>
                Secondary Diagnosis
              </label>
              <Input
                placeholder="Start typing to search VeNom codes…"
                value={secondaryDx}
                onChange={(e) => handleDxInput(e.target.value, setSecondaryDx, 'secondary')}
                onFocus={() => { setDxFocusField('secondary'); if (secondaryDx.length >= 2) searchDiagnoses(secondaryDx); }}
                onBlur={() => setTimeout(() => setDxFocusField(null), 200)}
                style={{ borderRadius: '8px' }}
                autoComplete="off"
              />
              {dxFocusField === 'secondary' && dxSuggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, maxHeight: 220, overflowY: 'auto', backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: 8, marginTop: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                  {dxSuggestions.map((s) => (
                    <button key={s} type="button" onMouseDown={() => { setSecondaryDx(s); setDxSuggestions([]); setDxFocusField(null); }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 13, color: 'var(--text-primary)', border: 'none', background: 'none', cursor: 'pointer' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >{s}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="mb-4">
            <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '13px', fontWeight: 600 }}>
              Clinical Notes
            </label>
            <Textarea
              placeholder="Differentials, reasoning, observations…"
              value={dxNotes}
              onChange={(e) => setDxNotes(e.target.value)}
              style={{ minHeight: '72px', resize: 'vertical' }}
            />
          </div>
          <div>
            <label className="text-[var(--text-secondary)] mb-1.5 block" style={{ fontSize: '12px', fontWeight: 600 }}>
              ICD / SNOMED Code (optional)
            </label>
            <Input
              placeholder="e.g. H60.3"
              value={icdCode}
              onChange={(e) => setIcdCode(e.target.value)}
              style={{ borderRadius: '8px', maxWidth: '200px' }}
            />
          </div>
        </SectionCard>

        {/* ── Section 5: Lab Samples ── */}
        <SectionCard icon={<Activity className="w-4 h-4" />} title="Lab Samples Collected">
          <p className="text-[var(--text-secondary)] mb-5" style={{ fontSize: '13px' }}>
            Select all samples collected during this visit. They will appear in the Lab queue.
          </p>
          <div className="space-y-5">
            {Object.entries(labByCategory).map(([category, tests]) => (
              <div key={category}>
                <p
                  className="text-[var(--text-secondary)] mb-2"
                  style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}
                >
                  {category}
                </p>
                <div className="flex flex-wrap gap-2">
                  {tests.map((test) => {
                    const active = selectedTests.has(test.id);
                    return (
                      <button
                        key={test.id}
                        onClick={() => toggleTest(test.id)}
                        className="px-3 py-1.5 transition-all"
                        style={{
                          borderRadius: '9999px',
                          fontSize: '13px',
                          fontWeight: active ? 600 : 400,
                          border: `1.5px solid ${active ? 'var(--brand-green-text)' : 'var(--border-color)'}`,
                          backgroundColor: active ? 'var(--brand-green-text)' : 'transparent',
                          color: active ? 'var(--on-brand-green)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        {test.label}
                      </button>
                    );
                  })}
                </div>
                {/* Collection notes for selected tests in this category */}
                {tests.some((t) => selectedTests.has(t.id)) && (
                  <div className="mt-3 space-y-2">
                    {tests.filter((t) => selectedTests.has(t.id)).map((test) => (
                      <div key={test.id} className="flex items-center gap-3">
                        <span
                          className="flex-shrink-0"
                          style={{ fontSize: '12px', color: 'var(--brand-green-text)', fontWeight: 600, minWidth: '140px' }}
                        >
                          {test.label}
                        </span>
                        <Input
                          placeholder="Collection notes / specimen details"
                          value={testNotes[test.id] || ''}
                          onChange={(e) => setTestNotes((n) => ({ ...n, [test.id]: e.target.value }))}
                          style={{ fontSize: '13px', borderRadius: '8px' }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ── Section 6: Medications Prescribed ── */}
        <SectionCard icon={<Plus className="w-4 h-4" />} title="Medications Prescribed">
          <div className="flex items-center justify-between mb-3">
            <span />
            <button
              onClick={addMed}
              className="flex items-center gap-1.5 px-3 py-1.5 transition-colors hover:opacity-80"
              style={{
                borderRadius: '8px',
                border: '1.5px solid var(--brand-green-text)',
                backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 6%, transparent)',
                color: 'var(--brand-green-text)',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              <Plus className="w-3.5 h-3.5" /> Add Medication
            </button>
          </div>
          {meds.length === 0 ? (
            <p className="text-[var(--text-secondary)] text-center py-6" style={{ fontSize: '14px' }}>
              No medications added
            </p>
          ) : (
            <div className="space-y-2">
              {/* Header */}
              <div
                className="grid gap-2 px-2"
                style={{ gridTemplateColumns: '2.5fr 1fr 1fr 1fr 1fr auto' }}
              >
                {['Medication Name', 'Dosage', 'Frequency', 'Route', 'Duration', ''].map((h) => (
                  <span key={h} className="text-[var(--text-secondary)]" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {h}
                  </span>
                ))}
              </div>
              {meds.map((med) => (
                <div
                  key={med.id}
                  className="grid gap-2 items-center p-2 bg-[var(--surface-elevated)]"
                  style={{ gridTemplateColumns: '2.5fr 1fr 1fr 1fr 1fr auto', borderRadius: '8px' }}
                >
                  <Input
                    placeholder="Medication name"
                    value={med.name}
                    onChange={(e) => updateMed(med.id, 'name', e.target.value)}
                    style={{ fontSize: '13px', borderRadius: '8px' }}
                  />
                  <Input
                    placeholder="e.g. 10mg"
                    value={med.dosage}
                    onChange={(e) => updateMed(med.id, 'dosage', e.target.value)}
                    style={{ fontSize: '13px', borderRadius: '8px' }}
                  />
                  <Select value={med.freq} onValueChange={(v) => updateMed(med.id, 'freq', v)}>
                    <SelectTrigger style={{ fontSize: '13px', height: '36px', borderRadius: '8px' }}>
                      <SelectValue placeholder="Freq" />
                    </SelectTrigger>
                    <SelectContent>
                      {['SID', 'BID', 'TID', 'QID', 'PRN'].map((f) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={med.route} onValueChange={(v) => updateMed(med.id, 'route', v)}>
                    <SelectTrigger style={{ fontSize: '13px', height: '36px', borderRadius: '8px' }}>
                      <SelectValue placeholder="Route" />
                    </SelectTrigger>
                    <SelectContent>
                      {['PO', 'SQ', 'IM', 'IV', 'Topical', 'Otic'].map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="e.g. 7 days"
                    value={med.duration}
                    onChange={(e) => updateMed(med.id, 'duration', e.target.value)}
                    style={{ fontSize: '13px', borderRadius: '8px' }}
                  />
                  <button
                    onClick={() => removeMed(med.id)}
                    className="p-1.5 text-[var(--text-secondary)] hover:text-[#d4183d] transition-colors"
                    style={{ borderRadius: '6px' }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
        </>)}

        {/* ── Section 7: Treatment Notes ── */}
        <SectionCard icon={<ClipboardList className="w-4 h-4" />} title="Treatment Notes">
          <div className="space-y-4">
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '13px', fontWeight: 600 }}>
                Procedures Performed
              </label>
              <Textarea
                placeholder="Describe procedures performed during this visit…"
                value={procedures}
                onChange={(e) => setProcedures(e.target.value)}
                style={{ minHeight: '80px', resize: 'vertical' }}
              />
            </div>
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '13px', fontWeight: 600 }}>
                Post-Visit Instructions for Owner
              </label>
              <Textarea
                placeholder="Home care instructions, activity restrictions, diet, when to return…"
                value={ownerInstructions}
                onChange={(e) => setOwnerInstructions(e.target.value)}
                style={{ minHeight: '80px', resize: 'vertical' }}
              />
            </div>
          </div>
        </SectionCard>

        {/* ── Section 8: Follow-Up ── */}
        <SectionCard icon={<ClipboardList className="w-4 h-4" />} title="Follow-Up">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '13px', fontWeight: 600 }}>
                Next Visit Date
              </label>
              <Input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                style={{ borderRadius: '8px' }}
              />
            </div>
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '13px', fontWeight: 600 }}>
                Reason
              </label>
              <Input
                placeholder="e.g. Recheck, vaccine due…"
                value={followUpReason}
                onChange={(e) => setFollowUpReason(e.target.value)}
                style={{ borderRadius: '8px' }}
              />
            </div>
          </div>
          <Textarea
            placeholder="Additional follow-up notes…"
            value={followUpNotes}
            onChange={(e) => setFollowUpNotes(e.target.value)}
            style={{ minHeight: '64px', resize: 'vertical' }}
          />
        </SectionCard>

          </TabsContent>
          {/* ═══════════════ END GENERAL TAB ═══════════════ */}

          {/* ═══════════════ INJECTIONS TAB ═══════════════ */}
          <TabsContent value="injections" className="mt-4">
            {apptIds.petId ? (
              <InjectionsTab petName={appt.petName} petDbId={apptIds.petId} />
            ) : (
              <MissingPetNotice />
            )}
          </TabsContent>

          {/* ═══════════════ X-RAY TAB ═══════════════ */}
          <TabsContent value="xray" className="mt-4">
            {apptIds.petId ? (
              <XRayTab petName={appt.petName} petDbId={apptIds.petId} />
            ) : (
              <MissingPetNotice />
            )}
          </TabsContent>

          {/* ═══════════════ SURGERY TAB ═══════════════ */}
          <TabsContent value="surgery" className="mt-4">
            {apptIds.petId ? (
              <SurgeryTab petName={appt.petName} petDbId={apptIds.petId} />
            ) : (
              <MissingPetNotice />
            )}
          </TabsContent>

          {/* ═══════════════ PLAN TAB ═══════════════ */}
          <TabsContent value="plan" className="mt-4">
            {apptIds.petId ? (
              <PlanTab petName={appt.petName} petDbId={apptIds.petId} />
            ) : (
              <MissingPetNotice />
            )}
          </TabsContent>

          {/* ═══════════════ DIET TAB ═══════════════ */}
          <TabsContent value="diet" className="mt-4">
            {apptIds.petId ? (
              <DietTab
                petName={appt.petName}
                petSpecies={appt.species || ''}
                petWeight={weight || ''}
                petDbId={apptIds.petId}
              />
            ) : (
              <MissingPetNotice />
            )}
          </TabsContent>

          {/* ═══════════════ LAB TAB ═══════════════ */}
          <TabsContent value="lab" className="mt-4">
            <VisitLabTab petDbId={apptIds.petId || ''} />
          </TabsContent>

          {/* ═══════════════ NOTES TAB ═══════════════ */}
          <TabsContent value="notes" className="mt-4">
            <VisitNotesTab petDbId={apptIds.petId || ''} />
          </TabsContent>

          {/* ═══════════════ PHOTOS TAB ═══════════════ */}
          <TabsContent value="photos" className="mt-4">
            {apptIds.petId ? (
              <PhotosTab petName={appt.petName} petImage={appt.petImage || ''} petDbId={apptIds.petId} />
            ) : (
              <MissingPetNotice />
            )}
          </TabsContent>

          {/* ═══════════════ FRONT DESK TASKS TAB ═══════════════ */}
          <TabsContent value="tasks" className="mt-4">
        {/* ── Section 9: Front Desk Tasks ── */}
        <SectionCard icon={<CheckSquare className="w-4 h-4" />} title="Front Desk Tasks">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>
              Assign action items to the front desk — they'll appear in <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Admin → Tasks</strong> immediately.
            </p>
            <button
              onClick={addFrontDeskTask}
              className="flex items-center gap-1.5 px-3 py-1.5 transition-colors hover:opacity-80 flex-shrink-0 ml-4"
              style={{
                borderRadius: '8px',
                border: '1.5px solid var(--brand-green-text)',
                backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 7%, transparent)',
                color: 'var(--brand-green-text)',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              <Plus className="w-3.5 h-3.5" /> Add Task
            </button>
          </div>

          {frontDeskTasks.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-10"
              style={{ border: '2px dashed var(--border-color)', borderRadius: '10px' }}
            >
              <CheckSquare className="w-9 h-9 mb-3" style={{ color: 'var(--border-color)' }} />
              <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px', fontWeight: 500 }}>No tasks assigned yet</p>
              <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '12px' }}>
                Use "Add Task" to give the front desk follow-up actions
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {frontDeskTasks.map((task) => {
                const pc = PRIORITY_CONFIG[task.priority];
                const TypeIcon = TASK_TYPE_ICON[task.type];
                return (
                  <div
                    key={task.id}
                    style={{
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      borderLeft: `4px solid ${pc.color}`,
                      backgroundColor: 'var(--surface-elevated)',
                      padding: '14px 16px',
                    }}
                  >
                    {/* Row 1: icon + type select + priority pills + remove */}
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        style={{
                          width: 34, height: 34, borderRadius: '8px',
                          backgroundColor: pc.bg,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: pc.color, flexShrink: 0,
                        }}
                      >
                        <TypeIcon className="w-4 h-4" />
                      </div>

                      <Select
                        value={task.type}
                        onValueChange={(v) => updateFrontDeskTask(task.id, 'type', v as FrontDeskTaskType)}
                      >
                        <SelectTrigger style={{ fontSize: '13px', fontWeight: 600, height: '36px', borderRadius: '8px', flex: 1 }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FRONT_DESK_TASK_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Priority pills */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {(['Urgent', 'High', 'Normal', 'Low'] as const).map((p) => {
                          const conf = PRIORITY_CONFIG[p];
                          const active = task.priority === p;
                          return (
                            <button
                              key={p}
                              onClick={() => updateFrontDeskTask(task.id, 'priority', p)}
                              style={{
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '3px 8px',
                                border: `1.5px solid ${active ? conf.color : 'var(--border-color)'}`,
                                backgroundColor: active ? conf.bg : 'transparent',
                                color: active ? conf.color : 'var(--text-secondary)',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                              }}
                            >
                              {p}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => removeFrontDeskTask(task.id)}
                        className="p-1.5 text-[var(--text-secondary)] hover:text-[#d4183d] transition-colors flex-shrink-0"
                        style={{ borderRadius: '6px' }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Row 2: due date + due time + notes */}
                    <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr 2fr' }}>
                      <div>
                        <label
                          className="text-[var(--text-secondary)] mb-1 block"
                          style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}
                        >
                          Due Date
                        </label>
                        <Input
                          type="date"
                          value={task.dueDate}
                          onChange={(e) => updateFrontDeskTask(task.id, 'dueDate', e.target.value)}
                          style={{ fontSize: '13px', borderRadius: '8px' }}
                        />
                      </div>
                      <div>
                        <label
                          className="text-[var(--text-secondary)] mb-1 block"
                          style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}
                        >
                          Due Time
                        </label>
                        <Input
                          type="time"
                          value={task.dueTime}
                          onChange={(e) => updateFrontDeskTask(task.id, 'dueTime', e.target.value)}
                          style={{ fontSize: '13px', borderRadius: '8px' }}
                        />
                      </div>
                      <div>
                        <label
                          className="text-[var(--text-secondary)] mb-1 block"
                          style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}
                        >
                          Notes for Front Desk
                        </label>
                        <Input
                          placeholder="Instructions, what to say, context…"
                          value={task.notes}
                          onChange={(e) => updateFrontDeskTask(task.id, 'notes', e.target.value)}
                          style={{ fontSize: '13px', borderRadius: '8px' }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
          </TabsContent>
          {/* ═══════════════ END FRONT DESK TASKS TAB ═══════════════ */}

        </Tabs>

      </div>

      {/* ─── Sticky Footer ────────────────────────────────── */}
      <div
        className="sticky bottom-0 bg-[var(--surface-white)] border-t border-[var(--border-color)] mt-auto px-4 sm:px-6 md:px-8 py-3 sm:py-3.5"
        style={{ zIndex: 20 }}
      >
        <div className="max-w-[960px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/appointments')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Appointments
            </Button>
            <button
              onClick={() => setShowCancelDialog(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-all hover:opacity-90"
              style={{
                backgroundColor: 'transparent',
                color: '#EF4444',
                border: '1px solid #EF4444',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              <Ban style={{ width: '14px', height: '14px' }} />
              Cancel Appointment
            </button>
          </div>
          <Button
            onClick={async () => {
              const today = new Date().toISOString().split('T')[0];
              const { organizationId } = await getOrgContext();

              // Persist front-desk tasks to Supabase so AdminTasksPage can show them
              if (frontDeskTasks.length > 0 && appt) {
                try {
                  const taskRows = frontDeskTasks.map(t => ({
                    type: t.type,
                    priority: t.priority,
                    status: 'Pending',
                    due_date: t.dueDate || today,
                    due_time: t.dueTime || null,
                    pet_id: apptIds.petId || null,
                    client_id: apptIds.clientId || null,
                    assigned_by_id: apptIds.staffId || null,
                    visit_date: today,
                    doctor_notes: t.notes,
                    tags: [],
                    organization_id: organizationId,
                  }));
                  if (taskRows.length > 0) {
                    await db.from('tasks').insert(taskRows);
                  }
                  window.dispatchEvent(new Event('notifCountChanged'));
                } catch {}
              }

              // Save medical record + relational child rows (single source of truth)
              if (apptIds.petId) {
                try {
                  const recNum = `VT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`;
                  const summary = [primaryDx, secondaryDx].filter(Boolean).join(', ') || chiefComplaint || appt?.service || '—';
                  const clinicalNoteFull = [
                    chiefComplaint && `Chief Complaint: ${chiefComplaint}`,
                    examNotes && `Exam Notes: ${examNotes}`,
                    dxNotes && `Clinical Notes: ${dxNotes}`,
                  ].filter(Boolean).join('\n\n');

                  // Look up clinic_id for this organization
                  const { data: clinicRow } = await db
                    .from('clinics')
                    .select('id')
                    .eq('organization_id', organizationId)
                    .limit(1)
                    .single();

                  // Build vitals JSON for inline storage
                  const vitalsObj: Record<string, number | null> = {};
                  if (weight) vitalsObj.weight_kg = parseFloat(weight);
                  if (temp) vitalsObj.temperature_c = parseFloat(((parseFloat(temp) - 32) * 5 / 9).toFixed(1));
                  if (heartRate) vitalsObj.heart_rate_bpm = parseFloat(heartRate);
                  if (respRate) vitalsObj.respiratory_rate_bpm = parseFloat(respRate);
                  if (painScore) vitalsObj.pain_score = parseFloat(painScore);
                  if (bcs) vitalsObj.body_condition_score = parseFloat(bcs);

                  // Build medications JSON
                  const medsJson = meds.filter(m => m.name).map(m => ({
                    name: m.name, dosage: m.dosage || '—', frequency: m.freq || '—',
                    route: m.route || 'Oral', duration: m.duration || '',
                  }));

                  const visitTime = (() => {
                    if (!appt?.timeStart) return null;
                    const [tp, ap] = appt.timeStart.split(' ');
                    let [h, m] = tp.split(':').map(Number);
                    if (ap === 'PM' && h !== 12) h += 12;
                    if (ap === 'AM' && h === 12) h = 0;
                    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                  })();

                  const { data: mrRow, error: mrErr } = await db.from('medical_records').insert({
                    record_number: recNum,
                    organization_id: organizationId,
                    appointment_id: id || null,
                    pet_id: apptIds.petId,
                    client_id: apptIds.clientId!,
                    clinic_id: clinicRow?.id!,
                    vet_id: apptIds.staffId || null,
                    record_type: isVaccinationOnly ? 'Vaccination' : 'Visit',
                    status: 'Final',
                    visit_date: today,
                    visit_time: visitTime,
                    reason: summary,
                    clinical_notes: clinicalNoteFull || null,
                    duration_minutes: appt ? getDurationMin(appt.timeStart, appt.timeEnd) : null,
                    follow_up_date: followUpDate || null,
                    follow_up_reason: followUpReason || null,
                    follow_up_notes: followUpNotes || null,
                    created_by: apptIds.staffId || null,
                    chief_complaint: chiefComplaint || null,
                    exam_notes: examNotes || null,
                    primary_diagnosis: primaryDx || null,
                    secondary_diagnosis: secondaryDx || null,
                    vitals_json: Object.keys(vitalsObj).length > 0 ? vitalsObj : {},
                    medications_json: medsJson.length > 0 ? medsJson : [],
                    procedures_text: procedures || null,
                    owner_instructions: ownerInstructions || null,
                  }).select('id').single();
                  if (mrErr) console.error('Medical record insert error:', mrErr);

                  const recordId = mrRow?.id;

                  if (recordId) {
                    // ── record_vitals (1:1) ──
                    const hasVitals = weight || temp || heartRate || respRate || painScore || bcs;
                    if (hasVitals) {
                      await db.from('record_vitals').insert({
                        record_id: recordId,
                        weight_kg: weight ? parseFloat(weight) : null,
                        temperature_c: temp ? parseFloat(((parseFloat(temp) - 32) * 5 / 9).toFixed(1)) : null,
                        heart_rate_bpm: heartRate ? parseFloat(heartRate) : null,
                        respiratory_rate_bpm: respRate ? parseFloat(respRate) : null,
                        pain_score: painScore ? parseFloat(painScore) : null,
                        body_condition_score: bcs ? parseFloat(bcs) : null,
                      });
                    }

                    // ── record_diagnoses (1:N) ──
                    const dxRows: { record_id: string; type: string; description: string }[] = [];
                    if (primaryDx) dxRows.push({ record_id: recordId, type: 'primary', description: primaryDx });
                    if (secondaryDx) dxRows.push({ record_id: recordId, type: 'secondary', description: secondaryDx });
                    if (dxRows.length > 0) {
                      await db.from('record_diagnoses').insert(dxRows);
                    }

                    // ── record_treatments (1:N) ──
                    if (procedures || ownerInstructions) {
                      await db.from('record_treatments').insert({
                        record_id: recordId,
                        procedure_name: procedures || 'General Visit',
                        post_visit_instructions: ownerInstructions || null,
                      });
                    }

                    // ── medications (1:N) ──
                    if (meds.length > 0) {
                      const medRows = meds.filter(m => m.name).map(m => ({
                        pet_id: apptIds.petId!,
                        record_id: recordId,
                        organization_id: organizationId,
                        name: m.name,
                        dosage: m.dosage || '—',
                        frequency: m.freq || '—',
                        route: (m.route || 'Oral') as any,
                        start_date: today,
                        is_active: true,
                      }));
                      if (medRows.length > 0) {
                        await db.from('medications').insert(medRows);
                      }
                    }
                  }
                } catch {}
              }

              // Save clinical notes as a pet note (linked to Notes tab in profile)
              if (apptIds.petId && user && (dxNotes || procedures)) {
                try {
                  const noteContent = [
                    primaryDx && `Diagnosis: ${primaryDx}${secondaryDx ? `, ${secondaryDx}` : ''}`,
                    dxNotes && `Clinical Notes: ${dxNotes}`,
                    procedures && `Procedures: ${procedures}`,
                  ].filter(Boolean).join('\n\n');
                  if (noteContent) {
                    await db.from('pet_notes').insert({
                      pet_id: apptIds.petId,
                      organization_id: organizationId,
                      author_id: user.id,
                      type: 'vet',
                      content: noteContent,
                    });
                  }
                } catch {}
              }

              // Save owner instructions as a client-visible note
              if (apptIds.petId && user && ownerInstructions) {
                try {
                  await db.from('pet_notes').insert({
                    pet_id: apptIds.petId,
                    organization_id: organizationId,
                    author_id: user.id,
                    type: 'client',
                    content: ownerInstructions,
                  });
                } catch {}
              }

              // Insert selected lab tests into lab_results (pending — no result yet)
              if (apptIds.petId && selectedTests.size > 0) {
                try {
                  // Look up clinic_id
                  const { data: clinicForLab } = await db
                    .from('clinics')
                    .select('id')
                    .eq('organization_id', organizationId)
                    .limit(1)
                    .single();

                  // Get the medical_record id we just created (latest for this pet)
                  const { data: latestRec } = await db
                    .from('medical_records')
                    .select('id')
                    .eq('pet_id', apptIds.petId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                  // Map specific test IDs to precise lab panels
                  const testIdToPanel: Record<string, string> = {
                    cbc: 'Hematology', coag: 'Hematology',
                    chem: 'Chemistry', thyroid: 'Thyroid',
                    ua: 'Urinalysis', uc: 'Urinalysis',
                    fecal: 'Parasitology', fecal_pcr: 'Parasitology', giardia: 'Parasitology',
                    heartworm: 'Parasitology', tick_panel: 'Parasitology',
                    skin_scrape: 'Microbiology', cytology: 'Microbiology',
                    ear_swab: 'Microbiology', culture: 'Microbiology',
                    xray: 'Imaging', ultrasound: 'Imaging',
                  };

                  const labRows = Array.from(selectedTests).map((testId) => {
                    const testDef = LAB_TESTS.find((t) => t.id === testId);
                    return {
                      test_name: testDef?.label || testId,
                      test_panel: testIdToPanel[testId] || 'General',
                      pet_id: apptIds.petId!,
                      record_id: latestRec?.id || null,
                      ordered_by: apptIds.staffId || null,
                      clinic_id: clinicForLab?.id || null,
                      flag: 'normal' as const,
                      result_value: null,
                      reference_range: null,
                      unit: null,
                      notes: testNotes[testId] || null,
                      tested_at: new Date().toISOString(),
                    };
                  });

                  if (labRows.length > 0) {
                    const { error: labErr } = await db.from('lab_results').insert(labRows);
                    if (labErr) console.error('Lab insert error:', labErr);
                  }

                  // Auto-create "Lab Follow-up" task for front desk
                  const sampleNames = Array.from(selectedTests).map((tid) => {
                    const td = LAB_TESTS.find((t) => t.id === tid);
                    return td?.label || tid;
                  }).join(', ');

                  // Check if doctor already manually added a Lab Follow-up task
                  const alreadyHasLabTask = frontDeskTasks.some(t => t.type === 'Lab Follow-up');
                  if (!alreadyHasLabTask) {
                    await db.from('tasks').insert({
                      type: 'Lab Follow-up',
                      priority: 'Normal',
                      status: 'Pending',
                      due_date: today,
                      due_time: null,
                      pet_id: apptIds.petId || null,
                      client_id: apptIds.clientId || null,
                      assigned_by_id: apptIds.staffId || null,
                      visit_date: today,
                      doctor_notes: `Lab samples collected: ${sampleNames}. Follow up on results.`,
                      tags: ['auto-created'],
                      organization_id: organizationId,
                    });
                    window.dispatchEvent(new Event('notifCountChanged'));
                  }
                } catch (e) { console.error('Lab insert exception:', e); }
              }

              // Insert vaccination record if this is a vaccination visit
              if (hasVaccination && apptIds.petId && vaccineName) {
                try {
                  const { data: clinicForVax } = await db
                    .from('clinics').select('id').eq('organization_id', organizationId).limit(1).single();
                  await db.from('vaccinations').insert({
                    pet_id: apptIds.petId,
                    clinic_id: clinicForVax?.id || null,
                    administered_by: apptIds.staffId || null,
                    vaccine_name: vaccineName,
                    manufacturer: vaccineManufacturer || null,
                    lot_number: vaccineLotNumber || null,
                    serial_number: vaccineSerialNumber || null,
                    administered_date: new Date().toISOString().split('T')[0],
                    expiry_date: vaccineExpiryDate || null,
                    next_due_date: vaccineNextDueDate || null,
                    injection_site: vaccineInjectionSite || null,
                    notes: vaccineNotes || null,
                  });
                } catch (e) { console.error('Vaccination insert error:', e); }
              }

              // Clear saved draft since we're moving forward
              try { sessionStorage.removeItem(draftKey); } catch {}
              advanceToCheckout(id!); navigate(`/appointments/${id}/checkout`);
            }}
            style={{ backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)', border: 'none' }}
            className="hover:opacity-90"
          >
            Next: Checkout
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Cancel Appointment Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6" style={{ borderRadius: '14px', maxWidth: '480px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center justify-center" style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#FEE2E2' }}>
                <Ban style={{ width: '20px', height: '20px', color: '#EF4444' }} />
              </div>
              <div>
                <h3 className="text-[var(--text-primary)]" style={{ fontSize: '18px', fontWeight: 700 }}>Cancel Appointment</h3>
                <p className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>
                  {appt?.petName} — {appt?.service}
                </p>
              </div>
            </div>

            <p className="text-[var(--text-secondary)] mb-4" style={{ fontSize: '14px' }}>
              Select or enter a reason for cancellation. This will be saved as a note on the appointment.
            </p>

            {/* Quick reason buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              {CANCEL_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setCancelReason(reason === 'Other' ? '' : reason)}
                  className="transition-all"
                  style={{
                    padding: '5px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: cancelReason === reason ? '1.5px solid #EF4444' : '1px solid var(--border-color)',
                    backgroundColor: cancelReason === reason ? '#FEE2E2' : 'transparent',
                    color: cancelReason === reason ? '#EF4444' : 'var(--text-secondary)',
                  }}
                >
                  {reason}
                </button>
              ))}
            </div>

            {/* Custom reason textarea */}
            <Textarea
              placeholder="Add details or a custom reason..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              style={{ fontSize: '14px', marginBottom: '20px' }}
            />

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowCancelDialog(false); setCancelReason(''); }}
                disabled={cancelling}
                className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
              >
                Go Back
              </button>
              <button
                onClick={handleCancelAppointment}
                disabled={cancelling || !cancelReason.trim()}
                className="px-4 py-2 text-white hover:opacity-90 transition-opacity"
                style={{
                  backgroundColor: '#EF4444',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: cancelReason.trim() ? 'pointer' : 'not-allowed',
                  opacity: cancelling || !cancelReason.trim() ? 0.5 : 1,
                }}
              >
                {cancelling ? 'Cancelling...' : 'Cancel Appointment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Missing Pet Notice — shown when appointment hasn't loaded yet
// or the appointment isn't linked to a real pet record.
// ══════════════════════════════════════════════════════════════
function MissingPetNotice() {
  return (
    <div
      className="bg-[var(--surface-white)] border border-[var(--border-color)] p-8 text-center"
      style={{ borderRadius: '12px' }}
    >
      <AlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
      <p className="text-[var(--text-primary)]" style={{ fontSize: '16px', fontWeight: 600 }}>
        Pet profile not linked
      </p>
      <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '13px' }}>
        This section needs a real pet record. If the appointment is still loading, please wait a moment.
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VisitLabTab — list of uploaded lab files for this pet.
// Uses the same `lab_results` table as ClientDetailPage's Lab tab
// (filtered by pet_id + org). Read-only view — full upload UI
// lives in the dedicated /lab page.
// ══════════════════════════════════════════════════════════════
function VisitLabTab({ petDbId }: { petDbId: string }) {
  const db = useTenantDb();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!petDbId) { setFiles([]); setLoading(false); return; }
      setLoading(true);
      try {
        const { organizationId } = await getOrgContext();
        const { data } = await db
          .from('lab_results')
          .select(`
            id, file_name, file_url, file_type, test_panel, test_name, notes,
            review_status, reviewed_at, created_at, result_value, flag,
            uploader:profiles!lab_results_uploaded_by_org_fkey(first_name, last_name),
            reviewer:profiles!lab_results_reviewed_by_org_fkey(first_name, last_name)
          `)
          .eq('pet_id', petDbId)
          .eq('organization_id', organizationId)
          .not('file_url', 'is', null)
          .order('created_at', { ascending: false });
        if (!cancelled) setFiles(data || []);
      } catch (e) {
        console.error('Failed to load lab results:', e);
        if (!cancelled) setFiles([]);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [db, petDbId]);

  if (!petDbId) return <MissingPetNotice />;

  return (
    <div className="border border-[var(--border-color)] p-6" style={{ borderRadius: '12px', backgroundColor: 'var(--surface-white)' }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-[var(--text-primary)]" style={{ fontSize: 16, fontWeight: 600 }}>Lab Results</h3>
          <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: 14 }}>
            Uploaded lab files and diagnostic results for this pet
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/lab')}>
          <FlaskConical className="w-3.5 h-3.5" /> Go to Lab
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
          <p className="text-[var(--text-secondary)]" style={{ fontSize: 14 }}>Loading lab results…</p>
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-10">
          <FlaskConical className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
          <p className="text-[var(--text-secondary)]" style={{ fontSize: 14 }}>No lab results yet.</p>
          <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: 13 }}>
            Select lab samples in the General tab to queue tests — uploaded results appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {files.map((f: any) => {
            const isReviewed = f.review_status === 'reviewed';
            const uploaderName = f.uploader ? `${f.uploader.first_name} ${f.uploader.last_name}`.trim() : '—';
            const reviewerName = f.reviewer ? `Dr. ${f.reviewer.first_name} ${f.reviewer.last_name}`.trim() : '';
            const isPdf = f.file_type === 'application/pdf';
            const isImage = f.file_type?.startsWith('image/');
            const uploadDate = f.created_at ? new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
            const displayName = f.file_name || 'Unnamed file';
            return (
              <div key={f.id} className="border border-[var(--border-color)] flex items-center justify-between px-5 py-3.5" style={{ borderRadius: '10px' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: isPdf ? '#EF444415' : isImage ? '#3B82F615' : '#6B728015' }}
                  >
                    {isPdf ? <FileText className="w-4 h-4" style={{ color: '#EF4444' }} />
                      : isImage ? <Eye className="w-4 h-4" style={{ color: '#3B82F6' }} />
                      : <FileText className="w-4 h-4" style={{ color: '#6B7280' }} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[var(--text-primary)] truncate" style={{ fontSize: 14, fontWeight: 600 }}>{displayName}</p>
                    <p className="text-[var(--text-secondary)]" style={{ fontSize: 12 }}>
                      {f.test_panel && f.test_panel !== 'General' ? `${f.test_panel} · ` : ''}{uploadDate} · by {uploaderName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5"
                    style={{
                      backgroundColor: isReviewed ? 'rgba(22, 163, 74, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                      color: isReviewed ? '#16A34A' : '#D97706',
                      borderRadius: 9999, fontSize: 11, fontWeight: 700,
                      border: `1px solid ${isReviewed ? 'rgba(22, 163, 74, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
                    }}
                  >
                    {isReviewed ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {isReviewed ? 'Reviewed' : 'Awaiting Review'}
                  </span>
                  {isReviewed && reviewerName && (
                    <span className="text-[var(--text-secondary)]" style={{ fontSize: 11 }}>
                      {reviewerName}
                    </span>
                  )}
                  {f.file_url && (
                    <a
                      href={f.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'transparent', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        color: 'var(--text-secondary)', textDecoration: 'none',
                      }}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VisitNotesTab — same vet/client note structure as the pet
// profile Notes tab. Writes to the `pet_notes` table so both
// places stay in sync.
// ══════════════════════════════════════════════════════════════
type PetNoteRow = {
  id: string;
  type: string;
  content: string;
  created_at: string;
  author: { first_name: string; last_name: string } | null;
};

function VisitNotesTab({ petDbId }: { petDbId: string }) {
  const db = useTenantDb();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<PetNoteRow[]>([]);
  const [newVetNote, setNewVetNote] = useState('');
  const [newClientNote, setNewClientNote] = useState('');
  const [saving, setSaving] = useState(false);

  const loadNotes = useCallback(async () => {
    if (!petDbId) { setNotes([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { organizationId } = await getOrgContext();
      const { data } = await db
        .from('pet_notes')
        .select('id, type, content, created_at, author:profiles!pet_notes_author_id_org_fkey(first_name, last_name)')
        .eq('pet_id', petDbId)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
      setNotes((data || []) as unknown as PetNoteRow[]);
    } catch (e) {
      console.error('Failed to load notes:', e);
      setNotes([]);
    }
    setLoading(false);
  }, [db, petDbId]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const handleSave = async (type: 'vet' | 'client') => {
    const content = (type === 'vet' ? newVetNote : newClientNote).trim();
    if (!content || !user || !petDbId) return;
    setSaving(true);
    try {
      const { organizationId } = await getOrgContext();
      await db.from('pet_notes').insert({
        pet_id: petDbId,
        organization_id: organizationId,
        author_id: user.id,
        type,
        content,
      });
      if (type === 'vet') setNewVetNote(''); else setNewClientNote('');
      await loadNotes();
    } catch (e) {
      console.error('Failed to save note:', e);
    }
    setSaving(false);
  };

  if (!petDbId) return <MissingPetNotice />;

  const vetNotes = notes.filter(n => n.type === 'vet');
  const clientNotes = notes.filter(n => n.type === 'client');

  return (
    <div className="space-y-6">
      {/* Vet Notes (Private) */}
      <div className="border border-[var(--border-color)] p-6" style={{ borderRadius: '12px', backgroundColor: 'var(--surface-white)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[var(--text-primary)]" style={{ fontSize: 16, fontWeight: 600 }}>Vet Notes</h3>
            <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: 14 }}>
              Private — only visible to clinic staff
            </p>
          </div>
          <Badge variant="outline" className="border-[#F4A261] text-[#F4A261]">Private</Badge>
        </div>
        <Textarea
          value={newVetNote}
          onChange={(e) => setNewVetNote(e.target.value)}
          className="min-h-24 bg-[var(--surface-white)]"
          placeholder="Add internal notes about this patient..."
        />
        <div className="flex justify-end mt-3">
          <Button size="sm" disabled={!newVetNote.trim() || saving} onClick={() => handleSave('vet')}>
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Note'}
          </Button>
        </div>

        {!loading && vetNotes.length > 0 && (
          <div className="mt-5 pt-5 border-t border-[var(--border-color)]">
            <p className="text-[var(--text-secondary)] mb-3" style={{ fontSize: '13px', fontWeight: 600 }}>Note History</p>
            <div className="space-y-3">
              {vetNotes.map((note) => (
                <div key={note.id} className="border border-[var(--border-color)] p-4" style={{ borderRadius: '10px', backgroundColor: 'var(--surface-elevated)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: '#F4A26120', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#F4A261' }}>
                          {note.author?.first_name?.[0] || '?'}{note.author?.last_name?.[0] || ''}
                        </span>
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          Dr. {note.author?.first_name || ''} {note.author?.last_name || ''}
                        </p>
                      </div>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(note.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{note.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Client Notes (Visible) */}
      <div className="border border-[var(--border-color)] p-6" style={{ borderRadius: '12px', backgroundColor: 'var(--surface-white)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[var(--text-primary)]" style={{ fontSize: 16, fontWeight: 600 }}>Client Notes</h3>
            <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: 14 }}>
              Visible to pet owner on their portal
            </p>
          </div>
          <Badge variant="outline" className="border-[var(--brand-green-text)] text-[var(--brand-green-text)]">Visible to Client</Badge>
        </div>
        <Textarea
          value={newClientNote}
          onChange={(e) => setNewClientNote(e.target.value)}
          className="min-h-24 bg-[var(--surface-white)]"
          placeholder="Add notes for the pet owner..."
        />
        <div className="flex justify-end mt-3">
          <Button size="sm" disabled={!newClientNote.trim() || saving} onClick={() => handleSave('client')}>
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Note'}
          </Button>
        </div>

        {!loading && clientNotes.length > 0 && (
          <div className="mt-5 pt-5 border-t border-[var(--border-color)]">
            <p className="text-[var(--text-secondary)] mb-3" style={{ fontSize: '13px', fontWeight: 600 }}>Note History</p>
            <div className="space-y-3">
              {clientNotes.map((note) => (
                <div key={note.id} className="border border-[var(--border-color)] p-4" style={{ borderRadius: '10px', backgroundColor: 'var(--surface-elevated)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-green-text)' }}>
                          {note.author?.first_name?.[0] || '?'}{note.author?.last_name?.[0] || ''}
                        </span>
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          Dr. {note.author?.first_name || ''} {note.author?.last_name || ''}
                        </p>
                      </div>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(note.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{note.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
