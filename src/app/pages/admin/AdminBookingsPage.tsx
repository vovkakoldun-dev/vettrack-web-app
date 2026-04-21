import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  Plus, Search, Clock, User, Calendar as CalendarIcon,
  CheckCircle2, AlertCircle, XCircle,
  ChevronLeft, ChevronRight, LayoutList, LayoutGrid, CalendarDays,
  Pencil, Trash2, Bell, Stethoscope, UserCheck,
  Smartphone, ChevronDown, ChevronUp, Phone, MessageCircle, X,
  CreditCard, Receipt, DollarSign, Banknote, DoorOpen,
  Scissors, Microscope, Bed, Briefcase, Bath, Coffee, Sparkles, Building2, Loader2, Camera, Star, SlidersHorizontal,
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
import { useTenantDb } from '../../context/TenantContext';
import { getOrgContext } from '../../hooks/useOrgContext';
import { useClients } from '../../hooks/useClients';
import { usePets } from '../../hooks/usePets';
import { WeightPicker, US_STATES, CA_PROVINCES } from '../../components/AddClientDialog';
import { supabase } from '../../../lib/supabase';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripePromise, isStripeConfigured } from '../../../lib/stripe';

// ─── Stripe Card Form (inner component for Elements context) ──
function BookingsStripeCardForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setProcessing(true);
    setError(null);
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {},
      redirect: 'if_required',
    });
    if (result.error) {
      setError(result.error.message || 'Payment failed');
      setProcessing(false);
    } else {
      setSucceeded(true);
      setProcessing(false);
      window.dispatchEvent(new CustomEvent('stripePaymentSuccess', { detail: { paymentIntent: result.paymentIntent } }));
    }
  };

  if (succeeded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0' }}>
        <CheckCircle2 style={{ width: 18, height: 18, color: '#22C55E' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: '#22C55E' }}>Card payment successful!</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ padding: '12px', borderRadius: 8, border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-white)' }}>
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>
      {error && (
        <div style={{ padding: '8px 12px', borderRadius: 8, backgroundColor: '#d4183d15', border: '1px solid #d4183d30' }}>
          <p style={{ fontSize: 12, color: '#d4183d', margin: 0 }}>{error}</p>
        </div>
      )}
      <button
        onClick={handleSubmit}
        disabled={!stripe || processing}
        style={{
          width: '100%', padding: '12px', borderRadius: 8, border: 'none',
          cursor: processing ? 'not-allowed' : 'pointer',
          backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)', fontSize: 14, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          opacity: processing ? 0.7 : 1, transition: 'opacity 0.15s',
        }}
      >
        {processing ? (
          <><Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> Processing...</>
        ) : (
          <><CreditCard style={{ width: 16, height: 16 }} /> Pay with Card</>
        )}
      </button>
    </div>
  );
}

// ─── Status Styles ───────────────────────────────────────────

const statusStyles: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  Scheduled: { bg: '#06B6D420', text: '#06B6D4', icon: CalendarIcon },
  Confirmed: { bg: '#74C69D20', text: 'var(--brand-green-text)', icon: CheckCircle2 },
  Pending: { bg: '#F4A26120', text: '#F4A261', icon: AlertCircle },
  'Checked In': { bg: '#F59E0B20', text: '#F59E0B', icon: UserCheck },
  'Waiting for Doctor': { bg: '#F59E0B20', text: '#F59E0B', icon: UserCheck },
  'In Progress': { bg: '#3B82F620', text: '#3B82F6', icon: Stethoscope },
  Completed: { bg: '#6B728020', text: 'var(--text-secondary)', icon: CheckCircle2 },
  Cancelled: { bg: '#d4183d20', text: '#d4183d', icon: XCircle },
  'No Show': { bg: '#64748B20', text: '#64748B', icon: AlertCircle },
  Paid: { bg: '#74C69D20', text: 'var(--brand-green-text)', icon: CheckCircle2 },
};

