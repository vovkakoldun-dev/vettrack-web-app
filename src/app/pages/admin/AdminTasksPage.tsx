import { useState } from 'react';
import {
  CheckSquare, Clock, AlertTriangle, CheckCircle2, Search,
  Phone, Calendar, Pill, FlaskConical, FileText, Bell,
  Filter, ChevronDown, User, Stethoscope, X, Plus,
  ArrowUpRight, MoreHorizontal, Circle,
} from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { StatCard } from '../../components/StatCard';

// ─── Types ────────────────────────────────────────────────────

type Priority = 'Urgent' | 'High' | 'Normal' | 'Low';
type TaskStatus = 'Pending' | 'In Progress' | 'Completed';
type TaskType =
  | 'Follow-up Call'
  | 'Medication Refill'
  | 'Lab Follow-up'
  | 'Schedule Appointment'
  | 'Owner Notification'
  | 'Prescription Ready'
  | 'Referral'
  | 'Home Care Check';

interface Task {
  id: string;
  type: TaskType;
  priority: Priority;
  status: TaskStatus;
  dueDate: string;
  dueTime?: string;
  petName: string;
  petSpecies: string;
  ownerName: string;
  ownerPhone: string;
  assignedBy: string;           // doctor name
  visitDate: string;
  doctorNotes: string;
  assignedTo?: string;          // front-desk staff
  completedAt?: string;
  tags?: string[];
}

// ─── Mock Data ────────────────────────────────────────────────

