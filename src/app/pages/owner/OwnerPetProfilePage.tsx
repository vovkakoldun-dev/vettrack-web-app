import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ArrowLeft, Calendar, Syringe, FileText,
  AlertCircle, CheckCircle2, ChevronRight, PawPrint,
  Heart, Scale, Dna, Palette, Clock, MessageCircle, Camera,
  Activity, ScanLine, Scissors, Target, Utensils,
  FlaskConical, Image as ImageIcon, TrendingUp, Download, Eye,
  Loader2,
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '../../components/ui/table';
import { Separator } from '../../components/ui/separator';
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '../../components/ui/accordion';
import { usePets } from '../../hooks/usePets';
import { useAppointments } from '../../hooks/useAppointments';
import { useOwnerClient } from '../../hooks/useOwnerClient';
import { supabase } from '../../../lib/supabase';
import {
  InjectionsTab,
  XRayTab,
  SurgeryTab,
  PlanTab,
  DietTab,
  PhotosTab,
  PetReportsTab,
  ProblemsSection,
} from '../ClientDetailPage';

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

  // ── Additional data fetches for new tabs ────────────────────
  const [allergies, setAllergies] = useState<string[]>([]);
  const [treatments, setTreatments] = useState<any[]>([]);
  const [visitReports, setVisitReports] = useState<any[]>([]);
  const [labFiles, setLabFiles] = useState<any[]>([]);
  const [labLoading, setLabLoading] = useState(true);
  const [noteHistory, setNoteHistory] = useState<any[]>([]);

  // Fetch allergies + treatments
  useEffect(() => {
    if (!supaPet?.id) return;
    supabase.from('pet_allergies').select('allergen').eq('pet_id', supaPet.id).then(({ data }) => {
      if (data) setAllergies(data.map((a: any) => a.allergen));
    });
    supabase
      .from('treatments')
      .select('id, name, treatment_date, notes, created_at, staff:staff!treatments_vet_org_fkey(profiles:profiles!staff_profile_org_fkey(first_name, last_name))')
      .eq('pet_id', supaPet.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data) { setTreatments([]); return; }
        setTreatments(data.map((t: any) => ({
          id: t.id,
          name: t.name,
          date: fmtDate(t.treatment_date),
          createdAt: t.created_at,
          vet: t.staff?.profiles ? `Dr. ${t.staff.profiles.first_name} ${t.staff.profiles.last_name}` : '—',
          notes: t.notes || '',
        })));
      });
  }, [supaPet?.id]);

  // Fetch visit reports
  const fetchVisitReports = useCallback(async (petDbId: string) => {
    if (!petDbId) return;
    const { data } = await supabase
      .from('appointments')
      .select('id, scheduled_at, duration_minutes, status, type, reason, notes, staff:staff!appointments_vet_org_fkey(profiles:profiles!staff_profile_org_fkey(first_name, last_name)), services:services!appointments_service_org_fkey(name)')
      .eq('pet_id', petDbId)
      .eq('status', 'Completed')
      .order('scheduled_at', { ascending: false });

    const { data: mrData } = await supabase
      .from('medical_records')
      .select('id, record_number, appointment_id, record_type, status, visit_date, reason, clinical_notes, chief_complaint, exam_notes, primary_diagnosis, secondary_diagnosis, vitals_json, medications_json, procedures_text, owner_instructions, follow_up_date, follow_up_notes')
      .eq('pet_id', petDbId)
      .order('visit_date', { ascending: false });

    const mrByAppt = new Map<string, any>();
    if (mrData) mrData.forEach((mr: any) => { if (mr.appointment_id) mrByAppt.set(mr.appointment_id, mr); });

    if (data) {
      const mapped = data.map((apt: any) => {
        const profile = apt.staff?.profiles;
        const mr = mrByAppt.get(apt.id);
        return {
          id: apt.id,
          visit_date: apt.scheduled_at?.split('T')[0] || '',
          visit_time: apt.scheduled_at ? new Date(apt.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '',
          reason: apt.reason || apt.services?.name || apt.type || 'Appointment',
          status: apt.status || 'Scheduled',
          type: apt.type,
          notes: apt.notes,
          duration_minutes: apt.duration_minutes,
          service_name: apt.services?.name || null,
          vet_name: profile ? `Dr. ${profile.first_name} ${profile.last_name}` : '—',
          record_number: mr?.record_number || null,
          chief_complaint: mr?.chief_complaint || null,
          exam_notes: mr?.exam_notes || null,
          primary_diagnosis: mr?.primary_diagnosis || null,
          secondary_diagnosis: mr?.secondary_diagnosis || null,
          clinical_notes: mr?.clinical_notes || null,
          vitals_json: mr?.vitals_json || null,
          medications_json: mr?.medications_json || null,
          procedures_text: mr?.procedures_text || null,
          owner_instructions: mr?.owner_instructions || null,
          follow_up_date: mr?.follow_up_date || null,
          follow_up_notes: mr?.follow_up_notes || null,
        };
      });
      setVisitReports(mapped);
    }
  }, []);

  useEffect(() => {
    if (supaPet?.id) fetchVisitReports(supaPet.id);
  }, [supaPet?.id, fetchVisitReports]);

  // Fetch lab files
  useEffect(() => {
    if (!supaPet?.id) { setLabLoading(false); return; }
    setLabLoading(true);
    supabase
      .from('lab_results')
      .select(`
        id, file_name, file_url, file_type, test_panel, notes,
        review_status, reviewed_at, created_at,
        uploader:profiles!lab_results_uploaded_by_org_fkey(first_name, last_name),
        reviewer:profiles!lab_results_reviewed_by_org_fkey(first_name, last_name)
      `)
      .eq('pet_id', supaPet.id)
      .not('file_url', 'is', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setLabFiles(data);
        setLabLoading(false);
      });
  }, [supaPet?.id]);

  // Fetch notes history (owner only sees client notes)
  useEffect(() => {
    if (!supaPet?.id) return;
    supabase
      .from('pet_notes')
      .select('id, type, content, created_at, author:staff!pet_notes_author_org_fkey(role, profiles:profiles!staff_profile_org_fkey(first_name, last_name))')
      .eq('pet_id', supaPet.id)
      .eq('type', 'client')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) {
          setNoteHistory(data.map((n: any) => ({
            id: n.id,
            type: n.type,
            content: n.content,
            created_at: n.created_at,
            author: n.author?.profiles
              ? { first_name: n.author.profiles.first_name, last_name: n.author.profiles.last_name, role: n.author.role || '' }
              : { first_name: 'Unknown', last_name: '', role: '' },
          })));
        }
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
          time: dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          date: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          reason: a.reason ?? a.services?.name ?? 'Checkup',
        };
      });

    const pastAppts = allAppts
      .filter(a => a.pet_id === supaPet.id && new Date(a.scheduled_at) < new Date())
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
      .map((a, i) => ({
        id: i + 1,
        date: new Date(a.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
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
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        {/* ── Back ── */}
        <button
          onClick={() => navigate('/owner')}
          className="inline-flex items-center gap-2 hover:text-[var(--text-primary)] transition-colors mb-6"
          style={{ fontSize: '14px', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <ArrowLeft style={{ width: '16px', height: '16px' }} />
          Back to Dashboard
        </button>

        {/* ══════════════════════════════════════════════════
             TOP BANNER / HEADER SECTION (unchanged)
             ══════════════════════════════════════════════════ */}
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
                  <img
                    src={clinicLogoUrl}
                    alt="Clinic logo"
                    style={{
                      maxWidth: 80,
                      maxHeight: 80,
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.35))',
                    }}
                  />
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
          <div style={{ padding: '24px 24px 24px', position: 'relative' }}>
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

        {/* ══════════════════════════════════════════════════
             TABS — mirroring doctor portal's pet profile
             ══════════════════════════════════════════════════ */}
        <Tabs defaultValue="overview">
          <div className="overflow-x-auto mb-6" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
            <TabsList className="w-auto inline-flex">
              <TabsTrigger value="overview">
                <PawPrint style={{ width: '14px', height: '14px', marginRight: '6px' }} /> Overview
              </TabsTrigger>
              <TabsTrigger value="medical-overview">
                <Activity style={{ width: '14px', height: '14px', marginRight: '6px' }} /> Medical Overview
              </TabsTrigger>
              <TabsTrigger value="visits">
                <FileText style={{ width: '14px', height: '14px', marginRight: '6px' }} /> Visits
              </TabsTrigger>
              <TabsTrigger value="injections">
                <Syringe style={{ width: '14px', height: '14px', marginRight: '6px' }} /> Injections
              </TabsTrigger>
              <TabsTrigger value="xray">
                <ScanLine style={{ width: '14px', height: '14px', marginRight: '6px' }} /> X-Ray
              </TabsTrigger>
              <TabsTrigger value="surgery">
                <Scissors style={{ width: '14px', height: '14px', marginRight: '6px' }} /> Surgery
              </TabsTrigger>
              <TabsTrigger value="plan">
                <Target style={{ width: '14px', height: '14px', marginRight: '6px' }} /> Plan
              </TabsTrigger>
              <TabsTrigger value="diet">
                <Utensils style={{ width: '14px', height: '14px', marginRight: '6px' }} /> Diet
              </TabsTrigger>
              <TabsTrigger value="lab">
                <FlaskConical style={{ width: '14px', height: '14px', marginRight: '6px' }} /> Lab
              </TabsTrigger>
              <TabsTrigger value="notes">
                <MessageCircle style={{ width: '14px', height: '14px', marginRight: '6px' }} /> Notes
              </TabsTrigger>
              <TabsTrigger value="photos">
                <ImageIcon style={{ width: '14px', height: '14px', marginRight: '6px' }} /> Photos
              </TabsTrigger>
              <TabsTrigger value="reports">
                <TrendingUp style={{ width: '14px', height: '14px', marginRight: '6px' }} /> Reports
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ══════════ OVERVIEW TAB (existing owner layout, preserved) ══════════ */}
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

          {/* ══════════ MEDICAL OVERVIEW TAB ══════════ */}
          <TabsContent value="medical-overview">
            {/* Problems (VeNom-coded) */}
            <ProblemsSection
              petName={pet.name}
              petDbId={pet.id}
              readOnly
            />

            {/* Allergies (read-only) */}
            <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-[#d4183d]" />
                <h3 className="text-[var(--text-primary)]">Allergies</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {allergies.length === 0 ? (
                  <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>No known allergies on file.</span>
                ) : (
                  allergies.map((a) => (
                    <span
                      key={a}
                      className="inline-flex items-center gap-1.5 px-3 py-1"
                      style={{ backgroundColor: '#d4183d15', color: '#d4183d', borderRadius: '9999px', fontSize: '14px', fontWeight: 600 }}
                    >
                      <AlertCircle className="w-3 h-3" /> {a}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Treatments (read-only) */}
            <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6" style={{ borderRadius: '12px' }}>
              <div className="mb-4">
                <h3 className="text-[var(--text-primary)]">Treatments</h3>
              </div>
              {treatments.length === 0 ? (
                <p className="text-[var(--text-secondary)] py-4" style={{ fontSize: '14px' }}>No treatments on file.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Treatment</TableHead>
                      <TableHead className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Date</TableHead>
                      <TableHead className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Vet</TableHead>
                      <TableHead className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {treatments.map((t) => (
                      <TableRow key={t.id} className="hover:bg-[var(--surface-elevated)]">
                        <TableCell className="py-3 px-4">
                          <span className="text-[var(--text-primary)]" style={{ fontSize: '16px', fontWeight: 500 }}>{t.name}</span>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{t.date}</span>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{t.vet}</span>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{t.notes}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Upcoming Appointments + Vaccination History */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {/* Upcoming Appointments */}
              <div className="border border-[color-mix(in_srgb,var(--brand-green-text)_19%,transparent)] bg-[var(--surface-white)] p-6" style={{ borderRadius: '12px' }}>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-[var(--brand-green-text)]" />
                  <h3 className="text-[var(--text-primary)]">Upcoming Appointments</h3>
                </div>
                {pet.upcomingAppointments.length === 0 ? (
                  <p className="text-[var(--text-secondary)] py-4" style={{ fontSize: '14px' }}>No upcoming appointments.</p>
                ) : (
                  <div className="space-y-3">
                    {pet.upcomingAppointments.map((appt) => (
                      <div
                        key={appt.id}
                        className="border border-[var(--border-color)] p-4 cursor-pointer hover:border-[color-mix(in_srgb,var(--brand-green-text)_38%,transparent)] transition-colors"
                        style={{ borderRadius: '8px' }}
                        onClick={() => navigate('/owner/appointments')}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={pet.image} alt={pet.name} className="object-cover" />
                            <AvatarFallback>{pet.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <Clock className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                              <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>
                                {appt.time} - {appt.date}
                              </span>
                            </div>
                            <p className="text-[var(--text-primary)]" style={{ fontSize: '16px', fontWeight: 600 }}>{pet.name}</p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <span
                            className="inline-block px-2.5 py-1"
                            style={{ backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)', color: 'var(--brand-green-text)', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}
                          >
                            {appt.reason}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Vaccination History */}
              <div className="border border-[var(--border-color)] bg-[var(--surface-white)] p-6" style={{ borderRadius: '12px' }}>
                <div className="flex items-center gap-2 mb-4">
                  <Syringe className="w-5 h-5 text-[var(--brand-green-text)]" />
                  <h3 className="text-[var(--text-primary)]">Vaccination History</h3>
                </div>
                {vaccinations.length === 0 ? (
                  <p className="text-[var(--text-secondary)] py-4" style={{ fontSize: '14px' }}>No vaccination records yet.</p>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-3" style={{ scrollbarWidth: 'none' }}>
                    {vaccinations.map((vax) => {
                      const isUpToDate = vax.status === 'Up to date';
                      return (
                        <div
                          key={vax.id}
                          className="flex-shrink-0 border p-4"
                          style={{
                            borderRadius: '10px',
                            width: '200px',
                            borderColor: isUpToDate ? 'color-mix(in srgb, var(--brand-green-text) 25%, transparent)' : '#F4A26180',
                            backgroundColor: isUpToDate ? 'color-mix(in srgb, var(--brand-green-text) 3%, transparent)' : '#F4A26108',
                          }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div
                              className="w-8 h-8 flex items-center justify-center"
                              style={{ borderRadius: '8px', backgroundColor: isUpToDate ? 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)' : '#F4A26115' }}
                            >
                              <Syringe className="w-4 h-4" style={{ color: isUpToDate ? 'var(--brand-green-text)' : '#F4A261' }} />
                            </div>
                            <span className="text-[var(--text-primary)]" style={{ fontSize: '15px', fontWeight: 600 }}>{vax.name}</span>
                          </div>
                          <div className="flex items-center gap-1 mb-3">
                            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: isUpToDate ? 'var(--brand-green-text)' : '#F4A261' }} />
                            <span style={{ fontSize: '13px', fontWeight: 500, color: isUpToDate ? 'var(--brand-green-text)' : '#F4A261' }}>
                              {vax.status}
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between">
                              <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>Last given:</span>
                              <span className="text-[var(--text-primary)]" style={{ fontSize: '12px', fontWeight: 600 }}>{vax.lastGiven}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>Next due:</span>
                              <span className="text-[var(--text-primary)]" style={{ fontSize: '12px', fontWeight: 600 }}>{vax.nextDue}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ══════════ VISITS TAB ══════════ */}
          <TabsContent value="visits">
            <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6" style={{ borderRadius: '12px' }}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[var(--text-primary)]">Visit History</h3>
                <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{visitReports.length} appointment{visitReports.length !== 1 ? 's' : ''}</span>
              </div>

              {visitReports.length === 0 ? (
                <p className="text-[var(--text-secondary)] text-center py-8" style={{ fontSize: '14px' }}>No appointments found for this pet.</p>
              ) : (
                <Accordion type="single" collapsible className="space-y-3">
                  {visitReports.map((v) => {
                    const statusColor = v.status === 'Completed'
                      ? { bg: '#74C69D20', text: 'var(--brand-green-text)' }
                      : v.status === 'Cancelled'
                      ? { bg: '#E76F5120', text: '#E76F51' }
                      : v.status === 'In Progress' || v.status === 'Checked In'
                      ? { bg: '#F4A26120', text: '#F4A261' }
                      : { bg: '#5390D920', text: '#5390D9' };
                    return (
                      <AccordionItem key={v.id} value={`visit-${v.id}`} className="border border-[var(--border-color)] px-4" style={{ borderRadius: '8px' }}>
                        <AccordionTrigger className="py-4 hover:no-underline">
                          <div className="flex items-center gap-4 text-left flex-1 mr-4">
                            <div className="flex flex-col flex-shrink-0 w-28">
                              <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>
                                {new Date(v.visit_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                              {v.visit_time && <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>{v.visit_time}</span>}
                            </div>
                            <span className="text-[var(--text-primary)] flex-1 truncate" style={{ fontSize: '16px', fontWeight: 600 }}>{v.reason}</span>
                            <span className="text-[var(--text-secondary)] hidden sm:inline" style={{ fontSize: '14px' }}>{v.vet_name}</span>
                            <span
                              className="inline-block px-2 py-0.5 flex-shrink-0"
                              style={{ backgroundColor: statusColor.bg, color: statusColor.text, borderRadius: '9999px', fontSize: '12px', fontWeight: 600 }}
                            >
                              {v.status}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                          <Separator className="mb-4" />
                          <div className="space-y-4">
                            {/* Basic info row */}
                            <div className="flex flex-wrap gap-x-6 gap-y-2">
                              {v.type && (
                                <div>
                                  <p className="text-[var(--text-secondary)] mb-0.5" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</p>
                                  <p className="text-[var(--text-primary)]" style={{ fontSize: '14px' }}>{v.type}</p>
                                </div>
                              )}
                              {v.service_name && (
                                <div>
                                  <p className="text-[var(--text-secondary)] mb-0.5" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Service</p>
                                  <p className="text-[var(--text-primary)]" style={{ fontSize: '14px' }}>{v.service_name}</p>
                                </div>
                              )}
                              {v.duration_minutes && (
                                <div>
                                  <p className="text-[var(--text-secondary)] mb-0.5" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration</p>
                                  <p className="text-[var(--text-primary)]" style={{ fontSize: '14px' }}>{v.duration_minutes} min</p>
                                </div>
                              )}
                              {v.record_number && (
                                <div>
                                  <p className="text-[var(--text-secondary)] mb-0.5" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Record #</p>
                                  <p className="text-[var(--text-primary)]" style={{ fontSize: '14px' }}>{v.record_number}</p>
                                </div>
                              )}
                            </div>

                            {/* Chief complaint */}
                            {v.chief_complaint && (
                              <div>
                                <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chief Complaint</p>
                                <p className="text-[var(--text-primary)] whitespace-pre-wrap" style={{ fontSize: '14px', lineHeight: 1.6 }}>{v.chief_complaint}</p>
                              </div>
                            )}

                            {/* Vitals */}
                            {v.vitals_json && Object.keys(v.vitals_json).length > 0 && (
                              <div>
                                <p className="text-[var(--text-secondary)] mb-1.5" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vitals</p>
                                <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                                  {Object.entries(v.vitals_json).map(([key, val]: [string, any]) => (
                                    <span key={key} className="text-[var(--text-primary)]" style={{ fontSize: '13px' }}>
                                      <span className="text-[var(--text-secondary)]" style={{ fontWeight: 500 }}>{key.replace(/_/g, ' ')}:</span>{' '}
                                      <span style={{ fontWeight: 600 }}>{val}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Diagnosis */}
                            {(v.primary_diagnosis || v.secondary_diagnosis) && (
                              <div>
                                <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Diagnosis</p>
                                {v.primary_diagnosis && <p className="text-[var(--text-primary)]" style={{ fontSize: '14px', lineHeight: 1.6 }}><strong>Primary:</strong> {v.primary_diagnosis}</p>}
                                {v.secondary_diagnosis && <p className="text-[var(--text-primary)]" style={{ fontSize: '14px', lineHeight: 1.6 }}><strong>Secondary:</strong> {v.secondary_diagnosis}</p>}
                              </div>
                            )}

                            {/* Exam notes */}
                            {v.exam_notes && (
                              <div>
                                <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Exam Notes</p>
                                <p className="text-[var(--text-primary)] whitespace-pre-wrap" style={{ fontSize: '14px', lineHeight: 1.6 }}>{v.exam_notes}</p>
                              </div>
                            )}

                            {/* Procedures */}
                            {v.procedures_text && (
                              <div>
                                <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Procedures</p>
                                <p className="text-[var(--text-primary)] whitespace-pre-wrap" style={{ fontSize: '14px', lineHeight: 1.6 }}>{v.procedures_text}</p>
                              </div>
                            )}

                            {/* Medications */}
                            {v.medications_json && v.medications_json.length > 0 && (
                              <div>
                                <p className="text-[var(--text-secondary)] mb-1.5" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Medications</p>
                                <div className="space-y-1">
                                  {v.medications_json.map((med: any, mi: number) => (
                                    <p key={mi} className="text-[var(--text-primary)]" style={{ fontSize: '13px' }}>
                                      <span style={{ fontWeight: 600 }}>{med.name || med.medication}</span>
                                      {med.dosage && <span className="text-[var(--text-secondary)]"> — {med.dosage}</span>}
                                      {med.frequency && <span className="text-[var(--text-secondary)]">, {med.frequency}</span>}
                                      {med.duration && <span className="text-[var(--text-secondary)]">, {med.duration}</span>}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Clinical notes */}
                            {v.clinical_notes && (
                              <div>
                                <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Clinical Notes</p>
                                <p className="text-[var(--text-primary)] whitespace-pre-wrap" style={{ fontSize: '14px', lineHeight: 1.6 }}>{v.clinical_notes}</p>
                              </div>
                            )}

                            {/* General appointment notes */}
                            {v.notes && !v.clinical_notes && (
                              <div>
                                <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</p>
                                <p className="text-[var(--text-primary)] whitespace-pre-wrap" style={{ fontSize: '14px', lineHeight: 1.6 }}>{v.notes}</p>
                              </div>
                            )}

                            {/* Owner instructions */}
                            {v.owner_instructions && (
                              <div>
                                <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Home Care Instructions</p>
                                <p className="text-[var(--text-primary)] whitespace-pre-wrap" style={{ fontSize: '14px', lineHeight: 1.6 }}>{v.owner_instructions}</p>
                              </div>
                            )}

                            {/* Follow-up */}
                            {v.follow_up_date && (
                              <div className="flex items-center gap-2 mt-1 p-2.5 border border-[var(--border-color)]" style={{ borderRadius: '8px', backgroundColor: 'var(--surface-elevated)' }}>
                                <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600 }}>FOLLOW-UP:</span>
                                <span className="text-[var(--text-primary)]" style={{ fontSize: '13px', fontWeight: 500 }}>
                                  {new Date(v.follow_up_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                                {v.follow_up_notes && <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>— {v.follow_up_notes}</span>}
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </div>
          </TabsContent>

          {/* ══════════ INJECTIONS TAB ══════════ */}
          <TabsContent value="injections">
            <InjectionsTab petName={pet.name} petDbId={pet.id} readOnly />
          </TabsContent>

          {/* ══════════ X-RAY TAB ══════════ */}
          <TabsContent value="xray">
            <XRayTab petName={pet.name} petDbId={pet.id} readOnly />
          </TabsContent>

          {/* ══════════ SURGERY TAB ══════════ */}
          <TabsContent value="surgery">
            <SurgeryTab petName={pet.name} petDbId={pet.id} readOnly />
          </TabsContent>

          {/* ══════════ PLAN TAB ══════════ */}
          <TabsContent value="plan">
            <PlanTab petName={pet.name} petDbId={pet.id} readOnly />
          </TabsContent>

          {/* ══════════ DIET TAB ══════════ */}
          <TabsContent value="diet">
            <DietTab petName={pet.name} petSpecies={pet.species || ''} petWeight={pet.weight || ''} petDbId={pet.id} readOnly />
          </TabsContent>

          {/* ══════════ LAB TAB ══════════ */}
          <TabsContent value="lab">
            <div className="space-y-4">
              <div className="border border-[var(--border-color)] p-6" style={{ borderRadius: '12px', backgroundColor: 'var(--surface-white)' }}>
                <div className="mb-5">
                  <h3 className="text-[var(--text-primary)]" style={{ fontSize: 16, fontWeight: 600 }}>Lab Results</h3>
                  <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: 14 }}>
                    Uploaded lab files and diagnostic results
                  </p>
                </div>

                {labLoading ? (
                  <div className="text-center py-10">
                    <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
                    <p className="text-[var(--text-secondary)]" style={{ fontSize: 14 }}>Loading lab results…</p>
                  </div>
                ) : labFiles.length === 0 ? (
                  <div className="text-center py-10">
                    <FlaskConical className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
                    <p className="text-[var(--text-secondary)]" style={{ fontSize: 14 }}>No lab results yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {labFiles.map((f: any) => {
                      const isReviewed = f.review_status === 'reviewed';
                      const uploaderName = f.uploader ? `${f.uploader.first_name} ${f.uploader.last_name}`.trim() : '—';
                      const reviewerName = f.reviewer ? `Dr. ${f.reviewer.first_name} ${f.reviewer.last_name}`.trim() : '';
                      const isPdf = f.file_type === 'application/pdf';
                      const isImage = f.file_type?.startsWith('image/');
                      const uploadDate = f.created_at ? new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

                      return (
                        <div key={f.id} className="border border-[var(--border-color)] flex items-center justify-between px-5 py-3.5" style={{ borderRadius: '10px' }}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: isPdf ? '#EF444415' : isImage ? '#3B82F615' : '#6B728015' }}
                            >
                              {isPdf ? <FileText className="w-4 h-4" style={{ color: '#EF4444' }} />
                                : isImage ? <Eye className="w-4 h-4" style={{ color: '#3B82F6' }} />
                                : <FileText className="w-4 h-4" style={{ color: '#6B7280' }} />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[var(--text-primary)] truncate" style={{ fontSize: 14, fontWeight: 600 }}>{f.file_name || 'Unnamed file'}</p>
                              <p className="text-[var(--text-secondary)]" style={{ fontSize: 12 }}>
                                {f.test_panel && f.test_panel !== 'General' ? `${f.test_panel} · ` : ''}{uploadDate} · by {uploaderName}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5"
                              style={{
                                backgroundColor: isReviewed ? 'rgba(22, 163, 74, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                                color: isReviewed ? '#16A34A' : '#D97706',
                                borderRadius: 9999, fontSize: 11, fontWeight: 700,
                                border: `1px solid ${isReviewed ? 'rgba(22, 163, 74, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
                              }}
                            >
                              {isReviewed ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                              {isReviewed ? 'Reviewed' : 'Awaiting Review'}
                            </span>
                            {isReviewed && reviewerName && (
                              <span className="text-[var(--text-secondary)]" style={{ fontSize: 11 }}>
                                {reviewerName}
                              </span>
                            )}
                            <a
                              href={f.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                width: 32, height: 32, borderRadius: 8,
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'transparent', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                color: 'var(--text-secondary)', textDecoration: 'none',
                              }}
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ══════════ NOTES TAB (Read-only, only client-visible notes) ══════════ */}
          <TabsContent value="notes">
            <div className="space-y-6">
              <div className="border border-[var(--border-color)] p-6" style={{ borderRadius: '12px', backgroundColor: 'var(--surface-white)' }}>
                <div className="mb-4">
                  <h3 className="text-[var(--text-primary)]">Notes from Your Vet</h3>
                  <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '14px' }}>
                    Messages and instructions shared by your clinic team
                  </p>
                </div>

                {noteHistory.length === 0 ? (
                  <div className="text-center py-10">
                    <MessageCircle className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
                    <p className="text-[var(--text-secondary)]" style={{ fontSize: 14 }}>No notes from your vet yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {noteHistory.map((note) => (
                      <div key={note.id} className="border border-[var(--border-color)] p-4" style={{ borderRadius: '10px', backgroundColor: 'var(--surface-elevated)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-green-text)' }}>
                                {note.author.first_name?.[0]}{note.author.last_name?.[0]}
                              </span>
                            </div>
                            <div>
                              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                Dr. {note.author.first_name} {note.author.last_name}
                              </p>
                            </div>
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(note.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>
                        <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{note.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ══════════ PHOTOS TAB ══════════ */}
          <TabsContent value="photos">
            <PhotosTab petName={pet.name} petImage={pet.image} petDbId={pet.id} readOnly />
          </TabsContent>

          {/* ══════════ REPORTS TAB ══════════ */}
          <TabsContent value="reports">
            <PetReportsTab petName={pet.name} petDbId={pet.id} readOnly />
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}