const serviceColors: Record<string, string> = {
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

// ─── Floor-plan Rooms (mirrors SuperAdminClinicsPage) ───────
type RoomTypeKey =
  | 'exam' | 'surgery' | 'reception' | 'lab' | 'kennel'
  | 'office' | 'restroom' | 'lobby' | 'storage' | 'other';

interface RoomTypeConfig {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}

const ROOM_TYPES: Record<RoomTypeKey, RoomTypeConfig> = {
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
  id: string;
  clinic_id: string;
  name: string;
  type: RoomTypeKey;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  color: string | null;
}

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

// Generate 30-min slots for the full 24-hour day (12:00 AM – 11:30 PM)
const SCHEDULE_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const totalMin = i * 30;
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

const FILTER_TABS = ['All', 'Upcoming', 'Completed', 'Cancelled', 'No Show'] as const;
type FilterTab = typeof FILTER_TABS[number];

// ─── Component ───────────────────────────────────────────────

export interface AdminBookingsPageProps {
  /** When true, hide the page's own "Bookings" header (used when embedded in another page like SuperAdminAppointmentsPage). */
  hideHeader?: boolean;
  /** Override the wrapper classes (e.g. remove padding when embedded). */
  wrapperClassName?: string;
}

export default function AdminBookingsPage({ hideHeader = false, wrapperClassName }: AdminBookingsPageProps = {}) {
  const db = useTenantDb();
  const navigate = useNavigate();
  const location = useLocation();
  const { appointments: supaAppts, loading: apptsLoading, updateStatus: updateApptStatus, updateStatusWithRoom, deleteAppointment, addAppointment } = useAppointments();
  const { clients: allClients } = useClients();
  const { pets: allPets } = usePets();
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterService, setFilterService] = useState<string>('all');
  const [filterSpecies, setFilterSpecies] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'schedule' | 'month'>('list');
  const [showAllDates, setShowAllDates] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const [monthViewDate, setMonthViewDate] = useState<Date>(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [newApptTime, setNewApptTime] = useState('');
  const [newApptDate, setNewApptDate] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });

  // Map Supabase AppointmentRow[] → the shape expected by existing UI.
  // scheduled_at is a real UTC instant (saved with the user's local tz offset),
  // so use LOCAL methods to read it back — that returns the same wall-clock
  // date/time the user originally picked, regardless of how Postgres stored it.
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
        vet: a.staff?.profiles ? `Dr. ${a.staff.profiles.first_name} ${a.staff.profiles.last_name}` : '—',
        vetId: a.staff?.id ?? '',
        petId: a.pets?.id ?? '',
        clientId: a.clients?.id ?? '',
        status: a.status as string,
        notes: a.notes ?? '',
        durationMinutes: dur,
        room: a.clinic_rooms?.name ?? a.room ?? null,
        roomId: a.room_id ?? null,
      };
    }),
    [supaAppts],
  );

  // Load actually-paid appointment IDs (only invoices with status 'Paid')
  useEffect(() => {
    (async () => {
      const completedIds = supaAppts.filter((a) => a.status === 'Completed').map((a) => a.id);
      if (completedIds.length === 0) { setPaidApptIds(new Set()); return; }
      const { data } = await db
        .from('invoices')
        .select('appointment_id')
        .in('appointment_id', completedIds)
        .eq('status', 'Paid');
      setPaidApptIds(new Set((data || []).map((d: any) => d.appointment_id)));
    })();
  }, [supaAppts]);

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
  // Auto-detect no-shows: if 1h has passed since appointment start and patient
  // hasn't arrived (still Scheduled/Confirmed/Pending), mark as No Show.
  const noShowIdsRef = useRef(new Set<string>());
  useEffect(() => {
    const pending = appointments.filter(
      (a) =>
        (a.status === 'Scheduled' || a.status === 'Confirmed' || a.status === 'Pending') &&
        !noShowIdsRef.current.has(a.id),
    );
    if (pending.length === 0) return;

    const now = new Date();
    pending.forEach((appt) => {
      // Parse "3:30 PM" style timeStart + date into a real Date
      const [tp, ap] = appt.timeStart.split(' ');
      let [h, m] = tp.split(':').map(Number);
      if (ap === 'PM' && h !== 12) h += 12;
      if (ap === 'AM' && h === 12) h = 0;
      const apptDate = new Date(appt.date + 'T00:00:00');
      apptDate.setHours(h, m, 0, 0);
      const elapsed = now.getTime() - apptDate.getTime();
      if (elapsed >= 60 * 60 * 1000) {
        noShowIdsRef.current.add(appt.id);
        updateApptStatus(appt.id, 'No Show');
      }
    });
  }, [appointments, updateApptStatus]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [arrivedToast, setArrivedToast] = useState<string | null>(null);
  // Payment checkout dialog
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAppt, setPaymentAppt] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'insurance'>('card');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [paidApptIds, setPaidApptIds] = useState<Set<string>>(new Set());
  const [detailMode, setDetailMode] = useState<'view' | 'edit'>('view');
  const [selectedAppt, setSelectedAppt] = useState<Record<string, unknown> | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editService, setEditService] = useState('');
  const [editVet, setEditVet] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [dayPopupOpen, setDayPopupOpen] = useState(false);
  const [dayPopupDate, setDayPopupDate] = useState('');
  const [dayPopupVet, setDayPopupVet] = useState('all');

  // ── Room selection dialog ─────────────────────────────────────
  // Real rooms come from `clinic_rooms` (created in SuperAdmin → Clinics → Floor Plan).
  const [clinicRooms, setClinicRooms] = useState<ClinicRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomSelectOpen, setRoomSelectOpen] = useState(false);
  const [roomSelectAppt, setRoomSelectAppt] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setRoomsLoading(true);
        const { organizationId, clinicId } = await getOrgContext();
        let q = db
          .from('clinic_rooms')
          .select('id, clinic_id, name, type, pos_x, pos_y, width, height, color')
          .eq('organization_id', organizationId);
        if (clinicId) q = q.eq('clinic_id', clinicId);
        const { data, error } = await q.order('sort_order', { ascending: true });
        if (!alive) return;
        if (error) {
          console.error('[bookings] clinic_rooms load failed:', error.message);
          setClinicRooms([]);
        } else {
          setClinicRooms((data ?? []) as ClinicRoom[]);
        }
      } catch (e) {
        if (alive) setClinicRooms([]);
      } finally {
        if (alive) setRoomsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [db]);

  // For each room, find an appointment that is currently using it.
  // A room is busy when:
  //   (a) An "In Progress" appointment is in it (patient is physically there now), OR
  //   (b) A Confirmed/Pending appointment with that room is scheduled at a time
  //       that overlaps the appointment we're about to assign.
  // Map key = clinic_rooms.id (so duplicate names don't collide).
  const busyRoomMap = useMemo(() => {
    const map = new Map<string, { petName: string; ownerName: string; timeStart: string; timeEnd: string; reason: 'in_progress' | 'overlap' }>();
    if (!roomSelectAppt) return map;

    const toMin = (t: string) => {
      const [tp, ap] = t.split(' ');
      let [h, m] = tp.split(':').map(Number);
      if (ap === 'PM' && h !== 12) h += 12;
      if (ap === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    };

    const targetStart = toMin(roomSelectAppt.timeStart);
    const targetEnd = toMin(roomSelectAppt.timeEnd);

    appointments.forEach((a) => {
      if (!a.roomId) return;
      if (a.id === roomSelectAppt.id) return;
      // (a) A "Checked In" or "In Progress" appointment holds its room — but only if its end time hasn't passed.
      if (a.status === 'In Progress' || a.status === 'Checked In') {
        const endMin = toMin(a.timeEnd);
        const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
        const isToday = a.date === roomSelectAppt.date;
        if (!isToday || endMin < nowMin) return; // Stale — don't block room
        map.set(a.roomId, {
          petName: a.petName,
          ownerName: a.ownerName,
          timeStart: a.timeStart,
          timeEnd: a.timeEnd,
          reason: 'in_progress',
        });
        return;
      }
      // (b) Confirmed/Pending: only mark busy if time windows overlap on the same date.
      if (a.status !== 'Confirmed' && a.status !== 'Pending') return;
      if (a.date !== roomSelectAppt.date) return;
      const aStart = toMin(a.timeStart);
      const aEnd = toMin(a.timeEnd);
      const overlaps = aStart < targetEnd && aEnd > targetStart;
      if (overlaps && !map.has(a.roomId)) {
        map.set(a.roomId, {
          petName: a.petName,
          ownerName: a.ownerName,
          timeStart: a.timeStart,
          timeEnd: a.timeEnd,
          reason: 'overlap',
        });
      }
    });
    return map;
  }, [appointments, roomSelectAppt]);

  // ── Doctor filter ──────────────────────────────────────────
  const [selectedVetFilter, setSelectedVetFilter] = useState('all');
  const [staffList, setStaffList] = useState<{ id: string; name: string; initials: string }[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const { organizationId } = await getOrgContext();
        const { data } = await db.from('staff').select('id, role, profiles:profiles!staff_profile_id_fkey(first_name, last_name)').eq('organization_id', organizationId).in('role', ['veterinarian', 'senior_veterinarian', 'specialist']).eq('status', 'Active').order('first_name');
        if (data) setStaffList(data.map((s: any) => {
          const fn = s.profiles?.first_name || '';
          const ln = s.profiles?.last_name || '';
          return {
            id: s.id,
            name: `Dr. ${fn} ${ln}`.trim(),
            initials: `${(fn[0] ?? '').toUpperCase()}${(ln[0] ?? '').toUpperCase()}`,
          };
        }));
      } catch (err) {
        console.error('[AdminBookings] Failed to load staff list:', err);
      }
    })();
  }, []);

  // ── New Appointment form state ──────────────────────────────
  const [newApptPet, setNewApptPet] = useState('');
  const [newApptService, setNewApptService] = useState('');
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
  const [newApptClientId, setNewApptClientId] = useState('');
  const [newApptPetId, setNewApptPetId] = useState('');
  const [ownerSearch, setOwnerSearch] = useState('');
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false);
  const [newApptVetId, setNewApptVetId] = useState('');
  const [savingAppt, setSavingAppt] = useState(false);
  const [vetTimeBlocks, setVetTimeBlocks] = useState<{ date: string; time_start: string; time_end: string; type: string }[]>([]);

  // ── Portal requests ──────────────────────────────
  const [portalRequests, setPortalRequests] = useState<PortalRequest[]>([]);
  const [portalPanelOpen, setPortalPanelOpen] = useState(true);
  const [changeTimeReq, setChangeTimeReq] = useState<PortalRequest | null>(null);
  const [changeTimeDate, setChangeTimeDate] = useState('');
  const [changeTimeTime, setChangeTimeTime] = useState('');
  const [changeTimeVet, setChangeTimeVet] = useState('');
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
      const s = state as any;
      setTimeout(() => openNewApptDialog(s.prefillVetId, s.prefillVetName, s.prefillDate), 0);
    }

    window.history.replaceState({}, '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset list pagination whenever user changes filters or date range. Without
  // this, switching from "All" (lots of rows) to "Cancelled" (few rows) leaves
  // a stale visibleCount that hides the Load-more button and can leave blank
  // space at the bottom of the list.
  useEffect(() => {
    setVisibleCount(10);
  }, [activeFilter, selectedVetFilter, searchQuery, selectedDate, showAllDates, viewMode]);

  const datesWithAppointments = getDatesWithAppointments(appointments);

  const dayAppointments = showAllDates
    ? [...appointments]
        .filter((a) => selectedVetFilter === 'all' || (a as any).vetId === selectedVetFilter)
        .sort((a, b) => {
          const dir = sortOrder === 'oldest' ? 1 : -1;
          return dir * (a.date.localeCompare(b.date) || a.timeStart.localeCompare(b.timeStart));
        })
    : appointments.filter((a) => {
        if (!isSameDay(a.date, selectedDate)) return false;
        if (selectedVetFilter !== 'all' && (a as any).vetId !== selectedVetFilter) return false;
        return true;
      });

  // Unfiltered day appointments for "Vets on Duty" sidebar — ignores vet/status filters
  const dayAppointmentsUnfiltered = useMemo(() =>
    appointments.filter((a) => isSameDay(a.date, selectedDate)),
    [appointments, selectedDate],
  );

  const filteredByStatus = dayAppointments.filter((a) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Upcoming') {
      return (
        a.status === 'Scheduled' ||
        a.status === 'Confirmed' ||
        a.status === 'Pending' ||
        a.status === 'Checked In' ||
        a.status === 'In Progress'
      );
    }
    return a.status === activeFilter;
  });

  const filteredByVet = filteredByStatus.filter((a) => {
    if (selectedVetFilter === 'all') return true;
    return (a as any).vetId === selectedVetFilter;
  });

  const filteredByPanel = filteredByVet.filter((a) => {
    if (filterService !== 'all' && a.service !== filterService) return false;
    if (filterSpecies !== 'all' && a.species !== filterSpecies) return false;
    return true;
  });

  const filteredAppointments = filteredByPanel.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.petName.toLowerCase().includes(q) ||
      a.ownerName.toLowerCase().includes(q) ||
      a.service.toLowerCase().includes(q) ||
      a.vet.toLowerCase().includes(q)
    );
  });

  // Derive unique services & species for filter dropdowns
  const uniqueServices = useMemo(() => [...new Set(appointments.map(a => a.service))].sort(), [appointments]);
  const uniqueSpecies = useMemo(() => [...new Set(appointments.map(a => a.species).filter(Boolean))].sort(), [appointments]);
  const hasActiveFilters = selectedVetFilter !== 'all' || filterService !== 'all' || filterSpecies !== 'all' || sortOrder !== 'newest';

  const totalToday = dayAppointments.length;
  const completedToday = dayAppointments.filter((a) => a.status === 'Completed').length;
  const cancelledToday = dayAppointments.filter((a) => a.status === 'Cancelled' || a.status === 'No Show').length;
  const remainingToday = totalToday - completedToday - cancelledToday;
  const scheduledCount = dayAppointments.filter(
    (a) =>
      a.status === 'Scheduled' ||
      a.status === 'Confirmed' ||
      a.status === 'Pending' ||
      a.status === 'Checked In' ||
      a.status === 'In Progress',
  ).length;
  // Group appointments by time slot (multiple doctors can have bookings at same time)
  const appointmentsByTime = new Map<string, typeof dayAppointments>();
  dayAppointments.forEach((a) => {
    const existing = appointmentsByTime.get(a.timeStart) || [];
    existing.push(a);
    appointmentsByTime.set(a.timeStart, existing);
  });

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
    if (selectedVetFilter !== 'all' && (appt as any).vetId !== selectedVetFilter) return acc;
    (acc[appt.date] = acc[appt.date] || []).push(appt);
    return acc;
  }, {});
  const isCurrentMonthView = monthViewDate.getMonth() === new Date().getMonth() && monthViewDate.getFullYear() === new Date().getFullYear();
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const openNewApptDialog = (prefillVetId?: string, prefillVetName?: string, prefillDate?: string) => {
    const y = selectedDate.getFullYear();
    const m = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
    const d = selectedDate.getDate().toString().padStart(2, '0');
    setNewApptDate(prefillDate || `${y}-${m}-${d}`);
    setNewApptTime('');
    setNewApptClientId('');
    setNewApptPetId('');
    setNewApptPet('');
    setOwnerSearch('');
    setNewApptService('');
    setNewApptNotes('');
    setNewApptVetId(prefillVetId || '');
    setNewApptVetName(prefillVetName || '');
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
    if (prefillVetId) fetchVetTimeBlocks(prefillVetId);
    setDialogOpen(true);
  };

  const openSlotBooking = (slotLabel: string) => {
    setNewApptTime(to24Hour(slotLabel));
    const y = selectedDate.getFullYear();
    const m = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
    const d = selectedDate.getDate().toString().padStart(2, '0');
    setNewApptDate(`${y}-${m}-${d}`);
    setNewApptClientId('');
    setNewApptPetId('');
    setNewApptPet('');
    setOwnerSearch('');
    setNewApptService('');
    setNewApptNotes('');
    setNewApptVetId('');
    setNewApptVetName('');
    setDialogOpen(true);
  };

  const fetchVetTimeBlocks = async (vetId: string) => {
    if (!vetId) { setVetTimeBlocks([]); return; }
    const { data } = await db
      .from('staff_time_blocks')
      .select('date, time_start, time_end, type')
      .eq('staff_id', vetId);
    setVetTimeBlocks(data || []);
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
    setRoomSelectAppt(selectedAppt);
    setDetailOpen(false);
    setRoomSelectOpen(true);
  };

  const handleRoomConfirm = async (room: { id: string; name: string }) => {
    if (!roomSelectAppt) return;
    setRoomSelectOpen(false);

    // Update local override — keep the original scheduled time intact.
    // The patient arriving sets status to "Checked In" (waiting for doctor).
    // Only the doctor clicking "Start Visit" moves it to "In Progress".
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === roomSelectAppt.id
          ? { ...a, status: 'Checked In' as const, room: room.name, roomId: room.id }
          : a,
      ),
    );
    await updateStatusWithRoom(roomSelectAppt.id, 'Checked In', room.name, undefined, room.id);

    // Send notification to the assigned doctor
    if (roomSelectAppt.vetId) {
      try {
        const { organizationId } = await getOrgContext();
        await db.from('notification_events').insert({
          id: `patient-arrived-${roomSelectAppt.id}-${Date.now()}`,
          organization_id: organizationId,
          type: 'patient_arrived',
          timestamp: new Date().toISOString(),
          data: {
            vetId: roomSelectAppt.vetId,
            petName: roomSelectAppt.petName,
            ownerName: roomSelectAppt.ownerName,
            room: room.name,
            service: roomSelectAppt.service,
            timeStart: roomSelectAppt.timeStart,
            appointmentId: roomSelectAppt.id,
          },
        });
      } catch (err) {
        console.error('Failed to send arrival notification:', err);
      }
    }

    setArrivedToast(`${roomSelectAppt.petName} (${roomSelectAppt.ownerName}) has arrived → assigned to ${room.name}. ${roomSelectAppt.vet || 'Vet'} has been notified.`);
    setTimeout(() => setArrivedToast(null), 5000);
    setRoomSelectAppt(null);
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
    updateApptStatus(selectedAppt.id, 'Cancelled');
    setDetailOpen(false);
  };

  const handleDeleteAppt = () => {
    if (!selectedAppt) return;
    setConfirmDeleteOpen(true);
  };

  const confirmDeleteAppt = async () => {
    if (!selectedAppt) return;
    const { error } = await deleteAppointment(selectedAppt.id);
    if (error) {
      alert(`Failed to delete: ${error.message}`);
    } else {
      setConfirmDeleteOpen(false);
      setDetailOpen(false);
    }
  };

  const getSlotAvailability = (dateStr: string, excludeId?: string, vetId?: string, slotsList: readonly string[] = SCHEDULE_SLOTS) => {
    // A slot is only "booked" if the SAME vet already has an appointment there.
    // Two different vets can hold the same time slot independently.
    // If no vet is selected, we can't detect conflicts yet — show all slots as available.
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
    const bookedTimes = new Map<string, typeof appointments[0]>();
    dateAppts.forEach((a) => {
      const t24 = to24Hour(a.timeStart);
      const [sh, sm] = t24.split(':').map(Number);
      const startMin = sh * 60 + sm;
      const dur = getDurationMin(a.timeStart, a.timeEnd);
      slotsList.forEach((slot) => {
        const s24 = to24Hour(slot);
        const [slh, slm] = s24.split(':').map(Number);
        const slotMin = slh * 60 + slm;
        if (slotMin >= startMin && slotMin < startMin + dur) {
          bookedTimes.set(slot, a);
        }
      });
    });
    // Check vet time blocks
    const blocked = new Map<string, string>();
    if (newApptVetId) {
      vetTimeBlocks
        .filter(b => b.date === dateStr)
        .forEach(b => {
          const bStartMin = (() => { const [h, m] = b.time_start.split(':').map(Number); return h * 60 + m; })();
          const bEndMin = (() => { const [h, m] = b.time_end.split(':').map(Number); return h * 60 + m; })();
          slotsList.forEach(slot => {
            const s24 = to24Hour(slot);
            const [slh, slm] = s24.split(':').map(Number);
            const slotMin = slh * 60 + slm;
            if (slotMin >= bStartMin && slotMin < bEndMin) blocked.set(slot, b.type);
          });
        });
    }
    return slotsList.map((slot) => ({
      time: slot,
      time24: to24Hour(slot),
      booked: bookedTimes.get(slot) || null,
      blocked: blocked.get(slot) || null,
    }));
  };

  return (
    <div className={wrapperClassName ?? 'max-w-[1440px] mx-auto p-8'}>
      {/* ─── Header ───────────────────────────────────── */}
      {!hideHeader && (
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[var(--text-primary)]" style={{ fontSize: '32px', fontWeight: 700 }}>
              Bookings
            </h1>
            <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '16px', fontWeight: 400 }}>
              Manage your clinic schedule and bookings.
            </p>
          </div>
          <Button onClick={() => openNewApptDialog()}>
            <Plus className="w-4 h-4" /> New Booking
          </Button>
        </div>
      )}
      {hideHeader && (
        <div className="flex justify-end mb-4">
          <Button onClick={() => openNewApptDialog()}>
            <Plus className="w-4 h-4" /> New Booking
          </Button>
        </div>
      )}

      {/* ─── Portal Appointment Requests ───────────────── */}
      {portalRequests.length > 0 && (
        <div className="mb-6" style={{ border: '1.5px solid #3B82F630', borderRadius: '14px', overflow: 'hidden', backgroundColor: 'var(--surface-white)' }}>
          {/* Section header */}
          <button
            onClick={() => setPortalPanelOpen(o => !o)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'linear-gradient(135deg, #3B82F608, color-mix(in srgb, var(--brand-green-text) 3%, transparent))', border: 'none', cursor: 'pointer', borderBottom: portalPanelOpen ? '1px solid var(--border-color)' : 'none' }}
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
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '8px', backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)', border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
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
        const VET_OPTIONS = staffList.map((s, i) => {
          const colors = ['var(--brand-green-text)', '#3B82F6', '#8B5CF6', '#F59E0B', '#06B6D4', '#EC4899'];
          return { name: s.name, initials: s.initials, color: colors[i % colors.length], id: s.id };
        });
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
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--brand-green-text)', display: 'inline-block' }} /> Available
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
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isBooked ? '#d4183d' : 'var(--brand-green-text)', display: 'block' }} />
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
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 min-w-0">
                {viewMode === 'month' ? (
                  <>
                    <button onClick={goToPrevMonth} className="p-1 hover:bg-[var(--surface-elevated)] transition-colors flex-shrink-0" style={{ borderRadius: '6px' }}>
                      <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
                    </button>
                    <CalendarIcon className="w-5 h-5 text-[var(--brand-green-text)] flex-shrink-0" />
                    <h2 className="text-[var(--text-primary)] truncate" style={{ fontSize: '18px', fontWeight: 600 }}>
                      {MONTH_NAMES[mvMonth]} {mvYear}
                    </h2>
                    <button onClick={goToNextMonth} className="p-1 hover:bg-[var(--surface-elevated)] transition-colors flex-shrink-0" style={{ borderRadius: '6px' }}>
                      <ChevronRight className="w-5 h-5 text-[var(--text-secondary)]" />
                    </button>
                    {!isCurrentMonthView && (
                      <button
                        onClick={goToCurrentMonth}
                        className="ml-2 px-3 py-1 text-[var(--brand-green-text)] border border-[var(--brand-green-text)] hover:bg-[color-mix(in_srgb,var(--brand-green-text)_6%,transparent)] transition-colors flex-shrink-0"
                        style={{ borderRadius: '6px', fontSize: '13px', fontWeight: 500 }}
                      >
                        Today
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {!showAllDates && (
                      <button onClick={goToPrevDay} className="p-1 hover:bg-[var(--surface-elevated)] transition-colors flex-shrink-0" style={{ borderRadius: '6px' }}>
                        <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
                      </button>
                    )}
                    <CalendarIcon className="w-5 h-5 text-[var(--brand-green-text)] flex-shrink-0" />
                    <h2 className="text-[var(--text-primary)] truncate" style={{ fontSize: '18px', fontWeight: 600 }}>
                      {showAllDates ? 'All Appointments' : (
                        <>
                          {isToday(selectedDate) ? 'Today, ' : ''}
                          {formatDate(selectedDate)}
                        </>
                      )}
                    </h2>
                    {!showAllDates && (
                      <button onClick={goToNextDay} className="p-1 hover:bg-[var(--surface-elevated)] transition-colors flex-shrink-0" style={{ borderRadius: '6px' }}>
                        <ChevronRight className="w-5 h-5 text-[var(--text-secondary)]" />
                      </button>
                    )}
                    {!isToday(selectedDate) && !showAllDates && (
                      <button
                        onClick={goToToday}
                        className="ml-2 px-3 py-1 text-[var(--brand-green-text)] border border-[var(--brand-green-text)] hover:bg-[color-mix(in_srgb,var(--brand-green-text)_6%,transparent)] transition-colors flex-shrink-0"
                        style={{ borderRadius: '6px', fontSize: '13px', fontWeight: 500 }}
                      >
                        Today
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const next = !showAllDates;
                        setShowAllDates(next);
                        setVisibleCount(10);
                        if (next && viewMode !== 'list') setViewMode('list');
                      }}
                      className="ml-2 px-3 py-1 transition-colors flex-shrink-0"
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
              <div className="flex items-center gap-3 flex-shrink-0">
                {viewMode !== 'month' && (
                  <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>
                    {totalToday} booking{totalToday !== 1 ? 's' : ''}{showAllDates ? ' total' : ''}
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
              <>
              {/* Row 1: Status tabs + Search */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-1 p-1 bg-[var(--surface-elevated)] flex-shrink-0" style={{ borderRadius: '8px' }}>
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
                <div className="relative flex-1" style={{ minWidth: '180px' }}>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                  <Input
                    placeholder="Search pet, owner, or service..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-8"
                    style={{ fontSize: '13px' }}
                  />
                </div>
              </div>
              {/* Row 2: Doctor + Service + Species filters */}
              <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-[var(--border-color)]">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--text-secondary)] flex-shrink-0" />
                <Select value={selectedVetFilter} onValueChange={setSelectedVetFilter}>
                  <SelectTrigger className="h-7 w-auto min-w-[140px]" style={{ fontSize: '12px' }}>
                    <SelectValue placeholder="All Doctors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Doctors</SelectItem>
                    {staffList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterService} onValueChange={setFilterService}>
                  <SelectTrigger className="h-7 w-auto min-w-[130px]" style={{ fontSize: '12px' }}>
                    <SelectValue placeholder="Service" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Services</SelectItem>
                    {uniqueServices.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterSpecies} onValueChange={setFilterSpecies}>
                  <SelectTrigger className="h-7 w-auto min-w-[110px]" style={{ fontSize: '12px' }}>
                    <SelectValue placeholder="Species" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Species</SelectItem>
                    {uniqueSpecies.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'newest' | 'oldest')}>
                  <SelectTrigger className="h-7 w-auto min-w-[120px]" style={{ fontSize: '12px' }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <>
                    <div className="w-px h-4 bg-[var(--border-color)]" />
                    <button
                      onClick={() => { setSelectedVetFilter('all'); setFilterService('all'); setFilterSpecies('all'); setSortOrder('newest'); }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 hover:opacity-80 transition-opacity"
                      style={{ fontSize: '11px', fontWeight: 600, color: '#d4183d', cursor: 'pointer', background: 'none', border: 'none' }}
                    >
                      <X className="w-3 h-3" />
                      Clear
                    </button>
                  </>
                )}
              </div>
              </>
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
                    ? (showAllDates ? 'No bookings found.' : 'No bookings scheduled for this date.')
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
                  const isPaid = paidApptIds.has(appt.id);
                  const displayStatus = isPaid ? 'Paid' : appt.status === 'Checked In' ? 'Waiting for Doctor' : appt.status;
                  const s = statusStyles[displayStatus] || statusStyles.Completed;
                  const StatusIcon = s.icon;
                  const serviceColor = serviceColors[appt.service] || serviceColors.Other;
                  const showDateHeader = showAllDates && (idx === 0 || filteredAppointments[idx - 1].date !== appt.date);
                  return (
                    <div key={appt.id}>
                      {showDateHeader && (
                        <p className="text-[var(--text-secondary)] mb-1 mt-3 first:mt-0" style={{ fontSize: '13px', fontWeight: 600 }}>
                          {new Date(appt.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                    <div
                      className="bg-[var(--surface-white)] border border-[var(--border-color)] p-4 hover:border-[var(--brand-green-text)] transition-colors cursor-pointer"
                      style={{ borderRadius: '12px' }}
                      onClick={() => openApptDetail(appt)}
                    >
                      {/* Row 1: Time + Pet/Owner + Service + Status + Actions */}
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Time */}
                        <div className="w-20 flex-shrink-0 text-center">
                          <p className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>
                            {appt.timeStart}
                          </p>
                          <p className="text-[var(--text-secondary)]" style={{ fontSize: '11px' }}>
                            to {appt.timeEnd}
                          </p>
                        </div>

                        {/* Divider */}
                        <div className="w-px h-10 bg-[var(--border-color)] hidden sm:block" />

                        {/* Pet + Owner */}
                        <div className="flex items-center gap-3 flex-1 min-w-[180px]">
                          <Avatar className="w-9 h-9">
                            <AvatarImage src={appt.petImage} alt={appt.petName} className="object-cover" />
                            <AvatarFallback>{appt.petName.slice(0, 2)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-[var(--text-primary)] truncate" style={{ fontSize: '15px', fontWeight: 600 }}>
                              {appt.petName}
                            </p>
                            <p className="text-[var(--text-secondary)] truncate" style={{ fontSize: '12px' }}>
                              {appt.ownerName} · {appt.species}
                            </p>
                          </div>
                        </div>

                        {/* Service Badge */}
                        <span
                          className="inline-block px-2 py-0.5 flex-shrink-0"
                          style={{
                            backgroundColor: serviceColor + '15',
                            color: serviceColor,
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          {appt.service}
                        </span>

                        {/* Vet */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <User className="w-3 h-3 text-[var(--text-secondary)]" />
                          <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>{appt.vet}</span>
                        </div>

                        {/* Status */}
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 flex-shrink-0"
                          style={{
                            backgroundColor: s.bg,
                            color: s.text,
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 600,
                          }}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {displayStatus}
                        </span>

                        {/* Room badge */}
                        {appt.room && (appt.status === 'Checked In' || appt.status === 'In Progress') && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 flex-shrink-0"
                            style={{
                              backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 12%, transparent)',
                              color: 'var(--brand-green-text)',
                              borderRadius: '9999px',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            <DoorOpen className="w-3 h-3" />
                            {appt.room}
                          </span>
                        )}

                        {/* Patient Arrived → open room selection */}
                        {(appt.status === 'Scheduled' || appt.status === 'Confirmed' || appt.status === 'Pending') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRoomSelectAppt(appt);
                              setRoomSelectOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 flex-shrink-0 hover:opacity-90 transition-opacity"
                            style={{
                              backgroundColor: 'var(--brand-green-text)',
                              color: 'var(--on-brand-green)',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 600,
                              border: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            Patient Arrived
                          </button>
                        )}
                        {appt.status === 'Completed' && !paidApptIds.has(appt.id) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPaymentAppt(appt);
                              setPaymentMethod('card');
                              setPaymentDone(false);
                              setShowCardForm(false);
                              setStripeClientSecret(null);
                              setStripeError(null);
                              setPaymentOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 flex-shrink-0 hover:opacity-90 transition-opacity"
                            style={{
                              backgroundColor: '#3B82F6',
                              color: '#fff',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 600,
                              border: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            Checkout
                          </button>
                        )}
                      </div>

                      {/* Notes preview */}
                      {appt.notes && (
                        <p className="text-[var(--text-secondary)] mt-2 ml-24 pl-4 sm:ml-24" style={{ fontSize: '13px', borderLeft: '2px solid var(--border-color)' }}>
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
                            onClick={() => setVisibleCount((c) => c + 10)}
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
                        setDayPopupDate(dateStr);
                        setDayPopupVet('all');
                        setDayPopupOpen(true);
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
              <div className="bg-[var(--surface-white)] border border-[var(--border-color)] overflow-hidden" style={{ borderRadius: '12px', maxHeight: '600px', overflowY: 'auto' }}>
                {SCHEDULE_SLOTS.map((slot, idx) => {
                  const slotAppts = appointmentsByTime.get(slot) || [];
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

                      {/* Slot Content — supports multiple appointments (different doctors) */}
                      {slotAppts.length > 0 ? (
                        <div className="flex-1 flex gap-1.5 m-1.5">
                          {slotAppts.map((appt) => {
                            const svcColor = serviceColors[appt.service] || 'var(--brand-green-text)';
                            return (
                              <div
                                key={appt.id}
                                className="flex-1 px-4 py-3 flex items-center gap-4 cursor-pointer hover:brightness-95 transition-all"
                                style={{
                                  backgroundColor: `${svcColor}10`,
                                  borderLeft: `4px solid ${svcColor}`,
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
                                    backgroundColor: statusStyles[appt.status]?.bg ?? '#6B728020',
                                    color: statusStyles[appt.status]?.text ?? 'var(--text-secondary)',
                                    borderRadius: '9999px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                  }}
                                >
                                  {appt.status}
                                </span>
                              </div>
                            );
                          })}
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

          {/* Vets on Duty */}
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-5" style={{ borderRadius: '12px' }}>
            <h3 className="text-[var(--text-primary)] mb-3" style={{ fontSize: '16px', fontWeight: 600 }}>
              Vets on Duty
            </h3>
            <div className="space-y-3">
              {staffList.length === 0 ? (
                <p className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>
                  No vets configured yet.
                </p>
              ) : (
                staffList.map((vet) => {
                  const count = dayAppointmentsUnfiltered.filter(
                    (a) => (a as any).vetId === vet.id && a.status !== 'Cancelled',
                  ).length;
                  return (
                    <div key={vet.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-7 h-7 bg-[color-mix(in_srgb,var(--brand-green-text)_12%,transparent)] flex items-center justify-center flex-shrink-0"
                          style={{ borderRadius: '9999px', fontSize: '11px', fontWeight: 700, color: 'var(--brand-green-text)' }}
                        >
                          {vet.initials || <User className="w-3.5 h-3.5" />}
                        </div>
                        <span
                          className="text-[var(--text-primary)] truncate"
                          style={{ fontSize: '14px', fontWeight: 500 }}
                        >
                          {vet.name}
                        </span>
                      </div>
                      <span
                        className="text-[var(--text-secondary)] flex-shrink-0 ml-2"
                        style={{ fontSize: '13px' }}
                      >
                        {count} appt{count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* ─── New Booking Dialog ────────────────────── */}
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
                <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>New Booking</h2>
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
                    { label: 'Annual Checkup',  color: 'var(--brand-green-text)', emoji: '🩺' },
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

              {/* Veterinarian */}
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Veterinarian</p>
                <div className="flex gap-2 flex-wrap">
                  {staffList.map((s, i) => {
                    const colors = ['var(--brand-green-text)', '#3B82F6', '#8B5CF6', '#F59E0B', '#06B6D4', '#EC4899'];
                    const v = { name: s.name, initials: s.initials, color: colors[i % colors.length], id: s.id };
                    const active = newApptVetId === v.id;
                    return (
                      <button key={v.id} onClick={() => { setNewApptVetId(v.id); setNewApptVetName(v.name); }} style={{
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
                    <span style={{ fontSize: '13px', color: newApptVetName ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{newApptVetName || 'No vet selected'}</span>
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
                  {[{ label: 'Confirmed', color: 'var(--brand-green-text)' }, { label: 'Pending', color: '#F4A261' }].map(s => {
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
                    { label: 'Normal',    color: 'var(--brand-green-text)' },
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
                    { label: 'Healthy' as const,   color: 'var(--brand-green-text)', emoji: '✅' },
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => setDialogOpen(false)} style={{ backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)' }}>
              <CalendarIcon className="w-4 h-4 mr-1.5" />
              Schedule Booking
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Payment Checkout Dialog ─────────────────── */}
      <Dialog open={paymentOpen} onOpenChange={(open) => { setPaymentOpen(open); if (!open) setPaymentDone(false); }}>
        <DialogContent style={{ maxWidth: 440, borderRadius: 16 }}>
          <DialogTitle style={{ fontSize: 18, fontWeight: 700 }}>
            {paymentDone ? 'Payment Complete' : 'Checkout & Payment'}
          </DialogTitle>
          {paymentAppt && !paymentDone && (
            <div className="space-y-5 pt-2">
              {/* Patient info */}
              <div className="flex items-center gap-3 p-3" style={{ backgroundColor: 'var(--surface-elevated)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                <Avatar className="w-10 h-10">
                  <AvatarImage src={paymentAppt.petImage} alt={paymentAppt.petName} />
                  <AvatarFallback style={{ fontSize: 13, fontWeight: 700 }}>{paymentAppt.petName?.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{paymentAppt.petName}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{paymentAppt.ownerName} · {paymentAppt.service}</p>
                </div>
                <div className="text-right">
                  <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand-green-text)' }}>$70.20</p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>invoice total</p>
                </div>
              </div>

              {/* Payment method */}
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Payment Method</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'card' as const, icon: CreditCard, label: 'Credit Card' },
                    { key: 'cash' as const, icon: Banknote, label: 'Cash' },
                    { key: 'insurance' as const, icon: Receipt, label: 'Insurance' },
                  ]).map(({ key, icon: Icon, label }) => (
                    <button
                      key={key}
                      onClick={() => setPaymentMethod(key)}
                      className="flex flex-col items-center gap-1.5 py-3 transition-all"
                      style={{
                        borderRadius: 10,
                        border: paymentMethod === key ? '2px solid var(--brand-green-text)' : '1px solid var(--border-color)',
                        backgroundColor: paymentMethod === key ? 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)' : 'transparent',
                        cursor: 'pointer',
                        background: paymentMethod === key ? 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)' : 'var(--surface-white)',
                      }}
                    >
                      <Icon style={{ width: 20, height: 20, color: paymentMethod === key ? 'var(--brand-green-text)' : 'var(--text-secondary)' }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: paymentMethod === key ? 'var(--brand-green-text)' : 'var(--text-secondary)' }}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Stripe card entry toggle + form */}
              {paymentMethod === 'card' && isStripeConfigured() && (
                <div>
                  <button
                    onClick={async () => {
                      if (showCardForm) { setShowCardForm(false); setStripeClientSecret(null); return; }
                      setShowCardForm(true);
                      setStripeLoading(true);
                      setStripeError(null);
                      try {
                        const { data: { session } } = await supabase.auth.getSession();
                        const resp = await fetch(
                          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-intent`,
                          {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${session?.access_token}`,
                            },
                            body: JSON.stringify({
                              amount: 70.20,
                              currency: 'usd',
                              description: paymentAppt ? `${paymentAppt.service} — ${paymentAppt.petName} (${paymentAppt.ownerName})` : 'VetTrack Payment',
                              metadata: paymentAppt ? { appointment_id: paymentAppt.id, pet: paymentAppt.petName, owner: paymentAppt.ownerName } : {},
                            }),
                          },
                        );
                        const result = await resp.json();
                        if (result.clientSecret) {
                          setStripeClientSecret(result.clientSecret);
                        } else {
                          setStripeError(result.error || 'Failed to initialize payment');
                        }
                      } catch (e: any) {
                        setStripeError(e.message || 'Connection error');
                      }
                      setStripeLoading(false);
                    }}
                    style={{
                      width: '100%', padding: '9px 14px', borderRadius: 8, cursor: 'pointer',
                      border: showCardForm ? '1.5px solid var(--brand-green-text)' : '1.5px dashed color-mix(in srgb, var(--brand-green-text) 50%, transparent)',
                      backgroundColor: showCardForm ? 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)' : 'transparent',
                      display: 'flex', alignItems: 'center', gap: 8,
                      transition: 'all 0.15s',
                    }}
                  >
                    <Plus style={{ width: 14, height: 14, color: 'var(--brand-green-text)', transform: showCardForm ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-green-text)' }}>
                      {showCardForm ? 'Hide Card Details' : 'Enter Card Details'}
                    </span>
                  </button>

                  {showCardForm && (
                    <div style={{ marginTop: 10, padding: 14, borderRadius: 10, border: '1.5px solid color-mix(in srgb, var(--brand-green-text) 30%, transparent)', backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 4%, transparent)' }}>
                      {stripeLoading && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 }}>
                          <Loader2 style={{ width: 16, height: 16, color: 'var(--brand-green-text)', animation: 'spin 1s linear infinite' }} />
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Initializing secure payment...</span>
                        </div>
                      )}
                      {stripeError && (
                        <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: '#d4183d15', border: '1px solid #d4183d30', marginBottom: 8 }}>
                          <p style={{ fontSize: 12, color: '#d4183d', margin: 0 }}>{stripeError}</p>
                        </div>
                      )}
                      {stripeClientSecret && stripePromise && (
                        <Elements stripe={stripePromise} options={{ clientSecret: stripeClientSecret, appearance: { theme: document.documentElement.classList.contains('dark') ? 'night' : 'stripe', variables: { colorPrimary: '#2D6A4F', colorBackground: document.documentElement.classList.contains('dark') ? '#1a1a2e' : '#ffffff', colorText: document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#1a1a2e', colorTextSecondary: document.documentElement.classList.contains('dark') ? '#94a3b8' : '#64748b', borderRadius: '8px', fontFamily: 'system-ui, -apple-system, sans-serif', fontSizeBase: '15px' } } }}>
                          <BookingsStripeCardForm />
                        </Elements>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Summary */}
              <div className="space-y-2 pt-1" style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                <div className="flex justify-between">
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Services</span>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>$65.00</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Tax (8%)</span>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>$5.20</span>
                </div>
                <div className="flex justify-between pt-2" style={{ borderTop: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Total</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-green-text)' }}>$70.20</span>
                </div>
              </div>

              {/* Confirm button */}
              <Button
                onClick={async () => {
                  setPaymentProcessing(true);
                  setPaidApptIds((prev) => new Set(prev).add(paymentAppt.id));
                  // Create medical record + invoice + payment
                  if (paymentAppt.petId && paymentAppt.clientId) {
                    const orgCtx = await getOrgContext();
                    const now = new Date();
                    const recNum = `VT-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`;
                    await db.from('medical_records').insert({
                      record_number: recNum,
                      appointment_id: paymentAppt.id,
                      pet_id: paymentAppt.petId,
                      client_id: paymentAppt.clientId,
                      clinic_id: orgCtx.clinicId,
                      vet_id: paymentAppt.vetId || null,
                      visit_date: paymentAppt.date,
                      visit_time: paymentAppt.timeStart,
                      reason: paymentAppt.service,
                      clinical_notes: paymentAppt.notes || null,
                      record_type: 'Visit',
                      status: 'Final',
                      duration_minutes: paymentAppt.durationMinutes || 30,
                      organization_id: orgCtx.organizationId,
                    });
                    // Create invoice
                    const subtotal = 65;
                    const taxAmount = parseFloat((subtotal * 0.08).toFixed(2));
                    const total = subtotal + taxAmount;
                    const invNum = `INV-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`;
                    const { data: invData } = await db.from('invoices').insert({
                      invoice_number: invNum,
                      client_id: paymentAppt.clientId,
                      clinic_id: orgCtx.clinicId,
                      appointment_id: paymentAppt.id,
                      organization_id: orgCtx.organizationId,
                      subtotal,
                      tax_amount: taxAmount,
                      total,
                      discount_amount: 0,
                      amount_paid: total,
                      status: 'Paid',
                      paid_at: now.toISOString(),
                      notes: `${paymentAppt.service} — ${paymentAppt.petName}`,
                    }).select('id').single();
                    // Create payment record
                    if (invData) {
                      const methodMap: Record<string, string> = { card: 'Credit Card', cash: 'Cash', insurance: 'Insurance' };
                      await db.from('payments').insert({
                        invoice_id: invData.id,
                        amount: total,
                        method: methodMap[paymentMethod] || 'Credit Card',
                        paid_at: now.toISOString(),
                        organization_id: orgCtx.organizationId,
                      });
                    }
                  }
                  setPaymentProcessing(false);
                  setPaymentDone(true);
                }}
                disabled={paymentProcessing}
                className="w-full hover:opacity-90"
                style={{ backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)', border: 'none', height: 42, fontSize: 14, fontWeight: 600, boxShadow: '0 0 16px color-mix(in srgb, var(--brand-green-text) 50%, transparent)' }}
              >
                {paymentProcessing ? 'Processing...' : `Confirm Payment — $70.20`}
              </Button>
            </div>
          )}
          {paymentDone && (
            <div className="text-center py-6 space-y-4">
              <div className="mx-auto" style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 style={{ width: 32, height: 32, color: 'var(--brand-green-text)' }} />
              </div>
              <div>
                <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Payment Received</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {paymentAppt?.petName} — {paymentAppt?.ownerName} · {paymentMethod === 'card' ? 'Card' : paymentMethod === 'cash' ? 'Cash' : 'Insurance'}
                </p>
              </div>
              <Button onClick={() => setPaymentOpen(false)} className="hover:opacity-90" style={{ backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)', border: 'none' }}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Room Selection Dialog (Floor Plan) ────── */}
      <Dialog open={roomSelectOpen} onOpenChange={(v) => { if (!v) { setRoomSelectOpen(false); setRoomSelectAppt(null); } }}>
        <DialogContent
          className="p-0 overflow-hidden gap-0 [&>button]:top-[14px] [&>button]:right-[14px] [&>button]:w-8 [&>button]:h-8 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:rounded-[8px] [&>button]:!bg-[var(--surface-white)] [&>button]:!text-[var(--text-secondary)] [&>button]:!opacity-100 [&>button]:hover:!bg-[var(--surface-elevated)] [&>button]:!border [&>button]:!border-[var(--border-color)] [&>button]:transition-colors [&>button>svg]:w-4 [&>button>svg]:h-4"
          style={{
            maxWidth: 720,
            width: '95vw',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 0 0 1px color-mix(in srgb, var(--brand-green-text) 15%, transparent), 0 8px 32px rgba(0,0,0,0.22)',
          }}
        >
          {roomSelectAppt && (() => {
            // Compute the bounding box of all rooms so the canvas auto-fits
            const cols = clinicRooms.reduce((mx, r) => Math.max(mx, r.pos_x + r.width), 0);
            const rowsCount = clinicRooms.reduce((mx, r) => Math.max(mx, r.pos_y + r.height), 0);
            // Cell size is computed to fit ~640px wide canvas comfortably.
            const CANVAS_W = 640;
            const cellPx = cols > 0 ? Math.max(14, Math.min(28, Math.floor(CANVAS_W / Math.max(cols, 12)))) : 22;
            const canvasW = (cols || 12) * cellPx;
            const canvasH = (rowsCount || 8) * cellPx;
            const availableCount = clinicRooms.filter((r) => !busyRoomMap.has(r.id)).length;

            return (
              <>
                {/* Header */}
                <div
                  style={{
                    padding: '16px 22px',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-green-text) 10%, transparent), transparent 60%)',
                  }}
                >
                  <div
                    style={{
                      width: 38, height: 38, borderRadius: 10,
                      backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 14%, transparent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}
                  >
                    <Building2 style={{ width: 18, height: 18, color: 'var(--brand-green-text)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      Assign a Room
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                      Pick any free room — it will be occupied for the visit duration.
                    </p>
                  </div>
                </div>

                {/* Patient strip */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 22px',
                    backgroundColor: 'var(--surface-elevated)',
                    borderBottom: '1px solid var(--border-color)',
                  }}
                >
                  <Avatar className="w-11 h-11">
                    <AvatarImage src={roomSelectAppt.petImage} alt={roomSelectAppt.petName} className="object-cover" />
                    <AvatarFallback>{(roomSelectAppt.petName || '').slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      {roomSelectAppt.petName}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                      {roomSelectAppt.ownerName} &middot; {roomSelectAppt.service}
                    </p>
                  </div>
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '5px 11px',
                      borderRadius: 9999,
                      backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 12%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--brand-green-text) 30%, transparent)',
                    }}
                  >
                    <Clock style={{ width: 12, height: 12, color: 'var(--brand-green-text)' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-green-text)' }}>
                      {roomSelectAppt.timeStart} – {roomSelectAppt.timeEnd}
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div style={{ padding: '18px 22px 8px', overflowY: 'auto' }}>
                  {/* Legend */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                      Floor Plan
                    </p>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-secondary)' }}>
                        <span style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 30%, transparent)', border: '1px solid var(--brand-green-text)' }} />
                        Available
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-secondary)' }}>
                        <span style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: 'color-mix(in srgb, #d4183d 22%, transparent)', border: '1px solid #d4183d' }} />
                        Busy
                      </span>
                    </div>
                  </div>

                  {roomsLoading ? (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <Loader2 className="animate-spin" style={{ width: 18, height: 18, margin: '0 auto 8px' }} />
                      <p style={{ fontSize: 12, margin: 0 }}>Loading rooms…</p>
                    </div>
                  ) : clinicRooms.length === 0 ? (
                    <div style={{
                      padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary)',
                      border: '1.5px dashed var(--border-color)', borderRadius: 12,
                    }}>
                      <Building2 style={{ width: 32, height: 32, opacity: 0.4, margin: '0 auto 8px' }} />
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>No rooms configured yet</p>
                      <p style={{ fontSize: 11, margin: '4px 0 0' }}>
                        Ask a SuperAdmin to set up the floor plan in <b>Clinics → Floor Plan Builder</b>.
                      </p>
                    </div>
                  ) : (
                    <div
                      style={{
                        position: 'relative',
                        width: canvasW,
                        height: canvasH,
                        margin: '0 auto',
                        backgroundColor: 'var(--surface-white)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 10,
                        backgroundImage: `
                          linear-gradient(to right, color-mix(in srgb, var(--border-color) 50%, transparent) 1px, transparent 1px),
                          linear-gradient(to bottom, color-mix(in srgb, var(--border-color) 50%, transparent) 1px, transparent 1px)
                        `,
                        backgroundSize: `${cellPx}px ${cellPx}px`,
                      }}
                    >
                      {clinicRooms.map((room) => {
                        const cfg = ROOM_TYPES[room.type] ?? ROOM_TYPES.other;
                        const Icon = cfg.icon;
                        const busy = busyRoomMap.get(room.id);
                        const isBusy = !!busy;
                        // Service rooms (restroom / storage / lobby) can't host appointments
                        const isAssignable = !['restroom', 'storage', 'lobby', 'office', 'reception'].includes(room.type);
                        const disabled = isBusy || !isAssignable;
                        const baseColor = disabled ? '#94A3B8' : cfg.color;
                        const baseBg = isBusy
                          ? 'color-mix(in srgb, #d4183d 12%, transparent)'
                          : disabled
                            ? 'color-mix(in srgb, #94A3B8 12%, transparent)'
                            : (room.color || cfg.bg);
                        const borderColor = isBusy
                          ? '#d4183d'
                          : disabled
                            ? 'color-mix(in srgb, #94A3B8 50%, transparent)'
                            : 'color-mix(in srgb, ' + cfg.color + ' 65%, transparent)';

                        return (
                          <button
                            key={room.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => handleRoomConfirm({ id: room.id, name: room.name })}
                            title={
                              isBusy
                                ? busy?.reason === 'in_progress'
                                  ? `In Progress: ${busy?.petName} (${busy?.timeStart} – ${busy?.timeEnd})`
                                  : `Busy: ${busy?.petName} (${busy?.timeStart} – ${busy?.timeEnd})`
                                : !isAssignable
                                  ? `${cfg.label} — not bookable`
                                  : `Assign ${room.name}`
                            }
                            style={{
                              position: 'absolute',
                              left: room.pos_x * cellPx,
                              top: room.pos_y * cellPx,
                              width: room.width * cellPx,
                              height: room.height * cellPx,
                              backgroundColor: baseBg,
                              border: `2px solid ${borderColor}`,
                              borderRadius: 6,
                              cursor: disabled ? 'not-allowed' : 'pointer',
                              padding: '4px 6px',
                              display: 'flex', flexDirection: 'column',
                              alignItems: 'flex-start', justifyContent: 'space-between',
                              overflow: 'hidden',
                              transition: 'transform 0.12s, box-shadow 0.12s',
                              boxShadow: 'none',
                              opacity: disabled && !isBusy ? 0.55 : 1,
                            }}
                            onMouseEnter={(e) => {
                              if (disabled) return;
                              e.currentTarget.style.boxShadow = `0 0 0 3px color-mix(in srgb, ${cfg.color} 25%, transparent)`;
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.boxShadow = 'none';
                              e.currentTarget.style.transform = 'none';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, width: '100%' }}>
                              <Icon style={{ width: 11, height: 11, color: baseColor, flexShrink: 0 }} />
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: 'var(--text-primary)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  lineHeight: 1.1,
                                }}
                              >
                                {room.name}
                              </span>
                            </div>
                            {isBusy ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
                                <span style={{ fontSize: 9, fontWeight: 700, color: '#d4183d', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.1 }}>
                                  {busy?.reason === 'in_progress' ? 'In Use' : 'Busy'}
                                </span>
                                <span style={{ fontSize: 9, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.1 }}>
                                  {busy?.petName}
                                </span>
                              </div>
                            ) : isAssignable ? (
                              <span style={{ fontSize: 9, fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.1 }}>
                                Free
                              </span>
                            ) : (
                              <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.1 }}>
                                {cfg.label}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div
                  style={{
                    padding: '12px 22px 16px',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    backgroundColor: 'var(--surface-elevated)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
                    <CheckCircle2 style={{ width: 13, height: 13, color: 'var(--brand-green-text)' }} />
                    <span>
                      <b style={{ color: 'var(--text-primary)' }}>{availableCount}</b> of <b style={{ color: 'var(--text-primary)' }}>{clinicRooms.length}</b> rooms available
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setRoomSelectOpen(false); setRoomSelectAppt(null); }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--surface-white)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            );
          })()}
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
            border: '1.5px solid color-mix(in srgb, var(--brand-green-text) 25%, transparent)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.16), 0 0 0 1px color-mix(in srgb, var(--brand-green-text) 8%, transparent)',
            overflow: 'hidden',
            animation: 'slideUp 0.25s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <div style={{ height: 3, background: 'linear-gradient(90deg, var(--brand-green-text), #74C69D)' }} />
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
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
          className="p-0 overflow-hidden gap-0 [&>button]:top-[14px] [&>button]:right-[14px] [&>button]:w-8 [&>button]:h-8 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:rounded-[8px] [&>button]:!bg-[var(--surface-white)] [&>button]:!text-[var(--text-secondary)] [&>button]:!opacity-100 [&>button]:hover:!bg-[var(--surface-elevated)] [&>button]:!border [&>button]:!border-[var(--border-color)] [&>button]:transition-colors [&>button>svg]:w-4 [&>button>svg]:h-4"
          style={{
            maxWidth: '512px',
            width: '95vw',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {selectedAppt && (() => {
            const s = statusStyles[selectedAppt.status] || statusStyles.Scheduled;
            const StatusIcon = s.icon;
            const svcColor = serviceColors[selectedAppt.service] || 'var(--text-secondary)';
            const durationMin = getDurationMin(selectedAppt.timeStart, selectedAppt.timeEnd);
            const canCheckIn =
              selectedAppt.status === 'Scheduled' ||
              selectedAppt.status === 'Confirmed' ||
              selectedAppt.status === 'Pending';
            const isDone =
              selectedAppt.status === 'Completed' ||
              selectedAppt.status === 'Cancelled' ||
              selectedAppt.status === 'No Show';

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
                      {selectedAppt.ownerName} · {selectedAppt.species} · {selectedAppt.timeStart}
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
                        {canCheckIn && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              await updateApptStatus(selectedAppt.id, 'No Show');
                              setDetailOpen(false);
                            }}
                            className="text-[#64748B] border-[#64748B] hover:bg-[#64748B10] hover:text-[#64748B]"
                          >
                            <AlertCircle className="w-3.5 h-3.5 mr-1.5" />No Show
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={handleDeleteAppt} className="text-[#d4183d] border-[#d4183d] hover:bg-[#d4183d10] hover:text-[#d4183d]">
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />Delete
                        </Button>
                      </div>
                      <div className="flex gap-2 ml-auto">
                        <Button variant="outline" size="sm" onClick={() => setDetailMode('edit')}><Pencil className="w-3.5 h-3.5 mr-1.5" />Edit</Button>
                        {canCheckIn && (
                          <Button size="sm" onClick={handleClientArrived} style={{ background: 'var(--brand-green-text)', color: 'var(--on-brand-green)', border: 'none' }} className="hover:opacity-90">
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
                            {staffList.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
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

      {/* ─── Delete Confirmation Dialog ────────────────── */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="max-w-sm p-6" style={{ borderRadius: '14px' }}>
          <div className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#d4183d15' }}>
              <Trash2 className="w-5 h-5" style={{ color: '#d4183d' }} />
            </div>
            <h3 className="text-[var(--text-primary)]" style={{ fontSize: '16px', fontWeight: 700 }}>Delete Booking</h3>
            <p className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>Are you sure you want to permanently delete this booking? This cannot be undone.</p>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDeleteOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={confirmDeleteAppt} style={{ backgroundColor: '#d4183d', color: '#fff', border: 'none' }}>Delete</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── New Appointment Dialog ────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="p-0 gap-0 overflow-hidden [&>button]:top-[14px] [&>button]:right-[14px] [&>button]:w-8 [&>button]:h-8 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:rounded-[8px] [&>button]:!bg-[var(--surface-white)] [&>button]:!text-[var(--text-secondary)] [&>button]:!opacity-100 [&>button]:hover:!bg-[var(--surface-elevated)] [&>button]:!border [&>button]:!border-[var(--border-color)] [&>button]:transition-colors [&>button>svg]:w-4 [&>button>svg]:h-4"
          style={{ maxWidth: '780px', width: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
        >
          {/* Header */}
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

          {/* Body */}
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
                  {/* Pet dropdown */}
                  {newApptClientId && (
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Pet</p>
                      <Select value={newApptPetId} onValueChange={(v) => {
                        setNewApptPetId(v);
                        const pet = allPets.find(p => p.id === v);
                        if (pet) {
                          setNewApptPet(pet.name);
                          // Auto-select the pet's assigned vet if one exists and no vet is chosen yet
                          if (pet.assigned_vet_id && !newApptVetId) {
                            const assignedStaff = staffList.find(s => s.id === pet.assigned_vet_id);
                            if (assignedStaff) {
                              setNewApptVetId(assignedStaff.id);
                              setNewApptVetName(assignedStaff.name);
                              fetchVetTimeBlocks(assignedStaff.id);
                            }
                          }
                        }
                      }}>
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

              {/* Veterinarian */}
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

              {/* Time slot grid */}
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Time</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {getSlotAvailability(newApptDate, undefined, newApptVetId, newApptShowAllHours ? EXTENDED_SCHEDULE_SLOTS : SCHEDULE_SLOTS).map(slot => {
                    const isActive = newApptTime === slot.time24;
                    const isUnavailable = !!slot.booked || !!slot.blocked;
                    const isHovered = hoveredSlotKey === slot.time24;
                    const bookedAppt = slot.booked as any;
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
                            border: `1.5px solid ${isActive ? 'var(--brand-green-text)' : 'var(--border-color)'}`,
                            backgroundColor: isActive ? 'var(--brand-green-text)' : isUnavailable ? 'var(--surface-elevated)' : 'transparent',
                            color: isActive ? 'var(--on-brand-green)' : isUnavailable ? 'var(--text-secondary)' : 'var(--text-primary)',
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

            {/* Right: summary + notifications */}
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

          {/* Footer */}
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

                  const orgCtx2 = await getOrgContext();
                  let finalClientId = newApptClientId;
                  let finalPetId = newApptPetId;

                  if (visitType === 'new') {
                    if (!npOwnerName.trim() || !npPetName.trim() || !npSpecies) { alert('Please fill in owner name, pet name, and species.'); setSavingAppt(false); return; }
                    const nameParts = npOwnerName.trim().split(' ');
                    const { data: newClient, error: cErr } = await db
                      .from('clients')
                      .insert([{
                        organization_id: orgCtx2.organizationId,
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

                    // Upload pet photo if one was selected
                    let photoUrl: string | null = null;
                    if (npPhotoFile) {
                      try {
                        const ext = npPhotoFile.name.split('.').pop() || 'jpg';
                        const path = `${finalClientId}/${Date.now()}.${ext}`;
                        const { error: uploadErr } = await supabase.storage.from('pet-images').upload(path, npPhotoFile, { upsert: true, contentType: npPhotoFile.type });
                        if (!uploadErr) {
                          const { data: urlData } = supabase.storage.from('pet-images').getPublicUrl(path);
                          photoUrl = urlData.publicUrl + '?t=' + Date.now();
                        }
                      } catch (photoErr) {
                        console.warn('[AdminBookings] pet photo upload failed:', photoErr);
                      }
                    }

                    const weightKg = npWeight ? parseFloat(npWeight) : undefined;
                    const { data: newPet, error: pErr } = await db
                      .from('pets')
                      .insert([{
                        organization_id: orgCtx2.organizationId,
                        client_id: finalClientId,
                        name: npPetName,
                        species: npSpecies,
                        breed: npBreed || undefined,
                        date_of_birth: npDob || undefined,
                        sex: npSex || undefined,
                        weight_kg: weightKg && !isNaN(weightKg) ? weightKg : undefined,
                        assigned_vet_id: newApptVetId || undefined,
                        photo_url: photoUrl,
                        is_active: true,
                      }])
                      .select('id')
                      .single();
                    if (pErr || !newPet) { alert('Failed to create pet: ' + (pErr?.message || 'Unknown error')); setSavingAppt(false); return; }
                    finalPetId = newPet.id;
                  }

                  if (!finalClientId || !finalPetId) { alert('Please select a patient (owner and pet).'); setSavingAppt(false); return; }

                  if (visitType === 'returning' && newApptVetId && finalPetId) {
                    await db.from('pets').update({ assigned_vet_id: newApptVetId }).eq('id', finalPetId).eq('organization_id', orgCtx2.organizationId);
                    window.dispatchEvent(new CustomEvent('petDataChanged'));
                  }

                  await addAppointment({
                    pet_id: finalPetId,
                    client_id: finalClientId,
                    vet_id: newApptVetId || undefined,
                    scheduled_at,
                    duration_minutes: durationMin,
                    reason: newApptService || undefined,
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
                          service: newApptService || 'Appointment',
                          date: newApptDate,
                          time: newApptTime,
                        },
                        organization_id: orgCtx2.organizationId,
                      });
                      window.dispatchEvent(new Event('notifCountChanged'));
                    } catch {}
                  }

                  // Reset new-patient fields so the form starts fresh next time
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

      {/* ─── Day Popup Dialog (Month View) ────────────────────── */}
      <Dialog open={dayPopupOpen} onOpenChange={setDayPopupOpen}>
        <DialogContent style={{ maxWidth: '600px', width: '95vw' }}>
          <DialogHeader>
            <DialogTitle>
              {dayPopupDate && new Date(dayPopupDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </DialogTitle>
          </DialogHeader>
          {/* Doctor tabs */}
          <div className="flex gap-1 p-1 bg-[var(--surface-elevated)] mb-4" style={{ borderRadius: '8px', overflowX: 'auto' }}>
            <button
              onClick={() => setDayPopupVet('all')}
              className="px-3 py-1.5 whitespace-nowrap"
              style={{
                borderRadius: '6px', fontSize: '13px',
                fontWeight: dayPopupVet === 'all' ? 600 : 400,
                backgroundColor: dayPopupVet === 'all' ? 'var(--surface-white)' : 'transparent',
                color: dayPopupVet === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: dayPopupVet === 'all' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              All Doctors
            </button>
            {staffList.map((s) => (
              <button
                key={s.id}
                onClick={() => setDayPopupVet(s.id)}
                className="px-3 py-1.5 whitespace-nowrap"
                style={{
                  borderRadius: '6px', fontSize: '13px',
                  fontWeight: dayPopupVet === s.id ? 600 : 400,
                  backgroundColor: dayPopupVet === s.id ? 'var(--surface-white)' : 'transparent',
                  color: dayPopupVet === s.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: dayPopupVet === s.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                {s.name}
              </button>
            ))}
          </div>
          {/* Book Appointment CTA */}
          <Button
            onClick={() => {
              setDayPopupOpen(false);
              const prefillVetId = dayPopupVet !== 'all' ? dayPopupVet : undefined;
              const doc = prefillVetId ? staffList.find((s) => s.id === prefillVetId) : undefined;
              openNewApptDialog(prefillVetId, doc?.name, dayPopupDate);
            }}
            className="w-full"
            style={{ backgroundColor: 'var(--brand-green)', color: '#fff', borderRadius: '8px', fontWeight: 600 }}
          >
            <Plus className="w-4 h-4 mr-2" /> Book Appointment
          </Button>
          {/* Appointments for that day */}
          <div className="space-y-2" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {(() => {
              const dayAppts = appointments.filter((a) => {
                if (a.date !== dayPopupDate) return false;
                if (dayPopupVet !== 'all' && (a as any).vetId !== dayPopupVet) return false;
                return true;
              });
              if (dayAppts.length === 0) {
                return (
                  <div className="text-center py-8">
                    <CalendarIcon className="w-10 h-10 text-[var(--border-color)] mx-auto mb-2" />
                    <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>No appointments</p>
                  </div>
                );
              }
              return dayAppts.map((appt) => {
                const st = statusStyles[appt.status] || statusStyles.Confirmed;
                return (
                  <div
                    key={appt.id}
                    className="flex items-center gap-3 p-3 border border-[var(--border-color)] cursor-pointer hover:bg-[var(--surface-elevated)] transition-colors"
                    style={{ borderRadius: '10px' }}
                    onClick={() => { setDayPopupOpen(false); openApptDetail(appt); }}
                  >
                    <div className="flex-shrink-0 text-right" style={{ width: '70px' }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{appt.timeStart}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{getDurationMin(appt.timeStart, appt.timeEnd)} min</p>
                    </div>
                    <div className="w-px h-10 bg-[var(--brand-green-text)]" />
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{appt.petName}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{appt.service} · {appt.vet}</p>
                    </div>
                    <span
                      className="inline-flex items-center px-2 py-0.5 flex-shrink-0"
                      style={{ backgroundColor: st.bg, color: st.text, borderRadius: '9999px', fontSize: '11px', fontWeight: 600 }}
                    >
                      {appt.status}
                    </span>
                  </div>
                );
              });
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
