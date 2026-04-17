import { useState, useRef, useEffect, useCallback, Fragment } from 'react';
import { useParams, Link, useNavigate, useSearchParams, useLocation } from 'react-router';
import { supabase } from '../../lib/supabase';
import { useTenantDb } from '../context/TenantContext';
import { getOrgContext } from '../hooks/useOrgContext';
import { useAuth } from '../context/AuthContext';
import {
  generateAndUploadPetReport,
  requestPetReport,
  SOURCE_LABELS,
  SOURCE_COLORS,
  type ReportSource,
} from '../utils/generatePetReport';
import {
  ArrowLeft, Edit2, MoreHorizontal, Plus, Save, X, Printer, Archive, Trash2, FileDown, PawPrint,
  Mail, Phone, MapPin, Shield, AlertCircle, Check, PlusCircle,
  Calendar, Clock, Syringe, ChevronRight, FlaskConical, Download, Eye, FileText,
  CheckCircle2, AlertTriangle, ChevronDown, Camera, Loader2,
  ScanLine, Scissors, ClipboardList, Target, Utensils, Image, TrendingUp, Upload,
  Heart, Thermometer, Activity, Pill, Weight, CircleDot, FileImage,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '../components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '../components/ui/dropdown-menu';
import {
  Popover, PopoverTrigger, PopoverContent,
} from '../components/ui/popover';
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '../components/ui/command';
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '../components/ui/accordion';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../components/ui/select';

// ─── Mock Data ───────────────────────────────────────────────

// Conditions loaded from vet_conditions_reference (VeNom codes) at runtime

const mockClient = {
  id: 1,
  owner: {
    name: 'John Smith',
    email: 'john.smith@email.com',
    phone: '(555) 123-4567',
    address: '742 Evergreen Terrace, Springfield, IL 62704',
    emergencyContact: 'Jane Smith',
    emergencyPhone: '(555) 123-4568',
  },
  insurance: {
    provider: 'PetPlan',
    policyNumber: 'PP-2024-78432',
    coverageType: 'Comprehensive',
    expiryDate: 'Dec 31, 2026',
  },
  pets: [
    {
      id: 1,
      dbId: '',
      assignedVet: 'Dr. Sarah Chen',
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
          notes: 'Physical exam normal. Heart and lungs clear. Teeth in good condition — recommended dental cleaning in 6 months. Bloodwork ordered for thyroid panel. Continue current medications. Discussed weight management diet options with owner.',
          status: 'Completed' as const,
        },
        {
          id: 2, date: 'Jan 20, 2026', reason: 'Vaccination', vet: 'Dr. Patel',
          summary: 'Rabies and DHPP boosters administered. No adverse reactions.',
          notes: 'Vaccines administered in left rear leg (Rabies) and right rear leg (DHPP). Owner advised to monitor for 24-48 hours for any reactions. Slight tenderness at injection site expected. No fever or swelling noted before discharge.',
          status: 'Completed' as const,
        },
        {
          id: 3, date: 'Aug 5, 2025', reason: 'Ear Infection', vet: 'Dr. Chen',
          summary: 'Left ear infection diagnosed. Prescribed Otomax ear drops.',
          notes: 'Owner reported head shaking and scratching at left ear for 3 days. Otoscopic exam revealed inflammation and discharge in left ear canal. Cytology showed yeast and bacteria. Prescribed Otomax drops — apply twice daily for 14 days. Recheck in 2 weeks. Right ear clear.',
          status: 'Completed' as const,
        },
        {
          id: 4, date: 'Mar 15, 2025', reason: 'Follow-up', vet: 'Dr. Chen',
          summary: 'Hip dysplasia follow-up. Adjusted pain medication dosage.',
          notes: 'Owner reports improved mobility since starting Carprofen. Gait analysis shows less limping. Increased dosage from 50mg to 75mg daily for better pain control. Discussed joint supplements — started on glucosamine/chondroitin. Schedule follow-up in 3 months.',
          status: 'Completed' as const,
        },
      ],
      vetNotes: 'Max is a friendly, well-behaved patient. Owner is very attentive and follows treatment plans closely. Monitor hip dysplasia progression — may need to consider surgical options if pain increases. Bloodwork due at next visit for liver panel (monitoring Carprofen side effects).',
      clientNotes: 'Hi John! Max is doing great overall. Please continue his daily Carprofen and Apoquel as prescribed. Remember to keep up with his joint supplements. We\'d like to see him again in about 3 months for a follow-up on his hips. If you notice any changes in his mobility or appetite, don\'t hesitate to call us.',
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
          notes: 'Oral exam shows significant tartar buildup on upper molars. Dental cleaning performed under general anesthesia. Two teeth extracted (upper premolars). Recovery uneventful. Owner instructed on post-procedure care and daily dental treats.',
          status: 'Completed' as const,
        },
        {
          id: 2, date: 'Nov 15, 2025', reason: 'Annual Checkup', vet: 'Dr. Chen',
          summary: 'Healthy cat. Weight stable. Dental tartar noted.',
          notes: 'Physical exam normal. Coat in good condition. Slight dental tartar buildup noted — recommended professional cleaning. FeLV booster due in 6 months. No other concerns.',
          status: 'Completed' as const,
        },
      ],
      vetNotes: 'Hugo is a calm, cooperative patient. Watch dental health closely — prone to periodontal disease. FeLV booster is overdue — needs to be scheduled.',
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
  ],
};

// ─── Status Config ───────────────────────────────────────────

type PatientStatus = 'Healthy' | 'Follow-up' | 'Critical';

const STATUS_OPTIONS: {
  value: PatientStatus;
  bg: string;
  text: string;
  icon: React.ElementType;
  description: string;
}[] = [
  { value: 'Healthy',   bg: '#74C69D20', text: 'var(--brand-green-text)', icon: CheckCircle2, description: 'No active concerns' },
  { value: 'Follow-up', bg: '#F4A26120', text: '#F4A261', icon: AlertCircle,  description: 'Needs a follow-up visit' },
  { value: 'Critical',  bg: '#d4183d20', text: '#d4183d', icon: AlertTriangle, description: 'Urgent attention required' },
];

const statusColors: Record<string, { bg: string; text: string }> = {
  Healthy: { bg: '#74C69D20', text: 'var(--brand-green-text)' },
  'Follow-up': { bg: '#F4A26120', text: '#F4A261' },
  Critical: { bg: '#d4183d20', text: '#d4183d' },
};

// ─── Info Row Helper ─────────────────────────────────────────

