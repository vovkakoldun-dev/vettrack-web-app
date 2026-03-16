import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Search, Plus, PawPrint, Heart, Sparkles, Mail,
  CheckCircle2, AlertCircle, AlertTriangle, Loader2,
} from 'lucide-react';
import { usePets } from '../hooks/usePets';
import { StatCard } from '../components/StatCard';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '../components/ui/table';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../components/ui/select';

// ─── Types ───────────────────────────────────────────────────

type PetStatus = 'Healthy' | 'Follow-up' | 'Critical';

interface Pet {
  id: number;
  petImage: string;
  petName: string;
  species: string;
  breed: string;
  dob: string;
  age: string;
  weight: string;
  ownerName: string;
  ownerEmail: string;
  vet: string;
  lastVisit: string;
  nextAppointment: string;
  status: PetStatus;
}

// ─── Status Config ───────────────────────────────────────────

const STATUS_CONFIG: Record<PetStatus, { bg: string; text: string; icon: React.ElementType }> = {
  'Healthy':    { bg: '#74C69D20', text: 'var(--brand-green-text)', icon: CheckCircle2 },
  'Follow-up':  { bg: '#F4A26120', text: '#F4A261', icon: AlertCircle },
  'Critical':   { bg: '#d4183d20', text: '#d4183d', icon: AlertTriangle },
};

// ─── Vet Initials Helper ─────────────────────────────────────

