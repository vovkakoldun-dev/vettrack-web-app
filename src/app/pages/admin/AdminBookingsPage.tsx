import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router';
import {
  Plus, Search, Clock, User, Calendar as CalendarIcon,
  CheckCircle2, AlertCircle, XCircle,
  ChevronLeft, ChevronRight, LayoutList, LayoutGrid, CalendarDays,
  Pencil, Trash2, Bell, Stethoscope, UserCheck,
  Smartphone, ChevronDown, ChevronUp, Phone, MessageCircle, X,
} from 'lucide-react';
import { useAppointments } from '../../hooks/useAppointments';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '../../components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../../components/ui/select';
import { Calendar } from '../../components/ui/calendar';

// ─── Status Styles ───────────────────────────────────────────

const statusStyles: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  Confirmed: { bg: '#74C69D20', text: 'var(--brand-green-text)', icon: CheckCircle2 },
  Pending: { bg: '#F4A26120', text: '#F4A261', icon: AlertCircle },
  Completed: { bg: '#6B728020', text: 'var(--text-secondary)', icon: CheckCircle2 },
  Cancelled: { bg: '#d4183d20', text: '#d4183d', icon: XCircle },
  'In Progress': { bg: '#3B82F620', text: '#3B82F6', icon: Stethoscope },
};

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

// ─── Portal Requests ─────────────────────────────────────────
interface PortalRequest {
  id: number;
  owner: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerInitials: string;
  ownerColor: string;
  pet: string;
  petType: string;
  petImage: string;
  service: string;
  requestedDate: string;
  requestedTime: string;
  vet: string;
  notes: string;
  submittedAgo: string;
}

const PORTAL_REQUEST_MOCK: PortalRequest[] = []

// ─── Helpers ─────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function isSameDay(d1: string, d2: Date): boolean {
  const parts = d1.split('-');
  return (
    parseInt(parts[0]) === d2.getFullYear() &&
    parseInt(parts[1]) === d2.getMonth() + 1 &&
    parseInt(parts[2]) === d2.getDate()
  );
}

