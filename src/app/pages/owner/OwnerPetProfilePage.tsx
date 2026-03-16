import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ArrowLeft, Calendar, Syringe, FileText,
  AlertCircle, CheckCircle2, ChevronRight, PawPrint,
  Heart, Scale, Dna, Palette, Clock, MessageCircle, Camera, ImagePlus, Check,
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '../../components/ui/table';
import { Separator } from '../../components/ui/separator';

// ─── Brand ───────────────────────────────────────────────────
const BRAND = '#2D6A4F';
const BRAND_TEXT = 'var(--brand-green-text)';

// ─── Mock Data ───────────────────────────────────────────────
const mockPets = [
  {
    id: 1,
    name: 'Max',
    species: 'Dog',
    breed: 'Golden Retriever',
    dob: '2020-06-15',
    age: '5 years',
    sex: 'Male (Neutered)',
    weight: '32 kg',
    microchip: '900118000123456',
    color: 'Golden',
    image: 'https://images.unsplash.com/photo-1734966213753-1b361564bab4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb2xkZW4lMjByZXRyaWV2ZXIlMjBkb2clMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzMyNDMxMzB8MA&ixlib=rb-4.1.0&q=80&w=400',
    status: 'Healthy' as const,
    conditions: [
      { id: 1, name: 'Hip Dysplasia', dateDiagnosed: 'Jan 15, 2024', status: 'active' as const },
      { id: 2, name: 'Seasonal Allergies', dateDiagnosed: 'Mar 20, 2023', status: 'active' as const },
      { id: 3, name: 'Ear Infection', dateDiagnosed: 'Aug 5, 2025', status: 'resolved' as const },
    ],
    treatments: [
      { id: 1, name: 'Carprofen (Rimadyl) 75mg', date: 'Mar 10, 2026', vet: 'Dr. Chen', notes: 'Daily for hip dysplasia pain management' },
      { id: 2, name: 'Apoquel 16mg', date: 'Mar 1, 2026', vet: 'Dr. Chen', notes: 'For seasonal allergy control' },
      { id: 3, name: 'Rabies Vaccine', date: 'Jan 20, 2026', vet: 'Dr. Patel', notes: '3-year booster administered' },
      { id: 4, name: 'DHPP Vaccine', date: 'Jan 20, 2026', vet: 'Dr. Patel', notes: 'Annual booster' },
      { id: 5, name: 'Ear Drops (Otomax)', date: 'Aug 5, 2025', vet: 'Dr. Chen', notes: 'Apply twice daily for 14 days' },
    ],
    allergies: ['Chicken', 'Amoxicillin'],
    visits: [
      {
        id: 1, date: 'Mar 10, 2026', reason: 'Annual Checkup', vet: 'Dr. Chen',
        summary: 'Routine annual examination. Weight stable. Hip dysplasia managed well with current medication.',
        notes: 'Physical exam normal. Heart and lungs clear. Teeth in good condition — recommended dental cleaning in 6 months.',
        status: 'Completed' as const,
      },
      {
        id: 2, date: 'Jan 20, 2026', reason: 'Vaccination', vet: 'Dr. Patel',
        summary: 'Rabies and DHPP boosters administered. No adverse reactions.',
        notes: 'Vaccines administered in left rear leg (Rabies) and right rear leg (DHPP).',
        status: 'Completed' as const,
      },
      {
        id: 3, date: 'Aug 5, 2025', reason: 'Ear Infection', vet: 'Dr. Chen',
        summary: 'Left ear infection diagnosed. Prescribed Otomax ear drops.',
        notes: 'Owner reported head shaking and scratching at left ear for 3 days.',
        status: 'Completed' as const,
      },
      {
        id: 4, date: 'Mar 15, 2025', reason: 'Follow-up', vet: 'Dr. Chen',
        summary: 'Hip dysplasia follow-up. Adjusted pain medication dosage.',
        notes: 'Owner reports improved mobility since starting Carprofen.',
        status: 'Completed' as const,
      },
    ],
    clientNotes: 'Hi John! Max is doing great overall. Please continue his daily Carprofen and Apoquel as prescribed. Remember to keep up with his joint supplements. We\'d like to see him again in about 3 months for a follow-up on his hips.',
    upcomingAppointments: [
      { id: 1, time: '2:30 PM', date: 'Mar 15, 2026', reason: 'Dental Cleaning' },
    ],
    vaccinations: [
      { id: 1, name: 'Rabies', status: 'Up to date' as const, lastGiven: 'Dec 15, 2025', nextDue: 'Dec 15, 2026' },
      { id: 2, name: 'DHPP', status: 'Up to date' as const, lastGiven: 'Jan 20, 2026', nextDue: 'Jan 20, 2027' },
      { id: 3, name: 'Bordetella', status: 'Due soon' as const, lastGiven: 'Sep 10, 2025', nextDue: 'Mar 10, 2026' },
      { id: 4, name: 'Leptospirosis', status: 'Up to date' as const, lastGiven: 'Jan 20, 2026', nextDue: 'Jan 20, 2027' },
      { id: 5, name: 'Lyme', status: 'Up to date' as const, lastGiven: 'Nov 5, 2025', nextDue: 'Nov 5, 2026' },
    ],
  },
  {
    id: 2,
    name: 'Hugo',
    species: 'Cat',
    breed: 'Persian',
    dob: '2022-03-10',
    age: '3 years',
    sex: 'Male (Neutered)',
    weight: '4.2 kg',
    microchip: '900118000789012',
    color: 'White',
    image: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
    status: 'Follow-up' as const,
    conditions: [
      { id: 1, name: 'Dental Disease', dateDiagnosed: 'Feb 1, 2026', status: 'active' as const },
    ],
    treatments: [
      { id: 1, name: 'Dental Cleaning', date: 'Feb 1, 2026', vet: 'Dr. Patel', notes: 'Full dental cleaning under general anesthesia' },
      { id: 2, name: 'Metacam 1.5mg', date: 'Feb 1, 2026', vet: 'Dr. Patel', notes: 'Pain relief post-dental procedure' },
    ],
    allergies: ['Fish'],
    visits: [
      {
        id: 1, date: 'Feb 1, 2026', reason: 'Dental Procedure', vet: 'Dr. Patel',
        summary: 'Stage 2 periodontal disease. Full dental cleaning and two extractions performed.',
        notes: 'Oral exam shows significant tartar buildup. Dental cleaning performed under general anesthesia. Two teeth extracted.',
        status: 'Completed' as const,
      },
      {
        id: 2, date: 'Nov 15, 2025', reason: 'Annual Checkup', vet: 'Dr. Chen',
        summary: 'Healthy cat. Weight stable. Dental tartar noted.',
        notes: 'Physical exam normal. Coat in good condition. Slight dental tartar buildup noted.',
        status: 'Completed' as const,
      },
    ],
    clientNotes: 'Hi John! Hugo is recovering well from his dental procedure. Please continue daily dental treats to help prevent tartar buildup. His FeLV vaccine booster is due soon — please call to schedule an appointment.',
    upcomingAppointments: [
      { id: 1, time: '10:00 AM', date: 'Mar 20, 2026', reason: 'Dental Recheck' },
    ],
    vaccinations: [
      { id: 1, name: 'Rabies', status: 'Up to date' as const, lastGiven: 'Feb 1, 2026', nextDue: 'Feb 1, 2027' },
      { id: 2, name: 'FVRCP', status: 'Up to date' as const, lastGiven: 'Feb 1, 2026', nextDue: 'Feb 1, 2027' },
      { id: 3, name: 'FeLV', status: 'Due soon' as const, lastGiven: 'Aug 10, 2025', nextDue: 'Mar 20, 2026' },
    ],
  },
];

