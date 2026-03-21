import { useState, useRef, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams, useLocation } from 'react-router';
import { supabase } from '../../lib/supabase';
import {
  ArrowLeft, Edit2, MoreHorizontal, Plus, Save, X, Printer, Archive, Trash2, FileDown, PawPrint,
  Mail, Phone, MapPin, Shield, AlertCircle, Check, PlusCircle,
  Calendar, Clock, Syringe, ChevronRight,
  CheckCircle2, AlertTriangle, ChevronDown, Camera, Loader2,
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

const DISEASES_DB = [
  'Canine Parvovirus', 'Kennel Cough', 'Lyme Disease', 'Rabies',
  'Distemper', 'Heartworm', 'Hip Dysplasia', 'Arthritis',
  'Diabetes Mellitus', 'Hypothyroidism', 'Cushing\'s Disease',
  'Feline Leukemia', 'Feline Immunodeficiency Virus', 'Pancreatitis',
  'Urinary Tract Infection', 'Ear Infection', 'Dermatitis',
  'Gastroenteritis', 'Dental Disease', 'Obesity',
];

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

const conditionStatusColors: Record<string, { bg: string; text: string }> = {
  active: { bg: '#F4A26120', text: '#F4A261' },
  resolved: { bg: '#74C69D20', text: 'var(--brand-green-text)' },
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
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  const clientsPath = isAdmin ? '/admin/clients' : '/clients';
  const appointmentsPath = isAdmin ? '/admin/bookings' : '/appointments';
  const [searchParams] = useSearchParams();

  // Fetch real client from Supabase, fall back to mock
  const [client, setClient] = useState(mockClient);
  const [dbLoaded, setDbLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: c } = await supabase
        .from('clients')
        .select('id, first_name, last_name, email, phone, address, city, state, zip, notes, portal_status, health_status, created_at, pets(id, name, species, breed, date_of_birth, sex, weight_kg, microchip_no, photo_url, assigned_vet_id, assigned_vet:staff!pets_assigned_vet_id_fkey(id, first_name, last_name))')
        .eq('id', id)
        .single();
      if (c) {
        const petIds = (c.pets as any[] || []).map((p: any) => p.id);
        // Fetch allergies and conditions for all pets
        const [allergiesRes, conditionsRes, treatmentsRes, appointmentsRes] = await Promise.all([
          petIds.length > 0 ? supabase.from('pet_allergies').select('*').in('pet_id', petIds) : { data: [] },
          petIds.length > 0 ? supabase.from('pet_conditions').select('*').in('pet_id', petIds) : { data: [] },
          petIds.length > 0 ? supabase.from('pet_treatments').select('*').in('pet_id', petIds).order('date', { ascending: false }) : { data: [] },
          petIds.length > 0 ? supabase.from('appointments').select('id, pet_id, scheduled_at, duration_minutes, status, reason, staff!appointments_vet_id_fkey(first_name, last_name)').in('pet_id', petIds).gte('scheduled_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()).order('scheduled_at', { ascending: true }) : { data: [] },
        ]);
        const petAllergies = (allergiesRes.data || []) as any[];
        const petConditions = (conditionsRes.data || []) as any[];
        const petTreatments = (treatmentsRes.data || []) as any[];
        const petAppointments = (appointmentsRes.data || []) as any[];

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
          assignedVet: p.assigned_vet ? `Dr. ${p.assigned_vet.first_name} ${p.assigned_vet.last_name}` : '—',
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
              let h = dt.getUTCHours(); const m = dt.getUTCMinutes();
              const ampm = h >= 12 ? 'PM' : 'AM';
              if (h > 12) h -= 12; if (h === 0) h = 12;
              return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
            };
            return {
              id: ai + 1,
              time: fmtTime(d),
              date: d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }),
              reason: a.reason || a.status || 'Appointment',
            };
          }),
          vaccinations: [] as { id: number; name: string; status: 'Up to date' | 'Due soon' | 'Overdue'; lastGiven: string; nextDue: string }[],
        }));
        const addr = [c.address, c.city, c.state, c.zip].filter(Boolean).join(', ');
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
    })();
  }, [id]);

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
      const { data } = await supabase
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
        const { error: uploadErr } = await supabase.storage.from('pet-photos').upload(path, addPetPhoto, { upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('pet-photos').getPublicUrl(path);
          photoUrl = urlData.publicUrl;
        }
      }
      const { error: petErr } = await supabase.from('pets').insert([{
        client_id: id,
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
        const { data: c } = await supabase
          .from('clients')
          .select('id, first_name, last_name, email, phone, address, city, state, zip, notes, portal_status, health_status, created_at, pets(id, name, species, breed, date_of_birth, sex, weight_kg, microchip_no, photo_url, assigned_vet_id, assigned_vet:staff!pets_assigned_vet_id_fkey(id, first_name, last_name))')
          .eq('id', id)
          .single();
        if (c) {
          const petIds = (c.pets as any[] || []).map((p: any) => p.id);
          const [alRes, coRes, trRes, apRes] = await Promise.all([
            petIds.length > 0 ? supabase.from('pet_allergies').select('*').in('pet_id', petIds) : { data: [] },
            petIds.length > 0 ? supabase.from('pet_conditions').select('*').in('pet_id', petIds) : { data: [] },
            petIds.length > 0 ? supabase.from('pet_treatments').select('*').in('pet_id', petIds).order('date', { ascending: false }) : { data: [] },
            petIds.length > 0 ? supabase.from('appointments').select('id, pet_id, scheduled_at, duration_minutes, status, reason, staff!appointments_vet_id_fkey(first_name, last_name)').in('pet_id', petIds).gte('scheduled_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()).order('scheduled_at', { ascending: true }) : { data: [] },
          ]);
          const petAppts2 = (apRes.data || []) as any[];
          const pets = (c.pets as any[] || []).map((p: any, idx: number) => ({
            id: idx + 1, dbId: p.id as string, name: p.name || '—', species: p.species || '—', breed: p.breed || '—',
            dob: p.date_of_birth || '', age: p.date_of_birth ? `${Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} years` : '—',
            sex: p.sex || '—', weight: p.weight_kg ? `${p.weight_kg} kg` : '—', microchip: p.microchip_no || '—',
            color: '—', image: p.photo_url || '', assignedVet: p.assigned_vet ? `Dr. ${p.assigned_vet.first_name} ${p.assigned_vet.last_name}` : '—', status: ((['Healthy', 'Follow-up', 'Critical'].includes((c as any).health_status)) ? (c as any).health_status : 'Healthy') as 'Healthy' | 'Follow-up' | 'Critical',
            conditions: ((coRes.data as any[]) || []).filter((co: any) => co.pet_id === p.id).map((co: any) => ({ id: co.id, name: co.name, status: co.status || 'active', date: co.date_diagnosed || co.created_at?.split('T')[0] || '', notes: co.notes || '' })),
            treatments: ((trRes.data as any[]) || []).filter((t: any) => t.pet_id === p.id).map((t: any) => ({ id: t.id, name: t.name, date: t.date || '', vet: t.vet || '—', notes: t.notes || '' })),
            allergies: ((alRes.data as any[]) || []).filter((a: any) => a.pet_id === p.id).map((a: any) => a.name as string),
            visits: [] as any[], vetNotes: '', clientNotes: '',
            upcomingAppointments: petAppts2.filter((a: any) => a.pet_id === p.id).map((a: any, ai: number) => {
              const d = new Date(a.scheduled_at);
              const fmtTime = (dt: Date) => { let h = dt.getUTCHours(); const m = dt.getUTCMinutes(); const ampm = h >= 12 ? 'PM' : 'AM'; if (h > 12) h -= 12; if (h === 0) h = 12; return `${h}:${m.toString().padStart(2, '0')} ${ampm}`; };
              return { id: ai + 1, time: fmtTime(d), date: d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }), reason: a.reason || a.status || 'Appointment' };
            }),
            vaccinations: [] as any[],
          }));
          const addr = [c.address, c.city, c.state, c.zip].filter(Boolean).join(', ');
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

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const currentPet = client.pets[selectedPetIdx];
      const petDbId = currentPet?.dbId;

      // Save pet fields
      if (petDbId) {
        const weightVal = petWeight.replace(/\s*kg\s*/i, '').trim();
        const weightNum = weightVal ? parseFloat(weightVal) : null;
        await supabase.from('pets').update({
          name: petName !== '—' ? petName : null,
          species: petSpecies !== '—' ? petSpecies : null,
          breed: petBreed !== '—' ? petBreed : null,
          sex: petSex !== '—' ? petSex : 'Unknown',
          date_of_birth: petDob || null,
          weight_kg: (weightNum && !isNaN(weightNum)) ? weightNum : null,
          microchip_no: petMicrochip !== '—' ? petMicrochip : null,
        }).eq('id', petDbId);
      }

      // Save client/owner fields
      const nameParts = ownerName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      await supabase.from('clients').update({
        first_name: firstName,
        last_name: lastName,
        email: ownerEmail !== '—' ? ownerEmail : null,
        phone: ownerPhone !== '—' ? ownerPhone : null,
        address: ownerAddress !== '—' ? ownerAddress : null,
      }).eq('id', id);

    } catch (err) {
      console.error('Save error:', err);
    }
    setSaving(false);
    setEditing(false);
  };
  const [conditionOpen, setConditionOpen] = useState(false);
  const [conditionSearch, setConditionSearch] = useState('');
  const [conditions, setConditions] = useState(client.pets[0].conditions);
  const [expandedConditionId, setExpandedConditionId] = useState<any>(null);
  const [allergies, setAllergies] = useState(client.pets[0].allergies);
  const [allergyInput, setAllergyInput] = useState('');
  const [showAllergyInput, setShowAllergyInput] = useState(false);
  const [visitDialogOpen, setVisitDialogOpen] = useState(false);
  const [treatmentDialogOpen, setTreatmentDialogOpen] = useState(false);
  const [treatmentPopoverOpen, setTreatmentPopoverOpen] = useState(false);
  const [treatments, setTreatments] = useState(client.pets[0].treatments);
  const [newTreatmentName, setNewTreatmentName] = useState('');
  const [newTreatmentDate, setNewTreatmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTreatmentVet, setNewTreatmentVet] = useState('');
  const [newTreatmentNotes, setNewTreatmentNotes] = useState('');
  const [vetNotes, setVetNotes] = useState(client.pets[0].vetNotes);
  const [clientNotes, setClientNotes] = useState(client.pets[0].clientNotes);
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
      const { error: uploadErr } = await supabase.storage.from('pet-photos').upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('pet-photos').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      // Update the pet record in Supabase
      const pet = (client.pets as any[])[selectedPetIdx];
      if (pet) {
        // Find the real Supabase pet ID
        const { data: petsData } = await supabase
          .from('pets')
          .select('id')
          .eq('client_id', id)
          .order('created_at', { ascending: true });
        const realPetId = petsData?.[selectedPetIdx]?.id;
        if (realPetId) {
          await supabase.from('pets').update({ photo_url: publicUrl }).eq('id', realPetId);
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
    setConditions(p.conditions); setAllergies(p.allergies); setTreatments(p.treatments);
    setVetNotes(p.vetNotes); setClientNotes(p.clientNotes);
    setPatientStatus(p.status);
    setOwnerName(client.owner.name); setOwnerEmail(client.owner.email);
    setOwnerPhone(client.owner.phone); setOwnerAddress(client.owner.address);
    setEmergencyContact(client.owner.emergencyContact); setEmergencyPhone(client.owner.emergencyPhone);
    setInsProvider(client.insurance.provider); setInsPolicyNumber(client.insurance.policyNumber);
    setInsCoverageType(client.insurance.coverageType); setInsExpiry(client.insurance.expiryDate);
    setSelectedPetIdx(initialIdx);
  }, [dbLoaded, client]);
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
    setConditions(p.conditions);
    setAllergies(p.allergies);
    setTreatments(p.treatments);
    setVetNotes(p.vetNotes);
    setClientNotes(p.clientNotes);
    setPatientStatus(p.status);
    setActiveVaxDot(0);
    setEditing(false);
  };

  const handleAddCondition = async (name: string) => {
    const pet = client.pets[selectedPetIdx];
    const petDbId = pet?.dbId;
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (petDbId) {
      const { data } = await supabase.from('pet_conditions').insert({ pet_id: petDbId, name, status: 'active' }).select().single();
      setConditions([...conditions, { id: data?.id || Date.now(), name, dateDiagnosed: today, status: 'active' as const, notes: '' }]);
    } else {
      setConditions([...conditions, { id: Date.now(), name, dateDiagnosed: today, status: 'active' as const, notes: '' }]);
    }
    setConditionOpen(false);
    setConditionSearch('');
  };

  const handleAddAllergy = async () => {
    if (allergyInput.trim()) {
      const pet = client.pets[selectedPetIdx];
      const petDbId = pet?.dbId;
      const trimmed = allergyInput.trim();
      if (petDbId) {
        await supabase.from('pet_allergies').insert({ pet_id: petDbId, name: trimmed });
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
      await supabase.from('pet_allergies').delete().eq('pet_id', petDbId).eq('name', allergyName);
    }
    setAllergies(allergies.filter(a => a !== allergyName));
  };

  const handleToggleConditionStatus = async (conditionId: any) => {
    const cond = conditions.find(c => c.id === conditionId);
    if (!cond) return;
    const newStatus = cond.status === 'active' ? 'resolved' : 'active';
    await supabase.from('pet_conditions').update({ status: newStatus }).eq('id', conditionId);
    setConditions(conditions.map(c => c.id === conditionId ? { ...c, status: newStatus as 'active' | 'resolved' } : c));
  };

  const handleRemoveCondition = async (conditionId: any) => {
    await supabase.from('pet_conditions').delete().eq('id', conditionId);
    setConditions(conditions.filter(c => c.id !== conditionId));
    if (expandedConditionId === conditionId) setExpandedConditionId(null);
  };

  const handleConditionNotesChange = (conditionId: any, notes: string) => {
    setConditions(conditions.map(c => c.id === conditionId ? { ...c, notes } : c));
  };

  const handleConditionNotesSave = async (conditionId: any) => {
    const cond = conditions.find(c => c.id === conditionId);
    if (cond) {
      await supabase.from('pet_conditions').update({ notes: cond.notes }).eq('id', conditionId);
    }
  };

  const handleAddTreatment = async () => {
    if (!newTreatmentName.trim()) return;
    const pet = client.pets[selectedPetIdx];
    const petDbId = pet?.dbId;
    const dateFormatted = new Date(newTreatmentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (petDbId) {
      const { data } = await supabase.from('pet_treatments').insert({
        pet_id: petDbId, name: newTreatmentName.trim(), date: newTreatmentDate, vet: newTreatmentVet, notes: newTreatmentNotes,
      }).select().single();
      setTreatments([{ id: data?.id || Date.now(), name: newTreatmentName.trim(), date: dateFormatted, vet: newTreatmentVet, notes: newTreatmentNotes }, ...treatments]);
    } else {
      setTreatments([{ id: Date.now(), name: newTreatmentName.trim(), date: dateFormatted, vet: newTreatmentVet, notes: newTreatmentNotes }, ...treatments]);
    }
    setNewTreatmentName(''); setNewTreatmentDate(new Date().toISOString().split('T')[0]);
    setNewTreatmentVet(''); setNewTreatmentNotes('');
    setTreatmentDialogOpen(false);
  };

  const handleRemoveTreatment = async (treatmentId: any) => {
    await supabase.from('pet_treatments').delete().eq('id', treatmentId);
    setTreatments(treatments.filter(t => t.id !== treatmentId));
  };

  const filteredDiseases = DISEASES_DB.filter(
    (d) => d.toLowerCase().includes(conditionSearch.toLowerCase())
      && !conditions.some((c) => c.name === d)
  );

  if (!dbLoaded) {
    return (
      <div className="max-w-[1200px] mx-auto p-8 flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <Loader2 className="w-8 h-8 animate-spin text-[#2D6A4F]" />
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
                            await supabase.from('clients').update({ health_status: option.value }).eq('id', id);
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
          <Button
            variant={editing ? 'default' : 'outline'}
            onClick={() => editing ? handleSave() : setEditing(true)}
            disabled={saving}
          >
            {editing ? <><Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}</> : <><Edit2 className="w-4 h-4" /> Edit</>}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                // Export full client + pet info as JSON download
                const exportData = {
                  owner: { name: ownerName, email: ownerEmail, phone: ownerPhone, address: ownerAddress, emergencyContact, emergencyPhone },
                  insurance: { provider: insProvider, policyNumber: insPolicyNumber, coverageType: insCoverageType, expiryDate: insExpiry },
                  pets: client.pets.map(p => ({ name: p.name, species: p.species, breed: p.breed, dob: p.dob, age: p.age, sex: p.sex, weight: p.weight, microchip: p.microchip, assignedVet: p.assignedVet })),
                };
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${ownerName.replace(/\s+/g, '_')}_profile.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}>
                <FileDown className="w-4 h-4 mr-2" /> Export Full Info
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" /> Print Record</DropdownMenuItem>
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
                  await supabase.from('pets').delete().eq('id', currentPet.dbId);
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
                  await supabase.from('pets').delete().eq('client_id', id);
                  await supabase.from('clients').delete().eq('id', id);
                  navigate(clientsPath);
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete Client Profile
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ─── Tabs ───────────────────────────────────────── */}
      <Tabs defaultValue="overview">
        <div className="flex items-center justify-between mb-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="medical">Medical</TabsTrigger>
            <TabsTrigger value="visits">Visits</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>
          {/* ── Pet Switcher + Add Pet ── */}
          <div className="flex items-center gap-1.5">
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
                    backgroundColor: isSelected ? '#2D6A4F' : 'var(--surface-elevated)',
                    color: isSelected ? '#fff' : 'var(--text-secondary)',
                    border: isSelected ? 'none' : '1px solid var(--border-color)',
                    cursor: 'pointer',
                  }}
                >
                  <Avatar className="w-5 h-5 flex-shrink-0">
                    <AvatarImage src={pet.image} alt={pet.name} className="object-cover" />
                    <AvatarFallback style={{ fontSize: '8px' }}>{pet.name.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  {pet.name}
                </button>
              );
            })}
            <button
              onClick={() => setAddPetOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 transition-all hover:bg-[#2D6A4F10]"
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
                            setPetAssignedVet(v.name);
                            if (petDbId) {
                              await supabase.from('pets').update({ assigned_vet_id: v.id }).eq('id', petDbId);
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
                              setPetAssignedVet('—');
                              if (petDbId) {
                                await supabase.from('pets').update({ assigned_vet_id: null }).eq('id', petDbId);
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

        {/* ═══ MEDICAL TAB ═══ */}
        <TabsContent value="medical">
          {/* Conditions */}
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[var(--text-primary)]">Conditions & Diagnoses</h3>
              <Popover open={conditionOpen} onOpenChange={setConditionOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4" /> Add Condition
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="end">
                  <Command>
                    <CommandInput
                      placeholder="Search conditions..."
                      value={conditionSearch}
                      onValueChange={setConditionSearch}
                    />
                    <CommandList>
                      <CommandEmpty>
                        <p className="text-[var(--text-secondary)] text-sm p-2">No matching condition.</p>
                      </CommandEmpty>
                      <CommandGroup>
                        {filteredDiseases.map((disease) => (
                          <CommandItem
                            key={disease}
                            value={disease}
                            onSelect={() => handleAddCondition(disease)}
                          >
                            {disease}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      {conditionSearch.trim() && !filteredDiseases.includes(conditionSearch.trim()) && (
                        <div className="p-2 border-t border-[var(--border-color)]">
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => handleAddCondition(conditionSearch.trim())}
                          >
                            <PlusCircle className="w-4 h-4" />
                            Add "{conditionSearch.trim()}"
                          </Button>
                        </div>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {conditions.length === 0 ? (
              <p className="text-[var(--text-secondary)] py-4" style={{ fontSize: '14px' }}>No conditions on file.</p>
            ) : (
              <div className="space-y-3">
                {conditions.map((c) => {
                  const cs = conditionStatusColors[c.status];
                  const isExpanded = expandedConditionId === c.id;
                  return (
                    <div key={c.id} className="border border-[var(--border-color)] overflow-hidden transition-all" style={{ borderRadius: '8px' }}>
                      <div
                        className="flex items-center justify-between py-2 px-3 cursor-pointer hover:bg-[var(--surface-elevated)] transition-colors"
                        onClick={() => setExpandedConditionId(isExpanded ? null : c.id)}
                      >
                        <div className="flex items-center gap-3">
                          <ChevronDown
                            className="w-4 h-4 text-[var(--text-secondary)] transition-transform"
                            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                          />
                          <span className="text-[var(--text-primary)]" style={{ fontSize: '16px', fontWeight: 500 }}>{c.name}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleConditionStatus(c.id); }}
                            className="inline-block px-2 py-0.5 cursor-pointer hover:opacity-70 transition-opacity"
                            style={{ backgroundColor: cs.bg, color: cs.text, borderRadius: '9999px', fontSize: '12px', fontWeight: 600, border: 'none' }}
                          >
                            {c.status}
                          </button>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Diagnosed: {c.dateDiagnosed}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveCondition(c.id); }}
                            className="text-[var(--text-secondary)] hover:text-[#d4183d] transition-colors"
                            style={{ fontSize: '16px', lineHeight: 1 }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-1 border-t border-[var(--border-color)]">
                          <div className="grid grid-cols-2 gap-4 mb-3">
                            <div>
                              <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: '12px', fontWeight: 600 }}>STATUS</p>
                              <div className="flex gap-2">
                                {(['active', 'resolved'] as const).map((s) => {
                                  const sc = conditionStatusColors[s];
                                  const isCurrent = c.status === s;
                                  return (
                                    <button
                                      key={s}
                                      onClick={() => handleToggleConditionStatus(c.id)}
                                      className="px-3 py-1 transition-opacity"
                                      style={{
                                        backgroundColor: isCurrent ? sc.bg : 'var(--surface-elevated)',
                                        color: isCurrent ? sc.text : 'var(--text-secondary)',
                                        borderRadius: '6px', fontSize: '13px', fontWeight: isCurrent ? 600 : 400,
                                        border: isCurrent ? `1px solid ${sc.text}30` : '1px solid var(--border-color)',
                                      }}
                                    >
                                      {s}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div>
                              <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: '12px', fontWeight: 600 }}>DATE DIAGNOSED</p>
                              <p className="text-[var(--text-primary)]" style={{ fontSize: '14px' }}>{c.dateDiagnosed}</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: '12px', fontWeight: 600 }}>NOTES</p>
                            <Textarea
                              value={(c as any).notes || ''}
                              onChange={(e) => handleConditionNotesChange(c.id, e.target.value)}
                              onBlur={() => handleConditionNotesSave(c.id)}
                              placeholder="Add notes about this condition..."
                              className="min-h-16 text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Allergies */}
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-[#d4183d]" />
                <h3 className="text-[var(--text-primary)]">Allergies</h3>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowAllergyInput(!showAllergyInput)}>
                <Plus className="w-4 h-4" /> Add Allergy
              </Button>
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
              <Button variant="outline" size="sm" onClick={() => setTreatmentDialogOpen(true)}>
                <Plus className="w-4 h-4" /> Add Treatment
              </Button>
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
                    <TableHead className="py-3 px-4 w-10" />
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
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Upcoming Appointments + Vaccination History */}
          <div className="grid grid-cols-2 gap-6 mt-6">
            {/* Upcoming Appointments */}
            <div className="border border-[#2D6A4F30] bg-[var(--surface-white)] p-6" style={{ borderRadius: '12px' }}>
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
                      className="border border-[var(--border-color)] p-4 cursor-pointer hover:border-[#2D6A4F60] transition-colors"
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
                          style={{ backgroundColor: '#2D6A4F15', color: 'var(--brand-green-text)', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}
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
                className="w-full mt-4 border-[#2D6A4F] text-[var(--brand-green-text)] hover:bg-[#2D6A4F10]"
                onClick={() => navigate(appointmentsPath, { state: { openNewAppt: true } })}
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
                        borderColor: isUpToDate ? '#2D6A4F40' : '#F4A26180',
                        backgroundColor: isUpToDate ? '#2D6A4F08' : '#F4A26108',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-8 h-8 flex items-center justify-center"
                          style={{ borderRadius: '8px', backgroundColor: isUpToDate ? '#2D6A4F15' : '#F4A26115' }}
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
              <Button onClick={() => setVisitDialogOpen(true)}>
                <Plus className="w-4 h-4" /> Log Visit
              </Button>
            </div>

            <Accordion type="single" collapsible className="space-y-3">
              {client.pets[selectedPetIdx].visits.map((v) => (
                <AccordionItem key={v.id} value={`visit-${v.id}`} className="border border-[var(--border-color)] px-4" style={{ borderRadius: '8px' }}>
                  <AccordionTrigger className="py-4 hover:no-underline">
                    <div className="flex items-center gap-4 text-left flex-1 mr-4">
                      <span className="text-[var(--text-secondary)] w-28 flex-shrink-0" style={{ fontSize: '14px' }}>{v.date}</span>
                      <span className="text-[var(--text-primary)] flex-1" style={{ fontSize: '16px', fontWeight: 600 }}>{v.reason}</span>
                      <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{v.vet}</span>
                      <span
                        className="inline-block px-2 py-0.5 flex-shrink-0"
                        style={{ backgroundColor: '#74C69D20', color: 'var(--brand-green-text)', borderRadius: '9999px', fontSize: '12px', fontWeight: 600 }}
                      >
                        {v.status}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <Separator className="mb-4" />
                    <div className="space-y-3">
                      <div>
                        <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Summary</p>
                        <p className="text-[var(--text-primary)]" style={{ fontSize: '14px' }}>{v.summary}</p>
                      </div>
                      <div>
                        <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detailed Notes</p>
                        <p className="text-[var(--text-primary)]" style={{ fontSize: '14px', lineHeight: 1.6 }}>{v.notes}</p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {/* Log Visit Dialog */}
          <Dialog open={visitDialogOpen} onOpenChange={setVisitDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log Visit</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Date</label>
                  <Input type="date" defaultValue="2026-03-11" />
                </div>
                <div>
                  <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Reason for Visit</label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select reason..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checkup">Annual Checkup</SelectItem>
                      <SelectItem value="vaccination">Vaccination</SelectItem>
                      <SelectItem value="illness">Illness</SelectItem>
                      <SelectItem value="injury">Injury</SelectItem>
                      <SelectItem value="followup">Follow-up</SelectItem>
                      <SelectItem value="dental">Dental</SelectItem>
                      <SelectItem value="surgery">Surgery</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Veterinarian</label>
                  <Select defaultValue="chen">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chen">Dr. Chen</SelectItem>
                      <SelectItem value="patel">Dr. Patel</SelectItem>
                      <SelectItem value="garcia">Dr. Garcia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Summary</label>
                  <Input placeholder="Brief summary of the visit..." />
                </div>
                <div>
                  <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Detailed Notes</label>
                  <Textarea placeholder="Full visit notes..." className="min-h-24" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setVisitDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => setVisitDialogOpen(false)}>Save Visit</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
              <Textarea
                value={vetNotes}
                onChange={(e) => setVetNotes(e.target.value)}
                className="min-h-32 bg-[var(--surface-white)]"
                placeholder="Add internal notes about this patient..."
              />
              <div className="flex justify-end mt-3">
                <Button size="sm"><Save className="w-4 h-4" /> Save Notes</Button>
              </div>
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
                <Badge variant="outline" className="border-[#2D6A4F] text-[var(--brand-green-text)]">Visible to Client</Badge>
              </div>
              <Textarea
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                className="min-h-32 bg-[var(--surface-white)]"
                placeholder="Add notes for the pet owner..."
              />
              <div className="flex justify-end mt-3">
                <Button size="sm"><Save className="w-4 h-4" /> Save Notes</Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── Add Pet Dialog ─────────────────────────────── */}
      <Dialog open={addPetOpen} onOpenChange={setAddPetOpen}>
        <DialogContent
          className="p-0 gap-0 overflow-hidden [&>button]:top-[14px] [&>button]:right-[14px] [&>button]:w-8 [&>button]:h-8 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:rounded-[8px] [&>button]:!bg-white/15 [&>button]:!text-white [&>button]:!opacity-100 [&>button]:hover:!bg-white/25 [&>button]:transition-colors [&>button>svg]:w-4 [&>button>svg]:h-4"
          style={{ maxWidth: '520px', width: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
        >
          {/* Header */}
          <div style={{ background: '#2D6A4F', padding: '18px 24px', flexShrink: 0 }}>
            <div className="flex items-center gap-3">
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <PlusCircle style={{ width: '18px', height: '18px', color: '#fff' }} />
              </div>
              <div>
                <DialogTitle style={{ fontSize: '17px', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>Add New Pet</DialogTitle>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '1px' }}>Add another pet for {ownerName}</p>
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
              style={{ backgroundColor: '#2D6A4F', color: '#fff', minWidth: '110px' }}
            >
              {addPetSaving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</> : 'Add Pet'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
