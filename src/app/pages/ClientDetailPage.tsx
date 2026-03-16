import { useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import {
  ArrowLeft, Edit2, MoreHorizontal, Plus, Save, X, Printer, Archive, Trash2,
  Mail, Phone, MapPin, Shield, AlertCircle, Check, PlusCircle,
  Calendar, Clock, Syringe, ChevronRight,
  CheckCircle2, AlertTriangle, ChevronDown,
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
  const client = mockClient; // In real app, fetch by id

  const [selectedPetIdx, setSelectedPetIdx] = useState(0);

  const [editing, setEditing] = useState(false);
  const [conditionOpen, setConditionOpen] = useState(false);
  const [conditionSearch, setConditionSearch] = useState('');
  const [conditions, setConditions] = useState(client.pets[0].conditions);
  const [allergies, setAllergies] = useState(client.pets[0].allergies);
  const [allergyInput, setAllergyInput] = useState('');
  const [showAllergyInput, setShowAllergyInput] = useState(false);
  const [visitDialogOpen, setVisitDialogOpen] = useState(false);
  const [treatmentDialogOpen, setTreatmentDialogOpen] = useState(false);
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
    setConditions(p.conditions);
    setAllergies(p.allergies);
    setVetNotes(p.vetNotes);
    setClientNotes(p.clientNotes);
    setPatientStatus(p.status);
    setActiveVaxDot(0);
    setEditing(false);
  };

  const handleAddCondition = (name: string) => {
    setConditions([
      ...conditions,
      { id: Date.now(), name, dateDiagnosed: 'Mar 11, 2026', status: 'active' as const },
    ]);
    setConditionOpen(false);
    setConditionSearch('');
  };

  const handleAddAllergy = () => {
    if (allergyInput.trim()) {
      setAllergies([...allergies, allergyInput.trim()]);
      setAllergyInput('');
      setShowAllergyInput(false);
    }
  };

  const filteredDiseases = DISEASES_DB.filter(
    (d) => d.toLowerCase().includes(conditionSearch.toLowerCase())
      && !conditions.some((c) => c.name === d)
  );

  return (
    <div className="max-w-[1200px] mx-auto p-8">
      {/* Back Link */}
      <Link
        to="/clients"
        className="inline-flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-6"
        style={{ fontSize: '14px', fontWeight: 400 }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Clients
      </Link>

      {/* ─── Header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16">
            <AvatarImage src={petImage} alt={petName} className="object-cover" />
            <AvatarFallback>{petName.slice(0, 2)}</AvatarFallback>
          </Avatar>
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
                        onClick={() => setPatientStatus(option.value)}
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
            onClick={() => setEditing(!editing)}
          >
            {editing ? <><Save className="w-4 h-4" /> Save</> : <><Edit2 className="w-4 h-4" /> Edit</>}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem><Printer className="w-4 h-4 mr-2" /> Print Record</DropdownMenuItem>
              <DropdownMenuItem><Archive className="w-4 h-4 mr-2" /> Archive</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-[#d4183d]"><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
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
          {/* ── Pet Switcher (only when owner has multiple pets) ── */}
          {client.pets.length > 1 && (
            <div className="flex items-center gap-1.5">
              {client.pets.map((pet, idx) => {
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
            </div>
          )}
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
                <Separator className="my-2" />
                <div className="pt-2">
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
                        <div className="p-2">
                          <p className="text-[var(--text-secondary)] text-sm mb-2">No condition found.</p>
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => handleAddCondition(conditionSearch)}
                          >
                            <PlusCircle className="w-4 h-4" />
                            Add "{conditionSearch}"
                          </Button>
                        </div>
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
                  return (
                    <div key={c.id} className="flex items-center justify-between py-2 px-3 border border-[var(--border-color)]" style={{ borderRadius: '8px' }}>
                      <div className="flex items-center gap-3">
                        <span className="text-[var(--text-primary)]" style={{ fontSize: '16px', fontWeight: 500 }}>{c.name}</span>
                        <span
                          className="inline-block px-2 py-0.5"
                          style={{ backgroundColor: cs.bg, color: cs.text, borderRadius: '9999px', fontSize: '12px', fontWeight: 600 }}
                        >
                          {c.status}
                        </span>
                      </div>
                      <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Diagnosed: {c.dateDiagnosed}</span>
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
                {client.pets[selectedPetIdx].treatments.map((t) => (
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
                      onClick={() => navigate('/appointments')}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={petImage} alt={petName} className="object-cover" />
                          <AvatarFallback>{petName.slice(0, 2)}</AvatarFallback>
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
                onClick={() => navigate('/appointments', { state: { openNewAppt: true } })}
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
          <Dialog open={treatmentDialogOpen} onOpenChange={setTreatmentDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Treatment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Treatment Name</label>
                  <Input placeholder="e.g. Rabies Vaccine" />
                </div>
                <div>
                  <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Date</label>
                  <Input type="date" defaultValue="2026-03-11" />
                </div>
                <div>
                  <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Administering Vet</label>
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
                  <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Notes</label>
                  <Textarea placeholder="Treatment notes..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTreatmentDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => setTreatmentDialogOpen(false)}>Save Treatment</Button>
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
    </div>
  );
}