const TASKS: Task[] = [
  {
    id: 'T-001',
    type: 'Follow-up Call',
    priority: 'Urgent',
    status: 'Pending',
    dueDate: '2026-03-15',
    dueTime: '10:00 AM',
    petName: 'Max',
    petSpecies: 'Dog',
    ownerName: 'John Smith',
    ownerPhone: '(555) 234-5678',
    assignedBy: 'Dr. Sarah Chen',
    visitDate: '2026-03-14',
    doctorNotes: 'Max showed signs of lethargy post-vaccination. Please call owner tomorrow morning to check on his condition. If symptoms persist — vomiting or extreme fatigue — advise them to come in immediately.',
    tags: ['Post-vaccination', 'Monitor'],
  },
  {
    id: 'T-002',
    type: 'Medication Refill',
    priority: 'High',
    status: 'In Progress',
    dueDate: '2026-03-15',
    dueTime: '2:00 PM',
    petName: 'Bella',
    petSpecies: 'Cat',
    ownerName: 'Sarah Williams',
    ownerPhone: '(555) 345-6789',
    assignedBy: 'Dr. James Miller',
    visitDate: '2026-03-13',
    doctorNotes: 'Bella is on thyroid medication (Methimazole 2.5mg). Owner requested a 90-day refill. Prescription is pre-approved. Call pharmacy to prepare and notify owner for pickup.',
    assignedTo: 'Sarah Mitchell',
    tags: ['Thyroid', 'Chronic medication'],
  },
  {
    id: 'T-003',
    type: 'Lab Follow-up',
    priority: 'Urgent',
    status: 'Pending',
    dueDate: '2026-03-15',
    dueTime: '11:30 AM',
    petName: 'Cooper',
    petSpecies: 'Dog',
    ownerName: 'Michael Brown',
    ownerPhone: '(555) 456-7890',
    assignedBy: 'Dr. Sarah Chen',
    visitDate: '2026-03-14',
    doctorNotes: 'CBC panel came back with elevated WBC (18.4 K/μL). Needs owner notification ASAP. Schedule a recheck appointment for next week. Also confirm the urine culture results from the lab — should be ready today.',
    tags: ['CBC', 'Elevated WBC', 'Recheck needed'],
  },
  {
    id: 'T-004',
    type: 'Schedule Appointment',
    priority: 'Normal',
    status: 'Pending',
    dueDate: '2026-03-16',
    petName: 'Daisy',
    petSpecies: 'Dog',
    ownerName: 'Emily Davis',
    ownerPhone: '(555) 567-8901',
    assignedBy: 'Dr. James Miller',
    visitDate: '2026-03-14',
    doctorNotes: 'Annual dental cleaning is overdue by 3 months. Please schedule a dental appointment within the next 2 weeks. Morning slots preferred. Remind owner to fast Daisy 8 hours before the procedure.',
    tags: ['Dental', 'Annual care'],
  },
  {
    id: 'T-005',
    type: 'Owner Notification',
    priority: 'High',
    status: 'Completed',
    dueDate: '2026-03-14',
    dueTime: '3:00 PM',
    petName: 'Milo',
    petSpecies: 'Cat',
    ownerName: 'Robert Johnson',
    ownerPhone: '(555) 678-9012',
    assignedBy: 'Dr. Sarah Chen',
    visitDate: '2026-03-14',
    doctorNotes: "Milo's X-ray confirmed a small bladder stone (3mm). Not requiring surgery at this point. Owner needs to be informed and given the prescription diet instructions (Hills C/D). Provide printed dietary guide.",
    assignedTo: 'Sarah Mitchell',
    completedAt: '2026-03-14 2:45 PM',
    tags: ['Bladder stone', 'Dietary change'],
  },
  {
    id: 'T-006',
    type: 'Prescription Ready',
    priority: 'Normal',
    status: 'Completed',
    dueDate: '2026-03-14',
    petName: 'Luna',
    petSpecies: 'Cat',
    ownerName: 'Jennifer Lee',
    ownerPhone: '(555) 789-0123',
    assignedBy: 'Dr. James Miller',
    visitDate: '2026-03-13',
    doctorNotes: 'Flea/tick prevention (Bravecto) and ear drops (Otomax) are ready for pickup. Owner should be notified via call. If no answer, send a text message reminder.',
    assignedTo: 'Sarah Mitchell',
    completedAt: '2026-03-14 10:20 AM',
    tags: ['Pickup ready'],
  },
  {
    id: 'T-007',
    type: 'Follow-up Call',
    priority: 'High',
    status: 'Pending',
    dueDate: '2026-03-16',
    petName: 'Charlie',
    petSpecies: 'Dog',
    ownerName: 'David Wilson',
    ownerPhone: '(555) 890-1234',
    assignedBy: 'Dr. Sarah Chen',
    visitDate: '2026-03-12',
    doctorNotes: 'Post-surgery recovery check. Charlie had a soft tissue mass removed from left hind leg. Stitches should be inspected — ask owner to send a photo if possible. Schedule suture removal in 5 days if healing well.',
    tags: ['Post-surgery', 'Suture check'],
  },
  {
    id: 'T-008',
    type: 'Home Care Check',
    priority: 'Normal',
    status: 'In Progress',
    dueDate: '2026-03-17',
    petName: 'Rocky',
    petSpecies: 'Dog',
    ownerName: 'Lisa Martinez',
    ownerPhone: '(555) 901-2345',
    assignedBy: 'Dr. James Miller',
    visitDate: '2026-03-13',
    doctorNotes: 'Rocky was diagnosed with mild hip dysplasia. Owner was given a home exercise plan and joint supplement regime (Cosequin DS). Follow up to confirm they started the protocol and answer any questions about the exercises.',
    assignedTo: 'Sarah Mitchell',
    tags: ['Hip dysplasia', 'Rehab'],
  },
  {
    id: 'T-009',
    type: 'Referral',
    priority: 'High',
    status: 'Pending',
    dueDate: '2026-03-16',
    dueTime: '9:00 AM',
    petName: 'Whiskers',
    petSpecies: 'Cat',
    ownerName: 'Karen Thompson',
    ownerPhone: '(555) 012-3456',
    assignedBy: 'Dr. Sarah Chen',
    visitDate: '2026-03-14',
    doctorNotes: 'Whiskers needs a cardiology referral. Echo showed possible HCM (hypertrophic cardiomyopathy). Please contact Animal Cardiology Specialists at (555) 300-4400 and schedule an appointment within this week. Send medical records in advance.',
    tags: ['Cardiology', 'HCM', 'Urgent referral'],
  },
  {
    id: 'T-010',
    type: 'Lab Follow-up',
    priority: 'Normal',
    status: 'Pending',
    dueDate: '2026-03-18',
    petName: 'Nala',
    petSpecies: 'Dog',
    ownerName: 'Marcus Davis',
    ownerPhone: '(555) 123-4567',
    assignedBy: 'Dr. James Miller',
    visitDate: '2026-03-14',
    doctorNotes: 'Thyroid panel and cortisol test results expected Thursday. Once in, review with Dr. Miller and then contact owner with results. If cortisol is elevated, we may need to discuss Cushing\'s disease management options.',
    tags: ['Thyroid', 'Cortisol', 'Awaiting results'],
  },
  {
    id: 'T-011',
    type: 'Schedule Appointment',
    priority: 'Low',
    status: 'Pending',
    dueDate: '2026-03-20',
    petName: 'Peanut',
    petSpecies: 'Rabbit',
    ownerName: 'Amy Chen',
    ownerPhone: '(555) 234-5670',
    assignedBy: 'Dr. Sarah Chen',
    visitDate: '2026-03-10',
    doctorNotes: 'Peanut is due for a 6-month wellness check. No urgent issues but preventive care is important for rabbits. Please reach out to owner and schedule sometime in the next 3–4 weeks.',
    tags: ['Wellness', 'Preventive care'],
  },
  {
    id: 'T-012',
    type: 'Medication Refill',
    priority: 'Urgent',
    status: 'Pending',
    dueDate: '2026-03-15',
    dueTime: '12:00 PM',
    petName: 'Shadow',
    petSpecies: 'Dog',
    ownerName: 'Tom Baker',
    ownerPhone: '(555) 345-6780',
    assignedBy: 'Dr. James Miller',
    visitDate: '2026-03-13',
    doctorNotes: 'Shadow is on Phenobarbital for seizure management. Owner is down to 2 days of medication — CRITICAL that this is refilled today. Contact pharmacy immediately. Owner can pick up or we can arrange delivery.',
    tags: ['Seizure', 'Critical medication', 'URGENT'],
  },
];

