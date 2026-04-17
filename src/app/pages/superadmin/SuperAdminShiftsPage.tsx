import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Clock, Users, RefreshCw,
  AlertTriangle, Trash2, Check, X, Loader2, CalendarDays, BarChart3,
} from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../../components/ui/select';
import { StatCard } from '../../components/StatCard';
import { useTenantDb } from '../../context/TenantContext';
import { getOrgContext } from '../../hooks/useOrgContext';
import { useAuth } from '../../context/AuthContext';

// ─── Types ────────────────────────────────────────────────────
interface StaffRow {
  id: string;
  role: string;
  profiles: { first_name: string; last_name: string; avatar_url: string | null } | null;
}

interface ShiftRow {
  id: string;
  staff_id: string;
  date: string;
  start_time: string;
  end_time: string;
  label: string;
  notes: string | null;
  status: string;
  organization_id: string;
  staff?: {
    id: string;
    role: string;
    profiles: { first_name: string; last_name: string } | null;
  } | null;
}

interface SwapRequest {
  id: string;
  title: string;
  detail: string;
  meta: string;
  type: string;
  status: string;
  requester_staff_id: string | null;
  target_staff_id: string | null;
  shift_id: string | null;
  avatar: string | null;
  avatar_color: string | null;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const ROLE_DISPLAY: Record<string, string> = {
  veterinarian: 'Vet',
  senior_veterinarian: 'Sr. Vet',
  specialist: 'Specialist',
  vet_technician: 'Vet Tech',
  lead_vet_tech: 'Lead Tech',
  receptionist: 'Receptionist',
  front_desk_manager: 'FD Manager',
  clinic_manager: 'Manager',
  groomer: 'Groomer',
  lab_technician: 'Lab Tech',
  superadmin: 'Super Admin',
};

const ROLE_COLORS: Record<string, { color: string; bg: string }> = {
  veterinarian:        { color: 'var(--brand-green-text)', bg: 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)' },
  senior_veterinarian: { color: '#16A34A', bg: '#22C55E15' },
  specialist:          { color: '#374151', bg: '#6B728015' },
  vet_technician:      { color: '#2563EB', bg: '#3B82F615' },
  lead_vet_tech:       { color: '#1D4ED8', bg: '#3B82F620' },
  receptionist:        { color: '#7C3AED', bg: '#8B5CF615' },
  front_desk_manager:  { color: '#6D28D9', bg: '#8B5CF620' },
  clinic_manager:      { color: '#C2671A', bg: '#F4A26112' },
  groomer:             { color: '#BE185D', bg: '#EC489915' },
  lab_technician:      { color: '#0E7490', bg: '#06B6D415' },
  superadmin:          { color: '#F4A261', bg: '#F4A26115' },
};

const SHIFT_LABEL_COLORS: Record<string, string> = {
  'Full Day':  'var(--brand-green-text)',
  'Morning':   '#3B82F6',
  'Afternoon': '#F4A261',
  'Evening':   '#8B5CF6',
  'Custom':    '#06B6D4',
};

/** Produce a semi-transparent version of a colour. Works with both hex and CSS vars. */
function withAlpha(color: string, hexAlpha: string): string {
  if (color.startsWith('var(')) {
    const pct = Math.round((parseInt(hexAlpha, 16) / 255) * 100);
    return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
  }
  return color + hexAlpha;
}

// Brighter text versions for readability on dark backgrounds
const SHIFT_LABEL_TEXT: Record<string, string> = {
  'Full Day':  '#52B788',
  'Morning':   '#60A5FA',
  'Afternoon': '#FBBF6E',
  'Evening':   '#A78BFA',
  'Custom':    '#22D3EE',
};

const AVATAR_COLORS = ['#2D6A4F', '#3B82F6', '#8B5CF6', '#EC4899', '#F4A261', '#06B6D4', '#6366F1', '#DC2626', '#0EA5E9', '#14B8A6'];

// ─── Time Helpers ─────────────────────────────────────────────
function fmtShort(t: string): string {
  let [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'P' : 'A';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return m === 0 ? `${h}${ap}` : `${h}:${m.toString().padStart(2, '0')}${ap}`;
}

function shiftHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function fmtDateISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

function fmtWeekLabel(monday: Date): string {
  return monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function initials(first: string, last: string): string {
  return `${(first?.[0] || '').toUpperCase()}${(last?.[0] || '').toUpperCase()}`;
}

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── Component ────────────────────────────────────────────────
export default function SuperAdminShiftsPage() {
  const db = useTenantDb();
  const { user: authUser, loading: authLoading } = useAuth();
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'schedule' | 'stats'>('schedule');

  // Stats tab state
  const [statsMonth, setStatsMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [monthlyShifts, setMonthlyShifts] = useState<ShiftRow[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  // Dialog state
  const [assignOpen, setAssignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftRow | null>(null);

  // Form fields
  const [formStaffId, setFormStaffId] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formDates, setFormDates] = useState<string[]>([]);
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('17:00');
  const [formLabel, setFormLabel] = useState('Full Day');
  const [formNotes, setFormNotes] = useState('');
  const [formDateMode, setFormDateMode] = useState<'week' | 'month' | 'range'>('week');
  const [formRangeStart, setFormRangeStart] = useState('');
  const [formRangeEnd, setFormRangeEnd] = useState('');
  const [formSkipWeekends, setFormSkipWeekends] = useState(true);

  const weekDates = getWeekDates(weekStart);
  const weekEndDate = weekDates[6];
  // Stable memoized strings for dependency arrays
  const weekStartStr = useMemo(() => fmtDateISO(weekStart), [weekStart]);
  const weekEndStr = useMemo(() => fmtDateISO(weekEndDate), [weekEndDate]);

  // ─── Data Loading ─────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { organizationId } = await getOrgContext();

      const [staffRes, shiftsRes, swapRes] = await Promise.all([
        db
          .from('staff')
          .select('id, role, status, profiles:profiles!staff_profile_id_fkey(first_name, last_name, avatar_url)')
          .eq('organization_id', organizationId)
          .eq('status', 'Active')
          .order('role'),
        db
          .from('shifts')
          .select('*, staff:staff!shifts_staff_id_fkey(id, role, profiles:profiles!staff_profile_id_fkey(first_name, last_name))')
          .eq('organization_id', organizationId)
          .gte('date', weekStartStr)
          .lte('date', weekEndStr)
          .order('date'),
        db
          .from('pending_requests')
          .select('*')
          .eq('organization_id', organizationId)
          .in('type', ['shift_swap', 'overtime'])
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
      ]);

      if (staffRes.data) setStaff(staffRes.data as any);
      if (shiftsRes.data) setShifts(shiftsRes.data as any);
      if (swapRes.data) setSwapRequests(swapRes.data as any);
    } catch (err) {
      console.error('Failed to load shift data:', err);
    } finally {
      setLoading(false);
    }
  }, [weekStartStr, weekEndStr]);

  useEffect(() => {
    if (!authLoading && authUser) loadData();
  }, [authLoading, authUser, loadData]);

  // ─── Monthly Overtime (for stat card) ─────────────────────
  const [monthlyOvertimeHours, setMonthlyOvertimeHours] = useState(0);

  useEffect(() => {
    if (!authUser || authLoading) return;
    (async () => {
      const { organizationId } = await getOrgContext();
      const now = new Date();
      const monthStart = fmtDateISO(new Date(now.getFullYear(), now.getMonth(), 1));
      const monthEnd = fmtDateISO(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      const { data } = await db
        .from('shifts')
        .select('start_time, end_time')
        .eq('organization_id', organizationId)
        .eq('type', 'overtime')
        .gte('date', monthStart)
        .lte('date', monthEnd);
      if (data) {
        const total = data.reduce((sum: number, s: any) => sum + shiftHours(s.start_time, s.end_time), 0);
        setMonthlyOvertimeHours(total);
      }
    })();
  }, [authUser, authLoading]);

  // ─── Stats Tab Data Loading ───────────────────────────────
  const statsMonthStr = useMemo(() => fmtDateISO(statsMonth), [statsMonth]);
  const statsMonthEnd = useMemo(() => fmtDateISO(new Date(statsMonth.getFullYear(), statsMonth.getMonth() + 1, 0)), [statsMonth]);

  useEffect(() => {
    if (activeTab !== 'stats' || !authUser || authLoading) return;
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      try {
        const { organizationId } = await getOrgContext();
        const { data } = await db
          .from('shifts')
          .select('*, staff:staff!shifts_staff_id_fkey(id, role, profiles:profiles!staff_profile_id_fkey(first_name, last_name))')
          .eq('organization_id', organizationId)
          .gte('date', statsMonthStr)
          .lte('date', statsMonthEnd)
          .order('date');
        if (!cancelled && data) setMonthlyShifts(data as any);
      } catch (err) {
        console.error('Failed to load monthly stats:', err);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, statsMonthStr, statsMonthEnd, authUser, authLoading]);

  function prevMonth() {
    setStatsMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }
  function nextMonth() {
    setStatsMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  // ─── Stats ────────────────────────────────────────────────
  const todayStr = fmtDateISO(new Date());
  const staffOnShiftToday = shifts.filter(s => s.date === todayStr).length;
  const totalHoursThisWeek = shifts.reduce((sum, s) => sum + shiftHours(s.start_time, s.end_time), 0);
  const swapRequestCount = swapRequests.length;

  // Coverage gaps: days in the week with zero shifts assigned
  const daysWithShifts = new Set(shifts.map(s => s.date));
  const coverageGaps = weekDates.filter(d => !daysWithShifts.has(fmtDateISO(d))).length;

  // ─── Shift lookup map ─────────────────────────────────────
  const shiftMap = new Map<string, ShiftRow>();
  shifts.forEach(s => {
    shiftMap.set(`${s.staff_id}_${s.date}`, s);
  });

  // ─── Form Helpers ─────────────────────────────────────────
  function resetForm() {
    setFormStaffId('');
    setFormDate('');
    setFormDates([]);
    setFormStartTime('08:00');
    setFormEndTime('17:00');
    setFormLabel('Full Day');
    setFormNotes('');
    setFormDateMode('week');
    setFormRangeStart('');
    setFormRangeEnd('');
    setFormSkipWeekends(true);
  }

  /** Generate date strings for a date range, optionally skipping weekends. */
  function getDatesInRange(start: Date, end: Date, skipWeekends: boolean): string[] {
    const dates: string[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      const day = cur.getDay();
      if (!skipWeekends || (day !== 0 && day !== 6)) {
        dates.push(fmtDateISO(cur));
      }
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }

  /** Apply a quick-select preset. */
  function applyDatePreset(mode: 'week' | 'month' | 'range') {
    setFormDateMode(mode);
    if (mode === 'week') {
      // Select current view week's weekdays
      const dates = weekDates
        .filter(d => formSkipWeekends ? (d.getDay() !== 0 && d.getDay() !== 6) : true)
        .map(d => fmtDateISO(d));
      setFormDates(dates);
    } else if (mode === 'month') {
      // Select entire month from today
      const now = new Date();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setFormDates(getDatesInRange(now, monthEnd, formSkipWeekends));
    } else {
      // Range mode — dates will be computed when range inputs change
      if (formRangeStart && formRangeEnd) {
        setFormDates(getDatesInRange(new Date(formRangeStart + 'T00:00'), new Date(formRangeEnd + 'T00:00'), formSkipWeekends));
      }
    }
  }

  /** Recompute dates when range inputs or skip-weekends toggle change. */
  function updateRangeDates(start: string, end: string, skip: boolean) {
    setFormRangeStart(start);
    setFormRangeEnd(end);
    if (start && end) {
      setFormDates(getDatesInRange(new Date(start + 'T00:00'), new Date(end + 'T00:00'), skip));
    }
  }

  function toggleFormDate(dateStr: string) {
    setFormDates(prev =>
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
    );
  }

  function openAssignDialog(staffId?: string, date?: string) {
    resetForm();
    if (staffId) setFormStaffId(staffId);
    if (date) setFormDates([date]);
    setAssignOpen(true);
  }

  function openEditDialog(shift: ShiftRow) {
    setEditingShift(shift);
    setFormStaffId(shift.staff_id);
    setFormDate(shift.date);
    setFormStartTime(shift.start_time);
    setFormEndTime(shift.end_time);
    setFormLabel(shift.label || 'Full Day');
    setFormNotes(shift.notes || '');
    setEditOpen(true);
  }

  // ─── CRUD ─────────────────────────────────────────────────
  async function handleAssign() {
    if (!formStaffId || formDates.length === 0 || !formStartTime || !formEndTime) return;
    setSaving(true);
    try {
      const { organizationId } = await getOrgContext();
      const rows = formDates.map(d => ({
        staff_id: formStaffId,
        organization_id: organizationId,
        date: d,
        start_time: formStartTime,
        end_time: formEndTime,
        label: formLabel,
        notes: formNotes || null,
        status: 'Active',
      }));
      await db.from('shifts').insert(rows);
      setAssignOpen(false);
      resetForm();
      await loadData();
    } catch (err) {
      console.error('Failed to assign shift:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSave() {
    if (!editingShift) return;
    setSaving(true);
    try {
      await db.from('shifts').update({
        staff_id: formStaffId,
        date: formDate,
        start_time: formStartTime,
        end_time: formEndTime,
        label: formLabel,
        notes: formNotes || null,
      }).eq('id', editingShift.id);
      setEditOpen(false);
      setEditingShift(null);
      resetForm();
      await loadData();
    } catch (err) {
      console.error('Failed to update shift:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingShift) return;
    setSaving(true);
    try {
      await db.from('shifts').delete().eq('id', editingShift.id);
      setEditOpen(false);
      setDeleteConfirm(false);
      setEditingShift(null);
      resetForm();
      await loadData();
    } catch (err) {
      console.error('Failed to delete shift:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleSwapApprove(req: SwapRequest) {
    try {
      await db.from('pending_requests')
        .update({ status: 'approved', resolved_at: new Date().toISOString() })
        .eq('id', req.id);

      // Swap actual shifts if both staff IDs and shift_id are present
      if (req.shift_id && req.requester_staff_id && req.target_staff_id) {
        const { data: originalShift } = await db
          .from('shifts')
          .select('*')
          .eq('id', req.shift_id)
          .single();

        if (originalShift) {
          const { organizationId } = await getOrgContext();
          const { data: targetShift } = await db
            .from('shifts')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('staff_id', req.target_staff_id)
            .eq('date', originalShift.date)
            .limit(1)
            .maybeSingle();

          // Swap staff_id on both shifts
          await db.from('shifts').update({ staff_id: req.target_staff_id }).eq('id', originalShift.id);
          if (targetShift) {
            await db.from('shifts').update({ staff_id: req.requester_staff_id }).eq('id', targetShift.id);
          }
        }
      }

      // Notify the requester
      if (req.requester_staff_id) {
        const { organizationId } = await getOrgContext();
        await db.from('notification_events').upsert({
          id: `req-approved-${req.id}`,
          type: 'request_resolved',
          timestamp: new Date().toISOString(),
          data: { decision: 'approved', requestType: req.type, title: req.title, detail: req.detail, vetId: req.requester_staff_id },
          organization_id: organizationId,
        });
      }

      await loadData();
    } catch (err) {
      console.error('Failed to approve swap:', err);
    }
  }

  async function handleSwapDecline(req: SwapRequest) {
    try {
      await db.from('pending_requests')
        .update({ status: 'declined', resolved_at: new Date().toISOString() })
        .eq('id', req.id);

      // Reset shift status back to Active if we have the shift_id
      if (req.shift_id) {
        await db.from('shifts').update({ status: 'Active' }).eq('id', req.shift_id);
      }

      // Notify the requester
      if (req.requester_staff_id) {
        const { organizationId } = await getOrgContext();
        await db.from('notification_events').upsert({
          id: `req-declined-${req.id}`,
          type: 'request_resolved',
          timestamp: new Date().toISOString(),
          data: { decision: 'declined', requestType: req.type, title: req.title, detail: req.detail, vetId: req.requester_staff_id },
          organization_id: organizationId,
        });
      }

      await loadData();
    } catch (err) {
      console.error('Failed to decline swap:', err);
    }
  }

  // ─── Week navigation ──────────────────────────────────────
  function prevWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  }
  function nextWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  }

  // ─── Staff name helper ────────────────────────────────────
  function staffName(s: StaffRow): string {
    const p = s.profiles as any;
    if (p) return `${p.first_name || ''} ${p.last_name || ''}`.trim();
    return 'Unknown';
  }

  function staffInitials(s: StaffRow): string {
    const p = s.profiles as any;
    if (p) return initials(p.first_name || '', p.last_name || '');
    return '??';
  }

  // ─── Render ───────────────────────────────────────────────
  return (
    <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Shift Management
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
            Assign and manage staff schedules
          </p>
        </div>
        <Button
          onClick={() => openAssignDialog()}
          style={{
            backgroundColor: 'var(--brand-green-text)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 13,
            padding: '10px 20px',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <Plus style={{ width: 15, height: 15 }} />
          Assign Shift
        </Button>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <StatCard
          title="Staff On Shift Today"
          value={loading ? '...' : staffOnShiftToday}
          icon={Users}
          iconColor="var(--brand-green-text)"
        />
        <StatCard
          title="Total Hours This Week"
          value={loading ? '...' : `${totalHoursThisWeek.toFixed(1)}h`}
          icon={Clock}
          iconColor="#3B82F6"
        />
        <StatCard
          title="Swap Requests"
          value={loading ? '...' : swapRequestCount}
          icon={RefreshCw}
          iconColor="#F4A261"
        />
        <StatCard
          title="Overtime This Month"
          value={loading ? '...' : `${monthlyOvertimeHours.toFixed(1)}h`}
          icon={Clock}
          iconColor={monthlyOvertimeHours > 0 ? '#F4A261' : '#6B7280'}
        />
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 28,
        borderBottom: '2px solid var(--border-color)',
      }}>
        {([
          { key: 'schedule', label: 'Schedule', icon: CalendarDays },
          { key: 'stats', label: 'Hours & Overtime', icon: BarChart3 },
        ] as { key: 'schedule' | 'stats'; label: string; icon: typeof CalendarDays }[]).map(tab => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 20px',
                fontSize: 14, fontWeight: active ? 700 : 500,
                color: active ? 'var(--brand-green-text)' : 'var(--text-secondary)',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${active ? 'var(--brand-green-text)' : 'transparent'}`,
                marginBottom: -2,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <tab.icon style={{ width: 16, height: 16 }} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── Schedule Tab ─────────────────────────────────────── */}
      {activeTab === 'schedule' && (
      <div>

      {/* Week View */}
      <div style={{
        backgroundColor: 'var(--surface-white)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 28,
      }}>
        {/* Week Navigator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CalendarDays style={{ width: 18, height: 18, color: 'var(--brand-green-text)' }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              Staff Schedule
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={prevWeek}
              style={{
                width: 32, height: 32, borderRadius: 8,
                border: '1px solid var(--border-color)',
                backgroundColor: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-secondary)',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--surface-elevated)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <ChevronLeft style={{ width: 16, height: 16 }} />
            </button>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', minWidth: 140, textAlign: 'center' }}>
              Week of {fmtWeekLabel(weekStart)}
            </span>
            <button
              onClick={nextWeek}
              style={{
                width: 32, height: 32, borderRadius: 8,
                border: '1px solid var(--border-color)',
                backgroundColor: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-secondary)',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--surface-elevated)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <ChevronRight style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>

        {/* Schedule Table */}
        {loading ? (
          <div style={{ padding: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Loader2 style={{ width: 20, height: 20, color: 'var(--text-secondary)', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Loading schedule...</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{
                    textAlign: 'left', padding: '12px 20px', fontSize: 12, fontWeight: 600,
                    color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px',
                    borderBottom: '1px solid var(--border-color)',
                    position: 'sticky', left: 0, backgroundColor: 'var(--surface-white)', zIndex: 2,
                    minWidth: 150, width: '16%',
                  }}>
                    Staff Member
                  </th>
                  {weekDates.map((d, i) => {
                    const isToday = fmtDateISO(d) === todayStr;
                    return (
                      <th key={i} style={{
                        textAlign: 'center', padding: '12px 8px', fontSize: 12, fontWeight: 600,
                        color: isToday ? 'var(--brand-green-text)' : 'var(--text-secondary)',
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                        borderBottom: '1px solid var(--border-color)',
                        minWidth: 70,
                        backgroundColor: isToday ? 'var(--brand-green-text)08' : 'transparent',
                      }}>
                        <div>{DAY_LABELS[i]}</div>
                        <div style={{ fontSize: 11, fontWeight: 400, marginTop: 2 }}>
                          {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {staff.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 40, textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)' }}>
                      No active staff found
                    </td>
                  </tr>
                ) : (
                  staff.map((s) => {
                    const name = staffName(s);
                    const ini = staffInitials(s);
                    const color = avatarColor(s.id);
                    const roleCfg = ROLE_COLORS[s.role] || { color: '#6B7280', bg: '#6B728015' };
                    const roleLabel = ROLE_DISPLAY[s.role] || s.role;

                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        {/* Staff Name Cell */}
                        <td style={{
                          padding: '10px 20px',
                          position: 'sticky', left: 0,
                          backgroundColor: 'var(--surface-white)', zIndex: 1,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                              background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#fff', fontSize: 12, fontWeight: 700,
                            }}>
                              {ini}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                {name}
                              </div>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center',
                                fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 6,
                                color: roleCfg.color, backgroundColor: roleCfg.bg,
                                marginTop: 2,
                              }}>
                                {roleLabel}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Day Cells */}
                        {weekDates.map((d, di) => {
                          const dateStr = fmtDateISO(d);
                          const shift = shiftMap.get(`${s.id}_${dateStr}`);
                          const isToday = dateStr === todayStr;

                          return (
                            <td
                              key={di}
                              style={{
                                padding: '8px 6px',
                                textAlign: 'center',
                                cursor: 'pointer',
                                backgroundColor: isToday ? 'var(--brand-green-text)05' : 'transparent',
                                transition: 'background-color 0.15s',
                              }}
                              onClick={() => {
                                if (shift) {
                                  openEditDialog(shift);
                                } else {
                                  openAssignDialog(s.id, dateStr);
                                }
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.backgroundColor = isToday
                                  ? 'var(--brand-green-text)10'
                                  : 'var(--surface-elevated)';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.backgroundColor = isToday
                                  ? 'var(--brand-green-text)05'
                                  : 'transparent';
                              }}
                            >
                              {shift ? (
                                <div style={{
                                  display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                                  padding: '4px 8px', borderRadius: 8,
                                  backgroundColor: withAlpha(SHIFT_LABEL_COLORS[shift.label] || 'var(--brand-green-text)', '15'),
                                  border: `1px solid ${withAlpha(SHIFT_LABEL_COLORS[shift.label] || 'var(--brand-green-text)', '25')}`,
                                  minWidth: 60,
                                }}>
                                  <span style={{
                                    fontSize: 12, fontWeight: 700,
                                    color: SHIFT_LABEL_TEXT[shift.label] || '#52B788',
                                  }}>
                                    {fmtShort(shift.start_time)}&ndash;{fmtShort(shift.end_time)}
                                  </span>
                                  <span style={{
                                    fontSize: 10, fontWeight: 500,
                                    color: 'var(--text-secondary)', marginTop: 1,
                                  }}>
                                    {shift.label}
                                  </span>
                                </div>
                              ) : (
                                <span style={{
                                  fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
                                  opacity: 0.5, letterSpacing: '0.5px',
                                }}>
                                  OFF
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {!loading && staff.length > 0 && (
          <div style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--border-color)',
            fontSize: 13, color: 'var(--text-secondary)',
          }}>
            Showing {staff.length} staff member{staff.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Pending Swap & Overtime Requests */}
      <div style={{
        backgroundColor: 'var(--surface-white)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <RefreshCw style={{ width: 16, height: 16, color: '#F4A261' }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            Pending Swap & Overtime Requests
          </span>
          {swapRequests.length > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
              backgroundColor: '#F4A26118', color: '#C2671A',
            }}>
              {swapRequests.length}
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ padding: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Loader2 style={{ width: 18, height: 18, color: 'var(--text-secondary)', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Loading requests...</span>
          </div>
        ) : swapRequests.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <RefreshCw style={{ width: 32, height: 32, color: 'var(--text-secondary)', opacity: 0.3, margin: '0 auto 10px' }} />
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>No pending requests</p>
          </div>
        ) : (
          <div>
            {swapRequests.map((req) => (
              <div
                key={req.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 24px',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  backgroundColor: (req.avatar_color || '#6B7280') + '20',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: req.avatar_color || '#6B7280',
                  fontSize: 13, fontWeight: 700,
                }}>
                  {req.avatar || '?'}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {req.title}
                  </div>
                  {req.detail && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {req.detail}
                    </div>
                  )}
                  {req.meta && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, opacity: 0.7 }}>
                      {req.meta}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => handleSwapApprove(req)}
                    style={{
                      padding: '6px 14px', borderRadius: 8,
                      border: '1px solid #22C55E',
                      backgroundColor: '#22C55E15',
                      color: '#16A34A', fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#22C55E25'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#22C55E15'; }}
                  >
                    <Check style={{ width: 13, height: 13 }} />
                    Approve
                  </button>
                  <button
                    onClick={() => handleSwapDecline(req)}
                    style={{
                      padding: '6px 14px', borderRadius: 8,
                      border: '1px solid #EF4444',
                      backgroundColor: '#EF444415',
                      color: '#DC2626', fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#EF444425'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#EF444415'; }}
                  >
                    <X style={{ width: 13, height: 13 }} />
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      </div>)}

      {/* ─── Stats Tab ────────────────────────────────────────── */}
      {activeTab === 'stats' && (() => {
        const STANDARD_HOURS = 40; // weekly standard
        // Calculate total working days in the month (Mon-Fri)
        const daysInMonth = new Date(statsMonth.getFullYear(), statsMonth.getMonth() + 1, 0).getDate();
        let workingDays = 0;
        for (let d = 1; d <= daysInMonth; d++) {
          const day = new Date(statsMonth.getFullYear(), statsMonth.getMonth(), d).getDay();
          if (day !== 0 && day !== 6) workingDays++;
        }
        const monthlyTarget = (STANDARD_HOURS / 5) * workingDays; // expected hours

        // Build per-staff stats
        const staffStats = staff.map(s => {
          const name = staffName(s);
          const ini = staffInitials(s);
          const color = avatarColor(s.id);
          const role = ROLE_DISPLAY[s.role] || s.role;
          const staffShifts = monthlyShifts.filter(sh => sh.staff_id === s.id);
          const regularShifts = staffShifts.filter(sh => (sh as any).type !== 'overtime');
          const overtimeShifts = staffShifts.filter(sh => (sh as any).type === 'overtime');
          const regularHours = regularShifts.reduce((sum, sh) => sum + shiftHours(sh.start_time, sh.end_time), 0);
          const overtimeHours = overtimeShifts.reduce((sum, sh) => sum + shiftHours(sh.start_time, sh.end_time), 0);
          const totalHours = regularHours + overtimeHours;
          const daysWorked = new Set(staffShifts.map(sh => sh.date)).size;
          return { id: s.id, name, ini, color, role, regularHours, overtimeHours, totalHours, daysWorked, shiftCount: staffShifts.length };
        }).sort((a, b) => b.totalHours - a.totalHours);

        const maxHours = Math.max(monthlyTarget, ...staffStats.map(s => s.totalHours));
        const totalOvertimeAll = staffStats.reduce((sum, s) => sum + s.overtimeHours, 0);
        const totalRegularAll = staffStats.reduce((sum, s) => sum + s.regularHours, 0);

        const monthLabel = statsMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Month Navigator */}
            <div style={{
              backgroundColor: 'var(--surface-white)',
              border: '1px solid var(--border-color)',
              borderRadius: 12,
              padding: '16px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <BarChart3 style={{ width: 18, height: 18, color: 'var(--brand-green-text)' }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Staff Hours Overview
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={prevMonth}
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'var(--text-secondary)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--surface-elevated)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <ChevronLeft style={{ width: 16, height: 16 }} />
                </button>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', minWidth: 160, textAlign: 'center' }}>
                  {monthLabel}
                </span>
                <button
                  onClick={nextMonth}
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'var(--text-secondary)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--surface-elevated)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <ChevronRight style={{ width: 16, height: 16 }} />
                </button>
              </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <div style={{
                backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)',
                borderRadius: 12, padding: '20px 24px',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Total Regular Hours
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginTop: 6 }}>
                  {statsLoading ? '...' : `${totalRegularAll.toFixed(1)}h`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Target: {monthlyTarget.toFixed(0)}h per person
                </div>
              </div>
              <div style={{
                backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)',
                borderRadius: 12, padding: '20px 24px',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Total Overtime
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: totalOvertimeAll > 0 ? '#F4A261' : 'var(--text-primary)', marginTop: 6 }}>
                  {statsLoading ? '...' : `${totalOvertimeAll.toFixed(1)}h`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Across {staffStats.filter(s => s.overtimeHours > 0).length} staff members
                </div>
              </div>
              <div style={{
                backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)',
                borderRadius: 12, padding: '20px 24px',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Avg Hours / Person
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginTop: 6 }}>
                  {statsLoading || staff.length === 0 ? '...' : `${((totalRegularAll + totalOvertimeAll) / staff.length).toFixed(1)}h`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {staff.length} active staff members
                </div>
              </div>
            </div>

            {/* Staff Hours Table with Progress Bars */}
            <div style={{
              backgroundColor: 'var(--surface-white)',
              border: '1px solid var(--border-color)',
              borderRadius: 12,
              overflow: 'hidden',
            }}>
              {/* Legend */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 24px',
                borderBottom: '1px solid var(--border-color)',
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Hours by Staff Member
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#3B82F6' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Regular</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#F4A261' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Overtime</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: 'var(--border-color)' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Target ({monthlyTarget.toFixed(0)}h)</span>
                  </div>
                </div>
              </div>

              {statsLoading ? (
                <div style={{ padding: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <Loader2 style={{ width: 20, height: 20, color: 'var(--text-secondary)', animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Loading stats...</span>
                </div>
              ) : staffStats.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center' }}>
                  <BarChart3 style={{ width: 32, height: 32, color: 'var(--text-secondary)', opacity: 0.3, margin: '0 auto 10px' }} />
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>No staff data available</p>
                </div>
              ) : (
                <div>
                  {staffStats.map((s, idx) => {
                    const regularPct = maxHours > 0 ? (s.regularHours / maxHours) * 100 : 0;
                    const overtimePct = maxHours > 0 ? (s.overtimeHours / maxHours) * 100 : 0;
                    const targetPct = maxHours > 0 ? (monthlyTarget / maxHours) * 100 : 0;
                    return (
                      <div
                        key={s.id}
                        style={{
                          padding: '16px 24px',
                          borderBottom: idx < staffStats.length - 1 ? '1px solid var(--border-color)' : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: '50%',
                              backgroundColor: s.color + '20',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: s.color, fontSize: 13, fontWeight: 700, flexShrink: 0,
                            }}>
                              {s.ini}
                            </div>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.role} · {s.daysWorked} days worked</div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                              {s.totalHours.toFixed(1)}h
                            </div>
                            {s.overtimeHours > 0 && (
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#F4A261' }}>
                                +{s.overtimeHours.toFixed(1)}h overtime
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div style={{ position: 'relative', height: 24, borderRadius: 6, backgroundColor: 'var(--surface-elevated)', overflow: 'hidden' }}>
                          {/* Regular hours bar */}
                          <div style={{
                            position: 'absolute', left: 0, top: 0, bottom: 0,
                            width: `${regularPct}%`,
                            backgroundColor: '#3B82F6',
                            borderRadius: s.overtimeHours > 0 ? '6px 0 0 6px' : 6,
                            transition: 'width 0.5s ease',
                          }} />
                          {/* Overtime bar */}
                          {s.overtimeHours > 0 && (
                            <div style={{
                              position: 'absolute', left: `${regularPct}%`, top: 0, bottom: 0,
                              width: `${overtimePct}%`,
                              backgroundColor: '#F4A261',
                              borderRadius: '0 6px 6px 0',
                              transition: 'width 0.5s ease',
                            }} />
                          )}
                          {/* Target marker line */}
                          <div style={{
                            position: 'absolute', left: `${targetPct}%`, top: -2, bottom: -2,
                            width: 2, backgroundColor: 'var(--text-secondary)', opacity: 0.4,
                            borderRadius: 1,
                          }} />
                          {/* Hours label on bar */}
                          {s.totalHours > 0 && (
                            <div style={{
                              position: 'absolute', left: 8, top: 0, bottom: 0,
                              display: 'flex', alignItems: 'center',
                              fontSize: 11, fontWeight: 700,
                              color: regularPct > 8 ? '#fff' : 'var(--text-primary)',
                            }}>
                              {s.regularHours.toFixed(0)}h{s.overtimeHours > 0 ? ` + ${s.overtimeHours.toFixed(0)}h OT` : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ─── Assign Shift Dialog ─────────────────────────────── */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent style={{ backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: 12, maxWidth: 480 }}>
          <DialogHeader>
            <DialogTitle style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              Assign Shift
            </DialogTitle>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
            {/* Staff Member */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>
                Staff Member
              </label>
              <Select value={formStaffId} onValueChange={setFormStaffId}>
                <SelectTrigger style={{ borderRadius: 8, borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-white)', color: 'var(--text-primary)', fontSize: 13 }}>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {staffName(s)} ({ROLE_DISPLAY[s.role] || s.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Schedule Range */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>
                Schedule
              </label>
              {/* Mode tabs */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                {([
                  { key: 'week' as const, label: 'This Week' },
                  { key: 'month' as const, label: 'This Month' },
                  { key: 'range' as const, label: 'Custom Range' },
                ]).map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => applyDatePreset(tab.key)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 6,
                      border: `1.5px solid ${formDateMode === tab.key ? 'var(--brand-green-text)' : 'var(--border-color)'}`,
                      backgroundColor: formDateMode === tab.key ? 'var(--brand-green-text)' : 'transparent',
                      color: formDateMode === tab.key ? 'var(--on-brand-green)' : 'var(--text-secondary)',
                      fontSize: 12,
                      fontWeight: formDateMode === tab.key ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Custom range inputs */}
              {formDateMode === 'range' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Start Date</label>
                    <Input
                      type="date"
                      value={formRangeStart}
                      onChange={e => updateRangeDates(e.target.value, formRangeEnd, formSkipWeekends)}
                      style={{ borderRadius: 8, borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-white)', color: 'var(--text-primary)', fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>End Date</label>
                    <Input
                      type="date"
                      value={formRangeEnd}
                      onChange={e => updateRangeDates(formRangeStart, e.target.value, formSkipWeekends)}
                      style={{ borderRadius: 8, borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-white)', color: 'var(--text-primary)', fontSize: 13 }}
                    />
                  </div>
                </div>
              )}

              {/* Skip weekends toggle */}
              <label
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                  fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8,
                }}
              >
                <input
                  type="checkbox"
                  checked={formSkipWeekends}
                  onChange={e => {
                    const skip = e.target.checked;
                    setFormSkipWeekends(skip);
                    // Recompute dates for current mode
                    if (formDateMode === 'week') {
                      setFormDates(weekDates
                        .filter(d => skip ? (d.getDay() !== 0 && d.getDay() !== 6) : true)
                        .map(d => fmtDateISO(d)));
                    } else if (formDateMode === 'month') {
                      const now = new Date();
                      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                      setFormDates(getDatesInRange(now, monthEnd, skip));
                    } else if (formRangeStart && formRangeEnd) {
                      updateRangeDates(formRangeStart, formRangeEnd, skip);
                    }
                  }}
                  style={{ accentColor: 'var(--brand-green-text)', width: 14, height: 14 }}
                />
                Skip weekends (Sat &amp; Sun)
              </label>

              {/* Day pills — show this week's days for week mode */}
              {formDateMode === 'week' && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {weekDates.map((d, i) => {
                    const ds = fmtDateISO(d);
                    const selected = formDates.includes(ds);
                    return (
                      <button
                        key={ds}
                        type="button"
                        onClick={() => toggleFormDate(ds)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: `2px solid ${selected ? 'var(--brand-green-text)' : 'var(--border-color)'}`,
                          backgroundColor: selected ? 'var(--brand-green-text)' : 'var(--surface-elevated)',
                          color: selected ? '#fff' : 'var(--text-primary)',
                          fontSize: 12,
                          fontWeight: selected ? 700 : 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 1,
                          minWidth: 52,
                          boxShadow: selected ? '0 2px 8px color-mix(in srgb, var(--brand-green-text) 35%, transparent)' : '0 1px 3px rgba(0,0,0,0.08)',
                        }}
                      >
                        <span>{DAY_LABELS[i]}</span>
                        <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.85 }}>
                          {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Summary */}
              {formDates.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--brand-green-text)', fontWeight: 500 }}>
                  {formDates.length} day{formDates.length !== 1 ? 's' : ''} selected
                  {formDateMode === 'month' && (() => {
                    const first = formDates[0];
                    const last = formDates[formDates.length - 1];
                    return ` (${new Date(first + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(last + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
                  })()}
                  {formDateMode === 'range' && formRangeStart && formRangeEnd && (() => {
                    return ` (${new Date(formRangeStart + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(formRangeEnd + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
                  })()}
                  {formDates.length > 1 && ' — one shift per day'}
                </div>
              )}
            </div>

            {/* Time Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>
                  Start Time
                </label>
                <Input
                  type="time"
                  value={formStartTime}
                  onChange={e => setFormStartTime(e.target.value)}
                  style={{ borderRadius: 8, borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-white)', color: 'var(--text-primary)', fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>
                  End Time
                </label>
                <Input
                  type="time"
                  value={formEndTime}
                  onChange={e => setFormEndTime(e.target.value)}
                  style={{ borderRadius: 8, borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-white)', color: 'var(--text-primary)', fontSize: 13 }}
                />
              </div>
            </div>

            {/* Label */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>
                Label
              </label>
              <Select value={formLabel} onValueChange={setFormLabel}>
                <SelectTrigger style={{ borderRadius: 8, borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-white)', color: 'var(--text-primary)', fontSize: 13 }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Full Day', 'Morning', 'Afternoon', 'Evening', 'Custom'].map(l => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>
                Notes <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(optional)</span>
              </label>
              <Textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                placeholder="Any additional notes..."
                rows={3}
                style={{ borderRadius: 8, borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-white)', color: 'var(--text-primary)', fontSize: 13, resize: 'none' }}
              />
            </div>
          </div>

          <DialogFooter style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8 }}>
            <Button
              variant="outline"
              onClick={() => { setAssignOpen(false); resetForm(); }}
              style={{ borderRadius: 8, fontSize: 13, fontWeight: 600, borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={saving || !formStaffId || formDates.length === 0}
              style={{
                borderRadius: 8, fontSize: 13, fontWeight: 700,
                backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)',
                opacity: saving || !formStaffId || formDates.length === 0 ? 0.5 : 1,
              }}
            >
              {saving ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                  Saving...
                </span>
              ) : formDates.length > 1 ? `Assign ${formDates.length} Shifts` : 'Assign Shift'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Shift Dialog ───────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) { setEditOpen(false); setEditingShift(null); setDeleteConfirm(false); resetForm(); } }}>
        <DialogContent style={{ backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: 12, maxWidth: 480 }}>
          <DialogHeader>
            <DialogTitle style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              Edit Shift
            </DialogTitle>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
            {/* Staff Member */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>
                Staff Member
              </label>
              <Select value={formStaffId} onValueChange={setFormStaffId}>
                <SelectTrigger style={{ borderRadius: 8, borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-white)', color: 'var(--text-primary)', fontSize: 13 }}>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {staffName(s)} ({ROLE_DISPLAY[s.role] || s.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>
                Date
              </label>
              <Input
                type="date"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
                style={{ borderRadius: 8, borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-white)', color: 'var(--text-primary)', fontSize: 13 }}
              />
            </div>

            {/* Time Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>
                  Start Time
                </label>
                <Input
                  type="time"
                  value={formStartTime}
                  onChange={e => setFormStartTime(e.target.value)}
                  style={{ borderRadius: 8, borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-white)', color: 'var(--text-primary)', fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>
                  End Time
                </label>
                <Input
                  type="time"
                  value={formEndTime}
                  onChange={e => setFormEndTime(e.target.value)}
                  style={{ borderRadius: 8, borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-white)', color: 'var(--text-primary)', fontSize: 13 }}
                />
              </div>
            </div>

            {/* Label */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>
                Label
              </label>
              <Select value={formLabel} onValueChange={setFormLabel}>
                <SelectTrigger style={{ borderRadius: 8, borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-white)', color: 'var(--text-primary)', fontSize: 13 }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Full Day', 'Morning', 'Afternoon', 'Evening', 'Custom'].map(l => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>
                Notes <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(optional)</span>
              </label>
              <Textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                placeholder="Any additional notes..."
                rows={3}
                style={{ borderRadius: 8, borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-white)', color: 'var(--text-primary)', fontSize: 13, resize: 'none' }}
              />
            </div>
          </div>

          {/* Delete Confirmation */}
          {deleteConfirm && (
            <div style={{
              padding: '12px 16px', borderRadius: 8,
              backgroundColor: '#EF444412', border: '1px solid #EF444430',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 13, color: '#DC2626', fontWeight: 600 }}>
                Delete this shift permanently?
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  style={{
                    padding: '5px 12px', borderRadius: 6,
                    border: '1px solid var(--border-color)', backgroundColor: 'transparent',
                    color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  style={{
                    padding: '5px 12px', borderRadius: 6,
                    border: '1px solid #EF4444', backgroundColor: '#EF4444',
                    color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    opacity: saving ? 0.5 : 1,
                  }}
                >
                  {saving ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          )}

          <DialogFooter style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
            <button
              onClick={() => setDeleteConfirm(true)}
              style={{
                padding: '7px 14px', borderRadius: 8,
                border: '1px solid #EF4444',
                backgroundColor: '#EF444412',
                color: '#DC2626', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#EF444420'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#EF444412'; }}
            >
              <Trash2 style={{ width: 14, height: 14 }} />
              Delete Shift
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                variant="outline"
                onClick={() => { setEditOpen(false); setEditingShift(null); setDeleteConfirm(false); resetForm(); }}
                style={{ borderRadius: 8, fontSize: 13, fontWeight: 600, borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEditSave}
                disabled={saving || !formStaffId || !formDate}
                style={{
                  borderRadius: 8, fontSize: 13, fontWeight: 700,
                  backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)',
                  opacity: saving || !formStaffId || !formDate ? 0.5 : 1,
                }}
              >
                {saving ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                    Saving...
                  </span>
                ) : 'Save Changes'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
