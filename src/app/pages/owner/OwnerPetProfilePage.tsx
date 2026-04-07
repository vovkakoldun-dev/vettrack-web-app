import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ArrowLeft, Calendar, Syringe, FileText,
  AlertCircle, CheckCircle2, ChevronRight, PawPrint,
  Heart, Scale, Dna, Palette, Clock, MessageCircle, Camera,
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '../../components/ui/table';
import { Separator } from '../../components/ui/separator';
import { usePets } from '../../hooks/usePets';
import { useAppointments } from '../../hooks/useAppointments';
import { useOwnerClient } from '../../hooks/useOwnerClient';
import { supabase } from '../../../lib/supabase';

// ─── Brand ───────────────────────────────────────────────────
const BRAND = 'var(--brand-green-text)';
const BRAND_TEXT = 'var(--brand-green-text)';

// ─── Helpers ─────────────────────────────────────────────────
function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
function calcAge(dob: string | null): string {
  if (!dob) return '—';
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return `${years} years`;
}

// ─── Banner default (used when the clinic hasn't set one) ────
const DEFAULT_BANNER_GRADIENT =
  'linear-gradient(135deg, #1B4332 0%, var(--brand-green-text) 50%, #52B788 100%)';

interface ClinicBranding {
  banner_image_url: string | null;
  banner_gradient: string | null;
  banner_text: string | null;
  logo_image_url: string | null;
}

// ─── Status config ────────────────────────────────────────────
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Healthy:     { bg: '#74C69D20', text: BRAND_TEXT },
  'Follow-up': { bg: '#F4A26120', text: '#F4A261' },
  Critical:    { bg: '#d4183d20', text: '#d4183d' },
};