// ─── Config Maps ──────────────────────────────────────────────

const PRIORITY_CONFIG: Record<Priority, { color: string; bg: string; dot: string }> = {
  Urgent: { color: '#d4183d', bg: 'rgba(212,24,61,0.1)',  dot: '#d4183d' },
  High:   { color: '#F4A261', bg: 'rgba(244,162,97,0.1)', dot: '#F4A261' },
  Normal: { color: '#2D6A4F', bg: 'rgba(45,106,79,0.1)',  dot: '#2D6A4F' },
  Low:    { color: '#6B7280', bg: 'rgba(107,114,128,0.1)',dot: '#6B7280' },
};

const STATUS_CONFIG: Record<TaskStatus, { color: string; bg: string; label: string }> = {
  'Pending':     { color: '#F4A261', bg: 'rgba(244,162,97,0.1)',  label: 'Pending'     },
  'In Progress': { color: '#3B82F6', bg: 'rgba(59,130,246,0.1)',  label: 'In Progress' },
  'Completed':   { color: '#2D6A4F', bg: 'rgba(45,106,79,0.1)',   label: 'Completed'   },
};

const TYPE_CONFIG: Record<TaskType, { icon: React.ElementType; color: string }> = {
  'Follow-up Call':      { icon: Phone,         color: '#2D6A4F' },
  'Medication Refill':   { icon: Pill,          color: '#8B5CF6' },
  'Lab Follow-up':       { icon: FlaskConical,  color: '#3B82F6' },
  'Schedule Appointment':{ icon: Calendar,      color: '#06B6D4' },
  'Owner Notification':  { icon: Bell,          color: '#F4A261' },
  'Prescription Ready':  { icon: FileText,      color: '#6B7280' },
  'Referral':            { icon: ArrowUpRight,  color: '#EC4899' },
  'Home Care Check':     { icon: Stethoscope,   color: '#10B981' },
};

// ─── Helpers ──────────────────────────────────────────────────

function isOverdue(task: Task) {
  if (task.status === 'Completed') return false;
  const today = '2026-03-15';
  return task.dueDate < today;
}

function isDueToday(task: Task) {
  return task.dueDate === '2026-03-15' && task.status !== 'Completed';
}

