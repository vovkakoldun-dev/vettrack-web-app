import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Search, Plus, Syringe, AlertTriangle, CheckCircle2, Clock, Filter,
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

type VaccineStatus = 'Overdue' | 'Due Soon' | 'Up to Date';

interface VaccineRecord {
  id: number;
  petId: number;
  petName: string;
  petImage: string;
  breed: string;
  species: string;
  ownerName: string;
  vaccine: string;
  lastGiven: string;
  nextDue: string;
  daysUntilDue: number;
  status: VaccineStatus;
  vet: string;
}

// ─── Mock Data ───────────────────────────────────────────────

const MOCK_VACCINES: VaccineRecord[] = [
  { id: 1,  petId: 6,  petName: 'Rocky',   petImage: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',   breed: 'German Shepherd',  species: 'Dog', ownerName: 'James Wilson',    vaccine: 'Rabies',       lastGiven: 'Nov 5, 2024',  nextDue: 'Nov 5, 2025',  daysUntilDue: -130, status: 'Overdue',     vet: 'Dr. Chen' },
  { id: 2,  petId: 8,  petName: 'Daisy',   petImage: 'https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=400',      breed: 'Labrador',         species: 'Dog', ownerName: 'Robert Anderson', vaccine: 'DHPP',         lastGiven: 'Dec 1, 2024',  nextDue: 'Dec 1, 2025',  daysUntilDue: -104, status: 'Overdue',     vet: 'Dr. Patel' },
  { id: 3,  petId: 2,  petName: 'Luna',    petImage: 'https://images.unsplash.com/photo-1670739088209-64414249354b?w=400',   breed: 'Tabby',            species: 'Cat', ownerName: 'Emily Johnson',   vaccine: 'FVRCP',        lastGiven: 'Jan 10, 2025', nextDue: 'Jan 10, 2026', daysUntilDue: -63,  status: 'Overdue',     vet: 'Dr. Chen' },
  { id: 4,  petId: 5,  petName: 'Charlie', petImage: 'https://images.unsplash.com/photo-1665918577658-c7cddc5fd53c?w=400',   breed: 'Corgi',            species: 'Dog', ownerName: 'David Miller',    vaccine: 'Bordetella',   lastGiven: 'Sep 10, 2025', nextDue: 'Mar 10, 2026', daysUntilDue: -4,   status: 'Overdue',     vet: 'Dr. Williams' },
  { id: 5,  petId: 1,  petName: 'Max',     petImage: 'https://images.unsplash.com/photo-1734966213753-1b361564bab4?w=400',   breed: 'Golden Retriever', species: 'Dog', ownerName: 'John Smith',      vaccine: 'Leptospirosis',lastGiven: 'Mar 18, 2025', nextDue: 'Mar 18, 2026', daysUntilDue: 4,    status: 'Due Soon',    vet: 'Dr. Chen' },
  { id: 6,  petId: 7,  petName: 'Milo',    petImage: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400',   breed: 'Persian',          species: 'Cat', ownerName: 'Jessica Taylor',  vaccine: 'Rabies',       lastGiven: 'Mar 22, 2025', nextDue: 'Mar 22, 2026', daysUntilDue: 8,    status: 'Due Soon',    vet: 'Dr. Patel' },
  { id: 7,  petId: 3,  petName: 'Cooper',  petImage: 'https://images.unsplash.com/photo-1685387714439-edef4bd70ef5?w=400',   breed: 'Beagle',           species: 'Dog', ownerName: 'Michael Brown',   vaccine: 'Lyme',         lastGiven: 'Mar 25, 2025', nextDue: 'Mar 25, 2026', daysUntilDue: 11,   status: 'Due Soon',    vet: 'Dr. Chen' },
  { id: 8,  petId: 9,  petName: 'Simba',   petImage: 'https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=400',   breed: 'Maine Coon',       species: 'Cat', ownerName: 'Lisa Martinez',   vaccine: 'FeLV',         lastGiven: 'Apr 2, 2025',  nextDue: 'Apr 2, 2026',  daysUntilDue: 19,   status: 'Due Soon',    vet: 'Dr. Williams' },
  { id: 9,  petId: 4,  petName: 'Bella',   petImage: 'https://images.unsplash.com/photo-1608574592993-774ffa9a218e?w=400',   breed: 'Siamese',          species: 'Cat', ownerName: 'Sarah Williams',  vaccine: 'FVRCP',        lastGiven: 'Apr 7, 2025',  nextDue: 'Apr 7, 2026',  daysUntilDue: 24,   status: 'Due Soon',    vet: 'Dr. Chen' },
  { id: 10, petId: 10, petName: 'Buddy',   petImage: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',   breed: 'Poodle',           species: 'Dog', ownerName: 'Karen Thomas',    vaccine: 'DHPP',         lastGiven: 'May 15, 2025', nextDue: 'May 15, 2026', daysUntilDue: 62,   status: 'Due Soon',    vet: 'Dr. Patel' },
  { id: 11, petId: 1,  petName: 'Max',     petImage: 'https://images.unsplash.com/photo-1734966213753-1b361564bab4?w=400',   breed: 'Golden Retriever', species: 'Dog', ownerName: 'John Smith',      vaccine: 'Rabies',       lastGiven: 'Dec 15, 2025', nextDue: 'Dec 15, 2026', daysUntilDue: 276,  status: 'Up to Date',  vet: 'Dr. Chen' },
  { id: 12, petId: 1,  petName: 'Max',     petImage: 'https://images.unsplash.com/photo-1734966213753-1b361564bab4?w=400',   breed: 'Golden Retriever', species: 'Dog', ownerName: 'John Smith',      vaccine: 'DHPP',         lastGiven: 'Jan 20, 2026', nextDue: 'Jan 20, 2027', daysUntilDue: 312,  status: 'Up to Date',  vet: 'Dr. Chen' },
  { id: 13, petId: 4,  petName: 'Bella',   petImage: 'https://images.unsplash.com/photo-1608574592993-774ffa9a218e?w=400',   breed: 'Siamese',          species: 'Cat', ownerName: 'Sarah Williams',  vaccine: 'Rabies',       lastGiven: 'Apr 7, 2025',  nextDue: 'Apr 7, 2026',  daysUntilDue: 24,   status: 'Due Soon',    vet: 'Dr. Chen' },
  { id: 14, petId: 3,  petName: 'Cooper',  petImage: 'https://images.unsplash.com/photo-1685387714439-edef4bd70ef5?w=400',   breed: 'Beagle',           species: 'Dog', ownerName: 'Michael Brown',   vaccine: 'Bordetella',   lastGiven: 'Jun 8, 2025',  nextDue: 'Jun 8, 2026',  daysUntilDue: 86,   status: 'Up to Date',  vet: 'Dr. Chen' },
  { id: 15, petId: 7,  petName: 'Milo',    petImage: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400',   breed: 'Persian',          species: 'Cat', ownerName: 'Jessica Taylor',  vaccine: 'FeLV',         lastGiven: 'May 28, 2025', nextDue: 'May 28, 2026', daysUntilDue: 75,   status: 'Up to Date',  vet: 'Dr. Patel' },
  { id: 16, petId: 9,  petName: 'Simba',   petImage: 'https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=400',   breed: 'Maine Coon',       species: 'Cat', ownerName: 'Lisa Martinez',   vaccine: 'Rabies',       lastGiven: 'Apr 20, 2025', nextDue: 'Apr 20, 2026', daysUntilDue: 37,   status: 'Up to Date',  vet: 'Dr. Williams' },
  { id: 17, petId: 10, petName: 'Buddy',   petImage: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',   breed: 'Poodle',           species: 'Dog', ownerName: 'Karen Thomas',    vaccine: 'Rabies',       lastGiven: 'May 15, 2025', nextDue: 'May 15, 2026', daysUntilDue: 62,   status: 'Up to Date',  vet: 'Dr. Patel' },
  { id: 18, petId: 5,  petName: 'Charlie', petImage: 'https://images.unsplash.com/photo-1665918577658-c7cddc5fd53c?w=400',   breed: 'Corgi',            species: 'Dog', ownerName: 'David Miller',    vaccine: 'DHPP',         lastGiven: 'Mar 19, 2025', nextDue: 'Mar 19, 2026', daysUntilDue: 5,    status: 'Due Soon',    vet: 'Dr. Williams' },
];

// ─── Status Config ───────────────────────────────────────────

const STATUS_CONFIG: Record<VaccineStatus, { bg: string; text: string; icon: React.ElementType }> = {
  'Overdue':     { bg: '#d4183d20', text: '#d4183d', icon: AlertTriangle },
  'Due Soon':    { bg: '#F4A26120', text: '#F4A261', icon: Clock },
  'Up to Date':  { bg: '#74C69D20', text: 'var(--brand-green-text)', icon: CheckCircle2 },
};

// ─── Component ───────────────────────────────────────────────

export default function VaccinesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vetFilter, setVetFilter] = useState('all');

  const filtered = MOCK_VACCINES.filter((v) => {
    const q = search.toLowerCase();
    const matchesSearch =
      v.petName.toLowerCase().includes(q) ||
      v.ownerName.toLowerCase().includes(q) ||
      v.vaccine.toLowerCase().includes(q);
    const matchesSpecies = speciesFilter === 'all' || v.species === speciesFilter;
    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    const matchesVet = vetFilter === 'all' || v.vet === vetFilter;
    return matchesSearch && matchesSpecies && matchesStatus && matchesVet;
  });

  return (
    <div className="max-w-[1440px] mx-auto p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[var(--text-primary)] mb-2">Vaccines & Preventatives</h1>
          <p className="text-[var(--text-secondary)]" style={{ fontSize: '16px', fontWeight: 400 }}>
            Track vaccination schedules across all patients.
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4" />
          Record Vaccination
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Overdue"
          value={7}
          icon={AlertTriangle}
          iconColor="#d4183d"
          trend={{ value: 'Needs immediate attention', isPositive: false }}
        />
        <StatCard
          title="Due This Week"
          value={11}
          icon={Clock}
          iconColor="#F4A261"
          trend={{ value: 'Next 7 days', isPositive: false }}
        />
        <StatCard
          title="Due This Month"
          value={18}
          icon={Syringe}
          iconColor="#3B82F6"
          trend={{ value: 'Next 30 days', isPositive: true }}
        />
        <StatCard
          title="Up to Date"
          value={1847}
          icon={CheckCircle2}
          iconColor="var(--brand-green-text)"
          trend={{ value: '96% of active patients', isPositive: true }}
        />
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <Input
            placeholder="Search by pet, owner, or vaccine..."
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
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Overdue">Overdue</SelectItem>
            <SelectItem value="Due Soon">Due Soon</SelectItem>
            <SelectItem value="Up to Date">Up to Date</SelectItem>
          </SelectContent>
        </Select>
        <Select value={vetFilter} onValueChange={setVetFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Vets" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vets</SelectItem>
            <SelectItem value="Dr. Chen">Dr. Chen</SelectItem>
            <SelectItem value="Dr. Patel">Dr. Patel</SelectItem>
            <SelectItem value="Dr. Williams">Dr. Williams</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)]" style={{ borderRadius: '12px' }}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {['Pet', 'Owner', 'Vaccine', 'Last Given', 'Next Due', 'Days', 'Status'].map((h) => (
                <TableHead key={h} className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((v) => {
              const cfg = STATUS_CONFIG[v.status];
              const StatusIcon = cfg.icon;

              let daysDisplay: React.ReactNode;
              if (v.daysUntilDue < 0) {
                daysDisplay = (
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#d4183d' }}>
                    {Math.abs(v.daysUntilDue)}d overdue
                  </span>
                );
              } else if (v.daysUntilDue < 30) {
                daysDisplay = (
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#F4A261' }}>
                    {v.daysUntilDue}d
                  </span>
                );
              } else {
                daysDisplay = (
                  <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px', fontWeight: 400 }}>
                    {v.daysUntilDue}d
                  </span>
                );
              }

              return (
                <TableRow
                  key={v.id}
                  className="hover:bg-[var(--surface-elevated)] cursor-pointer transition-colors"
                  onClick={() => navigate(`/clients/${v.petId}`)}
                >
                  {/* Pet */}
                  <TableCell className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={v.petImage}
                        alt={v.petName}
                        className="w-10 h-10 object-cover"
                        style={{ borderRadius: '9999px' }}
                      />
                      <div>
                        <p className="text-[var(--text-primary)]" style={{ fontSize: '15px', fontWeight: 600 }}>
                          {v.petName}
                        </p>
                        <p className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>
                          {v.breed}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  {/* Owner */}
                  <TableCell className="py-4 px-4">
                    <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 400 }}>
                      {v.ownerName}
                    </span>
                  </TableCell>

                  {/* Vaccine */}
                  <TableCell className="py-4 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1" style={{ backgroundColor: '#3B82F620', color: '#3B82F6', borderRadius: '9999px', fontSize: '12px', fontWeight: 600 }}>
                      <Syringe className="w-3 h-3" />
                      {v.vaccine}
                    </span>
                  </TableCell>

                  {/* Last Given */}
                  <TableCell className="py-4 px-4">
                    <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px', fontWeight: 400 }}>
                      {v.lastGiven}
                    </span>
                  </TableCell>

                  {/* Next Due */}
                  <TableCell className="py-4 px-4">
                    <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 400 }}>
                      {v.nextDue}
                    </span>
                  </TableCell>

                  {/* Days */}
                  <TableCell className="py-4 px-4">
                    {daysDisplay}
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
                      {v.status}
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
            Showing {filtered.length} of {MOCK_VACCINES.length} vaccine records
          </p>
        </div>
      </div>
    </div>
  );
}