// ─── Main Component ──────────────────────────────────────────
export default function OwnerPetProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pets: allPets } = usePets();
  const { appointments: allAppts } = useAppointments();
  const { clientId } = useOwnerClient();

  // Filter to this owner's pets
  const myPets = useMemo(() =>
    clientId ? allPets.filter(p => p.client_id === clientId) : allPets,
    [allPets, clientId],
  );

  // Find current pet by URL param (real UUID)
  const supaPet = myPets.find(p => p.id === id) ?? myPets[0];

  // Fetch vaccinations for this pet
  const [vaccinations, setVaccinations] = useState<{ id: string; name: string; status: 'Up to date' | 'Due soon'; lastGiven: string; nextDue: string }[]>([]);
  useEffect(() => {
    if (!supaPet?.id) return;
    supabase
      .from('vaccinations')
      .select('id, vaccine_name, administered_date, next_due_date')
      .eq('pet_id', supaPet.id)
      .order('administered_date', { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        const now = new Date();
        setVaccinations(data.map(v => {
          const nextDue = v.next_due_date ? new Date(v.next_due_date) : null;
          const isDueSoon = nextDue ? nextDue <= new Date(now.getTime() + 30 * 86400000) : false;
          return {
            id: v.id,
            name: v.vaccine_name,
            status: isDueSoon ? 'Due soon' as const : 'Up to date' as const,
            lastGiven: fmtDate(v.administered_date),
            nextDue: fmtDate(v.next_due_date),
          };
        }));
      });
  }, [supaPet?.id]);

  // Build pet object from real data
  const pet = useMemo(() => {
    if (!supaPet) return null;
    const petAppts = allAppts
      .filter(a => a.pet_id === supaPet.id && new Date(a.scheduled_at) >= new Date())
      .map(a => {
        const dt = new Date(a.scheduled_at);
        return {
          id: a.id,
          time: dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }),
          date: fmtDate(a.scheduled_at),
          reason: a.reason ?? a.services?.name ?? 'Checkup',
        };
      });

    const pastAppts = allAppts
      .filter(a => a.pet_id === supaPet.id && new Date(a.scheduled_at) < new Date())
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
      .map((a, i) => ({
        id: i + 1,
        date: fmtDate(a.scheduled_at),
        reason: a.reason ?? a.services?.name ?? 'Visit',
        vet: a.staff?.profiles ? `Dr. ${a.staff.profiles.last_name}` : '—',
        summary: a.notes ?? 'Visit completed.',
        notes: a.reason ?? '',
        status: 'Completed' as const,
      }));

    return {
      id: supaPet.id,
      name: supaPet.name,
      species: supaPet.species,
      breed: supaPet.breed ?? '—',
      dob: supaPet.date_of_birth ?? '—',
      age: calcAge(supaPet.date_of_birth),
      sex: supaPet.sex ?? '—',
      weight: supaPet.weight_kg ? `${supaPet.weight_kg} kg` : '—',
      microchip: supaPet.microchip_no ?? '—',
      color: '—',
      image: supaPet.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(supaPet.name)}&background=74C69D&color=fff&size=400`,
      status: 'Healthy' as const,
      conditions: [] as { id: number; name: string; dateDiagnosed: string; status: 'active' | 'resolved' }[],
      treatments: [] as { id: number; name: string; date: string; vet: string; notes: string }[],
      allergies: [] as string[],
      visits: pastAppts,
      clientNotes: pastAppts.length > 0 ? pastAppts[0].summary : '',
      lastVetName: pastAppts.length > 0 ? pastAppts[0].vet : '',
      lastVetDate: pastAppts.length > 0 ? pastAppts[0].date : '',
      upcomingAppointments: petAppts,
      vaccinations,
    };
  }, [supaPet, allAppts, vaccinations]);

  // Other pets for switcher
  const otherPets = myPets.filter(p => p.id !== id);

  const statusColor = STATUS_COLORS[pet?.status ?? 'Healthy'] ?? STATUS_COLORS.Healthy;

  const [expandedVisit, setExpandedVisit] = useState<number | null>(null);

  // ── Clinic banner / branding (set centrally by super admin) ─
  const [clinicBranding, setClinicBranding] = useState<ClinicBranding | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('clinics')
        .select('banner_image_url, banner_gradient, banner_text, logo_image_url')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (alive && data) setClinicBranding(data as ClinicBranding);
    })();
    return () => { alive = false; };
  }, []);

  const bannerHasImage = !!clinicBranding?.banner_image_url;
  const bannerGradient = clinicBranding?.banner_gradient || DEFAULT_BANNER_GRADIENT;
  const bannerText = clinicBranding?.banner_text || '';
  const clinicLogoUrl = clinicBranding?.logo_image_url || null;
  const bannerBackground = bannerHasImage
    ? `url(${clinicBranding?.banner_image_url}) center/cover no-repeat`
    : bannerGradient;

  const activeConditions = pet?.conditions.filter((c) => c.status === 'active') ?? [];
  const resolvedConditions = pet?.conditions.filter((c) => c.status === 'resolved') ?? [];

  if (!pet) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading pet profile...</div>;

  return (
    <div className="p-4 md:p-8" style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* ── Back ── */}
        <button
          onClick={() => navigate('/owner')}
          className="inline-flex items-center gap-2 hover:text-[var(--text-primary)] transition-colors mb-6"
          style={{ fontSize: '14px', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <ArrowLeft style={{ width: '16px', height: '16px' }} />
          Back to Dashboard
        </button>

        {/* ── Header card ── */}
        <div
          style={{
            backgroundColor: 'var(--surface-white)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            overflow: 'hidden',
            marginBottom: '24px',
          }}
        >
          {/* Banner — clinic-wide branding set centrally by super admin */}
          <div style={{ position: 'relative', height: '160px', background: bannerBackground, overflow: 'hidden' }}>
            {/* Subtle paw pattern overlay */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)`,
              backgroundSize: '28px 28px',
              pointerEvents: 'none',
            }} />
            {/* Bottom fade */}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.18))', pointerEvents: 'none' }} />

            {/* Centered clinic logo + text overlay (uploaded by super admin) */}
            {(clinicLogoUrl || bannerText) && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '8px', textAlign: 'center', padding: '12px',
                pointerEvents: 'none',
              }}>
                {clinicLogoUrl && (
                  <div style={{
                    width: 60, height: 60, borderRadius: '12px',
                    backgroundColor: 'rgba(255,255,255,0.92)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
                    padding: 6,
                  }}>
                    <img
                      src={clinicLogoUrl}
                      alt="Clinic logo"
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                  </div>
                )}
                {bannerText && (
                  <p style={{
                    color: '#fff', fontSize: '18px', fontWeight: 700,
                    textShadow: '0 2px 8px rgba(0,0,0,0.45)',
                    margin: 0, maxWidth: '90%',
                  }}>
                    {bannerText}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Profile row */}
          <div style={{ padding: '0 24px 24px', position: 'relative' }}>
            {/* Avatar — overlaps cover */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
                {/* Avatar with change-photo overlay */}
                <div style={{ position: 'relative', marginTop: '-44px', flexShrink: 0 }}>
                  <Avatar
                    style={{
                      width: '88px', height: '88px',
                      border: '4px solid var(--surface-white)',
                      borderRadius: '50%',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                      display: 'block',
                    }}
                  >
                    <AvatarImage src={pet.image} alt={pet.name} style={{ objectFit: 'cover' }} />
                    <AvatarFallback style={{ fontSize: '24px', fontWeight: 700 }}>{pet.name.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  {/* Camera icon */}
                  <button
                    title="Change photo"
                    style={{
                      position: 'absolute', bottom: '2px', right: '2px',
                      width: '26px', height: '26px', borderRadius: '50%',
                      backgroundColor: BRAND,
                      border: '2px solid var(--surface-white)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                    }}
                  >
                    <Camera style={{ width: '12px', height: '12px', color: '#fff' }} />
                  </button>
                </div>
                <div style={{ paddingBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{pet.name}</h1>
                    <span style={{
                      fontSize: '13px', fontWeight: 700, padding: '3px 10px', borderRadius: '9999px',
                      backgroundColor: statusColor.bg, color: statusColor.text,
                    }}>
                      {pet.status === 'Healthy'
                        ? <><CheckCircle2 style={{ width: '12px', height: '12px', display: 'inline', marginRight: '4px' }} />{pet.status}</>
                        : <><AlertCircle style={{ width: '12px', height: '12px', display: 'inline', marginRight: '4px' }} />{pet.status}</>
                      }
                    </span>
                  </div>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '3px 0 0' }}>
                    {pet.breed} · {pet.species} · {pet.age}
                  </p>
                </div>
              </div>

              {/* Action buttons + pet switcher */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* Switch pet */}
                {otherPets.length > 0 && (
                  <button
                    onClick={() => navigate(`/owner/pets/${otherPets[0].id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 14px', borderRadius: '9px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--surface-elevated)',
                      fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    <Avatar style={{ width: '22px', height: '22px' }}>
                      <AvatarImage src={otherPets[0].image} alt={otherPets[0].name} style={{ objectFit: 'cover' }} />
                      <AvatarFallback style={{ fontSize: '9px' }}>{otherPets[0].name[0]}</AvatarFallback>
                    </Avatar>
                    Switch to {otherPets[0].name}
                  </button>
                )}
                <button
                  onClick={() => navigate('/owner/appointments')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '9px 18px', borderRadius: '9px',
                    backgroundColor: BRAND, color: '#fff',
                    border: 'none', fontSize: '13px', fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Calendar style={{ width: '14px', height: '14px' }} />
                  Book Appointment
                </button>
              </div>
            </div>

            {/* Quick stats row */}
            <div
              className="grid grid-cols-2 sm:grid-cols-4"
              style={{ marginTop: '20px', gap: '1px', backgroundColor: 'var(--border-color)', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color)' }}
            >
              {[
                { icon: Scale,   label: 'Weight',    value: pet.weight },
                { icon: Heart,   label: 'Sex',       value: pet.sex },
                { icon: Dna,     label: 'Microchip', value: pet.microchip },
                { icon: Palette, label: 'Color',     value: pet.color },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} style={{ backgroundColor: 'var(--surface-elevated)', padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <Icon style={{ width: '13px', height: '13px', color: BRAND_TEXT, flexShrink: 0 }} />
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
                  </div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <Tabs defaultValue="overview">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">
              <PawPrint style={{ width: '14px', height: '14px', marginRight: '6px' }} /> Overview
            </TabsTrigger>
            <TabsTrigger value="records">
              <FileText style={{ width: '14px', height: '14px', marginRight: '6px' }} /> Visit Records
            </TabsTrigger>
            <TabsTrigger value="vaccinations">
              <Syringe style={{ width: '14px', height: '14px', marginRight: '6px' }} /> Vaccinations
            </TabsTrigger>
            <TabsTrigger value="appointments">
              <Calendar style={{ width: '14px', height: '14px', marginRight: '6px' }} /> Appointments
            </TabsTrigger>
          </TabsList>

          {/* ── OVERVIEW TAB ── */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">

              {/* Left */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Conditions */}
                <div style={{ backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle style={{ width: '16px', height: '16px', color: BRAND_TEXT }} />
                    <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Health Conditions</span>
                  </div>
                  <div style={{ padding: '16px 20px' }}>
                    {pet.conditions.length === 0 ? (
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No recorded conditions.</p>
                    ) : (
                      <>
                        {activeConditions.length > 0 && (
                          <div style={{ marginBottom: resolvedConditions.length > 0 ? '14px' : 0 }}>
                            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Active</p>
                            {activeConditions.map((c) => (
                              <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', backgroundColor: '#F4A26110', marginBottom: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#F4A261', flexShrink: 0, display: 'inline-block' }} />
                                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</span>
                                </div>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Since {c.dateDiagnosed}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {resolvedConditions.length > 0 && (
                          <div>
                            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Resolved</p>
                            {resolvedConditions.map((c) => (
                              <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'var(--surface-elevated)', marginBottom: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#74C69D', flexShrink: 0, display: 'inline-block' }} />
                                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{c.name}</span>
                                </div>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{c.dateDiagnosed}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Current Medications */}
                <div style={{ backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText style={{ width: '16px', height: '16px', color: BRAND_TEXT }} />
                    <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Current Medications</span>
                  </div>
                  <div style={{ padding: '8px' }}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Medication</TableHead>
                          <TableHead>Date Prescribed</TableHead>
                          <TableHead>Vet</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pet.treatments.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell style={{ fontWeight: 600 }}>{t.name}</TableCell>
                            <TableCell>{t.date}</TableCell>
                            <TableCell>{t.vet}</TableCell>
                            <TableCell style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{t.notes}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Allergies */}
                <div style={{ backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px 20px' }}>
                  <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>Known Allergies</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {pet.allergies.length === 0
                      ? <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No known allergies</span>
                      : pet.allergies.map((a) => (
                          <Badge key={a} style={{ backgroundColor: '#d4183d12', color: '#d4183d', border: '1px solid #d4183d30', fontSize: '13px' }}>
                            {a}
                          </Badge>
                        ))
                    }
                  </div>
                </div>
              </div>

              {/* Right */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Message from vet */}
                <div style={{ backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MessageCircle style={{ width: '16px', height: '16px', color: BRAND_TEXT }} />
                    <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Note from Your Vet</span>
                  </div>
                  <div style={{ padding: '16px 20px' }}>
                    {pet.lastVetName ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand-green-text), #52B788)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>{pet.lastVetName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                          </div>
                          <div>
                            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{pet.lastVetName}</p>
                            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>{pet.lastVetDate}</p>
                          </div>
                        </div>
                        <div style={{ padding: '12px', borderRadius: '9px', backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 3%, transparent)', border: '1px solid color-mix(in srgb, var(--brand-green-text) 12%, transparent)' }}>
                          <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>
                            {pet.clientNotes || 'No notes from this visit.'}
                          </p>
                        </div>
                      </>
                    ) : (
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>No vet notes yet.</p>
                    )}
                  </div>
                </div>

                {/* Upcoming appointments */}
                <div style={{ backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar style={{ width: '16px', height: '16px', color: BRAND_TEXT }} />
                      <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Upcoming</span>
                    </div>
                    <button
                      onClick={() => navigate('/owner/appointments')}
                      style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      View all <ChevronRight style={{ width: '13px', height: '13px' }} />
                    </button>
                  </div>
                  <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {pet.upcomingAppointments.map((appt) => (
                      <div key={appt.id} style={{ padding: '12px', borderRadius: '9px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-color)' }}>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{appt.reason}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Clock style={{ width: '12px', height: '12px', color: 'var(--text-secondary)' }} />
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{appt.date} · {appt.time}</span>
                        </div>
                      </div>
                    ))}
                    {pet.upcomingAppointments.length === 0 && (
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '4px 0' }}>No upcoming appointments.</p>
                    )}
                  </div>
                </div>

                {/* Vaccination summary */}
                <div style={{ backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Syringe style={{ width: '16px', height: '16px', color: BRAND_TEXT }} />
                    <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Vaccination Summary</span>
                  </div>
                  <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {pet.vaccinations.map((vax) => (
                      <div key={vax.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{vax.name}</span>
                        <span style={{
                          fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px',
                          backgroundColor: vax.status === 'Up to date' ? '#74C69D20' : '#F59E0B20',
                          color: vax.status === 'Up to date' ? BRAND_TEXT : '#D97706',
                        }}>
                          {vax.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── VISIT RECORDS TAB ── */}
          <TabsContent value="records">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pet.visits.map((visit) => (
                <div
                  key={visit.id}
                  style={{ backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}
                >
                  {/* Summary row */}
                  <button
                    onClick={() => setExpandedVisit(expandedVisit === visit.id ? null : visit.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '16px',
                      padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText style={{ width: '18px', height: '18px', color: BRAND_TEXT }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{visit.reason}</span>
                        <Badge variant="secondary" style={{ fontSize: '11px', backgroundColor: '#74C69D20', color: BRAND_TEXT, border: 'none' }}>
                          {visit.status}
                        </Badge>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                        {visit.date} · {visit.vet}
                      </p>
                    </div>
                    <ChevronRight
                      style={{
                        width: '16px', height: '16px', color: 'var(--text-secondary)',
                        transform: expandedVisit === visit.id ? 'rotate(90deg)' : 'rotate(0)',
                        transition: 'transform 0.15s', flexShrink: 0,
                      }}
                    />
                  </button>

                  {/* Expanded detail */}
                  {expandedVisit === visit.id && (
                    <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border-color)' }}>
                      <div style={{ paddingTop: '16px' }}>
                        <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>Summary</p>
                        <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: '16px' }}>{visit.summary}</p>
                        <Separator style={{ marginBottom: '16px' }} />
                        <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>Clinical Notes</p>
                        <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.6 }}>{visit.notes}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── VACCINATIONS TAB ── */}
          <TabsContent value="vaccinations">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pet.vaccinations.map((vax) => {
                const isUpToDate = vax.status === 'Up to date';
                return (
                  <div
                    key={vax.id}
                    style={{
                      backgroundColor: 'var(--surface-white)',
                      border: `1px solid ${isUpToDate ? '#74C69D40' : '#F59E0B40'}`,
                      borderRadius: '12px',
                      padding: '18px',
                      borderTop: `3px solid ${isUpToDate ? BRAND : '#F59E0B'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '9px', backgroundColor: isUpToDate ? '#74C69D20' : '#F59E0B20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Syringe style={{ width: '18px', height: '18px', color: isUpToDate ? BRAND_TEXT : '#D97706' }} />
                      </div>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '9999px',
                        backgroundColor: isUpToDate ? '#74C69D20' : '#F59E0B20',
                        color: isUpToDate ? BRAND_TEXT : '#D97706',
                      }}>
                        {vax.status}
                      </span>
                    </div>
                    <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>{vax.name}</p>
                    <Separator style={{ marginBottom: '10px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {[
                        ['Last Given', vax.lastGiven],
                        ['Next Due',   vax.nextDue],
                      ].map(([label, value]) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</span>
                        </div>
                      ))}
                    </div>
                    {!isUpToDate && (
                      <button
                        onClick={() => navigate('/owner/appointments')}
                        style={{
                          marginTop: '12px', width: '100%', padding: '7px', borderRadius: '7px',
                          backgroundColor: '#F59E0B15', border: '1px solid #F59E0B40',
                          color: '#D97706', fontSize: '12px', fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Schedule Booster
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* ── APPOINTMENTS TAB ── */}
          <TabsContent value="appointments">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
                <button
                  onClick={() => navigate('/owner/appointments')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '9px 18px', borderRadius: '9px',
                    backgroundColor: BRAND, color: '#fff',
                    border: 'none', fontSize: '13px', fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Calendar style={{ width: '14px', height: '14px' }} />
                  Book New Appointment
                </button>
              </div>
              {pet.upcomingAppointments.map((appt) => (
                <div
                  key={appt.id}
                  style={{
                    backgroundColor: 'var(--surface-white)',
                    border: '1px solid color-mix(in srgb, var(--brand-green-text) 19%, transparent)',
                    borderRadius: '12px', padding: '18px 20px',
                    borderLeft: `4px solid ${BRAND}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Calendar style={{ width: '20px', height: '20px', color: BRAND_TEXT }} />
                    </div>
                    <div>
                      <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px' }}>{appt.reason}</p>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>{appt.date} · {appt.time}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button style={{ padding: '7px 16px', borderRadius: '8px', backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--brand-green-text) 19%, transparent)', color: BRAND_TEXT, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                      Reschedule
                    </button>
                    <button style={{ padding: '7px 16px', borderRadius: '8px', backgroundColor: '#d4183d10', border: '1px solid #d4183d25', color: '#d4183d', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
              {pet.upcomingAppointments.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                  No upcoming appointments for {pet.name}.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}