function isToday(date: Date): boolean {
  const now = new Date();
  return date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function getDatesWithAppointments(appts: { date: string }[]): Date[] {
  const dateSet = new Set<string>();
  appts.forEach((a) => dateSet.add(a.date));
  return Array.from(dateSet).map((d) => new Date(d + 'T12:00:00'));
}

function from24Hour(time24: string): string {
  let [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function to24Hour(time12: string): string {
  const [timePart, ampm] = time12.split(' ');
  let [h, m] = timePart.split(':').map(Number);
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

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

// Generate 30-min slots from 8:00 AM to 5:30 PM
const SCHEDULE_SLOTS = Array.from({ length: 20 }, (_, i) => {
  const totalMin = 8 * 60 + i * 30;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
});

// ─── Filter Tabs ─────────────────────────────────────────────

const FILTER_TABS = ['All', 'Upcoming', 'Completed', 'Cancelled'] as const;
type FilterTab = typeof FILTER_TABS[number];

// ─── Component ───────────────────────────────────────────────

export default function AdminBookingsPage() {
  const location = useLocation();
  const { appointments: supaAppts, loading: apptsLoading } = useAppointments();
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'schedule' | 'month'>('list');
  const [monthViewDate, setMonthViewDate] = useState<Date>(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [newApptTime, setNewApptTime] = useState('09:00');
  const [newApptDate, setNewApptDate] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });

  // Map Supabase AppointmentRow[] → the shape expected by existing UI
  const mappedAppointments = useMemo(() =>
    supaAppts.map((a) => {
      const dt = new Date(a.scheduled_at);
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      const startH = dt.getHours();
      const startM = dt.getMinutes();
      const ampm = startH >= 12 ? 'PM' : 'AM';
      const h12 = startH > 12 ? startH - 12 : startH === 0 ? 12 : startH;
      const timeStart = `${h12}:${String(startM).padStart(2, '0')} ${ampm}`;
      const dur = a.duration_minutes ?? 30;
      const endDt = new Date(dt.getTime() + dur * 60000);
      const endH = endDt.getHours();
      const endM = endDt.getMinutes();
      const endAmpm = endH >= 12 ? 'PM' : 'AM';
      const endH12 = endH > 12 ? endH - 12 : endH === 0 ? 12 : endH;
      const timeEnd = `${endH12}:${String(endM).padStart(2, '0')} ${endAmpm}`;
      return {
        id: a.id,
        date: `${yyyy}-${mm}-${dd}`,
        timeStart,
        timeEnd,
        petName: a.pets?.name ?? '—',
        petImage: a.pets?.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(a.pets?.name || 'P')}&background=74C69D&color=fff`,
        ownerName: a.clients ? `${a.clients.first_name} ${a.clients.last_name}` : '—',
        species: a.pets?.species ?? '—',
        service: a.services?.name ?? a.reason ?? '—',
        vet: a.staff ? `Dr. ${a.staff.last_name}` : '—',
        status: a.status as string,
        notes: a.notes ?? '',
      };
    }),
    [supaAppts],
  );

  const [localOverrides, setLocalOverrides] = useState<Record<string, Record<string, unknown>>>({});
  const appointments = useMemo(() =>
    mappedAppointments.map((a) => ({ ...a, ...(localOverrides[a.id] || {}) })),
    [mappedAppointments, localOverrides],
  );
  const setAppointments = (fn: (prev: typeof appointments) => typeof appointments) => {
    // Capture overrides from the function result
    const updated = fn(appointments);
    const newOverrides: Record<string, Record<string, unknown>> = { ...localOverrides };
    updated.forEach((u) => {
      const orig = mappedAppointments.find((a) => a.id === u.id);
      if (orig) {
        const diff: Record<string, unknown> = {};
        for (const key of Object.keys(u) as (keyof typeof u)[]) {
          if (u[key] !== orig[key]) diff[key as string] = u[key];
        }
        if (Object.keys(diff).length > 0) newOverrides[u.id] = diff;
      }
    });
    setLocalOverrides(newOverrides);
  };
  const [detailOpen, setDetailOpen] = useState(false);
  const [arrivedToast, setArrivedToast] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<'view' | 'edit'>('view');
  const [selectedAppt, setSelectedAppt] = useState<Record<string, unknown> | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editService, setEditService] = useState('');
  const [editVet, setEditVet] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // ── New Appointment form state ──────────────────────────────
  const [newApptPet, setNewApptPet] = useState('');
  const [newApptService, setNewApptService] = useState('');
  const [newApptVetName, setNewApptVetName] = useState('Dr. Chen');
  const [newApptDuration, setNewApptDuration] = useState('30 min');
  const [newApptNotes, setNewApptNotes] = useState('');
  const [newApptStatus, setNewApptStatus] = useState('Confirmed');
  const [newApptPriority, setNewApptPriority] = useState('Normal');
  const [newApptPetHealth, setNewApptPetHealth] = useState<'Healthy' | 'Follow-up' | 'Critical'>('Healthy');
  const [confirmMethod, setConfirmMethod] = useState('Email');
  const [reminderMethod, setReminderMethod] = useState('Email');
  const [reminderTiming, setReminderTiming] = useState('1 day');

  // ── New Patient (first-visit) form state ───────────────────
  const [visitType, setVisitType] = useState<'returning' | 'new'>('returning');
  const [npPetName, setNpPetName] = useState('');
  const [npSpecies, setNpSpecies] = useState('');
  const [npBreed, setNpBreed] = useState('');
  const [npDob, setNpDob] = useState('');
  const [npWeight, setNpWeight] = useState('');
  const [npSex, setNpSex] = useState('');
  const [npOwnerName, setNpOwnerName] = useState('');
  const [npOwnerEmail, setNpOwnerEmail] = useState('');
  const [npOwnerPhone, setNpOwnerPhone] = useState('');

  // ── Portal requests ──────────────────────────────
  const [portalRequests, setPortalRequests] = useState<PortalRequest[]>([]);
  const [portalPanelOpen, setPortalPanelOpen] = useState(true);
  const [changeTimeReq, setChangeTimeReq] = useState<PortalRequest | null>(null);
  const [changeTimeDate, setChangeTimeDate] = useState('');
  const [changeTimeTime, setChangeTimeTime] = useState('');
  const [changeTimeVet, setChangeTimeVet] = useState('Dr. Chen');
  const [contactReq, setContactReq] = useState<PortalRequest | null>(null);
  const [contactMsg, setContactMsg] = useState('');

  const approveRequest = (req: PortalRequest) => {
    setPortalRequests(prev => prev.filter(r => r.id !== req.id));
  };

  const openChangeTime = (req: PortalRequest) => {
    setChangeTimeReq(req);
    setChangeTimeDate('');
    setChangeTimeTime('');
    setChangeTimeVet(req.vet);
  };

  const confirmChangeTime = () => {
    if (!changeTimeReq) return;
    setPortalRequests(prev => prev.map(r =>
      r.id === changeTimeReq.id
        ? { ...r, requestedDate: changeTimeDate || r.requestedDate, requestedTime: changeTimeTime }
        : r
    ));
    setChangeTimeReq(null);
  };

  const declineRequest = (id: number) => setPortalRequests(prev => prev.filter(r => r.id !== id));

  const sendContactMsg = () => {
    setContactMsg('');
    setContactReq(null);
  };

  // ── Auto-open appointment detail from navigation ──
  useEffect(() => {
    const state = location.state as { openApptId?: number; openNewAppt?: boolean } | null;

    if (state?.openApptId) {
      const target = appointments.find((a) => a.id === state.openApptId);
      if (target) {
        const [y, m, d] = target.date.split('-').map(Number);
        setSelectedDate(new Date(y, m - 1, d));
        setTimeout(() => openApptDetail(target), 0);
      }
    } else if (state?.openNewAppt) {
      setTimeout(() => openNewApptDialog(), 0);
    }

    window.history.replaceState({}, '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const datesWithAppointments = getDatesWithAppointments(appointments);

  const dayAppointments = appointments.filter((a) => isSameDay(a.date, selectedDate));

  const filteredByStatus = dayAppointments.filter((a) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Upcoming') return a.status === 'Confirmed' || a.status === 'Pending';
    return a.status === activeFilter;
  });

  const filteredAppointments = filteredByStatus.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.petName.toLowerCase().includes(q) ||
      a.ownerName.toLowerCase().includes(q) ||
      a.service.toLowerCase().includes(q) ||
      a.vet.toLowerCase().includes(q)
    );
  });

  const totalToday = dayAppointments.length;
  const completedToday = dayAppointments.filter((a) => a.status === 'Completed').length;
  const cancelledToday = dayAppointments.filter((a) => a.status === 'Cancelled').length;
  const remainingToday = totalToday - completedToday - cancelledToday;
  const scheduledCount = dayAppointments.filter((a) => a.status === 'Confirmed' || a.status === 'Pending').length;
  const appointmentByTime = new Map(dayAppointments.map((a) => [a.timeStart, a]));

  const goToPrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
  };
  const goToNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next);
  };
  const goToToday = () => setSelectedDate(new Date());

  const goToPrevMonth = () => setMonthViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const goToNextMonth = () => setMonthViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  const goToCurrentMonth = () => { const n = new Date(); setMonthViewDate(new Date(n.getFullYear(), n.getMonth(), 1)); };

  const mvYear = monthViewDate.getFullYear();
  const mvMonth = monthViewDate.getMonth();
  const firstWeekday = new Date(mvYear, mvMonth, 1).getDay();
  const daysInMvMonth = new Date(mvYear, mvMonth + 1, 0).getDate();
  const calendarCells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMvMonth }, (_, i) => i + 1),
  ];
  const apptsByDate = appointments.reduce<Record<string, typeof appointments>>((acc, appt) => {
    (acc[appt.date] = acc[appt.date] || []).push(appt);
    return acc;
  }, {});
  const isCurrentMonthView = monthViewDate.getMonth() === new Date().getMonth() && monthViewDate.getFullYear() === new Date().getFullYear();
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const openNewApptDialog = () => {
    const y = selectedDate.getFullYear();
    const m = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
    const d = selectedDate.getDate().toString().padStart(2, '0');
    setNewApptDate(`${y}-${m}-${d}`);
    setNewApptTime('09:00');
    setDialogOpen(true);
  };

  const openSlotBooking = (slotLabel: string) => {
    setNewApptTime(to24Hour(slotLabel));
    const y = selectedDate.getFullYear();
    const m = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
    const d = selectedDate.getDate().toString().padStart(2, '0');
    setNewApptDate(`${y}-${m}-${d}`);
    setDialogOpen(true);
  };

  const openApptDetail = (appt: Record<string, unknown>) => {
    setSelectedAppt(appt);
    setEditDate(appt.date);
    setEditTime(to24Hour(appt.timeStart));
    setEditService(appt.service);
    setEditVet(appt.vet);
    setEditNotes(appt.notes);
    setDetailMode('view');
    setDetailOpen(true);
  };

  const handleClientArrived = () => {
    if (!selectedAppt) return;
    setAppointments((prev) =>
      prev.map((a) => (a.id === selectedAppt.id ? { ...a, status: 'In Progress' as const } : a)),
    );
    setDetailOpen(false);
    setArrivedToast(`${selectedAppt.petName} (${selectedAppt.ownerName}) has arrived and is ready — ${selectedAppt.vet} has been notified.`);
    setTimeout(() => setArrivedToast(null), 4000);
  };

  const handleSaveChanges = () => {
    if (!selectedAppt) return;
    const newTimeStart = from24Hour(editTime);
    const origDuration = getDurationMin(selectedAppt.timeStart, selectedAppt.timeEnd);
    const [eH, eM] = editTime.split(':').map(Number);
    const endTotalMin = eH * 60 + eM + origDuration;
    const endH = Math.floor(endTotalMin / 60);
    const endM = endTotalMin % 60;
    const endAmpm = endH >= 12 ? 'PM' : 'AM';
    const endH12 = endH > 12 ? endH - 12 : endH === 0 ? 12 : endH;
    const newTimeEnd = `${endH12}:${endM.toString().padStart(2, '0')} ${endAmpm}`;

    const updated = { ...selectedAppt, date: editDate, timeStart: newTimeStart, timeEnd: newTimeEnd, service: editService, vet: editVet, notes: editNotes };
    setAppointments((prev) =>
      prev.map((a) => (a.id === selectedAppt.id ? updated : a)),
    );
    setSelectedAppt(updated);
    setDetailMode('view');
  };

  const handleCancelAppt = () => {
    if (!selectedAppt) return;
    setAppointments((prev) =>
      prev.map((a) => (a.id === selectedAppt.id ? { ...a, status: 'Cancelled' as const } : a)),
    );
    setDetailOpen(false);
  };

  const getSlotAvailability = (dateStr: string, excludeId?: number) => {
    const dateAppts = appointments.filter(
      (a) => a.date === dateStr && a.status !== 'Cancelled' && (excludeId == null || a.id !== excludeId),
    );
    const bookedTimes = new Map(dateAppts.map((a) => [a.timeStart, a]));
    return SCHEDULE_SLOTS.map((slot) => ({
      time: slot,
      time24: to24Hour(slot),
      booked: bookedTimes.get(slot) || null,
    }));
  };

  return (
    <div className="max-w-[1440px] mx-auto p-8">
      {/* ─── Header ───────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[var(--text-primary)]" style={{ fontSize: '32px', fontWeight: 700 }}>
            Bookings
          </h1>
          <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '16px', fontWeight: 400 }}>
            Manage your clinic schedule and bookings.
          </p>
        </div>
        <Button onClick={openNewApptDialog}>
          <Plus className="w-4 h-4" /> New Booking
        </Button>
      </div>

      {/* ─── Portal Appointment Requests ───────────────── */}
      {portalRequests.length > 0 && (
        <div className="mb-6" style={{ border: '1.5px solid #3B82F630', borderRadius: '14px', overflow: 'hidden', backgroundColor: 'var(--surface-white)' }}>
          {/* Section header */}
          <button
            onClick={() => setPortalPanelOpen(o => !o)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'linear-gradient(135deg, #3B82F608, #2D6A4F08)', border: 'none', cursor: 'pointer', borderBottom: portalPanelOpen ? '1px solid var(--border-color)' : 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '9px', backgroundColor: '#3B82F615', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Smartphone style={{ width: '16px', height: '16px', color: '#3B82F6' }} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Portal Appointment Requests</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#3B82F6', color: '#fff' }}>
                    {portalRequests.length} new
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>Submitted by patients via the owner portal — review and action required</p>
              </div>
            </div>
            {portalPanelOpen
              ? <ChevronUp style={{ width: '16px', height: '16px', color: 'var(--text-secondary)' }} />
              : <ChevronDown style={{ width: '16px', height: '16px', color: 'var(--text-secondary)' }} />
            }
          </button>

          {/* Request cards */}
          {portalPanelOpen && (
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {portalRequests.map(req => (
                <div
                  key={req.id}
                  style={{ padding: '16px 18px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)', display: 'flex', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap' }}
                >
                  {/* Pet avatar */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <img src={req.petImage} alt={req.pet} style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: req.ownerColor, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface-elevated)' }}>
                      <span style={{ fontSize: '7px', fontWeight: 700, color: '#fff' }}>{req.ownerInitials}</span>
                    </div>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{req.pet}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>({req.petType})</span>
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '9999px', backgroundColor: `${serviceColors[req.service] || '#6B7280'}18`, color: serviceColors[req.service] || '#6B7280' }}>
                        {req.service}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '5px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <CalendarIcon style={{ width: '12px', height: '12px', color: 'var(--text-secondary)' }} />
                        <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>{req.requestedDate} · {req.requestedTime}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <User style={{ width: '12px', height: '12px', color: 'var(--text-secondary)' }} />
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{req.owner} · {req.vet}</span>
                      </div>
                    </div>
                    {req.notes && (
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic' }}>"{req.notes}"</p>
                    )}
                    <p style={{ fontSize: '10px', color: 'var(--text-secondary)', margin: '5px 0 0', opacity: 0.7 }}>
                      Submitted {req.submittedAgo} via owner portal
                    </p>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                    {/* Approve */}
                    <button
                      onClick={() => approveRequest(req)}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '8px', backgroundColor: '#2D6A4F', color: '#fff', border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      <CheckCircle2 style={{ width: '13px', height: '13px' }} /> Approve
                    </button>
                    {/* Change Time */}
                    <button
                      onClick={() => openChangeTime(req)}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '8px', backgroundColor: 'transparent', border: '1.5px solid #F4A261', color: '#F4A261', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      <Clock style={{ width: '13px', height: '13px' }} /> Change Time
                    </button>
                    {/* Contact Patient */}
                    <button
                      onClick={() => { setContactReq(req); setContactMsg(''); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '8px', backgroundColor: 'transparent', border: '1.5px solid #3B82F6', color: '#3B82F6', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      <MessageCircle style={{ width: '13px', height: '13px' }} /> Contact
                    </button>
                    {/* Decline */}
                    <button
                      onClick={() => declineRequest(req.id)}
                      style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      title="Decline request"
                    >
                      <X style={{ width: '13px', height: '13px', color: '#d4183d' }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Change Time Dialog ─────────────────────── */}
      {changeTimeReq && (() => {
        const VET_OPTIONS = [
          { name: 'Dr. Chen',   initials: 'DC', color: '#2D6A4F' },
          { name: 'Dr. Patel',  initials: 'SP', color: '#3B82F6' },
          { name: 'Dr. Garcia', initials: 'MG', color: '#8B5CF6' },
        ];
        const slots = changeTimeDate ? getSlotAvailability(changeTimeDate) : [];
        return (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={() => setChangeTimeReq(null)}>
            <div style={{ backgroundColor: 'var(--surface-white)', borderRadius: '16px', width: '100%', maxWidth: '540px', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div style={{ background: 'linear-gradient(135deg, #E8913A, #F4A261)', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Clock style={{ width: '18px', height: '18px', color: '#fff' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: '17px', fontWeight: 700, color: '#fff', margin: 0 }}>Change Appointment Time</p>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', margin: 0 }}>{changeTimeReq.pet} · {changeTimeReq.service} · {changeTimeReq.owner}</p>
                  </div>
                </div>
                <button onClick={() => setChangeTimeReq(null)} style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.2)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X style={{ width: '15px', height: '15px', color: '#fff' }} />
                </button>
              </div>

              <div style={{ padding: '22px 22px 20px' }}>
                {/* Original request info */}
                <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: '#F4A26110', border: '1.5px solid #F4A26130', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Clock style={{ width: '16px', height: '16px', color: '#F4A261', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#F4A261', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Patient Requested</p>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: '2px 0 0' }}>{changeTimeReq.requestedDate} at {changeTimeReq.requestedTime}</p>
                  </div>
                </div>

                {/* Vet selector */}
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Assign Veterinarian</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {VET_OPTIONS.map(v => {
                      const active = changeTimeVet === v.name;
                      return (
                        <button
                          key={v.name}
                          onClick={() => setChangeTimeVet(v.name)}
                          style={{
                            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                            padding: '10px 8px', borderRadius: '10px', cursor: 'pointer',
                            border: active ? `2px solid ${v.color}` : '1.5px solid var(--border-color)',
                            backgroundColor: active ? `${v.color}12` : 'var(--surface-elevated)',
                            transition: 'all 0.15s',
                          }}
                        >
                          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: `linear-gradient(135deg, ${v.color}, ${v.color}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: active ? `0 0 0 3px ${v.color}30` : 'none' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#fff' }}>{v.initials}</span>
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: active ? 700 : 500, color: active ? v.color : 'var(--text-primary)', whiteSpace: 'nowrap' }}>{v.name}</span>
                          {active && <span style={{ fontSize: '9px', fontWeight: 700, color: v.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Selected</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date picker */}
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '7px' }}>New Date</p>
                  <input
                    type="date"
                    value={changeTimeDate}
                    onChange={e => { setChangeTimeDate(e.target.value); setChangeTimeTime(''); }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '9px', border: '1.5px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)', color: 'var(--text-primary)', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
                  />
                </div>

                {/* Time slot grid */}
                <div style={{ marginBottom: '22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Available Time Slots</p>
                    {changeTimeDate && (
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2D6A4F', display: 'inline-block' }} /> Available
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#d4183d', display: 'inline-block' }} /> Booked
                        </span>
                      </div>
                    )}
                  </div>

                  {!changeTimeDate ? (
                    <div style={{ padding: '24px', borderRadius: '10px', border: '1.5px dashed var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      Select a date to see available slots
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '7px' }}>
                      {slots.map(slot => {
                        const isBooked = !!slot.booked;
                        const isSelected = changeTimeTime === slot.time24;
                        return (
                          <button
                            key={slot.time24}
                            disabled={isBooked}
                            onClick={() => setChangeTimeTime(slot.time24)}
                            style={{
                              padding: '8px 4px', borderRadius: '8px', fontSize: '12px', fontWeight: isSelected ? 700 : 500,
                              cursor: isBooked ? 'not-allowed' : 'pointer',
                              border: isSelected ? '2px solid #F4A261' : '1.5px solid var(--border-color)',
                              backgroundColor: isBooked
                                ? 'var(--surface-elevated)'
                                : isSelected
                                  ? '#F4A26115'
                                  : 'var(--surface-elevated)',
                              color: isBooked ? 'var(--text-secondary)' : isSelected ? '#F4A261' : 'var(--text-primary)',
                              opacity: isBooked ? 0.45 : 1,
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                              transition: 'all 0.12s',
                            }}
                          >
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isBooked ? '#d4183d' : '#2D6A4F', display: 'block' }} />
                            {slot.time}
                            {isBooked && <span style={{ fontSize: '9px', color: '#d4183d', fontWeight: 700 }}>Booked</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Selected summary */}
                {changeTimeDate && changeTimeTime && (
                  <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: '#F4A26110', border: '1.5px solid #F4A26130', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckCircle2 style={{ width: '16px', height: '16px', color: '#F4A261', flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: '11px', fontWeight: 700, color: '#F4A261', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>New Appointment</p>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: '2px 0 0' }}>
                        {new Date(changeTimeDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · {from24Hour(changeTimeTime)} · {changeTimeVet}
                      </p>
                    </div>
                  </div>
                )}

                {/* Footer buttons */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setChangeTimeReq(null)} style={{ flex: 1, padding: '11px', borderRadius: '9px', border: '1.5px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  <button
                    onClick={confirmChangeTime}
                    disabled={!changeTimeDate || !changeTimeTime}
                    style={{ flex: 2, padding: '11px', borderRadius: '9px', backgroundColor: !changeTimeDate || !changeTimeTime ? 'var(--surface-elevated)' : '#F4A261', color: !changeTimeDate || !changeTimeTime ? 'var(--text-secondary)' : '#fff', border: 'none', fontSize: '13px', fontWeight: 700, cursor: !changeTimeDate || !changeTimeTime ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', transition: 'background 0.15s' }}
                  >
                    <Clock style={{ width: '14px', height: '14px' }} /> Confirm & Notify Patient
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── Contact Patient Dialog ─────────────────── */}
      {contactReq && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={() => setContactReq(null)}>
          <div style={{ backgroundColor: 'var(--surface-white)', borderRadius: '16px', width: '100%', maxWidth: '420px', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ background: '#3B82F6', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <MessageCircle style={{ width: '18px', height: '18px', color: '#fff' }} />
                <div>
                  <p style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: 0 }}>Contact Patient</p>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', margin: 0 }}>{contactReq.owner} · {contactReq.pet}</p>
                </div>
              </div>
              <button onClick={() => setContactReq(null)} style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.2)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X style={{ width: '14px', height: '14px', color: '#fff' }} />
              </button>
            </div>
            <div style={{ padding: '20px 22px 22px' }}>
              {/* Patient contact details */}
              <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-color)', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: contactReq.ownerColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#fff' }}>{contactReq.ownerInitials}</span>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{contactReq.owner}</span>
                </div>
                <div style={{ display: 'flex', gap: '16px', paddingLeft: '34px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Phone style={{ width: '11px', height: '11px', color: 'var(--text-secondary)' }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{contactReq.ownerPhone}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <MessageCircle style={{ width: '11px', height: '11px', color: 'var(--text-secondary)' }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{contactReq.ownerEmail}</span>
                  </div>
                </div>
              </div>
              {/* Appointment reference */}
              <div style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: '#3B82F608', border: '1px solid #3B82F620', marginBottom: '16px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>Re: Appointment Request</p>
                <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>{contactReq.pet} · {contactReq.service} · {contactReq.requestedDate} at {contactReq.requestedTime}</p>
              </div>
              {/* Message */}
              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Message</p>
                <textarea
                  value={contactMsg}
                  onChange={e => setContactMsg(e.target.value)}
                  rows={4}
                  placeholder={`Hi ${contactReq.owner}, regarding your appointment request for ${contactReq.pet}…`}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '9px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)', color: 'var(--text-primary)', fontSize: '13px', resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setContactReq(null)} style={{ flex: 1, padding: '10px', borderRadius: '9px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button onClick={sendContactMsg} style={{ flex: 2, padding: '10px', borderRadius: '9px', backgroundColor: '#3B82F6', color: '#fff', border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <MessageCircle style={{ width: '14px', height: '14px' }} /> Send Message
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Main Grid ─────────────────────────────────── */}
      <div className="grid gap-6" style={{ gridTemplateColumns: viewMode === 'list' ? '1fr 340px' : '1fr' }}>
        {/* ══ LEFT: Appointment List ══ */}
        <div>
          {/* Date + Filters + Search */}
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-5 mb-4" style={{ borderRadius: '12px' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {viewMode === 'month' ? (
                  <>
                    <button onClick={goToPrevMonth} className="p-1 hover:bg-[var(--surface-elevated)] transition-colors" style={{ borderRadius: '6px' }}>
                      <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
                    </button>
                    <CalendarIcon className="w-5 h-5 text-[var(--brand-green-text)]" />
                    <h2 className="text-[var(--text-primary)]" style={{ fontSize: '18px', fontWeight: 600 }}>
                      {MONTH_NAMES[mvMonth]} {mvYear}
                    </h2>
                    <button onClick={goToNextMonth} className="p-1 hover:bg-[var(--surface-elevated)] transition-colors" style={{ borderRadius: '6px' }}>
                      <ChevronRight className="w-5 h-5 text-[var(--text-secondary)]" />
                    </button>
                    {!isCurrentMonthView && (
                      <button
                        onClick={goToCurrentMonth}
                        className="ml-2 px-3 py-1 text-[var(--brand-green-text)] border border-[#2D6A4F] hover:bg-[#2D6A4F10] transition-colors"
                        style={{ borderRadius: '6px', fontSize: '13px', fontWeight: 500 }}
                      >
                        Today
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button onClick={goToPrevDay} className="p-1 hover:bg-[var(--surface-elevated)] transition-colors" style={{ borderRadius: '6px' }}>
                      <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
                    </button>
                    <CalendarIcon className="w-5 h-5 text-[var(--brand-green-text)]" />
                    <h2 className="text-[var(--text-primary)]" style={{ fontSize: '18px', fontWeight: 600 }}>
                      {isToday(selectedDate) ? 'Today, ' : ''}
                      {formatDate(selectedDate)}
                    </h2>
                    <button onClick={goToNextDay} className="p-1 hover:bg-[var(--surface-elevated)] transition-colors" style={{ borderRadius: '6px' }}>
                      <ChevronRight className="w-5 h-5 text-[var(--text-secondary)]" />
                    </button>
                    {!isToday(selectedDate) && (
                      <button
                        onClick={goToToday}
                        className="ml-2 px-3 py-1 text-[var(--brand-green-text)] border border-[#2D6A4F] hover:bg-[#2D6A4F10] transition-colors"
                        style={{ borderRadius: '6px', fontSize: '13px', fontWeight: 500 }}
                      >
                        Today
                      </button>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                {viewMode !== 'month' && (
                  <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>
                    {totalToday} booking{totalToday !== 1 ? 's' : ''}
                  </span>
                )}
                <div className="flex gap-1 p-1 bg-[var(--surface-elevated)]" style={{ borderRadius: '8px' }}>
                  <button
                    onClick={() => setViewMode('list')}
                    className="p-1.5 transition-colors"
                    title="List view"
                    style={{
                      borderRadius: '6px',
                      backgroundColor: viewMode === 'list' ? 'var(--surface-white)' : 'transparent',
                      boxShadow: viewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    }}
                  >
                    <LayoutList className="w-4 h-4" style={{ color: viewMode === 'list' ? 'var(--text-primary)' : 'var(--text-secondary)' }} />
                  </button>
                  <button
                    onClick={() => setViewMode('schedule')}
                    className="p-1.5 transition-colors"
                    title="Schedule view"
                    style={{
                      borderRadius: '6px',
                      backgroundColor: viewMode === 'schedule' ? 'var(--surface-white)' : 'transparent',
                      boxShadow: viewMode === 'schedule' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    }}
                  >
                    <LayoutGrid className="w-4 h-4" style={{ color: viewMode === 'schedule' ? 'var(--text-primary)' : 'var(--text-secondary)' }} />
                  </button>
                  <button
                    onClick={() => {
                      setMonthViewDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
                      setViewMode('month');
                    }}
                    className="p-1.5 transition-colors"
                    title="Month view"
                    style={{
                      borderRadius: '6px',
                      backgroundColor: viewMode === 'month' ? 'var(--surface-white)' : 'transparent',
                      boxShadow: viewMode === 'month' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    }}
                  >
                    <CalendarDays className="w-4 h-4" style={{ color: viewMode === 'month' ? 'var(--text-primary)' : 'var(--text-secondary)' }} />
                  </button>
                </div>
              </div>
            </div>

            {viewMode !== 'month' && (
              <div className="flex items-center gap-3">
                {/* Filter Tabs */}
                <div className="flex gap-1 p-1 bg-[var(--surface-elevated)]" style={{ borderRadius: '8px' }}>
                  {FILTER_TABS.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveFilter(tab)}
                      className="px-3 py-1.5 transition-colors"
                      style={{
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: activeFilter === tab ? 600 : 400,
                        backgroundColor: activeFilter === tab ? 'var(--surface-white)' : 'transparent',
                        color: activeFilter === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                        boxShadow: activeFilter === tab ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                  <Input
                    placeholder="Search pet, owner, or service..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── List View: Appointment Cards ── */}
          {viewMode === 'list' && (
            filteredAppointments.length === 0 ? (
              <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-12 text-center" style={{ borderRadius: '12px' }}>
                <CalendarIcon className="w-12 h-12 text-[var(--border-color)] mx-auto mb-3" />
                <p className="text-[var(--text-primary)] mb-1" style={{ fontSize: '16px', fontWeight: 600 }}>
                  No bookings found
                </p>
                <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>
                  {dayAppointments.length === 0
                    ? 'No bookings scheduled for this date.'
                    : 'Try adjusting your filters or search.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAppointments.map((appt) => {
                  const s = statusStyles[appt.status];
                  const StatusIcon = s.icon;
                  const serviceColor = serviceColors[appt.service] || serviceColors.Other;
                  return (
                    <div
                      key={appt.id}
                      className="bg-[var(--surface-white)] border border-[var(--border-color)] p-4 hover:border-[#2D6A4F] transition-colors cursor-pointer"
                      style={{ borderRadius: '12px' }}
                      onClick={() => openApptDetail(appt)}
                    >
                      <div className="flex items-center gap-4">
                        {/* Time */}
                        <div className="w-28 flex-shrink-0 text-center">
                          <p className="text-[var(--text-primary)]" style={{ fontSize: '15px', fontWeight: 600 }}>
                            {appt.timeStart}
                          </p>
                          <p className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>
                            to {appt.timeEnd}
                          </p>
                        </div>

                        {/* Divider */}
                        <div className="w-px h-12 bg-[var(--border-color)]" />

                        {/* Pet + Owner */}
                        <div className="flex items-center gap-3 flex-1">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={appt.petImage} alt={appt.petName} className="object-cover" />
                            <AvatarFallback>{appt.petName.slice(0, 2)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-[var(--text-primary)]" style={{ fontSize: '16px', fontWeight: 600 }}>
                              {appt.petName}
                            </p>
                            <p className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>
                              {appt.ownerName} · {appt.species}
                            </p>
                          </div>
                        </div>

                        {/* Service Badge */}
                        <span
                          className="inline-block px-2.5 py-1 flex-shrink-0"
                          style={{
                            backgroundColor: serviceColor + '15',
                            color: serviceColor,
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 600,
                          }}
                        >
                          {appt.service}
                        </span>

                        {/* Vet */}
                        <div className="flex items-center gap-1.5 flex-shrink-0 w-24">
                          <User className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                          <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{appt.vet}</span>
                        </div>

                        {/* Status */}
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1 flex-shrink-0"
                          style={{
                            backgroundColor: s.bg,
                            color: s.text,
                            borderRadius: '9999px',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {appt.status}
                        </span>
                      </div>

                      {/* Notes preview */}
                      {appt.notes && (
                        <p className="text-[var(--text-secondary)] mt-2 ml-32 pl-4" style={{ fontSize: '13px', borderLeft: '2px solid var(--border-color)' }}>
                          {appt.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* ── Month Calendar View ── */}
          {viewMode === 'month' && (
            <div className="bg-[var(--surface-white)] border border-[var(--border-color)] overflow-hidden" style={{ borderRadius: '12px' }}>
              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 border-b border-[var(--border-color)]">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div
                    key={d}
                    className="py-3 text-center"
                    style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7">
                {calendarCells.map((day, idx) => {
                  const isLastRow = idx >= calendarCells.length - 7;
                  const isRightEdge = (idx + 1) % 7 === 0;

                  if (!day) {
                    return (
                      <div
                        key={`empty-${idx}`}
                        className={`min-h-[130px] bg-[var(--surface-elevated)] ${!isLastRow ? 'border-b' : ''} ${!isRightEdge ? 'border-r' : ''} border-[var(--border-color)]`}
                      />
                    );
                  }

                  const dateStr = `${mvYear}-${String(mvMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dayAppts = apptsByDate[dateStr] || [];
                  const dayDate = new Date(mvYear, mvMonth, day);
                  const isSelectedDay =
                    selectedDate.getDate() === day &&
                    selectedDate.getMonth() === mvMonth &&
                    selectedDate.getFullYear() === mvYear;
                  const isTodayDay = isToday(dayDate);

                  return (
                    <div
                      key={day}
                      className={`min-h-[130px] p-2 cursor-pointer transition-colors hover:bg-[var(--surface-elevated)] ${!isLastRow ? 'border-b' : ''} ${!isRightEdge ? 'border-r' : ''} border-[var(--border-color)] ${isSelectedDay && !isTodayDay ? 'bg-[var(--surface-elevated)]' : ''}`}
                      onClick={() => {
                        setSelectedDate(dayDate);
                        setMonthViewDate(new Date(mvYear, mvMonth, 1));
                      }}
                    >
                      {/* Day number */}
                      <div className="flex justify-center mb-1.5">
                        <span
                          className="w-7 h-7 flex items-center justify-center"
                          style={{
                            borderRadius: '9999px',
                            fontSize: '14px',
                            fontWeight: isTodayDay || isSelectedDay ? 700 : 400,
                            backgroundColor: isTodayDay ? 'var(--brand-green-text)' : isSelectedDay ? '#2D6A4F20' : 'transparent',
                            color: isTodayDay ? '#fff' : isSelectedDay ? 'var(--brand-green-text)' : 'var(--text-primary)',
                          }}
                        >
                          {day}
                        </span>
                      </div>

                      {/* Appointment pills */}
                      <div className="space-y-0.5">
                        {dayAppts.slice(0, 3).map((appt) => {
                          const color = serviceColors[appt.service] || serviceColors.Other;
                          return (
                            <div
                              key={appt.id}
                              className="px-1.5 py-0.5 truncate"
                              style={{
                                backgroundColor: color + '18',
                                borderLeft: `3px solid ${color}`,
                                borderRadius: '3px',
                                fontSize: '11px',
                                color: color,
                                fontWeight: 600,
                                lineHeight: '18px',
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                openApptDetail(appt);
                              }}
                            >
                              {appt.timeStart} · {appt.petName}
                            </div>
                          );
                        })}
                        {dayAppts.length > 3 && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', paddingLeft: '4px', fontWeight: 500 }}>
                            +{dayAppts.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="border-t border-[var(--border-color)] px-4 py-3 flex flex-wrap gap-4">
                {Object.entries(serviceColors).map(([service, color]) => (
                  <div key={service} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{service}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Schedule View: Stats + Time Slots ── */}
          {viewMode === 'schedule' && (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                {[
                  { label: 'Total Today', value: totalToday, color: 'var(--brand-green-text)' },
                  { label: 'Completed', value: completedToday, color: '#74C69D' },
                  { label: 'In Progress', value: remainingToday, color: '#F4A261' },
                  { label: 'Scheduled', value: scheduledCount, color: 'var(--brand-green-text)' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-[var(--surface-white)] border border-[var(--border-color)] p-4"
                    style={{ borderRadius: '12px' }}
                  >
                    <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: '13px' }}>{stat.label}</p>
                    <p style={{ fontSize: '28px', fontWeight: 700, color: stat.color }}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Time Slot Grid */}
              <div className="bg-[var(--surface-white)] border border-[var(--border-color)] overflow-hidden" style={{ borderRadius: '12px' }}>
                {SCHEDULE_SLOTS.map((slot, idx) => {
                  const appt = appointmentByTime.get(slot);
                  const isLast = idx === SCHEDULE_SLOTS.length - 1;
                  return (
                    <div
                      key={slot}
                      className={`flex items-stretch ${!isLast ? 'border-b border-[var(--border-color)]' : ''}`}
                    >
                      {/* Time Label */}
                      <div className="w-28 flex-shrink-0 px-4 py-4 flex items-center justify-end">
                        <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>{slot}</span>
                      </div>

                      {/* Slot Content */}
                      {appt ? (
                        <div
                          className="flex-1 m-1.5 px-4 py-3 flex items-center gap-4 cursor-pointer hover:brightness-95 transition-all"
                          style={{
                            backgroundColor: '#2D6A4F10',
                            borderLeft: '4px solid #2D6A4F',
                            borderRadius: '8px',
                          }}
                          onClick={() => openApptDetail(appt)}
                        >
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            <AvatarImage src={appt.petImage} alt={appt.petName} className="object-cover" />
                            <AvatarFallback>{appt.petName.slice(0, 2)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{appt.petName}</p>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{appt.service}</p>
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {getDurationMin(appt.timeStart, appt.timeEnd)} min
                          </span>
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5"
                            style={{
                              backgroundColor: statusStyles[appt.status].bg,
                              color: statusStyles[appt.status].text,
                              borderRadius: '9999px',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {appt.status}
                          </span>
                        </div>
                      ) : (
                        <div
                          className="flex-1 m-1.5 px-4 py-4 cursor-pointer hover:bg-[var(--surface-elevated)] transition-colors flex items-center"
                          style={{ borderRadius: '8px' }}
                          onClick={() => openSlotBooking(slot)}
                        >
                          <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Available</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ══ RIGHT: Sidebar (list view only) ══ */}
        {viewMode === 'list' && (
        <div className="space-y-6">
          {/* Mini Calendar */}
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-4 flex justify-center" style={{ borderRadius: '12px' }}>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              modifiers={{ hasAppointment: datesWithAppointments }}
              modifiersStyles={{
                hasAppointment: {
                  fontWeight: 700,
                  textDecoration: 'underline',
                  textDecorationColor: 'var(--brand-green-text)',
                  textUnderlineOffset: '4px',
                },
              }}
            />
          </div>

          {/* Daily Stats */}
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-5" style={{ borderRadius: '12px' }}>
            <h3 className="text-[var(--text-primary)] mb-4" style={{ fontSize: '16px', fontWeight: 600 }}>
              Daily Summary
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#2D6A4F]" />
                  <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Total</span>
                </div>
                <span className="text-[var(--text-primary)]" style={{ fontSize: '20px', fontWeight: 700 }}>{totalToday}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#74C69D]" />
                  <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Completed</span>
                </div>
                <span className="text-[var(--text-primary)]" style={{ fontSize: '20px', fontWeight: 700 }}>{completedToday}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#F4A261]" />
                  <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Remaining</span>
                </div>
                <span className="text-[var(--text-primary)]" style={{ fontSize: '20px', fontWeight: 700 }}>{remainingToday}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#d4183d]" />
                  <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Cancelled</span>
                </div>
                <span className="text-[var(--text-primary)]" style={{ fontSize: '20px', fontWeight: 700 }}>{cancelledToday}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex justify-between mb-1">
                <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>Day progress</span>
                <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>
                  {totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0}%
                </span>
              </div>
              <div className="w-full h-2 bg-[var(--border-color)] overflow-hidden" style={{ borderRadius: '9999px' }}>
                <div
                  className="h-full bg-[#2D6A4F] transition-all"
                  style={{
                    width: totalToday > 0 ? `${(completedToday / totalToday) * 100}%` : '0%',
                    borderRadius: '9999px',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Vets on Duty */}
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-5" style={{ borderRadius: '12px' }}>
            <h3 className="text-[var(--text-primary)] mb-3" style={{ fontSize: '16px', fontWeight: 600 }}>
              Vets on Duty
            </h3>
            <div className="space-y-3">
              {['Dr. Chen', 'Dr. Patel', 'Dr. Garcia'].map((vet) => {
                const count = dayAppointments.filter((a) => a.vet === vet && a.status !== 'Cancelled').length;
                return (
                  <div key={vet} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-[#2D6A4F15] flex items-center justify-center" style={{ borderRadius: '9999px' }}>
                        <User className="w-3.5 h-3.5 text-[var(--brand-green-text)]" />
                      </div>
                      <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 500 }}>{vet}</span>
                    </div>
                    <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>
                      {count} appt{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* ─── New Booking Dialog ────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="p-0 gap-0 overflow-hidden [&>button]:top-[14px] [&>button]:right-[14px] [&>button]:w-8 [&>button]:h-8 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:rounded-[8px] [&>button]:!bg-white/15 [&>button]:!text-white [&>button]:!opacity-100 [&>button]:hover:!bg-white/25 [&>button]:transition-colors [&>button>svg]:w-4 [&>button>svg]:h-4"
          style={{ maxWidth: '780px', width: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
        >
          {/* ── Header ── */}
          <div style={{ background: '#2D6A4F', padding: '18px 24px', flexShrink: 0 }}>
            <div className="flex items-center gap-3">
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CalendarIcon style={{ width: '18px', height: '18px', color: '#fff' }} />
              </div>
              <div>
                <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>New Booking</h2>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '1px' }}>Schedule a visit for a patient</p>
              </div>
            </div>
          </div>

          {/* ── Body ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 264px', flex: 1, minHeight: 0 }}>

            {/* Left: fields */}
            <div style={{ padding: '22px 24px', overflowY: 'auto', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Visit type tabs */}
              <div style={{ display: 'flex', gap: '0', borderRadius: '9px', padding: '3px', backgroundColor: 'var(--surface-elevated)' }}>
                {([
                  { id: 'returning' as const, label: 'Returning Patient', emoji: '🔄' },
                  { id: 'new'       as const, label: 'New Patient',        emoji: '✨' },
                ] as const).map(tab => {
                  const active = visitType === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setVisitType(tab.id)}
                      style={{
                        flex: 1, padding: '7px 10px', borderRadius: '7px',
                        fontSize: '13px', fontWeight: active ? 700 : 500,
                        backgroundColor: active ? 'var(--surface-white)' : 'transparent',
                        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        cursor: 'pointer', border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        transition: 'all 0.15s',
                      }}
                    >
                      <span>{tab.emoji}</span> {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Patient — Returning */}
              {visitType === 'returning' && (
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Patient</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                    <Input
                      placeholder="Search by pet name or owner…"
                      className="pl-9"
                      value={newApptPet}
                      onChange={e => setNewApptPet(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Patient — New (first visit) */}
              {visitType === 'new' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Pet Information</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Pet Name *</p>
                      <Input placeholder="e.g. Max" value={npPetName} onChange={e => setNpPetName(e.target.value)} />
                    </div>
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Species *</p>
                      <Select value={npSpecies} onValueChange={setNpSpecies}>
                        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Dog">🐶 Dog</SelectItem>
                          <SelectItem value="Cat">🐱 Cat</SelectItem>
                          <SelectItem value="Rabbit">🐰 Rabbit</SelectItem>
                          <SelectItem value="Bird">🐦 Bird</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Breed</p>
                      <Input placeholder="e.g. Golden Retriever" value={npBreed} onChange={e => setNpBreed(e.target.value)} />
                    </div>
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Sex</p>
                      <Select value={npSex} onValueChange={setNpSex}>
                        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Male (neutered)">Male (neutered)</SelectItem>
                          <SelectItem value="Female (spayed)">Female (spayed)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Date of Birth</p>
                      <Input type="date" value={npDob} onChange={e => setNpDob(e.target.value)} />
                    </div>
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Weight</p>
                      <Input placeholder="e.g. 12.5 kg" value={npWeight} onChange={e => setNpWeight(e.target.value)} />
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>Owner Information</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Full Name *</p>
                        <Input placeholder="e.g. John Smith" value={npOwnerName} onChange={e => setNpOwnerName(e.target.value)} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Email *</p>
                          <Input type="email" placeholder="owner@email.com" value={npOwnerEmail} onChange={e => setNpOwnerEmail(e.target.value)} />
                        </div>
                        <div>
                          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Phone</p>
                          <Input type="tel" placeholder="(555) 000-0000" value={npOwnerPhone} onChange={e => setNpOwnerPhone(e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Service type */}
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Service Type</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {[
                    { label: 'Annual Checkup',  color: '#2D6A4F', emoji: '🩺' },
                    { label: 'Vaccination',      color: '#3B82F6', emoji: '💉' },
                    { label: 'Dental Cleaning',  color: '#8B5CF6', emoji: '🦷' },
                    { label: 'Surgery',          color: '#EC4899', emoji: '🔬' },
                    { label: 'Follow-up',        color: '#F4A261', emoji: '📋' },
                    { label: 'Emergency',        color: '#d4183d', emoji: '🚨' },
                    { label: 'Consultation',     color: '#06B6D4', emoji: '💬' },
                    { label: 'Other',            color: '#6B7280', emoji: '📝' },
                  ].map(s => {
                    const active = newApptService === s.label;
                    return (
                      <button
                        key={s.label}
                        onClick={() => setNewApptService(s.label)}
                        style={{
                          padding: '8px 6px', borderRadius: '9px',
                          fontSize: '11px', fontWeight: active ? 700 : 500,
                          border: `1.5px solid ${active ? s.color : 'var(--border-color)'}`,
                          backgroundColor: active ? `${s.color}18` : 'transparent',
                          color: active ? s.color : 'var(--text-secondary)',
                          cursor: 'pointer', textAlign: 'center',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                          transition: 'all 0.15s',
                        }}
                      >
                        <span style={{ fontSize: '16px', lineHeight: 1 }}>{s.emoji}</span>
                        <span style={{ lineHeight: 1.2 }}>{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date + Time */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Date</p>
                  <Input type="date" value={newApptDate} onChange={e => setNewApptDate(e.target.value)} />
                </div>
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Time</p>
                  <Select value={newApptTime} onValueChange={setNewApptTime}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {getSlotAvailability(newApptDate).map(slot => (
                        <SelectItem key={slot.time24} value={slot.time24} disabled={!!slot.booked}>
                          <span className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: slot.booked ? '#d4183d' : '#2D6A4F' }} />
                            <span>{slot.time}</span>
                            {slot.booked && <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>— {slot.booked.petName}</span>}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Duration */}
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Duration</p>
                <div className="flex gap-2 flex-wrap">
                  {['15 min', '30 min', '45 min', '60 min', '90 min'].map(d => {
                    const active = newApptDuration === d;
                    return (
                      <button key={d} onClick={() => setNewApptDuration(d)} style={{
                        padding: '6px 13px', borderRadius: '7px', fontSize: '13px',
                        fontWeight: active ? 700 : 500,
                        border: `1.5px solid ${active ? '#2D6A4F' : 'var(--border-color)'}`,
                        backgroundColor: active ? '#2D6A4F18' : 'transparent',
                        color: active ? 'var(--brand-green-text)' : 'var(--text-secondary)',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}>{d}</button>
                    );
                  })}
                </div>
              </div>

              {/* Veterinarian */}
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Veterinarian</p>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { name: 'Dr. Chen',   initials: 'SC', color: '#2D6A4F' },
                    { name: 'Dr. Patel',  initials: 'RP', color: '#3B82F6' },
                    { name: 'Dr. Garcia', initials: 'MG', color: '#8B5CF6' },
                  ].map(v => {
                    const active = newApptVetName === v.name;
                    return (
                      <button key={v.name} onClick={() => setNewApptVetName(v.name)} style={{
                        padding: '7px 14px', borderRadius: '8px', fontSize: '13px',
                        fontWeight: active ? 700 : 500,
                        border: `1.5px solid ${active ? v.color : 'var(--border-color)'}`,
                        backgroundColor: active ? `${v.color}18` : 'transparent',
                        color: active ? v.color : 'var(--text-secondary)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px',
                        transition: 'all 0.15s',
                      }}>
                        <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: `${v.color}20`, color: v.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, flexShrink: 0 }}>
                          {v.initials}
                        </span>
                        {v.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Notes</p>
                <Textarea
                  placeholder="Reason for visit, symptoms, owner requests…"
                  style={{ minHeight: '72px', resize: 'none' }}
                  value={newApptNotes}
                  onChange={e => setNewApptNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Right: summary + settings */}
            <div style={{ backgroundColor: 'var(--surface-elevated)', padding: '20px 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Summary */}
              <div style={{ backgroundColor: 'var(--surface-white)', borderRadius: '10px', padding: '14px', border: '1px solid var(--border-color)' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>Summary</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="flex items-center gap-2">
                    <CalendarIcon style={{ width: '12px', height: '12px', color: 'var(--text-secondary)', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', color: newApptDate ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {newApptDate ? new Date(newApptDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'No date set'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock style={{ width: '12px', height: '12px', color: 'var(--text-secondary)', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                      {newApptTime ? from24Hour(newApptTime) : '—'} · {newApptDuration}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User style={{ width: '12px', height: '12px', color: 'var(--text-secondary)', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{newApptVetName}</span>
                  </div>
                  {newApptService && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: serviceColors[newApptService] || '#6B7280' }} />
                      <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{newApptService}</span>
                    </div>
                  )}
                  {newApptPet && (
                    <div className="flex items-center gap-2">
                      <Search style={{ width: '12px', height: '12px', color: 'var(--text-secondary)', flexShrink: 0 }} />
                      <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{newApptPet}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status + Priority */}
              <div style={{ backgroundColor: 'var(--surface-white)', borderRadius: '10px', padding: '14px', border: '1px solid var(--border-color)' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>Status & Priority</p>

                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Status</p>
                <div className="flex gap-1.5" style={{ marginBottom: '12px' }}>
                  {[{ label: 'Confirmed', color: '#2D6A4F' }, { label: 'Pending', color: '#F4A261' }].map(s => {
                    const active = newApptStatus === s.label;
                    return (
                      <button key={s.label} onClick={() => setNewApptStatus(s.label)} style={{
                        flex: 1, padding: '5px 8px', borderRadius: '6px', fontSize: '12px',
                        fontWeight: active ? 700 : 500,
                        border: `1.5px solid ${active ? s.color : 'var(--border-color)'}`,
                        backgroundColor: active ? `${s.color}15` : 'transparent',
                        color: active ? s.color : 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}>{s.label}</button>
                    );
                  })}
                </div>

                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Priority</p>
                <div className="flex gap-1.5" style={{ marginBottom: '14px' }}>
                  {[
                    { label: 'Normal',    color: '#2D6A4F' },
                    { label: 'Urgent',    color: '#F4A261' },
                    { label: 'Emergency', color: '#d4183d' },
                  ].map(p => {
                    const active = newApptPriority === p.label;
                    return (
                      <button key={p.label} onClick={() => setNewApptPriority(p.label)} style={{
                        flex: 1, padding: '5px 4px', borderRadius: '6px', fontSize: '11px',
                        fontWeight: active ? 700 : 500,
                        border: `1.5px solid ${active ? p.color : 'var(--border-color)'}`,
                        backgroundColor: active ? `${p.color}15` : 'transparent',
                        color: active ? p.color : 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}>{p.label}</button>
                    );
                  })}
                </div>

                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Pet Health Status</p>
                <div className="flex gap-1.5">
                  {([
                    { label: 'Healthy' as const,   color: '#2D6A4F', emoji: '✅' },
                    { label: 'Follow-up' as const, color: '#F4A261', emoji: '🔔' },
                    { label: 'Critical' as const,  color: '#d4183d', emoji: '🚨' },
                  ]).map(s => {
                    const active = newApptPetHealth === s.label;
                    return (
                      <button key={s.label} onClick={() => setNewApptPetHealth(s.label)} style={{
                        flex: 1, padding: '5px 4px', borderRadius: '6px', fontSize: '11px',
                        fontWeight: active ? 700 : 500,
                        border: `1.5px solid ${active ? s.color : 'var(--border-color)'}`,
                        backgroundColor: active ? `${s.color}15` : 'transparent',
                        color: active ? s.color : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px',
                      }}>
                        <span style={{ fontSize: '10px' }}>{s.emoji}</span> {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notifications */}
              <div style={{ backgroundColor: 'var(--surface-white)', borderRadius: '10px', padding: '14px', border: '1px solid var(--border-color)' }}>
                <div className="flex items-center gap-2" style={{ marginBottom: '14px' }}>
                  <Bell style={{ width: '12px', height: '12px', color: 'var(--text-secondary)' }} />
                  <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Notifications</p>
                </div>

                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>Confirmation</p>
                <div className="flex gap-1.5" style={{ marginBottom: '6px' }}>
                  {['Email', 'SMS', 'Both', 'None'].map(m => {
                    const active = confirmMethod === m;
                    return (
                      <button key={m} onClick={() => setConfirmMethod(m)} style={{
                        flex: 1, padding: '4px 2px', borderRadius: '6px', fontSize: '11px',
                        fontWeight: active ? 700 : 400,
                        border: `1.5px solid ${active ? '#2D6A4F' : 'var(--border-color)'}`,
                        backgroundColor: active ? '#2D6A4F15' : 'transparent',
                        color: active ? 'var(--brand-green-text)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}>{m}</button>
                    );
                  })}
                </div>
                {confirmMethod !== 'None' && (
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.4 }}>
                    Sent immediately after booking
                  </p>
                )}
                {confirmMethod === 'None' && <div style={{ marginBottom: '14px' }} />}

                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>Reminder</p>
                <div className="flex gap-1.5" style={{ marginBottom: '8px' }}>
                  {['Email', 'SMS', 'Both', 'None'].map(m => {
                    const active = reminderMethod === m;
                    return (
                      <button key={m} onClick={() => setReminderMethod(m)} style={{
                        flex: 1, padding: '4px 2px', borderRadius: '6px', fontSize: '11px',
                        fontWeight: active ? 700 : 400,
                        border: `1.5px solid ${active ? '#2D6A4F' : 'var(--border-color)'}`,
                        backgroundColor: active ? '#2D6A4F15' : 'transparent',
                        color: active ? 'var(--brand-green-text)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}>{m}</button>
                    );
                  })}
                </div>
                {reminderMethod !== 'None' && (
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Send before appointment</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {['1 hr', '4 hrs', '1 day', '2 days'].map(t => {
                        const active = reminderTiming === t;
                        return (
                          <button key={t} onClick={() => setReminderTiming(t)} style={{
                            padding: '4px 9px', borderRadius: '5px', fontSize: '11px',
                            fontWeight: active ? 700 : 400,
                            border: `1.5px solid ${active ? '#2D6A4F' : 'var(--border-color)'}`,
                            backgroundColor: active ? '#2D6A4F15' : 'transparent',
                            color: active ? 'var(--brand-green-text)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                          }}>{t}</button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div style={{ borderTop: '1px solid var(--border-color)', padding: '14px 24px', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexShrink: 0, backgroundColor: 'var(--surface-white)' }}>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => setDialogOpen(false)} style={{ backgroundColor: '#2D6A4F', color: '#fff' }}>
              <CalendarIcon className="w-4 h-4 mr-1.5" />
              Schedule Booking
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Patient Arrived Toast ─────────────────── */}
      {arrivedToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 200,
            maxWidth: 360,
            borderRadius: 14,
            backgroundColor: 'var(--surface-white)',
            border: '1.5px solid #2D6A4F40',
            boxShadow: '0 8px 32px rgba(0,0,0,0.16), 0 0 0 1px rgba(45,106,79,0.08)',
            overflow: 'hidden',
            animation: 'slideUp 0.25s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <div style={{ height: 3, background: 'linear-gradient(90deg, #2D6A4F, #74C69D)' }} />
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#2D6A4F15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              <UserCheck style={{ width: 16, height: 16, color: 'var(--brand-green-text)' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>Patient Arrived</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{arrivedToast}</p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Booking Detail / Edit Dialog ─────────── */}
      <Dialog open={detailOpen} onOpenChange={(open) => { setDetailOpen(open); if (!open) setDetailMode('view'); }}>
        <DialogContent
          className="p-0 overflow-hidden gap-0 [&>button]:top-[14px] [&>button]:right-[14px] [&>button]:w-8 [&>button]:h-8 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:rounded-[8px] [&>button]:!bg-white/15 [&>button]:!text-white [&>button]:!opacity-100 [&>button]:hover:!bg-white/25 [&>button]:transition-colors [&>button>svg]:w-4 [&>button>svg]:h-4"
          style={{
            maxWidth: '512px',
            width: '95vw',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 0 0 1px rgba(45,106,79,0.15), 0 8px 32px rgba(0,0,0,0.22), 0 0 60px rgba(45,106,79,0.18)',
          }}
        >
          {selectedAppt && (() => {
            const s = statusStyles[selectedAppt.status];
            const StatusIcon = s.icon;
            const svcColor = serviceColors[selectedAppt.service] || 'var(--text-secondary)';
            const durationMin = getDurationMin(selectedAppt.timeStart, selectedAppt.timeEnd);
            const canCheckIn = selectedAppt.status === 'Confirmed' || selectedAppt.status === 'Pending';
            const isDone = selectedAppt.status === 'Completed' || selectedAppt.status === 'Cancelled';

            return (
              <>
                {/* ── Coloured header strip (always shown) ── */}
                <div className="pl-6 pr-16 py-4 flex items-center gap-4 flex-shrink-0" style={{ background: '#2D6A4F' }}>
                  <Avatar className="w-12 h-12 border-2 border-white/20 flex-shrink-0">
                    <AvatarImage src={selectedAppt.petImage} alt={selectedAppt.petName} className="object-cover" />
                    <AvatarFallback className="text-base font-bold">{selectedAppt.petName.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold" style={{ fontSize: '17px' }}>{selectedAppt.petName}</p>
                    <p className="text-white/70" style={{ fontSize: '12px' }}>{selectedAppt.ownerName} · {selectedAppt.species} · {selectedAppt.timeStart}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', borderRadius: '9999px', fontSize: '11px', fontWeight: 600 }}>
                    <StatusIcon className="w-3 h-3" />
                    {selectedAppt.status}
                  </span>
                </div>

                {/* ════════════════ VIEW MODE ════════════════ */}
                {detailMode === 'view' && (
                  <>
                    <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-start gap-3 p-3 bg-[var(--surface-elevated)]" style={{ borderRadius: '10px' }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#2D6A4F18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><CalendarIcon style={{ width: 15, height: 15, color: 'var(--brand-green-text)' }} /></div>
                          <div><p className="text-[var(--text-secondary)]" style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date</p><p className="text-[var(--text-primary)]" style={{ fontSize: '13px', fontWeight: 600 }}>{new Date(selectedAppt.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p></div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-[var(--surface-elevated)]" style={{ borderRadius: '10px' }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F4A26118', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Clock style={{ width: 15, height: 15, color: '#F4A261' }} /></div>
                          <div><p className="text-[var(--text-secondary)]" style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Time</p><p className="text-[var(--text-primary)]" style={{ fontSize: '13px', fontWeight: 600 }}>{selectedAppt.timeStart} – {selectedAppt.timeEnd}</p><p className="text-[var(--text-secondary)]" style={{ fontSize: '11px' }}>{durationMin} min</p></div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-[var(--surface-elevated)]" style={{ borderRadius: '10px' }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#3B82F618', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Stethoscope style={{ width: 15, height: 15, color: '#3B82F6' }} /></div>
                          <div><p className="text-[var(--text-secondary)]" style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Service</p><p style={{ fontSize: '13px', fontWeight: 600, color: svcColor }}>{selectedAppt.service}</p></div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-[var(--surface-elevated)]" style={{ borderRadius: '10px' }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#818CF818', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><User style={{ width: 15, height: 15, color: '#818CF8' }} /></div>
                          <div><p className="text-[var(--text-secondary)]" style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Veterinarian</p><p className="text-[var(--text-primary)]" style={{ fontSize: '13px', fontWeight: 600 }}>{selectedAppt.vet}</p></div>
                        </div>
                      </div>
                      {selectedAppt.notes && (
                        <div className="p-3 bg-[var(--surface-elevated)]" style={{ borderRadius: '10px' }}>
                          <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Notes</p>
                          <p className="text-[var(--text-primary)]" style={{ fontSize: '13px', lineHeight: 1.5 }}>{selectedAppt.notes}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-[var(--border-color)] flex-shrink-0">
                      {!isDone && (
                        <Button variant="outline" size="sm" onClick={handleCancelAppt} className="text-[#d4183d] border-[#d4183d] hover:bg-[#d4183d10] hover:text-[#d4183d]">
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />Cancel Booking
                        </Button>
                      )}
                      <div className="flex gap-2 ml-auto">
                        <Button variant="outline" size="sm" onClick={() => setDetailMode('edit')}><Pencil className="w-3.5 h-3.5 mr-1.5" />Edit</Button>
                        {canCheckIn && (
                          <Button size="sm" onClick={handleClientArrived} style={{ background: '#2D6A4F', color: 'white', border: 'none' }} className="hover:opacity-90">
                            <UserCheck className="w-3.5 h-3.5 mr-1.5" />Patient Arrived
                          </Button>
                        )}
                        {isDone && <Button variant="outline" size="sm" onClick={() => setDetailOpen(false)}>Close</Button>}
                      </div>
                    </div>
                  </>
                )}

                {/* ════════════════ EDIT MODE ════════════════ */}
                {detailMode === 'edit' && (
                  <>
                    <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Date</label><Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} /></div>
                        <div>
                          <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Time</label>
                          <Select value={editTime} onValueChange={setEditTime}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent className="max-h-64">
                              {getSlotAvailability(editDate, selectedAppt?.id).map((slot) => (
                                <SelectItem key={slot.time24} value={slot.time24} disabled={!!slot.booked}>
                                  <span className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: slot.booked ? '#d4183d' : 'var(--brand-green-text)' }} />
                                    <span>{slot.time}</span>
                                    {slot.booked && <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>— {slot.booked.petName}</span>}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Service Type</label>
                        <Select value={editService} onValueChange={setEditService}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['Annual Checkup','Checkup','Vaccination','Dental Cleaning','Surgery','Follow-up','Emergency','Other'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Veterinarian</label>
                        <Select value={editVet} onValueChange={setEditVet}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['Dr. Chen','Dr. Patel','Dr. Garcia'].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div><label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Notes</label><Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="min-h-20" /></div>
                    </div>
                    <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-[var(--border-color)] flex-shrink-0">
                      <Button variant="outline" size="sm" onClick={() => setDetailMode('view')} className="text-[var(--text-secondary)]">← Back</Button>
                      <Button size="sm" onClick={handleSaveChanges}>Save Changes</Button>
                    </div>
                  </>
                )}

              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
