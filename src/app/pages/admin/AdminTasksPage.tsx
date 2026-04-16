import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckSquare, Clock, AlertTriangle, CheckCircle2, Search,
  Phone, Calendar, Pill, FlaskConical, FileText, Bell,
  Filter, ChevronDown, User, Stethoscope, X, Trash2,
  ArrowUpRight, MoreHorizontal, Circle, Plus, AlarmClock,
  UserCheck, UserPlus, Play, MoreVertical,
} from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Button } from '../../components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../../components/ui/select';
import { StatCard } from '../../components/StatCard';
import { supabase } from '../../../lib/supabase';
import { useTenantDb } from '../../context/TenantContext';
import { getOrgContext } from '../../hooks/useOrgContext';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../hooks/useProfile';

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
  assignedBy: string;           // doctor display name
  visitDate: string;
  doctorNotes: string;
  assignedTo?: string;          // front-desk staff display name
  assignedToId?: string;        // profile id of assignee
  completedAt?: string;
  completedBy?: string;         // display name of who completed the task
  completedById?: string;       // profile id of who completed
  tags?: string[];
  snoozedUntil?: string;        // ISO timestamp — task postponed until this time
}

// ─── Supabase select with joins ──────────────────────────────

const TASKS_SELECT = `
  id, type, priority, status, due_date, due_time,
  visit_date, doctor_notes, completed_at, tags, snoozed_until, assigned_to_id, completed_by_id,
  pet:pets!tasks_pet_id_fkey(id, name, species),
  client:clients!tasks_client_id_fkey(id, first_name, last_name, phone),
  assignedByProfile:profiles!tasks_assigned_by_id_fkey(first_name, last_name),
  assignedToProfile:profiles!tasks_assigned_to_id_fkey(first_name, last_name),
  completedByProfile:profiles!tasks_completed_by_id_fkey(first_name, last_name)
`;

function mapRow(r: any): Task {
  const pet = r.pet;
  const client = r.client;
  const byP = r.assignedByProfile;
  const toP = r.assignedToProfile;
  const cbP = r.completedByProfile;
  return {
    id: r.id,
    type: r.type,
    priority: r.priority,
    status: r.status,
    dueDate: r.due_date,
    dueTime: r.due_time || undefined,
    petName: pet?.name || 'Unknown Pet',
    petSpecies: pet?.species || '',
    ownerName: client ? `${client.first_name} ${client.last_name}`.trim() : 'Unknown Owner',
    ownerPhone: client?.phone || '',
    assignedBy: byP ? `Dr. ${byP.last_name}` : 'Unknown',
    visitDate: r.visit_date,
    doctorNotes: r.doctor_notes || '',
    assignedTo: toP ? `${toP.first_name} ${toP.last_name}`.trim() : undefined,
    assignedToId: r.assigned_to_id || undefined,
    completedAt: r.completed_at || undefined,
    completedBy: cbP ? `${cbP.first_name} ${cbP.last_name}`.trim() : undefined,
    completedById: r.completed_by_id || undefined,
    tags: r.tags || [],
    snoozedUntil: r.snoozed_until || undefined,
  };
}

// ─── Config Maps ──────────────────────────────────────────────

const PRIORITY_CONFIG: Record<Priority, { color: string; bg: string; dot: string }> = {
  Urgent: { color: '#d4183d', bg: 'rgba(212,24,61,0.1)',  dot: '#d4183d' },
  High:   { color: '#F4A261', bg: 'rgba(244,162,97,0.1)', dot: '#F4A261' },
  Normal: { color: 'var(--brand-green-text)', bg: 'color-mix(in srgb, var(--brand-green-text) 10%, transparent)',  dot: 'var(--brand-green-text)' },
  Low:    { color: '#6B7280', bg: 'rgba(107,114,128,0.1)',dot: '#6B7280' },
};

const STATUS_CONFIG: Record<TaskStatus, { color: string; bg: string; label: string }> = {
  'Pending':     { color: '#F4A261', bg: 'rgba(244,162,97,0.1)',  label: 'Pending'     },
  'In Progress': { color: '#3B82F6', bg: 'color-mix(in srgb, var(--brand-green-text) 10%, transparent)',  label: 'In Progress' },
  'Completed':   { color: 'var(--brand-green-text)', bg: 'color-mix(in srgb, var(--brand-green-text) 10%, transparent)',   label: 'Completed'   },
};