// ─── Banner presets ───────────────────────────────────────────
const BANNER_PRESETS = [
  { id: 'forest',  label: 'Forest',  gradient: 'linear-gradient(135deg, #1B4332 0%, #2D6A4F 50%, #52B788 100%)' },
  { id: 'ocean',   label: 'Ocean',   gradient: 'linear-gradient(135deg, #0C4A6E 0%, #0369A1 50%, #38BDF8 100%)' },
  { id: 'sunset',  label: 'Sunset',  gradient: 'linear-gradient(135deg, #7C2D12 0%, #C2410C 50%, #FB923C 100%)' },
  { id: 'lavender',label: 'Lavender',gradient: 'linear-gradient(135deg, #3B0764 0%, #6D28D9 50%, #A78BFA 100%)' },
  { id: 'rose',    label: 'Rose',    gradient: 'linear-gradient(135deg, #881337 0%, #BE123C 50%, #FB7185 100%)' },
  { id: 'slate',   label: 'Slate',   gradient: 'linear-gradient(135deg, #0F172A 0%, #334155 50%, #94A3B8 100%)' },
];

// Default per pet
const PET_DEFAULT_BANNER: Record<number, string> = {
  1: BANNER_PRESETS[0].gradient, // Max → Forest green
  2: BANNER_PRESETS[1].gradient, // Hugo → Ocean blue
};

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

  const pet = mockPets.find((p) => String(p.id) === id) ?? mockPets[0];
  const otherPet = mockPets.find((p) => p.id !== pet.id)!;
  const statusColor = STATUS_COLORS[pet.status] ?? STATUS_COLORS.Healthy;

  const [expandedVisit, setExpandedVisit] = useState<number | null>(null);
  const [bannerGradient, setBannerGradient] = useState(PET_DEFAULT_BANNER[pet.id] ?? BANNER_PRESETS[0].gradient);
  const [bannerPickerOpen, setBannerPickerOpen] = useState(false);
  const bannerPickerRef = useRef<HTMLDivElement>(null);

  // Simulate: true = super admin, false = regular owner
  const IS_SUPER_ADMIN = true;

  const activeConditions = pet.conditions.filter((c) => c.status === 'active');
  const resolvedConditions = pet.conditions.filter((c) => c.status === 'resolved');

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
          {/* Banner */}
          <div style={{ position: 'relative', height: '160px', background: bannerGradient, overflow: 'visible' }}>
            {/* Subtle paw pattern overlay */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)`,
              backgroundSize: '28px 28px',
            }} />
            {/* Bottom fade */}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.18))' }} />

            {IS_SUPER_ADMIN && (
              <div ref={bannerPickerRef} style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10 }}>
                <button
                  onClick={() => setBannerPickerOpen((o) => !o)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '6px 12px', borderRadius: '8px',
                    backgroundColor: 'rgba(0,0,0,0.35)',
                    backdropFilter: 'blur(6px)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff', fontSize: '12px', fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <ImagePlus style={{ width: '13px', height: '13px' }} />
                  Edit Banner
                </button>

                {/* Preset picker popover */}
                {bannerPickerOpen && (
                  <div
                    style={{
                      position: 'absolute', top: '38px', right: 0,
                      backgroundColor: 'var(--surface-white)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px', padding: '14px',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                      width: '220px', zIndex: 50,
                    }}
                  >
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>
                      Choose Banner
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {BANNER_PRESETS.map((preset) => {
                        const isActive = bannerGradient === preset.gradient;
                        return (
                          <button
                            key={preset.id}
                            onClick={() => { setBannerGradient(preset.gradient); setBannerPickerOpen(false); }}
                            style={{
                              border: isActive ? `2px solid ${BRAND}` : '2px solid transparent',
                              borderRadius: '8px', overflow: 'hidden', cursor: 'pointer',
                              padding: 0, position: 'relative',
                            }}
                          >
                            <div style={{ height: '44px', background: preset.gradient, borderRadius: '6px' }} />
                            <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-primary)', margin: '4px 0 3px', textAlign: 'center' }}>{preset.label}</p>
                            {isActive && (
                              <div style={{ position: 'absolute', top: '4px', right: '4px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Check style={{ width: '9px', height: '9px', color: '#fff' }} />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
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
                <button
                  onClick={() => navigate(`/owner/pets/${otherPet.id}`)}
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
                    <AvatarImage src={otherPet.image} alt={otherPet.name} style={{ objectFit: 'cover' }} />
                    <AvatarFallback style={{ fontSize: '9px' }}>{otherPet.name[0]}</AvatarFallback>
                  </Avatar>
                  Switch to {otherPet.name}
                </button>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #2D6A4F, #52B788)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>DC</span>
                      </div>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Dr. Chen</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>Mar 10, 2026</p>
                      </div>
                    </div>
                    <div style={{ padding: '12px', borderRadius: '9px', backgroundColor: `${BRAND}08`, border: `1px solid ${BRAND}20` }}>
                      <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>
                        {pet.clientNotes}
                      </p>
                    </div>
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
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: `${BRAND}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
                    border: `1px solid ${BRAND}30`,
                    borderRadius: '12px', padding: '18px 20px',
                    borderLeft: `4px solid ${BRAND}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: `${BRAND}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Calendar style={{ width: '20px', height: '20px', color: BRAND_TEXT }} />
                    </div>
                    <div>
                      <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px' }}>{appt.reason}</p>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>{appt.date} · {appt.time}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button style={{ padding: '7px 16px', borderRadius: '8px', backgroundColor: `${BRAND}15`, border: `1px solid ${BRAND}30`, color: BRAND_TEXT, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
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
