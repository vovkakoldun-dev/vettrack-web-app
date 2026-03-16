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

const RECORDS: MedicalRecord[] = []

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

  const filtered = [].filter((r) => {
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

  const pendingCount = [].filter((r) => r.status === 'Pending Review').length;
  const thisMonthCount = [].filter((r) => r.dateISO >= '2026-03-01').length;

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