const TYPE_CONFIG: Record<TaskType, { icon: React.ElementType; color: string }> = {
  'Follow-up Call':      { icon: Phone,         color: 'var(--brand-green-text)' },
  'Medication Refill':   { icon: Pill,          color: '#8B5CF6' },
  'Lab Follow-up':       { icon: FlaskConical,  color: '#3B82F6' },
  'Schedule Appointment':{ icon: Calendar,      color: '#06B6D4' },
  'Owner Notification':  { icon: Bell,          color: '#F4A261' },
  'Prescription Ready':  { icon: FileText,      color: '#6B7280' },
  'Referral':            { icon: ArrowUpRight,  color: '#EC4899' },
  'Home Care Check':     { icon: Stethoscope,   color: '#10B981' },
};

// ─── Helpers ──────────────────────────────────────────────────

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isOverdue(task: Task) {
  if (task.status === 'Completed') return false;
  return task.dueDate < getTodayStr();
}

function isDueToday(task: Task) {
  return task.dueDate === getTodayStr() && task.status !== 'Completed';
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
  onDelete,
  onSnooze,
  onAssign,
  currentUserId,
  currentUserName,
}: {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  onSnooze: (id: string) => void;
  onAssign: (id: string) => void;
  currentUserId?: string;
  currentUserName?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isAssignedToMe = task.assignedToId === currentUserId;
  const isSnoozed = task.snoozedUntil && new Date(task.snoozedUntil) > new Date();
  const TypeIcon = TYPE_CONFIG[task.type].icon;
  const typeColor = TYPE_CONFIG[task.type].color;
  const pCfg = PRIORITY_CONFIG[task.priority];
  const sCfg = STATUS_CONFIG[task.status];
  const overdue = isOverdue(task);
  const today = isDueToday(task);
  const isCompleted = task.status === 'Completed';

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  return (
    <div
      className="bg-[var(--surface-white)] border border-[var(--border-color)] transition-all hover:border-[var(--brand-green-text)]/40 hover:shadow-sm"
      style={{
        borderRadius: '12px',
        borderLeft: `3px solid ${pCfg.dot}`,
      }}
    >
      {/* Main row — clickable to expand */}
      <div
        style={{ padding: '14px 16px', cursor: 'pointer', opacity: isCompleted ? 0.65 : 1, transition: 'opacity 0.2s' }}
        onClick={() => setExpanded(e => !e)}
      >
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
                  color: 'var(--brand-green-text)', backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 10%, transparent)',
                }}>
                  Due Today
                </span>
              )}
              {isSnoozed && (
                <span className="flex items-center gap-1" style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                  color: '#8B5CF6', backgroundColor: 'rgba(139,92,246,0.1)',
                }}>
                  <AlarmClock style={{ width: 10, height: 10 }} />
                  Snoozed until {new Date(task.snoozedUntil!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
              {/* Assignment — always visible */}
              {isAssignedToMe ? (
                <span className="flex items-center gap-1" style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                  color: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.1)',
                  border: '1px solid rgba(59,130,246,0.2)',
                }}>
                  <UserCheck style={{ width: 10, height: 10 }} />
                  Assigned to me
                </span>
              ) : task.assignedTo ? (
                <span className="flex items-center gap-1" style={{
                  fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999,
                  color: 'var(--text-secondary)', backgroundColor: 'var(--surface-elevated)',
                  border: '1px solid var(--border-color)',
                }}>
                  <UserCheck style={{ width: 10, height: 10 }} />
                  {task.assignedTo}
                </span>
              ) : !isCompleted ? (
                <span className="flex items-center gap-1" style={{
                  fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999,
                  color: 'var(--text-secondary)', backgroundColor: 'transparent',
                  border: '1px dashed var(--border-color)',
                }}>
                  <UserPlus style={{ width: 10, height: 10 }} />
                  Unassigned
                </span>
              ) : null}
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
              {task.ownerPhone && (
                <>
                  <span style={{ color: 'var(--border-color)', fontSize: 12 }}>·</span>
                  <div className="flex items-center gap-1">
                    <Phone style={{ width: 11, height: 11, color: 'var(--text-secondary)' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{task.ownerPhone}</span>
                  </div>
                </>
              )}
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
            </div>
          </div>

          {/* Right side: primary action + overflow menu */}
          <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
            {!isCompleted && (
              <>
                {/* Primary action: Start (if Pending) or Done (if In Progress) */}
                {task.status === 'Pending' ? (
                  <button
                    onClick={() => onStatusChange(task.id, 'In Progress')}
                    className="flex items-center gap-1.5 transition-all hover:shadow-sm"
                    style={{
                      fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8,
                      backgroundColor: '#3B82F6', color: '#fff', border: 'none', cursor: 'pointer',
                    }}
                  >
                    <Play style={{ width: 12, height: 12 }} />
                    Start
                  </button>
                ) : (
                  <button
                    onClick={() => onStatusChange(task.id, 'Completed')}
                    className="flex items-center gap-1.5 transition-all hover:shadow-sm"
                    style={{
                      fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8,
                      backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)', border: 'none', cursor: 'pointer',
                    }}
                  >
                    <CheckCircle2 style={{ width: 13, height: 13 }} />
                    Done
                  </button>
                )}
              </>
            )}

            {/* Overflow menu ··· */}
            <div style={{ position: 'relative' }} ref={menuRef}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="flex items-center justify-center transition-colors hover:bg-[var(--surface-elevated)]"
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  backgroundColor: menuOpen ? 'var(--surface-elevated)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <MoreVertical style={{ width: 15, height: 15, color: 'var(--text-secondary)' }} />
              </button>

              {menuOpen && (
                <div
                  className="border border-[var(--border-color)]"
                  style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 4px)',
                    borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.08)',
                    zIndex: 30, minWidth: 180, overflow: 'hidden', padding: '4px 0',
                    background: 'linear-gradient(var(--surface-white), var(--surface-white)), linear-gradient(var(--bg-offwhite), var(--bg-offwhite))',
                  }}
                >
                  {/* Claim / Unclaim */}
                  {!isCompleted && (
                    <button
                      onClick={() => { onAssign(task.id); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 transition-colors hover:bg-[var(--surface-elevated)]"
                      style={{ padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}
                    >
                      {isAssignedToMe
                        ? <><UserCheck style={{ width: 14, height: 14, color: '#3B82F6' }} /><span>Unassign from me</span></>
                        : <><UserPlus style={{ width: 14, height: 14, color: 'var(--text-secondary)' }} /><span>Claim task</span></>
                      }
                    </button>
                  )}

                  {/* Snooze */}
                  {!isCompleted && (
                    <button
                      onClick={() => { onSnooze(task.id); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 transition-colors hover:bg-[var(--surface-elevated)]"
                      style={{ padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}
                    >
                      <AlarmClock style={{ width: 14, height: 14, color: isSnoozed ? '#8B5CF6' : 'var(--text-secondary)' }} />
                      <span>{isSnoozed ? 'Change snooze' : 'Snooze / Postpone'}</span>
                    </button>
                  )}

                  {/* Mark Done (also accessible from expanded, as secondary path) */}
                  {task.status !== 'Completed' && (
                    <button
                      onClick={() => { onStatusChange(task.id, 'Completed'); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 transition-colors hover:bg-[var(--surface-elevated)]"
                      style={{ padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--brand-green-text)' }}
                    >
                      <CheckCircle2 style={{ width: 14, height: 14, color: 'var(--brand-green-text)' }} />
                      <span>Mark as done</span>
                    </button>
                  )}

                  {/* Reopen completed task */}
                  {isCompleted && (
                    <button
                      onClick={() => { onStatusChange(task.id, 'Pending'); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 transition-colors hover:bg-[var(--surface-elevated)]"
                      style={{ padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#3B82F6' }}
                    >
                      <Play style={{ width: 14, height: 14, color: '#3B82F6' }} />
                      <span>Reopen task</span>
                    </button>
                  )}

                  {/* Divider */}
                  <div style={{ height: 1, backgroundColor: 'var(--border-color)', margin: '4px 0' }} />

                  {/* Delete */}
                  <button
                    onClick={() => { onDelete(task.id); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 transition-colors hover:bg-red-50 dark:hover:bg-red-950/20"
                    style={{ padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#d4183d' }}
                  >
                    <Trash2 style={{ width: 14, height: 14 }} />
                    <span>Delete task</span>
                  </button>
                </div>
              )}
            </div>

            {/* Expand chevron */}
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center justify-center transition-colors hover:bg-[var(--surface-elevated)]"
              style={{
                width: 32, height: 32, borderRadius: 8,
                border: '1px solid var(--border-color)',
                backgroundColor: 'transparent', cursor: 'pointer', flexShrink: 0,
              }}
            >
              <ChevronDown
                style={{
                  width: 15, height: 15, color: 'var(--text-secondary)',
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
            opacity: isCompleted ? 0.65 : 1,
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
            <p style={{ fontSize: 12, color: 'var(--brand-green-text)', marginTop: 10, fontWeight: 500 }}>
              ✓ Completed {new Date(task.completedAt).toLocaleString()} by {task.completedBy || task.assignedTo || 'staff'}
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
  const db = useTenantDb();
  const { user } = useAuth();
  const { profile } = useProfile('admin');
  const currentUserId = user?.id;
  const currentUserName = profile?.fullName || profile?.displayName || 'Me';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | TaskStatus>('All');
  const [priority, setPriority] = useState<Priority | 'All'>('All');
  const [type, setType] = useState<TaskType | 'All'>('All');
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);

  // ── Snooze dialog ────────────────────────────────────────────
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [snoozeTaskId, setSnoozeTaskId] = useState<string | null>(null);
  const [snoozeDate, setSnoozeDate] = useState('');
  const [snoozeTime, setSnoozeTime] = useState('09:00');
  const [snoozeSaving, setSnoozeSaving] = useState(false);

  const SNOOZE_PRESETS = [
    { label: 'Later today', hours: 3 },
    { label: 'Tomorrow morning', hours: 24, setTime: '09:00' },
    { label: 'In 2 days', hours: 48, setTime: '09:00' },
    { label: 'Next week', hours: 168, setTime: '09:00' },
  ];

  const openSnooze = (id: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSnoozeTaskId(id);
    setSnoozeDate(`${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`);
    setSnoozeTime('09:00');
    setSnoozeOpen(true);
  };

  const handleSnooze = async (targetDate?: Date) => {
    if (!snoozeTaskId) return;
    setSnoozeSaving(true);
    try {
      const snoozedUntil = targetDate || new Date(`${snoozeDate}T${snoozeTime}`);
      const { organizationId } = await getOrgContext();

      // Update task due_date and snoozed_until
      await db.from('tasks').update({
        due_date: snoozedUntil.toISOString().split('T')[0],
        snoozed_until: snoozedUntil.toISOString(),
      }).eq('id', snoozeTaskId).eq('organization_id', organizationId);

      // Create a notification_events entry for the reminder
      const task = tasks.find(t => t.id === snoozeTaskId);
      if (task) {
        await db.from('notification_events').insert({
          organization_id: organizationId,
          type: 'task_reminder',
          timestamp: snoozedUntil.toISOString(),
          data: {
            taskId: snoozeTaskId,
            taskType: task.type,
            petName: task.petName,
            ownerName: task.ownerName,
            notes: task.doctorNotes,
            snoozedBy: currentUserName,
          },
        });
      }

      // Update local state
      setTasks(prev => prev.map(t =>
        t.id === snoozeTaskId
          ? { ...t, dueDate: snoozedUntil.toISOString().split('T')[0], snoozedUntil: snoozedUntil.toISOString() }
          : t
      ));
      setSnoozeOpen(false);
      setSnoozeTaskId(null);
    } catch {} finally {
      setSnoozeSaving(false);
    }
  };

  const handleAssign = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const { organizationId } = await getOrgContext();
    const isCurrentlyMine = task.assignedToId === currentUserId;

    // Toggle: if already mine, unassign; otherwise assign to me
    const newAssignedToId = isCurrentlyMine ? null : currentUserId;
    const newAssignedTo = isCurrentlyMine ? undefined : currentUserName;
    const newStatus: TaskStatus = isCurrentlyMine ? 'Pending' : 'In Progress';

    setTasks(prev => prev.map(t =>
      t.id === id
        ? { ...t, assignedToId: newAssignedToId || undefined, assignedTo: newAssignedTo, status: newStatus }
        : t
    ));
    await db.from('tasks').update({
      assigned_to_id: newAssignedToId,
      status: newStatus,
    }).eq('id', id).eq('organization_id', organizationId);
  };

  // ── Add Task dialog ──────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addType, setAddType] = useState<TaskType>('Follow-up Call');
  const [addPriority, setAddPriority] = useState<Priority>('Normal');
  const [addDueDate, setAddDueDate] = useState(() => getTodayStr());
  const [addDueTime, setAddDueTime] = useState('');
  const [addPetId, setAddPetId] = useState('');
  const [addClientId, setAddClientId] = useState('');
  const [addAssignedById, setAddAssignedById] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [addTags, setAddTags] = useState('');

  // Dropdown data for the form
  const [petsList, setPetsList] = useState<{ id: string; name: string; species: string; clientId: string }[]>([]);
  const [clientsList, setClientsList] = useState<{ id: string; name: string }[]>([]);
  const [staffList, setStaffList] = useState<{ id: string; name: string; profileId: string }[]>([]);

  // Load dropdown data
  useEffect(() => {
    (async () => {
      try {
        const { organizationId } = await getOrgContext();
        const [petsRes, clientsRes, staffRes] = await Promise.all([
          db.from('pets').select('id, name, species, client_id').eq('organization_id', organizationId).eq('is_active', true).order('name'),
          db.from('clients').select('id, first_name, last_name').eq('organization_id', organizationId).order('last_name'),
          db.from('staff').select('id, role, profile_id, profiles:profiles!staff_profile_id_fkey(first_name, last_name)').eq('organization_id', organizationId).in('role', ['veterinarian', 'senior_veterinarian', 'specialist']).eq('status', 'Active'),
        ]);
        if (petsRes.data) setPetsList(petsRes.data.map((p: any) => ({ id: p.id, name: p.name, species: p.species || '', clientId: p.client_id })));
        if (clientsRes.data) setClientsList(clientsRes.data.map((c: any) => ({ id: c.id, name: `${c.first_name} ${c.last_name}`.trim() })));
        if (staffRes.data) setStaffList(staffRes.data.map((s: any) => ({ id: s.id, name: `Dr. ${s.profiles?.first_name || ''} ${s.profiles?.last_name || ''}`.trim(), profileId: s.profile_id })));
      } catch {}
    })();
  }, []);

  // Auto-fill client when pet is selected
  useEffect(() => {
    if (addPetId) {
      const pet = petsList.find(p => p.id === addPetId);
      if (pet?.clientId) setAddClientId(pet.clientId);
    }
  }, [addPetId, petsList]);

  const resetAddForm = () => {
    setAddType('Follow-up Call');
    setAddPriority('Normal');
    setAddDueDate(getTodayStr());
    setAddDueTime('');
    setAddPetId('');
    setAddClientId('');
    setAddAssignedById('');
    setAddNotes('');
    setAddTags('');
  };

  const handleAddTask = async () => {
    if (!addPetId || !addAssignedById || !addDueDate) return;
    setAddSaving(true);
    try {
      const { organizationId } = await getOrgContext();
      let assignedByStaffId: string | null = null;
      if (addAssignedById === 'self') {
        const { data: { user } } = await supabase.auth.getUser();
        assignedByStaffId = user?.id || null; // user.id = staff.id
      } else {
        assignedByStaffId = addAssignedById; // already a staff.id from staffList
      }
      const { data, error } = await db.from('tasks').insert({
        organization_id: organizationId,
        type: addType,
        priority: addPriority,
        status: 'Pending' as const,
        due_date: addDueDate,
        due_time: addDueTime || null,
        pet_id: addPetId,
        client_id: addClientId || null,
        assigned_by_id: assignedByStaffId,
        visit_date: getTodayStr(),
        doctor_notes: addNotes || null,
        tags: addTags ? addTags.split(',').map(t => t.trim()).filter(Boolean) : null,
      }).select(TASKS_SELECT).single();
      if (data && !error) {
        setTasks(prev => [mapRow(data), ...prev]);
      }
      setAddOpen(false);
      resetAddForm();
    } catch {} finally {
      setAddSaving(false);
    }
  };

  // Load tasks from Supabase with joins
  const loadTasks = useCallback(async () => {
    try {
      const { organizationId } = await getOrgContext();
      const { data } = await db
        .from('tasks')
        .select(TASKS_SELECT)
        .eq('organization_id', organizationId)
        .order('due_date', { ascending: true });
      if (data) setTasks(data.map(mapRow));
    } catch {}
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const handleStatusChange = async (id: string, status: TaskStatus) => {
    const isCompleting = status === 'Completed';
    const isStarting = status === 'In Progress';
    const completedAt = isCompleting ? new Date().toISOString() : null;
    const completedById = isCompleting ? user?.id || null : null;
    const completedByName = isCompleting ? currentUserName : undefined;

    // When starting a task, auto-assign to the current user if unassigned
    const task = tasks.find(t => t.id === id);
    const shouldAutoAssign = isStarting && task && !task.assignedToId;

    // Update locally immediately
    setTasks(prev => prev.map(t =>
      t.id === id
        ? {
            ...t,
            status,
            completedAt: completedAt ?? undefined,
            completedBy: completedByName,
            completedById: completedById ?? undefined,
            ...(shouldAutoAssign ? { assignedToId: currentUserId, assignedTo: currentUserName } : {}),
          }
        : t
    ));
    // Persist to Supabase
    const { organizationId } = await getOrgContext();
    const updatePayload: Record<string, unknown> = {
      status,
      completed_at: completedAt,
      completed_by_id: completedById,
    };
    if (shouldAutoAssign) {
      updatePayload.assigned_to_id = currentUserId;
    }
    await db.from('tasks').update(updatePayload).eq('id', id).eq('organization_id', organizationId);
  };

  const handleDelete = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    const { organizationId } = await getOrgContext();
    await db.from('tasks').delete().eq('id', id).eq('organization_id', organizationId);
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
          onClick={() => setAddOpen(true)}
          style={{ backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)', fontWeight: 600, fontSize: '14px', borderRadius: '10px', padding: '10px 20px' }}
        >
          <Plus style={{ width: 16, height: 16, marginRight: 6 }} />
          Add Task
        </Button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
        <StatCard title="Total Tasks"     value={total}     icon={CheckSquare}    iconColor="var(--brand-green-text)" />
        <StatCard title="Urgent"          value={urgent}    icon={AlertTriangle}  iconColor="#d4183d"
          trend={urgent > 0 ? { value: `${urgent} need immediate action`, isPositive: false } : undefined} />
        <StatCard title="Due Today"       value={dueToday}  icon={Clock}          iconColor="#F4A261" />
        <StatCard title="Completed"       value={completed} icon={CheckCircle2}   iconColor="#3B82F6"
          trend={total > 0 ? { value: `${Math.round(completed / total * 100)}% completion rate`, isPositive: true } : undefined} />
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
                    style={{ padding: '8px 14px', fontSize: '13px', color: priority === p ? 'var(--brand-green-text)' : 'var(--text-primary)', fontWeight: priority === p ? 700 : 400 }}>
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
                    style={{ padding: '8px 14px', fontSize: '13px', color: type === tt ? 'var(--brand-green-text)' : 'var(--text-primary)', fontWeight: type === tt ? 700 : 400 }}>
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
                backgroundColor: isActive ? 'var(--brand-green-text)' : 'transparent',
                color: isActive ? 'var(--on-brand-green)' : 'var(--text-secondary)',
              }}
            >
              {tab.label}
              <span style={{
                fontSize: 11, fontWeight: 700,
                padding: '1px 7px', borderRadius: 999,
                backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'var(--surface-elevated)',
                color: isActive ? 'var(--on-brand-green)' : 'var(--text-secondary)',
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
          <TaskCard
            key={task.id}
            task={task}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            onSnooze={openSnooze}
            onAssign={handleAssign}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
          />
        ))}
      </div>

      {sorted.length > 0 && (
        <p className="text-[var(--text-secondary)]" style={{ fontSize: '13px', marginTop: '16px', textAlign: 'center' }}>
          Showing {sorted.length} of {tasks.length} tasks
        </p>
      )}

      {/* ── Add Task Dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent style={{ maxWidth: '540px' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus style={{ width: 18, height: 18, color: 'var(--brand-green-text)' }} />
              Add New Task
            </DialogTitle>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '8px' }}>
            {/* Row 1: Type + Priority */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Task Type</label>
                <Select value={addType} onValueChange={(v) => setAddType(v as TaskType)}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_CONFIG) as TaskType[]).map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Priority</label>
                <Select value={addPriority} onValueChange={(v) => setAddPriority(v as Priority)}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['Urgent', 'High', 'Normal', 'Low'] as Priority[]).map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Pet + Client (auto-filled) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pet *</label>
                <Select value={addPetId} onValueChange={setAddPetId}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select pet" /></SelectTrigger>
                  <SelectContent>
                    {petsList.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.species})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Owner</label>
                <Select value={addClientId} onValueChange={setAddClientId}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Auto-filled from pet" /></SelectTrigger>
                  <SelectContent>
                    {clientsList.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 3: Assigned By (Doctor) */}
            <div>
              <label className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Assigned By (Doctor) *</label>
              <Select value={addAssignedById} onValueChange={setAddAssignedById}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Select doctor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">By Myself</SelectItem>
                  {staffList.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Row 4: Due Date + Due Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Due Date *</label>
                <Input type="date" value={addDueDate} onChange={e => setAddDueDate(e.target.value)} className="h-10" />
              </div>
              <div>
                <label className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Due Time</label>
                <Input type="time" value={addDueTime} onChange={e => setAddDueTime(e.target.value)} className="h-10" />
              </div>
            </div>

            {/* Row 5: Doctor Notes */}
            <div>
              <label className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Doctor Notes</label>
              <Textarea
                placeholder="Instructions or notes for this task…"
                value={addNotes}
                onChange={e => setAddNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Row 6: Tags */}
            <div>
              <label className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tags</label>
              <Input
                placeholder="Comma-separated, e.g. urgent, follow-up, lab"
                value={addTags}
                onChange={e => setAddTags(e.target.value)}
                className="h-10"
              />
            </div>
          </div>

          <DialogFooter style={{ marginTop: '8px' }}>
            <Button variant="outline" onClick={() => { setAddOpen(false); resetAddForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleAddTask}
              disabled={addSaving || !addPetId || !addAssignedById || !addDueDate}
              style={{ backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)' }}
            >
              {addSaving ? 'Saving…' : 'Create Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Snooze Dialog ── */}
      <Dialog open={snoozeOpen} onOpenChange={setSnoozeOpen}>
        <DialogContent style={{ maxWidth: '420px' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlarmClock style={{ width: 18, height: 18, color: '#8B5CF6' }} />
              Snooze Task
            </DialogTitle>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '8px' }}>
            {/* Quick presets */}
            <div>
              <label className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Quick Options
              </label>
              <div className="flex flex-wrap gap-2">
                {SNOOZE_PRESETS.map(preset => {
                  const target = new Date(Date.now() + preset.hours * 3600000);
                  if (preset.setTime) {
                    const [h, m] = preset.setTime.split(':').map(Number);
                    target.setHours(h, m, 0, 0);
                    if (target <= new Date()) target.setDate(target.getDate() + 1);
                  }
                  return (
                    <button
                      key={preset.label}
                      onClick={() => handleSnooze(target)}
                      disabled={snoozeSaving}
                      className="transition-colors hover:opacity-80"
                      style={{
                        fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 8,
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--surface-elevated)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                      }}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom date/time */}
            <div>
              <label className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Or pick a date & time
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Input type="date" value={snoozeDate} onChange={e => setSnoozeDate(e.target.value)} className="h-10" />
                <Input type="time" value={snoozeTime} onChange={e => setSnoozeTime(e.target.value)} className="h-10" />
              </div>
            </div>

            <p className="text-[var(--text-secondary)]" style={{ fontSize: '12px', lineHeight: 1.5 }}>
              The task due date will be updated and a reminder notification will appear when the snooze time arrives.
            </p>
          </div>

          <DialogFooter style={{ marginTop: '8px' }}>
            <Button variant="outline" onClick={() => setSnoozeOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => handleSnooze()}
              disabled={snoozeSaving || !snoozeDate}
              style={{ backgroundColor: '#8B5CF6', color: '#fff' }}
            >
              {snoozeSaving ? 'Saving…' : 'Snooze Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
