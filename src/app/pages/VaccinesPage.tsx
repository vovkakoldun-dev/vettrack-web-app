import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Search, Plus, Syringe, AlertTriangle, CheckCircle2, Clock,
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
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import { supabase } from '../../lib/supabase';
import { getOrgContext } from '../hooks/useOrgContext';

// ─── Types ───────────────────────────────────────────────────

type VaccineStatus = 'Overdue' | 'Due Soon' | 'Up to Date';

interface VaccineRecord {
  id: string;
  petName: string;
  petImage: string;
  breed: string;
  species: string;
  ownerName: string;
  clientId: string;
  vaccine: string;
  lastGiven: string;
  nextDue: string;
  daysUntilDue: number;
  status: VaccineStatus;
  vet: string;
}

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
  const [vaccines, setVaccines] = useState<VaccineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [vets, setVets] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { organizationId } = await getOrgContext();
        const { data } = await supabase
          .from('vaccinations')
          .select('id, vaccine_name, administered_date, next_due_date, notes, pets!inner(id, name, species, breed, photo_url, client_id, clients!inner(id, first_name, last_name)), staff:staff!vaccinations_administered_by_fkey(id, profiles:profiles!staff_profile_id_fkey(first_name, last_name))')
          .order('administered_date', { ascending: false });

        if (data) {
          const now = new Date();
          const mapped: VaccineRecord[] = data.map((v: any) => {
            const lastGiven = v.administered_date
              ? new Date(v.administered_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : '—';
            const nextDue = v.next_due_date
              ? new Date(v.next_due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : '—';
            const daysUntilDue = v.next_due_date
              ? Math.ceil((new Date(v.next_due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
              : 999;
            let status: VaccineStatus = 'Up to Date';
            if (v.next_due_date) {
              if (daysUntilDue < 0) status = 'Overdue';
              else if (daysUntilDue <= 30) status = 'Due Soon';
            }
            const vetName = v.staff?.profiles
              ? `Dr. ${v.staff.profiles.first_name} ${v.staff.profiles.last_name}`
              : '—';
            return {
              id: v.id,
              petName: v.pets?.name ?? '—',
              petImage: v.pets?.photo_url || '',
              breed: v.pets?.breed || '—',
              species: v.pets?.species || '—',
              ownerName: v.pets?.clients ? `${v.pets.clients.first_name} ${v.pets.clients.last_name}` : '—',
              clientId: v.pets?.clients?.id || '',
              vaccine: v.vaccine_name,
              lastGiven,
              nextDue,
              daysUntilDue,
              status,
              vet: vetName,
            };
          });
          setVaccines(mapped);
          // Extract unique vet names for the filter
          const uniqueVets = Array.from(new Set(mapped.map(v => v.vet).filter(v => v !== '—')));
          setVets(uniqueVets);
        }
      } catch (e) {
        console.error('Error loading vaccines:', e);
      }
      setLoading(false);
    })();
  }, []);

  // Compute stat card values from real data
  const overdue = vaccines.filter(v => v.status === 'Overdue').length;
  const dueThisWeek = vaccines.filter(v => v.daysUntilDue >= 0 && v.daysUntilDue <= 7).length;
  const dueThisMonth = vaccines.filter(v => v.daysUntilDue >= 0 && v.daysUntilDue <= 30).length;
  const upToDate = vaccines.filter(v => v.status === 'Up to Date').length;
  const totalVaccines = vaccines.length;
  const upToDatePct = totalVaccines > 0 ? Math.round((upToDate / totalVaccines) * 100) : 0;

  // Get unique species
  const speciesOptions = Array.from(new Set(vaccines.map(v => v.species).filter(s => s !== '—')));

  const filtered = vaccines.filter((v) => {
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
        <Button onClick={() => navigate('/appointments')}>
          <Plus className="w-4 h-4" />
          Record Vaccination
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Overdue"
          value={overdue}
          icon={AlertTriangle}
          iconColor="#d4183d"
          trend={{ value: 'Needs immediate attention', isPositive: false }}
        />
        <StatCard
          title="Due This Week"
          value={dueThisWeek}
          icon={Clock}
          iconColor="#F4A261"
          trend={{ value: 'Next 7 days', isPositive: false }}
        />
        <StatCard
          title="Due This Month"
          value={dueThisMonth}
          icon={Syringe}
          iconColor="#3B82F6"
          trend={{ value: 'Next 30 days', isPositive: true }}
        />
        <StatCard
          title="Up to Date"
          value={upToDate}
          icon={CheckCircle2}
          iconColor="var(--brand-green-text)"
          trend={{ value: `${upToDatePct}% of records`, isPositive: true }}
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
            {speciesOptions.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
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
            {vets.map(v => (
              <SelectItem key={v} value={v}>{v}</SelectItem>
            ))}
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
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Loading vaccination records...</p>
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <Syringe className="w-8 h-8 text-[var(--text-secondary)] mx-auto mb-3 opacity-40" />
                  <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>
                    {search || speciesFilter !== 'all' || statusFilter !== 'all' || vetFilter !== 'all'
                      ? 'No vaccination records match your filters.'
                      : 'No vaccination records yet. Complete a vaccination visit to see records here.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : filtered.map((v) => {
              const cfg = STATUS_CONFIG[v.status];
              const StatusIcon = cfg.icon;

              let daysDisplay: React.ReactNode;
              if (v.daysUntilDue < 0) {
                daysDisplay = (
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#d4183d' }}>
                    {Math.abs(v.daysUntilDue)}d overdue
                  </span>
                );
              } else if (v.daysUntilDue <= 30) {
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
                  onClick={() => v.clientId && navigate(`/clients/${v.clientId}`)}
                >
                  {/* Pet */}
                  <TableCell className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={v.petImage} alt={v.petName} className="object-cover" />
                        <AvatarFallback style={{ fontSize: '13px', fontWeight: 600 }}>{v.petName.slice(0, 2)}</AvatarFallback>
                      </Avatar>
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
            Showing {filtered.length} of {vaccines.length} vaccine records
          </p>
        </div>
      </div>
    </div>
  );
}
