import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Calendar, Clock, AlertCircle, Syringe,
  FileText, MessageCircle, ChevronRight, Shield, PawPrint,
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { usePets } from '../../hooks/usePets';
import { useAppointments } from '../../hooks/useAppointments';
import { useOwnerClient } from '../../hooks/useOwnerClient';
import { supabase } from '../../../lib/supabase';

// ─── Brand ────────────────────────────────────────────────────

const BRAND = 'var(--brand-green-text)';
// For text/icon use — adapts to bright green in dark mode
const BRAND_TEXT = 'var(--brand-green-text)';

type PetStatus = 'Healthy' | 'Follow-up';
type VaxStatus = 'Up to date' | 'Due soon';
type ConditionStatus = 'active' | 'resolved';
type VisitStatus = 'Completed' | 'Upcoming';

interface Condition {
  id: string;
  name: string;
  dateDiagnosed: string;
  status: ConditionStatus;
}

interface Treatment {
  id: string;
  name: string;
  date: string;
  vet: string;
  notes: string;
}

interface Visit {
  id: number;
  date: string;
  reason: string;
  vet: string;
  summary: string;
  notes: string;
  status: VisitStatus;
}

interface Vaccination {
  id: string;
  name: string;
  status: VaxStatus;
  lastGiven: string;
  nextDue: string;
}

interface UpcomingAppt {
  id: number;
  time: string;
  date: string;
  reason: string;
}

interface Pet {
  id: number;
  name: string;
  species: string;
  breed: string;
  dob: string;
  age: string;
  sex: string;
  weight: string;
  microchip: string;
  color: string;
  image: string;
  status: PetStatus;
  conditions: Condition[];
  treatments: Treatment[];
  allergies: string[];
  visits: Visit[];
  vetNotes: string;
  clientNotes: string;
  upcomingAppointments: UpcomingAppt[];
  vaccinations: Vaccination[];
}

// ─── Helpers ──────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--surface-white)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px' }}>
      <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
      {action}
    </div>
  );
}

function StatCard({
  icon: Icon,
  color,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  color: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card style={{ padding: '14px' }}>
      {/* Icon */}
      <div
        style={{
          width: '36px', height: '36px', borderRadius: '9px',
          backgroundColor: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '10px',
        }}
      >
        <Icon style={{ width: '18px', height: '18px', color }} />
      </div>
      {/* Text — stacked vertically so narrow cards don't overflow */}
      <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>
        {label}
      </p>
      <p style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, marginBottom: '3px' }}>
        {value}
      </p>
      <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
        {sub}
      </p>
    </Card>
  );
}

// ─── Pet Avatar colors ────────────────────────────────────────
// BRAND_TEXT for text/border, '#3B82F6' for Hugo
const PET_COLORS = [BRAND_TEXT, '#3B82F6'];

// ─── Main Component ──────────────────────────────────────────

