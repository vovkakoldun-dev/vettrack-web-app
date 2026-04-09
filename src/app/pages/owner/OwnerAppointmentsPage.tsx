import { useState, useMemo, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, X, Calendar, Clock, PawPrint,
  CheckCircle2, Plus, FileText, User,
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '../../components/ui/avatar';
import { useAppointments } from '../../hooks/useAppointments';
import { usePets } from '../../hooks/usePets';
import { useOwnerClient } from '../../hooks/useOwnerClient';
import { supabase } from '../../../lib/supabase';
import { getOrgContext } from '../../hooks/useOrgContext';

// ─── Brand ───────────────────────────────────────────────────
const BRAND = 'var(--brand-green-text)';
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
const SERVICES = [
  { label: 'Annual Checkup',  color: 'var(--brand-green-text)', emoji: '🩺' },
  { label: 'Vaccination',     color: '#3B82F6', emoji: '💉' },
  { label: 'Dental Cleaning', color: '#8B5CF6', emoji: '🦷' },
  { label: 'Surgery',         color: '#EC4899', emoji: '🔬' },
  { label: 'Follow-up',       color: '#F4A261', emoji: '📋' },
  { label: 'Emergency',       color: '#d4183d', emoji: '🚨' },
  { label: 'Consultation',    color: '#06B6D4', emoji: '💬' },
  { label: 'Other',           color: '#6B7280', emoji: '📝' },
];

// Colors cycled for dynamically-loaded vets
const VET_COLOR_PALETTE = ['var(--brand-green-text)', '#3B82F6', '#8B5CF6', '#EC4899', '#F4A261', '#06B6D4', '#10B981'];

interface VetOption {
  id: string;          // staff.id (= profile_id)
  name: string;        // "Dr. Smith"
  initials: string;    // "JS"
  color: string;
}

const DURATIONS = ['15 min', '30 min', '45 min', '60 min', '90 min'];

const TIME_SLOTS = [
  '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM',
];

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
  const { appointments: allAppts } = useAppointments();
  const { pets: allPets } = usePets();
  const { client, clientId } = useOwnerClient();

  // Derive this owner's pets from Supabase
  const ownerPets = useMemo(() => {
    if (!clientId) return [];
    return allPets.filter(p => p.client_id === clientId);
  }, [allPets, clientId]);

  // Filter appointments to only this owner's pets
  const supaAppts = useMemo(() => {
    if (!clientId) return allAppts;
    const myPetIds = new Set(allPets.filter(p => p.client_id === clientId).map(p => p.id));
    return allAppts.filter(a => a.pet_id && myPetIds.has(a.pet_id));
  }, [allAppts, allPets, clientId]);

  const mappedAppts: Appointment[] = useMemo(() =>
    supaAppts.map((a, idx) => {
      const dt = new Date(a.scheduled_at);
      const dateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      const h = dt.getHours(); const m = dt.getMinutes();
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

  // Real vets from Supabase staff table
  const [vets, setVets] = useState<VetOption[]>([]);

  // Form state — mirrors admin form fields
  const [formPetId,    setFormPetId]    = useState<string>('');
  const [formService,  setFormService]  = useState('Annual Checkup');
  const [formDate,     setFormDate]     = useState('');
  const [formTime,     setFormTime]     = useState('9:00 AM');
  const [formDuration, setFormDuration] = useState('30 min');
  const [formVetId,    setFormVetId]    = useState<string>('');
  const [formNotes,    setFormNotes]    = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState<string | null>(null);

  // Initialize form pet to first pet once loaded
  useEffect(() => {
    if (!formPetId && ownerPets.length > 0) setFormPetId(ownerPets[0].id);
  }, [ownerPets, formPetId]);

  // Fetch real vets (staff with vet roles) for this organization.
  // Uses two queries instead of a PostgREST nested join because the owner's
  // RLS policy on profiles isn't applied reliably through composite FKs.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { organizationId } = await getOrgContext();
        const { data: staffRows, error: staffErr } = await supabase
          .from('staff')
          .select('id')
          .eq('organization_id', organizationId)
          .in('role', ['veterinarian', 'senior_veterinarian', 'specialist'])
          .eq('status', 'Active');
        if (cancelled || staffErr || !staffRows || staffRows.length === 0) {
          if (!cancelled) setVets([]);
          return;
        }
        const ids = staffRows.map((s: any) => s.id);
        const { data: profileRows, error: profErr } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', ids);
        if (cancelled || profErr || !profileRows) return;
        const list: VetOption[] = profileRows.map((p: any, idx: number) => {
          const fn = p.first_name || '';
          const ln = p.last_name || '';
          const display = ln ? `Dr. ${ln}` : (fn ? `Dr. ${fn}` : 'Vet');
          const initials = ((fn[0] || '') + (ln[0] || '')).toUpperCase() || 'DR';
          return {
            id: p.id,
            name: display,
            initials,
            color: VET_COLOR_PALETTE[idx % VET_COLOR_PALETTE.length],
          };
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        if (!cancelled) setVets(list);
      } catch {
        // ignore — vets list stays empty
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Initialize form vet when list loads
  useEffect(() => {
    if (!formVetId && vets.length > 0) setFormVetId(vets[0].id);
  }, [vets, formVetId]);

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
    setFormPetId(ownerPets[0]?.id || '');
    setFormService('Annual Checkup');
    setFormTime('9:00 AM');
    setFormDuration('30 min');
    setFormVetId(vets[0]?.id || '');
    setFormNotes('');
    setSubmitError(null);
    setBookingOpen(true);
  };

  // Convert "9:00 AM" → "09:00"
  const to24h = (t: string): string | null => {
    const m = t.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = m[2];
    const ap = m[3].toUpperCase();
    if (ap === 'PM' && h < 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${min}`;
  };

  const handleBooking = async () => {
    if (!formDate || !formPetId || !clientId) {
      setSubmitError('Please select a pet and date.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { organizationId } = await getOrgContext();
      const selectedPet = ownerPets.find(p => p.id === formPetId);
      const selectedVet = vets.find(v => v.id === formVetId);
      const ownerName = client.fullName || 'pet owner';
      const vetName = selectedVet?.name || 'No preference';

      const notesLines = [
        `Appointment request from ${ownerName}`,
        `Service: ${formService}`,
        `Preferred vet: ${vetName}`,
        `Preferred time: ${formTime}`,
        `Duration: ${formDuration}`,
      ];
      if (formNotes.trim()) {
        notesLines.push('', 'Owner notes:', formNotes.trim());
      }

      const priority = formService === 'Emergency' ? 'Urgent' : 'Normal';

      const { error } = await supabase.from('tasks').insert({
        organization_id: organizationId,
        type: 'Schedule Appointment',
        priority,
        status: 'Pending',
        due_date: formDate,
        due_time: to24h(formTime),
        visit_date: todayKey,
        doctor_notes: notesLines.join('\n'),
        pet_id: formPetId,
        client_id: clientId,
        assigned_by_id: null,
        // Route the task to the preferred vet so they see it in their queue
        assigned_to_id: selectedVet?.id || null,
        tags: ['owner-request', formService],
      });

      if (error) {
        setSubmitError(error.message || 'Failed to submit request.');
        setSubmitting(false);
        return;
      }

      // Optimistic UI — add to local upcoming list
      if (selectedPet) {
        setAppointments(prev => [...prev, {
          id: Date.now(),
          date: formDate,
          time: formTime,
          reason: formService,
          pet: selectedPet.name,
          petImage: selectedPet.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedPet.name)}&background=74C69D&color=fff`,
          vet: vetName,
          status: 'upcoming',
          notes: formNotes || undefined,
        }]);
      }

      setFormSubmitted(true);
    } catch (e: any) {
      setSubmitError(e?.message || 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  const todayKey      = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const upcomingList  = appointments.filter(a => a.status === 'upcoming').sort((a,b) => a.date.localeCompare(b.date));
  // History: completed + cancelled, most recent first
  const historyList   = appointments
    .filter(a => a.status === 'completed' || a.status === 'cancelled')
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  const statusConf = (s: Appointment['status']) => ({
    upcoming:  { bg: 'color-mix(in srgb, var(--brand-green-text) 9%, transparent)', text: BRAND_TEXT, label: 'Upcoming' },
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
                    onMouseEnter={e => !isPast && ((e.currentTarget as HTMLDivElement).style.backgroundColor = 'color-mix(in srgb, var(--brand-green-text) 3%, transparent)')}
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
                          style={{ padding: '2px 5px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, backgroundColor: appt.status === 'completed' ? '#74C69D25' : appt.status === 'cancelled' ? '#d4183d15' : 'color-mix(in srgb, var(--brand-green-text) 9%, transparent)', color: appt.status === 'cancelled' ? '#d4183d' : BRAND, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
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
                  <div key={appt.id} onClick={() => setDetailAppt(appt)} style={{ padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', border: '1px solid color-mix(in srgb, var(--brand-green-text) 12%, transparent)', backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 2%, transparent)', transition: 'background-color 0.1s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.backgroundColor = 'color-mix(in srgb, var(--brand-green-text) 7%, transparent)'}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.backgroundColor = 'color-mix(in srgb, var(--brand-green-text) 2%, transparent)'}
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
            {/* History — completed & cancelled appointments */}
            <div style={{ backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: '14px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText style={{ width: '15px', height: '15px', color: BRAND_TEXT }} />
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>History</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', backgroundColor: 'var(--surface-elevated)', padding: '2px 8px', borderRadius: '10px' }}>{historyList.length}</span>
              </div>
              <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '360px', overflowY: 'auto' }}>
                {historyList.length === 0 && (
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '8px', margin: 0 }}>No past appointments yet.</p>
                )}
                {historyList.map(appt => {
                  const isCancelled = appt.status === 'cancelled';
                  const badgeBg = isCancelled ? '#d4183d15' : '#74C69D25';
                  const badgeText = isCancelled ? '#d4183d' : BRAND_TEXT;
                  const borderColor = isCancelled ? 'rgba(212,24,61,0.18)' : 'color-mix(in srgb, var(--brand-green-text) 12%, transparent)';
                  const bgColor = isCancelled ? 'rgba(212,24,61,0.03)' : 'color-mix(in srgb, var(--brand-green-text) 2%, transparent)';
                  const hoverBg = isCancelled ? 'rgba(212,24,61,0.07)' : 'color-mix(in srgb, var(--brand-green-text) 7%, transparent)';
                  return (
                    <div
                      key={appt.id}
                      onClick={() => setDetailAppt(appt)}
                      style={{ padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', border: `1px solid ${borderColor}`, backgroundColor: bgColor, transition: 'background-color 0.1s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.backgroundColor = hoverBg}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.backgroundColor = bgColor}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <Avatar style={{ width: '24px', height: '24px', flexShrink: 0 }}>
                          <AvatarImage src={appt.petImage} alt={appt.pet} style={{ objectFit: 'cover' }} />
                          <AvatarFallback style={{ fontSize: '9px' }}>{appt.pet[0]}</AvatarFallback>
                        </Avatar>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: isCancelled ? 'line-through' : 'none' }}>{appt.reason}</span>
                        <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: badgeBg, color: badgeText, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
                          {isCancelled ? 'Cancelled' : 'Done'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', paddingLeft: '32px' }}>
                        <Clock style={{ width: '10px', height: '10px', color: 'var(--text-secondary)' }} />
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{appt.date.slice(5).replace('-', '/')} · {appt.time} · {appt.pet}</span>
                      </div>
                    </div>
                  );
                })}
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
                  <strong style={{ color: 'var(--text-primary)' }}>{formService}</strong> for <strong style={{ color: 'var(--text-primary)' }}>{ownerPets.find(p => p.id === formPetId)?.name || 'your pet'}</strong>
                </p>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>{fmtDate(formDate)} at {formTime}</p>
                <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 3%, transparent)', border: '1px solid color-mix(in srgb, var(--brand-green-text) 12%, transparent)', marginBottom: '24px', textAlign: 'left' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                    Your request has been sent to the clinic. You'll hear back soon with a confirmation.
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
                    {ownerPets.length === 0 ? (
                      <div style={{ padding: '12px', borderRadius: '10px', border: '1px dashed var(--border-color)', backgroundColor: 'var(--surface-elevated)', color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center' }}>
                        No pets found. Add a pet to your account first.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {ownerPets.map(p => {
                          const active = formPetId === p.id;
                          const img = p.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=74C69D&color=fff`;
                          const subLabel = p.breed || p.species || '';
                          return (
                            <button
                              key={p.id}
                              onClick={() => setFormPetId(p.id)}
                              style={{ flex: '1 1 180px', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', border: active ? `2px solid ${BRAND}` : '2px solid var(--border-color)', backgroundColor: active ? 'color-mix(in srgb, var(--brand-green-text) 5%, transparent)' : 'transparent', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s' }}
                            >
                              <Avatar style={{ width: '32px', height: '32px', flexShrink: 0 }}>
                                <AvatarImage src={img} alt={p.name} style={{ objectFit: 'cover' }} />
                                <AvatarFallback style={{ fontSize: '11px' }}>{p.name[0]}</AvatarFallback>
                              </Avatar>
                              <div style={{ textAlign: 'left' }}>
                                <p style={{ fontSize: '13px', fontWeight: 700, color: active ? BRAND : 'var(--text-primary)', margin: 0 }}>{p.name}</p>
                                <p style={{ fontSize: '10px', color: 'var(--text-secondary)', margin: 0 }}>{subLabel}</p>
                              </div>
                              {active && <CheckCircle2 style={{ width: '14px', height: '14px', color: BRAND_TEXT, marginLeft: 'auto', flexShrink: 0 }} />}
                            </button>
                          );
                        })}
                      </div>
                    )}
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
                    {vets.length === 0 ? (
                      <div style={{ padding: '10px 12px', borderRadius: '8px', border: '1px dashed var(--border-color)', backgroundColor: 'var(--surface-elevated)', color: 'var(--text-secondary)', fontSize: '12px' }}>
                        Loading vets from clinic…
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {vets.map(v => {
                          const active = formVetId === v.id;
                          const tintBg = `color-mix(in srgb, ${v.color} 9%, transparent)`;
                          const bubbleBg = `color-mix(in srgb, ${v.color} 12%, transparent)`;
                          return (
                            <button key={v.id} onClick={() => setFormVetId(v.id)} style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: active ? 700 : 500, border: `1.5px solid ${active ? v.color : 'var(--border-color)'}`, backgroundColor: active ? tintBg : 'transparent', color: active ? v.color : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', transition: 'all 0.15s' }}>
                              <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: bubbleBg, color: v.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, flexShrink: 0 }}>{v.initials}</span>
                              {v.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
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
                        { icon: User,     value: vets.find(v => v.id === formVetId)?.name || 'No preference' },
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
                        <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{ownerPets.find(p => p.id === formPetId)?.name || '—'}</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* ── Footer ── */}
            {!formSubmitted && (
              <div style={{ borderTop: '1px solid var(--border-color)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', flexShrink: 0, backgroundColor: 'var(--surface-white)', flexWrap: 'wrap' }}>
                {submitError && (
                  <span style={{ fontSize: '12px', color: '#d4183d', marginRight: 'auto' }}>{submitError}</span>
                )}
                <button onClick={() => setBookingOpen(false)} disabled={submitting} style={{ padding: '9px 20px', borderRadius: '9px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
                  Cancel
                </button>
                <button
                  onClick={handleBooking}
                  disabled={submitting || !formDate || !formPetId || !clientId}
                  style={{
                    padding: '9px 22px',
                    borderRadius: '9px',
                    backgroundColor: BRAND,
                    color: '#fff',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: submitting || !formDate || !formPetId || !clientId ? 'not-allowed' : 'pointer',
                    opacity: submitting || !formDate || !formPetId || !clientId ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                  }}
                >
                  <Calendar style={{ width: '15px', height: '15px' }} />
                  {submitting ? 'Sending…' : 'Request Appointment'}
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
                  <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 7%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon style={{ width: '14px', height: '14px', color: BRAND_TEXT }} />
                  </div>
                  <div>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{label}</p>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: '2px 0 0' }}>{value}</p>
                  </div>
                </div>
              ))}
              {detailAppt.notes && (
                <div style={{ marginTop: '14px', padding: '12px', borderRadius: '9px', backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 3%, transparent)', border: '1px solid color-mix(in srgb, var(--brand-green-text) 12%, transparent)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                    <FileText style={{ width: '12px', height: '12px', color: BRAND_TEXT }} />
                    <span style={{ fontSize: '10px', fontWeight: 700, color: BRAND_TEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notes</span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>{detailAppt.notes}</p>
                </div>
              )}
              {detailAppt.status === 'upcoming' && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
                  <button style={{ flex: 1, padding: '10px', borderRadius: '9px', backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 7%, transparent)', border: '1px solid color-mix(in srgb, var(--brand-green-text) 19%, transparent)', color: BRAND_TEXT, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Reschedule</button>
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
