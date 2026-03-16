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

const MOCK_VACCINES: VaccineRecord[] = []

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

  const filtered = [].filter((v) => {
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
            Showing {filtered.length} of {0} vaccine records
          </p>
        </div>
      </div>
    </div>
  );
}