export default function OwnerDashboardPage() {
  const navigate = useNavigate();
  const [_selectedPet] = useState(0);
  const { pets: allPets } = usePets();
  const { appointments: supaAppts } = useAppointments();
  const { client: ownerClient, clientId } = useOwnerClient();

  // Filter pets to only show the logged-in owner's pets
  const supaPets = useMemo(() =>
    clientId ? allPets.filter(p => p.client_id === clientId) : allPets,
    [allPets, clientId],
  );

  // ── Fetch pet health data from Supabase ──
  const [petHealthData, setPetHealthData] = useState<Record<string, {
    conditions: any[];
    allergies: string[];
    vaccinations: any[];
    medications: any[];
  }>>({});

  useEffect(() => {
    if (supaPets.length === 0) return;
    const petIds = supaPets.map(p => p.id);
    Promise.all([
      supabase.from('pet_conditions').select('id, pet_id, name, severity, status, date_diagnosed').in('pet_id', petIds),
      supabase.from('pet_allergies').select('pet_id, allergen').in('pet_id', petIds),
      supabase.from('vaccinations').select('id, pet_id, vaccine_name, administered_date, next_due_date').in('pet_id', petIds).order('administered_date', { ascending: false }),
      supabase.from('medications').select('id, pet_id, name, dosage, frequency, is_active').in('pet_id', petIds).eq('is_active', true),
    ]).then(([condRes, allergyRes, vaxRes, medRes]) => {
      const map: Record<string, { conditions: any[]; allergies: string[]; vaccinations: any[]; medications: any[] }> = {};
      for (const pid of petIds) {
        map[pid] = {
          conditions: (condRes.data || []).filter((c: any) => c.pet_id === pid),
          allergies: (allergyRes.data || []).filter((a: any) => a.pet_id === pid).map((a: any) => a.allergen),
          vaccinations: (vaxRes.data || []).filter((v: any) => v.pet_id === pid),
          medications: (medRes.data || []).filter((m: any) => m.pet_id === pid),
        };
      }
      setPetHealthData(map);
    });
  }, [supaPets]);

  const pets: (Pet & { supaId: string })[] = useMemo(() =>
    supaPets.map((p, idx) => {
      const age = p.date_of_birth
        ? `${Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} years`
        : '—';
      // Find upcoming appointments for this pet
      const petAppts = supaAppts
        .filter(a => a.pet_id === p.id && new Date(a.scheduled_at) >= new Date())
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
        .map((a, i) => {
          const dt = new Date(a.scheduled_at);
          return {
            id: i + 1,
            time: dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            date: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            reason: a.reason ?? a.services?.name ?? 'Checkup',
          };
        });
      // Past appointments for visits
      const pastAppts = supaAppts
        .filter(a => a.pet_id === p.id && new Date(a.scheduled_at) < new Date())
        .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
        .map((a, i) => ({
          id: i + 1,
          date: new Date(a.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          reason: a.reason ?? a.services?.name ?? 'Visit',
          vet: a.staff?.profiles ? `Dr. ${a.staff.profiles.last_name}` : '—',
          summary: a.notes ?? 'Visit completed.',
          notes: a.reason ?? '',
          status: 'Completed' as VisitStatus,
        }));
      const health = petHealthData[p.id];
      const today = new Date();
      const dueSoonMs = 30 * 24 * 60 * 60 * 1000;
      return {
        id: idx + 1,
        supaId: p.id,
        name: p.name,
        species: p.species,
        breed: p.breed ?? '—',
        dob: p.date_of_birth ?? '—',
        age,
        sex: p.sex ?? '—',
        weight: p.weight_kg ? `${p.weight_kg} kg` : '—',
        microchip: p.microchip_no ?? '—',
        color: p.color ?? '—',
        image: p.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=74C69D&color=fff&size=400`,
        status: (health?.conditions.some((c: any) => c.status === 'active') ? 'Follow-up' : 'Healthy') as PetStatus,
        conditions: (health?.conditions || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          dateDiagnosed: c.date_diagnosed
            ? new Date(c.date_diagnosed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : '—',
          status: c.status as ConditionStatus,
        })),
        treatments: (health?.medications || []).map((m: any) => ({
          id: m.id,
          name: m.dosage ? `${m.name} (${m.dosage})` : m.name,
          date: '',
          vet: '',
          notes: m.frequency || '',
        })),
        allergies: health?.allergies || [],
        visits: pastAppts,
        vetNotes: '',
        clientNotes: pastAppts.length > 0 ? pastAppts[0].summary : '',
        upcomingAppointments: petAppts,
        vaccinations: (health?.vaccinations || []).map((v: any) => {
          const nextDue = v.next_due_date ? new Date(v.next_due_date) : null;
          const isDueSoon = nextDue && (nextDue.getTime() - today.getTime() < dueSoonMs);
          return {
            id: v.id,
            name: v.vaccine_name,
            status: (isDueSoon ? 'Due soon' : 'Up to date') as VaxStatus,
            lastGiven: v.administered_date
              ? new Date(v.administered_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : '—',
            nextDue: v.next_due_date
              ? new Date(v.next_due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : '—',
          };
        }),
      };
    }),
    [supaPets, supaAppts, petHealthData],
  );

  const allConditionsCount = pets.reduce(
    (acc, p) => acc + p.conditions.filter(c => c.status === 'active').length,
    0,
  );

  const allVaxDueSoon = pets.reduce<{ petName: string; vax: Vaccination }[]>((acc, p) => {
    const due = p.vaccinations.filter(v => v.status === 'Due soon');
    return [...acc, ...due.map(v => ({ petName: p.name, vax: v }))];
  }, []);

  const allVisits = pets
    .flatMap(p => p.visits.map(v => ({ ...v, petName: p.name, petImage: p.image })))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)' }} className="p-4 md:p-8">
      <div style={{ maxWidth: '1440px', margin: '0 auto' }}>

        {/* ── A. Welcome Header ── */}
        <Card style={{ marginBottom: '24px', borderTop: `4px solid ${BRAND}` }}>
          <div className="p-6 md:p-8" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Welcome back, {ownerClient.firstName || 'there'}! 👋
              </h1>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>
                {supaPets.length > 0
                  ? `Here's an overview of ${supaPets.map(p => p.name).join(' & ')}`
                  : 'Here\'s your pet overview'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/owner/appointments')}
                style={{
                  padding: '10px 20px', borderRadius: '10px',
                  backgroundColor: BRAND, color: '#fff',
                  border: 'none', fontSize: '14px', fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <Calendar style={{ width: '16px', height: '16px' }} />
                Book Appointment
              </button>
              <button
                onClick={() => navigate('/owner/messages')}
                style={{
                  padding: '10px 20px', borderRadius: '10px',
                  backgroundColor: 'transparent', color: BRAND_TEXT,
                  border: `1.5px solid ${BRAND}`,
                  fontSize: '14px', fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'color-mix(in srgb, var(--brand-green-text) 6%, transparent)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                <MessageCircle style={{ width: '16px', height: '16px' }} />
                Message Vet
              </button>
            </div>
          </div>
        </Card>

        {/* ── B. Stats Row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={Calendar}
            color={BRAND}
            label="Next Appointment"
            value={(() => {
              const next = pets.flatMap(p => p.upcomingAppointments).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
              return next ? `${next.date.replace(/,\s*\d{4}$/, '')} · ${next.time}` : 'None scheduled';
            })()}
            sub={(() => {
              const next = pets.flatMap(p => p.upcomingAppointments)[0];
              return next ? next.reason : 'Book an appointment';
            })()}
          />
          <StatCard
            icon={Clock}
            color="#3B82F6"
            label="Last Visit"
            value={allVisits.length > 0 ? allVisits[0].date : 'No visits yet'}
            sub={allVisits.length > 0 ? allVisits[0].reason : '—'}
          />
          <StatCard
            icon={AlertCircle}
            color="#F59E0B"
            label="Active Conditions"
            value={String(allConditionsCount)}
            sub={allConditionsCount > 0 ? `Across ${pets.length > 1 ? 'all pets' : 'your pet'}` : 'None recorded'}
          />
          <StatCard
            icon={Syringe}
            color="#EF4444"
            label="Vaccines Due"
            value={String(allVaxDueSoon.length)}
            sub={allVaxDueSoon.length > 0 ? allVaxDueSoon.map(v => v.vax.name).join(', ') : 'All up to date'}
          />
        </div>

        {/* ── C. Two-Column Main Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 items-start">

          {/* ── LEFT COLUMN ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Pet Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pets.map((pet, idx) => {
                const activeConditions = pet.conditions.filter(c => c.status === 'active');
                const recentMeds = pet.treatments.slice(0, 2);
                const statusColors = pet.status === 'Healthy'
                  ? { bg: '#74C69D20', text: BRAND_TEXT }
                  : { bg: '#F4A26120', text: '#F4A261' };

                return (
                  <Card key={pet.id} style={{ overflow: 'hidden' }}>
                    {/* Pet image + header */}
                    <div style={{ position: 'relative', height: '140px', overflow: 'hidden' }}>
                      <img
                        src={pet.image}
                        alt={pet.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.55))',
                      }} />
                      <div style={{ position: 'absolute', bottom: '10px', left: '12px', right: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                          <p style={{ fontSize: '20px', fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>{pet.name}</p>
                          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>{pet.breed}</p>
                        </div>
                        <span style={{
                          fontSize: '11px', fontWeight: 700, padding: '3px 10px',
                          borderRadius: '9999px',
                          backgroundColor: '#fff',
                          color: pet.status === 'Healthy' ? BRAND : '#D97706',
                          boxShadow: '0 1px 6px rgba(0,0,0,0.2)',
                        }}>
                          {pet.status}
                        </span>
                      </div>
                    </div>

                    <div style={{ padding: '16px' }}>
                      {/* Pet info grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginBottom: '14px' }}>
                        {[
                          ['Age', pet.age],
                          ['Sex', pet.sex],
                          ['Weight', pet.weight],
                          ['Species', pet.species],
                        ].map(([label, val]) => (
                          <div key={label}>
                            <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{val}</p>
                          </div>
                        ))}
                      </div>

                      {/* Active conditions */}
                      {activeConditions.length > 0 && (
                        <div style={{ marginBottom: '12px' }}>
                          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                            Active Conditions
                          </p>
                          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {activeConditions.map(c => (
                              <li key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#F59E0B', flexShrink: 0 }} />
                                <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{c.name}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Current medications */}
                      <div style={{ marginBottom: '14px' }}>
                        <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                          Current Medications
                        </p>
                        {recentMeds.map(m => (
                          <div key={m.id} style={{
                            fontSize: '12px', padding: '5px 8px', borderRadius: '6px',
                            backgroundColor: 'var(--surface-elevated)',
                            color: 'var(--text-primary)', marginBottom: '4px',
                          }}>
                            <span style={{ fontWeight: 600 }}>{m.name}</span>
                          </div>
                        ))}
                      </div>

                      {/* View full record */}
                      <button
                        onClick={() => navigate(`/owner/pets/${pet.supaId}`)}
                        style={{
                          width: '100%', padding: '8px', borderRadius: '8px',
                          border: `1.5px solid ${PET_COLORS[idx]}`,
                          backgroundColor: 'transparent',
                          color: PET_COLORS[idx],
                          fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                          transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = `${PET_COLORS[idx]}10`; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                      >
                        <PawPrint style={{ width: '14px', height: '14px' }} />
                        See {pet.name}'s Profile
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Recent Visits */}
            <Card>
              <CardHeader
                title="Recent Visits"
                action={
                  <button
                    onClick={() => navigate('/owner/records')}
                    style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    View all <ChevronRight style={{ width: '13px', height: '13px' }} />
                  </button>
                }
              />
              <div style={{ borderTop: '1px solid var(--border-color)' }}>
                {allVisits.map((visit, idx) => (
                  <div
                    key={`${visit.petName}-${visit.id}`}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '14px',
                      padding: '16px 20px',
                      borderBottom: idx < allVisits.length - 1 ? '1px solid var(--border-color)' : 'none',
                    }}
                  >
                    <Avatar style={{ width: '40px', height: '40px', flexShrink: 0 }}>
                      <AvatarImage src={visit.petImage} alt={visit.petName} style={{ objectFit: 'cover' }} />
                      <AvatarFallback style={{ fontSize: '12px', fontWeight: 700 }}>{visit.petName.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{visit.reason}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>· {visit.petName}</span>
                        <Badge
                          variant="secondary"
                          style={{ fontSize: '11px', backgroundColor: '#74C69D20', color: BRAND_TEXT, border: 'none' }}
                        >
                          {visit.status}
                        </Badge>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                        {visit.date} · {visit.vet}
                      </p>
                      <p style={{ fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {visit.summary}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Message from Vet */}
            {allVisits.length > 0 && (
              <Card>
                <CardHeader title={`Message from ${allVisits[0].vet}`} />
                <div style={{ padding: '0 20px 20px' }}>
                  <div style={{
                    padding: '16px', borderRadius: '10px',
                    backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 3%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--brand-green-text) 19%, transparent)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--brand-green-text), #52B788)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>
                          {allVisits[0].vet.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{allVisits[0].vet}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{allVisits[0].date}</p>
                      </div>
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                      {allVisits[0].summary || 'No notes from this visit.'}
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Upcoming Appointments */}
            <Card>
              <CardHeader
                title="Upcoming Appointments"
                action={
                  <button
                    onClick={() => navigate('/owner/appointments')}
                    style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    View all <ChevronRight style={{ width: '13px', height: '13px' }} />
                  </button>
                }
              />
              <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pets.map((pet, idx) =>
                  pet.upcomingAppointments.map(appt => (
                    <div
                      key={`${pet.id}-${appt.id}`}
                      style={{
                        padding: '14px', borderRadius: '10px',
                        backgroundColor: 'var(--surface-elevated)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <div
                          style={{
                            width: '36px', height: '36px', borderRadius: '50%',
                            backgroundColor: `${PET_COLORS[idx]}20`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                            overflow: 'hidden',
                          }}
                        >
                          <Avatar style={{ width: '36px', height: '36px' }}>
                            <AvatarImage src={pet.image} alt={pet.name} style={{ objectFit: 'cover' }} />
                            <AvatarFallback style={{ fontSize: '11px', fontWeight: 700, backgroundColor: `${PET_COLORS[idx]}20`, color: PET_COLORS[idx] }}>
                              {pet.name.slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{pet.name}</p>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{appt.reason}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                        <Calendar style={{ width: '13px', height: '13px', color: 'var(--text-secondary)', flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {appt.date} · {appt.time}
                        </span>
                      </div>
                      <button
                        style={{
                          width: '100%', padding: '7px', borderRadius: '7px',
                          backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)',
                          border: '1px solid color-mix(in srgb, var(--brand-green-text) 19%, transparent)',
                          color: BRAND_TEXT, fontSize: '12px', fontWeight: 700,
                          cursor: 'pointer', transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'color-mix(in srgb, var(--brand-green-text) 14%, transparent)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)'; }}
                      >
                        Reschedule
                      </button>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Vaccination Status */}
            <Card>
              <CardHeader title="Vaccination Status" />
              <div style={{ padding: '0 16px 16px' }}>
                {pets.map((pet, pidx) => (
                  <div key={pet.id} style={{ marginBottom: pidx < pets.length - 1 ? '16px' : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Avatar style={{ width: '24px', height: '24px' }}>
                        <AvatarImage src={pet.image} alt={pet.name} style={{ objectFit: 'cover' }} />
                        <AvatarFallback style={{ fontSize: '9px', fontWeight: 700 }}>{pet.name.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{pet.name}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {pet.vaccinations.map(vax => (
                        <div key={vax.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{vax.name}</span>
                          <span style={{
                            fontSize: '10px', fontWeight: 700, padding: '2px 7px',
                            borderRadius: '9999px',
                            backgroundColor: vax.status === 'Up to date' ? '#74C69D20' : '#F59E0B20',
                            color: vax.status === 'Up to date' ? BRAND_TEXT : '#D97706',
                          }}>
                            {vax.status}
                          </span>
                        </div>
                      ))}
                    </div>
                    {pidx < pets.length - 1 && (
                      <div style={{ height: '1px', backgroundColor: 'var(--border-color)', marginTop: '12px' }} />
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Insurance Card */}
            <Card>
              <CardHeader title="Insurance" />
              <div style={{ padding: '0 16px 16px' }}>
                {supaPets.some(p => p.insurance_no) ? (
                  <div style={{
                    padding: '14px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-green-text) 7%, transparent), #52B78812)',
                    border: '1px solid var(--border-color)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '34px', height: '34px', borderRadius: '8px',
                          backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 12%, transparent)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Shield style={{ width: '18px', height: '18px', color: BRAND_TEXT }} />
                        </div>
                        <div>
                          <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Pet Insurance</p>
                          <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Policy on file</p>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '3px 8px',
                        borderRadius: '9999px',
                        backgroundColor: '#74C69D20',
                        color: BRAND_TEXT,
                      }}>
                        Active
                      </span>
                    </div>
                    {supaPets.filter(p => p.insurance_no).map(p => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{p.name}</span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{p.insurance_no}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    padding: '20px', borderRadius: '10px',
                    border: '1px dashed var(--border-color)',
                    textAlign: 'center',
                  }}>
                    <Shield style={{ width: '24px', height: '24px', color: 'var(--text-secondary)', margin: '0 auto 8px', opacity: 0.4 }} />
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>No insurance on file</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

      </div>
    </div>
  );
}