const VET_COLORS: Record<string, string> = {
  'Dr. Chen':     '#2D6A4F',
  'Dr. Patel':    '#3B82F6',
  'Dr. Williams': '#8B5CF6',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter((part) => part.length > 0 && part !== 'Dr.')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// Mock data removed — live Supabase queries used via usePets()

// ─── Component ───────────────────────────────────────────────

// Mock data removed — replaced by live Supabase queries

export default function PetsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('all');
  const [sortFilter, setSortFilter] = useState('recent');
  const { pets, loading } = usePets();

  // Adapter: map PetRow to legacy display shape
  const allPets = pets.map(p => ({
    id: p.id,
    petImage: p.photo_url ?? '',
    petName: p.name,
    species: p.species,
    breed: p.breed ?? '—',
    dob: p.date_of_birth ?? '—',
    age: p.date_of_birth
      ? `${Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / (365.25 * 86400000))}y`
      : '—',
    weight: p.weight_kg ? `${p.weight_kg} kg` : '—',
    ownerName: p.clients ? `${p.clients.first_name} ${p.clients.last_name}` : '—',
    ownerEmail: '',
    vet: '—',
    lastVisit: '—',
    nextAppointment: '—',
    status: 'Healthy' as const,
  }));

  const filtered = allPets
    .filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch =
        p.petName.toLowerCase().includes(q) ||
        p.breed.toLowerCase().includes(q) ||
        p.ownerName.toLowerCase().includes(q);
      const matchesSpecies = speciesFilter === 'all' || p.species === speciesFilter;
      return matchesSearch && matchesSpecies;
    })
    .sort((a, b) => {
      if (sortFilter === 'name-asc') return a.petName.localeCompare(b.petName);
      if (sortFilter === 'name-desc') return b.petName.localeCompare(a.petName);
      return 0;
    });

  const dogCount = allPets.filter(p => p.species === 'Dog').length;
  const catCount = allPets.filter(p => p.species === 'Cat').length;

  return (
    <div className="max-w-[1440px] mx-auto p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[var(--text-primary)] mb-2">All Pets</h1>
          <p className="text-[var(--text-secondary)]" style={{ fontSize: '16px', fontWeight: 400 }}>
            Complete registry of all active patients.
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4" />
          Add Pet
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Pets"
          value={allPets.length}
          icon={PawPrint}
          iconColor="var(--brand-green-text)"
          trend={{ value: 'Active patients', isPositive: true }}
        />
        <StatCard
          title="Dogs"
          value={dogCount}
          icon={PawPrint}
          iconColor="#F4A261"
          trend={{ value: allPets.length ? `${Math.round(dogCount / allPets.length * 100)}% of total` : '—', isPositive: true }}
        />
        <StatCard
          title="Cats"
          value={catCount}
          icon={Heart}
          iconColor="#8B5CF6"
          trend={{ value: allPets.length ? `${Math.round(catCount / allPets.length * 100)}% of total` : '—', isPositive: true }}
        />
        <StatCard
          title="Other Species"
          value={allPets.length - dogCount - catCount}
          icon={Sparkles}
          iconColor="#06B6D4"
          trend={{ value: 'Registered', isPositive: true }}
        />
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <Input
            placeholder="Search by pet name, breed, or owner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={speciesFilter} onValueChange={setSpeciesFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Species" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Species</SelectItem>
            <SelectItem value="Dog">Dog</SelectItem>
            <SelectItem value="Cat">Cat</SelectItem>
            <SelectItem value="Rabbit">Rabbit</SelectItem>
            <SelectItem value="Bird">Bird</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="Healthy">Healthy</SelectItem>
            <SelectItem value="Follow-up">Follow-up</SelectItem>
            <SelectItem value="Critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortFilter} onValueChange={setSortFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Recent Visit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recent Visit</SelectItem>
            <SelectItem value="name-asc">Name A-Z</SelectItem>
            <SelectItem value="name-desc">Name Z-A</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)]" style={{ borderRadius: '12px' }}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {['Pet', 'Owner', 'Age & Weight', 'Vet', 'Last Visit', 'Next Appointment', 'Status'].map((h) => (
                <TableHead key={h} className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={9} className="py-16 text-center">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin" style={{ color: 'var(--text-secondary)' }} />
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-16 text-center">
                  <PawPrint className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--border-color)' }} />
                  <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>No pets yet</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Add your first pet using the button above</p>
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.map((pet) => {
              const cfg = STATUS_CONFIG[pet.status];
              const StatusIcon = cfg.icon;
              const vetColor = VET_COLORS[pet.vet] ?? 'var(--brand-green-text)';
              const vetInitials = getInitials(pet.vet);

              return (
                <TableRow
                  key={pet.id}
                  className="hover:bg-[var(--surface-elevated)] cursor-pointer transition-colors"
                  onClick={() => navigate(`/clients/${pet.id}`)}
                >
                  {/* Pet */}
                  <TableCell className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={pet.petImage}
                        alt={pet.petName}
                        className="w-10 h-10 object-cover"
                        style={{ borderRadius: '9999px' }}
                      />
                      <div>
                        <p className="text-[var(--text-primary)]" style={{ fontSize: '15px', fontWeight: 600 }}>
                          {pet.petName}
                        </p>
                        <p className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>
                          {pet.breed}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  {/* Owner */}
                  <TableCell className="py-4 px-4">
                    <div>
                      <p className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 400 }}>
                        {pet.ownerName}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 text-[var(--text-secondary)]" />
                        <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>
                          {pet.ownerEmail}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  {/* Age & Weight */}
                  <TableCell className="py-4 px-4">
                    <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>
                      {pet.age}
                    </span>
                    <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px', fontWeight: 400 }}>
                      {' · '}{pet.weight}
                    </span>
                  </TableCell>

                  {/* Vet */}
                  <TableCell className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: `${vetColor}20`,
                          borderRadius: '9999px',
                        }}
                      >
                        <span style={{ fontSize: '10px', fontWeight: 700, color: vetColor }}>
                          {vetInitials}
                        </span>
                      </div>
                      <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px', fontWeight: 400 }}>
                        {pet.vet}
                      </span>
                    </div>
                  </TableCell>

                  {/* Last Visit */}
                  <TableCell className="py-4 px-4">
                    <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px', fontWeight: 400 }}>
                      {pet.lastVisit}
                    </span>
                  </TableCell>

                  {/* Next Appointment */}
                  <TableCell className="py-4 px-4">
                    <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 400 }}>
                      {pet.nextAppointment}
                    </span>
                  </TableCell>

                  {/* Status */}
                  <TableCell className="py-4 px-4">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1"
                      style={{
                        backgroundColor: cfg.bg,
                        color: cfg.text,
                        borderRadius: '9999px',
                        fontSize: '14px',
                        fontWeight: 600,
                      }}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      {pet.status}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-color)] flex items-center justify-between">
          <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px', fontWeight: 400 }}>
            Showing {filtered.length} of {allPets.length} pets
          </p>
        </div>
      </div>
    </div>
  );
}
