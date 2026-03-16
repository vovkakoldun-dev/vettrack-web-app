import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useActiveVisit } from '../context/ActiveVisitContext';
import {
  ArrowLeft, ClipboardList, ChevronRight,
  Scale, Thermometer, Heart, Activity, AlertCircle,
  Plus, X, Timer, ExternalLink,
  CheckSquare, Phone, Pill, FlaskConical, Bell, Calendar, FileText,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../components/ui/select';
import { MOCK_APPOINTMENTS, LAB_TESTS } from '../data/mockAppointments';

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
  Normal: { color: '#2D6A4F', bg: '#2D6A4F12' },
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
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { advanceToCheckout } = useActiveVisit();

  const appt = MOCK_APPOINTMENTS.find((a) => String(a.id) === id);

  // ── Form state ───────────────────────────────────────────────
  const [chiefComplaint, setChiefComplaint] = useState('');

  // Vitals
  const [weight, setWeight] = useState('');
  const [temp, setTemp] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [respRate, setRespRate] = useState('');
  const [painScore, setPainScore] = useState('');
  const [bcs, setBcs] = useState('');

  // Physical exam
  const [examNotes, setExamNotes] = useState('');
  const [systemsWnl, setSystemsWnl] = useState<Record<string, boolean>>(
    Object.fromEntries(BODY_SYSTEMS.map((s) => [s, true]))
  );

  // Diagnosis
  const [primaryDx, setPrimaryDx] = useState('');
  const [secondaryDx, setSecondaryDx] = useState('');
  const [dxNotes, setDxNotes] = useState('');
  const [icdCode, setIcdCode] = useState('');

  // Lab tests
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set());
  const [testNotes, setTestNotes] = useState<Record<string, string>>({});

  // Medications
  const [meds, setMeds] = useState<MedRow[]>([]);
  const [nextMedId, setNextMedId] = useState(1);

  // Treatment
  const [procedures, setProcedures] = useState('');
  const [ownerInstructions, setOwnerInstructions] = useState('');

  // Follow-up
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpReason, setFollowUpReason] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');

  // Front Desk Tasks
  const [frontDeskTasks, setFrontDeskTasks] = useState<FrontDeskTask[]>([]);
  const [nextTaskId, setNextTaskId] = useState(1);

  // ── Elapsed timer — starts counting from 0 when page mounts ──
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

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
              onClick={() => navigate('/appointments')}
              className="p-2 hover:bg-[var(--surface-elevated)] transition-colors flex-shrink-0"
              style={{ borderRadius: '8px' }}
            >
              <ArrowLeft className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
            <ClipboardList className="w-5 h-5 text-[var(--brand-green-text)] flex-shrink-0" />
            <span className="text-[var(--text-primary)]" style={{ fontSize: '18px', fontWeight: 700 }}>
              Visit Notes
            </span>
          </div>

          {/* Center: step breadcrumb */}
          <div className="flex items-center gap-2 flex-shrink-0">
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
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Elapsed timer pill */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5"
              style={{
                backgroundColor: elapsedSec >= durationMin * 60 ? '#f43f5e18' : '#2D6A4F14',
                border: `1px solid ${elapsedSec >= durationMin * 60 ? '#f43f5e50' : '#2D6A4F40'}`,
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
      <div className="max-w-[960px] mx-auto p-8 space-y-6">

        {/* ── Patient Info Card ── */}
        <div
          className="bg-[var(--surface-white)] border border-[var(--border-color)]"
          style={{ borderRadius: '12px', borderLeft: '4px solid #2D6A4F', overflow: 'hidden' }}
        >
          <div className="p-5 flex items-center gap-5">
            <Avatar className="w-16 h-16 flex-shrink-0">
              <AvatarImage src={appt.petImage} alt={appt.petName} className="object-cover" />
              <AvatarFallback style={{ fontSize: '20px', fontWeight: 700 }}>{appt.petName.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[var(--text-primary)]" style={{ fontSize: '22px', fontWeight: 700 }}>{appt.petName}</p>
                {appt.clientId && (
                  <Link
                    to={`/clients/${appt.clientId}`}
                    className="inline-flex items-center gap-1 transition-colors hover:opacity-80"
                    style={{
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--brand-green-text)',
                      backgroundColor: '#2D6A4F15',
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
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
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
                    border: `1.5px solid ${wnl ? '#2D6A4F40' : '#d4183d40'}`,
                    backgroundColor: wnl ? '#2D6A4F08' : '#d4183d08',
                  }}
                >
                  <div
                    style={{
                      width: 16, height: 16, borderRadius: '4px',
                      border: `2px solid ${wnl ? '#2D6A4F' : '#d4183d'}`,
                      backgroundColor: wnl ? '#2D6A4F' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {wnl && <span style={{ color: '#fff', fontSize: '10px', lineHeight: 1, fontWeight: 700 }}>✓</span>}
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
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '13px', fontWeight: 600 }}>
                Primary Diagnosis
              </label>
              <Input
                placeholder="e.g. Otitis externa"
                value={primaryDx}
                onChange={(e) => setPrimaryDx(e.target.value)}
                style={{ borderRadius: '8px' }}
              />
            </div>
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '13px', fontWeight: 600 }}>
                Secondary Diagnosis
              </label>
              <Input
                placeholder="e.g. Allergic dermatitis"
                value={secondaryDx}
                onChange={(e) => setSecondaryDx(e.target.value)}
                style={{ borderRadius: '8px' }}
              />
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
                          border: `1.5px solid ${active ? '#2D6A4F' : 'var(--border-color)'}`,
                          backgroundColor: active ? '#2D6A4F' : 'transparent',
                          color: active ? '#fff' : 'var(--text-secondary)',
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
                border: '1.5px solid #2D6A4F',
                backgroundColor: '#2D6A4F10',
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
                border: '1.5px solid #2D6A4F',
                backgroundColor: '#2D6A4F10',
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

      </div>

      {/* ─── Sticky Footer ────────────────────────────────── */}
      <div
        className="sticky bottom-0 bg-[var(--surface-white)] border-t border-[var(--border-color)] mt-auto"
        style={{ padding: '14px 32px', zIndex: 20 }}
      >
        <div className="max-w-[960px] mx-auto flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate('/appointments')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Appointments
          </Button>
          <Button
            onClick={() => { advanceToCheckout(id!); navigate(`/appointments/${id}/checkout`); }}
            style={{ backgroundColor: '#2D6A4F', color: '#fff', border: 'none' }}
            className="hover:opacity-90"
          >
            Next: Checkout
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
