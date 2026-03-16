import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import {
  Search, FileText, CalendarDays, ClipboardList, FlaskConical,
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { StatCard } from '../components/StatCard';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../components/ui/select';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '../components/ui/table';

// ─── Types ───────────────────────────────────────────────────

type RecordType = 'Visit' | 'Vaccination' | 'Lab Result' | 'Surgery' | 'Prescription' | 'Dental' | 'Imaging';
type RecordStatus = 'Final' | 'Pending Review' | 'Amended' | 'Draft';

interface MedicalRecord {
  id: number;
  petName: string;
  petImage: string;
  breed: string;
  ownerName: string;
  recordType: RecordType;
  date: string;
  dateISO: string;
  vet: string;
  summary: string;
  status: RecordStatus;
}

// ─── Color Maps ──────────────────────────────────────────────

const recordTypeColors: Record<RecordType, { bg: string; text: string }> = {
  Visit:        { bg: '#2D6A4F20', text: 'var(--brand-green-text)' },
  Vaccination:  { bg: '#3B82F620', text: '#3B82F6' },
  'Lab Result': { bg: '#8B5CF620', text: '#8B5CF6' },
  Surgery:      { bg: '#EC489920', text: '#EC4899' },
  Prescription: { bg: '#F4A26120', text: '#F4A261' },
  Dental:       { bg: '#06B6D420', text: '#06B6D4' },
  Imaging:      { bg: '#6B728020', text: 'var(--text-secondary)' },
};

const statusColors: Record<RecordStatus, { bg: string; text: string }> = {
  Final:            { bg: '#74C69D20', text: 'var(--brand-green-text)' },
  'Pending Review': { bg: '#F4A26120', text: '#F4A261' },
  Amended:          { bg: '#3B82F620', text: '#3B82F6' },
  Draft:            { bg: '#6B728020', text: 'var(--text-secondary)' },
};

// ─── Mock Data ───────────────────────────────────────────────

const RECORDS: MedicalRecord[] = [
  {
    id: 1, petName: 'Max', breed: 'Golden Retriever',
    petImage: 'https://images.unsplash.com/photo-1734966213753-1b361564bab4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb2xkZW4lMjByZXRyaWV2ZXIlMjBkb2clMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzMyNDMxMzB8MA&ixlib=rb-4.1.0&q=80&w=400',
    ownerName: 'John Smith', recordType: 'Visit', date: 'Mar 11, 2026', dateISO: '2026-03-11',
    vet: 'Dr. Sarah Chen', summary: 'Annual wellness exam — all vitals normal, weight stable', status: 'Final',
  },
  {
    id: 2, petName: 'Max', breed: 'Golden Retriever',
    petImage: 'https://images.unsplash.com/photo-1734966213753-1b361564bab4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb2xkZW4lMjByZXRyaWV2ZXIlMjBkb2clMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzMyNDMxMzB8MA&ixlib=rb-4.1.0&q=80&w=400',
    ownerName: 'John Smith', recordType: 'Lab Result', date: 'Mar 11, 2026', dateISO: '2026-03-11',
    vet: 'Dr. Sarah Chen', summary: 'CBC & comprehensive metabolic panel — within normal limits', status: 'Final',
  },
  {
    id: 3, petName: 'Luna', breed: 'Tabby',
    petImage: 'https://images.unsplash.com/photo-1670739088209-64414249354b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0YWJieSUyMGNhdCUyMHBvcnRyYWl0fGVufDF8fHx8MTc3MzI3OTg3NHww&ixlib=rb-4.1.0&q=80&w=400',
    ownerName: 'Emily Johnson', recordType: 'Vaccination', date: 'Mar 9, 2026', dateISO: '2026-03-09',
    vet: 'Dr. Sarah Chen', summary: 'FVRCP booster administered — no adverse reaction', status: 'Final',
  },
  {
    id: 4, petName: 'Cooper', breed: 'Beagle',
    petImage: 'https://images.unsplash.com/photo-1685387714439-edef4bd70ef5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWFnbGUlMjBkb2clMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzMyMzM4ODd8MA&ixlib=rb-4.1.0&q=80&w=400',
    ownerName: 'Michael Brown', recordType: 'Dental', date: 'Mar 11, 2026', dateISO: '2026-03-11',
    vet: 'Dr. Sarah Chen', summary: 'Full dental cleaning, 2 extractions (teeth 108, 309)', status: 'Final',
  },
  {
    id: 5, petName: 'Bella', breed: 'Siamese',
    petImage: 'https://images.unsplash.com/photo-1608574592993-774ffa9a218e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaWFtZXNlJTIwY2F0JTIwcG9ydHJhaXR8ZW58MXx8fHwxNzczMTczMjkwfDA&ixlib=rb-4.1.0&q=80&w=400',
    ownerName: 'Sarah Williams', recordType: 'Surgery', date: 'Mar 7, 2026', dateISO: '2026-03-07',
    vet: 'Dr. James Park', summary: 'Ovariohysterectomy (spay) — no complications, recovery normal', status: 'Final',
  },
  {
    id: 6, petName: 'Bella', breed: 'Siamese',
    petImage: 'https://images.unsplash.com/photo-1608574592993-774ffa9a218e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaWFtZXNlJTIwY2F0JTIwcG9ydHJhaXR8ZW58MXx8fHwxNzczMTczMjkwfDA&ixlib=rb-4.1.0&q=80&w=400',
    ownerName: 'Sarah Williams', recordType: 'Visit', date: 'Mar 10, 2026', dateISO: '2026-03-10',
    vet: 'Dr. Sarah Chen', summary: 'Post-surgery follow-up — incision healing well, sutures intact', status: 'Final',
  },
  {
    id: 7, petName: 'Charlie', breed: 'Corgi',
    petImage: 'https://images.unsplash.com/photo-1665918577658-c7cddc5fd53c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3JnaSUyMGRvZyUyMHBvcnRyYWl0fGVufDF8fHx8MTc3MzI3OTg3NHww&ixlib=rb-4.1.0&q=80&w=400',
    ownerName: 'David Miller', recordType: 'Prescription', date: 'Mar 5, 2026', dateISO: '2026-03-05',
    vet: 'Dr. Sarah Chen', summary: 'Carprofen 75mg for joint inflammation — 14-day course', status: 'Final',
  },
  {
    id: 8, petName: 'Rocky', breed: 'German Shepherd',
    petImage: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',
    ownerName: 'James Wilson', recordType: 'Imaging', date: 'Mar 3, 2026', dateISO: '2026-03-03',
    vet: 'Dr. James Park', summary: 'Thoracic radiographs (3 views) — mild cardiomegaly noted', status: 'Pending Review',
  },
  {
    id: 9, petName: 'Rocky', breed: 'German Shepherd',
    petImage: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',
    ownerName: 'James Wilson', recordType: 'Lab Result', date: 'Mar 3, 2026', dateISO: '2026-03-03',
    vet: 'Dr. James Park', summary: 'Cardiac biomarker panel — elevated NT-proBNP, recommend echo', status: 'Pending Review',
  },
  {
    id: 10, petName: 'Milo', breed: 'Persian',
    petImage: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400',
    ownerName: 'Jessica Taylor', recordType: 'Vaccination', date: 'Feb 28, 2026', dateISO: '2026-02-28',
    vet: 'Dr. Sarah Chen', summary: 'Rabies 3-year & FVRCP booster — both administered', status: 'Final',
  },
  {
    id: 11, petName: 'Daisy', breed: 'Labrador',
    petImage: 'https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=400',
    ownerName: 'Robert Anderson', recordType: 'Visit', date: 'Feb 25, 2026', dateISO: '2026-02-25',
    vet: 'Dr. Sarah Chen', summary: 'Limping on rear-left leg — suspected cruciate injury, imaging ordered', status: 'Amended',
  },
  {
    id: 12, petName: 'Daisy', breed: 'Labrador',
    petImage: 'https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=400',
    ownerName: 'Robert Anderson', recordType: 'Imaging', date: 'Feb 26, 2026', dateISO: '2026-02-26',
    vet: 'Dr. James Park', summary: 'Stifle radiographs — confirmed partial CCL tear, surgery recommended', status: 'Final',
  },
  {
    id: 13, petName: 'Simba', breed: 'Maine Coon',
    petImage: 'https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=400',
    ownerName: 'Lisa Martinez', recordType: 'Visit', date: 'Feb 20, 2026', dateISO: '2026-02-20',
    vet: 'Dr. Sarah Chen', summary: 'Wellness exam — overweight (14.2 lbs), diet plan discussed', status: 'Final',
  },
  {
    id: 14, petName: 'Buddy', breed: 'Poodle',
    petImage: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',
    ownerName: 'Karen Thomas', recordType: 'Dental', date: 'Feb 15, 2026', dateISO: '2026-02-15',
    vet: 'Dr. Sarah Chen', summary: 'Dental prophylaxis — Grade 2 periodontal disease, no extractions', status: 'Final',
  },
  {
    id: 15, petName: 'Luna', breed: 'Tabby',
    petImage: 'https://images.unsplash.com/photo-1670739088209-64414249354b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0YWJieSUyMGNhdCUyMHBvcnRyYWl0fGVufDF8fHx8MTc3MzI3OTg3NHww&ixlib=rb-4.1.0&q=80&w=400',
    ownerName: 'Emily Johnson', recordType: 'Lab Result', date: 'Mar 9, 2026', dateISO: '2026-03-09',
    vet: 'Dr. Sarah Chen', summary: 'Urinalysis — trace crystals, recommend diet change & recheck', status: 'Pending Review',
  },
  {
    id: 16, petName: 'Charlie', breed: 'Corgi',
    petImage: 'https://images.unsplash.com/photo-1665918577658-c7cddc5fd53c?w=400',
    ownerName: 'David Miller', recordType: 'Visit', date: 'Mar 5, 2026', dateISO: '2026-03-05',
    vet: 'Dr. Sarah Chen', summary: 'Lameness evaluation — bilateral hip dysplasia, mild to moderate', status: 'Final',
  },
  {
    id: 17, petName: 'Cooper', breed: 'Beagle',
    petImage: 'https://images.unsplash.com/photo-1685387714439-edef4bd70ef5?w=400',
    ownerName: 'Michael Brown', recordType: 'Prescription', date: 'Mar 11, 2026', dateISO: '2026-03-11',
    vet: 'Dr. Sarah Chen', summary: 'Amoxicillin 250mg post-dental — 10-day course with food', status: 'Draft',
  },
  {
    id: 18, petName: 'Max', breed: 'Golden Retriever',
    petImage: 'https://images.unsplash.com/photo-1734966213753-1b361564bab4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb2xkZW4lMjByZXRyaWV2ZXIlMjBkb2clMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzMyNDMxMzB8MA&ixlib=rb-4.1.0&q=80&w=400',
    ownerName: 'John Smith', recordType: 'Vaccination', date: 'Mar 11, 2026', dateISO: '2026-03-11',
    vet: 'Dr. Sarah Chen', summary: 'DHPP booster & Bordetella nasal — due for rabies in 6 months', status: 'Final',
  },
];

// ─── Component ───────────────────────────────────────────────

export default function RecordsPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const basePath = pathname.startsWith('/admin') ? '/admin/records' : '/records';
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filtered = RECORDS.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      r.petName.toLowerCase().includes(q) ||
      r.ownerName.toLowerCase().includes(q) ||
      r.vet.toLowerCase().includes(q) ||
      r.summary.toLowerCase().includes(q);
    const matchesType = typeFilter === 'all' || r.recordType === typeFilter;
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesDateFrom = !dateFrom || r.dateISO >= dateFrom;
    const matchesDateTo = !dateTo || r.dateISO <= dateTo;
    return matchesSearch && matchesType && matchesStatus && matchesDateFrom && matchesDateTo;
  });

  const pendingCount = RECORDS.filter((r) => r.status === 'Pending Review').length;
  const thisMonthCount = RECORDS.filter((r) => r.dateISO >= '2026-03-01').length;

  return (
    <div className="max-w-[1440px] mx-auto p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[var(--text-primary)] mb-2" style={{ fontSize: '32px', fontWeight: 700 }}>Records</h1>
        <p className="text-[var(--text-secondary)]" style={{ fontSize: '16px', fontWeight: 400 }}>
          Search, view, and export medical records.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Records" value={RECORDS.length.toString()} icon={FileText} trend={{ value: `${thisMonthCount} this month`, isPositive: true }} iconColor="var(--brand-green-text)" />
        <StatCard title="This Month" value={thisMonthCount.toString()} icon={CalendarDays} trend={{ value: '+5 from last month', isPositive: true }} iconColor="#3B82F6" />
        <StatCard title="Pending Review" value={pendingCount.toString()} icon={ClipboardList} trend={{ value: 'Needs attention', isPositive: false }} iconColor="#F4A261" />
        <StatCard title="Lab Results" value={RECORDS.filter((r) => r.recordType === 'Lab Result').length.toString()} icon={FlaskConical} trend={{ value: '2 awaiting results', isPositive: false }} iconColor="#8B5CF6" />
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <Input
            placeholder="Search by pet, owner, vet, or summary..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {(['Visit', 'Vaccination', 'Lab Result', 'Surgery', 'Prescription', 'Dental', 'Imaging'] as RecordType[]).map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {(['Final', 'Pending Review', 'Amended', 'Draft'] as RecordStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px]" />
          <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>to</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px]" min={dateFrom} />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)]" style={{ borderRadius: '12px' }}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {['Pet', 'Owner', 'Type', 'Date', 'Veterinarian', 'Summary', 'Status'].map((h) => (
                <TableHead key={h} className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((rec) => {
              const typeStyle = recordTypeColors[rec.recordType];
              const statusStyle = statusColors[rec.status];
              return (
                <TableRow
                  key={rec.id}
                  className="hover:bg-[var(--surface-elevated)] cursor-pointer transition-colors"
                  onClick={() => navigate(`${basePath}/${rec.id}`)}
                >
                  {/* Pet */}
                  <TableCell className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <img src={rec.petImage} alt={rec.petName} className="w-10 h-10 object-cover" style={{ borderRadius: '9999px' }} />
                      <div>
                        <p className="text-[var(--text-primary)]" style={{ fontSize: '15px', fontWeight: 600 }}>{rec.petName}</p>
                        <p className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>{rec.breed}</p>
                      </div>
                    </div>
                  </TableCell>
                  {/* Owner */}
                  <TableCell className="py-4 px-4">
                    <span className="text-[var(--text-primary)]" style={{ fontSize: '14px' }}>{rec.ownerName}</span>
                  </TableCell>
                  {/* Type */}
                  <TableCell className="py-4 px-4">
                    <span className="inline-block px-2.5 py-1" style={{ backgroundColor: typeStyle.bg, color: typeStyle.text, borderRadius: '9999px', fontSize: '12px', fontWeight: 600 }}>
                      {rec.recordType}
                    </span>
                  </TableCell>
                  {/* Date */}
                  <TableCell className="py-4 px-4">
                    <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{rec.date}</span>
                  </TableCell>
                  {/* Vet */}
                  <TableCell className="py-4 px-4">
                    <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{rec.vet}</span>
                  </TableCell>
                  {/* Summary */}
                  <TableCell className="py-4 px-4 max-w-[260px]">
                    <p className="text-[var(--text-secondary)] truncate" style={{ fontSize: '13px' }}>{rec.summary}</p>
                  </TableCell>
                  {/* Status */}
                  <TableCell className="py-4 px-4">
                    <span className="inline-block px-2.5 py-1" style={{ backgroundColor: statusStyle.bg, color: statusStyle.text, borderRadius: '9999px', fontSize: '12px', fontWeight: 600 }}>
                      {rec.status}
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
            Showing {filtered.length} of {RECORDS.length} records
          </p>
        </div>
      </div>
    </div>
  );
}
