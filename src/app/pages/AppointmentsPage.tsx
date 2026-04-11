import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useActiveVisit } from '../context/ActiveVisitContext';
import { useAppointmentStatus } from '../context/AppointmentStatusContext';
import { useAuth } from '../context/AuthContext';
import {
  Plus, Search, Clock, User, Calendar as CalendarIcon,
  CheckCircle2, AlertCircle, XCircle, Filter,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, LayoutList, LayoutGrid, CalendarDays,
  Pencil, Trash2, Bell, LogIn, Stethoscope, Play,
  ClipboardList, DoorOpen, Camera, Star,
  Scissors, Microscope, Bed, Briefcase, Bath, Coffee, Sparkles, Building2, Loader2,
} from 'lucide-react';
import { useAppointments } from '../hooks/useAppointments';
import type { AppointmentRow } from '../hooks/useAppointments';
import { useClients } from '../hooks/useClients';
import { usePets } from '../hooks/usePets';
import { useTenantDb } from '../context/TenantContext';
import { getOrgContext } from '../hooks/useOrgContext';
import { WeightPicker, US_STATES, CA_PROVINCES } from '../components/AddClientDialog';
import { supabase } from '../../lib/supabase';

// ─── Adapter: Supabase row → legacy display shape ─────────────

type DisplayAppt = {
  id: string; petName: string; ownerName: string; petImage: string;
  service: string; vet: string; vetId: string; date: string; timeStart: string; timeEnd: string;
  status: 'Confirmed' | 'Pending' | 'Completed' | 'Cancelled' | 'In Progress';
  petHealth: 'Healthy' | 'Follow-up' | 'Critical'; duration: string;
  priority: string; room: string; confirmMethod: string; reminderMethod: string;
  reminderTiming: string; notes: string;
};

function adaptAppt(a: AppointmentRow): DisplayAppt {
  const start = new Date(a.scheduled_at);
  const end = new Date(start.getTime() + (a.duration_minutes ?? 30) * 60000);
  // Use local time methods — scheduled_at is stored with tz offset, display in user's local time
  const fmtLocal = (d: Date) => {
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
  };
  const validStatuses = ['Scheduled', 'Confirmed', 'Pending', 'Completed', 'Cancelled', 'In Progress', 'No Show'];
  const y = start.getFullYear();
  const mo = (start.getMonth() + 1).toString().padStart(2, '0');
  const da = start.getDate().toString().padStart(2, '0');
  return {
    id: a.id,
    petName: a.pets?.name ?? '—',
    ownerName: a.clients ? `${a.clients.first_name} ${a.clients.last_name}` : '—',
    petImage: a.pets?.photo_url ?? '',
    service: a.services?.name ?? a.reason ?? '—',
    vet: a.staff?.profiles ? `Dr. ${a.staff.profiles.last_name}` : 'TBD',
    vetId: a.staff?.id ?? '',
    date: `${y}-${mo}-${da}`,
    timeStart: fmtLocal(start),
    timeEnd: fmtLocal(end),
    status: (validStatuses.includes(a.status) ? a.status : 'Pending') as DisplayAppt['status'],
    petHealth: 'Healthy',
    duration: `${a.duration_minutes ?? 30} min`,
    priority: 'Normal',
    room: a.room ?? '',
    confirmMethod: 'Email',
    reminderMethod: 'Email',
    reminderTiming: '1 day',
    notes: a.notes ?? '',
  };
}
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../components/ui/select';
import { Calendar } from '../components/ui/calendar';

// ─── Status Styles ───────────────────────────────────────────

const statusStyles: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  Scheduled: { bg: '#06B6D420', text: '#06B6D4', icon: CalendarIcon },
  Confirmed: { bg: '#74C69D20', text: 'var(--brand-green-text)', icon: CheckCircle2 },
  Pending: { bg: '#F4A26120', text: '#F4A261', icon: AlertCircle },
  Completed: { bg: '#6B728020', text: 'var(--text-secondary)', icon: CheckCircle2 },
  Cancelled: { bg: '#d4183d20', text: '#d4183d', icon: XCircle },
  'In Progress': { bg: '#3B82F620', text: '#3B82F6', icon: Stethoscope },
  'No Show': { bg: '#64748B20', text: '#64748B', icon: XCircle },
};

const serviceColors: Record<string, string> = {
  // Legacy / short names
  'Annual Checkup': 'var(--brand-green-text)',
  Checkup: 'var(--brand-green-text)',
  Vaccination: '#3B82F6',
  'Dental Cleaning': '#8B5CF6',
  'Follow-up': '#F4A261',
  Emergency: '#d4183d',
  Surgery: '#EC4899',
  // Full service names from DB
  'General Wellness Exam': 'var(--brand-green-text)',
  'Rabies Vaccination': '#3B82F6',
  'DHPP Vaccine (Dog)': '#3B82F6',
  'Blood Panel (CBC + Chemistry)': '#06B6D4',
  'Cardiology Consultation': '#EC4899',
  'Flea & Tick Prevention (3-Month)': '#F4A261',
  'Spay Surgery': '#EC4899',
  'X-Ray (2 Views)': '#6B7280',
  'Emergency Triage & Stabilization': '#d4183d',
  Other: 'var(--text-secondary)',
};

// ─── Floor-plan Room Types ──────────────────────────────────
type RoomTypeKey =
  | 'exam' | 'surgery' | 'reception' | 'lab' | 'kennel'
  | 'office' | 'restroom' | 'lobby' | 'storage' | 'other';

const ROOM_TYPES: Record<RoomTypeKey, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  exam:      { label: 'Exam Room',  icon: Stethoscope, color: 'var(--brand-green-text)', bg: 'color-mix(in srgb, var(--brand-green-text) 18%, transparent)' },
  surgery:   { label: 'Surgery',    icon: Scissors,    color: '#EC4899',                  bg: 'color-mix(in srgb, #EC4899 18%, transparent)' },
  reception: { label: 'Reception',  icon: DoorOpen,    color: '#F4A261',                  bg: 'color-mix(in srgb, #F4A261 18%, transparent)' },
  lab:       { label: 'Lab',        icon: Microscope,  color: '#8B5CF6',                  bg: 'color-mix(in srgb, #8B5CF6 18%, transparent)' },
  kennel:    { label: 'Kennel',     icon: Bed,         color: '#06B6D4',                  bg: 'color-mix(in srgb, #06B6D4 18%, transparent)' },
  office:    { label: 'Office',     icon: Briefcase,   color: '#3B82F6',                  bg: 'color-mix(in srgb, #3B82F6 18%, transparent)' },
  restroom:  { label: 'Restroom',   icon: Bath,        color: '#6B7280',                  bg: 'color-mix(in srgb, #6B7280 22%, transparent)' },
  lobby:     { label: 'Lobby',      icon: Coffee,      color: '#F59E0B',                  bg: 'color-mix(in srgb, #F59E0B 18%, transparent)' },
  storage:   { label: 'Storage',    icon: Sparkles,    color: '#94A3B8',                  bg: 'color-mix(in srgb, #94A3B8 22%, transparent)' },
  other:     { label: 'Other',      icon: Building2,   color: '#64748B',                  bg: 'color-mix(in srgb, #64748B 22%, transparent)' },
};

interface ClinicRoom {
  id: string; clinic_id: string; name: string; type: RoomTypeKey;
  pos_x: number; pos_y: number; width: number; height: number; color: string | null;
}

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