function InfoRow({ label, value, editing, onChange }: {
  label: string; value: string; editing: boolean; onChange?: (v: string) => void;
}) {
  return (
    <div className="flex items-start py-3">
      <span className="w-36 flex-shrink-0 text-[var(--text-secondary)]" style={{ fontSize: '14px', fontWeight: 400 }}>
        {label}
      </span>
      {editing ? (
        <Input
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="flex-1 h-8"
        />
      ) : (
        <span className="text-[var(--text-primary)] flex-1" style={{ fontSize: '16px', fontWeight: 400 }}>
          {value}
        </span>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

export default function ClientDetailPage() {
  const db = useTenantDb();
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  const clientsPath = isAdmin ? '/admin/clients' : '/clients';
  const appointmentsPath = isAdmin ? '/admin/bookings' : '/appointments';
  const [searchParams] = useSearchParams();

  // Role-based access: only doctors and superadmins can edit
  const [userRole, setUserRole] = useState<string>('');
  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
      .then(({ data }) => { if (data?.role) setUserRole(data.role); });
  }, [user]);
  const canEdit = ['veterinarian', 'senior_veterinarian', 'specialist', 'lead_vet_tech', 'superadmin'].includes(userRole);

  // Fetch real client from Supabase, fall back to mock
  const [client, setClient] = useState(mockClient);
  const [dbLoaded, setDbLoaded] = useState(false);

  const fetchClientData = useCallback(async () => {
    if (!id) return;
    const { organizationId } = await getOrgContext();
    const { data: c } = await db
      .from('clients')
      .select('id, first_name, last_name, email, phone, address, city, state, zip, country, notes, portal_status, health_status, created_at, pets(id, name, species, breed, date_of_birth, sex, weight_kg, microchip_no, photo_url, assigned_vet_id, assigned_vet:staff!pets_assigned_vet_id_fkey(id, profiles:profiles!staff_profile_id_fkey(first_name, last_name)))')
      .eq('organization_id', organizationId)
      .eq('id', id)
      .single();
    if (c) {
      const petIds = (c.pets as any[] || []).map((p: any) => p.id);
      const [allergiesRes, conditionsRes, treatmentsRes, appointmentsRes, vaccinationsRes] = await Promise.all([
        petIds.length > 0 ? db.from('pet_allergies').select('*').in('pet_id', petIds) : { data: [] },
        petIds.length > 0 ? db.from('pet_conditions').select('*').in('pet_id', petIds) : { data: [] },
        petIds.length > 0 ? db.from('pet_treatments').select('*').in('pet_id', petIds).order('date', { ascending: false }) : { data: [] },
        petIds.length > 0 ? db.from('appointments').select('id, pet_id, scheduled_at, duration_minutes, status, reason, staff!appointments_vet_id_fkey(profiles:profiles!staff_profile_id_fkey(first_name, last_name))').eq('organization_id', organizationId).in('pet_id', petIds).gte('scheduled_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()).order('scheduled_at', { ascending: true }) : { data: [] },
        petIds.length > 0 ? db.from('vaccinations').select('*').in('pet_id', petIds).order('administered_date', { ascending: false }) : { data: [] },
      ]);
      const petAllergies = (allergiesRes.data || []) as any[];
      const petConditions = (conditionsRes.data || []) as any[];
      const petTreatments = (treatmentsRes.data || []) as any[];
      const petAppointments = (appointmentsRes.data || []) as any[];
      const petVaccinations = (vaccinationsRes.data || []) as any[];

      const pets = (c.pets as any[] || []).map((p: any, idx: number) => ({
        id: idx + 1,
        dbId: p.id as string,
        name: p.name || '—',
        species: p.species || '—',
        breed: p.breed || '—',
        dob: p.date_of_birth || '',
        age: p.date_of_birth ? `${Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} years` : '—',
        sex: p.sex || '—',
        weight: p.weight_kg ? `${p.weight_kg} kg` : '—',
        microchip: p.microchip_no || '—',
        color: '—',
        image: p.photo_url || '',
        assignedVet: p.assigned_vet?.profiles ? `Dr. ${p.assigned_vet.profiles.first_name} ${p.assigned_vet.profiles.last_name}` : '—',
        status: ((['Healthy', 'Follow-up', 'Critical'].includes((c as any).health_status)) ? (c as any).health_status : 'Healthy') as 'Healthy' | 'Follow-up' | 'Critical',
        conditions: petConditions.filter((pc: any) => pc.pet_id === p.id).map((pc: any) => ({
          id: pc.id, name: pc.name, dateDiagnosed: new Date(pc.date_diagnosed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), status: pc.status as 'active' | 'resolved', notes: pc.notes || '',
        })),
        treatments: petTreatments.filter((pt: any) => pt.pet_id === p.id).map((pt: any) => ({
          id: pt.id, name: pt.name, date: new Date(pt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), vet: pt.vet, notes: pt.notes,
        })),
        allergies: petAllergies.filter((pa: any) => pa.pet_id === p.id).map((pa: any) => pa.name as string),
        visits: [] as { id: number; date: string; reason: string; vet: string; summary: string; notes: string; status: 'Completed' | 'Scheduled' }[],
        vetNotes: '',
        clientNotes: '',
        upcomingAppointments: petAppointments.filter((a: any) => a.pet_id === p.id).map((a: any, ai: number) => {
          const d = new Date(a.scheduled_at);
          const fmtTime = (dt: Date) => {
            let h = dt.getHours(); const m = dt.getMinutes();
            const ampm = h >= 12 ? 'PM' : 'AM';
            if (h > 12) h -= 12; if (h === 0) h = 12;
            return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
          };
          return {
            id: ai + 1,
            time: fmtTime(d),
            date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            reason: a.reason || a.status || 'Appointment',
          };
        }),
        vaccinations: petVaccinations.filter((v: any) => v.pet_id === p.id).map((v: any, vi: number) => {
          const lastGiven = v.administered_date ? new Date(v.administered_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
          const nextDue = v.next_due_date ? new Date(v.next_due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
          let status: 'Up to date' | 'Due soon' | 'Overdue' = 'Up to date';
          if (v.next_due_date) {
            const dueDate = new Date(v.next_due_date);
            const now = new Date();
            const daysUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
            if (daysUntilDue < 0) status = 'Overdue';
            else if (daysUntilDue <= 30) status = 'Due soon';
          }
          return { id: vi + 1, name: v.vaccine_name, status, lastGiven, nextDue };
        }),
      }));
      const countryLabel = c.country === 'CA' ? 'Canada' : (c.country === 'US' ? 'USA' : '');
      const addr = [c.address, c.city, c.state ? `${c.state} ${c.zip || ''}`.trim() : c.zip, countryLabel].filter(Boolean).join(', ');
      setClient({
        id: 1,
        owner: {
          name: `${c.first_name} ${c.last_name}`,
          email: c.email || '—',
          phone: c.phone || '—',
          address: addr || '—',
          emergencyContact: '—',
          emergencyPhone: '—',
        },
        insurance: { provider: '—', policyNumber: '—', coverageType: '—', expiryDate: '—' },
        pets: pets.length > 0 ? pets : [{
          id: 1, dbId: '', name: '—', species: '—', breed: '—', dob: '', age: '—',
          sex: '—', weight: '—', microchip: '—', color: '—', image: '',
          status: 'Healthy' as const, conditions: [], treatments: [], allergies: [],
          visits: [], vetNotes: '', clientNotes: '', upcomingAppointments: [], vaccinations: [],
        }],
      });
      setDbLoaded(true);
    }
  }, [id]);

  useEffect(() => {
    fetchClientData();
  }, [fetchClientData]);

  // Re-fetch when data changes elsewhere in the app
  useEffect(() => {
    const handler = () => { fetchClientData() }
    window.addEventListener('clientDataChanged', handler)
    window.addEventListener('petDataChanged', handler)
    window.addEventListener('appointmentDataChanged', handler)
    return () => {
      window.removeEventListener('clientDataChanged', handler)
      window.removeEventListener('petDataChanged', handler)
      window.removeEventListener('appointmentDataChanged', handler)
    }
  }, [fetchClientData]);

  // Listen for petReportRegenerate events dispatched from any tab.
  // When a child tab saves new data (diet, photo, plan, etc.), it fires
  // this event — we then generate a full PDF snapshot in the background.
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail as { petDbId: string; source: ReportSource } | undefined;
      if (!detail || !detail.petDbId) return;
      try {
        const { organizationId, clinicId } = await getOrgContext();

        // Resolve staff id + name for generated_by
        let staffId: string | null = null;
        let staffName: string | undefined;
        if (user?.id) {
          const { data: staffRow } = await db
            .from('staff')
            .select('id, profiles:profiles!staff_profile_id_fkey(first_name, last_name)')
            .eq('organization_id', organizationId)
            .eq('profile_id', user.id)
            .maybeSingle();
          staffId = (staffRow as any)?.id || null;
          const p = (staffRow as any)?.profiles;
          if (p) staffName = `Dr. ${p.first_name || ''} ${p.last_name || ''}`.trim();
        }

        const result = await generateAndUploadPetReport(
          db,
          supabase,
          detail.petDbId,
          detail.source,
          {
            organizationId,
            clinicId: clinicId || null,
            generatedByStaffId: staffId,
            generatedByName: staffName,
          }
        );
        if (!result.ok) {
          console.error('[petReportRegenerate] failed:', result.error);
        }
      } catch (err) {
        console.error('[petReportRegenerate] error:', err);
      }
    };
    window.addEventListener('petReportRegenerate', handler as EventListener);
    return () => window.removeEventListener('petReportRegenerate', handler as EventListener);
  }, [db, user?.id]);

  const [selectedPetIdx, setSelectedPetIdx] = useState(0);

  const petIdParam = searchParams.get('petId');

  // Add Pet dialog state
  const [addPetOpen, setAddPetOpen] = useState(false);
  const [addPetForm, setAddPetForm] = useState({ name: '', species: '', breed: '', sex: '', dob: '', weight: '', microchip: '', assignedVetId: '' });
  const [addPetSaving, setAddPetSaving] = useState(false);
  const [addPetPhoto, setAddPetPhoto] = useState<File | null>(null);
  const [addPetPhotoPreview, setAddPetPhotoPreview] = useState<string | null>(null);
  const addPetPhotoRef = useRef<HTMLInputElement>(null);

  // Fetch vets for doctor assignment
  const [vets, setVets] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await db
        .from('staff')
        .select('id, first_name, last_name, role')
        .in('role', ['veterinarian', 'senior_veterinarian', 'specialist'])
        .eq('status', 'Active')
        .order('first_name');
      if (data) setVets(data.map((s: any) => ({ id: s.id, name: `Dr. ${s.first_name} ${s.last_name}` })));
    })();
  }, []);

  const handleAddPet = async () => {
    if (!addPetForm.name.trim() || !addPetForm.species || !id) return;
    setAddPetSaving(true);
    try {
      const weightNum = addPetForm.weight ? parseFloat(addPetForm.weight) : undefined;
      let photoUrl: string | null = null;
      if (addPetPhoto) {
        const ext = addPetPhoto.name.split('.').pop() || 'jpg';
        const path = `${id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('pet-images').upload(path, addPetPhoto, { upsert: true, contentType: addPetPhoto.type });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('pet-images').getPublicUrl(path);
          photoUrl = urlData.publicUrl + '?t=' + Date.now();
        }
      }
      const { organizationId } = await getOrgContext();
      const { error: petErr } = await db.from('pets').insert([{
        client_id: id,
        organization_id: organizationId,
        name: addPetForm.name.trim(),
        species: addPetForm.species,
        breed: addPetForm.breed || null,
        sex: addPetForm.sex || 'Unknown',
        date_of_birth: addPetForm.dob || null,
        weight_kg: (weightNum && !isNaN(weightNum)) ? weightNum : null,
        microchip_no: addPetForm.microchip || null,
        photo_url: photoUrl,
        is_active: true,
        assigned_vet_id: addPetForm.assignedVetId || null,
      }]);
      if (petErr) {
        console.error('Add pet error:', petErr);
      }
      {
        // Reload client data to pick up the new pet
        const orgCtx = await getOrgContext();
        const { data: c } = await db
          .from('clients')
          .select('id, first_name, last_name, email, phone, address, city, state, zip, country, notes, portal_status, health_status, created_at, pets(id, name, species, breed, date_of_birth, sex, weight_kg, microchip_no, photo_url, assigned_vet_id, assigned_vet:staff!pets_assigned_vet_id_fkey(id, profiles:profiles!staff_profile_id_fkey(first_name, last_name)))')
          .eq('organization_id', orgCtx.organizationId)
          .eq('id', id)
          .single();
        if (c) {
          const petIds = (c.pets as any[] || []).map((p: any) => p.id);
          const [alRes, coRes, trRes, apRes] = await Promise.all([
            petIds.length > 0 ? db.from('pet_allergies').select('*').in('pet_id', petIds) : { data: [] },
            petIds.length > 0 ? db.from('pet_conditions').select('*').in('pet_id', petIds) : { data: [] },
            petIds.length > 0 ? db.from('pet_treatments').select('*').in('pet_id', petIds).order('date', { ascending: false }) : { data: [] },
            petIds.length > 0 ? db.from('appointments').select('id, pet_id, scheduled_at, duration_minutes, status, reason, staff!appointments_vet_id_fkey(profiles:profiles!staff_profile_id_fkey(first_name, last_name))').eq('organization_id', orgCtx.organizationId).in('pet_id', petIds).gte('scheduled_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()).order('scheduled_at', { ascending: true }) : { data: [] },
          ]);
          const petAppts2 = (apRes.data || []) as any[];
          const pets = (c.pets as any[] || []).map((p: any, idx: number) => ({
            id: idx + 1, dbId: p.id as string, name: p.name || '—', species: p.species || '—', breed: p.breed || '—',
            dob: p.date_of_birth || '', age: p.date_of_birth ? `${Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} years` : '—',
            sex: p.sex || '—', weight: p.weight_kg ? `${p.weight_kg} kg` : '—', microchip: p.microchip_no || '—',
            color: '—', image: p.photo_url || '', assignedVet: p.assigned_vet?.profiles ? `Dr. ${p.assigned_vet.profiles.first_name} ${p.assigned_vet.profiles.last_name}` : '—', status: ((['Healthy', 'Follow-up', 'Critical'].includes((c as any).health_status)) ? (c as any).health_status : 'Healthy') as 'Healthy' | 'Follow-up' | 'Critical',
            conditions: ((coRes.data as any[]) || []).filter((co: any) => co.pet_id === p.id).map((co: any) => ({ id: co.id, name: co.name, status: co.status || 'active', date: co.date_diagnosed || co.created_at?.split('T')[0] || '', notes: co.notes || '' })),
            treatments: ((trRes.data as any[]) || []).filter((t: any) => t.pet_id === p.id).map((t: any) => ({ id: t.id, name: t.name, date: t.date || '', vet: t.vet || '—', notes: t.notes || '', addedBy: t.added_by || '', createdAt: t.created_at || '' })),
            allergies: ((alRes.data as any[]) || []).filter((a: any) => a.pet_id === p.id).map((a: any) => a.name as string),
            visits: [] as any[], vetNotes: '', clientNotes: '',
            upcomingAppointments: petAppts2.filter((a: any) => a.pet_id === p.id).map((a: any, ai: number) => {
              const d = new Date(a.scheduled_at);
              const fmtTime = (dt: Date) => { let h = dt.getHours(); const m = dt.getMinutes(); const ampm = h >= 12 ? 'PM' : 'AM'; if (h > 12) h -= 12; if (h === 0) h = 12; return `${h}:${m.toString().padStart(2, '0')} ${ampm}`; };
              return { id: ai + 1, time: fmtTime(d), date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), reason: a.reason || a.status || 'Appointment' };
            }),
            vaccinations: [] as any[],
          }));
          const countryLabel = c.country === 'CA' ? 'Canada' : (c.country === 'US' ? 'USA' : '');
      const addr = [c.address, c.city, c.state ? `${c.state} ${c.zip || ''}`.trim() : c.zip, countryLabel].filter(Boolean).join(', ');
          setClient({
            id: 1,
            owner: { name: `${c.first_name} ${c.last_name}`, email: c.email || '—', phone: c.phone || '—', address: addr || '—', emergencyContact: '—', emergencyPhone: '—' },
            insurance: { provider: '—', policyNumber: '—', coverageType: '—', expiryDate: '—' },
            pets: pets.length > 0 ? pets : [{ id: 1, dbId: '', assignedVet: '—', name: '—', species: '—', breed: '—', dob: '', age: '—', sex: '—', weight: '—', microchip: '—', color: '—', image: '', status: 'Healthy' as const, conditions: [], treatments: [], allergies: [], visits: [], vetNotes: '', clientNotes: '', upcomingAppointments: [], vaccinations: [] }],
          });
          // Select the newly added pet (last one)
          handleSelectPet(pets.length - 1);
        }
      }
      // Notify other pages of the new pet
      window.dispatchEvent(new CustomEvent('petDataChanged'));
    } catch (err) {
      console.error('Add pet error:', err);
    }
    setAddPetOpen(false);
    setAddPetForm({ name: '', species: '', breed: '', sex: '', dob: '', weight: '', microchip: '', assignedVetId: '' });
    setAddPetPhoto(null);
    setAddPetPhotoPreview(null);
    setAddPetSaving(false);
  };

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({});

  const fetchTabCounts = useCallback(async (petDbId: string) => {
    if (!petDbId) return;
    try {
      const results = await Promise.all([
        db.from('pet_conditions').select('id', { count: 'exact', head: true }).eq('pet_id', petDbId),
        db.from('pet_allergies').select('id', { count: 'exact', head: true }).eq('pet_id', petDbId),
        db.from('pet_treatments').select('id', { count: 'exact', head: true }).eq('pet_id', petDbId),
        db.from('appointments').select('id', { count: 'exact', head: true }).eq('pet_id', petDbId),
        db.from('vaccinations').select('id', { count: 'exact', head: true }).eq('pet_id', petDbId),
        db.from('imaging_studies').select('id', { count: 'exact', head: true }).eq('pet_id', petDbId),
        db.from('surgeries').select('id', { count: 'exact', head: true }).eq('pet_id', petDbId),
        db.from('treatment_plans').select('id', { count: 'exact', head: true }).eq('pet_id', petDbId),
        db.from('diet_plans').select('id', { count: 'exact', head: true }).eq('pet_id', petDbId),
        db.from('lab_results').select('id', { count: 'exact', head: true }).eq('pet_id', petDbId),
        db.from('pet_notes').select('id', { count: 'exact', head: true }).eq('pet_id', petDbId),
        db.from('pet_photos').select('id', { count: 'exact', head: true }).eq('pet_id', petDbId),
        db.from('pet_reports').select('id', { count: 'exact', head: true }).eq('pet_id', petDbId),
      ]);
      setTabCounts({
        'medical-overview': (results[0].count ?? 0) + (results[1].count ?? 0) + (results[2].count ?? 0),
        visits: results[3].count ?? 0,
        injections: results[4].count ?? 0,
        xray: results[5].count ?? 0,
        surgery: results[6].count ?? 0,
        plan: results[7].count ?? 0,
        diet: results[8].count ?? 0,
        lab: results[9].count ?? 0,
        notes: results[10].count ?? 0,
        photos: results[11].count ?? 0,
        reports: results[12].count ?? 0,
      });
    } catch {}
  }, []);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const { organizationId } = await getOrgContext();
      const currentPet = client.pets[selectedPetIdx];
      const petDbId = currentPet?.dbId;

      // Save pet fields
      if (petDbId) {
        const weightVal = petWeight.replace(/\s*kg\s*/i, '').trim();
        const weightNum = weightVal ? parseFloat(weightVal) : null;
        await db.from('pets').update({
          name: petName !== '—' ? petName : null,
          species: petSpecies !== '—' ? petSpecies : null,
          breed: petBreed !== '—' ? petBreed : null,
          sex: petSex !== '—' ? petSex : 'Unknown',
          date_of_birth: petDob || null,
          weight_kg: (weightNum && !isNaN(weightNum)) ? weightNum : null,
          microchip_no: petMicrochip !== '—' ? petMicrochip : null,
        }).eq('id', petDbId).eq('organization_id', organizationId);
      }

      // Save client/owner fields
      const nameParts = ownerName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      await db.from('clients').update({
        first_name: firstName,
        last_name: lastName,
        email: ownerEmail !== '—' ? ownerEmail : null,
        phone: ownerPhone !== '—' ? ownerPhone : null,
        address: ownerAddress !== '—' ? ownerAddress : null,
      }).eq('id', id).eq('organization_id', organizationId);

      // Notify other pages of the data change
      window.dispatchEvent(new CustomEvent('clientDataChanged'));
      window.dispatchEvent(new CustomEvent('petDataChanged'));
    } catch (err) {
      console.error('Save error:', err);
    }
    setSaving(false);
    setEditing(false);
  };
  const [allergies, setAllergies] = useState(client.pets[0].allergies);
  const [allergyInput, setAllergyInput] = useState('');
  const [showAllergyInput, setShowAllergyInput] = useState(false);
  const [treatmentDialogOpen, setTreatmentDialogOpen] = useState(false);
  const [treatmentPopoverOpen, setTreatmentPopoverOpen] = useState(false);
  const [treatments, setTreatments] = useState(client.pets[0].treatments);
  const [newTreatmentName, setNewTreatmentName] = useState('');
  const [newTreatmentDate, setNewTreatmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTreatmentVet, setNewTreatmentVet] = useState('');
  const [newTreatmentNotes, setNewTreatmentNotes] = useState('');
  const [vetNotes, setVetNotes] = useState(client.pets[0].vetNotes);
  const [clientNotes, setClientNotes] = useState(client.pets[0].clientNotes);
  const [newVetNote, setNewVetNote] = useState('');
  const [newClientNote, setNewClientNote] = useState('');
  const [noteHistory, setNoteHistory] = useState<{ id: string; type: string; content: string; created_at: string; author: { first_name: string; last_name: string; role: string } }[]>([]);
  const [noteSaving, setNoteSaving] = useState(false);
  const [visitReports, setVisitReports] = useState<any[]>([]);
  const [labFiles, setLabFiles] = useState<any[]>([]);
  const [labLoading, setLabLoading] = useState(false);
  const [activeVaxDot, setActiveVaxDot] = useState(0);
  const vaxScrollRef = useRef<HTMLDivElement>(null);

  // Editable pet fields
  const [petName, setPetName] = useState(client.pets[0].name);
  const [petImage, setPetImage] = useState(client.pets[0].image);
  const [petSpecies, setPetSpecies] = useState(client.pets[0].species);
  const [petBreed, setPetBreed] = useState(client.pets[0].breed);
  const [petDob, setPetDob] = useState(client.pets[0].dob);
  const [petSex, setPetSex] = useState(client.pets[0].sex);
  const [petWeight, setPetWeight] = useState(client.pets[0].weight);
  const [petMicrochip, setPetMicrochip] = useState(client.pets[0].microchip);
  const [petColor, setPetColor] = useState(client.pets[0].color);
  const [petAssignedVet, setPetAssignedVet] = useState(client.pets[0].assignedVet);

  // Editable owner fields
  const [ownerName, setOwnerName] = useState(client.owner.name);
  const [ownerEmail, setOwnerEmail] = useState(client.owner.email);
  const [ownerPhone, setOwnerPhone] = useState(client.owner.phone);
  const [ownerAddress, setOwnerAddress] = useState(client.owner.address);
  const [emergencyContact, setEmergencyContact] = useState(client.owner.emergencyContact);
  const [emergencyPhone, setEmergencyPhone] = useState(client.owner.emergencyPhone);

  // Editable insurance fields
  const [insProvider, setInsProvider] = useState(client.insurance.provider);
  const [insPolicyNumber, setInsPolicyNumber] = useState(client.insurance.policyNumber);
  const [insCoverageType, setInsCoverageType] = useState(client.insurance.coverageType);
  const [insExpiry, setInsExpiry] = useState(client.insurance.expiryDate);

  const [patientStatus, setPatientStatus] = useState<PatientStatus>(client.pets[0].status);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('pet-images').upload(path, file, { upsert: true, contentType: file.type });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('pet-images').getPublicUrl(path);
      const publicUrl = urlData.publicUrl + '?t=' + Date.now();
      // Update the pet record in Supabase
      const pet = (client.pets as any[])[selectedPetIdx];
      if (pet) {
        // Find the real Supabase pet ID
        const { data: petsData } = await db
          .from('pets')
          .select('id')
          .eq('client_id', id)
          .order('created_at', { ascending: true });
        const realPetId = petsData?.[selectedPetIdx]?.id;
        if (realPetId) {
          const { organizationId } = await getOrgContext();
          await db.from('pets').update({ photo_url: publicUrl }).eq('id', realPetId).eq('organization_id', organizationId);
        }
      }
      setPetImage(publicUrl);
    } catch (err) {
      console.error('Photo upload failed:', err);
    }
    setUploadingPhoto(false);
    // Reset input so the same file can be re-selected
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  // Sync state when DB data loads
  useEffect(() => {
    if (!dbLoaded) return;
    // Auto-select pet from ?petId= query param, or default to first
    let initialIdx = 0;
    if (petIdParam) {
      const found = client.pets.findIndex((p: any) => p.dbId === petIdParam);
      if (found >= 0) initialIdx = found;
    }
    const p = client.pets[initialIdx];
    setPetName(p.name); setPetImage(p.image); setPetSpecies(p.species);
    setPetBreed(p.breed); setPetDob(p.dob); setPetSex(p.sex);
    setPetWeight(p.weight); setPetMicrochip(p.microchip); setPetColor(p.color); setPetAssignedVet(p.assignedVet);
    setAllergies(p.allergies); setTreatments(p.treatments);
    setVetNotes(p.vetNotes); setClientNotes(p.clientNotes);
    setPatientStatus(p.status);
    setOwnerName(client.owner.name); setOwnerEmail(client.owner.email);
    setOwnerPhone(client.owner.phone); setOwnerAddress(client.owner.address);
    setEmergencyContact(client.owner.emergencyContact); setEmergencyPhone(client.owner.emergencyPhone);
    setInsProvider(client.insurance.provider); setInsPolicyNumber(client.insurance.policyNumber);
    setInsCoverageType(client.insurance.coverageType); setInsExpiry(client.insurance.expiryDate);
    setSelectedPetIdx(initialIdx);
  }, [dbLoaded, client]);

  // Load note history for the selected pet
  const fetchNotes = useCallback(async (petDbId: string) => {
    if (!petDbId) return;
    const { organizationId } = await getOrgContext();
    const { data } = await db
      .from('pet_notes')
      .select('id, type, content, created_at, author:staff!pet_notes_author_id_fkey(role, profiles:profiles!staff_profile_id_fkey(first_name, last_name))')
      .eq('pet_id', petDbId)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
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
  }, []);

  const fetchVisitReports = useCallback(async (petDbId: string) => {
    if (!petDbId) return;
    const { organizationId } = await getOrgContext();
    // Fetch appointments
    const { data } = await db
      .from('appointments')
      .select('id, scheduled_at, duration_minutes, status, type, reason, notes, visit_started_at, checkout_done_at, staff:staff!appointments_vet_id_fkey(profiles:profiles!staff_profile_id_fkey(first_name, last_name)), services:services!appointments_service_id_fkey(name)')
      .eq('pet_id', petDbId)
      .eq('organization_id', organizationId)
      .eq('status', 'Completed')
      .order('scheduled_at', { ascending: false });
    // Fetch medical records for this pet
    const { data: mrData } = await db
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
          // Medical record data
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

  const fetchLabFiles = useCallback(async (petDbId: string) => {
    if (!petDbId) return;
    setLabLoading(true);
    const { organizationId } = await getOrgContext();
    const { data } = await db
      .from('lab_results')
      .select(`
        id, file_name, file_url, file_type, test_panel, notes,
        review_status, reviewed_at, created_at,
        uploader:profiles!lab_results_uploaded_by_fkey(first_name, last_name),
        reviewer:profiles!lab_results_reviewed_by_fkey(first_name, last_name)
      `)
      .eq('pet_id', petDbId)
      .eq('organization_id', organizationId)
      .not('file_url', 'is', null)
      .order('created_at', { ascending: false });
    if (data) setLabFiles(data);
    setLabLoading(false);
  }, []);

  useEffect(() => {
    const petDbId = client.pets[selectedPetIdx]?.dbId;
    if (petDbId) {
      fetchNotes(petDbId);
      fetchVisitReports(petDbId);
      fetchLabFiles(petDbId);
      fetchTabCounts(petDbId);
    }
  }, [selectedPetIdx, client.pets, fetchNotes, fetchVisitReports, fetchLabFiles, fetchTabCounts]);

  // Re-fetch tab counts when pet data changes on other pages
  useEffect(() => {
    const handler = () => {
      const petDbId = client.pets[selectedPetIdx]?.dbId;
      if (petDbId) fetchTabCounts(petDbId);
    };
    window.addEventListener('petDataChanged', handler);
    window.addEventListener('clientDataChanged', handler);
    return () => {
      window.removeEventListener('petDataChanged', handler);
      window.removeEventListener('clientDataChanged', handler);
    };
  }, [selectedPetIdx, client.pets, fetchTabCounts]);

  const handleSaveNote = async (type: 'vet' | 'client') => {
    const content = type === 'vet' ? newVetNote.trim() : newClientNote.trim();
    if (!content || !user) return;
    setNoteSaving(true);
    try {
      const { organizationId } = await getOrgContext();
      const petDbId = client.pets[selectedPetIdx]?.dbId;
      await db.from('pet_notes').insert({
        pet_id: petDbId,
        organization_id: organizationId,
        author_id: user.id,
        type,
        content,
      });
      if (type === 'vet') setNewVetNote('');
      else setNewClientNote('');
      await fetchNotes(petDbId);
      if (petDbId) requestPetReport(petDbId, 'note');
    } catch (e) {
      console.error('Failed to save note:', e);
    }
    setNoteSaving(false);
  };

  const petStatus = statusColors[patientStatus] || statusColors.Healthy;
  const petStatusOpt = STATUS_OPTIONS.find((o) => o.value === patientStatus)!;

  const handleSelectPet = (idx: number) => {
    const p = client.pets[idx];
    setSelectedPetIdx(idx);
    setPetName(p.name);
    setPetImage(p.image);
    setPetSpecies(p.species);
    setPetBreed(p.breed);
    setPetDob(p.dob);
    setPetSex(p.sex);
    setPetWeight(p.weight);
    setPetMicrochip(p.microchip);
    setPetColor(p.color);
    setPetAssignedVet(p.assignedVet);
    setAllergies(p.allergies);
    setTreatments(p.treatments);
    setVetNotes(p.vetNotes);
    setClientNotes(p.clientNotes);
    setPatientStatus(p.status);
    setActiveVaxDot(0);
    setEditing(false);
  };

  const handleAddAllergy = async () => {
    if (allergyInput.trim()) {
      const pet = client.pets[selectedPetIdx];
      const petDbId = pet?.dbId;
      const trimmed = allergyInput.trim();
      if (petDbId) {
        await db.from('pet_allergies').insert({ pet_id: petDbId, name: trimmed });
      }
      setAllergies([...allergies, trimmed]);
      setAllergyInput('');
      setShowAllergyInput(false);
    }
  };

  const handleRemoveAllergy = async (allergyName: string) => {
    const pet = client.pets[selectedPetIdx];
    const petDbId = pet?.dbId;
    if (petDbId) {
      await db.from('pet_allergies').delete().eq('pet_id', petDbId).eq('name', allergyName);
    }
    setAllergies(allergies.filter(a => a !== allergyName));
  };

  const handleAddTreatment = async () => {
    if (!newTreatmentName.trim()) return;
    const pet = client.pets[selectedPetIdx];
    const petDbId = pet?.dbId;
    // Get current user's display name
    let addedByName = 'Unknown';
    if (user) {
      const { data: prof } = await db.from('profiles').select('first_name, last_name').eq('id', user.id).single();
      if (prof) addedByName = `${prof.first_name || ''} ${prof.last_name || ''}`.trim() || user.email || 'Unknown';
    }
    if (petDbId) {
      const { data } = await db.from('pet_treatments').insert({
        pet_id: petDbId, name: newTreatmentName.trim(), date: newTreatmentDate, vet: newTreatmentVet, notes: newTreatmentNotes, added_by: addedByName,
      }).select().single();
      const createdAt = data?.created_at || new Date().toISOString();
      setTreatments([{ id: data?.id || Date.now(), name: newTreatmentName.trim(), date: newTreatmentDate, vet: newTreatmentVet, notes: newTreatmentNotes, addedBy: addedByName, createdAt }, ...treatments]);
    } else {
      setTreatments([{ id: Date.now(), name: newTreatmentName.trim(), date: newTreatmentDate, vet: newTreatmentVet, notes: newTreatmentNotes, addedBy: addedByName, createdAt: new Date().toISOString() }, ...treatments]);
    }
    setNewTreatmentName(''); setNewTreatmentDate(new Date().toISOString().split('T')[0]);
    setNewTreatmentVet(''); setNewTreatmentNotes('');
    setTreatmentDialogOpen(false);
    if (petDbId) requestPetReport(petDbId, 'visit');
  };

  const handleRemoveTreatment = async (treatmentId: any) => {
    await db.from('pet_treatments').delete().eq('id', treatmentId);
    setTreatments(treatments.filter(t => t.id !== treatmentId));
  };

  if (!dbLoaded) {
    return (
      <div className="max-w-[1200px] mx-auto p-8 flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-green-text)]" />
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto p-8">
      {/* Back Link */}
      <Link
        to={clientsPath}
        className="inline-flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-6"
        style={{ fontSize: '14px', fontWeight: 400 }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Clients
      </Link>

      {/* ─── Header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="relative group cursor-pointer" onClick={() => photoInputRef.current?.click()}>
            <Avatar className="w-16 h-16">
              <AvatarImage src={petImage} alt={petName} className="object-cover" />
              <AvatarFallback>{ownerName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div
              className="absolute inset-0 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
            >
              {uploadingPhoto ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-white" />
              )}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[var(--text-primary)]">{petName}</h1>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="inline-flex items-center gap-1.5 px-3 py-1 transition-opacity hover:opacity-80 focus:outline-none"
                    style={{
                      backgroundColor: petStatus.bg, color: petStatus.text,
                      borderRadius: '9999px', fontSize: '14px', fontWeight: 600,
                    }}
                  >
                    <petStatusOpt.icon className="w-3.5 h-3.5" />
                    {patientStatus}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" style={{ minWidth: '210px' }}>
                  <DropdownMenuLabel style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                    CHANGE STATUS
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {STATUS_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isCurrent = patientStatus === option.value;
                    return (
                      <DropdownMenuItem
                        key={option.value}
                        onClick={async () => {
                          setPatientStatus(option.value);
                          if (id) {
                            const { organizationId } = await getOrgContext();
                            await db.from('clients').update({ health_status: option.value }).eq('id', id).eq('organization_id', organizationId);
                          }
                        }}
                        className="flex items-start gap-3 cursor-pointer focus:bg-[var(--surface-elevated)] focus:text-[var(--text-primary)] data-[highlighted]:bg-[var(--surface-elevated)] data-[highlighted]:text-[var(--text-primary)]"
                      >
                        <span
                          className="mt-0.5 flex-shrink-0 w-6 h-6 flex items-center justify-center"
                          style={{ borderRadius: '9999px', backgroundColor: option.bg }}
                        >
                          <Icon className="w-3.5 h-3.5" style={{ color: option.text }} />
                        </span>
                        <span className="flex-1">
                          <span className="block" style={{ fontSize: '14px', fontWeight: isCurrent ? 700 : 500, color: 'var(--text-primary)' }}>
                            {option.value}
                            {isCurrent && (
                              <span style={{ color: option.text, marginLeft: '6px', fontSize: '11px' }}>✓ current</span>
                            )}
                          </span>
                          <span className="block text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>
                            {option.description}
                          </span>
                        </span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '16px', fontWeight: 400 }}>
              {petBreed} · {petSpecies} · Owner: {client.owner.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'overview' && (
            <Button
              variant={editing ? 'default' : 'outline'}
              onClick={() => editing ? handleSave() : setEditing(true)}
              disabled={saving}
            >
              {editing ? <><Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}</> : <><Edit2 className="w-4 h-4" /> Edit</>}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                const petsHtml = client.pets.map((p: any) => {
                  const conditionsHtml = (p.conditions || []).map((c: any) =>
                    `<tr><td>${c.name}</td><td>${c.dateDiagnosed || '—'}</td><td><span class="badge ${c.status === 'active' ? 'badge-active' : 'badge-resolved'}">${c.status}</span></td></tr>`
                  ).join('') || '<tr><td colspan="3" class="empty">No conditions recorded</td></tr>';

                  const treatmentsHtml = (p.treatments || []).map((t: any) =>
                    `<tr><td>${t.name}</td><td>${t.date || '—'}</td><td>${t.vet || '—'}</td><td>${t.notes || '—'}</td></tr>`
                  ).join('') || '<tr><td colspan="4" class="empty">No treatments recorded</td></tr>';

                  const vaccHtml = (p.vaccinations || []).map((v: any) =>
                    `<tr><td>${v.name}</td><td><span class="badge ${v.status === 'Up to date' ? 'badge-active' : 'badge-due'}">${v.status}</span></td><td>${v.lastGiven || '—'}</td><td>${v.nextDue || '—'}</td></tr>`
                  ).join('') || '<tr><td colspan="4" class="empty">No vaccination records</td></tr>';

                  const visitsHtml = visitReports.map((v: any) =>
                    `<tr><td>${new Date(v.visit_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${v.visit_time ? ' ' + v.visit_time : ''}</td><td>${v.reason}</td><td>${v.vet_name}</td><td><span class="badge badge-active">${v.status}</span></td></tr>`
                  ).join('') || '<tr><td colspan="4" class="empty">No completed visits</td></tr>';

                  return `
                    <div class="pet-section">
                      <div class="pet-header">
                        ${p.image ? `<img src="${p.image}" class="pet-photo" alt="${p.name}" />` : `<div class="pet-photo pet-photo-placeholder">${(p.name || '?')[0]}</div>`}
                        <div>
                          <h2>${p.name}</h2>
                          <p class="subtitle">${p.species} &middot; ${p.breed} &middot; ${p.sex || '—'} &middot; ${p.age || '—'}</p>
                        </div>
                        <span class="badge ${p.status === 'Healthy' ? 'badge-active' : 'badge-due'}" style="margin-left:auto;font-size:13px;">${p.status}</span>
                      </div>
                      <div class="info-grid">
                        <div><span class="label">Date of Birth</span><span class="value">${p.dob || '—'}</span></div>
                        <div><span class="label">Weight</span><span class="value">${p.weight || '—'}</span></div>
                        <div><span class="label">Microchip</span><span class="value">${p.microchip || '—'}</span></div>
                        <div><span class="label">Color</span><span class="value">${p.color || '—'}</span></div>
                        <div><span class="label">Assigned Vet</span><span class="value">${p.assignedVet || '—'}</span></div>
                        <div><span class="label">Allergies</span><span class="value">${(p.allergies || []).join(', ') || 'None'}</span></div>
                      </div>

                      <h3>Conditions</h3>
                      <table><thead><tr><th>Condition</th><th>Date Diagnosed</th><th>Status</th></tr></thead><tbody>${conditionsHtml}</tbody></table>

                      <h3>Treatments</h3>
                      <table><thead><tr><th>Treatment</th><th>Date</th><th>Vet</th><th>Notes</th></tr></thead><tbody>${treatmentsHtml}</tbody></table>

                      <h3>Vaccinations</h3>
                      <table><thead><tr><th>Vaccine</th><th>Status</th><th>Last Given</th><th>Next Due</th></tr></thead><tbody>${vaccHtml}</tbody></table>

                      <h3>Visit History</h3>
                      <table><thead><tr><th>Date</th><th>Reason</th><th>Vet</th><th>Status</th></tr></thead><tbody>${visitsHtml}</tbody></table>
                    </div>`;
                }).join('');

                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Client Report — ${ownerName}</title>
                <style>
                  @page { margin: 20mm; size: A4; }
                  * { box-sizing: border-box; margin: 0; padding: 0; }
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; line-height: 1.5; padding: 0; }
                  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #2d6a4f; padding-bottom: 16px; margin-bottom: 24px; }
                  .header h1 { font-size: 22px; color: #2d6a4f; }
                  .header .meta { text-align: right; font-size: 12px; color: #666; }
                  .owner-card { background: #f8faf9; border: 1px solid #dce8e0; border-radius: 10px; padding: 20px; margin-bottom: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px 32px; }
                  .owner-card h2 { grid-column: 1/-1; font-size: 18px; margin-bottom: 4px; color: #1a1a2e; }
                  .owner-card .field { display: flex; flex-direction: column; }
                  .owner-card .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #888; font-weight: 600; }
                  .owner-card .value { font-size: 14px; color: #333; }
                  .pet-section { border: 1px solid #e0e0e0; border-radius: 10px; padding: 20px; margin-bottom: 24px; page-break-inside: avoid; }
                  .pet-header { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
                  .pet-photo { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; border: 2px solid #2d6a4f; }
                  .pet-photo-placeholder { background: #2d6a4f; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; }
                  .pet-header h2 { font-size: 18px; margin: 0; }
                  .subtitle { font-size: 13px; color: #666; }
                  .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; background: #fafafa; padding: 12px; border-radius: 8px; }
                  .info-grid .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #999; font-weight: 600; display: block; }
                  .info-grid .value { font-size: 13px; color: #333; }
                  h3 { font-size: 14px; color: #2d6a4f; margin: 16px 0 8px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e8e8e8; padding-bottom: 4px; }
                  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12px; }
                  th { background: #f0f5f2; color: #2d6a4f; text-align: left; padding: 6px 10px; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
                  td { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; color: #444; }
                  tr:last-child td { border-bottom: none; }
                  .empty { text-align: center; color: #aaa; font-style: italic; padding: 12px; }
                  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
                  .badge-active { background: #d4edda; color: #155724; }
                  .badge-resolved { background: #e2e8f0; color: #4a5568; }
                  .badge-due { background: #fff3cd; color: #856404; }
                  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 11px; color: #999; text-align: center; }
                  @media print { body { padding: 0; } .no-print { display: none; } }
                </style></head><body>
                <div class="header">
                  <h1>HugoIT &mdash; Client Report</h1>
                  <div class="meta">Generated: ${today}<br/>Client ID: ${id || '—'}</div>
                </div>

                <div class="owner-card">
                  <h2>${ownerName}</h2>
                  <div class="field"><span class="label">Email</span><span class="value">${ownerEmail}</span></div>
                  <div class="field"><span class="label">Phone</span><span class="value">${ownerPhone}</span></div>
                  <div class="field"><span class="label">Address</span><span class="value">${ownerAddress}</span></div>
                  <div class="field"><span class="label">Emergency Contact</span><span class="value">${emergencyContact || '—'} ${emergencyPhone ? '· ' + emergencyPhone : ''}</span></div>
                  <div class="field"><span class="label">Insurance</span><span class="value">${insProvider || '—'} ${insPolicyNumber ? '· ' + insPolicyNumber : ''}</span></div>
                  <div class="field"><span class="label">Coverage</span><span class="value">${insCoverageType || '—'} ${insExpiry ? '· Exp: ' + insExpiry : ''}</span></div>
                </div>

                ${petsHtml}

                <div class="footer">HugoIT Veterinary Management &mdash; Confidential Patient Record &mdash; ${today}</div>

                <div class="no-print" style="text-align:center;margin-top:24px;">
                  <button onclick="window.print()" style="padding:10px 28px;background:#2d6a4f;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600;">Print / Save as PDF</button>
                </div>
                </body></html>`;

                const w = window.open('', '_blank');
                if (w) { w.document.write(html); w.document.close(); }
              }}>
                <FileDown className="w-4 h-4 mr-2" /> Export Full Report
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                const petsHtml = client.pets.map((p: any) => {
                  const conditionsHtml = (p.conditions || []).map((c: any) =>
                    `<tr><td>${c.name}</td><td>${c.dateDiagnosed || '—'}</td><td><span class="badge ${c.status === 'active' ? 'badge-active' : 'badge-resolved'}">${c.status}</span></td></tr>`
                  ).join('') || '<tr><td colspan="3" class="empty">No conditions recorded</td></tr>';

                  const treatmentsHtml = (p.treatments || []).map((t: any) =>
                    `<tr><td>${t.name}</td><td>${t.date || '—'}</td><td>${t.vet || '—'}</td><td>${t.notes || '—'}</td></tr>`
                  ).join('') || '<tr><td colspan="4" class="empty">No treatments recorded</td></tr>';

                  const vaccHtml = (p.vaccinations || []).map((v: any) =>
                    `<tr><td>${v.name}</td><td><span class="badge ${v.status === 'Up to date' ? 'badge-active' : 'badge-due'}">${v.status}</span></td><td>${v.lastGiven || '—'}</td><td>${v.nextDue || '—'}</td></tr>`
                  ).join('') || '<tr><td colspan="4" class="empty">No vaccination records</td></tr>';

                  const visitsHtml = visitReports.map((v: any) =>
                    `<tr><td>${new Date(v.visit_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${v.visit_time ? ' ' + v.visit_time : ''}</td><td>${v.reason}</td><td>${v.vet_name}</td><td><span class="badge badge-active">${v.status}</span></td></tr>`
                  ).join('') || '<tr><td colspan="4" class="empty">No completed visits</td></tr>';

                  return `
                    <div class="pet-section">
                      <div class="pet-header">
                        ${p.image ? `<img src="${p.image}" class="pet-photo" alt="${p.name}" />` : `<div class="pet-photo pet-photo-placeholder">${(p.name || '?')[0]}</div>`}
                        <div>
                          <h2>${p.name}</h2>
                          <p class="subtitle">${p.species} &middot; ${p.breed} &middot; ${p.sex || '—'} &middot; ${p.age || '—'}</p>
                        </div>
                        <span class="badge ${p.status === 'Healthy' ? 'badge-active' : 'badge-due'}" style="margin-left:auto;font-size:13px;">${p.status}</span>
                      </div>
                      <div class="info-grid">
                        <div><span class="label">Date of Birth</span><span class="value">${p.dob || '—'}</span></div>
                        <div><span class="label">Weight</span><span class="value">${p.weight || '—'}</span></div>
                        <div><span class="label">Microchip</span><span class="value">${p.microchip || '—'}</span></div>
                        <div><span class="label">Color</span><span class="value">${p.color || '—'}</span></div>
                        <div><span class="label">Assigned Vet</span><span class="value">${p.assignedVet || '—'}</span></div>
                        <div><span class="label">Allergies</span><span class="value">${(p.allergies || []).join(', ') || 'None'}</span></div>
                      </div>

                      <h3>Conditions</h3>
                      <table><thead><tr><th>Condition</th><th>Date Diagnosed</th><th>Status</th></tr></thead><tbody>${conditionsHtml}</tbody></table>

                      <h3>Treatments</h3>
                      <table><thead><tr><th>Treatment</th><th>Date</th><th>Vet</th><th>Notes</th></tr></thead><tbody>${treatmentsHtml}</tbody></table>

                      <h3>Vaccinations</h3>
                      <table><thead><tr><th>Vaccine</th><th>Status</th><th>Last Given</th><th>Next Due</th></tr></thead><tbody>${vaccHtml}</tbody></table>

                      <h3>Visit History</h3>
                      <table><thead><tr><th>Date</th><th>Reason</th><th>Vet</th><th>Status</th></tr></thead><tbody>${visitsHtml}</tbody></table>
                    </div>`;
                }).join('');

                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Client Report — ${ownerName}</title>
                <style>
                  @page { margin: 20mm; size: A4; }
                  * { box-sizing: border-box; margin: 0; padding: 0; }
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; line-height: 1.5; padding: 0; }
                  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #2d6a4f; padding-bottom: 16px; margin-bottom: 24px; }
                  .header h1 { font-size: 22px; color: #2d6a4f; }
                  .header .meta { text-align: right; font-size: 12px; color: #666; }
                  .owner-card { background: #f8faf9; border: 1px solid #dce8e0; border-radius: 10px; padding: 20px; margin-bottom: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px 32px; }
                  .owner-card h2 { grid-column: 1/-1; font-size: 18px; margin-bottom: 4px; color: #1a1a2e; }
                  .owner-card .field { display: flex; flex-direction: column; }
                  .owner-card .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #888; font-weight: 600; }
                  .owner-card .value { font-size: 14px; color: #333; }
                  .pet-section { border: 1px solid #e0e0e0; border-radius: 10px; padding: 20px; margin-bottom: 24px; page-break-inside: avoid; }
                  .pet-header { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
                  .pet-photo { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; border: 2px solid #2d6a4f; }
                  .pet-photo-placeholder { background: #2d6a4f; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; }
                  .pet-header h2 { font-size: 18px; margin: 0; }
                  .subtitle { font-size: 13px; color: #666; }
                  .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; background: #fafafa; padding: 12px; border-radius: 8px; }
                  .info-grid .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #999; font-weight: 600; display: block; }
                  .info-grid .value { font-size: 13px; color: #333; }
                  h3 { font-size: 14px; color: #2d6a4f; margin: 16px 0 8px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e8e8e8; padding-bottom: 4px; }
                  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12px; }
                  th { background: #f0f5f2; color: #2d6a4f; text-align: left; padding: 6px 10px; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
                  td { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; color: #444; }
                  tr:last-child td { border-bottom: none; }
                  .empty { text-align: center; color: #aaa; font-style: italic; padding: 12px; }
                  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
                  .badge-active { background: #d4edda; color: #155724; }
                  .badge-resolved { background: #e2e8f0; color: #4a5568; }
                  .badge-due { background: #fff3cd; color: #856404; }
                  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 11px; color: #999; text-align: center; }
                  @media print { body { padding: 0; } }
                </style></head><body>
                <div class="header">
                  <h1>HugoIT &mdash; Client Report</h1>
                  <div class="meta">Generated: ${today}<br/>Client ID: ${id || '—'}</div>
                </div>
                <div class="owner-card">
                  <h2>${ownerName}</h2>
                  <div class="field"><span class="label">Email</span><span class="value">${ownerEmail}</span></div>
                  <div class="field"><span class="label">Phone</span><span class="value">${ownerPhone}</span></div>
                  <div class="field"><span class="label">Address</span><span class="value">${ownerAddress}</span></div>
                  <div class="field"><span class="label">Emergency Contact</span><span class="value">${emergencyContact || '—'} ${emergencyPhone ? '· ' + emergencyPhone : ''}</span></div>
                  <div class="field"><span class="label">Insurance</span><span class="value">${insProvider || '—'} ${insPolicyNumber ? '· ' + insPolicyNumber : ''}</span></div>
                  <div class="field"><span class="label">Coverage</span><span class="value">${insCoverageType || '—'} ${insExpiry ? '· Exp: ' + insExpiry : ''}</span></div>
                </div>
                ${petsHtml}
                <div class="footer">HugoIT Veterinary Management &mdash; Confidential Patient Record &mdash; ${today}</div>
                </body></html>`;

                const w = window.open('', '_blank');
                if (w) { w.document.write(html); w.document.close(); w.onload = () => w.print(); }
              }}>
                <Printer className="w-4 h-4 mr-2" /> Print Record
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-[#d4183d]"
                onClick={async () => {
                  const currentPet = client.pets[selectedPetIdx];
                  if (!currentPet?.dbId) return;
                  if (client.pets.length <= 1) {
                    // Only 1 pet — can't delete pet alone, use "Delete Client Profile"
                    alert('This is the only pet. Use "Delete Client Profile" to remove everything.');
                    return;
                  }
                  if (!window.confirm(`Delete pet "${petName}"? This cannot be undone.`)) return;
                  const { organizationId } = await getOrgContext();
                  await db.from('pets').delete().eq('id', currentPet.dbId).eq('organization_id', organizationId);
                  // Reload
                  window.location.reload();
                }}
              >
                <PawPrint className="w-4 h-4 mr-2" /> Delete Pet
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-[#d4183d]"
                onClick={async () => {
                  if (!id) return;
                  if (!window.confirm(`Delete the entire client profile for "${ownerName}" and all their pets? This cannot be undone.`)) return;
                  const { organizationId: delOrgId } = await getOrgContext();
                  await db.from('pets').delete().eq('client_id', id).eq('organization_id', delOrgId);
                  await db.from('clients').delete().eq('id', id).eq('organization_id', delOrgId);
                  navigate(clientsPath);
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete Client Profile
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Pet Switcher + Add Pet ── */}
      <div className="flex items-center gap-1.5 mb-4">
        {client.pets.length > 1 && client.pets.map((pet, idx) => {
          const isSelected = idx === selectedPetIdx;
          return (
            <button
              key={pet.id}
              onClick={() => handleSelectPet(idx)}
              className="flex items-center gap-2 px-3 py-1.5 transition-all"
              style={{
                borderRadius: '9999px',
                fontSize: '13px',
                fontWeight: isSelected ? 700 : 500,
                backgroundColor: isSelected ? 'var(--brand-green-text)' : 'var(--surface-elevated)',
                color: isSelected ? '#000' : 'var(--text-secondary)',
                border: isSelected ? 'none' : '1px solid var(--border-color)',
                cursor: 'pointer',
              }}
            >
              <Avatar className="w-5 h-5 flex-shrink-0">
                <AvatarImage src={pet.image} alt={pet.name} className="object-cover" />
                <AvatarFallback style={{ fontSize: '8px', color: '#fff' }}>{pet.name.slice(0, 2)}</AvatarFallback>
              </Avatar>
              {pet.name}
            </button>
          );
        })}
        <button
          onClick={() => setAddPetOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 transition-all hover:bg-[color-mix(in_srgb,var(--brand-green-text)_6%,transparent)]"
          style={{
            borderRadius: '9999px',
            fontSize: '13px',
            fontWeight: 600,
            backgroundColor: 'transparent',
            color: 'var(--brand-green-text)',
            border: '1px dashed var(--brand-green-text)',
            cursor: 'pointer',
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Pet
        </button>
      </div>

      {/* ─── Tabs ───────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="mb-6">
          <div className="overflow-x-auto" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          <TabsList className="w-auto inline-flex">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="medical-overview">Medical Overview{(tabCounts['medical-overview'] ?? 0) > 0 && <span className="inline-block w-1.5 h-1.5 rounded-full ml-1.5" style={{ backgroundColor: 'var(--brand-green-text)' }} />}</TabsTrigger>
            <TabsTrigger value="visits">Visits{(tabCounts.visits ?? 0) > 0 && <span className="inline-block w-1.5 h-1.5 rounded-full ml-1.5" style={{ backgroundColor: 'var(--brand-green-text)' }} />}</TabsTrigger>
            <TabsTrigger value="injections">Injections{(tabCounts.injections ?? 0) > 0 && <span className="inline-block w-1.5 h-1.5 rounded-full ml-1.5" style={{ backgroundColor: 'var(--brand-green-text)' }} />}</TabsTrigger>
            <TabsTrigger value="xray">X-Ray{(tabCounts.xray ?? 0) > 0 && <span className="inline-block w-1.5 h-1.5 rounded-full ml-1.5" style={{ backgroundColor: 'var(--brand-green-text)' }} />}</TabsTrigger>
            <TabsTrigger value="surgery">Surgery{(tabCounts.surgery ?? 0) > 0 && <span className="inline-block w-1.5 h-1.5 rounded-full ml-1.5" style={{ backgroundColor: 'var(--brand-green-text)' }} />}</TabsTrigger>
            <TabsTrigger value="plan">Plan{(tabCounts.plan ?? 0) > 0 && <span className="inline-block w-1.5 h-1.5 rounded-full ml-1.5" style={{ backgroundColor: 'var(--brand-green-text)' }} />}</TabsTrigger>
            <TabsTrigger value="diet">Diet{(tabCounts.diet ?? 0) > 0 && <span className="inline-block w-1.5 h-1.5 rounded-full ml-1.5" style={{ backgroundColor: 'var(--brand-green-text)' }} />}</TabsTrigger>
            <TabsTrigger value="lab">Lab{(tabCounts.lab ?? 0) > 0 && <span className="inline-block w-1.5 h-1.5 rounded-full ml-1.5" style={{ backgroundColor: 'var(--brand-green-text)' }} />}</TabsTrigger>
            <TabsTrigger value="notes">Notes{(tabCounts.notes ?? 0) > 0 && <span className="inline-block w-1.5 h-1.5 rounded-full ml-1.5" style={{ backgroundColor: 'var(--brand-green-text)' }} />}</TabsTrigger>
            <TabsTrigger value="photos">Photos{(tabCounts.photos ?? 0) > 0 && <span className="inline-block w-1.5 h-1.5 rounded-full ml-1.5" style={{ backgroundColor: 'var(--brand-green-text)' }} />}</TabsTrigger>
            <TabsTrigger value="reports">Reports{(tabCounts.reports ?? 0) > 0 && <span className="inline-block w-1.5 h-1.5 rounded-full ml-1.5" style={{ backgroundColor: 'var(--brand-green-text)' }} />}</TabsTrigger>
          </TabsList>
          </div>
        </div>

        {/* ═══ OVERVIEW TAB ═══ */}
        <TabsContent value="overview">
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Pet Info */}
            <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6" style={{ borderRadius: '12px' }}>
              <h3 className="text-[var(--text-primary)] mb-4">Pet Information</h3>
              <div className="divide-y divide-[var(--border-color)]">
                <InfoRow label="Name" value={petName} editing={editing} onChange={setPetName} />
                <InfoRow label="Species" value={petSpecies} editing={editing} onChange={setPetSpecies} />
                <InfoRow label="Breed" value={petBreed} editing={editing} onChange={setPetBreed} />
                <InfoRow label="Date of Birth" value={petDob} editing={editing} onChange={setPetDob} />
                <InfoRow label="Age" value={client.pets[selectedPetIdx].age} editing={false} />
                <InfoRow label="Sex" value={petSex} editing={editing} onChange={setPetSex} />
                <InfoRow label="Weight" value={petWeight} editing={editing} onChange={setPetWeight} />
                <InfoRow label="Microchip #" value={petMicrochip} editing={editing} onChange={setPetMicrochip} />
                <InfoRow label="Color" value={petColor} editing={editing} onChange={setPetColor} />
                <div className="flex items-start py-3">
                  <span className="w-36 flex-shrink-0 text-[var(--text-secondary)]" style={{ fontSize: '14px', fontWeight: 400 }}>
                    Assigned Doctor
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="flex items-center gap-1.5 hover:bg-[var(--surface-elevated)] px-2 py-0.5 transition-colors"
                        style={{ fontSize: '16px', fontWeight: 400, color: petAssignedVet !== '—' ? 'var(--text-primary)' : 'var(--text-secondary)', borderRadius: '6px', border: 'none', background: 'none', cursor: 'pointer', marginLeft: '-8px' }}
                      >
                        {petAssignedVet !== '—' ? petAssignedVet : 'Unassigned'}
                        <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-52">
                      <DropdownMenuLabel>Assign Doctor</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {vets.map((v) => (
                        <DropdownMenuItem
                          key={v.id}
                          onClick={async () => {
                            const petDbId = client.pets[selectedPetIdx]?.dbId;
                            const pet = client.pets[selectedPetIdx];
                            setPetAssignedVet(v.name);
                            if (petDbId) {
                              const { organizationId: notifOrgId } = await getOrgContext();
                              await db.from('pets').update({ assigned_vet_id: v.id }).eq('id', petDbId).eq('organization_id', notifOrgId);
                              window.dispatchEvent(new CustomEvent('petDataChanged'));
                              try {
                                // Remove old assign event for this pet, then insert new one
                                await db.from('notification_events').delete().eq('type', 'vet_assign').ilike('id', `assign-${petDbId}-%`).eq('organization_id', notifOrgId);
                                await db.from('notification_events').upsert({
                                  id: `assign-${petDbId}-${Date.now()}`,
                                  type: 'vet_assign',
                                  timestamp: new Date().toISOString(),
                                  data: {
                                    petId: petDbId,
                                    petName: pet?.name || 'Unknown',
                                    species: pet?.species || '',
                                    breed: pet?.breed || '',
                                    ownerName: client.owner.name,
                                    clientId: id,
                                    vetId: v.id,
                                    vetName: v.name,
                                  },
                                  organization_id: notifOrgId,
                                });
                              } catch {}
                              window.dispatchEvent(new CustomEvent('notifCountChanged'));
                            }
                          }}
                        >
                          <span style={{ fontWeight: petAssignedVet === v.name ? 600 : 400 }}>{v.name}</span>
                        </DropdownMenuItem>
                      ))}
                      {petAssignedVet !== '—' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={async () => {
                              const petDbId = client.pets[selectedPetIdx]?.dbId;
                              const pet = client.pets[selectedPetIdx];
                              const prevVetName = petAssignedVet;
                              setPetAssignedVet('—');
                              if (petDbId) {
                                const { organizationId: notifOrgId } = await getOrgContext();
                                await db.from('pets').update({ assigned_vet_id: null }).eq('id', petDbId).eq('organization_id', notifOrgId);
                                window.dispatchEvent(new CustomEvent('petDataChanged'));
                                // Store unassignment event for doctor notification
                                try {
                                  await db.from('notification_events').upsert({
                                    id: `unassign-${petDbId}-${Date.now()}`,
                                    type: 'vet_unassign',
                                    timestamp: new Date().toISOString(),
                                    data: {
                                      petId: petDbId,
                                      petName: pet?.name || 'Unknown',
                                      ownerName: client.owner.name,
                                      clientId: id,
                                      vetName: prevVetName,
                                    },
                                    organization_id: notifOrgId,
                                  });
                                  // Remove any assign event for this pet
                                  await db.from('notification_events').delete().eq('type', 'vet_assign').ilike('id', `assign-${petDbId}-%`).eq('organization_id', notifOrgId);
                                } catch {}
                                window.dispatchEvent(new CustomEvent('notifCountChanged'));
                              }
                            }}
                          >
                            <span style={{ color: 'var(--text-secondary)' }}>Unassign</span>
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>

            {/* Owner Info */}
            <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6" style={{ borderRadius: '12px' }}>
              <h3 className="text-[var(--text-primary)] mb-4">Owner Information</h3>
              <div className="divide-y divide-[var(--border-color)]">
                <InfoRow label="Name" value={ownerName} editing={editing} onChange={setOwnerName} />
                <div className="flex items-center gap-2 py-3">
                  <span className="w-36 flex-shrink-0 text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Email</span>
                  <div className="flex items-center gap-2 flex-1">
                    <Mail className="w-4 h-4 text-[var(--text-secondary)]" />
                    {editing ? (
                      <Input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} className="flex-1 h-8" />
                    ) : (
                      <span className="text-[var(--text-primary)]" style={{ fontSize: '16px' }}>{ownerEmail}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 py-3">
                  <span className="w-36 flex-shrink-0 text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Phone</span>
                  <div className="flex items-center gap-2 flex-1">
                    <Phone className="w-4 h-4 text-[var(--text-secondary)]" />
                    {editing ? (
                      <Input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} className="flex-1 h-8" />
                    ) : (
                      <span className="text-[var(--text-primary)]" style={{ fontSize: '16px' }}>{ownerPhone}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2 py-3">
                  <span className="w-36 flex-shrink-0 text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Address</span>
                  <div className="flex items-start gap-2 flex-1">
                    <MapPin className="w-4 h-4 text-[var(--text-secondary)] mt-0.5" />
                    {editing ? (
                      <Input value={ownerAddress} onChange={(e) => setOwnerAddress(e.target.value)} className="flex-1 h-8" />
                    ) : (
                      <span className="text-[var(--text-primary)]" style={{ fontSize: '16px' }}>{ownerAddress}</span>
                    )}
                  </div>
                </div>
                <div className="pt-1">
                  <p className="text-[var(--text-secondary)] mb-2" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Emergency Contact
                  </p>
                  <InfoRow label="Name" value={emergencyContact} editing={editing} onChange={setEmergencyContact} />
                  <InfoRow label="Phone" value={emergencyPhone} editing={editing} onChange={setEmergencyPhone} />
                </div>
              </div>
            </div>
          </div>

          {/* Insurance */}
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6" style={{ borderRadius: '12px' }}>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-[var(--brand-green-text)]" />
              <h3 className="text-[var(--text-primary)]">Insurance</h3>
            </div>
            <div className="grid grid-cols-4 gap-6">
              <div>
                <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: '14px' }}>Provider</p>
                {editing ? (
                  <Input value={insProvider} onChange={(e) => setInsProvider(e.target.value)} className="h-8" />
                ) : (
                  <p className="text-[var(--text-primary)]" style={{ fontSize: '16px', fontWeight: 600 }}>{insProvider}</p>
                )}
              </div>
              <div>
                <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: '14px' }}>Policy Number</p>
                {editing ? (
                  <Input value={insPolicyNumber} onChange={(e) => setInsPolicyNumber(e.target.value)} className="h-8" />
                ) : (
                  <p className="text-[var(--text-primary)]" style={{ fontSize: '16px' }}>{insPolicyNumber}</p>
                )}
              </div>
              <div>
                <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: '14px' }}>Coverage Type</p>
                {editing ? (
                  <Select value={insCoverageType} onValueChange={setInsCoverageType}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Comprehensive">Comprehensive</SelectItem>
                      <SelectItem value="Accident Only">Accident Only</SelectItem>
                      <SelectItem value="Wellness">Wellness</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-[var(--text-primary)]" style={{ fontSize: '16px' }}>{insCoverageType}</p>
                )}
              </div>
              <div>
                <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: '14px' }}>Expiry Date</p>
                {editing ? (
                  <Input value={insExpiry} onChange={(e) => setInsExpiry(e.target.value)} className="h-8" />
                ) : (
                  <p className="text-[var(--text-primary)]" style={{ fontSize: '16px' }}>{insExpiry}</p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ═══ MEDICAL OVERVIEW TAB ═══ */}
        <TabsContent value="medical-overview">
          {/* Problems (was: Conditions & Diagnoses) */}
          <ProblemsSection
            petName={petName}
            petDbId={client.pets[selectedPetIdx]?.dbId || ''}
            onChanged={fetchClientData}
            readOnly={!canEdit}
          />

          {/* Allergies */}
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-[#d4183d]" />
                <h3 className="text-[var(--text-primary)]">Allergies</h3>
              </div>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => setShowAllergyInput(!showAllergyInput)}>
                  <Plus className="w-4 h-4" /> Add Allergy
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {allergies.map((a) => (
                <span
                  key={a}
                  className="inline-flex items-center gap-1.5 px-3 py-1"
                  style={{ backgroundColor: '#d4183d15', color: '#d4183d', borderRadius: '9999px', fontSize: '14px', fontWeight: 600 }}
                >
                  <AlertCircle className="w-3 h-3" /> {a}
                  <button
                    onClick={() => handleRemoveAllergy(a)}
                    className="ml-1 hover:opacity-70"
                    style={{ fontSize: '16px', lineHeight: 1, fontWeight: 700 }}
                  >
                    ×
                  </button>
                </span>
              ))}
              {showAllergyInput && (
                <div className="flex items-center gap-2">
                  <Input
                    value={allergyInput}
                    onChange={(e) => setAllergyInput(e.target.value)}
                    placeholder="Allergy name..."
                    className="h-8 w-40"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddAllergy()}
                  />
                  <Button size="sm" onClick={handleAddAllergy}><Check className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowAllergyInput(false); setAllergyInput(''); }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Treatments */}
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6" style={{ borderRadius: '12px' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[var(--text-primary)]">Treatments</h3>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => setTreatmentDialogOpen(true)}>
                  <Plus className="w-4 h-4" /> Add Treatment
                </Button>
              )}
            </div>
            {treatments.length === 0 ? (
              <p className="text-[var(--text-secondary)] py-4" style={{ fontSize: '14px' }}>No treatments on file.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Treatment</TableHead>
                    <TableHead className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Date & Time</TableHead>
                    <TableHead className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Vet</TableHead>
                    <TableHead className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Added By</TableHead>
                    <TableHead className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Notes</TableHead>
                    <TableHead className="py-3 px-4 w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {treatments.map((t) => {
                    const dateDisplay = t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : t.date;
                    return (
                    <TableRow key={t.id} className="hover:bg-[var(--surface-elevated)]">
                      <TableCell className="py-3 px-4">
                        <span className="text-[var(--text-primary)]" style={{ fontSize: '16px', fontWeight: 500 }}>{t.name}</span>
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{dateDisplay}</span>
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{t.vet}</span>
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{t.addedBy || '—'}</span>
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{t.notes}</span>
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <button
                          onClick={() => handleRemoveTreatment(t.id)}
                          className="text-[var(--text-secondary)] hover:text-[#d4183d] transition-colors"
                          style={{ fontSize: '16px', lineHeight: 1 }}
                        >
                          ×
                        </button>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Upcoming Appointments + Vaccination History */}
          <div className="grid grid-cols-2 gap-6 mt-6">
            {/* Upcoming Appointments */}
            <div className="border border-[color-mix(in_srgb,var(--brand-green-text)_19%,transparent)] bg-[var(--surface-white)] p-6" style={{ borderRadius: '12px' }}>
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-[var(--brand-green-text)]" />
                <h3 className="text-[var(--text-primary)]">Upcoming Appointments</h3>
              </div>
              {client.pets[selectedPetIdx].upcomingAppointments.length === 0 ? (
                <p className="text-[var(--text-secondary)] py-4" style={{ fontSize: '14px' }}>No upcoming appointments.</p>
              ) : (
                <div className="space-y-3">
                  {client.pets[selectedPetIdx].upcomingAppointments.map((appt) => (
                    <div
                      key={appt.id}
                      className="border border-[var(--border-color)] p-4 cursor-pointer hover:border-[color-mix(in_srgb,var(--brand-green-text)_38%,transparent)] transition-colors"
                      style={{ borderRadius: '8px' }}
                      onClick={() => navigate(appointmentsPath)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={petImage} alt={petName} className="object-cover" />
                          <AvatarFallback>{ownerName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Clock className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                            <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>
                              {appt.time} - {appt.date}
                            </span>
                          </div>
                          <p className="text-[var(--text-primary)]" style={{ fontSize: '16px', fontWeight: 600 }}>{petName}</p>
                          <p className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>Owner: {client.owner.name}</p>
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
              <Button
                variant="outline"
                className="w-full mt-4 border-[var(--brand-green-text)] text-[var(--brand-green-text)] hover:bg-[color-mix(in_srgb,var(--brand-green-text)_6%,transparent)]"
                onClick={() => {
                  const pet = client.pets[selectedPetIdx];
                  navigate(appointmentsPath, { state: {
                    openNewAppt: true,
                    prefillClientId: id,
                    prefillClientName: client.owner.name,
                    prefillPetId: pet?.dbId || '',
                    prefillPetName: pet?.name || '',
                  }});
                }}
              >
                Schedule New Appointment
              </Button>
            </div>

            {/* Vaccination History */}
            <div className="border border-[var(--border-color)] bg-[var(--surface-white)] p-6" style={{ borderRadius: '12px' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[var(--text-primary)]">Vaccination History</h3>
                <Link to="/vaccines" className="text-[var(--text-secondary)] flex items-center gap-1 hover:opacity-75 transition-opacity" style={{ fontSize: '12px', fontWeight: 600 }}>
                  View all <ChevronRight className="w-[13px] h-[13px]" />
                </Link>
              </div>
              <div
                ref={vaxScrollRef}
                className="flex gap-3 overflow-x-auto pb-3"
                style={{ scrollbarWidth: 'none' }}
                onScroll={() => {
                  const el = vaxScrollRef.current;
                  if (!el) return;
                  const cardWidth = 200 + 12; // card width + gap
                  const idx = Math.round(el.scrollLeft / cardWidth);
                  setActiveVaxDot(Math.min(idx, client.pets[selectedPetIdx].vaccinations.length - 1));
                }}
              >
                {client.pets[selectedPetIdx].vaccinations.map((vax) => {
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
                        <Check className="w-3.5 h-3.5" style={{ color: isUpToDate ? 'var(--brand-green-text)' : '#F4A261' }} />
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
              {/* Scroll indicator dots */}
              <div className="flex gap-1 mt-2 justify-center">
                {client.pets[selectedPetIdx].vaccinations.map((_, i) => (
                  <button
                    key={i}
                    className="h-1.5 transition-all duration-200 hover:opacity-70"
                    style={{
                      borderRadius: '9999px',
                      width: i === activeVaxDot ? '24px' : '8px',
                      backgroundColor: i === activeVaxDot ? 'var(--brand-green-text)' : 'var(--border-color)',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                    onClick={() => {
                      const el = vaxScrollRef.current;
                      if (!el) return;
                      const cardWidth = 200 + 12;
                      el.scrollTo({ left: i * cardWidth, behavior: 'smooth' });
                      setActiveVaxDot(i);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Add Treatment Dialog */}
          <Dialog open={treatmentDialogOpen} onOpenChange={(open) => {
            setTreatmentDialogOpen(open);
            if (!open) { setNewTreatmentName(''); setNewTreatmentDate(new Date().toISOString().split('T')[0]); setNewTreatmentVet(''); setNewTreatmentNotes(''); }
          }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Treatment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Treatment Name</label>
                  <Popover open={treatmentPopoverOpen} onOpenChange={setTreatmentPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal" style={{ height: '36px' }}>
                        {newTreatmentName || <span className="text-muted-foreground">Select or type a treatment...</span>}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search treatments..." value={newTreatmentName} onValueChange={setNewTreatmentName} />
                        <CommandList>
                          <CommandEmpty>No matching treatment</CommandEmpty>
                          <CommandGroup>
                            {['Rabies Vaccine', 'DHPP Vaccine', 'FVRCP Vaccine', 'FeLV Vaccine', 'Bordetella Vaccine', 'Leptospirosis Vaccine', 'Lyme Vaccine',
                              'Dental Cleaning', 'Dental Extraction', 'Spay', 'Neuter', 'Microchip Implant',
                              'Flea/Tick Prevention', 'Heartworm Prevention', 'Deworming',
                              'X-Ray', 'Ultrasound', 'Blood Work', 'Urinalysis',
                              'Wound Care', 'Sutures', 'Bandage Change', 'Ear Cleaning',
                              'Nail Trim', 'Anal Gland Expression',
                            ].filter(s => !treatments.some(t => t.name === s)).map(s => (
                              <CommandItem key={s} value={s} onSelect={(val) => { setNewTreatmentName(val); setTreatmentPopoverOpen(false); }}>
                                {s}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                          {newTreatmentName.trim() && !['Rabies Vaccine', 'DHPP Vaccine', 'FVRCP Vaccine', 'FeLV Vaccine', 'Bordetella Vaccine', 'Leptospirosis Vaccine', 'Lyme Vaccine',
                            'Dental Cleaning', 'Dental Extraction', 'Spay', 'Neuter', 'Microchip Implant',
                            'Flea/Tick Prevention', 'Heartworm Prevention', 'Deworming',
                            'X-Ray', 'Ultrasound', 'Blood Work', 'Urinalysis',
                            'Wound Care', 'Sutures', 'Bandage Change', 'Ear Cleaning',
                            'Nail Trim', 'Anal Gland Expression',
                          ].some(s => s.toLowerCase() === newTreatmentName.trim().toLowerCase()) && (
                            <div className="p-1 border-t">
                              <button
                                className="w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent flex items-center gap-2"
                                onClick={() => { setTreatmentPopoverOpen(false); }}
                              >
                                <PlusCircle className="w-4 h-4" /> Add &quot;{newTreatmentName.trim()}&quot;
                              </button>
                            </div>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Date</label>
                  <Input type="date" value={newTreatmentDate} onChange={(e) => setNewTreatmentDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Administering Vet</label>
                  <Select value={newTreatmentVet} onValueChange={setNewTreatmentVet}>
                    <SelectTrigger><SelectValue placeholder="Select vet..." /></SelectTrigger>
                    <SelectContent>
                      {vets.map((v) => (
                        <SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Notes</label>
                  <Textarea placeholder="Treatment notes..." value={newTreatmentNotes} onChange={(e) => setNewTreatmentNotes(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTreatmentDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddTreatment} disabled={!newTreatmentName.trim()}>Save Treatment</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ═══ VISITS TAB ═══ */}
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

        {/* ═══ NOTES TAB ═══ */}
        <TabsContent value="notes">
          <div className="space-y-6">
            {/* Vet Notes (Private) */}
            <div className="border border-[var(--border-color)] p-6" style={{ borderRadius: '12px', backgroundColor: 'var(--surface-white)' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-[var(--text-primary)]">Vet Notes</h3>
                  <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '14px' }}>
                    Private — only visible to clinic staff
                  </p>
                </div>
                <Badge variant="outline" className="border-[#F4A261] text-[#F4A261]">Private</Badge>
              </div>
              {canEdit && (
                <>
                  <Textarea
                    value={newVetNote}
                    onChange={(e) => setNewVetNote(e.target.value)}
                    className="min-h-24 bg-[var(--surface-white)]"
                    placeholder="Add internal notes about this patient..."
                  />
                  <div className="flex justify-end mt-3">
                    <Button size="sm" disabled={!newVetNote.trim() || noteSaving} onClick={() => handleSaveNote('vet')}>
                      <Save className="w-4 h-4" /> {noteSaving ? 'Saving...' : 'Save Note'}
                    </Button>
                  </div>
                </>
              )}

              {/* Vet notes history */}
              {noteHistory.filter(n => n.type === 'vet').length > 0 && (
                <div className="mt-5 pt-5 border-t border-[var(--border-color)]">
                  <p className="text-[var(--text-secondary)] mb-3" style={{ fontSize: '13px', fontWeight: 600 }}>Note History</p>
                  <div className="space-y-3">
                    {noteHistory.filter(n => n.type === 'vet').map((note) => (
                      <div key={note.id} className="border border-[var(--border-color)] p-4" style={{ borderRadius: '10px', backgroundColor: 'var(--surface-elevated)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: '#F4A26120', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#F4A261' }}>
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
                </div>
              )}
            </div>

            {/* Client Notes (Visible) */}
            <div className="border border-[var(--border-color)] p-6" style={{ borderRadius: '12px', backgroundColor: 'var(--surface-white)' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-[var(--text-primary)]">Client Notes</h3>
                  <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '14px' }}>
                    Visible to pet owner on their portal
                  </p>
                </div>
                <Badge variant="outline" className="border-[var(--brand-green-text)] text-[var(--brand-green-text)]">Visible to Client</Badge>
              </div>
              {canEdit && (
                <>
                  <Textarea
                    value={newClientNote}
                    onChange={(e) => setNewClientNote(e.target.value)}
                    className="min-h-24 bg-[var(--surface-white)]"
                    placeholder="Add notes for the pet owner..."
                  />
                  <div className="flex justify-end mt-3">
                    <Button size="sm" disabled={!newClientNote.trim() || noteSaving} onClick={() => handleSaveNote('client')}>
                      <Save className="w-4 h-4" /> {noteSaving ? 'Saving...' : 'Save Note'}
                    </Button>
                  </div>
                </>
              )}

              {/* Client notes history */}
              {noteHistory.filter(n => n.type === 'client').length > 0 && (
                <div className="mt-5 pt-5 border-t border-[var(--border-color)]">
                  <p className="text-[var(--text-secondary)] mb-3" style={{ fontSize: '13px', fontWeight: 600 }}>Note History</p>
                  <div className="space-y-3">
                    {noteHistory.filter(n => n.type === 'client').map((note) => (
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
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ═══ REPORTS TAB (moved below, rendered as PetReportsTab) ═══ */}

        {/* ─── Lab Tab ──────────────────────────────────── */}
        <TabsContent value="lab">
          <div className="space-y-4">
            <div className="border border-[var(--border-color)] p-6" style={{ borderRadius: '12px', backgroundColor: 'var(--surface-white)' }}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-[var(--text-primary)]" style={{ fontSize: 16, fontWeight: 600 }}>Lab Results</h3>
                  <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: 14 }}>
                    Uploaded lab files and diagnostic results
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/lab')}>
                  <FlaskConical className="w-3.5 h-3.5" /> Go to Lab
                </Button>
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
                  <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: 13 }}>Lab files will appear here once uploaded from the Lab page.</p>
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

        {/* ═══ INJECTIONS TAB ═══ */}
        <TabsContent value="injections">
          <InjectionsTab
            petName={petName}
            petDbId={client.pets[selectedPetIdx]?.dbId || ''}
            onChanged={fetchClientData}
            readOnly={!canEdit}
          />
        </TabsContent>

        {/* ═══ X-RAY / IMAGING TAB ═══ */}
        <TabsContent value="xray">
          <XRayTab
            petName={petName}
            petDbId={client.pets[selectedPetIdx]?.dbId || ''}
            readOnly={!canEdit}
          />
        </TabsContent>

        {/* ═══ SURGERY TAB ═══ */}
        <TabsContent value="surgery">
          <SurgeryTab
            petName={petName}
            petDbId={client.pets[selectedPetIdx]?.dbId || ''}
            readOnly={!canEdit}
          />
        </TabsContent>

        {/* ═══ PLAN TAB ═══ */}
        <TabsContent value="plan">
          <PlanTab
            petName={petName}
            petDbId={client.pets[selectedPetIdx]?.dbId || ''}
            readOnly={!canEdit}
          />
        </TabsContent>

        {/* ═══ DIET TAB ═══ */}
        <TabsContent value="diet">
          <DietTab
            petName={petName}
            petSpecies={petSpecies}
            petWeight={petWeight}
            petDbId={client.pets[selectedPetIdx]?.dbId || ''}
            readOnly={!canEdit}
          />
        </TabsContent>

        {/* ═══ PHOTOS TAB ═══ */}
        <TabsContent value="photos">
          <PhotosTab
            petName={petName}
            petImage={petImage}
            petDbId={client.pets[selectedPetIdx]?.dbId || ''}
            readOnly={!canEdit}
          />
        </TabsContent>

        {/* ═══ REPORTS TAB (now last — list of generated PDF snapshots) ═══ */}
        <TabsContent value="reports">
          <PetReportsTab
            petName={petName}
            petDbId={client.pets[selectedPetIdx]?.dbId || ''}
          />
        </TabsContent>
      </Tabs>

      {/* ─── Add Pet Dialog ─────────────────────────────── */}
      <Dialog open={addPetOpen} onOpenChange={setAddPetOpen}>
        <DialogContent
          className="p-0 gap-0 overflow-hidden [&>button]:top-[14px] [&>button]:right-[14px] [&>button]:w-8 [&>button]:h-8 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:rounded-[8px] [&>button]:!bg-[var(--surface-white)] [&>button]:!text-[var(--text-secondary)] [&>button]:!opacity-100 [&>button]:hover:!bg-[var(--surface-elevated)] [&>button]:!border [&>button]:!border-[var(--border-color)] [&>button]:transition-colors [&>button>svg]:w-4 [&>button>svg]:h-4"
          style={{ maxWidth: '520px', width: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
        >
          {/* Header */}
          <div style={{ background: 'var(--surface-elevated)', padding: '18px 24px', flexShrink: 0, borderBottom: '1px solid var(--border-color)', borderLeft: '4px solid var(--brand-green-text)' }}>
            <div className="flex items-center gap-3">
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <PlusCircle style={{ width: '18px', height: '18px', color: 'var(--brand-green-text)' }} />
              </div>
              <div>
                <DialogTitle style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>Add New Pet</DialogTitle>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '1px' }}>Add another pet for {ownerName}</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div style={{ overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Photo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                className="relative group cursor-pointer"
                onClick={() => addPetPhotoRef.current?.click()}
                style={{ width: '56px', height: '56px', borderRadius: '9999px', overflow: 'hidden', flexShrink: 0, backgroundColor: 'var(--surface-elevated)', border: '2px dashed var(--border-color)' }}
              >
                {addPetPhotoPreview ? (
                  <img src={addPetPhotoPreview} alt="Pet" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Camera style={{ width: '20px', height: '20px', color: 'var(--text-secondary)' }} />
                  </div>
                )}
              </div>
              <div>
                <button type="button" onClick={() => addPetPhotoRef.current?.click()} style={{ fontSize: '13px', fontWeight: 600, color: 'var(--brand-green-text)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  {addPetPhotoPreview ? 'Change photo' : 'Add pet photo'}
                </button>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>JPG, PNG up to 5MB</p>
              </div>
              <input ref={addPetPhotoRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) { setAddPetPhoto(file); setAddPetPhotoPreview(URL.createObjectURL(file)); }
              }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Pet Name *</p>
                <Input placeholder="e.g. Bella" value={addPetForm.name} onChange={e => setAddPetForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Species *</p>
                <Select value={addPetForm.species} onValueChange={v => setAddPetForm(f => ({ ...f, species: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dog">Dog</SelectItem>
                    <SelectItem value="Cat">Cat</SelectItem>
                    <SelectItem value="Rabbit">Rabbit</SelectItem>
                    <SelectItem value="Bird">Bird</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Breed</p>
                <Input placeholder="e.g. Poodle" value={addPetForm.breed} onChange={e => setAddPetForm(f => ({ ...f, breed: e.target.value }))} />
              </div>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Sex</p>
                <Select value={addPetForm.sex} onValueChange={v => setAddPetForm(f => ({ ...f, sex: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Male (Neutered)">Male (Neutered)</SelectItem>
                    <SelectItem value="Female (Spayed)">Female (Spayed)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Date of Birth</p>
                <Input type="date" value={addPetForm.dob} onChange={e => setAddPetForm(f => ({ ...f, dob: e.target.value }))} />
              </div>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Weight</p>
                <Input placeholder="e.g. 5.5 kg" value={addPetForm.weight} onChange={e => setAddPetForm(f => ({ ...f, weight: e.target.value }))} />
              </div>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Microchip #</p>
                <Input placeholder="e.g. 900118000123456" value={addPetForm.microchip} onChange={e => setAddPetForm(f => ({ ...f, microchip: e.target.value }))} />
              </div>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Assigned Doctor</p>
                <Select value={addPetForm.assignedVetId} onValueChange={v => setAddPetForm(f => ({ ...f, assignedVetId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select doctor..." /></SelectTrigger>
                  <SelectContent>
                    {vets.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--border-color)]" style={{ padding: '14px 24px', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexShrink: 0 }}>
            <Button variant="outline" onClick={() => setAddPetOpen(false)} disabled={addPetSaving}>Cancel</Button>
            <Button
              onClick={handleAddPet}
              disabled={addPetSaving || !addPetForm.name.trim() || !addPetForm.species}
              style={{ backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)', minWidth: '110px' }}
            >
              {addPetSaving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</> : 'Add Pet'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── Shared Helpers for Tab Sub-Components ─────────────────────
// ═══════════════════════════════════════════════════════════════

export function SectionCard({ title, subtitle, icon: Icon, iconColor, action, children }: {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  iconColor?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6" style={{ borderRadius: '12px' }}>
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-start gap-3">
          {Icon && (
            <div
              className="w-9 h-9 flex items-center justify-center flex-shrink-0"
              style={{ borderRadius: '10px', backgroundColor: `${iconColor}15` }}
            >
              <Icon className="w-[18px] h-[18px]" style={{ color: iconColor }} />
            </div>
          )}
          <div>
            <h3 className="text-[var(--text-primary)]" style={{ fontSize: '16px', fontWeight: 600 }}>{title}</h3>
            {subtitle && <p className="text-[var(--text-secondary)] mt-0.5" style={{ fontSize: '13px' }}>{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function StatTile({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div
      className="p-4 border"
      style={{
        borderRadius: '10px',
        borderColor: 'var(--border-color)',
        backgroundColor: color ? `${color}08` : 'var(--surface-elevated)',
      }}
    >
      <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ fontSize: '22px', fontWeight: 700, color: color || 'var(--text-primary)', lineHeight: 1.1 }}>{value}</p>
      {sub && <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '12px' }}>{sub}</p>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-12 border border-dashed border-[var(--border-color)]" style={{ borderRadius: '10px' }}>
      <div
        className="w-12 h-12 mx-auto mb-3 flex items-center justify-center"
        style={{ borderRadius: '12px', backgroundColor: 'var(--surface-elevated)' }}
      >
        <Icon className="w-5 h-5" style={{ color: 'var(--text-secondary)', opacity: 0.6 }} />
      </div>
      <p className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>{title}</p>
      <p className="text-[var(--text-secondary)] mt-1 max-w-xs mx-auto" style={{ fontSize: '13px' }}>{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── INJECTIONS TAB ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

type InjectionRow = {
  id: string;
  vaccine_name: string;
  manufacturer: string | null;
  lot_number: string | null;
  serial_number: string | null;
  administered_date: string;
  expiry_date: string | null;
  next_due_date: string | null;
  injection_site: string | null;
  notes: string | null;
  staff?: { profiles?: { first_name?: string | null; last_name?: string | null } | null } | null;
};

const COMMON_VACCINES = [
  'Rabies (1-year)', 'Rabies (3-year)', 'DHPP (Distemper combo)',
  'Bordetella', 'Leptospirosis', 'Canine Influenza (H3N2/H3N8)',
  'Lyme Disease', 'FVRCP (Feline Distemper)', 'FeLV (Feline Leukemia)',
  'FIV (Feline Immunodeficiency)', 'Cytopoint (Allergy)', 'Adequan (Joint)',
];

const INJECTION_SITES = [
  'Right Front Leg', 'Left Front Leg', 'Right Rear Leg', 'Left Rear Leg',
  'Right Shoulder', 'Left Shoulder', 'Intranasal', 'Subcutaneous (Scruff)',
];

export function InjectionsTab({ petName, petDbId, onChanged, readOnly = false }: { petName: string; petDbId: string; onChanged?: () => void; readOnly?: boolean }) {
  const db = useTenantDb();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [injections, setInjections] = useState<InjectionRow[]>([]);

  // Add Injection dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vaccineName, setVaccineName] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [administeredDate, setAdministeredDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [nextDueDate, setNextDueDate] = useState('');
  const [injectionSite, setInjectionSite] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setVaccineName('');
    setManufacturer('');
    setLotNumber('');
    setAdministeredDate(new Date().toISOString().split('T')[0]);
    setNextDueDate('');
    setInjectionSite('');
    setNotes('');
  };

  const loadInjections = useCallback(async () => {
    if (!petDbId) {
      setInjections([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await db
      .from('vaccinations')
      .select('id, vaccine_name, manufacturer, lot_number, serial_number, administered_date, expiry_date, next_due_date, injection_site, notes, staff:staff!vaccinations_administered_by_fkey(id, profiles:profiles!staff_profile_id_fkey(first_name, last_name))')
      .eq('pet_id', petDbId)
      .order('administered_date', { ascending: false });
    if (error) {
      console.error('Failed to load vaccinations:', error);
      setInjections([]);
    } else {
      setInjections((data || []) as unknown as InjectionRow[]);
    }
    setLoading(false);
  }, [db, petDbId]);

  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) await loadInjections(); })();
    return () => { cancelled = true; };
  }, [loadInjections]);

  const handleSave = async () => {
    if (!petDbId || !vaccineName.trim() || !administeredDate) return;
    setSaving(true);
    try {
      const { organizationId, clinicId } = await getOrgContext();
      // Resolve current staff row via profile_id
      let staffId: string | null = null;
      if (user?.id) {
        const { data: staffRow } = await db
          .from('staff')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('profile_id', user.id)
          .maybeSingle();
        staffId = (staffRow as any)?.id || null;
      }

      const { error } = await db.from('vaccinations').insert({
        organization_id: organizationId,
        pet_id: petDbId,
        clinic_id: clinicId || null,
        administered_by: staffId,
        vaccine_name: vaccineName.trim(),
        manufacturer: manufacturer.trim() || null,
        lot_number: lotNumber.trim() || null,
        administered_date: administeredDate,
        next_due_date: nextDueDate || null,
        injection_site: injectionSite || null,
        notes: notes.trim() || null,
      });
      if (error) {
        console.error('Failed to add injection:', error);
        alert('Could not save injection — see console for details.');
      } else {
        setAddOpen(false);
        resetForm();
        await loadInjections();
        // Refresh parent client data so Medical Overview's Vaccination History updates
        onChanged?.();
        requestPetReport(petDbId, 'injection');
      }
    } catch (e) {
      console.error('Add injection error:', e);
    } finally {
      setSaving(false);
    }
  };

  const statusFor = (nextDue: string | null) => {
    if (!nextDue) return { bg: 'var(--surface-elevated)', text: 'var(--text-secondary)', label: '—' };
    const now = new Date();
    const due = new Date(nextDue + 'T00:00:00');
    const diffDays = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { bg: '#d4183d20', text: '#d4183d', label: 'Overdue' };
    if (diffDays <= 30) return { bg: '#F4A26120', text: '#F4A261', label: 'Due soon' };
    return { bg: '#74C69D20', text: 'var(--brand-green-text)', label: 'Up to date' };
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  const vetName = (row: InjectionRow) => {
    const p = row.staff?.profiles;
    if (!p || (!p.first_name && !p.last_name)) return '—';
    return `Dr. ${p.first_name || ''} ${p.last_name || ''}`.trim();
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Injection History"
        subtitle={`All injections administered to ${petName}`}
        icon={Syringe}
        iconColor="var(--brand-green-text)"
        action={
          !readOnly ? (
            <Button size="sm" onClick={() => setAddOpen(true)} disabled={!petDbId}>
              <Plus className="w-4 h-4" /> Record Injection
            </Button>
          ) : undefined
        }
      >
        {loading ? (
          <div className="py-10 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--text-secondary)]" />
          </div>
        ) : injections.length === 0 ? (
          <EmptyState
            icon={Syringe}
            title="No injections recorded yet"
            description={
              readOnly
                ? `No injections have been recorded for ${petName} yet.`
                : `Injections recorded during a visit for ${petName} will appear here automatically, or you can record one manually.`
            }
            action={
              !readOnly ? (
                <Button size="sm" onClick={() => setAddOpen(true)} disabled={!petDbId}>
                  <Plus className="w-4 h-4" /> Record Injection
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Date Given</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Batch / Lot</TableHead>
                <TableHead>Vet</TableHead>
                <TableHead>Next Due</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {injections.map((inj) => {
                const s = statusFor(inj.next_due_date);
                const hasNotes = !!(inj.notes && inj.notes.trim());
                return (
                  <Fragment key={inj.id}>
                    <TableRow className={`hover:bg-[var(--surface-elevated)] ${hasNotes ? 'border-b-0' : ''}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Syringe className="w-3.5 h-3.5" style={{ color: 'var(--brand-green-text)' }} />
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{inj.vaccine_name}</span>
                        </div>
                        {inj.manufacturer && (
                          <p className="text-[var(--text-secondary)] mt-0.5" style={{ fontSize: 11 }}>{inj.manufacturer}</p>
                        )}
                      </TableCell>
                      <TableCell><span className="text-[var(--text-secondary)]" style={{ fontSize: 13 }}>{formatDate(inj.administered_date)}</span></TableCell>
                      <TableCell><span className="text-[var(--text-secondary)]" style={{ fontSize: 13 }}>{inj.injection_site || '—'}</span></TableCell>
                      <TableCell>
                        <span className="text-[var(--text-secondary)] font-mono" style={{ fontSize: 12 }}>
                          {inj.lot_number || inj.serial_number || '—'}
                        </span>
                      </TableCell>
                      <TableCell><span className="text-[var(--text-secondary)]" style={{ fontSize: 13 }}>{vetName(inj)}</span></TableCell>
                      <TableCell><span className="text-[var(--text-primary)]" style={{ fontSize: 13, fontWeight: 500 }}>{formatDate(inj.next_due_date)}</span></TableCell>
                      <TableCell>
                        <span className="inline-block px-2 py-0.5" style={{ backgroundColor: s.bg, color: s.text, borderRadius: '9999px', fontSize: 11, fontWeight: 600 }}>
                          {s.label}
                        </span>
                      </TableCell>
                    </TableRow>
                    {hasNotes && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={7} style={{ paddingTop: 0 }}>
                          <div
                            className="flex items-start gap-2 px-3 py-2"
                            style={{
                              backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 6%, transparent)',
                              borderLeft: '3px solid var(--brand-green-text)',
                              borderRadius: '6px',
                            }}
                          >
                            <FileText className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: 'var(--brand-green-text)' }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[var(--text-secondary)]" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Note</p>
                              <p className="text-[var(--text-primary)] mt-0.5" style={{ fontSize: 13, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{inj.notes}</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      {/* ── Manual Add Injection Dialog ── */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetForm(); }}>
        <DialogContent style={{ maxWidth: 540 }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Syringe className="w-4 h-4" style={{ color: 'var(--brand-green-text)' }} />
              Record Injection
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Vaccine / Injection name with quick-pick */}
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>
                Injection / Vaccine Name <span style={{ color: '#d4183d' }}>*</span>
              </label>
              <Input
                value={vaccineName}
                onChange={(e) => setVaccineName(e.target.value)}
                placeholder="e.g. Rabies (1-year)"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {COMMON_VACCINES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVaccineName(v)}
                    className="px-2 py-0.5 transition-all"
                    style={{
                      borderRadius: '9999px',
                      fontSize: 11,
                      fontWeight: vaccineName === v ? 600 : 400,
                      backgroundColor: vaccineName === v ? 'color-mix(in srgb, var(--brand-green-text) 12%, transparent)' : 'var(--surface-elevated)',
                      color: vaccineName === v ? 'var(--brand-green-text)' : 'var(--text-secondary)',
                      border: `1px solid ${vaccineName === v ? 'var(--brand-green-text)' : 'var(--border-color)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Manufacturer + Lot */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>Manufacturer</label>
                <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="e.g. Zoetis" />
              </div>
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>Batch / Lot #</label>
                <Input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} placeholder="e.g. RAB-2026-881" />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>
                  Date Administered <span style={{ color: '#d4183d' }}>*</span>
                </label>
                <Input type="date" value={administeredDate} onChange={(e) => setAdministeredDate(e.target.value)} />
              </div>
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>Next Due Date</label>
                <Input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
              </div>
            </div>

            {/* Injection site */}
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>Injection Site</label>
              <div className="flex flex-wrap gap-1.5">
                {INJECTION_SITES.map((site) => (
                  <button
                    key={site}
                    type="button"
                    onClick={() => setInjectionSite(site === injectionSite ? '' : site)}
                    className="px-2.5 py-1 transition-all"
                    style={{
                      borderRadius: '9999px',
                      fontSize: 12,
                      fontWeight: injectionSite === site ? 600 : 400,
                      border: `1.5px solid ${injectionSite === site ? '#3B82F6' : 'var(--border-color)'}`,
                      backgroundColor: injectionSite === site ? '#3B82F618' : 'transparent',
                      color: injectionSite === site ? '#3B82F6' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {site}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reactions, special instructions, or other notes…"
                className="min-h-16"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !vaccineName.trim() || !administeredDate}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</> : <>Save Injection</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── X-RAY / IMAGING TAB ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

type ImagingFileRow = {
  id: string;
  file_url: string;
  storage_path: string;
  file_name: string | null;
  view_label: string | null;
  sort_order: number;
};

type ImagingStudyRow = {
  id: string;
  title: string;
  modality: string;
  region: string | null;
  study_date: string;
  findings: string | null;
  impression: string | null;
  status: string;
  radiologist: string | null;
  created_at: string;
  performed_by: string | null;
  staff?: { profiles?: { first_name?: string | null; last_name?: string | null } | null } | null;
  files: ImagingFileRow[];
};

const MODALITIES = ['X-Ray', 'Ultrasound', 'CT', 'MRI', 'Fluoroscopy'];

const COMMON_REGIONS = [
  'Thorax', 'Abdomen', 'Hips / Pelvis', 'Skull', 'Spine',
  'Right Elbow', 'Left Elbow', 'Right Stifle', 'Left Stifle',
  'Right Shoulder', 'Left Shoulder', 'Right Carpus', 'Left Carpus',
  'Dental', 'Whole Body',
];

export function XRayTab({ petName, petDbId, readOnly = false }: { petName: string; petDbId: string; readOnly?: boolean }) {
  const db = useTenantDb();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [studies, setStudies] = useState<ImagingStudyRow[]>([]);

  // Image lightbox
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);

  // New / edit study dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [modality, setModality] = useState('X-Ray');
  const [region, setRegion] = useState('');
  const [studyDate, setStudyDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [radiologist, setRadiologist] = useState('');
  const [findings, setFindings] = useState('');
  const [impression, setImpression] = useState('');
  const [status, setStatus] = useState<'pending' | 'reviewed'>('pending');
  const [newFiles, setNewFiles] = useState<globalThis.File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Expanded (detail) state — which study id is expanded inline
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setModality('X-Ray');
    setRegion('');
    setStudyDate(new Date().toISOString().split('T')[0]);
    setRadiologist('');
    setFindings('');
    setImpression('');
    setStatus('pending');
    setNewFiles([]);
  };

  const loadStudies = useCallback(async () => {
    if (!petDbId) { setStudies([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await db
      .from('imaging_studies')
      .select(`
        id, title, modality, region, study_date, findings, impression, status, radiologist, created_at, performed_by,
        staff:staff!imaging_studies_performed_by_fkey(id, profiles:profiles!staff_profile_id_fkey(first_name, last_name)),
        files:imaging_study_files(id, file_url, storage_path, file_name, view_label, sort_order)
      `)
      .eq('pet_id', petDbId)
      .order('study_date', { ascending: false });
    if (error) {
      console.error('Failed to load imaging studies:', error);
      setStudies([]);
    } else {
      const rows = (data || []) as unknown as ImagingStudyRow[];
      // Ensure files are sorted consistently
      rows.forEach(r => {
        if (r.files) r.files.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      });
      setStudies(rows);
    }
    setLoading(false);
  }, [db, petDbId]);

  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) await loadStudies(); })();
    return () => { cancelled = true; };
  }, [loadStudies]);

  const openNewStudy = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditStudy = (s: ImagingStudyRow) => {
    setEditingId(s.id);
    setTitle(s.title);
    setModality(s.modality || 'X-Ray');
    setRegion(s.region || '');
    setStudyDate(s.study_date);
    setRadiologist(s.radiologist || '');
    setFindings(s.findings || '');
    setImpression(s.impression || '');
    setStatus((s.status as 'pending' | 'reviewed') || 'pending');
    setNewFiles([]);
    setDialogOpen(true);
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const picked = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
    setNewFiles(prev => [...prev, ...picked]);
    // Reset input so the same file can be re-picked
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeNewFile = (idx: number) => {
    setNewFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const uploadFilesForStudy = async (studyId: string, startOrder: number) => {
    if (newFiles.length === 0) return;
    let failedCount = 0;
    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${petDbId}/${studyId}/${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('imaging-studies')
        .upload(path, file, { contentType: file.type });
      if (upErr) {
        console.error('Imaging upload failed:', upErr);
        failedCount++;
        continue;
      }
      const { data: urlData } = supabase.storage.from('imaging-studies').getPublicUrl(path);
      const { error: dbErr } = await db.from('imaging_study_files').insert({
        study_id: studyId,
        file_url: urlData.publicUrl,
        storage_path: path,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        view_label: `View ${startOrder + i + 1}`,
        sort_order: startOrder + i,
        uploaded_by: user?.id || null,
      });
      if (dbErr) {
        console.error('Failed to save image record:', dbErr);
        failedCount++;
      }
    }
    if (failedCount > 0) {
      alert(`${failedCount} of ${newFiles.length} image(s) failed to upload. Please try again.`);
    }
  };

  const handleSave = async () => {
    if (!petDbId || !title.trim() || !studyDate) return;
    setSaving(true);
    try {
      const { organizationId, clinicId } = await getOrgContext();

      // Resolve current staff row
      let staffId: string | null = null;
      if (user?.id) {
        const { data: staffRow } = await db
          .from('staff')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('profile_id', user.id)
          .maybeSingle();
        staffId = (staffRow as any)?.id || null;
      }

      if (editingId) {
        // Update existing study
        const { error: upErr } = await db
          .from('imaging_studies')
          .update({
            title: title.trim(),
            modality,
            region: region.trim() || null,
            study_date: studyDate,
            radiologist: radiologist.trim() || null,
            findings: findings.trim() || null,
            impression: impression.trim() || null,
            status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);
        if (upErr) {
          console.error('Failed to update imaging study:', upErr);
          alert('Could not update study — see console for details.');
          return;
        }
        // Append any new files
        const existing = studies.find(s => s.id === editingId);
        const startOrder = existing?.files?.length || 0;
        await uploadFilesForStudy(editingId, startOrder);
      } else {
        // Insert new study
        const { data: inserted, error: insErr } = await db
          .from('imaging_studies')
          .insert({
            organization_id: organizationId,
            clinic_id: clinicId || null,
            pet_id: petDbId,
            performed_by: staffId,
            title: title.trim(),
            modality,
            region: region.trim() || null,
            study_date: studyDate,
            radiologist: radiologist.trim() || null,
            findings: findings.trim() || null,
            impression: impression.trim() || null,
            status,
          })
          .select('id')
          .single();
        if (insErr || !inserted) {
          console.error('Failed to create imaging study:', insErr);
          alert('Could not create study — see console for details.');
          return;
        }
        await uploadFilesForStudy(inserted.id, 0);
      }

      setDialogOpen(false);
      resetForm();
      await loadStudies();
      requestPetReport(petDbId, 'xray');
    } catch (e) {
      console.error('Save imaging study error:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFile = async (studyId: string, file: ImagingFileRow) => {
    if (!confirm('Delete this image from the study?')) return;
    try {
      await supabase.storage.from('imaging-studies').remove([file.storage_path]);
    } catch (e) {
      console.error('Storage delete failed:', e);
    }
    await db.from('imaging_study_files').delete().eq('id', file.id);
    await loadStudies();
  };

  const handleDeleteStudy = async (studyId: string) => {
    if (!confirm('Delete this entire imaging study and all its images? This cannot be undone.')) return;
    // Remove files from storage first
    const study = studies.find(s => s.id === studyId);
    if (study?.files?.length) {
      try {
        await supabase.storage.from('imaging-studies').remove(study.files.map(f => f.storage_path));
      } catch (e) {
        console.error('Bulk storage delete failed:', e);
      }
    }
    await db.from('imaging_studies').delete().eq('id', studyId);
    await loadStudies();
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  const vetName = (row: ImagingStudyRow) => {
    const p = row.staff?.profiles;
    if (!p || (!p.first_name && !p.last_name)) return null;
    return `Dr. ${p.first_name || ''} ${p.last_name || ''}`.trim();
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Imaging Studies"
        subtitle={`X-rays, ultrasounds, CT, and MRI scans for ${petName}`}
        icon={ScanLine}
        iconColor="#8B5CF6"
        action={
          !readOnly ? (
            <Button size="sm" onClick={openNewStudy} disabled={!petDbId}>
              <Plus className="w-4 h-4" /> New Study
            </Button>
          ) : undefined
        }
      >
        {loading ? (
          <div className="py-10 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--text-secondary)]" />
          </div>
        ) : studies.length === 0 ? (
          <EmptyState
            icon={ScanLine}
            title="No imaging studies yet"
            description={
              readOnly
                ? `No imaging studies have been uploaded for ${petName} yet.`
                : `X-rays, ultrasounds, CT and MRI scans for ${petName} will appear here. Upload images and add findings to get started.`
            }
            action={
              !readOnly ? (
                <Button size="sm" onClick={openNewStudy} disabled={!petDbId}>
                  <Plus className="w-4 h-4" /> New Study
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {studies.map((s) => {
              const isExpanded = expandedId === s.id;
              const files = s.files || [];
              const doctor = vetName(s);
              return (
                <div key={s.id} className="border border-[var(--border-color)] overflow-hidden flex flex-col" style={{ borderRadius: '12px' }}>
                  {/* Thumbnail strip */}
                  <div className="relative bg-black flex items-center justify-center" style={{ height: 180 }}>
                    {files.length === 0 ? (
                      <div className="flex flex-col items-center gap-1 text-[var(--text-secondary)]">
                        <FileImage className="w-8 h-8 opacity-40" />
                        <span style={{ fontSize: 11 }}>No images</span>
                      </div>
                    ) : (
                      <div className="flex gap-1 w-full h-full">
                        {files.slice(0, 3).map((f, i) => (
                          <div
                            key={f.id}
                            className="flex-1 relative group cursor-pointer overflow-hidden"
                            onClick={() => setLightbox({ url: f.file_url, label: f.view_label || `View ${i + 1}` })}
                          >
                            <img
                              src={f.file_url}
                              alt={f.view_label || `${s.title} view ${i + 1}`}
                              className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                            />
                            <div
                              className="absolute top-2 left-2 px-1.5 py-0.5"
                              style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, fontSize: 10, color: '#fff', fontWeight: 600 }}
                            >
                              {(f.view_label || `VIEW ${i + 1}`).toUpperCase()}
                            </div>
                            {files.length > 3 && i === 2 && (
                              <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                                <span style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>+{files.length - 2}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="truncate" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{s.title}</p>
                        <p className="text-[var(--text-secondary)] mt-0.5" style={{ fontSize: 12 }}>
                          {formatDate(s.study_date)}
                          {s.region && <> · {s.region}</>}
                          {files.length > 0 && <> · {files.length} {files.length === 1 ? 'image' : 'images'}</>}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span
                          className="inline-block px-2 py-0.5"
                          style={{
                            backgroundColor: s.status === 'reviewed' ? '#74C69D20' : '#F4A26120',
                            color: s.status === 'reviewed' ? 'var(--brand-green-text)' : '#F4A261',
                            borderRadius: '9999px',
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {s.status === 'reviewed' ? 'Reviewed' : 'Pending'}
                        </span>
                        <span
                          className="inline-block px-2 py-0.5"
                          style={{
                            backgroundColor: '#8B5CF615',
                            color: '#8B5CF6',
                            borderRadius: '9999px',
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {s.modality}
                        </span>
                      </div>
                    </div>

                    {(s.findings || s.impression) && (
                      <div className="mt-2 pt-3 border-t border-[var(--border-color)] space-y-2">
                        {s.findings && (
                          <div>
                            <p className="text-[var(--text-secondary)]" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Findings</p>
                            <p className="text-[var(--text-primary)] mt-0.5" style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                              {isExpanded || s.findings.length <= 160 ? s.findings : s.findings.slice(0, 160) + '…'}
                            </p>
                          </div>
                        )}
                        {s.impression && (isExpanded || !s.findings || s.findings.length <= 160) && (
                          <div>
                            <p className="text-[var(--text-secondary)]" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Impression</p>
                            <p className="text-[var(--text-primary)] mt-0.5" style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{s.impression}</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-[var(--border-color)]" style={{ marginTop: 12 }}>
                      <div className="text-[var(--text-secondary)] min-w-0 truncate" style={{ fontSize: 12 }}>
                        {doctor && <span>By {doctor}</span>}
                        {s.radiologist && <span>{doctor ? ' · ' : ''}Read by {s.radiologist}</span>}
                        {!doctor && !s.radiologist && <span>—</span>}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!readOnly && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditStudy(s)}>
                                <Edit2 className="w-3.5 h-3.5" /> Edit study
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDeleteStudy(s.id)} className="text-[#d4183d]">
                                <Trash2 className="w-3.5 h-3.5" /> Delete study
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : s.id)}
                          className="text-[var(--brand-green-text)] flex items-center gap-1"
                          style={{ fontSize: 12, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          {isExpanded ? 'Close' : 'Open study'}
                          <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-[var(--border-color)] space-y-3">
                        {files.length > 0 && (
                          <div>
                            <p className="text-[var(--text-secondary)] mb-1.5" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>All images</p>
                            <div className="grid grid-cols-3 gap-1.5">
                              {files.map((f, i) => (
                                <div key={f.id} className="relative group" style={{ aspectRatio: '1 / 1' }}>
                                  <img
                                    src={f.file_url}
                                    alt={f.view_label || `Image ${i + 1}`}
                                    className="w-full h-full object-cover cursor-pointer"
                                    style={{ borderRadius: 6, backgroundColor: '#000' }}
                                    onClick={() => setLightbox({ url: f.file_url, label: f.view_label || `View ${i + 1}` })}
                                  />
                                  <div
                                    className="absolute top-1 left-1 px-1 py-0.5"
                                    style={{ backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 3, fontSize: 9, color: '#fff', fontWeight: 600 }}
                                  >
                                    {f.view_label || `V${i + 1}`}
                                  </div>
                                  {!readOnly && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDeleteFile(s.id, f); }}
                                      className="absolute top-1 right-1 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                      style={{ backgroundColor: 'rgba(212,24,61,0.85)', borderRadius: 3, border: 'none', cursor: 'pointer' }}
                                      title="Delete image"
                                    >
                                      <X className="w-3 h-3" style={{ color: '#fff' }} />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ── Lightbox (full image viewer) ── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 p-2"
            style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 8, border: 'none', cursor: 'pointer' }}
          >
            <X className="w-5 h-5" style={{ color: '#fff' }} />
          </button>
          <div className="absolute top-4 left-4 px-3 py-1.5" style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6 }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{lightbox.label}</span>
          </div>
          <img
            src={lightbox.url}
            alt={lightbox.label}
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '90vh', maxWidth: '90vw', objectFit: 'contain' }}
          />
          <a
            href={lightbox.url}
            target="_blank"
            rel="noopener noreferrer"
            download
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-4 right-4 px-3 py-2 flex items-center gap-2"
            style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 8, color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}
          >
            <Download className="w-4 h-4" /> Download
          </a>
        </div>
      )}

      {/* ── New / Edit Study Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent
          style={{ maxWidth: 640 }}
          className="max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="w-4 h-4" style={{ color: '#8B5CF6' }} />
              {editingId ? 'Edit Imaging Study' : 'New Imaging Study'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Title */}
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>
                Study Title <span style={{ color: '#d4183d' }}>*</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Hip Dysplasia Evaluation"
              />
            </div>

            {/* Modality + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>Modality</label>
                <Select value={modality} onValueChange={setModality}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODALITIES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>
                  Study Date <span style={{ color: '#d4183d' }}>*</span>
                </label>
                <Input type="date" value={studyDate} onChange={(e) => setStudyDate(e.target.value)} />
              </div>
            </div>

            {/* Region */}
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>Anatomical Region</label>
              <Input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. Hips / Pelvis"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {COMMON_REGIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRegion(r)}
                    className="px-2 py-0.5 transition-all"
                    style={{
                      borderRadius: '9999px',
                      fontSize: 11,
                      fontWeight: region === r ? 600 : 400,
                      backgroundColor: region === r ? '#8B5CF620' : 'var(--surface-elevated)',
                      color: region === r ? '#8B5CF6' : 'var(--text-secondary)',
                      border: `1px solid ${region === r ? '#8B5CF6' : 'var(--border-color)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Radiologist */}
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>Radiologist (optional)</label>
              <Input
                value={radiologist}
                onChange={(e) => setRadiologist(e.target.value)}
                placeholder="e.g. Dr. Morgan (external)"
              />
            </div>

            {/* Findings */}
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>Findings</label>
              <Textarea
                value={findings}
                onChange={(e) => setFindings(e.target.value)}
                placeholder="Objective observations from the study…"
                className="min-h-20"
              />
            </div>

            {/* Impression */}
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>Impression</label>
              <Textarea
                value={impression}
                onChange={(e) => setImpression(e.target.value)}
                placeholder="Clinical interpretation and recommendations…"
                className="min-h-16"
              />
            </div>

            {/* Status */}
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>Status</label>
              <div className="flex gap-2">
                {(['pending', 'reviewed'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatus(st)}
                    className="px-3 py-1.5 flex-1 transition-all"
                    style={{
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      backgroundColor: status === st
                        ? (st === 'reviewed' ? '#74C69D20' : '#F4A26120')
                        : 'var(--surface-elevated)',
                      color: status === st
                        ? (st === 'reviewed' ? 'var(--brand-green-text)' : '#F4A261')
                        : 'var(--text-secondary)',
                      border: `1.5px solid ${status === st
                        ? (st === 'reviewed' ? 'var(--brand-green-text)' : '#F4A261')
                        : 'var(--border-color)'}`,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Images upload */}
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>
                {editingId ? 'Add more images' : 'Images'}
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFilePick}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-5 flex flex-col items-center justify-center gap-1.5 transition-colors"
                style={{
                  borderRadius: 10,
                  border: '1.5px dashed var(--border-color)',
                  backgroundColor: 'var(--surface-elevated)',
                  cursor: 'pointer',
                }}
              >
                <Upload className="w-5 h-5 text-[var(--text-secondary)]" />
                <span className="text-[var(--text-primary)]" style={{ fontSize: 13, fontWeight: 600 }}>Click to select images</span>
                <span className="text-[var(--text-secondary)]" style={{ fontSize: 11 }}>PNG, JPG, WEBP. Multiple files supported.</span>
              </button>

              {newFiles.length > 0 && (
                <div className="mt-2.5 space-y-1.5">
                  {newFiles.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-2.5 py-1.5"
                      style={{ backgroundColor: 'var(--surface-elevated)', borderRadius: 6 }}
                    >
                      <FileImage className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                      <span className="flex-1 truncate text-[var(--text-primary)]" style={{ fontSize: 12 }}>{f.name}</span>
                      <span className="text-[var(--text-secondary)]" style={{ fontSize: 11 }}>{(f.size / 1024).toFixed(0)} KB</span>
                      <button
                        type="button"
                        onClick={() => removeNewFile(i)}
                        className="p-0.5"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <X className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !title.trim() || !studyDate}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</> : <>{editingId ? 'Save Changes' : 'Create Study'}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── SURGERY TAB ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

type SurgeryRow = {
  id: string;
  name: string;
  surgery_date: string;
  duration_minutes: number | null;
  assistant: string | null;
  anesthesia: string | null;
  pre_op: string | null;
  procedure_notes: string | null;
  post_op: string | null;
  complications: string | null;
  follow_up: string | null;
  status: string;
  surgeon_id: string | null;
  staff?: { profiles?: { first_name?: string | null; last_name?: string | null } | null } | null;
};

const COMMON_SURGERIES = [
  'Neutering (Orchiectomy)',
  'Spay (Ovariohysterectomy)',
  'Dental Prophylaxis',
  'Dental Extraction',
  'Mass Removal (Lumpectomy)',
  'Cystotomy',
  'Enterotomy',
  'Gastrotomy',
  'Foreign Body Removal',
  'Wound Repair / Laceration',
  'TPLO (Cruciate Repair)',
  'Amputation',
  'Ear Hematoma Repair',
  'Exploratory Laparotomy',
  'Cesarean Section (C-Section)',
  'Eye Enucleation',
];

const SURGERY_STATUSES = ['Scheduled', 'In Progress', 'Recovered', 'Complications', 'Deceased'] as const;

export function SurgeryTab({ petName, petDbId, readOnly = false }: { petName: string; petDbId: string; readOnly?: boolean }) {
  const db = useTenantDb();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [surgeries, setSurgeries] = useState<SurgeryRow[]>([]);

  // Vet list for surgeon dropdown
  const [vets, setVets] = useState<Array<{ id: string; name: string }>>([]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [surgeryDate, setSurgeryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [surgeonId, setSurgeonId] = useState<string>('');
  const [assistant, setAssistant] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<string>('');
  const [status, setStatus] = useState<string>('Recovered');
  const [anesthesia, setAnesthesia] = useState('');
  const [preOp, setPreOp] = useState('');
  const [procedureNotes, setProcedureNotes] = useState('');
  const [postOp, setPostOp] = useState('');
  const [complications, setComplications] = useState('');
  const [followUp, setFollowUp] = useState('');

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setSurgeryDate(new Date().toISOString().split('T')[0]);
    setSurgeonId('');
    setAssistant('');
    setDurationMinutes('');
    setStatus('Recovered');
    setAnesthesia('');
    setPreOp('');
    setProcedureNotes('');
    setPostOp('');
    setComplications('');
    setFollowUp('');
  };

  const loadSurgeries = useCallback(async () => {
    if (!petDbId) { setSurgeries([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await db
      .from('surgeries')
      .select(`
        id, name, surgery_date, duration_minutes, assistant, anesthesia,
        pre_op, procedure_notes, post_op, complications, follow_up, status, surgeon_id,
        staff:staff!surgeries_surgeon_id_fkey(id, profiles:profiles!staff_profile_id_fkey(first_name, last_name))
      `)
      .eq('pet_id', petDbId)
      .order('surgery_date', { ascending: false });
    if (error) {
      console.error('Failed to load surgeries:', error);
      setSurgeries([]);
    } else {
      setSurgeries((data || []) as unknown as SurgeryRow[]);
    }
    setLoading(false);
  }, [db, petDbId]);

  const loadVets = useCallback(async () => {
    try {
      const { organizationId } = await getOrgContext();
      const { data } = await db
        .from('staff')
        .select('id, profiles:profiles!staff_profile_id_fkey(first_name, last_name), role')
        .eq('organization_id', organizationId)
        .in('role', ['veterinarian', 'senior_veterinarian', 'specialist', 'lead_vet_tech']);
      const list = ((data || []) as any[]).map(row => ({
        id: row.id,
        name: `Dr. ${row.profiles?.first_name || ''} ${row.profiles?.last_name || ''}`.trim(),
      })).filter(v => v.name !== 'Dr.');
      setVets(list);
    } catch (e) {
      console.error('Failed to load vets:', e);
    }
  }, [db]);

  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) { await loadSurgeries(); await loadVets(); } })();
    return () => { cancelled = true; };
  }, [loadSurgeries, loadVets]);

  const openNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (s: SurgeryRow) => {
    setEditingId(s.id);
    setName(s.name);
    setSurgeryDate(s.surgery_date);
    setSurgeonId(s.surgeon_id || '');
    setAssistant(s.assistant || '');
    setDurationMinutes(s.duration_minutes != null ? String(s.duration_minutes) : '');
    setStatus(s.status || 'Recovered');
    setAnesthesia(s.anesthesia || '');
    setPreOp(s.pre_op || '');
    setProcedureNotes(s.procedure_notes || '');
    setPostOp(s.post_op || '');
    setComplications(s.complications || '');
    setFollowUp(s.follow_up || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!petDbId || !name.trim() || !surgeryDate) return;
    setSaving(true);
    try {
      const { organizationId, clinicId } = await getOrgContext();

      // If no surgeon picked, resolve current staff as default
      let resolvedSurgeonId: string | null = surgeonId || null;
      if (!resolvedSurgeonId && user?.id) {
        const { data: staffRow } = await db
          .from('staff')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('profile_id', user.id)
          .maybeSingle();
        resolvedSurgeonId = (staffRow as any)?.id || null;
      }

      const payload: any = {
        name: name.trim(),
        surgery_date: surgeryDate,
        surgeon_id: resolvedSurgeonId,
        assistant: assistant.trim() || null,
        duration_minutes: durationMinutes ? Number(durationMinutes) : null,
        status,
        anesthesia: anesthesia.trim() || null,
        pre_op: preOp.trim() || null,
        procedure_notes: procedureNotes.trim() || null,
        post_op: postOp.trim() || null,
        complications: complications.trim() || null,
        follow_up: followUp.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await db.from('surgeries').update(payload).eq('id', editingId);
        if (error) {
          console.error('Failed to update surgery:', error);
          alert('Could not update surgery — see console for details.');
          return;
        }
      } else {
        const { error } = await db.from('surgeries').insert({
          ...payload,
          organization_id: organizationId,
          clinic_id: clinicId || null,
          pet_id: petDbId,
        });
        if (error) {
          console.error('Failed to create surgery:', error);
          alert('Could not create surgery — see console for details.');
          return;
        }
      }

      setDialogOpen(false);
      resetForm();
      await loadSurgeries();
      requestPetReport(petDbId, 'surgery');
    } catch (e) {
      console.error('Save surgery error:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this surgery record? This cannot be undone.')) return;
    const { error } = await db.from('surgeries').delete().eq('id', id);
    if (error) {
      console.error('Failed to delete surgery:', error);
      alert('Could not delete surgery — see console for details.');
      return;
    }
    await loadSurgeries();
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  const formatDuration = (mins: number | null) => {
    if (!mins || mins <= 0) return null;
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h ${m} min`;
  };

  const surgeonName = (row: SurgeryRow) => {
    const p = row.staff?.profiles;
    if (!p || (!p.first_name && !p.last_name)) return null;
    return `Dr. ${p.first_name || ''} ${p.last_name || ''}`.trim();
  };

  const statusColor = (st: string) => {
    switch (st) {
      case 'Recovered':     return { bg: '#74C69D20', text: 'var(--brand-green-text)' };
      case 'Scheduled':     return { bg: '#3B82F620', text: '#3B82F6' };
      case 'In Progress':   return { bg: '#F4A26120', text: '#F4A261' };
      case 'Complications': return { bg: '#d4183d20', text: '#d4183d' };
      case 'Deceased':      return { bg: 'var(--surface-elevated)', text: 'var(--text-secondary)' };
      default:              return { bg: 'var(--surface-elevated)', text: 'var(--text-secondary)' };
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Surgical History"
        subtitle={`All surgical procedures performed on ${petName}`}
        icon={Scissors}
        iconColor="#EC4899"
        action={
          !readOnly ? (
            <Button size="sm" onClick={openNew} disabled={!petDbId}>
              <Plus className="w-4 h-4" /> Add Surgery
            </Button>
          ) : undefined
        }
      >
        {loading ? (
          <div className="py-10 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--text-secondary)]" />
          </div>
        ) : surgeries.length === 0 ? (
          <EmptyState
            icon={Scissors}
            title="No surgeries recorded yet"
            description={
              readOnly
                ? `No surgical procedures have been recorded for ${petName} yet.`
                : `Surgical procedures performed on ${petName} will appear here. Click "Add Surgery" to record one.`
            }
            action={
              !readOnly ? (
                <Button size="sm" onClick={openNew} disabled={!petDbId}>
                  <Plus className="w-4 h-4" /> Add Surgery
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-4">
            {surgeries.map((s) => {
              const sc = statusColor(s.status);
              const duration = formatDuration(s.duration_minutes);
              const surgeon = surgeonName(s);
              return (
                <Accordion key={s.id} type="single" collapsible>
                  <AccordionItem value={`surgery-${s.id}`} className="border border-[var(--border-color)] px-4" style={{ borderRadius: '10px' }}>
                    <AccordionTrigger className="py-4 hover:no-underline">
                      <div className="flex items-center gap-4 flex-1 text-left mr-4">
                        <div
                          className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                          style={{ borderRadius: '10px', backgroundColor: '#EC489915' }}
                        >
                          <Scissors className="w-4 h-4" style={{ color: '#EC4899' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</p>
                          <p className="text-[var(--text-secondary)] truncate" style={{ fontSize: 12 }}>
                            {formatDate(s.surgery_date)}
                            {surgeon && <> · {surgeon}</>}
                            {duration && <> · {duration}</>}
                          </p>
                        </div>
                        <span
                          className="inline-block px-2 py-0.5 flex-shrink-0"
                          style={{ backgroundColor: sc.bg, color: sc.text, borderRadius: '9999px', fontSize: 11, fontWeight: 600 }}
                        >
                          {s.status}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <Separator className="mb-4" />
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-[var(--text-secondary)]" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Surgeon</p>
                          <p style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2 }}>{surgeon || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[var(--text-secondary)]" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assistant</p>
                          <p style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2 }}>{s.assistant || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[var(--text-secondary)]" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration</p>
                          <p style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2 }}>{duration || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[var(--text-secondary)]" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Complications</p>
                          <p style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2 }}>{s.complications || 'None'}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {s.anesthesia && (
                          <div>
                            <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Anesthesia Protocol</p>
                            <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{s.anesthesia}</p>
                          </div>
                        )}
                        {s.pre_op && (
                          <div>
                            <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pre-Operative</p>
                            <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{s.pre_op}</p>
                          </div>
                        )}
                        {s.procedure_notes && (
                          <div>
                            <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Procedure</p>
                            <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{s.procedure_notes}</p>
                          </div>
                        )}
                        {s.post_op && (
                          <div>
                            <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Post-Operative</p>
                            <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{s.post_op}</p>
                          </div>
                        )}
                        {s.follow_up && (
                          <div className="flex items-start gap-2 p-3" style={{ backgroundColor: 'var(--surface-elevated)', borderRadius: '8px' }}>
                            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--brand-green-text)' }} />
                            <div className="flex-1">
                              <p className="text-[var(--text-secondary)]" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Follow-Up</p>
                              <p style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{s.follow_up}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {!readOnly && (
                        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[var(--border-color)]">
                          <Button variant="outline" size="sm" onClick={() => openEdit(s)}>
                            <Edit2 className="w-3.5 h-3.5" /> Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(s.id)}
                            style={{ color: '#d4183d', borderColor: '#d4183d40' }}
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </Button>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ── Add / Edit Surgery Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent style={{ maxWidth: 680 }} className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="w-4 h-4" style={{ color: '#EC4899' }} />
              {editingId ? 'Edit Surgery' : 'Add Surgery'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Name with quick-pick */}
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>
                Surgery / Procedure Name <span style={{ color: '#d4183d' }}>*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Neutering (Orchiectomy)"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {COMMON_SURGERIES.map((surg) => (
                  <button
                    key={surg}
                    type="button"
                    onClick={() => setName(surg)}
                    className="px-2 py-0.5 transition-all"
                    style={{
                      borderRadius: '9999px',
                      fontSize: 11,
                      fontWeight: name === surg ? 600 : 400,
                      backgroundColor: name === surg ? '#EC489920' : 'var(--surface-elevated)',
                      color: name === surg ? '#EC4899' : 'var(--text-secondary)',
                      border: `1px solid ${name === surg ? '#EC4899' : 'var(--border-color)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    {surg}
                  </button>
                ))}
              </div>
            </div>

            {/* Date + Duration */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>
                  Surgery Date <span style={{ color: '#d4183d' }}>*</span>
                </label>
                <Input type="date" value={surgeryDate} onChange={(e) => setSurgeryDate(e.target.value)} />
              </div>
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>Duration (min)</label>
                <Input
                  type="number"
                  min={0}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  placeholder="e.g. 35"
                />
              </div>
            </div>

            {/* Surgeon + Assistant */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>Surgeon</label>
                <Select value={surgeonId || 'none'} onValueChange={(v) => setSurgeonId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select surgeon" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Unassigned —</SelectItem>
                    {vets.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>Assistant</label>
                <Input
                  value={assistant}
                  onChange={(e) => setAssistant(e.target.value)}
                  placeholder="e.g. Tech J. Rivera"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>Status</label>
              <div className="flex flex-wrap gap-1.5">
                {SURGERY_STATUSES.map((st) => {
                  const sc = statusColor(st);
                  const active = status === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatus(st)}
                      className="px-3 py-1.5 transition-all"
                      style={{
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: active ? 600 : 500,
                        backgroundColor: active ? sc.bg : 'var(--surface-elevated)',
                        color: active ? sc.text : 'var(--text-secondary)',
                        border: `1.5px solid ${active ? sc.text : 'var(--border-color)'}`,
                        cursor: 'pointer',
                      }}
                    >
                      {st}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Anesthesia */}
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>Anesthesia Protocol</label>
              <Textarea
                value={anesthesia}
                onChange={(e) => setAnesthesia(e.target.value)}
                placeholder="e.g. Propofol induction, Isoflurane maintenance"
                className="min-h-16"
              />
            </div>

            {/* Pre-Op */}
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>Pre-Operative</label>
              <Textarea
                value={preOp}
                onChange={(e) => setPreOp(e.target.value)}
                placeholder="Bloodwork, fasting, pre-op exam findings…"
                className="min-h-16"
              />
            </div>

            {/* Procedure */}
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>Procedure Notes</label>
              <Textarea
                value={procedureNotes}
                onChange={(e) => setProcedureNotes(e.target.value)}
                placeholder="Detailed surgical description…"
                className="min-h-20"
              />
            </div>

            {/* Post-Op */}
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>Post-Operative</label>
              <Textarea
                value={postOp}
                onChange={(e) => setPostOp(e.target.value)}
                placeholder="Recovery, discharge instructions, medications…"
                className="min-h-16"
              />
            </div>

            {/* Complications */}
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>Complications</label>
              <Input
                value={complications}
                onChange={(e) => setComplications(e.target.value)}
                placeholder="None, or describe…"
              />
            </div>

            {/* Follow-Up */}
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>Follow-Up</label>
              <Textarea
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                placeholder="Recheck date, healing status, outcome…"
                className="min-h-16"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim() || !surgeryDate}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</> : <>{editingId ? 'Save Changes' : 'Add Surgery'}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── PROBLEMS SECTION (lives inside Medical Overview) ──────────
// ═══════════════════════════════════════════════════════════════

type ProblemRow = {
  id: string;
  name: string;
  severity: string; // 'mild' | 'moderate' | 'severe'
  status: string;   // 'active' | 'resolved'
  date_diagnosed: string;
  resolved_date: string | null;
  updated_at: string;
  notes: string | null;
  soap_s: string | null;
  soap_o: string | null;
  soap_a: string | null;
  soap_p: string | null;
};

const PROBLEM_SEVERITIES = ['mild', 'moderate', 'severe'] as const;

const problemSeverityColor = (s: string) =>
  s === 'severe'
    ? { bg: '#d4183d15', text: '#d4183d', ring: '#d4183d' }
    : s === 'moderate'
    ? { bg: '#F4A26115', text: '#F4A261', ring: '#F4A261' }
    : { bg: '#74C69D15', text: 'var(--brand-green-text)', ring: 'var(--brand-green-text)' };

export function ProblemsSection({
  petName,
  petDbId,
  onChanged,
  readOnly = false,
}: {
  petName: string;
  petDbId: string;
  onChanged?: () => void;
  readOnly?: boolean;
}) {
  const db = useTenantDb();

  const [loading, setLoading] = useState(true);
  const [problems, setProblems] = useState<ProblemRow[]>([]);

  // Conditions reference (VeNom codes) for quick-pick
  const [conditionsRef, setConditionsRef] = useState<string[]>([]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [namePickerOpen, setNamePickerOpen] = useState(false);
  const [nameSearch, setNameSearch] = useState('');
  const [severity, setSeverity] = useState<string>('mild');
  const [onsetDate, setOnsetDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [soapS, setSoapS] = useState('');
  const [soapO, setSoapO] = useState('');
  const [soapA, setSoapA] = useState('');
  const [soapP, setSoapP] = useState('');

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setNameSearch('');
    setSeverity('mild');
    setOnsetDate(new Date().toISOString().split('T')[0]);
    setSoapS('');
    setSoapO('');
    setSoapA('');
    setSoapP('');
  };

  const loadProblems = useCallback(async () => {
    if (!petDbId) { setProblems([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await db
      .from('pet_conditions')
      .select('id, name, severity, status, date_diagnosed, resolved_date, updated_at, notes, soap_s, soap_o, soap_a, soap_p')
      .eq('pet_id', petDbId)
      .order('date_diagnosed', { ascending: false });
    if (error) {
      console.error('Failed to load problems:', error);
      setProblems([]);
    } else {
      setProblems((data || []) as unknown as ProblemRow[]);
    }
    setLoading(false);
  }, [db, petDbId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await loadProblems();
    })();
    return () => { cancelled = true; };
  }, [loadProblems]);

  useEffect(() => {
    (async () => {
      const { data } = await db
        .from('vet_conditions_reference')
        .select('name')
        .eq('type', 'diagnosis')
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (data) setConditionsRef(data.map((r: any) => r.name));
    })();
  }, [db]);

  const openNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (p: ProblemRow) => {
    setEditingId(p.id);
    setName(p.name);
    setSeverity(p.severity || 'mild');
    setOnsetDate(p.date_diagnosed || new Date().toISOString().split('T')[0]);
    setSoapS(p.soap_s || '');
    setSoapO(p.soap_o || '');
    setSoapA(p.soap_a || '');
    setSoapP(p.soap_p || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!petDbId || !name.trim()) return;
    setSaving(true);
    try {
      const { organizationId } = await getOrgContext();
      const payload: any = {
        name: name.trim(),
        severity,
        date_diagnosed: onsetDate || new Date().toISOString().split('T')[0],
        soap_s: soapS.trim() || null,
        soap_o: soapO.trim() || null,
        soap_a: soapA.trim() || null,
        soap_p: soapP.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await db.from('pet_conditions').update(payload).eq('id', editingId);
        if (error) {
          console.error('Failed to update problem:', error);
          alert('Could not update problem — see console for details.');
          return;
        }
      } else {
        const { error } = await db.from('pet_conditions').insert({
          ...payload,
          organization_id: organizationId,
          pet_id: petDbId,
          status: 'active',
        });
        if (error) {
          console.error('Failed to create problem:', error);
          alert('Could not create problem — see console for details.');
          return;
        }
      }
      setDialogOpen(false);
      resetForm();
      await loadProblems();
      onChanged?.();
      window.dispatchEvent(new CustomEvent('petDataChanged'));
      requestPetReport(petDbId, 'problem');
    } catch (e) {
      console.error('Save problem error:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (p: ProblemRow) => {
    const goingToResolved = p.status !== 'resolved';
    const { error } = await db
      .from('pet_conditions')
      .update({
        status: goingToResolved ? 'resolved' : 'active',
        resolved_date: goingToResolved ? new Date().toISOString().split('T')[0] : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', p.id);
    if (error) {
      console.error('Failed to toggle problem status:', error);
      return;
    }
    await loadProblems();
    onChanged?.();
    window.dispatchEvent(new CustomEvent('petDataChanged'));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this problem? This cannot be undone.')) return;
    const { error } = await db.from('pet_conditions').delete().eq('id', id);
    if (error) {
      console.error('Failed to delete problem:', error);
      return;
    }
    await loadProblems();
    onChanged?.();
    window.dispatchEvent(new CustomEvent('petDataChanged'));
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  const formatDateTime = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  const durationBetween = (start: string | null, end: string | null) => {
    if (!start || !end) return null;
    const s = new Date(start + 'T00:00:00').getTime();
    const e = new Date(end + 'T00:00:00').getTime();
    const days = Math.max(0, Math.round((e - s) / (1000 * 60 * 60 * 24)));
    if (days < 7) return `${days} day${days === 1 ? '' : 's'}`;
    if (days < 60) return `${Math.round(days / 7)} week${days < 14 ? '' : 's'}`;
    if (days < 365) return `${Math.round(days / 30)} month${days < 60 ? '' : 's'}`;
    return `${Math.round(days / 365)} year${days < 730 ? '' : 's'}`;
  };

  const filteredNameOptions = (() => {
    const search = nameSearch.toLowerCase();
    const results: string[] = [];
    for (const d of conditionsRef) {
      if (results.length >= 50) break;
      if (d.toLowerCase().includes(search)) results.push(d);
    }
    return results;
  })();

  const activeProblems = problems.filter(p => p.status !== 'resolved');
  const resolvedProblems = problems.filter(p => p.status === 'resolved');

  return (
    <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5" style={{ color: '#F4A261' }} />
          <h3 className="text-[var(--text-primary)]">Problems</h3>
          {!loading && (
            <span
              className="inline-flex items-center px-2 py-0.5"
              style={{ backgroundColor: 'var(--surface-elevated)', color: 'var(--text-secondary)', borderRadius: '9999px', fontSize: 11, fontWeight: 600 }}
            >
              {activeProblems.length} active
            </span>
          )}
        </div>
        {!readOnly && (
          <Button variant="outline" size="sm" onClick={openNew} disabled={!petDbId}>
            <Plus className="w-4 h-4" /> Add Problem
          </Button>
        )}
      </div>

      {loading ? (
        <div className="py-10 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--text-secondary)]" />
        </div>
      ) : problems.length === 0 ? (
        <p className="text-[var(--text-secondary)] py-4" style={{ fontSize: '14px' }}>
          {readOnly
            ? `No problems on file for ${petName}.`
            : `No problems on file for ${petName}. Click "Add Problem" to record one with SOAP notes.`}
        </p>
      ) : (
        <div className="space-y-4">
          {/* Active problems */}
          {activeProblems.map((p) => {
            const sc = problemSeverityColor(p.severity);
            const hasSoap = p.soap_s || p.soap_o || p.soap_a || p.soap_p;
            return (
              <div
                key={p.id}
                className="border p-5 group"
                style={{
                  borderRadius: '12px',
                  borderColor: sc.ring + '40',
                  backgroundColor: sc.bg,
                  borderLeftWidth: 4,
                  borderLeftColor: sc.ring,
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-[var(--text-secondary)]" style={{ fontSize: 12 }}>
                        Onset: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatDate(p.date_diagnosed)}</span>
                      </span>
                      <span className="text-[var(--text-secondary)]" style={{ fontSize: 12 }}>
                        Updated: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatDateTime(p.updated_at)}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-1"
                      style={{ backgroundColor: sc.bg, color: sc.text, borderRadius: '9999px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', border: `1px solid ${sc.ring}40` }}
                    >
                      <CircleDot className="w-3 h-3" />
                      {p.severity}
                    </span>
                  </div>
                </div>

                {hasSoap && (
                  <div className="grid grid-cols-2 gap-3 mt-3 bg-[var(--surface-white)] p-4" style={{ borderRadius: '10px' }}>
                    {[
                      { label: 'Subjective', value: p.soap_s, color: '#3B82F6' },
                      { label: 'Objective', value: p.soap_o, color: '#8B5CF6' },
                      { label: 'Assessment', value: p.soap_a, color: '#F4A261' },
                      { label: 'Plan', value: p.soap_p, color: 'var(--brand-green-text)' },
                    ].map((s) => (
                      <div key={s.label}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: s.color }} />
                          <p className="text-[var(--text-secondary)]" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{s.value || '—'}</p>
                      </div>
                    ))}
                  </div>
                )}

                {!readOnly && (
                  <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t" style={{ borderColor: sc.ring + '30' }}>
                    <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleToggleStatus(p)}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Mark Resolved
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(p.id)}
                      style={{ color: '#d4183d', borderColor: '#d4183d40' }}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </Button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Resolved problems */}
          {resolvedProblems.length > 0 && (
            <div>
              <p className="text-[var(--text-secondary)] mt-6 mb-2" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Resolved ({resolvedProblems.length})
              </p>
              <div className="space-y-2">
                {resolvedProblems.map((p) => {
                  const dur = durationBetween(p.date_diagnosed, p.resolved_date);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between py-3 px-4"
                      style={{ backgroundColor: 'var(--surface-elevated)', borderRadius: '8px' }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--brand-green-text)' }} />
                        <span className="truncate" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{p.name}</span>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        {dur && (
                          <span className="text-[var(--text-secondary)] hidden sm:inline" style={{ fontSize: 12 }}>Duration: {dur}</span>
                        )}
                        <span className="text-[var(--text-secondary)]" style={{ fontSize: 12 }}>
                          Resolved: {formatDate(p.resolved_date)}
                        </span>
                        {!readOnly && (
                          <>
                            <button
                              onClick={() => handleToggleStatus(p)}
                              title="Reopen"
                              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}
                            >
                              Reopen
                            </button>
                            <button
                              onClick={() => handleDelete(p.id)}
                              title="Delete"
                              className="text-[var(--text-secondary)] hover:text-[#d4183d]"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
                            >
                              ×
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Add / Edit Problem Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent style={{ maxWidth: 680 }} className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" style={{ color: '#F4A261' }} />
              {editingId ? 'Edit Problem' : 'Add Problem'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Name with VeNom quick-pick */}
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>
                Problem / Diagnosis <span style={{ color: '#d4183d' }}>*</span>
              </label>
              <div className="flex gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Bilateral Hip Dysplasia"
                  className="flex-1"
                />
                <Popover open={namePickerOpen} onOpenChange={setNamePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">Browse</Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <Command>
                      <CommandInput
                        placeholder="Search VeNom conditions..."
                        value={nameSearch}
                        onValueChange={setNameSearch}
                      />
                      <CommandList>
                        <CommandEmpty>
                          <p className="text-[var(--text-secondary)] text-sm p-2">No matching condition.</p>
                        </CommandEmpty>
                        <CommandGroup>
                          {filteredNameOptions.map((d) => (
                            <CommandItem
                              key={d}
                              value={d}
                              onSelect={() => { setName(d); setNamePickerOpen(false); setNameSearch(''); }}
                            >
                              {d}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Severity + Onset Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>Severity</label>
                <div className="flex gap-1.5">
                  {PROBLEM_SEVERITIES.map((st) => {
                    const sc = problemSeverityColor(st);
                    const active = severity === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setSeverity(st)}
                        className="px-3 py-1.5 flex-1 transition-all"
                        style={{
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: active ? 600 : 500,
                          backgroundColor: active ? sc.bg : 'var(--surface-elevated)',
                          color: active ? sc.text : 'var(--text-secondary)',
                          border: `1.5px solid ${active ? sc.text : 'var(--border-color)'}`,
                          textTransform: 'capitalize',
                          cursor: 'pointer',
                        }}
                      >
                        {st}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>Onset Date</label>
                <Input type="date" value={onsetDate} onChange={(e) => setOnsetDate(e.target.value)} />
              </div>
            </div>

            {/* SOAP grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#3B82F6' }} />
                  Subjective
                </label>
                <Textarea
                  value={soapS}
                  onChange={(e) => setSoapS(e.target.value)}
                  placeholder="Owner-reported symptoms, history, behavior…"
                  className="min-h-20"
                />
              </div>
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#8B5CF6' }} />
                  Objective
                </label>
                <Textarea
                  value={soapO}
                  onChange={(e) => setSoapO(e.target.value)}
                  placeholder="Exam findings, vitals, lab results, imaging…"
                  className="min-h-20"
                />
              </div>
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#F4A261' }} />
                  Assessment
                </label>
                <Textarea
                  value={soapA}
                  onChange={(e) => setSoapA(e.target.value)}
                  placeholder="Clinical diagnosis, differentials, severity…"
                  className="min-h-20"
                />
              </div>
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--brand-green-text)' }} />
                  Plan
                </label>
                <Textarea
                  value={soapP}
                  onChange={(e) => setSoapP(e.target.value)}
                  placeholder="Treatment, medications, follow-up, recheck…"
                  className="min-h-20"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</> : <>{editingId ? 'Save Changes' : 'Add Problem'}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── PLAN TAB ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

type PlanRow = {
  id: string;
  title: string;
  status: string;
  last_review_date: string | null;
  next_review_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  staff?: { profiles?: { first_name?: string | null; last_name?: string | null } | null } | null;
};

type PlanGoalRow = {
  id: string;
  plan_id: string;
  text: string;
  progress: number;
  status: string; // 'on-track' | 'at-risk' | 'off-track'
  sort_order: number;
};

type PlanMilestoneRow = {
  id: string;
  plan_id: string;
  milestone_date: string;
  title: string;
  note: string | null;
  status: string; // 'done' | 'upcoming'
  sort_order: number;
};

type PlanMedRow = {
  id: string;
  plan_id: string;
  name: string;
  dose: string | null;
  purpose: string | null;
  sort_order: number;
};

const PLAN_STATUSES = ['active', 'completed', 'paused', 'cancelled'] as const;
const GOAL_STATUSES = ['on-track', 'at-risk', 'off-track'] as const;

const goalStatusColor = (s: string) =>
  s === 'on-track' ? { bg: 'var(--brand-green-text)', text: 'var(--brand-green-text)', label: 'On Track' }
  : s === 'at-risk' ? { bg: '#F4A261', text: '#F4A261', label: 'At Risk' }
  : { bg: '#d4183d', text: '#d4183d', label: 'Off Track' };

const planStatusColor = (s: string) => {
  switch (s) {
    case 'active':    return { bg: '#74C69D20', text: 'var(--brand-green-text)' };
    case 'completed': return { bg: '#3B82F620', text: '#3B82F6' };
    case 'paused':    return { bg: '#F4A26120', text: '#F4A261' };
    case 'cancelled': return { bg: '#d4183d20', text: '#d4183d' };
    default:          return { bg: 'var(--surface-elevated)', text: 'var(--text-secondary)' };
  }
};

export function PlanTab({ petName, petDbId, readOnly = false }: { petName: string; petDbId: string; readOnly?: boolean }) {
  const db = useTenantDb();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [goalsByPlan, setGoalsByPlan] = useState<Record<string, PlanGoalRow[]>>({});
  const [milestonesByPlan, setMilestonesByPlan] = useState<Record<string, PlanMilestoneRow[]>>({});
  const [medsByPlan, setMedsByPlan] = useState<Record<string, PlanMedRow[]>>({});

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<string>('active');
  const [lastReviewDate, setLastReviewDate] = useState<string>('');
  const [nextReviewDate, setNextReviewDate] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [formGoals, setFormGoals] = useState<Array<{ id?: string; text: string; progress: number; status: string }>>([]);
  const [formMilestones, setFormMilestones] = useState<Array<{ id?: string; milestone_date: string; title: string; note: string; status: string }>>([]);
  const [formMeds, setFormMeds] = useState<Array<{ id?: string; name: string; dose: string; purpose: string }>>([]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setStatus('active');
    setLastReviewDate('');
    setNextReviewDate('');
    setNotes('');
    setFormGoals([]);
    setFormMilestones([]);
    setFormMeds([]);
  };

  const loadPlans = useCallback(async () => {
    if (!petDbId) { setPlans([]); setLoading(false); return; }
    setLoading(true);
    const { data: planData, error: planErr } = await db
      .from('treatment_plans')
      .select(`
        id, title, status, last_review_date, next_review_date, notes, created_at, updated_at, created_by,
        staff:staff!treatment_plans_created_by_fkey(id, profiles:profiles!staff_profile_id_fkey(first_name, last_name))
      `)
      .eq('pet_id', petDbId)
      .order('created_at', { ascending: false });

    if (planErr) {
      console.error('Failed to load plans:', planErr);
      setPlans([]); setGoalsByPlan({}); setMilestonesByPlan({}); setMedsByPlan({});
      setLoading(false);
      return;
    }

    const list = ((planData || []) as unknown as PlanRow[]);
    setPlans(list);

    const planIds = list.map(p => p.id);
    if (planIds.length === 0) {
      setGoalsByPlan({}); setMilestonesByPlan({}); setMedsByPlan({});
      setLoading(false);
      return;
    }

    const [goalsRes, milestonesRes, medsRes] = await Promise.all([
      db.from('treatment_plan_goals').select('*').in('plan_id', planIds).order('sort_order', { ascending: true }),
      db.from('treatment_plan_milestones').select('*').in('plan_id', planIds).order('milestone_date', { ascending: true }),
      db.from('treatment_plan_medications').select('*').in('plan_id', planIds).order('sort_order', { ascending: true }),
    ]);

    const gMap: Record<string, PlanGoalRow[]> = {};
    (goalsRes.data as any[] || []).forEach((g: any) => {
      (gMap[g.plan_id] = gMap[g.plan_id] || []).push(g as PlanGoalRow);
    });
    const mMap: Record<string, PlanMilestoneRow[]> = {};
    (milestonesRes.data as any[] || []).forEach((m: any) => {
      (mMap[m.plan_id] = mMap[m.plan_id] || []).push(m as PlanMilestoneRow);
    });
    const medMap: Record<string, PlanMedRow[]> = {};
    (medsRes.data as any[] || []).forEach((m: any) => {
      (medMap[m.plan_id] = medMap[m.plan_id] || []).push(m as PlanMedRow);
    });

    setGoalsByPlan(gMap);
    setMilestonesByPlan(mMap);
    setMedsByPlan(medMap);
    setLoading(false);
  }, [db, petDbId]);

  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) await loadPlans(); })();
    return () => { cancelled = true; };
  }, [loadPlans]);

  const openNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (p: PlanRow) => {
    setEditingId(p.id);
    setTitle(p.title);
    setStatus(p.status || 'active');
    setLastReviewDate(p.last_review_date || '');
    setNextReviewDate(p.next_review_date || '');
    setNotes(p.notes || '');
    setFormGoals((goalsByPlan[p.id] || []).map(g => ({ id: g.id, text: g.text, progress: g.progress, status: g.status })));
    setFormMilestones((milestonesByPlan[p.id] || []).map(m => ({ id: m.id, milestone_date: m.milestone_date, title: m.title, note: m.note || '', status: m.status })));
    setFormMeds((medsByPlan[p.id] || []).map(m => ({ id: m.id, name: m.name, dose: m.dose || '', purpose: m.purpose || '' })));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!petDbId || !title.trim()) return;
    setSaving(true);
    try {
      const { organizationId, clinicId } = await getOrgContext();

      // Resolve created_by from current staff (if any)
      let createdByStaffId: string | null = null;
      if (user?.id) {
        const { data: staffRow } = await db
          .from('staff')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('profile_id', user.id)
          .maybeSingle();
        createdByStaffId = (staffRow as any)?.id || null;
      }

      const planPayload: any = {
        title: title.trim(),
        status,
        last_review_date: lastReviewDate || null,
        next_review_date: nextReviewDate || null,
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      let planId = editingId;
      if (editingId) {
        const { error } = await db.from('treatment_plans').update(planPayload).eq('id', editingId);
        if (error) {
          console.error('Failed to update plan:', error);
          alert('Could not update plan — see console for details.');
          return;
        }
      } else {
        const { data, error } = await db.from('treatment_plans').insert({
          ...planPayload,
          organization_id: organizationId,
          clinic_id: clinicId || null,
          pet_id: petDbId,
          created_by: createdByStaffId,
        }).select('id').single();
        if (error || !data) {
          console.error('Failed to create plan:', error);
          alert('Could not create plan — see console for details.');
          return;
        }
        planId = (data as any).id;
      }

      if (!planId) return;

      // Wipe + re-insert children (simpler than diffing)
      await Promise.all([
        db.from('treatment_plan_goals').delete().eq('plan_id', planId),
        db.from('treatment_plan_milestones').delete().eq('plan_id', planId),
        db.from('treatment_plan_medications').delete().eq('plan_id', planId),
      ]);

      const goalRows = formGoals
        .filter(g => g.text.trim())
        .map((g, i) => ({
          plan_id: planId,
          text: g.text.trim(),
          progress: Math.max(0, Math.min(100, Number(g.progress) || 0)),
          status: g.status || 'on-track',
          sort_order: i,
        }));
      const milestoneRows = formMilestones
        .filter(m => m.title.trim() && m.milestone_date)
        .map((m, i) => ({
          plan_id: planId,
          milestone_date: m.milestone_date,
          title: m.title.trim(),
          note: m.note.trim() || null,
          status: m.status || 'upcoming',
          sort_order: i,
        }));
      const medRows = formMeds
        .filter(m => m.name.trim())
        .map((m, i) => ({
          plan_id: planId,
          name: m.name.trim(),
          dose: m.dose.trim() || null,
          purpose: m.purpose.trim() || null,
          sort_order: i,
        }));

      const inserts: Promise<any>[] = [];
      if (goalRows.length) inserts.push(db.from('treatment_plan_goals').insert(goalRows));
      if (milestoneRows.length) inserts.push(db.from('treatment_plan_milestones').insert(milestoneRows));
      if (medRows.length) inserts.push(db.from('treatment_plan_medications').insert(medRows));
      await Promise.all(inserts);

      setDialogOpen(false);
      resetForm();
      await loadPlans();
      requestPetReport(petDbId, 'plan');
    } catch (e) {
      console.error('Save plan error:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this treatment plan? All goals, milestones, and medications inside it will be removed. This cannot be undone.')) return;
    const { error } = await db.from('treatment_plans').delete().eq('id', id);
    if (error) {
      console.error('Failed to delete plan:', error);
      return;
    }
    await loadPlans();
  };

  const addGoalRow = () => setFormGoals([...formGoals, { text: '', progress: 0, status: 'on-track' }]);
  const updateGoalRow = (i: number, patch: Partial<{ text: string; progress: number; status: string }>) => {
    setFormGoals(formGoals.map((g, idx) => idx === i ? { ...g, ...patch } : g));
  };
  const removeGoalRow = (i: number) => setFormGoals(formGoals.filter((_, idx) => idx !== i));

  const addMilestoneRow = () => setFormMilestones([
    ...formMilestones,
    { milestone_date: new Date().toISOString().split('T')[0], title: '', note: '', status: 'upcoming' },
  ]);
  const updateMilestoneRow = (i: number, patch: Partial<{ milestone_date: string; title: string; note: string; status: string }>) => {
    setFormMilestones(formMilestones.map((m, idx) => idx === i ? { ...m, ...patch } : m));
  };
  const removeMilestoneRow = (i: number) => setFormMilestones(formMilestones.filter((_, idx) => idx !== i));

  const addMedRow = () => setFormMeds([...formMeds, { name: '', dose: '', purpose: '' }]);
  const updateMedRow = (i: number, patch: Partial<{ name: string; dose: string; purpose: string }>) => {
    setFormMeds(formMeds.map((m, idx) => idx === i ? { ...m, ...patch } : m));
  };
  const removeMedRow = (i: number) => setFormMeds(formMeds.filter((_, idx) => idx !== i));

  const formatDate = (d: string | null) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  const formatDateShort = (d: string | null) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

  const creatorName = (p: PlanRow) => {
    const pr = p.staff?.profiles;
    if (!pr || (!pr.first_name && !pr.last_name)) return null;
    return `Dr. ${pr.first_name || ''} ${pr.last_name || ''}`.trim();
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="py-20 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--text-secondary)]" />
        </div>
      ) : plans.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No treatment plans yet"
          description={
            readOnly
              ? `No long-term care plans have been created for ${petName} yet.`
              : `Long-term care plans for ${petName} will appear here. Create a plan to track goals, milestones, and medications.`
          }
          action={
            !readOnly ? (
              <Button size="sm" onClick={openNew} disabled={!petDbId}>
                <Plus className="w-4 h-4" /> New Plan
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Top action row */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[var(--text-primary)]" style={{ fontSize: 18, fontWeight: 700 }}>Treatment Plans</h3>
              <p className="text-[var(--text-secondary)] mt-0.5" style={{ fontSize: 13 }}>
                {plans.length} plan{plans.length === 1 ? '' : 's'} for {petName}
              </p>
            </div>
            {!readOnly && (
              <Button size="sm" onClick={openNew} disabled={!petDbId}>
                <Plus className="w-4 h-4" /> New Plan
              </Button>
            )}
          </div>

          {plans.map((p) => {
            const goals = goalsByPlan[p.id] || [];
            const milestones = milestonesByPlan[p.id] || [];
            const meds = medsByPlan[p.id] || [];
            const sc = planStatusColor(p.status);
            const creator = creatorName(p);

            return (
              <div key={p.id} className="space-y-6">
                {/* Plan header */}
                <div
                  className="border p-6"
                  style={{
                    borderRadius: '14px',
                    borderColor: 'color-mix(in srgb, var(--brand-green-text) 25%, transparent)',
                    background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-green-text) 5%, transparent), transparent)',
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-12 h-12 flex items-center justify-center flex-shrink-0"
                        style={{ borderRadius: '12px', backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 12%, transparent)' }}
                      >
                        <Target className="w-5 h-5" style={{ color: 'var(--brand-green-text)' }} />
                      </div>
                      <div>
                        <Badge
                          variant="outline"
                          className="mb-2"
                          style={{ fontSize: 10, textTransform: 'uppercase', backgroundColor: sc.bg, color: sc.text, borderColor: sc.text + '40' }}
                        >
                          {p.status} plan
                        </Badge>
                        <h3 className="text-[var(--text-primary)]" style={{ fontSize: 20, fontWeight: 700 }}>{p.title}</h3>
                        <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: 13 }}>
                          {creator ? `Created by ${creator} · ` : ''}{formatDate(p.created_at.split('T')[0])}
                        </p>
                      </div>
                    </div>
                    {!readOnly && (
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                          <Edit2 className="w-4 h-4" /> Edit Plan
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(p.id)}
                          style={{ color: '#d4183d', borderColor: '#d4183d40' }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <StatTile
                      label="Last Review"
                      value={p.last_review_date ? formatDateShort(p.last_review_date) : '—'}
                      sub={creator ? creator.replace(/^Dr\. /, 'Dr. ') : 'Unassigned'}
                    />
                    <StatTile
                      label="Next Review"
                      value={p.next_review_date ? formatDateShort(p.next_review_date) : '—'}
                      sub={p.next_review_date ? 'Scheduled' : 'Not set'}
                      color="var(--brand-green-text)"
                    />
                    <StatTile
                      label="Active Meds"
                      value={meds.length}
                      sub={meds.length ? 'On protocol' : 'None'}
                      color="#3B82F6"
                    />
                  </div>
                  {p.notes && (
                    <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                      <p className="text-[var(--text-secondary)]" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</p>
                      <p className="mt-1" style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{p.notes}</p>
                    </div>
                  )}
                </div>

                {/* Goals */}
                <SectionCard title="Treatment Goals" subtitle="Progress toward plan objectives" icon={TrendingUp} iconColor="var(--brand-green-text)">
                  {goals.length === 0 ? (
                    <p className="text-[var(--text-secondary)] py-2" style={{ fontSize: 13 }}>No goals added to this plan yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {goals.map((g) => {
                        const gs = goalStatusColor(g.status);
                        return (
                          <div key={g.id}>
                            <div className="flex items-start justify-between mb-2">
                              <p className="flex-1" style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{g.text}</p>
                              <span className="flex-shrink-0 ml-3" style={{ fontSize: 12, fontWeight: 700, color: gs.text }}>{gs.label} · {g.progress}%</span>
                            </div>
                            <div className="w-full h-2" style={{ backgroundColor: 'var(--surface-elevated)', borderRadius: '9999px', overflow: 'hidden' }}>
                              <div
                                className="h-full transition-all"
                                style={{ width: `${g.progress}%`, backgroundColor: gs.bg, borderRadius: '9999px' }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionCard>

                <div className="grid grid-cols-2 gap-6">
                  {/* Milestones timeline */}
                  <SectionCard title="Timeline" subtitle="Progress checkpoints" icon={Clock} iconColor="#8B5CF6">
                    {milestones.length === 0 ? (
                      <p className="text-[var(--text-secondary)] py-2" style={{ fontSize: 13 }}>No milestones yet.</p>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-[11px] top-1 bottom-1 w-0.5" style={{ backgroundColor: 'var(--border-color)' }} />
                        <div className="space-y-4">
                          {milestones.map((m) => (
                            <div key={m.id} className="relative pl-8">
                              <div
                                className="absolute left-0 top-0.5 w-6 h-6 flex items-center justify-center"
                                style={{
                                  borderRadius: '50%',
                                  backgroundColor: m.status === 'done' ? 'var(--brand-green-text)' : 'var(--surface-white)',
                                  border: `2px solid ${m.status === 'done' ? 'var(--brand-green-text)' : 'var(--border-color)'}`,
                                }}
                              >
                                {m.status === 'done' ? (
                                  <Check className="w-3 h-3" style={{ color: '#fff' }} />
                                ) : (
                                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--text-secondary)' }} />
                                )}
                              </div>
                              <div>
                                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{m.title}</p>
                                <p className="text-[var(--text-secondary)]" style={{ fontSize: 11, marginTop: 1 }}>{formatDate(m.milestone_date)}</p>
                                {m.note && (
                                  <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.note}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </SectionCard>

                  {/* Medications */}
                  <SectionCard title="Medication Protocol" subtitle="Medications in this plan" icon={Pill} iconColor="#3B82F6">
                    {meds.length === 0 ? (
                      <p className="text-[var(--text-secondary)] py-2" style={{ fontSize: 13 }}>No medications attached.</p>
                    ) : (
                      <div className="space-y-3">
                        {meds.map((m) => (
                          <div key={m.id} className="flex items-start gap-3 p-3 border border-[var(--border-color)]" style={{ borderRadius: '10px' }}>
                            <div
                              className="w-9 h-9 flex items-center justify-center flex-shrink-0"
                              style={{ borderRadius: '9px', backgroundColor: '#3B82F615' }}
                            >
                              <Pill className="w-4 h-4" style={{ color: '#3B82F6' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</p>
                              {m.dose && (
                                <p className="text-[var(--text-secondary)]" style={{ fontSize: 12, marginTop: 1 }}>{m.dose}</p>
                              )}
                              {m.purpose && (
                                <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: 11, fontStyle: 'italic' }}>For: {m.purpose}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </SectionCard>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ── Add / Edit Plan Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent style={{ maxWidth: 820 }} className="max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-4 h-4" style={{ color: 'var(--brand-green-text)' }} />
              {editingId ? 'Edit Treatment Plan' : 'New Treatment Plan'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Title */}
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>
                Plan Title <span style={{ color: '#d4183d' }}>*</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Hip Dysplasia & Weight Management Plan"
              />
            </div>

            {/* Status + Reviews */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLAN_STATUSES.map(s => <SelectItem key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>Last Review</label>
                <Input type="date" value={lastReviewDate} onChange={(e) => setLastReviewDate(e.target.value)} />
              </div>
              <div>
                <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>Next Review</label>
                <Input type="date" value={nextReviewDate} onChange={(e) => setNextReviewDate(e.target.value)} />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Overview, clinical rationale, owner discussion…"
                className="min-h-16"
              />
            </div>

            <Separator />

            {/* Goals */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[var(--text-primary)]" style={{ fontSize: 13, fontWeight: 600 }}>
                  Goals <span className="text-[var(--text-secondary)]" style={{ fontWeight: 400 }}>({formGoals.length})</span>
                </label>
                <Button variant="outline" size="sm" onClick={addGoalRow}>
                  <Plus className="w-3.5 h-3.5" /> Add Goal
                </Button>
              </div>
              {formGoals.length === 0 ? (
                <p className="text-[var(--text-secondary)] py-2" style={{ fontSize: 12 }}>No goals yet. Click "Add Goal" to create one.</p>
              ) : (
                <div className="space-y-2">
                  {formGoals.map((g, i) => (
                    <div key={i} className="border border-[var(--border-color)] p-3" style={{ borderRadius: 8 }}>
                      <div className="flex items-start gap-2">
                        <Input
                          value={g.text}
                          onChange={(e) => updateGoalRow(i, { text: e.target.value })}
                          placeholder="Goal description"
                          className="flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => removeGoalRow(i)}
                          className="p-1.5 text-[var(--text-secondary)] hover:text-[#d4183d]"
                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <label className="text-[var(--text-secondary)] mb-1 block" style={{ fontSize: 11, fontWeight: 600 }}>Progress ({g.progress}%)</label>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={g.progress}
                            onChange={(e) => updateGoalRow(i, { progress: Number(e.target.value) })}
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="text-[var(--text-secondary)] mb-1 block" style={{ fontSize: 11, fontWeight: 600 }}>Status</label>
                          <Select value={g.status} onValueChange={(v) => updateGoalRow(i, { status: v })}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {GOAL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Milestones */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[var(--text-primary)]" style={{ fontSize: 13, fontWeight: 600 }}>
                  Milestones <span className="text-[var(--text-secondary)]" style={{ fontWeight: 400 }}>({formMilestones.length})</span>
                </label>
                <Button variant="outline" size="sm" onClick={addMilestoneRow}>
                  <Plus className="w-3.5 h-3.5" /> Add Milestone
                </Button>
              </div>
              {formMilestones.length === 0 ? (
                <p className="text-[var(--text-secondary)] py-2" style={{ fontSize: 12 }}>No milestones yet.</p>
              ) : (
                <div className="space-y-2">
                  {formMilestones.map((m, i) => (
                    <div key={i} className="border border-[var(--border-color)] p-3" style={{ borderRadius: 8 }}>
                      <div className="grid grid-cols-[140px_1fr_140px_auto] gap-2 items-start">
                        <Input
                          type="date"
                          value={m.milestone_date}
                          onChange={(e) => updateMilestoneRow(i, { milestone_date: e.target.value })}
                        />
                        <Input
                          value={m.title}
                          onChange={(e) => updateMilestoneRow(i, { title: e.target.value })}
                          placeholder="Milestone title"
                        />
                        <Select value={m.status} onValueChange={(v) => updateMilestoneRow(i, { status: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="upcoming">Upcoming</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                          </SelectContent>
                        </Select>
                        <button
                          type="button"
                          onClick={() => removeMilestoneRow(i)}
                          className="p-1.5 text-[var(--text-secondary)] hover:text-[#d4183d]"
                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <Textarea
                        value={m.note}
                        onChange={(e) => updateMilestoneRow(i, { note: e.target.value })}
                        placeholder="Notes (optional)"
                        className="min-h-12 mt-2"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Medications */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[var(--text-primary)]" style={{ fontSize: 13, fontWeight: 600 }}>
                  Medications <span className="text-[var(--text-secondary)]" style={{ fontWeight: 400 }}>({formMeds.length})</span>
                </label>
                <Button variant="outline" size="sm" onClick={addMedRow}>
                  <Plus className="w-3.5 h-3.5" /> Add Medication
                </Button>
              </div>
              {formMeds.length === 0 ? (
                <p className="text-[var(--text-secondary)] py-2" style={{ fontSize: 12 }}>No medications yet.</p>
              ) : (
                <div className="space-y-2">
                  {formMeds.map((m, i) => (
                    <div key={i} className="border border-[var(--border-color)] p-3" style={{ borderRadius: 8 }}>
                      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                        <Input
                          value={m.name}
                          onChange={(e) => updateMedRow(i, { name: e.target.value })}
                          placeholder="Medication name"
                        />
                        <Input
                          value={m.dose}
                          onChange={(e) => updateMedRow(i, { dose: e.target.value })}
                          placeholder="Dose (e.g. 75mg PO SID)"
                        />
                        <Input
                          value={m.purpose}
                          onChange={(e) => updateMedRow(i, { purpose: e.target.value })}
                          placeholder="Purpose"
                        />
                        <button
                          type="button"
                          onClick={() => removeMedRow(i)}
                          className="p-1.5 text-[var(--text-secondary)] hover:text-[#d4183d]"
                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !title.trim()}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</> : <>{editingId ? 'Save Changes' : 'Create Plan'}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── DIET TAB ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

type DietPlanRow = {
  id: string;
  pet_id: string;
  food_brand: string | null;
  food_name: string | null;
  food_type: string | null;
  daily_amount: string | null;
  meals: string | null;
  calories: string | null;
  water_note: string | null;
  treats_note: string | null;
  target_weight_kg: number | null;
  started_on: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type DietRestrictionRow = {
  id: string;
  plan_id: string;
  item: string;
  reason: string | null;
  severity: string; // 'strict' | 'moderate'
  sort_order: number;
};

type WeightLogRow = {
  id: string;
  weight_kg: number;
  recorded_at: string; // date
  notes: string | null;
};

export function DietTab({
  petName,
  petSpecies: _petSpecies,
  petWeight,
  petDbId,
  readOnly = false,
}: {
  petName: string;
  petSpecies: string;
  petWeight: string;
  petDbId: string;
  readOnly?: boolean;
}) {
  const db = useTenantDb();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<DietPlanRow | null>(null);
  const [restrictions, setRestrictions] = useState<DietRestrictionRow[]>([]);
  const [weightHistory, setWeightHistory] = useState<WeightLogRow[]>([]);

  // Dialog state — edit current plan
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fBrand, setFBrand] = useState('');
  const [fName, setFName] = useState('');
  const [fType, setFType] = useState('');
  const [fDaily, setFDaily] = useState('');
  const [fMeals, setFMeals] = useState('');
  const [fCalories, setFCalories] = useState('');
  const [fWater, setFWater] = useState('');
  const [fTreats, setFTreats] = useState('');
  const [fTarget, setFTarget] = useState<string>('');
  const [fStarted, setFStarted] = useState<string>('');
  const [fNotes, setFNotes] = useState('');
  const [fRestrictions, setFRestrictions] = useState<Array<{ id?: string; item: string; reason: string; severity: string }>>([]);

  // Weight dialog
  const [weightDialogOpen, setWeightDialogOpen] = useState(false);
  const [weightSaving, setWeightSaving] = useState(false);
  const [wKg, setWKg] = useState<string>('');
  const [wDate, setWDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [wNotes, setWNotes] = useState<string>('');

  const loadDiet = useCallback(async () => {
    if (!petDbId) {
      setPlan(null); setRestrictions([]); setWeightHistory([]); setLoading(false);
      return;
    }
    setLoading(true);

    const [planRes, weightRes] = await Promise.all([
      db
        .from('diet_plans')
        .select('id, pet_id, food_brand, food_name, food_type, daily_amount, meals, calories, water_note, treats_note, target_weight_kg, started_on, status, notes, created_at, updated_at')
        .eq('pet_id', petDbId)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from('pet_weight_history')
        .select('id, weight_kg, recorded_at, notes')
        .eq('pet_id', petDbId)
        .order('recorded_at', { ascending: true }),
    ]);

    const planRow = (planRes.data as DietPlanRow | null) || null;
    setPlan(planRow);
    setWeightHistory((weightRes.data as WeightLogRow[]) || []);

    if (planRow) {
      const { data: rData } = await db
        .from('diet_restrictions')
        .select('id, plan_id, item, reason, severity, sort_order')
        .eq('plan_id', planRow.id)
        .order('sort_order', { ascending: true });
      setRestrictions((rData as DietRestrictionRow[]) || []);
    } else {
      setRestrictions([]);
    }
    setLoading(false);
  }, [db, petDbId]);

  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) await loadDiet(); })();
    return () => { cancelled = true; };
  }, [loadDiet]);

  const openEdit = () => {
    setFBrand(plan?.food_brand || '');
    setFName(plan?.food_name || '');
    setFType(plan?.food_type || '');
    setFDaily(plan?.daily_amount || '');
    setFMeals(plan?.meals || '');
    setFCalories(plan?.calories || '');
    setFWater(plan?.water_note || '');
    setFTreats(plan?.treats_note || '');
    setFTarget(plan?.target_weight_kg != null ? String(plan.target_weight_kg) : '');
    setFStarted(plan?.started_on || '');
    setFNotes(plan?.notes || '');
    setFRestrictions(restrictions.map(r => ({ id: r.id, item: r.item, reason: r.reason || '', severity: r.severity })));
    setDialogOpen(true);
  };

  const addRestrictionRow = () =>
    setFRestrictions([...fRestrictions, { item: '', reason: '', severity: 'moderate' }]);
  const updateRestrictionRow = (i: number, patch: Partial<{ item: string; reason: string; severity: string }>) =>
    setFRestrictions(fRestrictions.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeRestrictionRow = (i: number) =>
    setFRestrictions(fRestrictions.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!petDbId) return;
    setSaving(true);
    try {
      const { organizationId, clinicId } = await getOrgContext();

      // Resolve created_by (staff id) once
      let createdByStaffId: string | null = null;
      if (user?.id) {
        const { data: staffRow } = await db
          .from('staff')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('profile_id', user.id)
          .maybeSingle();
        createdByStaffId = (staffRow as any)?.id || null;
      }

      const planPayload: any = {
        food_brand: fBrand.trim() || null,
        food_name: fName.trim() || null,
        food_type: fType.trim() || null,
        daily_amount: fDaily.trim() || null,
        meals: fMeals.trim() || null,
        calories: fCalories.trim() || null,
        water_note: fWater.trim() || null,
        treats_note: fTreats.trim() || null,
        target_weight_kg: fTarget.trim() ? Number(fTarget) : null,
        started_on: fStarted || null,
        notes: fNotes.trim() || null,
        status: 'active',
        updated_at: new Date().toISOString(),
      };

      let planId = plan?.id || null;
      if (planId) {
        const { error } = await db.from('diet_plans').update(planPayload).eq('id', planId);
        if (error) {
          console.error('Failed to update diet plan:', error);
          alert('Could not update diet plan — see console for details.');
          return;
        }
      } else {
        const { data, error } = await db
          .from('diet_plans')
          .insert({
            ...planPayload,
            organization_id: organizationId,
            clinic_id: clinicId || null,
            pet_id: petDbId,
            created_by: createdByStaffId,
          })
          .select('id')
          .single();
        if (error || !data) {
          console.error('Failed to create diet plan:', error);
          alert('Could not create diet plan — see console for details.');
          return;
        }
        planId = (data as any).id;
      }

      if (!planId) return;

      // Wipe + re-insert restrictions
      await db.from('diet_restrictions').delete().eq('plan_id', planId);
      const rRows = fRestrictions
        .filter(r => r.item.trim())
        .map((r, i) => ({
          plan_id: planId,
          item: r.item.trim(),
          reason: r.reason.trim() || null,
          severity: r.severity || 'moderate',
          sort_order: i,
        }));
      if (rRows.length) {
        const { error } = await db.from('diet_restrictions').insert(rRows);
        if (error) console.error('Failed to insert restrictions:', error);
      }

      setDialogOpen(false);
      await loadDiet();
      requestPetReport(petDbId, 'diet');
    } catch (e) {
      console.error('Save diet error:', e);
    } finally {
      setSaving(false);
    }
  };

  const openLogWeight = () => {
    // Prefill with most recent value as a hint
    setWKg(weightHistory.length ? String(weightHistory[weightHistory.length - 1].weight_kg) : '');
    setWDate(new Date().toISOString().slice(0, 10));
    setWNotes('');
    setWeightDialogOpen(true);
  };

  const handleLogWeight = async () => {
    if (!petDbId) return;
    const kg = Number(wKg);
    if (!kg || kg <= 0) return;
    setWeightSaving(true);
    try {
      const { organizationId } = await getOrgContext();
      let recordedByStaffId: string | null = null;
      if (user?.id) {
        const { data: staffRow } = await db
          .from('staff')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('profile_id', user.id)
          .maybeSingle();
        recordedByStaffId = (staffRow as any)?.id || null;
      }

      const { error } = await db.from('pet_weight_history').insert({
        organization_id: organizationId,
        pet_id: petDbId,
        weight_kg: kg,
        recorded_at: wDate,
        recorded_by: recordedByStaffId,
        notes: wNotes.trim() || null,
      });
      if (error) {
        console.error('Failed to log weight:', error);
        alert('Could not save weight entry — see console for details.');
        return;
      }
      setWeightDialogOpen(false);
      await loadDiet();
      requestPetReport(petDbId, 'weight');
    } finally {
      setWeightSaving(false);
    }
  };

  const handleDeleteWeight = async (id: string) => {
    if (!confirm('Remove this weight entry?')) return;
    const { error } = await db.from('pet_weight_history').delete().eq('id', id);
    if (error) {
      console.error('Failed to delete weight entry:', error);
      return;
    }
    await loadDiet();
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const formatDateTiny = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

  // Weight chart metrics (from real data only)
  const weights = weightHistory.map(w => Number(w.weight_kg));
  const startWeight = weights.length ? weights[0] : null;
  const currentWeight = weights.length ? weights[weights.length - 1] : null;
  const target = plan?.target_weight_kg != null ? Number(plan.target_weight_kg) : null;
  const weightLost =
    startWeight != null && currentWeight != null
      ? Math.max(0, startWeight - currentWeight).toFixed(1)
      : null;
  const maxWeight = weights.length
    ? Math.max(...weights, target ?? -Infinity) + 1
    : 1;
  const minWeight = weights.length
    ? Math.min(...weights, target ?? Infinity) - 1
    : 0;
  const progress =
    startWeight != null && currentWeight != null && target != null && startWeight > target
      ? Math.min(100, Math.max(0, ((startWeight - currentWeight) / (startWeight - target)) * 100))
      : null;

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--text-secondary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current diet card */}
      <SectionCard
        title="Current Diet Plan"
        subtitle={`Active feeding regimen for ${petName}`}
        icon={Utensils}
        iconColor="#F4A261"
        action={
          !readOnly ? (
            <Button variant="outline" size="sm" onClick={openEdit} disabled={!petDbId}>
              <Edit2 className="w-4 h-4" /> {plan ? 'Update' : 'Set Up'}
            </Button>
          ) : undefined
        }
      >
        {!plan ? (
          <EmptyState
            icon={Utensils}
            title="No diet plan yet"
            description={
              readOnly
                ? `No diet plan has been set up for ${petName} yet.`
                : `Record ${petName}'s current feeding regimen — food, portions, meals, and any restrictions.`
            }
            action={
              !readOnly ? (
                <Button size="sm" onClick={openEdit} disabled={!petDbId}>
                  <Plus className="w-4 h-4" /> Create Diet Plan
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div
              className="p-5 mb-5"
              style={{
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #F4A26108, transparent)',
                border: '1px solid #F4A26130',
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-14 h-14 flex items-center justify-center flex-shrink-0"
                  style={{ borderRadius: '12px', backgroundColor: '#F4A26120' }}
                >
                  <Utensils className="w-6 h-6" style={{ color: '#F4A261' }} />
                </div>
                <div className="flex-1">
                  {plan.food_brand && (
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#F4A261', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {plan.food_brand}
                    </p>
                  )}
                  <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                    {plan.food_name || 'Untitled diet'}
                  </p>
                  {plan.food_type && (
                    <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: 13 }}>{plan.food_type}</p>
                  )}
                  {plan.started_on && (
                    <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: 12 }}>
                      Started: {formatDate(plan.started_on)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <StatTile label="Daily Amount" value={plan.daily_amount || '—'} color="#F4A261" />
              <StatTile label="Meals" value={plan.meals || '—'} color="#3B82F6" />
              <StatTile label="Calories" value={plan.calories || '—'} color="#8B5CF6" />
              <StatTile label="Water" value={plan.water_note ? 'Noted' : 'Free access'} sub={plan.water_note || '24/7'} color="#06B6D4" />
            </div>

            {(plan.treats_note || plan.notes) && <Separator className="my-5" />}

            {plan.treats_note && (
              <div className="mb-3">
                <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Treats</p>
                <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{plan.treats_note}</p>
              </div>
            )}
            {plan.notes && (
              <div>
                <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</p>
                <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{plan.notes}</p>
              </div>
            )}
          </>
        )}
      </SectionCard>

      <div className="grid grid-cols-2 gap-6">
        {/* Weight tracking chart */}
        <SectionCard
          title="Weight Progress"
          subtitle={
            weightLost != null && target != null
              ? `${weightLost} kg lost · Target ${target} kg`
              : weightLost != null
              ? `${weightLost} kg lost`
              : target != null
              ? `Target ${target} kg`
              : 'Log weights to track progress'
          }
          icon={Weight}
          iconColor="var(--brand-green-text)"
          action={
            <Button variant="outline" size="sm" onClick={openLogWeight} disabled={!petDbId}>
              <Plus className="w-4 h-4" /> Log Weight
            </Button>
          }
        >
          {weightHistory.length === 0 ? (
            <EmptyState
              icon={Weight}
              title="No weight entries yet"
              description={`Log ${petName}'s weight to see a chart of progress toward the target.`}
              action={
                <Button size="sm" onClick={openLogWeight} disabled={!petDbId}>
                  <Plus className="w-4 h-4" /> Log First Weight
                </Button>
              }
            />
          ) : (
            <>
              {/* Progress bar to target */}
              {progress != null && startWeight != null && target != null && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[var(--text-secondary)]" style={{ fontSize: 11, fontWeight: 600 }}>
                      {startWeight} kg → {target} kg (target)
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-green-text)' }}>
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <div className="w-full h-2" style={{ backgroundColor: 'var(--surface-elevated)', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div
                      className="h-full"
                      style={{ width: `${progress}%`, backgroundColor: 'var(--brand-green-text)', borderRadius: '9999px' }}
                    />
                  </div>
                </div>
              )}

              {/* Simple SVG line chart */}
              <div className="relative w-full" style={{ height: 180 }}>
                <svg width="100%" height="100%" viewBox="0 0 400 180" preserveAspectRatio="none">
                  {/* Target line */}
                  {target != null && maxWeight > minWeight && (
                    <line
                      x1="0"
                      x2="400"
                      y1={180 - ((target - minWeight) / (maxWeight - minWeight)) * 160 - 10}
                      y2={180 - ((target - minWeight) / (maxWeight - minWeight)) * 160 - 10}
                      stroke="var(--brand-green-text)"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                      opacity="0.5"
                    />
                  )}
                  {/* Area fill (only meaningful with ≥2 points) */}
                  {weights.length > 1 && maxWeight > minWeight && (
                    <path
                      d={
                        `M 0 ${180 - ((weights[0] - minWeight) / (maxWeight - minWeight)) * 160 - 10} ` +
                        weights
                          .map((w, i) => {
                            const x = (i / (weights.length - 1)) * 400;
                            const y = 180 - ((w - minWeight) / (maxWeight - minWeight)) * 160 - 10;
                            return `L ${x} ${y}`;
                          })
                          .join(' ') +
                        ` L 400 180 L 0 180 Z`
                      }
                      fill="var(--brand-green-text)"
                      fillOpacity="0.1"
                    />
                  )}
                  {/* Line */}
                  {weights.length > 1 && maxWeight > minWeight && (
                    <path
                      d={
                        `M ${weights
                          .map((w, i) => {
                            const x = (i / (weights.length - 1)) * 400;
                            const y = 180 - ((w - minWeight) / (maxWeight - minWeight)) * 160 - 10;
                            return `${x} ${y}`;
                          })
                          .join(' L ')}`
                      }
                      fill="none"
                      stroke="var(--brand-green-text)"
                      strokeWidth="2"
                    />
                  )}
                  {/* Dots */}
                  {weights.map((w, i) => {
                    const x = weights.length === 1 ? 200 : (i / (weights.length - 1)) * 400;
                    const y =
                      maxWeight > minWeight
                        ? 180 - ((w - minWeight) / (maxWeight - minWeight)) * 160 - 10
                        : 90;
                    return (
                      <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r="3"
                        fill="var(--brand-green-text)"
                        stroke="var(--surface-white)"
                        strokeWidth="1.5"
                      />
                    );
                  })}
                </svg>
              </div>
              <div className="flex items-center justify-between mt-2 text-[var(--text-secondary)]" style={{ fontSize: 10 }}>
                <span>{formatDateTiny(weightHistory[0].recorded_at)}</span>
                <span>{formatDateTiny(weightHistory[weightHistory.length - 1].recorded_at)}</span>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--border-color)]">
                <div>
                  <p className="text-[var(--text-secondary)]" style={{ fontSize: 11 }}>Start</p>
                  <p style={{ fontSize: 16, fontWeight: 700 }}>{startWeight != null ? `${startWeight} kg` : '—'}</p>
                </div>
                <div>
                  <p className="text-[var(--text-secondary)]" style={{ fontSize: 11 }}>Current</p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--brand-green-text)' }}>
                    {currentWeight != null ? `${currentWeight} kg` : petWeight || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[var(--text-secondary)]" style={{ fontSize: 11 }}>Target</p>
                  <p style={{ fontSize: 16, fontWeight: 700 }}>{target != null ? `${target} kg` : '—'}</p>
                </div>
              </div>

              {/* Recent entries */}
              {weightHistory.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                  <p className="text-[var(--text-secondary)] mb-2" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Recent entries
                  </p>
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                    {[...weightHistory].reverse().slice(0, 6).map((w) => (
                      <div
                        key={w.id}
                        className="flex items-center justify-between px-2.5 py-1.5 border border-[var(--border-color)]"
                        style={{ borderRadius: 8 }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{Number(w.weight_kg)} kg</span>
                          <span className="text-[var(--text-secondary)]" style={{ fontSize: 11 }}>
                            {formatDate(w.recorded_at)}
                          </span>
                          {w.notes && (
                            <span className="text-[var(--text-secondary)] truncate" style={{ fontSize: 11, opacity: 0.8 }}>
                              · {w.notes}
                            </span>
                          )}
                        </div>
                        {!readOnly && (
                          <button
                            onClick={() => handleDeleteWeight(w.id)}
                            className="text-[var(--text-secondary)] hover:text-[#d4183d] transition-colors"
                            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                            aria-label="Delete weight entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </SectionCard>

        {/* Dietary restrictions */}
        <SectionCard
          title="Dietary Restrictions"
          subtitle="Foods to avoid"
          icon={AlertCircle}
          iconColor="#d4183d"
          action={
            !readOnly && plan ? (
              <Button variant="outline" size="sm" onClick={openEdit}>
                <Edit2 className="w-4 h-4" /> Edit
              </Button>
            ) : undefined
          }
        >
          {restrictions.length === 0 ? (
            <EmptyState
              icon={AlertCircle}
              title="No restrictions"
              description={
                plan
                  ? 'Add foods or ingredients to avoid when updating the diet plan.'
                  : 'Create a diet plan first to record restrictions.'
              }
            />
          ) : (
            <div className="space-y-2">
              {restrictions.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start gap-3 p-3 border"
                  style={{
                    borderRadius: '10px',
                    borderColor: r.severity === 'strict' ? '#d4183d30' : '#F4A26130',
                    backgroundColor: r.severity === 'strict' ? '#d4183d08' : '#F4A26108',
                  }}
                >
                  <X className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: r.severity === 'strict' ? '#d4183d' : '#F4A261' }} />
                  <div className="flex-1">
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{r.item}</p>
                    {r.reason && (
                      <p className="text-[var(--text-secondary)] mt-0.5" style={{ fontSize: 12 }}>{r.reason}</p>
                    )}
                  </div>
                  <span
                    className="inline-block px-2 py-0.5"
                    style={{
                      backgroundColor: r.severity === 'strict' ? '#d4183d20' : '#F4A26120',
                      color: r.severity === 'strict' ? '#d4183d' : '#F4A261',
                      borderRadius: '9999px',
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {r.severity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ─── Edit Diet Plan Dialog ─────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent style={{ maxWidth: 760, width: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
          <DialogHeader>
            <DialogTitle>{plan ? 'Update Diet Plan' : 'Create Diet Plan'}</DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto pr-1" style={{ flex: 1 }}>
            <div className="space-y-4">
              {/* Food */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[var(--text-secondary)] mb-1 block" style={{ fontSize: 12, fontWeight: 600 }}>Brand</label>
                  <Input value={fBrand} onChange={(e) => setFBrand(e.target.value)} placeholder="Royal Canin" />
                </div>
                <div>
                  <label className="text-[var(--text-secondary)] mb-1 block" style={{ fontSize: 12, fontWeight: 600 }}>Food name</label>
                  <Input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Veterinary Diet - Satiety Support" />
                </div>
              </div>
              <div>
                <label className="text-[var(--text-secondary)] mb-1 block" style={{ fontSize: 12, fontWeight: 600 }}>Food type</label>
                <Input value={fType} onChange={(e) => setFType(e.target.value)} placeholder="Dry kibble (weight management)" />
              </div>

              {/* Quantities */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[var(--text-secondary)] mb-1 block" style={{ fontSize: 12, fontWeight: 600 }}>Daily amount</label>
                  <Input value={fDaily} onChange={(e) => setFDaily(e.target.value)} placeholder="280g / day" />
                </div>
                <div>
                  <label className="text-[var(--text-secondary)] mb-1 block" style={{ fontSize: 12, fontWeight: 600 }}>Meals</label>
                  <Input value={fMeals} onChange={(e) => setFMeals(e.target.value)} placeholder="2 meals (AM + PM)" />
                </div>
                <div>
                  <label className="text-[var(--text-secondary)] mb-1 block" style={{ fontSize: 12, fontWeight: 600 }}>Calories</label>
                  <Input value={fCalories} onChange={(e) => setFCalories(e.target.value)} placeholder="950 kcal/day" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-[var(--text-secondary)] mb-1 block" style={{ fontSize: 12, fontWeight: 600 }}>Water</label>
                  <Input value={fWater} onChange={(e) => setFWater(e.target.value)} placeholder="Fresh water at all times" />
                </div>
                <div>
                  <label className="text-[var(--text-secondary)] mb-1 block" style={{ fontSize: 12, fontWeight: 600 }}>Started on</label>
                  <Input type="date" value={fStarted} onChange={(e) => setFStarted(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="text-[var(--text-secondary)] mb-1 block" style={{ fontSize: 12, fontWeight: 600 }}>Target weight (kg)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={fTarget}
                  onChange={(e) => setFTarget(e.target.value)}
                  placeholder="29"
                />
              </div>

              <div>
                <label className="text-[var(--text-secondary)] mb-1 block" style={{ fontSize: 12, fontWeight: 600 }}>Treats</label>
                <Textarea
                  value={fTreats}
                  onChange={(e) => setFTreats(e.target.value)}
                  placeholder="Limit to <10% of daily calories…"
                  rows={2}
                />
              </div>

              <div>
                <label className="text-[var(--text-secondary)] mb-1 block" style={{ fontSize: 12, fontWeight: 600 }}>Notes</label>
                <Textarea
                  value={fNotes}
                  onChange={(e) => setFNotes(e.target.value)}
                  placeholder="Any additional dietary notes…"
                  rows={2}
                />
              </div>

              <Separator />

              {/* Restrictions editor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p style={{ fontSize: 13, fontWeight: 700 }}>Dietary restrictions</p>
                  <Button variant="outline" size="sm" onClick={addRestrictionRow}>
                    <Plus className="w-3.5 h-3.5" /> Add
                  </Button>
                </div>

                {fRestrictions.length === 0 ? (
                  <p className="text-[var(--text-secondary)]" style={{ fontSize: 12 }}>
                    No restrictions — click "Add" to list foods to avoid.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {fRestrictions.map((r, i) => (
                      <div
                        key={i}
                        className="grid gap-2 items-end border p-2.5"
                        style={{
                          gridTemplateColumns: '1.2fr 1.5fr 0.8fr auto',
                          borderRadius: 10,
                          borderColor: 'var(--border-color)',
                        }}
                      >
                        <div>
                          <label className="text-[var(--text-secondary)] mb-1 block" style={{ fontSize: 11, fontWeight: 600 }}>Item</label>
                          <Input
                            value={r.item}
                            onChange={(e) => updateRestrictionRow(i, { item: e.target.value })}
                            placeholder="Chicken"
                          />
                        </div>
                        <div>
                          <label className="text-[var(--text-secondary)] mb-1 block" style={{ fontSize: 11, fontWeight: 600 }}>Reason</label>
                          <Input
                            value={r.reason}
                            onChange={(e) => updateRestrictionRow(i, { reason: e.target.value })}
                            placeholder="Confirmed allergy"
                          />
                        </div>
                        <div>
                          <label className="text-[var(--text-secondary)] mb-1 block" style={{ fontSize: 11, fontWeight: 600 }}>Severity</label>
                          <Select
                            value={r.severity}
                            onValueChange={(v) => updateRestrictionRow(i, { severity: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="strict">Strict</SelectItem>
                              <SelectItem value="moderate">Moderate</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <button
                          onClick={() => removeRestrictionRow(i)}
                          className="text-[var(--text-secondary)] hover:text-[#d4183d] transition-colors p-2"
                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                          aria-label="Remove restriction"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !fName.trim()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Log Weight Dialog ─────────────────────────────── */}
      <Dialog open={weightDialogOpen} onOpenChange={setWeightDialogOpen}>
        <DialogContent style={{ maxWidth: 440, width: '95vw' }}>
          <DialogHeader>
            <DialogTitle>Log Weight</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-[var(--text-secondary)] mb-1 block" style={{ fontSize: 12, fontWeight: 600 }}>Weight (kg)</label>
              <Input
                type="number"
                step="0.1"
                value={wKg}
                onChange={(e) => setWKg(e.target.value)}
                placeholder="31.2"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[var(--text-secondary)] mb-1 block" style={{ fontSize: 12, fontWeight: 600 }}>Date</label>
              <Input type="date" value={wDate} onChange={(e) => setWDate(e.target.value)} />
            </div>
            <div>
              <label className="text-[var(--text-secondary)] mb-1 block" style={{ fontSize: 12, fontWeight: 600 }}>Notes (optional)</label>
              <Input value={wNotes} onChange={(e) => setWNotes(e.target.value)} placeholder="Weigh-in at routine checkup" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWeightDialogOpen(false)} disabled={weightSaving}>
              Cancel
            </Button>
            <Button onClick={handleLogWeight} disabled={weightSaving || !wKg || Number(wKg) <= 0}>
              {weightSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {weightSaving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── PHOTOS TAB ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

type PetPhotoRow = {
  id: string;
  pet_id: string;
  title: string;
  caption: string | null;
  category: string; // 'clinical' | 'progress' | 'general'
  tags: string[] | null;
  photo_date: string;
  file_url: string;
  storage_path: string;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
};

export function PhotosTab({
  petName,
  petImage: _petImage,
  petDbId,
  readOnly = false,
}: {
  petName: string;
  petImage: string;
  petDbId: string;
  readOnly?: boolean;
}) {
  const db = useTenantDb();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<PetPhotoRow[]>([]);
  const [activeCategory, setActiveCategory] = useState<'all' | 'clinical' | 'progress' | 'general'>('all');

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uTitle, setUTitle] = useState('');
  const [uCaption, setUCaption] = useState('');
  const [uCategory, setUCategory] = useState<'clinical' | 'progress' | 'general'>('general');
  const [uTags, setUTags] = useState('');
  const [uDate, setUDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [uploading, setUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Viewer dialog
  const [viewerPhoto, setViewerPhoto] = useState<PetPhotoRow | null>(null);

  const loadPhotos = useCallback(async () => {
    if (!petDbId) { setPhotos([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await db
      .from('pet_photos')
      .select('id, pet_id, title, caption, category, tags, photo_date, file_url, storage_path, file_name, file_type, file_size, created_at')
      .eq('pet_id', petDbId)
      .order('photo_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Failed to load photos:', error);
      setPhotos([]);
    } else {
      setPhotos((data as PetPhotoRow[]) || []);
    }
    setLoading(false);
  }, [db, petDbId]);

  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) await loadPhotos(); })();
    return () => { cancelled = true; };
  }, [loadPhotos]);

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadPreview(null);
    setUTitle('');
    setUCaption('');
    setUCategory('general');
    setUTags('');
    setUDate(new Date().toISOString().slice(0, 10));
    if (uploadInputRef.current) uploadInputRef.current.value = '';
  };

  const openUpload = () => {
    resetUploadForm();
    setUploadOpen(true);
    // Open native file picker shortly after dialog mounts
    setTimeout(() => uploadInputRef.current?.click(), 100);
  };

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setUploadFile(file);
    setUploadPreview(URL.createObjectURL(file));
    if (!uTitle) {
      // Prefill title from filename (without extension)
      const base = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
      setUTitle(base.charAt(0).toUpperCase() + base.slice(1));
    }
  };

  const handleUploadSave = async () => {
    if (!petDbId || !uploadFile || !uTitle.trim()) return;
    setUploading(true);
    try {
      const { organizationId, clinicId } = await getOrgContext();

      // Resolve staff id for uploaded_by
      let staffId: string | null = null;
      if (user?.id) {
        const { data: staffRow } = await db
          .from('staff')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('profile_id', user.id)
          .maybeSingle();
        staffId = (staffRow as any)?.id || null;
      }

      // Upload to storage
      const ext = uploadFile.name.split('.').pop() || 'jpg';
      const path = `${petDbId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('pet-photos')
        .upload(path, uploadFile, { contentType: uploadFile.type });
      if (upErr) {
        console.error('Photo upload failed:', upErr);
        alert('Could not upload image — see console for details.');
        return;
      }
      const { data: urlData } = supabase.storage.from('pet-photos').getPublicUrl(path);

      // Insert DB row
      const tagsArr = uTags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const { error: insErr } = await db.from('pet_photos').insert({
        organization_id: organizationId,
        clinic_id: clinicId || null,
        pet_id: petDbId,
        title: uTitle.trim(),
        caption: uCaption.trim() || null,
        category: uCategory,
        tags: tagsArr.length ? tagsArr : null,
        photo_date: uDate,
        file_url: urlData.publicUrl,
        storage_path: path,
        file_name: uploadFile.name,
        file_type: uploadFile.type,
        file_size: uploadFile.size,
        uploaded_by: staffId,
      });

      if (insErr) {
        console.error('Failed to insert photo row:', insErr);
        // Clean up orphaned storage file
        await supabase.storage.from('pet-photos').remove([path]);
        alert('Could not save photo — see console for details.');
        return;
      }

      setUploadOpen(false);
      resetUploadForm();
      await loadPhotos();
      requestPetReport(petDbId, 'photo');
    } catch (e) {
      console.error('Save photo error:', e);
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (p: PetPhotoRow) => {
    if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    try {
      await supabase.storage.from('pet-photos').remove([p.storage_path]);
    } catch (e) {
      console.error('Photo storage delete failed:', e);
    }
    const { error } = await db.from('pet_photos').delete().eq('id', p.id);
    if (error) {
      console.error('Failed to delete photo row:', error);
      return;
    }
    if (viewerPhoto?.id === p.id) setViewerPhoto(null);
    await loadPhotos();
  };

  const handleDownload = (p: PetPhotoRow) => {
    // Open the public URL in a new tab — user can save-as from there
    window.open(p.file_url, '_blank', 'noopener,noreferrer');
  };

  const filtered = activeCategory === 'all' ? photos : photos.filter(p => p.category === activeCategory);

  const categoryColors: Record<string, { bg: string; text: string; label: string }> = {
    clinical: { bg: '#8B5CF615', text: '#8B5CF6', label: 'Clinical' },
    progress: { bg: '#74C69D15', text: 'var(--brand-green-text)', label: 'Progress' },
    general: { bg: '#3B82F615', text: '#3B82F6', label: 'General' },
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <div className="space-y-6">
      <SectionCard
        title="Photo Gallery"
        subtitle={`${photos.length} photo${photos.length === 1 ? '' : 's'} for ${petName}`}
        icon={Image}
        iconColor="#3B82F6"
        action={
          !readOnly ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={openUpload} disabled={!petDbId}>
                <Upload className="w-4 h-4" /> Upload Photo
              </Button>
            </div>
          ) : undefined
        }
      >
        {loading ? (
          <div className="py-20 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--text-secondary)]" />
          </div>
        ) : photos.length === 0 ? (
          <EmptyState
            icon={FileImage}
            title="No photos yet"
            description={
              readOnly
                ? `No photos have been uploaded for ${petName} yet.`
                : `Upload photos to keep a visual record of ${petName}'s treatments and progress.`
            }
            action={
              !readOnly ? (
                <Button size="sm" onClick={openUpload} disabled={!petDbId}>
                  <Upload className="w-4 h-4" /> Upload Photo
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Category filter */}
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              {[
                { key: 'all', label: 'All Photos', count: photos.length },
                { key: 'clinical', label: 'Clinical', count: photos.filter(p => p.category === 'clinical').length },
                { key: 'progress', label: 'Progress', count: photos.filter(p => p.category === 'progress').length },
                { key: 'general', label: 'General', count: photos.filter(p => p.category === 'general').length },
              ].map((c) => {
                const isActive = activeCategory === c.key;
                return (
                  <button
                    key={c.key}
                    onClick={() => setActiveCategory(c.key as any)}
                    className="px-3 py-1.5 transition-all"
                    style={{
                      borderRadius: '9999px',
                      fontSize: 13,
                      fontWeight: isActive ? 700 : 500,
                      backgroundColor: isActive ? 'var(--brand-green-text)' : 'var(--surface-elevated)',
                      color: isActive ? '#fff' : 'var(--text-secondary)',
                      border: isActive ? 'none' : '1px solid var(--border-color)',
                      cursor: 'pointer',
                    }}
                  >
                    {c.label}
                    <span className="ml-1.5" style={{ opacity: 0.7 }}>{c.count}</span>
                  </button>
                );
              })}
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={FileImage}
                title="No photos in this category"
                description={readOnly ? "No photos in this category yet." : "Upload more photos or switch categories."}
                action={
                  !readOnly ? (
                    <Button size="sm" onClick={openUpload} disabled={!petDbId}>
                      <Upload className="w-4 h-4" /> Upload Photo
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {filtered.map((p) => {
                  const cat = categoryColors[p.category] || categoryColors.general;
                  return (
                    <div
                      key={p.id}
                      className="group cursor-pointer border border-[var(--border-color)] overflow-hidden transition-all hover:border-[var(--brand-green-text)]"
                      style={{ borderRadius: '12px' }}
                      onClick={() => setViewerPhoto(p)}
                    >
                      <div className="relative" style={{ paddingBottom: '75%', backgroundColor: 'var(--surface-elevated)' }}>
                        <img
                          src={p.file_url}
                          alt={p.title}
                          className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div
                          className="absolute top-2 left-2 px-2 py-0.5"
                          style={{
                            backgroundColor: cat.bg,
                            color: cat.text,
                            borderRadius: '9999px',
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            border: `1px solid ${cat.text}30`,
                            backdropFilter: 'blur(4px)',
                          }}
                        >
                          {cat.label}
                        </div>
                        <div
                          className="absolute inset-0 flex items-end justify-end opacity-0 group-hover:opacity-100 transition-opacity p-2 gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            className="w-8 h-8 flex items-center justify-center"
                            style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, border: 'none', cursor: 'pointer' }}
                            onClick={(e) => { e.stopPropagation(); setViewerPhoto(p); }}
                            aria-label="View photo"
                          >
                            <Eye className="w-3.5 h-3.5" style={{ color: '#fff' }} />
                          </button>
                          <button
                            className="w-8 h-8 flex items-center justify-center"
                            style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, border: 'none', cursor: 'pointer' }}
                            onClick={(e) => { e.stopPropagation(); handleDownload(p); }}
                            aria-label="Open full-size photo"
                          >
                            <Download className="w-3.5 h-3.5" style={{ color: '#fff' }} />
                          </button>
                          {!readOnly && (
                            <button
                              className="w-8 h-8 flex items-center justify-center"
                              style={{ backgroundColor: 'rgba(212,24,61,0.75)', borderRadius: 8, border: 'none', cursor: 'pointer' }}
                              onClick={(e) => { e.stopPropagation(); handleDeletePhoto(p); }}
                              aria-label="Delete photo"
                            >
                              <Trash2 className="w-3.5 h-3.5" style={{ color: '#fff' }} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="p-3">
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }} className="truncate">{p.title}</p>
                        <p className="text-[var(--text-secondary)] mt-0.5" style={{ fontSize: 11 }}>{formatDate(p.photo_date)}</p>
                        {p.caption && (
                          <p className="text-[var(--text-secondary)] mt-1 line-clamp-2" style={{ fontSize: 12, lineHeight: 1.4 }}>
                            {p.caption}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </SectionCard>

      {/* Hidden file input — triggered from upload button */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFilePicked}
      />

      {/* ─── Upload Photo Dialog ─────────────────────────────── */}
      <Dialog open={uploadOpen} onOpenChange={(o) => { setUploadOpen(o); if (!o) resetUploadForm(); }}>
        <DialogContent
          style={{ maxWidth: 560, width: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Upload Photo</DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto pr-1" style={{ flex: 1 }}>
            <div className="space-y-4">
              {/* Preview / picker */}
              {uploadPreview ? (
                <div
                  className="relative border border-[var(--border-color)]"
                  style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: 'var(--surface-elevated)' }}
                >
                  <img
                    src={uploadPreview}
                    alt="Preview"
                    style={{ width: '100%', maxHeight: 280, objectFit: 'contain', display: 'block' }}
                  />
                  <button
                    className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, border: 'none', cursor: 'pointer' }}
                    onClick={() => {
                      setUploadFile(null);
                      setUploadPreview(null);
                      if (uploadInputRef.current) uploadInputRef.current.value = '';
                    }}
                    aria-label="Remove photo"
                  >
                    <X className="w-4 h-4" style={{ color: '#fff' }} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => uploadInputRef.current?.click()}
                  className="w-full py-10 border border-dashed border-[var(--border-color)] flex flex-col items-center justify-center gap-2 transition-colors hover:border-[var(--brand-green-text)]"
                  style={{ borderRadius: 12, backgroundColor: 'var(--surface-elevated)', cursor: 'pointer' }}
                >
                  <Upload className="w-6 h-6 text-[var(--text-secondary)]" />
                  <p style={{ fontSize: 13, fontWeight: 600 }}>Click to pick an image</p>
                  <p className="text-[var(--text-secondary)]" style={{ fontSize: 11 }}>JPG, PNG, WebP, etc.</p>
                </button>
              )}

              {/* Metadata */}
              <div>
                <label className="text-[var(--text-secondary)] mb-1 block" style={{ fontSize: 12, fontWeight: 600 }}>Title</label>
                <Input
                  value={uTitle}
                  onChange={(e) => setUTitle(e.target.value)}
                  placeholder="Hip dysplasia x-ray comparison"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[var(--text-secondary)] mb-1 block" style={{ fontSize: 12, fontWeight: 600 }}>Category</label>
                  <Select value={uCategory} onValueChange={(v) => setUCategory(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clinical">Clinical</SelectItem>
                      <SelectItem value="progress">Progress</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[var(--text-secondary)] mb-1 block" style={{ fontSize: 12, fontWeight: 600 }}>Date</label>
                  <Input type="date" value={uDate} onChange={(e) => setUDate(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="text-[var(--text-secondary)] mb-1 block" style={{ fontSize: 12, fontWeight: 600 }}>Caption</label>
                <Textarea
                  value={uCaption}
                  onChange={(e) => setUCaption(e.target.value)}
                  placeholder="Short description shown under the photo…"
                  rows={2}
                />
              </div>

              <div>
                <label className="text-[var(--text-secondary)] mb-1 block" style={{ fontSize: 12, fontWeight: 600 }}>Tags (comma-separated)</label>
                <Input
                  value={uTags}
                  onChange={(e) => setUTags(e.target.value)}
                  placeholder="x-ray, hips, diagnostic"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleUploadSave} disabled={uploading || !uploadFile || !uTitle.trim()}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {uploading ? 'Uploading…' : 'Save Photo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Viewer Dialog ─────────────────────────────── */}
      <Dialog open={!!viewerPhoto} onOpenChange={(o) => { if (!o) setViewerPhoto(null); }}>
        <DialogContent
          className="p-0 gap-0 overflow-hidden"
          style={{ maxWidth: 900, width: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
        >
          {viewerPhoto && (() => {
            const cat = categoryColors[viewerPhoto.category] || categoryColors.general;
            return (
              <>
                <DialogHeader className="px-5 pt-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <DialogTitle className="truncate">{viewerPhoto.title}</DialogTitle>
                      <p className="text-[var(--text-secondary)] mt-0.5" style={{ fontSize: 12 }}>
                        {formatDate(viewerPhoto.photo_date)}
                      </p>
                    </div>
                    <span
                      className="inline-block px-2 py-0.5 flex-shrink-0"
                      style={{
                        backgroundColor: cat.bg,
                        color: cat.text,
                        borderRadius: '9999px',
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        border: `1px solid ${cat.text}30`,
                      }}
                    >
                      {cat.label}
                    </span>
                  </div>
                </DialogHeader>

                <div
                  className="flex items-center justify-center"
                  style={{ backgroundColor: '#000', flex: 1, minHeight: 300, maxHeight: '65vh', overflow: 'hidden' }}
                >
                  <img
                    src={viewerPhoto.file_url}
                    alt={viewerPhoto.title}
                    style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain' }}
                  />
                </div>

                <div className="px-5 py-4 space-y-3">
                  {viewerPhoto.caption && (
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      {viewerPhoto.caption}
                    </p>
                  )}
                  {viewerPhoto.tags && viewerPhoto.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {viewerPhoto.tags.map((t, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5"
                          style={{
                            backgroundColor: 'var(--surface-elevated)',
                            borderRadius: '9999px',
                            fontSize: 11,
                            fontWeight: 500,
                            color: 'var(--text-secondary)',
                          }}
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => handleDownload(viewerPhoto)}>
                      <Download className="w-4 h-4" /> Open Full-size
                    </Button>
                    {!readOnly && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeletePhoto(viewerPhoto)}
                        style={{ color: '#d4183d', borderColor: '#d4183d40' }}
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </Button>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── PET REPORTS TAB (list of generated PDF snapshots) ─────────
// ═══════════════════════════════════════════════════════════════

type PetReportRow = {
  id: string;
  pet_id: string;
  title: string;
  summary: string | null;
  trigger_source: ReportSource;
  sections_count: number | null;
  file_url: string;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  generated_by: string | null;
  created_at: string;
  generator?: {
    profiles?: { first_name: string | null; last_name: string | null } | null;
  } | null;
};

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PetReportsTab({
  petName,
  petDbId,
  readOnly = false,
}: {
  petName: string;
  petDbId: string;
  readOnly?: boolean;
}) {
  const db = useTenantDb();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<PetReportRow[]>([]);
  const [generating, setGenerating] = useState(false);
  const [viewerReport, setViewerReport] = useState<PetReportRow | null>(null);

  const loadReports = useCallback(async () => {
    if (!petDbId) { setReports([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await db
      .from('pet_reports')
      .select(`
        id, pet_id, title, summary, trigger_source, sections_count,
        file_url, storage_path, file_name, file_size, generated_by, created_at,
        generator:staff!pet_reports_generated_by_fkey(
          profiles:profiles!staff_profile_id_fkey(first_name, last_name)
        )
      `)
      .eq('pet_id', petDbId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Failed to load pet reports:', error);
      setReports([]);
    } else {
      setReports((data as any[] as PetReportRow[]) || []);
    }
    setLoading(false);
  }, [db, petDbId]);

  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) await loadReports(); })();
    return () => { cancelled = true; };
  }, [loadReports]);

  // Refresh list whenever a report is generated by any other tab
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.petDbId === petDbId) {
        loadReports();
      }
    };
    window.addEventListener('petReportCreated', handler as EventListener);
    return () => window.removeEventListener('petReportCreated', handler as EventListener);
  }, [petDbId, loadReports]);

  const handleGenerateNow = async () => {
    if (!petDbId || generating) return;
    setGenerating(true);
    try {
      const { organizationId, clinicId } = await getOrgContext();

      // Resolve current staff id + name for generated_by
      let staffId: string | null = null;
      let staffName: string | undefined;
      if (user?.id) {
        const { data: staffRow } = await db
          .from('staff')
          .select('id, profiles:profiles!staff_profile_id_fkey(first_name, last_name)')
          .eq('organization_id', organizationId)
          .eq('profile_id', user.id)
          .maybeSingle();
        staffId = (staffRow as any)?.id || null;
        const p = (staffRow as any)?.profiles;
        if (p) staffName = `Dr. ${p.first_name || ''} ${p.last_name || ''}`.trim();
      }

      const result = await generateAndUploadPetReport(
        db,
        supabase,
        petDbId,
        'manual',
        {
          organizationId,
          clinicId: clinicId || null,
          generatedByStaffId: staffId,
          generatedByName: staffName,
        }
      );

      if (!result.ok) {
        console.error('Generate report failed:', result.error);
        alert('Could not generate report — see console for details.');
        return;
      }
      await loadReports();
    } catch (e) {
      console.error('Generate report error:', e);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteReport = async (r: PetReportRow) => {
    if (!confirm(`Delete this snapshot PDF? This cannot be undone.`)) return;
    try {
      await supabase.storage.from('pet-reports').remove([r.storage_path]);
    } catch (e) {
      console.error('Report storage delete failed:', e);
    }
    const { error } = await db.from('pet_reports').delete().eq('id', r.id);
    if (error) {
      console.error('Failed to delete report row:', error);
      return;
    }
    await loadReports();
  };

  const fmtDateTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  };

  const totalSize = reports.reduce((acc, r) => acc + (r.file_size || 0), 0);

  return (
    <div className="space-y-6">
      <SectionCard
        title="Report Snapshots"
        subtitle={
          readOnly
            ? `PDF snapshots of ${petName}'s medical record. Download any report to view it.`
            : `Auto-generated PDF snapshots for ${petName}. A new PDF is created every time you log data in any tab.`
        }
        icon={FileText}
        iconColor="#2D6A4F"
        action={
          !readOnly ? (
            <Button size="sm" onClick={handleGenerateNow} disabled={!petDbId || generating}>
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              {generating ? 'Generating…' : 'Generate Snapshot Now'}
            </Button>
          ) : undefined
        }
      >
        {/* Quick stats */}
        {!loading && reports.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <StatTile label="Total Reports" value={reports.length} />
            <StatTile
              label="Most Recent"
              value={reports[0] ? new Date(reports[0].created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
              sub={reports[0] ? SOURCE_LABELS[reports[0].trigger_source] : undefined}
            />
            <StatTile label="Total Size" value={formatBytes(totalSize)} />
            <StatTile
              label="Auto-generated"
              value={reports.filter(r => r.trigger_source !== 'manual').length}
              sub={`${reports.filter(r => r.trigger_source === 'manual').length} manual`}
            />
          </div>
        )}

        {loading ? (
          <div className="py-20 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--text-secondary)]" />
          </div>
        ) : reports.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No snapshots yet"
            description={
              readOnly
                ? `No PDF snapshots have been generated for ${petName} yet.`
                : `Log any data in the other tabs and a fresh PDF snapshot of ${petName}'s full record will appear here automatically. You can also generate one manually.`
            }
            action={
              !readOnly ? (
                <Button size="sm" onClick={handleGenerateNow} disabled={!petDbId || generating}>
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                  {generating ? 'Generating…' : 'Generate Snapshot Now'}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-2">
            {reports.map((r) => {
              const color = SOURCE_COLORS[r.trigger_source] || '#6B7280';
              const label = SOURCE_LABELS[r.trigger_source] || r.trigger_source;
              const generatorName = r.generator?.profiles
                ? `Dr. ${r.generator.profiles.first_name || ''} ${r.generator.profiles.last_name || ''}`.trim()
                : null;

              return (
                <div
                  key={r.id}
                  className="border border-[var(--border-color)] flex items-start gap-4 px-4 py-3.5 transition-colors hover:border-[var(--brand-green-text)]"
                  style={{ borderRadius: '10px', backgroundColor: 'var(--surface-white)' }}
                >
                  {/* PDF icon */}
                  <div
                    className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                    style={{ borderRadius: '10px', backgroundColor: '#EF444415' }}
                  >
                    <FileText className="w-5 h-5" style={{ color: '#EF4444' }} />
                  </div>

                  {/* Main content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p
                        className="text-[var(--text-primary)] truncate"
                        style={{ fontSize: 14, fontWeight: 600 }}
                      >
                        {r.title}
                      </p>
                      <span
                        className="inline-flex items-center px-2 py-0.5 flex-shrink-0"
                        style={{
                          backgroundColor: `${color}15`,
                          color: color,
                          borderRadius: '9999px',
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                          border: `1px solid ${color}30`,
                        }}
                      >
                        {label}
                      </span>
                    </div>
                    {r.summary && (
                      <p
                        className="text-[var(--text-secondary)] mb-1 line-clamp-2"
                        style={{ fontSize: 12, lineHeight: 1.45 }}
                      >
                        {r.summary}
                      </p>
                    )}
                    <div
                      className="flex items-center gap-2 flex-wrap text-[var(--text-secondary)]"
                      style={{ fontSize: 11 }}
                    >
                      <span>{fmtDateTime(r.created_at)}</span>
                      <span style={{ opacity: 0.4 }}>·</span>
                      <span>{formatBytes(r.file_size)}</span>
                      {r.sections_count != null && (
                        <>
                          <span style={{ opacity: 0.4 }}>·</span>
                          <span>{r.sections_count} section{r.sections_count === 1 ? '' : 's'}</span>
                        </>
                      )}
                      {generatorName && (
                        <>
                          <span style={{ opacity: 0.4 }}>·</span>
                          <span>by {generatorName}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setViewerReport(r)}
                      className="inline-flex items-center justify-center"
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-secondary)',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                      }}
                      title="Open PDF"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open(r.file_url, '_blank', 'noopener,noreferrer')}
                      className="inline-flex items-center justify-center"
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-secondary)',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                      }}
                      title="Download PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => handleDeleteReport(r)}
                        className="inline-flex items-center justify-center"
                        style={{
                          width: 32, height: 32, borderRadius: 8,
                          border: '1px solid #d4183d40',
                          color: '#d4183d',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                        }}
                        title="Delete snapshot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ─── Inline PDF Viewer Dialog ─────────────────────────── */}
      <Dialog open={!!viewerReport} onOpenChange={(o) => { if (!o) setViewerReport(null); }}>
        <DialogContent
          className="p-0 gap-0 overflow-hidden"
          style={{ maxWidth: 1000, width: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
        >
          {viewerReport && (() => {
            const color = SOURCE_COLORS[viewerReport.trigger_source] || '#6B7280';
            const label = SOURCE_LABELS[viewerReport.trigger_source] || viewerReport.trigger_source;
            return (
              <>
                <DialogHeader className="px-5 pt-5 pb-3">
                  <div className="flex items-start justify-between gap-3 pr-8">
                    <div className="min-w-0 flex-1">
                      <DialogTitle className="truncate">{viewerReport.title}</DialogTitle>
                      <p className="text-[var(--text-secondary)] mt-0.5" style={{ fontSize: 12 }}>
                        {fmtDateTime(viewerReport.created_at)} · {formatBytes(viewerReport.file_size)}
                      </p>
                    </div>
                    <span
                      className="inline-block px-2 py-0.5 flex-shrink-0"
                      style={{
                        backgroundColor: `${color}15`,
                        color: color,
                        borderRadius: '9999px',
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        border: `1px solid ${color}30`,
                      }}
                    >
                      {label}
                    </span>
                  </div>
                </DialogHeader>

                <div
                  className="flex-1"
                  style={{ backgroundColor: '#1a1a1a', minHeight: 400, overflow: 'hidden' }}
                >
                  <iframe
                    src={viewerReport.file_url}
                    title={viewerReport.title}
                    style={{ width: '100%', height: '70vh', border: 'none', backgroundColor: '#fff' }}
                  />
                </div>

                <div className="px-5 py-4 flex items-center justify-end gap-2 border-t border-[var(--border-color)]">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(viewerReport.file_url, '_blank', 'noopener,noreferrer')}
                  >
                    <Download className="w-4 h-4" /> Open in new tab
                  </Button>
                  {!readOnly && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleDeleteReport(viewerReport);
                        setViewerReport(null);
                      }}
                      style={{ color: '#d4183d', borderColor: '#d4183d40' }}
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </Button>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
