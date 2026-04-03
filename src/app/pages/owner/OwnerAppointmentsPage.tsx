import { useState, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, X, Calendar, Clock, PawPrint,
  CheckCircle2, Plus, FileText, Bell, User,
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '../../components/ui/avatar';
import { useAppointments } from '../../hooks/useAppointments';

// ─── Brand ───────────────────────────────────────────────────
const BRAND = '#2D6A4F';
const BRAND_TEXT = 'var(--brand-green-text)';

// ─── Types ───────────────────────────────────────────────────
interface Appointment {
  id: number;
  date: string;
  time: string;
  reason: string;
  pet: string;
  petImage: string;
  vet: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  notes?: string;
}

// ─── Static data ─────────────────────────────────────────────
const PETS = [
  {
    name: 'Max',
    breed: 'Golden Retriever',
    image: 'https://images.unsplash.com/photo-1734966213753-1b361564bab4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb2xkZW4lMjByZXRyaWV2ZXIlMjBkb2clMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzMyNDMxMzB8MA&ixlib=rb-4.1.0&q=80&w=400',
  },
  {
    name: 'Hugo',
    breed: 'Persian Cat',
    image: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  },
];

const SERVICES = [
  { label: 'Annual Checkup',  color: '#2D6A4F', emoji: '🩺' },
  { label: 'Vaccination',     color: '#3B82F6', emoji: '💉' },
  { label: 'Dental Cleaning', color: '#8B5CF6', emoji: '🦷' },
  { label: 'Surgery',         color: '#EC4899', emoji: '🔬' },
  { label: 'Follow-up',       color: '#F4A261', emoji: '📋' },
  { label: 'Emergency',       color: '#d4183d', emoji: '🚨' },
  { label: 'Consultation',    color: '#06B6D4', emoji: '💬' },
  { label: 'Other',           color: '#6B7280', emoji: '📝' },
];

const VETS = [
  { name: 'Dr. Chen',   initials: 'SC', color: '#2D6A4F' },
  { name: 'Dr. Patel',  initials: 'RP', color: '#3B82F6' },
  { name: 'Dr. Garcia', initials: 'MG', color: '#8B5CF6' },
];

const DURATIONS = ['15 min', '30 min', '45 min', '60 min', '90 min'];

const TIME_SLOTS = [
  '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM',
];

const INITIAL_APPOINTMENTS_PLACEHOLDER: Appointment[] = []

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function toDateKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ─── Main Component ──────────────────────────────────────────
export default function OwnerAppointmentsPage() {
  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const { appointments: supaAppts } = useAppointments();

  const mappedAppts: Appointment[] = useMemo(() =>
    supaAppts.map((a, idx) => {
      const dt = new Date(a.scheduled_at);
      const dateStr = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
      const h = dt.getUTCHours(); const m = dt.getUTCMinutes();
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const time = `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
      const status: Appointment['status'] = ['Completed'].includes(a.status) ? 'completed' : ['Cancelled','No Show'].includes(a.status) ? 'cancelled' : 'upcoming';
      return {
        id: idx + 1,
        date: dateStr,
        time,
        reason: a.reason ?? a.services?.name ?? '—',
        pet: a.pets?.name ?? '—',
        petImage: a.pets?.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(a.pets?.name ?? 'Pet')}&background=74C69D&color=fff`,
        vet: a.staff?.profiles ? `Dr. ${a.staff.profiles.last_name}` : '—',
        status,
        notes: a.notes ?? undefined,
      };
    }),
    [supaAppts],
  );

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  // Sync Supabase data into local state when it arrives
  useMemo(() => { if (mappedAppts.length > 0) setAppointments(mappedAppts); }, [mappedAppts]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [bookingOpen, setBookingOpen]   = useState(false);
  const [detailAppt, setDetailAppt]     = useState<Appointment | null>(null);
  const [formSubmitted, setFormSubmitted] = useState(false);

  // Form state — mirrors admin form fields
  const [formPet,      setFormPet]      = useState('Max');
  const [formService,  setFormService]  = useState('Annual Checkup');
  const [formDate,     setFormDate]     = useState('');
  const [formTime,     setFormTime]     = useState('9:00 AM');
  const [formDuration, setFormDuration] = useState('30 min');
  const [formVet,      setFormVet]      = useState('Dr. Chen');
  const [formNotes,    setFormNotes]    = useState('');
  const [confirmMethod,  setConfirmMethod]  = useState('Email');
  const [reminderMethod, setReminderMethod] = useState('Email');
  const [reminderTiming, setReminderTiming] = useState('1 day');

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0);  setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();

  const apptByDate: Record<string, Appointment[]> = {};
  appointments.forEach(a => { if (!apptByDate[a.date]) apptByDate[a.date] = []; apptByDate[a.date].push(a); });

  const openBooking = (dateKey: string) => {
    setSelectedDate(dateKey);
    setFormDate(dateKey);
    setFormSubmitted(false);
    setFormPet('Max');
    setFormService('Annual Checkup');
    setFormTime('9:00 AM');
    setFormDuration('30 min');
    setFormVet('Dr. Chen');
    setFormNotes('');
    setConfirmMethod('Email');
    setReminderMethod('Email');
    setReminderTiming('1 day');
    setBookingOpen(true);
  };

  const handleBooking = () => {
    if (!formDate) return;
    const petObj = PETS.find(p => p.name === formPet)!;
    setAppointments(prev => [...prev, {
      id: Date.now(), date: formDate, time: formTime, reason: formService,
      pet: formPet, petImage: petObj.image, vet: formVet, status: 'upcoming',
      notes: formNotes || undefined,
    }]);
    setFormSubmitted(true);
  };

  const todayKey      = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const upcomingList  = appointments.filter(a => a.status === 'upcoming').sort((a,b) => a.date.localeCompare(b.date));

  const statusConf = (s: Appointment['status']) => ({
    upcoming:  { bg: `${BRAND}18`, text: BRAND_TEXT, label: 'Upcoming' },
    completed: { bg: '#74C69D20', text: BRAND_TEXT,  label: 'Completed' },
    cancelled: { bg: '#d4183d15', text: '#d4183d',   label: 'Cancelled' },
  }[s]);

  const serviceColor = SERVICES.find(s => s.label === formService)?.color ?? '#6B7280';

  const fmtDate = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'No date set';

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8" style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: `linear-gradient(135deg, ${BRAND}, #52B788)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar style={{ width: '20px', height: '20px', color: '#fff' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Appointments</h1>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>{upcomingList.length} upcoming</p>
            </div>
          </div>
          <button
            onClick={() => openBooking(todayKey)}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 18px', borderRadius: '10px', backgroundColor: BRAND, color: '#fff', border: 'none', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
          >
            <Plus style={{ width: '16px', height: '16px' }} /> Book Appointment
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">

          {/* ── Calendar ── */}
          <div style={{ backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
            {/* Month nav */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <button onClick={prevMonth} style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <ChevronLeft style={{ width: '16px', height: '16px', color: 'var(--text-secondary)' }} />
              </button>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{MONTHS[viewMonth]} {viewYear}</h2>
              <button onClick={nextMonth} style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <ChevronRight style={{ width: '16px', height: '16px', color: 'var(--text-secondary)' }} />
              </button>
            </div>
            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border-color)' }}>
              {DAYS_OF_WEEK.map(d => (
                <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{d}</div>
              ))}
            </div>
            {/* Day cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`e${i}`} style={{ minHeight: '88px', borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)', opacity: 0.5 }} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const key = toDateKey(viewYear, viewMonth, day);
                const dayAppts = apptByDate[key] ?? [];
                const isToday  = key === todayKey;
                const isPast   = key < todayKey;
                const colIdx   = (firstDay + i) % 7;
                return (
                  <div
                    key={day}
                    onClick={() => openBooking(key)}
                    style={{ minHeight: '88px', padding: '8px', borderRight: colIdx < 6 ? '1px solid var(--border-color)' : 'none', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', backgroundColor: isPast ? 'var(--surface-elevated)' : 'var(--surface-white)', transition: 'background-color 0.1s' }}
                    onMouseEnter={e => !isPast && ((e.currentTarget as HTMLDivElement).style.backgroundColor = `${BRAND}08`)}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.backgroundColor = isPast ? 'var(--surface-elevated)' : 'var(--surface-white)'}
                  >
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: isToday ? 800 : 500, backgroundColor: isToday ? BRAND : 'transparent', color: isToday ? '#fff' : isPast ? 'var(--text-secondary)' : 'var(--text-primary)', marginBottom: '4px' }}>
                      {day}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {dayAppts.slice(0, 2).map(appt => (
                        <div
                          key={appt.id}
                          onClick={e => { e.stopPropagation(); setDetailAppt(appt); }}
                          style={{ padding: '2px 5px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, backgroundColor: appt.status === 'completed' ? '#74C69D25' : appt.status === 'cancelled' ? '#d4183d15' : `${BRAND}18`, color: appt.status === 'cancelled' ? '#d4183d' : BRAND, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
                        >
                          {appt.time} {appt.pet}
                        </div>
                      ))}
                      {dayAppts.length > 2 && <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-secondary)', padding: '1px 4px' }}>+{dayAppts.length - 2} more</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Sidebar ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: '14px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar style={{ width: '15px', height: '15px', color: BRAND_TEXT }} />
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Upcoming</span>
              </div>
              <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {upcomingList.length === 0 && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '8px' }}>No upcoming appointments.</p>}
                {upcomingList.map(appt => (
                  <div key={appt.id} onClick={() => setDetailAppt(appt)} style={{ padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', border: `1px solid ${BRAND}20`, backgroundColor: `${BRAND}06`, transition: 'background-color 0.1s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.backgroundColor = `${BRAND}12`}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.backgroundColor = `${BRAND}06`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <Avatar style={{ width: '24px', height: '24px', flexShrink: 0 }}>
                        <AvatarImage src={appt.petImage} alt={appt.pet} style={{ objectFit: 'cover' }} />
                        <AvatarFallback style={{ fontSize: '9px' }}>{appt.pet[0]}</AvatarFallback>
                      </Avatar>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appt.reason}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', paddingLeft: '32px' }}>
                      <Clock style={{ width: '10px', height: '10px', color: 'var(--text-secondary)' }} />
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{appt.date.slice(5).replace('-', '/')} · {appt.time} · {appt.pet}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px 16px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>Legend</p>
              {[{ color: BRAND, label: 'Upcoming' }, { color: '#74C69D', label: 'Completed' }, { color: '#d4183d', label: 'Cancelled' }].map(({ color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: color, flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════
          BOOKING MODAL  —  matches admin form exactly
      ════════════════════════════════════════════════ */}
      {bookingOpen && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={() => setBookingOpen(false)}
        >
          <div
            style={{ backgroundColor: 'var(--surface-white)', borderRadius: '16px', width: '100%', maxWidth: '780px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.28)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* ── Modal Header (green) ── */}
            <div style={{ background: BRAND, padding: '18px 24px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Calendar style={{ width: '18px', height: '18px', color: '#fff' }} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.2 }}>
                      {formSubmitted ? 'Appointment Requested!' : 'Book Appointment'}
                    </h2>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', margin: 0 }}>
                      {formDate ? fmtDate(formDate) : 'Select a date below'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setBookingOpen(false)} style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X style={{ width: '15px', height: '15px', color: '#fff' }} />
                </button>
              </div>
            </div>

            {formSubmitted ? (
              /* ── Success ── */
              <div style={{ padding: '48px 32px', textAlign: 'center', flex: 1 }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#74C69D20', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                  <CheckCircle2 style={{ width: '32px', height: '32px', color: BRAND_TEXT }} />
                </div>
                <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>All Set!</p>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{formService}</strong> for <strong style={{ color: 'var(--text-primary)' }}>{formPet}</strong>
                </p>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>{fmtDate(formDate)} at {formTime}</p>
                <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: `${BRAND}08`, border: `1px solid ${BRAND}20`, marginBottom: '24px', textAlign: 'left' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                    📧 A confirmation will be sent via <strong>{confirmMethod}</strong>. A reminder will be sent <strong>{reminderTiming}</strong> before your appointment.
                  </p>
                </div>
                <button onClick={() => setBookingOpen(false)} style={{ padding: '12px 32px', borderRadius: '10px', backgroundColor: BRAND, color: '#fff', border: 'none', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>
                  Done
                </button>
              </div>
            ) : (
              /* ── Form body ── */
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 264px', flex: 1, minHeight: 0 }}>

                {/* Left: main fields */}
                <div style={{ padding: '22px 24px', overflowY: 'auto', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  {/* Pet selector */}
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Patient</p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {PETS.map(pet => (
                        <button
                          key={pet.name}
                          onClick={() => setFormPet(pet.name)}
                          style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', border: formPet === pet.name ? `2px solid ${BRAND}` : '2px solid var(--border-color)', backgroundColor: formPet === pet.name ? `${BRAND}0c` : 'transparent', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s' }}
                        >
                          <Avatar style={{ width: '32px', height: '32px', flexShrink: 0 }}>
                            <AvatarImage src={pet.image} alt={pet.name} style={{ objectFit: 'cover' }} />
                            <AvatarFallback style={{ fontSize: '11px' }}>{pet.name[0]}</AvatarFallback>
                          </Avatar>
                          <div style={{ textAlign: 'left' }}>
                            <p style={{ fontSize: '13px', fontWeight: 700, color: formPet === pet.name ? BRAND : 'var(--text-primary)', margin: 0 }}>{pet.name}</p>
                            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', margin: 0 }}>{pet.breed}</p>
                          </div>
                          {formPet === pet.name && <CheckCircle2 style={{ width: '14px', height: '14px', color: BRAND_TEXT, marginLeft: 'auto', flexShrink: 0 }} />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Service type grid — 4 cols with emojis */}
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Service Type</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                      {SERVICES.map(s => {
                        const active = formService === s.label;
                        return (
                          <button
                            key={s.label}
                            onClick={() => setFormService(s.label)}
                            style={{ padding: '8px 6px', borderRadius: '9px', fontSize: '11px', fontWeight: active ? 700 : 500, border: `1.5px solid ${active ? s.color : 'var(--border-color)'}`, backgroundColor: active ? `${s.color}18` : 'transparent', color: active ? s.color : 'var(--text-secondary)', cursor: 'pointer', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', transition: 'all 0.15s' }}
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
                      <input
                        type="date"
                        value={formDate}
                        onChange={e => setFormDate(e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)', color: 'var(--text-primary)', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
                      />
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Preferred Time</p>
                      <select
                        value={formTime}
                        onChange={e => setFormTime(e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)', color: 'var(--text-primary)', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}
                      >
                        {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Veterinarian */}
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Preferred Veterinarian</p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {VETS.map(v => {
                        const active = formVet === v.name;
                        return (
                          <button key={v.name} onClick={() => setFormVet(v.name)} style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: active ? 700 : 500, border: `1.5px solid ${active ? v.color : 'var(--border-color)'}`, backgroundColor: active ? `${v.color}18` : 'transparent', color: active ? v.color : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', transition: 'all 0.15s' }}>
                            <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: `${v.color}20`, color: v.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, flexShrink: 0 }}>{v.initials}</span>
                            {v.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Notes <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></p>
                    <textarea
                      value={formNotes}
                      onChange={e => setFormNotes(e.target.value)}
                      rows={3}
                      placeholder="Symptoms, concerns or special requests…"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '9px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)', color: 'var(--text-primary)', fontSize: '13px', resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', minHeight: '72px' }}
                    />
                  </div>
                </div>

                {/* Right: summary + notifications */}
                <div style={{ backgroundColor: 'var(--surface-elevated)', padding: '20px 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                  {/* Summary */}
                  <div style={{ backgroundColor: 'var(--surface-white)', borderRadius: '10px', padding: '14px', border: '1px solid var(--border-color)' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>Summary</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {[
                        { icon: Calendar, value: fmtDate(formDate) },
                        { icon: Clock,    value: formTime },
                        { icon: User,     value: formVet },
                      ].map(({ icon: Icon, value }) => (
                        <div key={value} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Icon style={{ width: '12px', height: '12px', color: 'var(--text-secondary)', flexShrink: 0 }} />
                          <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{value}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: serviceColor, flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{formService}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <PawPrint style={{ width: '12px', height: '12px', color: 'var(--text-secondary)', flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{formPet}</span>
                      </div>
                    </div>
                  </div>

                  {/* Notifications */}
                  <div style={{ backgroundColor: 'var(--surface-white)', borderRadius: '10px', padding: '14px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
                      <Bell style={{ width: '12px', height: '12px', color: 'var(--text-secondary)' }} />
                      <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>Notifications</p>
                    </div>
                    {/* Confirmation */}
                    <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>Confirmation</p>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                      {['Email','SMS','Both','None'].map(m => {
                        const active = confirmMethod === m;
                        return <button key={m} onClick={() => setConfirmMethod(m)} style={{ flex: 1, padding: '4px 2px', borderRadius: '6px', fontSize: '11px', fontWeight: active ? 700 : 400, border: `1.5px solid ${active ? BRAND : 'var(--border-color)'}`, backgroundColor: active ? `${BRAND}15` : 'transparent', color: active ? BRAND_TEXT : 'var(--text-secondary)', cursor: 'pointer' }}>{m}</button>;
                      })}
                    </div>
                    {/* Reminder */}
                    <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>Reminder</p>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: reminderMethod !== 'None' ? '8px' : '0' }}>
                      {['Email','SMS','Both','None'].map(m => {
                        const active = reminderMethod === m;
                        return <button key={m} onClick={() => setReminderMethod(m)} style={{ flex: 1, padding: '4px 2px', borderRadius: '6px', fontSize: '11px', fontWeight: active ? 700 : 400, border: `1.5px solid ${active ? BRAND : 'var(--border-color)'}`, backgroundColor: active ? `${BRAND}15` : 'transparent', color: active ? BRAND_TEXT : 'var(--text-secondary)', cursor: 'pointer' }}>{m}</button>;
                      })}
                    </div>
                    {reminderMethod !== 'None' && (
                      <>
                        <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Send before</p>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {['1 hr','4 hrs','1 day','2 days'].map(t => {
                            const active = reminderTiming === t;
                            return <button key={t} onClick={() => setReminderTiming(t)} style={{ padding: '4px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: active ? 700 : 400, border: `1.5px solid ${active ? BRAND : 'var(--border-color)'}`, backgroundColor: active ? `${BRAND}15` : 'transparent', color: active ? BRAND_TEXT : 'var(--text-secondary)', cursor: 'pointer' }}>{t}</button>;
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Footer ── */}
            {!formSubmitted && (
              <div style={{ borderTop: '1px solid var(--border-color)', padding: '14px 24px', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexShrink: 0, backgroundColor: 'var(--surface-white)' }}>
                <button onClick={() => setBookingOpen(false)} style={{ padding: '9px 20px', borderRadius: '9px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={handleBooking} style={{ padding: '9px 22px', borderRadius: '9px', backgroundColor: BRAND, color: '#fff', border: 'none', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <Calendar style={{ width: '15px', height: '15px' }} /> Request Appointment
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Detail modal ── */}
      {detailAppt && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={() => setDetailAppt(null)}>
          <div style={{ backgroundColor: 'var(--surface-white)', borderRadius: '18px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ background: BRAND, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: '16px', fontWeight: 800, color: '#fff', margin: 0 }}>Appointment Details</p>
              <button onClick={() => setDetailAppt(null)} style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X style={{ width: '14px', height: '14px', color: '#fff' }} />
              </button>
            </div>
            <div style={{ padding: '20px 22px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '9999px', backgroundColor: statusConf(detailAppt.status).bg, color: statusConf(detailAppt.status).text }}>
                  {statusConf(detailAppt.status).label}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', padding: '12px', borderRadius: '10px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-color)' }}>
                <Avatar style={{ width: '44px', height: '44px' }}>
                  <AvatarImage src={detailAppt.petImage} alt={detailAppt.pet} style={{ objectFit: 'cover' }} />
                  <AvatarFallback>{detailAppt.pet[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{detailAppt.reason}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>Patient: {detailAppt.pet}</p>
                </div>
              </div>
              {[
                { icon: Calendar, label: 'Date', value: new Date(detailAppt.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) },
                { icon: Clock, label: 'Time', value: detailAppt.time },
                { icon: PawPrint, label: 'Vet', value: detailAppt.vet },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: `${BRAND}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon style={{ width: '14px', height: '14px', color: BRAND_TEXT }} />
                  </div>
                  <div>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{label}</p>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: '2px 0 0' }}>{value}</p>
                  </div>
                </div>
              ))}
              {detailAppt.notes && (
                <div style={{ marginTop: '14px', padding: '12px', borderRadius: '9px', backgroundColor: `${BRAND}08`, border: `1px solid ${BRAND}20` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                    <FileText style={{ width: '12px', height: '12px', color: BRAND_TEXT }} />
                    <span style={{ fontSize: '10px', fontWeight: 700, color: BRAND_TEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notes</span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>{detailAppt.notes}</p>
                </div>
              )}
              {detailAppt.status === 'upcoming' && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
                  <button style={{ flex: 1, padding: '10px', borderRadius: '9px', backgroundColor: `${BRAND}12`, border: `1px solid ${BRAND}30`, color: BRAND_TEXT, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Reschedule</button>
                  <button onClick={() => { setAppointments(prev => prev.map(a => a.id === detailAppt.id ? { ...a, status: 'cancelled' as const } : a)); setDetailAppt(null); }} style={{ flex: 1, padding: '10px', borderRadius: '9px', backgroundColor: '#d4183d10', border: '1px solid #d4183d25', color: '#d4183d', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