function formatDate(d: string) {
  const [, m, day] = d.split('-');
  const months = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m)]} ${parseInt(day)}`;
}

// ─── Task Card ────────────────────────────────────────────────

function TaskCard({
  task,
  onStatusChange,
}: {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const TypeIcon = TYPE_CONFIG[task.type].icon;
  const typeColor = TYPE_CONFIG[task.type].color;
  const pCfg = PRIORITY_CONFIG[task.priority];
  const sCfg = STATUS_CONFIG[task.status];
  const overdue = isOverdue(task);
  const today = isDueToday(task);

  return (
    <div
      className="bg-[var(--surface-white)] border border-[var(--border-color)] transition-all hover:border-[#2D6A4F]/40 hover:shadow-sm"
      style={{
        borderRadius: '12px',
        borderLeft: `3px solid ${pCfg.dot}`,
        opacity: task.status === 'Completed' ? 0.7 : 1,
      }}
    >
      {/* Main row */}
      <div style={{ padding: '14px 16px' }}>
        <div className="flex items-start gap-3">

          {/* Type icon */}
          <div style={{
            width: 36, height: 36, borderRadius: '10px', flexShrink: 0,
            backgroundColor: `${typeColor}18`,
            border: `1px solid ${typeColor}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <TypeIcon style={{ width: 16, height: 16, color: typeColor }} />
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Row 1: type + badges */}
            <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                {task.type}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                color: pCfg.color, backgroundColor: pCfg.bg, border: `1px solid ${pCfg.color}30`,
              }}>
                {task.priority}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                color: sCfg.color, backgroundColor: sCfg.bg,
              }}>
                {sCfg.label}
              </span>
              {overdue && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                  color: '#d4183d', backgroundColor: 'rgba(212,24,61,0.1)',
                }}>
                  Overdue
                </span>
              )}
              {today && !overdue && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                  color: '#2D6A4F', backgroundColor: 'rgba(45,106,79,0.1)',
                }}>
                  Due Today
                </span>
              )}
            </div>

            {/* Row 2: pet + owner */}
            <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: 6 }}>
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {task.petName}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  ({task.petSpecies})
                </span>
              </div>
              <span style={{ color: 'var(--border-color)', fontSize: 12 }}>·</span>
              <div className="flex items-center gap-1">
                <User style={{ width: 11, height: 11, color: 'var(--text-secondary)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{task.ownerName}</span>
              </div>
              <span style={{ color: 'var(--border-color)', fontSize: 12 }}>·</span>
              <div className="flex items-center gap-1">
                <Phone style={{ width: 11, height: 11, color: 'var(--text-secondary)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{task.ownerPhone}</span>
              </div>
            </div>

            {/* Row 3: assigned by + due */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1">
                <Stethoscope style={{ width: 11, height: 11, color: 'var(--text-secondary)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {task.assignedBy} · Visit {formatDate(task.visitDate)}
                </span>
              </div>
              <span style={{ color: 'var(--border-color)', fontSize: 12 }}>·</span>
              <div className="flex items-center gap-1">
                <Clock style={{ width: 11, height: 11, color: overdue ? '#d4183d' : 'var(--text-secondary)' }} />
                <span style={{ fontSize: 12, color: overdue ? '#d4183d' : 'var(--text-secondary)', fontWeight: overdue ? 600 : 400 }}>
                  Due {formatDate(task.dueDate)}{task.dueTime ? ` · ${task.dueTime}` : ''}
                </span>
              </div>
              {task.assignedTo && (
                <>
                  <span style={{ color: 'var(--border-color)', fontSize: 12 }}>·</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    → {task.assignedTo}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {task.status !== 'Completed' && (
              <button
                onClick={() => onStatusChange(task.id, 'Completed')}
                className="flex items-center gap-1.5 transition-colors hover:opacity-80"
                style={{
                  fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 8,
                  backgroundColor: '#2D6A4F', color: '#fff', border: 'none', cursor: 'pointer',
                }}
              >
                <CheckCircle2 style={{ width: 13, height: 13 }} />
                Done
              </button>
            )}
            {task.status === 'Pending' && (
              <button
                onClick={() => onStatusChange(task.id, 'In Progress')}
                className="flex items-center gap-1.5 transition-colors hover:opacity-80"
                style={{
                  fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 8,
                  backgroundColor: 'var(--surface-elevated)', color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)', cursor: 'pointer',
                }}
              >
                <Circle style={{ width: 13, height: 13 }} />
                Start
              </button>
            )}
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center justify-center transition-colors hover:bg-[var(--surface-elevated)]"
              style={{
                width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border-color)',
                backgroundColor: 'transparent', cursor: 'pointer',
              }}
            >
              <ChevronDown
                style={{
                  width: 14, height: 14, color: 'var(--text-secondary)',
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded: doctor notes + tags */}
      {expanded && (
        <div
          style={{
            borderTop: '1px solid var(--border-color)',
            padding: '14px 16px 14px 55px',
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Doctor's Notes
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: 10 }}>
            "{task.doctorNotes}"
          </p>
          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {task.tags.map(tag => (
                <span key={tag} style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 999,
                  backgroundColor: 'var(--surface-elevated)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)', fontWeight: 500,
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
          {task.completedAt && (
            <p style={{ fontSize: 12, color: '#2D6A4F', marginTop: 10, fontWeight: 500 }}>
              ✓ Completed {task.completedAt}{task.assignedTo ? ` by ${task.assignedTo}` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

const STATUS_TABS: { key: 'All' | TaskStatus; label: string }[] = [
  { key: 'All',         label: 'All' },
  { key: 'Pending',     label: 'Pending' },
  { key: 'In Progress', label: 'In Progress' },
  { key: 'Completed',   label: 'Completed' },
];

const PRIORITY_OPTIONS: Array<Priority | 'All'> = ['All', 'Urgent', 'High', 'Normal', 'Low'];
const TYPE_OPTIONS: Array<TaskType | 'All'> = [
  'All', 'Follow-up Call', 'Medication Refill', 'Lab Follow-up',
  'Schedule Appointment', 'Owner Notification', 'Prescription Ready', 'Referral', 'Home Care Check',
];

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>(TASKS);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | TaskStatus>('All');
  const [priority, setPriority] = useState<Priority | 'All'>('All');
  const [type, setType] = useState<TaskType | 'All'>('All');
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);

  const handleStatusChange = (id: string, status: TaskStatus) => {
    setTasks(prev => prev.map(t =>
      t.id === id
        ? { ...t, status, completedAt: status === 'Completed' ? '2026-03-15 now' : t.completedAt }
        : t
    ));
  };

  // Stats
  const total     = tasks.length;
  const urgent    = tasks.filter(t => t.priority === 'Urgent' && t.status !== 'Completed').length;
  const dueToday  = tasks.filter(isDueToday).length;
  const completed = tasks.filter(t => t.status === 'Completed').length;

  // Filter
  const filtered = tasks.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || [t.petName, t.ownerName, t.assignedBy, t.type, t.doctorNotes]
      .some(s => s.toLowerCase().includes(q));
    const matchTab  = activeTab === 'All' || t.status === activeTab;
    const matchPri  = priority === 'All' || t.priority === priority;
    const matchType = type === 'All' || t.type === type;
    return matchSearch && matchTab && matchPri && matchType;
  });

  // Sort: urgent first, then by due date
  const PRIORITY_ORDER: Record<Priority, number> = { Urgent: 0, High: 1, Normal: 2, Low: 3 };
  const STATUS_ORDER: Record<TaskStatus, number> = { Pending: 0, 'In Progress': 1, Completed: 2 };
  const sorted = [...filtered].sort((a, b) => {
    const sA = STATUS_ORDER[a.status], sB = STATUS_ORDER[b.status];
    if (sA !== sB) return sA - sB;
    const pA = PRIORITY_ORDER[a.priority], pB = PRIORITY_ORDER[b.priority];
    if (pA !== pB) return pA - pB;
    return a.dueDate.localeCompare(b.dueDate);
  });

  return (
    <div style={{ padding: '32px 32px 48px', maxWidth: '1100px', margin: '0 auto' }}>

      {/* Header */}
      <div className="flex items-start justify-between" style={{ marginBottom: '28px' }}>
        <div>
          <h1 className="text-[var(--text-primary)]" style={{ fontSize: '28px', fontWeight: 700, marginBottom: '4px' }}>
            Tasks
          </h1>
          <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>
            Follow-up tasks and action items assigned by doctors
          </p>
        </div>
        <Button
          style={{ backgroundColor: '#2D6A4F', color: '#fff', gap: '6px', display: 'flex', alignItems: 'center' }}
        >
          <Plus style={{ width: 15, height: 15 }} />
          New Task
        </Button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
        <StatCard title="Total Tasks"     value={total}     icon={CheckSquare}    iconColor="#2D6A4F" />
        <StatCard title="Urgent"          value={urgent}    icon={AlertTriangle}  iconColor="#d4183d"
          trend={urgent > 0 ? { value: `${urgent} need immediate action`, isPositive: false } : undefined} />
        <StatCard title="Due Today"       value={dueToday}  icon={Clock}          iconColor="#F4A261" />
        <StatCard title="Completed"       value={completed} icon={CheckCircle2}   iconColor="#3B82F6"
          trend={{ value: `${Math.round(completed / total * 100)}% completion rate`, isPositive: true }} />
      </div>

      {/* Filters */}
      <div
        className="bg-[var(--surface-white)] border border-[var(--border-color)]"
        style={{ borderRadius: '12px', padding: '16px', marginBottom: '16px' }}
      >
        <div className="flex items-center gap-3 flex-wrap">

          {/* Search */}
          <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
            <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: 'var(--text-secondary)' }} />
            <Input
              placeholder="Search by pet, owner, doctor, or task type…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '32px' }}
            />
          </div>

          {/* Priority dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setPriorityOpen(o => !o); setTypeOpen(false); }}
              className="flex items-center gap-2 transition-colors hover:bg-[var(--surface-elevated)] border border-[var(--border-color)]"
              style={{ borderRadius: '8px', padding: '7px 12px', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', backgroundColor: 'var(--surface-white)', cursor: 'pointer' }}
            >
              <Filter style={{ width: 13, height: 13 }} />
              {priority === 'All' ? 'Priority' : priority}
              <ChevronDown style={{ width: 13, height: 13, color: 'var(--text-secondary)' }} />
            </button>
            {priorityOpen && (
              <div className="bg-[var(--surface-white)] border border-[var(--border-color)]"
                style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 20, minWidth: '130px', overflow: 'hidden' }}>
                {PRIORITY_OPTIONS.map(p => (
                  <button key={p} onClick={() => { setPriority(p); setPriorityOpen(false); }}
                    className="w-full text-left hover:bg-[var(--surface-elevated)] transition-colors"
                    style={{ padding: '8px 14px', fontSize: '13px', color: priority === p ? '#2D6A4F' : 'var(--text-primary)', fontWeight: priority === p ? 700 : 400 }}>
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Type dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setTypeOpen(o => !o); setPriorityOpen(false); }}
              className="flex items-center gap-2 transition-colors hover:bg-[var(--surface-elevated)] border border-[var(--border-color)]"
              style={{ borderRadius: '8px', padding: '7px 12px', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', backgroundColor: 'var(--surface-white)', cursor: 'pointer' }}
            >
              <CheckSquare style={{ width: 13, height: 13 }} />
              {type === 'All' ? 'Task Type' : type}
              <ChevronDown style={{ width: 13, height: 13, color: 'var(--text-secondary)' }} />
            </button>
            {typeOpen && (
              <div className="bg-[var(--surface-white)] border border-[var(--border-color)]"
                style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 20, minWidth: '180px', overflow: 'hidden' }}>
                {TYPE_OPTIONS.map(tt => (
                  <button key={tt} onClick={() => { setType(tt); setTypeOpen(false); }}
                    className="w-full text-left hover:bg-[var(--surface-elevated)] transition-colors"
                    style={{ padding: '8px 14px', fontSize: '13px', color: type === tt ? '#2D6A4F' : 'var(--text-primary)', fontWeight: type === tt ? 700 : 400 }}>
                    {tt}
                  </button>
                ))}
              </div>
            )}
          </div>

          {(search || priority !== 'All' || type !== 'All') && (
            <button
              onClick={() => { setSearch(''); setPriority('All'); setType('All'); }}
              className="flex items-center gap-1 transition-colors hover:opacity-70"
              style={{ fontSize: '13px', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
            >
              <X style={{ width: 13, height: 13 }} />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1" style={{ marginBottom: '16px' }}>
        {STATUS_TABS.map(tab => {
          const count = tab.key === 'All' ? tasks.length : tasks.filter(t => t.status === tab.key).length;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 transition-colors"
              style={{
                padding: '7px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                border: 'none', cursor: 'pointer',
                backgroundColor: isActive ? '#2D6A4F' : 'transparent',
                color: isActive ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {tab.label}
              <span style={{
                fontSize: 11, fontWeight: 700,
                padding: '1px 7px', borderRadius: 999,
                backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'var(--surface-elevated)',
                color: isActive ? '#fff' : 'var(--text-secondary)',
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Task list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {sorted.length === 0 ? (
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)]"
            style={{ borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
            <CheckCircle2 style={{ width: 40, height: 40, color: 'var(--border-color)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>No tasks found</p>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 4 }}>Try adjusting your filters</p>
          </div>
        ) : sorted.map(task => (
          <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} />
        ))}
      </div>

      {sorted.length > 0 && (
        <p className="text-[var(--text-secondary)]" style={{ fontSize: '13px', marginTop: '16px', textAlign: 'center' }}>
          Showing {sorted.length} of {tasks.length} tasks
        </p>
      )}
    </div>
  );
}