// Dates that have appointments (for calendar highlighting)
function getDatesWithAppointments(appts: DisplayAppt[]): Date[] {
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

// Extended slots: 6 AM – 9:30 PM (32 slots) for the New Appointment dialog "Show more hours" toggle
const EXTENDED_SCHEDULE_SLOTS = Array.from({ length: 32 }, (_, i) => {
  const totalMin = 6 * 60 + i * 30;
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

export default function AppointmentsPage() {
  const db = useTenantDb();
  const navigate = useNavigate();
  const location = useLocation();
  const { startVisit } = useActiveVisit();
  const { setApptStatus } = useAppointmentStatus();
  const { user } = useAuth();
  const currentUserId = user?.id ?? '';
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'schedule' | 'month'>('list');
  const [showAllDates, setShowAllDates] = useState(false);
  const [visibleCount, setVisibleCount] = useState(5);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [monthViewDate, setMonthViewDate] = useState<Date>(new Date());
  const [newApptTime, setNewApptTime] = useState('');
  const today = new Date().toISOString().split('T')[0];
  const [newApptDate, setNewApptDate] = useState(today);
  const { appointments: dbAppts, loading: apptLoading, updateStatus: updateApptStatus, addAppointment, deleteAppointment } = useAppointments();
  const { clients: allClients } = useClients();
  const { pets: allPets } = usePets();
  const appointments = dbAppts.map(adaptAppt);
  const [detailOpen, setDetailOpen] = useState(false);
  const [dayPopupOpen, setDayPopupOpen] = useState(false);
  const [dayPopupDate, setDayPopupDate] = useState('');
  const [detailMode, setDetailMode] = useState<'view' | 'edit'>('view');
  const [selectedAppt, setSelectedAppt] = useState<DisplayAppt | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editService, setEditService] = useState('');
  const [editVet, setEditVet] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [roomInfoOpen, setRoomInfoOpen] = useState(false);
  const [roomInfoAppt, setRoomInfoAppt] = useState<DisplayAppt | null>(null);
  const [clinicRooms, setClinicRooms] = useState<ClinicRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── New Appointment form state ──────────────────────────────
  const [newApptClientId, setNewApptClientId] = useState('');
  const [newApptPetId, setNewApptPetId] = useState('');
  const [newApptPet, setNewApptPet] = useState('');
  const [ownerSearch, setOwnerSearch] = useState('');
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false);
  const [newApptServices, setNewApptServices] = useState<Set<string>>(new Set());
  const [newApptVetId, setNewApptVetId] = useState('');
  const [newApptVetName, setNewApptVetName] = useState('');
  const [newApptDuration, setNewApptDuration] = useState('30 min');
  const [newApptShowAllHours, setNewApptShowAllHours] = useState(false);
  const [hoveredSlotKey, setHoveredSlotKey] = useState<string | null>(null);
  const [newApptNotes, setNewApptNotes] = useState('');
  const [newApptStatus, setNewApptStatus] = useState('Confirmed');
  const [newApptPriority, setNewApptPriority] = useState('Normal');
  const [newApptPetHealth, setNewApptPetHealth] = useState<'Healthy' | 'Follow-up' | 'Critical'>('Healthy');
  const [confirmMethod, setConfirmMethod] = useState('Email');
  const [reminderMethod, setReminderMethod] = useState('Email');
  const [reminderTiming, setReminderTiming] = useState('1 day');
  const [savingAppt, setSavingAppt] = useState(false);
  const [vetTimeBlocks, setVetTimeBlocks] = useState<{ date: string; time_start: string; time_end: string; type: string }[]>([]);

  // ── New Patient (first-visit) form state ───────────────────
  const [visitType, setVisitType] = useState<'returning' | 'new'>('returning');
  const [npPetName, setNpPetName] = useState('');
  const [npSpecies, setNpSpecies] = useState('');
  const [npBreed, setNpBreed] = useState('');
  const [npDob, setNpDob] = useState('');
  const [npWeight, setNpWeight] = useState('');
  const [npSex, setNpSex] = useState('');
  const [npPhotoFile, setNpPhotoFile] = useState<File | null>(null);
  const [npPhotoPreview, setNpPhotoPreview] = useState<string | null>(null);
  const npPhotoInputRef = useRef<HTMLInputElement>(null);
  const [npOwnerName, setNpOwnerName] = useState('');
  const [npOwnerEmail, setNpOwnerEmail] = useState('');
  const [npOwnerPhone, setNpOwnerPhone] = useState('');
  const [npAddress, setNpAddress] = useState('');
  const [npCity, setNpCity] = useState('');
  const [npState, setNpState] = useState('');
  const [npZip, setNpZip] = useState('');
  const [npCountry, setNpCountry] = useState('US');

  // ── Fetch staff/vets from database ──
  const [staffList, setStaffList] = useState<{ id: string; name: string; initials: string }[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const { organizationId } = await getOrgContext();
        const { data } = await db.from('staff').select('id, role, profiles:profiles!staff_profile_org_fkey(first_name, last_name)').eq('organization_id', organizationId).in('role', ['veterinarian', 'senior_veterinarian', 'specialist']).eq('status', 'Active').order('first_name');
        if (data) setStaffList(data.map((s: any) => {
          const fn = s.profiles?.first_name || '';
          const ln = s.profiles?.last_name || '';
          return {
            id: s.id,
            name: `Dr. ${fn} ${ln}`.trim(),
            initials: `${(fn[0] ?? '').toUpperCase()}${(ln[0] ?? '').toUpperCase()}`,
          };
        }));
      } catch {}
    })();
  }, []);

  // ── Load clinic rooms for floor plan in room info dialog ──
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setRoomsLoading(true);
        const { organizationId, clinicId } = await getOrgContext();
        let q = db.from('clinic_rooms').select('id, clinic_id, name, type, pos_x, pos_y, width, height, color').eq('organization_id', organizationId);
        if (clinicId) q = q.eq('clinic_id', clinicId);
        const { data } = await q.order('sort_order', { ascending: true });
        if (alive) setClinicRooms((data ?? []) as ClinicRoom[]);
      } catch {} finally { if (alive) setRoomsLoading(false); }
    })();
    return () => { alive = false; };
  }, [db]);

  // ── Auto-open appointment detail from dashboard navigation ──
  useEffect(() => {
    const state = location.state as {
      openApptId?: string;
      openNewAppt?: boolean;
      prefillClientId?: string;
      prefillClientName?: string;
      prefillPetId?: string;
      prefillPetName?: string;
      prefillVetId?: string;
      prefillVetName?: string;
      prefillDate?: string;
    } | null;
    if (state?.openNewAppt) {
      setTimeout(() => {
        openNewApptDialog();
        // Pre-fill client/pet if passed from client detail page
        if (state.prefillClientId) {
          setNewApptClientId(state.prefillClientId);
          setOwnerSearch(state.prefillClientName || '');
          setOwnerDropdownOpen(false);
        }
        if (state.prefillPetId) {
          setNewApptPetId(state.prefillPetId);
          setNewApptPet(state.prefillPetName || '');
        }
        // Pre-fill vet if passed from admin bookings day popup
        if (state.prefillVetId) {
          setNewApptVetId(state.prefillVetId);
          setNewApptVetName(state.prefillVetName || '');
          fetchVetTimeBlocks(state.prefillVetId);
        }
        // Pre-fill date if passed
        if (state.prefillDate) {
          setNewApptDate(state.prefillDate);
        }
      }, 0);
    }
    window.history.replaceState({}, '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const datesWithAppointments = getDatesWithAppointments(appointments);

  // Filter appointments for selected date (or show all)
  const dayAppointments = showAllDates
    ? [...appointments].sort((a, b) => a.date.localeCompare(b.date) || a.timeStart.localeCompare(b.timeStart))
    : appointments.filter((a) => isSameDay(a.date, selectedDate));

  // Apply status filter
  const filteredByStatus = dayAppointments.filter((a) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Upcoming') return a.status === 'Confirmed' || a.status === 'Pending';
    return a.status === activeFilter;
  });

  // Apply search filter
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

  // Stats for the sidebar
  const totalToday = dayAppointments.length;
  const completedToday = dayAppointments.filter((a) => a.status === 'Completed').length;
  const cancelledToday = dayAppointments.filter((a) => a.status === 'Cancelled').length;
  const remainingToday = totalToday - completedToday - cancelledToday;
  const scheduledCount = dayAppointments.filter((a) => a.status === 'Confirmed' || a.status === 'Pending').length;
  const appointmentsByTime = new Map<string, DisplayAppt[]>();
  dayAppointments.forEach((a) => {
    const existing = appointmentsByTime.get(a.timeStart) || [];
    existing.push(a);
    appointmentsByTime.set(a.timeStart, existing);
  });

  // Track which slots are busy (spanned by an appointment's duration)
  const busySlots = new Map<string, DisplayAppt[]>();
  const timeToMin = (t: string) => {
    const [tp, ap] = t.split(' ');
    let [h, m] = tp.split(':').map(Number);
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  };
  dayAppointments.forEach((a) => {
    const startMin = timeToMin(a.timeStart);
    const dur = getDurationMin(a.timeStart, a.timeEnd);
    // Mark all slots that fall within this appointment's time range (excluding start slot)
    SCHEDULE_SLOTS.forEach((slot) => {
      const slotMin = timeToMin(slot);
      if (slotMin > startMin && slotMin < startMin + dur) {
        const existing = busySlots.get(slot) || [];
        existing.push(a);
        busySlots.set(slot, existing);
      }
    });
  });

  const goToPrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
    setCalendarMonth(prev);
  };
  const goToNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next);
    setCalendarMonth(next);
  };
  const goToToday = () => { const t = new Date(); setSelectedDate(t); setCalendarMonth(t); };

  const goToPrevMonth = () => setMonthViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const goToNextMonth = () => setMonthViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  const goToCurrentMonth = () => { const n = new Date(); setMonthViewDate(new Date(n.getFullYear(), n.getMonth(), 1)); };

  // Month calendar computed values
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
    setNewApptTime('');
    setNewApptClientId('');
    setNewApptPetId('');
    setNewApptPet('');
    setNewApptServices(new Set());
    setNewApptNotes('');
    setNewApptVetId('');
    setNewApptVetName('');
    setNewApptPetHealth('Healthy');
    setVisitType('returning');
    setNpPetName('');
    setNpSpecies('');
    setNpBreed('');
    setNpDob('');
    setNpWeight('');
    setNpSex('');
    setNpOwnerName('');
    setNpOwnerEmail('');
    setNpOwnerPhone('');
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

  const openApptDetail = (appt: DisplayAppt) => {
    setSelectedAppt(appt);
    setEditDate(appt.date);
    setEditTime(to24Hour(appt.timeStart));
    setEditService(appt.service);
    setEditVet(appt.vet);
    setEditNotes(appt.notes);
    setDetailMode('view');
    setDetailOpen(true);
  };

  const handleCheckIn = () => {
    if (!selectedAppt) return;
    // If the patient has a room assigned (admin checked them in), show room info first
    if (selectedAppt.room) {
      setRoomInfoAppt(selectedAppt);
      setDetailOpen(false);
      setRoomInfoOpen(true);
      return;
    }
    // No room assigned — go directly to visit
    proceedToVisit(selectedAppt);
  };

  const proceedToVisit = (appt: DisplayAppt) => {
    updateApptStatus(appt.id, 'In Progress');
    setApptStatus(appt.id, 'In Progress');
    startVisit({
      apptId: appt.id,
      petName: appt.petName,
      petImage: appt.petImage,
      ownerName: appt.ownerName,
      service: appt.service,
      durationMinutes: parseInt(appt.duration) || 30,
    });
    setRoomInfoOpen(false);
    setRoomInfoAppt(null);
    navigate(`/appointments/${appt.id}/visit`);
  };

  // Called directly from the appointment card's "Start Visit" button —
  // stops card's onClick propagation and either opens room info or goes to visit.
  const handleStartVisitFromCard = (appt: DisplayAppt, e: React.MouseEvent) => {
    e.stopPropagation();
    // Show room info dialog so doctor knows which room to go to
    if (appt.room) {
      setRoomInfoAppt(appt);
      setRoomInfoOpen(true);
      return;
    }
    // No room assigned — go directly to visit
    proceedToVisit(appt);
  };

  const handleSaveChanges = () => {
    if (!selectedAppt) return;
    // Save notes update to Supabase (status only for now — full edit requires more form wiring)
    setSelectedAppt({ ...selectedAppt, notes: editNotes });
    setDetailMode('view');
  };

  const handleCancelAppt = () => {
    if (!selectedAppt) return;
    updateApptStatus(selectedAppt.id, 'Cancelled');
    setDetailOpen(false);
  };

  const handleDeleteAppt = () => {
    if (!selectedAppt) return;
    setDeleteError(null);
    setDeleteConfirmOpen(true);
  };

  const performDeleteAppt = async () => {
    if (!selectedAppt) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const { error } = await deleteAppointment(selectedAppt.id);
      if (error) {
        console.error('[AppointmentsPage] deleteAppointment failed:', error);
        setDeleteError(error.message || 'Failed to delete appointment. Please try again.');
        return;
      }
      setDeleteConfirmOpen(false);
      setDetailOpen(false);
    } catch (e: any) {
      console.error('[AppointmentsPage] deleteAppointment threw:', e);
      setDeleteError(e?.message || 'Unexpected error while deleting.');
    } finally {
      setDeleting(false);
    }
  };

  // Fetch vet time blocks when vet is selected
  const fetchVetTimeBlocks = async (vetId: string) => {
    if (!vetId) { setVetTimeBlocks([]); return; }
    const { data } = await db
      .from('staff_time_blocks')
      .select('date, time_start, time_end, type')
      .eq('staff_id', vetId);
    setVetTimeBlocks(data || []);
  };

  const getSlotAvailability = (dateStr: string, excludeId?: string, vetId?: string, slotsList: readonly string[] = SCHEDULE_SLOTS) => {
    // A slot is only "booked" if the SAME vet already has an appointment there.
    // If no vet is selected, no conflicts are detected — show all slots as available.
    const hasVet = vetId != null && vetId !== '';
    const dateAppts = hasVet
      ? appointments.filter(
          (a) =>
            a.date === dateStr &&
            a.status !== 'Cancelled' &&
            (excludeId == null || a.id !== excludeId) &&
            a.vetId === vetId,
        )
      : [];
    // Mark all slots that overlap with any appointment's full duration
    const bookedTimes = new Map<string, DisplayAppt>();
    dateAppts.forEach((a) => {
      const startMin = (() => { const [tp, ap] = a.timeStart.split(' '); let [h, m] = tp.split(':').map(Number); if (ap === 'PM' && h !== 12) h += 12; if (ap === 'AM' && h === 12) h = 0; return h * 60 + m; })();
      const dur = getDurationMin(a.timeStart, a.timeEnd);
      slotsList.forEach((slot) => {
        const slotMin = (() => { const [tp, ap] = slot.split(' '); let [h, m] = tp.split(':').map(Number); if (ap === 'PM' && h !== 12) h += 12; if (ap === 'AM' && h === 12) h = 0; return h * 60 + m; })();
        // Slot overlaps if it starts within the appointment's time range
        if (slotMin >= startMin && slotMin < startMin + dur) {
          bookedTimes.set(slot, a);
        }
      });
    });

    // Check vet time blocks for this date
    const dateBlocks = vetTimeBlocks.filter((b) => b.date === dateStr);
    const blockedSlots = new Set<string>();
    dateBlocks.forEach((b) => {
      if (!b.time_start || !b.time_end) return;
      const [bsH, bsM] = b.time_start.split(':').map(Number);
      const [beH, beM] = b.time_end.split(':').map(Number);
      const bStartMin = bsH * 60 + bsM;
      const bEndMin = beH * 60 + beM;
      slotsList.forEach((slot) => {
        const t24 = to24Hour(slot);
        const [sh, sm] = t24.split(':').map(Number);
        const slotMin = sh * 60 + sm;
        // Block overlaps this slot's 30-min window
        if (bStartMin < slotMin + 30 && bEndMin > slotMin) {
          blockedSlots.add(slot);
        }
      });
    });

    return slotsList.map((slot) => ({
      time: slot,
      time24: to24Hour(slot),
      booked: bookedTimes.get(slot) || null,
      blocked: blockedSlots.has(slot)
        ? dateBlocks.find((b) => {
            if (!b.time_start || !b.time_end) return false;
            const [bsH, bsM] = b.time_start.split(':').map(Number);
            const [beH, beM] = b.time_end.split(':').map(Number);
            const bStartMin = bsH * 60 + bsM;
            const bEndMin = beH * 60 + beM;
            const t24 = to24Hour(slot);
            const [sh, sm] = t24.split(':').map(Number);
            const slotMin = sh * 60 + sm;
            return bStartMin < slotMin + 30 && bEndMin > slotMin;
          })?.type || null
        : null,
    }));
  };

  return (
    <div className="max-w-[1440px] mx-auto p-8">
      {/* ─── Header ───────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[var(--text-primary)]" style={{ fontSize: '32px', fontWeight: 700 }}>
            Appointments
          </h1>
          <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '16px', fontWeight: 400 }}>
            Manage your clinic schedule and bookings.
          </p>
        </div>
        <Button onClick={openNewApptDialog}>
          <Plus className="w-4 h-4" /> New Appointment
        </Button>
      </div>

      {/* ─── Main Grid ─────────────────────────────────── */}
      <div className="grid gap-6" style={{ gridTemplateColumns: viewMode === 'list' ? '1fr 340px' : '1fr' }}>
        {/* ══ LEFT: Appointment List ══ */}
        <div>
          {/* Date + Filters + Search */}
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-5 mb-4" style={{ borderRadius: '12px' }}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex flex-wrap items-center gap-2">
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
                        className="ml-2 px-3 py-1 text-[var(--brand-green-text)] border border-[var(--brand-green-text)] hover:bg-[color-mix(in_srgb,var(--brand-green-text)_6%,transparent)] transition-colors"
                        style={{ borderRadius: '6px', fontSize: '13px', fontWeight: 500 }}
                      >
                        Today
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {!showAllDates && (
                      <button onClick={goToPrevDay} className="p-1 hover:bg-[var(--surface-elevated)] transition-colors" style={{ borderRadius: '6px' }}>
                        <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
                      </button>
                    )}
                    <CalendarIcon className="w-5 h-5 text-[var(--brand-green-text)]" />
                    <h2 className="text-[var(--text-primary)]" style={{ fontSize: '18px', fontWeight: 600 }}>
                      {showAllDates ? 'All Appointments' : (
                        <>
                          {isToday(selectedDate) ? 'Today, ' : ''}
                          {formatDate(selectedDate)}
                        </>
                      )}
                    </h2>
                    {!showAllDates && (
                      <button onClick={goToNextDay} className="p-1 hover:bg-[var(--surface-elevated)] transition-colors" style={{ borderRadius: '6px' }}>
                        <ChevronRight className="w-5 h-5 text-[var(--text-secondary)]" />
                      </button>
                    )}
                    {!isToday(selectedDate) && !showAllDates && (
                      <button
                        onClick={goToToday}
                        className="ml-2 px-3 py-1 text-[var(--brand-green-text)] border border-[var(--brand-green-text)] hover:bg-[color-mix(in_srgb,var(--brand-green-text)_6%,transparent)] transition-colors"
                        style={{ borderRadius: '6px', fontSize: '13px', fontWeight: 500 }}
                      >
                        Today
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const next = !showAllDates;
                        setShowAllDates(next);
                        setVisibleCount(5);
                        if (next && viewMode !== 'list') setViewMode('list');
                      }}
                      className="ml-2 px-3 py-1 transition-colors"
                      style={{
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        backgroundColor: showAllDates ? 'var(--brand-green-text)' : 'transparent',
                        color: showAllDates ? 'var(--on-brand-green)' : 'var(--brand-green-text)',
                        border: showAllDates ? '1px solid var(--brand-green-text)' : '1px solid var(--brand-green-text)',
                      }}
                    >
                      {showAllDates ? <><ChevronLeft className="w-3.5 h-3.5 inline -ml-0.5 mr-0.5" />Back to Day</> : 'View All'}
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                {viewMode !== 'month' && (
                  <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>
                    {totalToday} appointment{totalToday !== 1 ? 's' : ''}{showAllDates ? ' total' : ''}
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
              <div className="flex flex-wrap items-center gap-3">
                {/* Filter Tabs */}
                <div className="flex gap-1 p-1 bg-[var(--surface-elevated)]" style={{ borderRadius: '8px' }}>
                  {FILTER_TABS.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => { setActiveFilter(tab); setVisibleCount(5); }}
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
                <div className="relative flex-1" style={{ minWidth: '180px' }}>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                  <Input
                    placeholder="Search pet"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(5); }}
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
                  No appointments found
                </p>
                <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>
                  {dayAppointments.length === 0
                    ? (showAllDates ? 'No appointments found.' : 'No appointments scheduled for this date.')
                    : 'Try adjusting your filters or search.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const visibleItems = filteredAppointments.slice(0, visibleCount);
                  const hasMore = visibleCount < filteredAppointments.length;
                  return (
                    <>
                      {visibleItems.map((appt, idx) => {
                        const s = statusStyles[appt.status] || statusStyles.Pending;
                        const StatusIcon = s.icon;
                        const serviceColor = serviceColors[appt.service] || serviceColors.Other;
                        const showDateHeader = showAllDates && (idx === 0 || filteredAppointments[idx - 1].date !== appt.date);
                        const dateLabel = showDateHeader ? new Date(appt.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';
                        return (
                          <div key={appt.id}>
                          {showDateHeader && (
                            <div className="flex items-center gap-2 mb-2 mt-4" style={{ ...(idx === 0 ? { marginTop: 0 } : {}) }}>
                              <CalendarIcon className="w-4 h-4 text-[var(--brand-green-text)]" />
                              <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>{dateLabel}</span>
                              <div className="flex-1 h-px bg-[var(--border-color)]" />
                            </div>
                          )}
                          <div
                            className="bg-[var(--surface-white)] border border-[var(--border-color)] p-4 hover:border-[var(--brand-green-text)] transition-colors cursor-pointer"
                            style={{ borderRadius: '12px' }}
                            onClick={() => openApptDetail(appt)}
                          >
                            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                              <div className="w-24 sm:w-28 flex-shrink-0 text-center">
                                <p className="text-[var(--text-primary)]" style={{ fontSize: '15px', fontWeight: 600 }}>
                                  {appt.timeStart}
                                </p>
                                <p className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>
                                  to {appt.timeEnd}
                                </p>
                              </div>
                              <div className="w-px h-12 bg-[var(--border-color)] hidden sm:block" />
                              <div className="flex items-center gap-3 flex-1 min-w-[160px]">
                                <Avatar className="w-10 h-10">
                                  <AvatarImage src={appt.petImage} alt={appt.petName} className="object-cover" />
                                  <AvatarFallback>{appt.petName.slice(0, 2)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[var(--text-primary)] truncate" style={{ fontSize: '16px', fontWeight: 600 }}>
                                    {appt.petName}
                                  </p>
                                  <p className="text-[var(--text-secondary)] truncate" style={{ fontSize: '13px' }}>
                                    {appt.ownerName}
                                  </p>
                                </div>
                              </div>
                              <span
                                className="inline-block px-2.5 py-1 flex-shrink-0 truncate max-w-[180px]"
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
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <User className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                                <span className="text-[var(--text-secondary)] truncate max-w-[100px]" style={{ fontSize: '13px' }}>{appt.vet}</span>
                              </div>
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
                              {currentUserId && appt.vetId === currentUserId && appt.status === 'In Progress' && (
                                <button
                                  type="button"
                                  onClick={(e) => handleStartVisitFromCard(appt, e)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 flex-shrink-0 transition-opacity hover:opacity-90"
                                  style={{
                                    background: 'var(--brand-green-text)',
                                    color: 'var(--on-brand-green)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <Play className="w-3 h-3" style={{ fill: 'currentColor' }} />
                                  {appt.room ? 'Start Visit' : 'Resume Visit'}
                                </button>
                              )}
                              {currentUserId && appt.vetId === currentUserId && appt.status === 'In Progress' && appt.room && (
                                <span
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 flex-shrink-0"
                                  style={{
                                    backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 10%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--brand-green-text) 30%, transparent)',
                                    borderRadius: '8px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    color: 'var(--brand-green-text)',
                                  }}
                                >
                                  <DoorOpen className="w-3 h-3" />
                                  {appt.room}
                                </span>
                              )}
                            </div>
                            {appt.notes && (
                              <p className="text-[var(--text-secondary)] mt-2 sm:ml-32 ml-0 pl-4" style={{ fontSize: '13px', borderLeft: '2px solid var(--border-color)' }}>
                                {appt.notes}
                              </p>
                            )}
                          </div>
                          </div>
                        );
                      })}

                      {/* Load More */}
                      {hasMore && (
                        <div className="pt-2">
                          <button
                            onClick={() => setVisibleCount((c) => c + 5)}
                            className="w-full py-2 transition-colors hover:bg-[color-mix(in_srgb,var(--brand-green-text)_6%,transparent)]"
                            style={{
                              borderRadius: '8px',
                              fontSize: '13px',
                              fontWeight: 600,
                              color: 'var(--brand-green-text)',
                              border: '1px solid var(--brand-green-text)',
                            }}
                          >
                            Load More ({filteredAppointments.length - visibleCount} remaining)
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
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
                        if (dayAppts.length > 0) {
                          setDayPopupDate(dateStr);
                          setDayPopupOpen(true);
                        }
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
                            backgroundColor: isTodayDay ? 'var(--brand-green-text)' : isSelectedDay ? 'color-mix(in srgb, var(--brand-green-text) 12%, transparent)' : 'transparent',
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
                  { label: showAllDates ? 'Total' : 'Total Today', value: totalToday, color: 'var(--brand-green-text)' },
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
                  const slotAppts = appointmentsByTime.get(slot) || [];
                  const slotBusy = busySlots.get(slot) || [];
                  const isLast = idx === SCHEDULE_SLOTS.length - 1;
                  return (
                    <div
                      key={slot}
                      className={`flex items-stretch ${!isLast ? 'border-b border-[var(--border-color)]' : ''}`}
                    >
                      {/* Time Label */}
                      <div className="w-28 flex-shrink-0 px-4 py-4 flex items-start justify-end">
                        <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500, paddingTop: '2px' }}>{slot}</span>
                      </div>

                      {/* Slot Content */}
                      {slotAppts.length > 0 ? (
                        <div className="flex-1 flex flex-col gap-1 py-1">
                          {slotAppts.map((appt) => (
                            <div
                              key={appt.id}
                              className="mx-1.5 px-4 py-3 flex items-center gap-4 cursor-pointer hover:brightness-95 transition-all"
                              style={{
                                backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 6%, transparent)',
                                borderLeft: '4px solid var(--brand-green-text)',
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
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{appt.service} · {appt.vet}</p>
                              </div>
                              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                {getDurationMin(appt.timeStart, appt.timeEnd)} min
                              </span>
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5"
                                style={{
                                  backgroundColor: (statusStyles[appt.status] || statusStyles.Pending).bg,
                                  color: (statusStyles[appt.status] || statusStyles.Pending).text,
                                  borderRadius: '9999px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                }}
                              >
                                {appt.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : slotBusy.length > 0 ? (
                        <div
                          className="flex-1 m-1.5 px-4 py-3 flex items-center gap-3"
                          style={{ borderRadius: '8px', backgroundColor: 'var(--surface-elevated)', opacity: 0.7 }}
                        >
                          <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: '#6B728050' }} />
                          <div className="flex-1 flex items-center gap-2">
                            {slotBusy.map((b, i) => (
                              <span key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                {b.vet} — {b.service}{i < slotBusy.length - 1 ? ' · ' : ''}
                              </span>
                            ))}
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', marginLeft: 'auto' }}>Busy</span>
                          </div>
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
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-4" style={{ borderRadius: '12px' }}>
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                onSelect={(date) => { if (date) { setSelectedDate(date); setCalendarMonth(date); } }}
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
            {(calendarMonth.getMonth() !== new Date().getMonth() || calendarMonth.getFullYear() !== new Date().getFullYear()) && (
              <button
                onClick={() => { const t = new Date(); setSelectedDate(t); setCalendarMonth(t); }}
                className="w-full mt-2 py-1.5 text-center transition-colors hover:bg-[color-mix(in_srgb,var(--brand-green-text)_6%,transparent)]"
                style={{
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--brand-green-text)',
                  border: '1px solid var(--brand-green-text)',
                }}
              >
                <ChevronLeft className="w-3.5 h-3.5 inline -ml-0.5 mr-0.5" />
                Back to Today
              </button>
            )}
          </div>

          {/* Daily Stats */}
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-5" style={{ borderRadius: '12px' }}>
            <h3 className="text-[var(--text-primary)] mb-4" style={{ fontSize: '16px', fontWeight: 600 }}>
              Daily Summary
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--brand-green-text)]" />
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
                  className="h-full bg-[var(--brand-green-text)] transition-all"
                  style={{
                    width: totalToday > 0 ? `${(completedToday / totalToday) * 100}%` : '0%',
                    borderRadius: '9999px',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Upcoming next */}
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-5" style={{ borderRadius: '12px' }}>
            <h3 className="text-[var(--text-primary)] mb-3" style={{ fontSize: '16px', fontWeight: 600 }}>
              Vets on Duty
            </h3>
            <div className="space-y-3">
              {staffList.length === 0 ? (
                <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>No vets found</span>
              ) : staffList.map((vet) => {
                const count = dayAppointments.filter((a) => a.vet === vet.name && a.status !== 'Cancelled').length;
                return (
                  <div key={vet.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-[color-mix(in_srgb,var(--brand-green-text)_8%,transparent)] flex items-center justify-center" style={{ borderRadius: '9999px', fontSize: '11px', fontWeight: 600, color: 'var(--brand-green-text)' }}>
                        {vet.initials}
                      </div>
                      <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 500 }}>{vet.name}</span>
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

      {/* ─── New Appointment Dialog ────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="p-0 gap-0 overflow-hidden [&>button]:top-[14px] [&>button]:right-[14px] [&>button]:w-8 [&>button]:h-8 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:rounded-[8px] [&>button]:!bg-[var(--surface-white)] [&>button]:!text-[var(--text-secondary)] [&>button]:!opacity-100 [&>button]:hover:!bg-[var(--surface-elevated)] [&>button]:!border [&>button]:!border-[var(--border-color)] [&>button]:transition-colors [&>button>svg]:w-4 [&>button>svg]:h-4"
          style={{ maxWidth: '780px', width: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
        >
          {/* ── Header ── */}
          <div style={{ background: 'var(--surface-elevated)', padding: '18px 24px', flexShrink: 0, borderBottom: '1px solid var(--border-color)', borderLeft: '4px solid var(--brand-green-text)' }}>
            <div className="flex items-center gap-3">
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CalendarIcon style={{ width: '18px', height: '18px', color: 'var(--brand-green-text)' }} />
              </div>
              <div>
                <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>New Appointment</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '1px' }}>Schedule a visit for a patient</p>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Patient</p>
                  {/* Client search */}
                  <div style={{ position: 'relative' }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Owner</p>
                    <div style={{ position: 'relative' }}>
                      <Search className="w-4 h-4" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
                      <Input
                        placeholder="Search by name or phone…"
                        value={ownerSearch}
                        onChange={(e) => { setOwnerSearch(e.target.value); setOwnerDropdownOpen(true); if (!e.target.value) { setNewApptClientId(''); setNewApptPetId(''); } }}
                        onFocus={() => setOwnerDropdownOpen(true)}
                        style={{ paddingLeft: '34px' }}
                      />
                      {newApptClientId && (
                        <button onClick={() => { setOwnerSearch(''); setNewApptClientId(''); setNewApptPetId(''); }} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '16px', lineHeight: 1 }}>×</button>
                      )}
                    </div>
                    {ownerDropdownOpen && ownerSearch.length > 0 && !newApptClientId && (() => {
                      const q = ownerSearch.toLowerCase();
                      const filtered = allClients.filter(c =>
                        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
                        (c.phone && c.phone.includes(q)) ||
                        (c.email && c.email.toLowerCase().includes(q))
                      ).slice(0, 8);
                      return (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                          backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)',
                          borderRadius: '8px', marginTop: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                          maxHeight: '200px', overflowY: 'auto',
                        }}>
                          {filtered.length === 0 && (
                            <div style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--text-secondary)' }}>No clients found</div>
                          )}
                          {filtered.map(c => (
                            <button
                              key={c.id}
                              onClick={() => {
                                setNewApptClientId(c.id);
                                setOwnerSearch(`${c.first_name} ${c.last_name}`);
                                setNewApptPetId('');
                                setOwnerDropdownOpen(false);
                              }}
                              style={{
                                width: '100%', padding: '10px 14px', border: 'none', background: 'none',
                                cursor: 'pointer', textAlign: 'left', fontSize: '13px',
                                display: 'flex', alignItems: 'center', gap: '10px',
                                borderBottom: '1px solid var(--border-color)',
                              }}
                              className="hover:bg-[var(--surface-elevated)] transition-colors"
                            >
                              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 12%, transparent)', color: 'var(--brand-green-text)', fontSize: '10px', fontWeight: 700 }}>
                                {(c.first_name?.[0] || '').toUpperCase()}{(c.last_name?.[0] || '').toUpperCase()}
                              </div>
                              <div>
                                <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.first_name} {c.last_name}</p>
                                {c.phone && <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{c.phone}</p>}
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  {/* Pet dropdown — filtered by selected client */}
                  {newApptClientId && (
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Pet</p>
                      <Select value={newApptPetId} onValueChange={(val) => { setNewApptPetId(val); const p = allPets.find(p => p.id === val); if (p) setNewApptPet(p.name); }}>
                        <SelectTrigger><SelectValue placeholder="Select pet…" /></SelectTrigger>
                        <SelectContent>
                          {allPets.filter(p => p.client_id === newApptClientId).map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name} ({p.species}{p.breed ? `, ${p.breed}` : ''})</SelectItem>
                          ))}
                          {allPets.filter(p => p.client_id === newApptClientId).length === 0 && (
                            <SelectItem value="__none" disabled>No pets for this client</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {/* Patient — New (first visit) */}
              {visitType === 'new' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* ── Pet Information ── */}
                  <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Pet Information</p>

                  {/* Pet Photo */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      className="relative group cursor-pointer"
                      onClick={() => npPhotoInputRef.current?.click()}
                      style={{ width: '56px', height: '56px', borderRadius: '9999px', overflow: 'hidden', flexShrink: 0, backgroundColor: 'var(--surface-elevated)', border: '2px dashed var(--border-color)' }}
                    >
                      {npPhotoPreview ? (
                        <img src={npPhotoPreview} alt="Pet" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Camera style={{ width: '20px', height: '20px', color: 'var(--text-secondary)' }} />
                        </div>
                      )}
                      {npPhotoPreview && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: '9999px' }}>
                          <Camera style={{ width: '18px', height: '18px', color: '#fff' }} />
                        </div>
                      )}
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => npPhotoInputRef.current?.click()}
                        style={{ fontSize: '13px', fontWeight: 600, color: 'var(--brand-green-text)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        {npPhotoPreview ? 'Change photo' : 'Add pet photo'}
                      </button>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>JPG, PNG up to 5MB</p>
                    </div>
                    <input
                      ref={npPhotoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setNpPhotoFile(file);
                          setNpPhotoPreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                  </div>

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
                    <WeightPicker value={npWeight} onChange={setNpWeight} />
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Assigned Doctor</p>
                      <Select
                        value={newApptVetId}
                        onValueChange={(id) => {
                          const vet = staffList.find(v => v.id === id);
                          setNewApptVetId(id);
                          setNewApptVetName(vet?.name || '');
                          if (id) fetchVetTimeBlocks(id);
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Select doctor..." /></SelectTrigger>
                        <SelectContent>
                          {staffList.map(v => (
                            <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* ── Owner Information ── */}
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
                      <div>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Street Address</p>
                        <Input placeholder="123 Main St, Apt 4B" value={npAddress} onChange={e => setNpAddress(e.target.value)} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>City</p>
                          <Input placeholder="Springfield" value={npCity} onChange={e => setNpCity(e.target.value)} />
                        </div>
                        <div>
                          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>{npCountry === 'CA' ? 'Province' : 'State'}</p>
                          <Select value={npState} onValueChange={setNpState}>
                            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                            <SelectContent>
                              {(npCountry === 'CA' ? CA_PROVINCES : US_STATES).map(s => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>{npCountry === 'CA' ? 'Postal Code' : 'ZIP Code'}</p>
                          <Input placeholder={npCountry === 'CA' ? 'A1A 1A1' : '12345'} value={npZip} onChange={e => setNpZip(e.target.value)} />
                        </div>
                        <div>
                          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Country</p>
                          <Select value={npCountry} onValueChange={(v) => { setNpCountry(v); setNpState(''); }}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="US">United States</SelectItem>
                              <SelectItem value="CA">Canada</SelectItem>
                            </SelectContent>
                          </Select>
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
                    { label: 'Annual Checkup',  color: 'var(--brand-green-text)', emoji: '🩺' },
                    { label: 'Vaccination',      color: '#3B82F6', emoji: '💉' },
                    { label: 'Dental Cleaning',  color: '#8B5CF6', emoji: '🦷' },
                    { label: 'Surgery',          color: '#EC4899', emoji: '🔬' },
                    { label: 'Follow-up',        color: '#F4A261', emoji: '📋' },
                    { label: 'Emergency',        color: '#d4183d', emoji: '🚨' },
                    { label: 'Consultation',     color: '#06B6D4', emoji: '💬' },
                    { label: 'Other',            color: '#6B7280', emoji: '📝' },
                  ].map(s => {
                    const active = newApptServices.has(s.label);
                    return (
                      <button
                        key={s.label}
                        onClick={() => setNewApptServices(prev => {
                          const next = new Set(prev);
                          if (next.has(s.label)) next.delete(s.label);
                          else next.add(s.label);
                          return next;
                        })}
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

              {/* Veterinarian — moved above Date/Time so user picks vet first to see availability */}
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Veterinarian</p>
                <div className="flex gap-2 flex-wrap">
                  {staffList.length === 0 && <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No vets found</span>}
                  {(() => {
                    // Determine the assigned vet for the currently-selected pet (if any)
                    const selectedPet = newApptPetId ? allPets.find(p => p.id === newApptPetId) : null;
                    const assignedVetId = selectedPet?.assigned_vet_id || null;
                    return staffList.map((v, i) => {
                      const colors = ['var(--brand-green-text)', '#3B82F6', '#8B5CF6', '#EC4899', '#F4A261'];
                      const color = colors[i % colors.length];
                      const active = newApptVetId === v.id;
                      const isAssigned = assignedVetId === v.id;
                      return (
                        <button
                          key={v.id}
                          onClick={() => { setNewApptVetId(v.id); setNewApptVetName(v.name); fetchVetTimeBlocks(v.id); }}
                          title={isAssigned ? `${v.name} is the assigned doctor for this patient` : undefined}
                          style={{
                            position: 'relative',
                            padding: '7px 14px', borderRadius: '8px', fontSize: '13px',
                            fontWeight: active || isAssigned ? 700 : 500,
                            border: `1.5px solid ${active ? color : isAssigned ? `color-mix(in srgb, ${color} 55%, transparent)` : 'var(--border-color)'}`,
                            backgroundColor: active ? `${color}18` : isAssigned ? `${color}10` : 'transparent',
                            color: active ? color : isAssigned ? color : 'var(--text-secondary)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px',
                            transition: 'all 0.15s',
                          }}
                        >
                          <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: `${color}20`, color: color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, flexShrink: 0 }}>
                            {v.initials}
                          </span>
                          {v.name}
                          {isAssigned && (
                            <span
                              className="assigned-vet-star"
                              style={{ color, marginLeft: '2px' }}
                              aria-label="Assigned doctor"
                            >
                              <Star style={{ width: '13px', height: '13px', fill: 'currentColor' }} />
                            </span>
                          )}
                        </button>
                      );
                    });
                  })()}
                </div>
                {(() => {
                  const selectedPet = newApptPetId ? allPets.find(p => p.id === newApptPetId) : null;
                  if (!selectedPet?.assigned_vet_id) return null;
                  const assignedStaff = staffList.find(s => s.id === selectedPet.assigned_vet_id);
                  if (!assignedStaff) return null;
                  return (
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Star style={{ width: '10px', height: '10px', fill: 'currentColor' }} />
                      <span>{assignedStaff.name} is this patient's assigned doctor</span>
                    </p>
                  );
                })()}
              </div>

              {/* Date */}
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Date</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date((newApptDate || new Date().toISOString().slice(0,10)) + 'T12:00:00');
                      d.setDate(d.getDate() - 1);
                      const y = d.getFullYear();
                      const m = String(d.getMonth() + 1).padStart(2, '0');
                      const day = String(d.getDate()).padStart(2, '0');
                      setNewApptDate(`${y}-${m}-${day}`);
                    }}
                    aria-label="Previous day"
                    style={{
                      flexShrink: 0,
                      width: '36px',
                      height: '36px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'transparent',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-elevated)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--brand-green-text)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--brand-green-text)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-color)'; }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <Input type="date" value={newApptDate} onChange={e => setNewApptDate(e.target.value)} />
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date((newApptDate || new Date().toISOString().slice(0,10)) + 'T12:00:00');
                      d.setDate(d.getDate() + 1);
                      const y = d.getFullYear();
                      const m = String(d.getMonth() + 1).padStart(2, '0');
                      const day = String(d.getDate()).padStart(2, '0');
                      setNewApptDate(`${y}-${m}-${day}`);
                    }}
                    aria-label="Next day"
                    style={{
                      flexShrink: 0,
                      width: '36px',
                      height: '36px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'transparent',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-elevated)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--brand-green-text)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--brand-green-text)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-color)'; }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Time — visual slot grid */}
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Time</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {getSlotAvailability(newApptDate, undefined, newApptVetId, newApptShowAllHours ? EXTENDED_SCHEDULE_SLOTS : SCHEDULE_SLOTS).map(slot => {
                    const isActive = newApptTime === slot.time24;
                    const isUnavailable = !!slot.booked || !!slot.blocked;
                    const isHovered = hoveredSlotKey === slot.time24;
                    const bookedAppt = slot.booked;
                    return (
                      <div
                        key={slot.time24}
                        style={{ position: 'relative' }}
                        onMouseEnter={() => setHoveredSlotKey(slot.time24)}
                        onMouseLeave={() => setHoveredSlotKey(prev => prev === slot.time24 ? null : prev)}
                      >
                        <button
                          disabled={isUnavailable}
                          onClick={() => setNewApptTime(slot.time24)}
                          style={{
                            width: '100%',
                            padding: '8px 4px', borderRadius: '8px', fontSize: '12px', fontWeight: isActive ? 700 : 500,
                            border: `1.5px solid ${isActive ? 'var(--brand-green-text)' : isUnavailable ? 'var(--border-color)' : 'var(--border-color)'}`,
                            backgroundColor: isActive ? 'var(--brand-green-text)' : isUnavailable ? 'var(--surface-elevated)' : 'transparent',
                            color: isActive ? '#fff' : isUnavailable ? 'var(--text-secondary)' : 'var(--text-primary)',
                            cursor: isUnavailable ? 'not-allowed' : 'pointer',
                            opacity: isUnavailable ? 0.5 : 1,
                            transition: 'all 0.15s',
                            textDecoration: isUnavailable ? 'line-through' : 'none',
                          }}
                        >
                          {slot.time}
                        </button>
                        {isHovered && isUnavailable && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 'calc(100% + 8px)',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              minWidth: '180px',
                              maxWidth: '240px',
                              padding: '10px 12px',
                              borderRadius: '8px',
                              backgroundColor: 'var(--text-primary)',
                              color: 'var(--surface-white)',
                              fontSize: '11px',
                              lineHeight: 1.4,
                              boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
                              zIndex: 100,
                              pointerEvents: 'none',
                              whiteSpace: 'normal',
                              textAlign: 'left',
                            }}
                          >
                            {bookedAppt ? (
                              <>
                                <div style={{ fontSize: '10px', fontWeight: 700, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Booked</div>
                                <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '2px' }}>{bookedAppt.petName}</div>
                                <div style={{ opacity: 0.85 }}>{bookedAppt.ownerName}</div>
                                {bookedAppt.service && bookedAppt.service !== '—' && (
                                  <div style={{ opacity: 0.85, marginTop: '2px' }}>{bookedAppt.service}</div>
                                )}
                                <div style={{ opacity: 0.7, marginTop: '4px', fontSize: '10px' }}>
                                  {bookedAppt.timeStart}{bookedAppt.timeEnd ? ` – ${bookedAppt.timeEnd}` : ''}
                                  {bookedAppt.vet && bookedAppt.vet !== '—' ? ` · ${bookedAppt.vet}` : ''}
                                </div>
                              </>
                            ) : slot.blocked ? (
                              <>
                                <div style={{ fontSize: '10px', fontWeight: 700, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Unavailable</div>
                                <div style={{ fontWeight: 600 }}>{slot.blocked}</div>
                              </>
                            ) : null}
                            {/* Arrow */}
                            <div
                              style={{
                                position: 'absolute',
                                top: '100%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: 0,
                                height: 0,
                                borderLeft: '6px solid transparent',
                                borderRight: '6px solid transparent',
                                borderTop: '6px solid var(--text-primary)',
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setNewApptShowAllHours(v => !v)}
                  style={{
                    marginTop: '8px',
                    width: '100%',
                    padding: '8px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: '1px dashed var(--border-color)',
                    backgroundColor: 'transparent',
                    color: 'var(--brand-green-text)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--brand-green-text)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-color)'; }}
                >
                  {newApptShowAllHours ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" />
                      Show fewer hours
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      Show more hours (6 AM – 9:30 PM)
                    </>
                  )}
                </button>
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
                        border: `1.5px solid ${active ? 'var(--brand-green-text)' : 'var(--border-color)'}`,
                        backgroundColor: active ? 'color-mix(in srgb, var(--brand-green-text) 9%, transparent)' : 'transparent',
                        color: active ? 'var(--brand-green-text)' : 'var(--text-secondary)',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}>{d}</button>
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
                    <span style={{ fontSize: '13px', color: newApptVetName ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{newApptVetName || 'No vet selected'}</span>
                  </div>
                  {newApptServices.size > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {Array.from(newApptServices).map(svc => (
                        <span key={svc} className="inline-flex items-center gap-1.5" style={{ fontSize: '13px' }}>
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: serviceColors[svc] || '#6B7280' }} />
                          <span style={{ color: 'var(--text-primary)' }}>{svc}</span>
                        </span>
                      ))}
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

              {/* Status & Priority removed — defaults to Confirmed/Normal/Healthy */}

              {/* Notifications */}
              <div style={{ backgroundColor: 'var(--surface-white)', borderRadius: '10px', padding: '14px', border: '1px solid var(--border-color)' }}>
                <div className="flex items-center gap-2" style={{ marginBottom: '14px' }}>
                  <Bell style={{ width: '12px', height: '12px', color: 'var(--text-secondary)' }} />
                  <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Notifications</p>
                </div>

                {/* Confirmation */}
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>Confirmation</p>
                <div className="flex gap-1.5" style={{ marginBottom: '6px' }}>
                  {['Email', 'SMS', 'Both', 'None'].map(m => {
                    const active = confirmMethod === m;
                    return (
                      <button key={m} onClick={() => setConfirmMethod(m)} style={{
                        flex: 1, padding: '4px 2px', borderRadius: '6px', fontSize: '11px',
                        fontWeight: active ? 700 : 400,
                        border: `1.5px solid ${active ? 'var(--brand-green-text)' : 'var(--border-color)'}`,
                        backgroundColor: active ? 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)' : 'transparent',
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

                {/* Reminder */}
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>Reminder</p>
                <div className="flex gap-1.5" style={{ marginBottom: '8px' }}>
                  {['Email', 'SMS', 'Both', 'None'].map(m => {
                    const active = reminderMethod === m;
                    return (
                      <button key={m} onClick={() => setReminderMethod(m)} style={{
                        flex: 1, padding: '4px 2px', borderRadius: '6px', fontSize: '11px',
                        fontWeight: active ? 700 : 400,
                        border: `1.5px solid ${active ? 'var(--brand-green-text)' : 'var(--border-color)'}`,
                        backgroundColor: active ? 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)' : 'transparent',
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
                            border: `1.5px solid ${active ? 'var(--brand-green-text)' : 'var(--border-color)'}`,
                            backgroundColor: active ? 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)' : 'transparent',
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
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={savingAppt}>Cancel</Button>
            <Button
              disabled={savingAppt}
              onClick={async () => {
                if (savingAppt) return;
                if (!newApptDate || !newApptTime) { alert('Please select a date and time.'); return; }
                setSavingAppt(true);
                try {
                  const tzOffset = (() => { const off = new Date().getTimezoneOffset(); const sign = off <= 0 ? '+' : '-'; const h = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0'); const m = String(Math.abs(off) % 60).padStart(2, '0'); return `${sign}${h}:${m}`; })();
                  const scheduled_at = `${newApptDate}T${newApptTime}:00${tzOffset}`;
                  const durationMin = parseInt(newApptDuration) || 30;

                  const orgCtx = await getOrgContext();
                  let finalClientId = newApptClientId;
                  let finalPetId = newApptPetId;

                  // ── New patient: create client + pet first ──────────
                  if (visitType === 'new') {
                    if (!npOwnerName.trim() || !npPetName.trim() || !npSpecies) { alert('Please fill in owner name, pet name, and species.'); setSavingAppt(false); return; }
                    const nameParts = npOwnerName.trim().split(' ');
                    const { data: newClient, error: cErr } = await db
                      .from('clients')
                      .insert([{
                        organization_id: orgCtx.organizationId,
                        first_name: nameParts[0] ?? '',
                        last_name: nameParts.slice(1).join(' ') || '',
                        email: npOwnerEmail || undefined,
                        phone: npOwnerPhone || undefined,
                        address: npAddress || undefined,
                        city: npCity || undefined,
                        state: npState || undefined,
                        zip: npZip || undefined,
                        country: npCountry || 'US',
                        health_status: newApptPetHealth,
                      }])
                      .select('id')
                      .single();
                    if (cErr || !newClient) { alert('Failed to create client: ' + (cErr?.message || 'Unknown error')); setSavingAppt(false); return; }
                    finalClientId = newClient.id;

                    // Upload pet photo if provided
                    let photoUrl: string | undefined;
                    if (npPhotoFile) {
                      try {
                        const fileExt = npPhotoFile.name.split('.').pop() || 'jpg';
                        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
                        const { error: uploadErr } = await supabase.storage
                          .from('pet-images')
                          .upload(fileName, npPhotoFile, { cacheControl: '3600', upsert: false });
                        if (!uploadErr) {
                          const { data: urlData } = supabase.storage.from('pet-images').getPublicUrl(fileName);
                          photoUrl = urlData.publicUrl;
                        }
                      } catch {}
                    }

                    const weightKg = npWeight ? parseFloat(npWeight) : undefined;
                    const { data: newPet, error: pErr } = await db
                      .from('pets')
                      .insert([{
                        client_id: finalClientId,
                        name: npPetName,
                        species: npSpecies,
                        breed: npBreed || undefined,
                        date_of_birth: npDob || undefined,
                        sex: npSex || undefined,
                        weight_kg: weightKg && !isNaN(weightKg) ? weightKg : undefined,
                        photo_url: photoUrl,
                        assigned_vet_id: newApptVetId || undefined,
                        is_active: true,
                      }])
                      .select('id')
                      .single();
                    if (pErr || !newPet) { alert('Failed to create pet: ' + (pErr?.message || 'Unknown error')); setSavingAppt(false); return; }
                    finalPetId = newPet.id;
                  }

                  if (!finalClientId || !finalPetId) { alert('Please select a patient (owner and pet).'); setSavingAppt(false); return; }

                  // Update pet's assigned vet when booking for returning patient
                  if (visitType === 'returning' && newApptVetId && finalPetId) {
                    await db.from('pets').update({ assigned_vet_id: newApptVetId }).eq('id', finalPetId).eq('organization_id', orgCtx.organizationId);
                    window.dispatchEvent(new CustomEvent('petDataChanged'));
                  }

                  await addAppointment({
                    pet_id: finalPetId,
                    client_id: finalClientId,
                    vet_id: newApptVetId || undefined,
                    scheduled_at,
                    duration_minutes: durationMin,
                    reason: newApptServices.size > 0 ? Array.from(newApptServices).join(' + ') : undefined,
                    notes: newApptNotes || undefined,
                    status: newApptStatus,
                  });

                  // Store appointment notification for the assigned vet
                  if (newApptVetId) {
                    try {
                      const petDisplayName = visitType === 'new' ? npPetName : newApptPet;
                      const ownerDisplayName = visitType === 'new' ? npOwnerName : ownerSearch;
                      await db.from('notification_events').upsert({
                        id: `appt-assign-${finalPetId}-${Date.now()}`,
                        type: 'appt_assign',
                        timestamp: new Date().toISOString(),
                        data: {
                          petId: finalPetId,
                          petName: petDisplayName,
                          ownerName: ownerDisplayName,
                          clientId: finalClientId,
                          vetId: newApptVetId,
                          vetName: newApptVetName,
                          service: newApptServices.size > 0 ? Array.from(newApptServices).join(' + ') : 'Appointment',
                          date: newApptDate,
                          time: newApptTime,
                        },
                        organization_id: orgCtx.organizationId,
                      });
                      window.dispatchEvent(new Event('notifCountChanged'));
                    } catch {}
                  }

                  // Reset new patient form fields
                  setNpPetName(''); setNpSpecies(''); setNpBreed(''); setNpSex('');
                  setNpDob(''); setNpWeight('');
                  setNpOwnerName(''); setNpOwnerEmail(''); setNpOwnerPhone('');
                  setNpAddress(''); setNpCity(''); setNpState(''); setNpZip(''); setNpCountry('US');
                  if (npPhotoPreview) URL.revokeObjectURL(npPhotoPreview);
                  setNpPhotoFile(null); setNpPhotoPreview(null);

                  setDialogOpen(false);
                } finally {
                  setSavingAppt(false);
                }
              }}
              style={{ backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)' }}
            >
              <CalendarIcon className="w-4 h-4 mr-1.5" />
              {savingAppt ? 'Saving…' : 'Schedule Appointment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Day Appointments Popup ─────────── */}
      {dayPopupOpen && (() => {
        const popupAppts = apptsByDate[dayPopupDate] || [];
        const popupDateObj = dayPopupDate ? new Date(dayPopupDate + 'T12:00:00') : new Date();
        const dateLabel = popupDateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        return (
          <Dialog open={dayPopupOpen} onOpenChange={setDayPopupOpen}>
            <DialogContent
              className="p-0 overflow-hidden gap-0"
              style={{
                maxWidth: '520px',
                width: '95vw',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '16px',
              }}
            >
              <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)' }}>
                    <CalendarIcon className="w-5 h-5" style={{ color: 'var(--brand-green-text)' }} />
                  </div>
                  <div>
                    <DialogTitle style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{dateLabel}</DialogTitle>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>{popupAppts.length} appointment{popupAppts.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                <div className="space-y-2">
                  {popupAppts.map((appt) => {
                    const sColor = serviceColors[appt.service] || serviceColors.Other || '#6B7280';
                    const st = statusStyles[appt.status] || statusStyles.Pending;
                    return (
                      <div
                        key={appt.id}
                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-[var(--surface-elevated)] transition-colors"
                        style={{ borderRadius: '10px', border: '1px solid var(--border-color)' }}
                        onClick={() => { setDayPopupOpen(false); openApptDetail(appt); }}
                      >
                        <Avatar className="w-9 h-9 flex-shrink-0">
                          <AvatarImage src={appt.petImage} alt={appt.petName} className="object-cover" />
                          <AvatarFallback>{appt.petName.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{appt.petName}</p>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>· {appt.ownerName}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>{appt.timeStart} – {appt.timeEnd}</span>
                            <span style={{ fontSize: '11px', color: sColor, fontWeight: 600 }}>{appt.service}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{appt.vet}</span>
                          <span
                            className="inline-flex items-center px-2 py-0.5"
                            style={{
                              backgroundColor: st.bg,
                              color: st.text,
                              borderRadius: '9999px',
                              fontSize: '10px',
                              fontWeight: 600,
                            }}
                          >
                            {appt.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--border-color)', padding: '12px 16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <Button variant="outline" size="sm" onClick={() => setDayPopupOpen(false)}>Close</Button>
                <Button size="sm" onClick={() => { setDayPopupOpen(false); setViewMode('schedule'); }} style={{ backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)' }}>
                  <LayoutGrid className="w-3.5 h-3.5 mr-1.5" />
                  View Schedule
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* ─── Appointment Detail / Edit Dialog ─────────── */}
      <Dialog open={detailOpen} onOpenChange={(open) => { setDetailOpen(open); if (!open) setDetailMode('view'); }}>
        <DialogContent
          className="p-0 overflow-hidden gap-0 [&>button]:top-[14px] [&>button]:right-[14px] [&>button]:w-8 [&>button]:h-8 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:rounded-[8px] [&>button]:!bg-[var(--surface-white)] [&>button]:!text-[var(--text-secondary)] [&>button]:!opacity-100 [&>button]:hover:!bg-[var(--surface-elevated)] [&>button]:!border [&>button]:!border-[var(--border-color)] [&>button]:transition-colors [&>button>svg]:w-4 [&>button>svg]:h-4"
          style={{
            maxWidth: '512px',
            width: '95vw',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 0 0 1px color-mix(in srgb, var(--brand-green-text) 15%, transparent), 0 8px 32px rgba(0,0,0,0.22), 0 0 60px color-mix(in srgb, var(--brand-green-text) 18%, transparent)',
          }}
        >
          {selectedAppt && (() => {
            const s = statusStyles[selectedAppt.status] || statusStyles.Pending;
            const StatusIcon = s.icon;
            const svcColor = serviceColors[selectedAppt.service] || 'var(--text-secondary)';
            const durationMin = getDurationMin(selectedAppt.timeStart, selectedAppt.timeEnd);
            const canCheckIn = selectedAppt.status === 'Confirmed' || selectedAppt.status === 'Pending';
            const isActive = selectedAppt.status === 'In Progress';
            const isDone = selectedAppt.status === 'Completed' || selectedAppt.status === 'Cancelled';

            return (
              <>
                {/* ── Header strip (matches New Appointment pattern) ── */}
                <div
                  className="flex items-center gap-4 flex-shrink-0"
                  style={{
                    background: 'var(--surface-elevated)',
                    padding: '18px 64px 18px 24px',
                    borderBottom: '1px solid var(--border-color)',
                    borderLeft: '4px solid var(--brand-green-text)',
                  }}
                >
                  <Avatar
                    className="w-11 h-11 flex-shrink-0"
                    style={{ border: '1px solid var(--border-color)' }}
                  >
                    <AvatarImage src={selectedAppt.petImage} alt={selectedAppt.petName} className="object-cover" />
                    <AvatarFallback className="text-base font-bold">{selectedAppt.petName.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, margin: 0 }}>
                      {selectedAppt.petName}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {selectedAppt.ownerName} · {selectedAppt.timeStart}
                    </p>
                  </div>
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1"
                    style={{
                      backgroundColor: s.bg,
                      color: s.text,
                      borderRadius: '9999px',
                      fontSize: '11px',
                      fontWeight: 600,
                      border: `1px solid color-mix(in srgb, ${s.text} 25%, transparent)`,
                    }}
                  >
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
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'color-mix(in srgb, var(--brand-green-text) 9%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><CalendarIcon style={{ width: 15, height: 15, color: 'var(--brand-green-text)' }} /></div>
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
                      {selectedAppt.room && (
                        <div className="flex items-center gap-3 p-3" style={{ borderRadius: '10px', backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--brand-green-text) 20%, transparent)' }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'color-mix(in srgb, var(--brand-green-text) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><DoorOpen style={{ width: 15, height: 15, color: 'var(--brand-green-text)' }} /></div>
                          <div><p className="text-[var(--text-secondary)]" style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Assigned Room</p><p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--brand-green-text)' }}>{selectedAppt.room}</p></div>
                        </div>
                      )}
                      {selectedAppt.notes && (
                        <div className="p-3 bg-[var(--surface-elevated)]" style={{ borderRadius: '10px' }}>
                          <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Notes</p>
                          <p className="text-[var(--text-primary)]" style={{ fontSize: '13px', lineHeight: 1.5 }}>{selectedAppt.notes}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-[var(--border-color)] flex-shrink-0">
                      <div className="flex gap-2">
                        {!isDone && (
                          <Button variant="outline" size="sm" onClick={handleCancelAppt} className="text-[#d4183d] border-[#d4183d] hover:bg-[#d4183d10] hover:text-[#d4183d]">
                            <XCircle className="w-3.5 h-3.5 mr-1.5" />Cancel
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={handleDeleteAppt} className="text-[#d4183d] border-[#d4183d] hover:bg-[#d4183d10] hover:text-[#d4183d]">
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />Delete
                        </Button>
                      </div>
                      <div className="flex gap-2 ml-auto">
                        <Button variant="outline" size="sm" onClick={() => setDetailMode('edit')}><Pencil className="w-3.5 h-3.5 mr-1.5" />Edit</Button>
                        {isActive && (
                          <Button size="sm" onClick={() => {
                            startVisit({
                              apptId: selectedAppt.id,
                              petName: selectedAppt.petName || selectedAppt.pet || '',
                              petImage: selectedAppt.petImage,
                              ownerName: selectedAppt.ownerName || selectedAppt.owner || '',
                              service: selectedAppt.service || selectedAppt.type || '',
                              durationMinutes: parseInt(selectedAppt.duration) || 30,
                            });
                            setDetailOpen(false);
                            navigate(`/appointments/${selectedAppt.id}/visit`);
                          }} style={{ background: 'var(--brand-green-text)', color: 'var(--on-brand-green)', border: 'none' }} className="hover:opacity-90">
                            <ClipboardList className="w-3.5 h-3.5 mr-1.5" />Open Visit Form
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
                              {getSlotAvailability(editDate, selectedAppt?.id, selectedAppt?.vetId).map((slot) => (
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

      {/* ─── Room Info Dialog with Floor Plan ─── */}
      <Dialog open={roomInfoOpen} onOpenChange={(v) => { if (!v) { setRoomInfoOpen(false); setRoomInfoAppt(null); } }}>
        <DialogContent
          className="p-0 overflow-hidden gap-0 [&>button]:top-[14px] [&>button]:right-[14px] [&>button]:w-8 [&>button]:h-8 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:rounded-[8px] [&>button]:!bg-[var(--surface-white)] [&>button]:!text-[var(--text-secondary)] [&>button]:!opacity-100 [&>button]:hover:!bg-[var(--surface-elevated)] [&>button]:!border [&>button]:!border-[var(--border-color)] [&>button]:transition-colors [&>button>svg]:w-4 [&>button>svg]:h-4"
          style={{ maxWidth: 640, width: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
        >
          {roomInfoAppt && (() => {
            const cols = clinicRooms.reduce((mx, r) => Math.max(mx, r.pos_x + r.width), 0);
            const rowsCount = clinicRooms.reduce((mx, r) => Math.max(mx, r.pos_y + r.height), 0);
            const CANVAS_W = 560;
            const cellPx = cols > 0 ? Math.max(14, Math.min(28, Math.floor(CANVAS_W / Math.max(cols, 12)))) : 22;
            const canvasW = (cols || 12) * cellPx;
            const canvasH = (rowsCount || 8) * cellPx;
            // Find the target room by name match
            const targetRoom = clinicRooms.find(r => r.name === roomInfoAppt.room);

            return (
              <>
                {/* Header */}
                <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 14, background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-green-text) 10%, transparent), transparent 60%)' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 14%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <DoorOpen style={{ width: 18, height: 18, color: 'var(--brand-green-text)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      Go to <span style={{ color: 'var(--brand-green-text)' }}>{roomInfoAppt.room}</span>
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                      {roomInfoAppt.petName} ({roomInfoAppt.ownerName}) is waiting &middot; {roomInfoAppt.service}
                    </p>
                  </div>
                </div>

                {/* Floor Plan */}
                <div style={{ padding: '16px 22px', overflowY: 'auto' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>
                    Floor Plan
                  </p>
                  {roomsLoading ? (
                    <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <Loader2 className="animate-spin" style={{ width: 18, height: 18, margin: '0 auto 8px' }} />
                      <p style={{ fontSize: 12, margin: 0 }}>Loading rooms...</p>
                    </div>
                  ) : clinicRooms.length === 0 ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-secondary)', border: '1.5px dashed var(--border-color)', borderRadius: 12 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>No floor plan available</p>
                    </div>
                  ) : (
                    <div
                      style={{
                        position: 'relative', width: canvasW, height: canvasH, margin: '0 auto',
                        backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: 10,
                        backgroundImage: `linear-gradient(to right, color-mix(in srgb, var(--border-color) 50%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--border-color) 50%, transparent) 1px, transparent 1px)`,
                        backgroundSize: `${cellPx}px ${cellPx}px`,
                      }}
                    >
                      {clinicRooms.map((room) => {
                        const cfg = ROOM_TYPES[room.type] ?? ROOM_TYPES.other;
                        const Icon = cfg.icon;
                        const isTarget = targetRoom?.id === room.id;
                        const baseColor = isTarget ? 'var(--brand-green-text)' : '#94A3B8';
                        const baseBg = isTarget
                          ? 'color-mix(in srgb, var(--brand-green-text) 18%, transparent)'
                          : 'color-mix(in srgb, #94A3B8 8%, transparent)';
                        const borderColor = isTarget
                          ? 'var(--brand-green-text)'
                          : 'color-mix(in srgb, #94A3B8 35%, transparent)';

                        return (
                          <div
                            key={room.id}
                            style={{
                              position: 'absolute',
                              left: room.pos_x * cellPx, top: room.pos_y * cellPx,
                              width: room.width * cellPx, height: room.height * cellPx,
                              backgroundColor: baseBg,
                              border: `2px solid ${borderColor}`,
                              borderRadius: 6, padding: '4px 6px',
                              display: 'flex', flexDirection: 'column',
                              alignItems: 'flex-start', justifyContent: 'space-between',
                              overflow: 'hidden',
                              opacity: isTarget ? 1 : 0.45,
                              animation: isTarget ? 'roomPulse 1.5s ease-in-out infinite' : 'none',
                              boxShadow: isTarget ? '0 0 12px color-mix(in srgb, var(--brand-green-text) 40%, transparent)' : 'none',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, width: '100%' }}>
                              <Icon style={{ width: 11, height: 11, color: baseColor, flexShrink: 0 }} />
                              <span style={{ fontSize: 10, fontWeight: 700, color: isTarget ? 'var(--text-primary)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.1 }}>
                                {room.name}
                              </span>
                            </div>
                            {isTarget ? (
                              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--brand-green-text)', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.1 }}>
                                Go Here
                              </span>
                            ) : (
                              <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.1, opacity: 0.7 }}>
                                {cfg.label}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)' }}>
                  <Button
                    className="w-full hover:opacity-90"
                    onClick={() => proceedToVisit(roomInfoAppt)}
                    style={{
                      backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)', border: 'none',
                      height: 42, fontSize: 14, fontWeight: 600,
                      boxShadow: '0 0 16px color-mix(in srgb, var(--brand-green-text) 50%, transparent)',
                    }}
                  >
                    <Stethoscope className="w-4 h-4 mr-2" />
                    Start Visit
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ─────────── */}
      <Dialog open={deleteConfirmOpen} onOpenChange={(open) => { if (deleting) return; setDeleteConfirmOpen(open); if (!open) setDeleteError(null); }}>
        <DialogContent
          className="p-0 overflow-hidden gap-0 [&>button]:top-[14px] [&>button]:right-[14px] [&>button]:w-8 [&>button]:h-8 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:rounded-[8px] [&>button]:!bg-[var(--surface-white)] [&>button]:!text-[var(--text-secondary)] [&>button]:!opacity-100 [&>button]:hover:!bg-[var(--surface-elevated)] [&>button]:!border [&>button]:!border-[var(--border-color)] [&>button]:transition-colors [&>button>svg]:w-4 [&>button>svg]:h-4"
          style={{
            maxWidth: '440px',
            width: '95vw',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ background: 'var(--surface-elevated)', padding: '18px 24px', borderBottom: '1px solid var(--border-color)', borderLeft: '4px solid #d4183d' }}>
            <DialogHeader className="p-0 space-y-1">
              <DialogTitle className="text-[var(--text-primary)]" style={{ fontSize: 16, fontWeight: 600 }}>
                Delete appointment?
              </DialogTitle>
              <p className="text-[var(--text-secondary)]" style={{ fontSize: 13 }}>
                This permanently removes the appointment and any related visit records. This cannot be undone.
              </p>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-3">
            {selectedAppt && (
              <div className="p-3 rounded-[10px]" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-color)' }}>
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={selectedAppt.petImage} alt={selectedAppt.petName} />
                    <AvatarFallback>{selectedAppt.petName?.[0] ?? '?'}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-[var(--text-primary)] truncate" style={{ fontSize: 14, fontWeight: 600 }}>
                      {selectedAppt.petName} · {selectedAppt.service}
                    </p>
                    <p className="text-[var(--text-secondary)] truncate" style={{ fontSize: 12 }}>
                      {selectedAppt.date} · {selectedAppt.timeStart} – {selectedAppt.timeEnd} · {selectedAppt.vet}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {deleteError && (
              <div className="p-3 rounded-[10px] flex items-start gap-2" style={{ background: '#d4183d12', border: '1px solid #d4183d40' }}>
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#d4183d' }} />
                <p style={{ fontSize: 12, color: '#d4183d', lineHeight: 1.4 }}>{deleteError}</p>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-[var(--border-color)] flex-shrink-0 sm:justify-end gap-2">
            <Button variant="outline" size="sm" disabled={deleting} onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={deleting}
              onClick={performDeleteAppt}
              style={{ background: '#d4183d', color: '#ffffff', border: 'none' }}
              className="hover:opacity-90"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
