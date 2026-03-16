import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Search, Plus, PawPrint, Heart, Sparkles, Mail,
  CheckCircle2, AlertCircle, AlertTriangle,
} from 'lucide-react';
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

// ─── Mock Data ───────────────────────────────────────────────

const MOCK_PETS: Pet[] = [
  { id: 1,  petImage: 'https://images.unsplash.com/photo-1734966213753-1b361564bab4?w=400',  petName: 'Max',     species: 'Dog', breed: 'Golden Retriever',  dob: 'Jun 15, 2020', age: '5y', weight: '32 kg',  ownerName: 'John Smith',      ownerEmail: 'john.smith@email.com',  vet: 'Dr. Chen',     lastVisit: 'Mar 10, 2026', nextAppointment: 'Apr 10, 2026', status: 'Healthy'   as const },
  { id: 2,  petImage: 'https://images.unsplash.com/photo-1670739088209-64414249354b?w=400',  petName: 'Luna',    species: 'Cat', breed: 'Tabby',              dob: 'Feb 3, 2022',  age: '4y', weight: '4.2 kg', ownerName: 'Emily Johnson',   ownerEmail: 'emily.j@email.com',     vet: 'Dr. Chen',     lastVisit: 'Mar 9, 2026',  nextAppointment: 'Mar 23, 2026', status: 'Follow-up' as const },
  { id: 3,  petImage: 'https://images.unsplash.com/photo-1685387714439-edef4bd70ef5?w=400',  petName: 'Cooper',  species: 'Dog', breed: 'Beagle',             dob: 'Aug 20, 2021', age: '4y', weight: '11 kg',  ownerName: 'Michael Brown',   ownerEmail: 'mbrown@email.com',      vet: 'Dr. Chen',     lastVisit: 'Mar 8, 2026',  nextAppointment: 'Jun 8, 2026',  status: 'Healthy'   as const },
  { id: 4,  petImage: 'https://images.unsplash.com/photo-1608574592993-774ffa9a218e?w=400',  petName: 'Bella',   species: 'Cat', breed: 'Siamese',            dob: 'Oct 11, 2019', age: '6y', weight: '3.8 kg', ownerName: 'Sarah Williams',  ownerEmail: 'swilliams@email.com',   vet: 'Dr. Chen',     lastVisit: 'Mar 7, 2026',  nextAppointment: 'Apr 7, 2026',  status: 'Healthy'   as const },
  { id: 5,  petImage: 'https://images.unsplash.com/photo-1665918577658-c7cddc5fd53c?w=400',  petName: 'Charlie', species: 'Dog', breed: 'Corgi',              dob: 'Apr 5, 2022',  age: '3y', weight: '14 kg',  ownerName: 'David Miller',    ownerEmail: 'dmiller@email.com',     vet: 'Dr. Williams', lastVisit: 'Mar 5, 2026',  nextAppointment: 'Mar 19, 2026', status: 'Follow-up' as const },
  { id: 6,  petImage: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',  petName: 'Rocky',   species: 'Dog', breed: 'German Shepherd',    dob: 'Sep 12, 2020', age: '5y', weight: '38 kg',  ownerName: 'James Wilson',    ownerEmail: 'jwilson@email.com',     vet: 'Dr. Patel',    lastVisit: 'Mar 3, 2026',  nextAppointment: 'Mar 17, 2026', status: 'Critical'  as const },
  { id: 7,  petImage: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400',  petName: 'Milo',    species: 'Cat', breed: 'Persian',            dob: 'Jan 30, 2021', age: '5y', weight: '5.1 kg', ownerName: 'Jessica Taylor',  ownerEmail: 'jtaylor@email.com',     vet: 'Dr. Patel',    lastVisit: 'Feb 28, 2026', nextAppointment: 'May 28, 2026', status: 'Healthy'   as const },
  { id: 8,  petImage: 'https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=400',     petName: 'Daisy',   species: 'Dog', breed: 'Labrador',           dob: 'Jul 14, 2021', age: '4y', weight: '28 kg',  ownerName: 'Robert Anderson', ownerEmail: 'randerson@email.com',   vet: 'Dr. Patel',    lastVisit: 'Feb 25, 2026', nextAppointment: 'Mar 25, 2026', status: 'Follow-up' as const },
  { id: 9,  petImage: 'https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=400',  petName: 'Simba',   species: 'Cat', breed: 'Maine Coon',         dob: 'Mar 8, 2020',  age: '6y', weight: '7.2 kg', ownerName: 'Lisa Martinez',   ownerEmail: 'lmartinez@email.com',   vet: 'Dr. Williams', lastVisit: 'Feb 20, 2026', nextAppointment: 'Apr 20, 2026', status: 'Healthy'   as const },
  { id: 10, petImage: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',  petName: 'Buddy',   species: 'Dog', breed: 'Poodle',             dob: 'Nov 22, 2022', age: '3y', weight: '8 kg',   ownerName: 'Karen Thomas',    ownerEmail: 'kthomas@email.com',     vet: 'Dr. Patel',    lastVisit: 'Feb 15, 2026', nextAppointment: 'May 15, 2026', status: 'Healthy'   as const },
  { id: 11, petImage: 'https://images.unsplash.com/photo-1548681528-6a5c45b66b42?w=400',     petName: 'Cleo',    species: 'Cat', breed: 'British Shorthair',  dob: 'May 17, 2021', age: '4y', weight: '4.8 kg', ownerName: 'Anna Rivera',     ownerEmail: 'arivera@email.com',     vet: 'Dr. Chen',     lastVisit: 'Feb 10, 2026', nextAppointment: 'May 10, 2026', status: 'Healthy'   as const },
  { id: 12, petImage: 'https://images.unsplash.com/photo-1583511655826-05700d52f4d9?w=400',  petName: 'Zeus',    species: 'Dog', breed: 'Boxer',              dob: 'Feb 28, 2022', age: '4y', weight: '32 kg',  ownerName: 'Tom Baker',       ownerEmail: 'tbaker@email.com',      vet: 'Dr. Williams', lastVisit: 'Feb 8, 2026',  nextAppointment: 'Apr 8, 2026',  status: 'Follow-up' as const },
  { id: 13, petImage: 'https://images.unsplash.com/photo-1516750105099-4b8a83e217ee?w=400',  petName: 'Nala',    species: 'Cat', breed: 'Bengal',             dob: 'Dec 4, 2022',  age: '3y', weight: '4.0 kg', ownerName: 'Priya Patel',     ownerEmail: 'ppatel@email.com',      vet: 'Dr. Patel',    lastVisit: 'Feb 5, 2026',  nextAppointment: 'May 5, 2026',  status: 'Healthy'   as const },
  { id: 14, petImage: 'https://images.unsplash.com/photo-1551717743-49959800b1f6?w=400',     petName: 'Archie',  species: 'Dog', breed: 'Dachshund',          dob: 'Aug 1, 2023',  age: '2y', weight: '7 kg',   ownerName: 'Mark Lee',        ownerEmail: 'mlee@email.com',        vet: 'Dr. Chen',     lastVisit: 'Jan 28, 2026', nextAppointment: 'Apr 28, 2026', status: 'Healthy'   as const },
  { id: 15, petImage: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',  petName: 'Oliver',  species: 'Dog', breed: 'Beagle Mix',         dob: 'Jun 10, 2021', age: '4y', weight: '10 kg',  ownerName: 'Claire Nguyen',   ownerEmail: 'cnguyen@email.com',     vet: 'Dr. Williams', lastVisit: 'Jan 20, 2026', nextAppointment: 'Apr 20, 2026', status: 'Healthy'   as const },
];

// ─── Component ───────────────────────────────────────────────

export default function PetsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortFilter, setSortFilter] = useState('recent');

  const filtered = MOCK_PETS
    .filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch =
        p.petName.toLowerCase().includes(q) ||
        p.breed.toLowerCase().includes(q) ||
        p.ownerName.toLowerCase().includes(q);
      const matchesSpecies = speciesFilter === 'all' || p.species === speciesFilter;
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesSpecies && matchesStatus;
    })
    .sort((a, b) => {
      if (sortFilter === 'name-asc') return a.petName.localeCompare(b.petName);
      if (sortFilter === 'name-desc') return b.petName.localeCompare(a.petName);
      // Default: recent visit — keep original order (already sorted by lastVisit desc in mock data)
      return 0;
    });

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
          value={2163}
          icon={PawPrint}
          iconColor="var(--brand-green-text)"
          trend={{ value: '+5% from last month', isPositive: true }}
        />
        <StatCard
          title="Dogs"
          value={1284}
          icon={PawPrint}
          iconColor="#F4A261"
          trend={{ value: '59% of total', isPositive: true }}
        />
        <StatCard
          title="Cats"
          value={731}
          icon={Heart}
          iconColor="#8B5CF6"
          trend={{ value: '34% of total', isPositive: true }}
        />
        <StatCard
          title="New This Month"
          value={47}
          icon={Sparkles}
          iconColor="#06B6D4"
          trend={{ value: '+18% vs last month', isPositive: true }}
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
            {filtered.map((pet) => {
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
            Showing {filtered.length} of {MOCK_PETS.length} pets
          </p>
        </div>
      </div>
    </div>
  );
}
