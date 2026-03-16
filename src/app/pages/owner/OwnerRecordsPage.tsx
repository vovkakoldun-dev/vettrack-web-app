import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Search, FileText, CalendarDays, FlaskConical, Lock, Clock3, CheckCircle2,
} from 'lucide-react';
import { Input } from '../../components/ui/input';
import { StatCard } from '../../components/StatCard';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../../components/ui/select';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '../../components/ui/table';

// ─── Types ───────────────────────────────────────────────────

type RecordType = 'Visit' | 'Vaccination' | 'Lab Result' | 'Surgery' | 'Prescription' | 'Dental' | 'Imaging';
type RecordStatus = 'Final' | 'Pending Vet Review' | 'In Progress';

interface OwnerMedicalRecord {
  id: number;
  petName: string;
  petImage: string;
  breed: string;
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

const STATUS_CONFIG: Record<RecordStatus, {
  bg: string; text: string; border: string;
  Icon: typeof CheckCircle2; label: string; locked: boolean;
}> = {
  'Final': {
    bg: '#74C69D20', text: 'var(--brand-green-text)', border: '#74C69D40',
    Icon: CheckCircle2, label: 'Final', locked: false,
  },
  'Pending Vet Review': {
    bg: '#F4A26118', text: '#D97706', border: '#F4A26140',
    Icon: Lock, label: 'Pending Vet Review', locked: true,
  },
  'In Progress': {
    bg: '#3B82F615', text: '#3B82F6', border: '#3B82F630',
    Icon: Clock3, label: 'In Progress', locked: true,
  },
};

// ─── Mock Data ───────────────────────────────────────────────

const MAX_IMAGE = 'https://images.unsplash.com/photo-1734966213753-1b361564bab4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb2xkZW4lMjByZXRyaWV2ZXIlMjBkb2clMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzMyNDMxMzB8MA&ixlib=rb-4.1.0&q=80&w=400';
const HUGO_IMAGE = 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400';

const OWNER_RECORDS: OwnerMedicalRecord[] = [
  {
    id: 1, petName: 'Max', breed: 'Golden Retriever', petImage: MAX_IMAGE,
    recordType: 'Visit', date: 'Mar 11, 2026', dateISO: '2026-03-11',
    vet: 'Dr. Sarah Chen', summary: 'Annual wellness exam — all vitals normal, weight stable',
    status: 'Final',
  },
  {
    id: 2, petName: 'Max', breed: 'Golden Retriever', petImage: MAX_IMAGE,
    recordType: 'Lab Result', date: 'Mar 11, 2026', dateISO: '2026-03-11',
    vet: 'Dr. Sarah Chen', summary: 'CBC & comprehensive metabolic panel',
    status: 'In Progress',
  },
  {
    id: 3, petName: 'Max', breed: 'Golden Retriever', petImage: MAX_IMAGE,
    recordType: 'Vaccination', date: 'Mar 11, 2026', dateISO: '2026-03-11',
    vet: 'Dr. Sarah Chen', summary: 'DHPP booster & Bordetella nasal — due for rabies in 6 months',
    status: 'Final',
  },
  {
    id: 4, petName: 'Max', breed: 'Golden Retriever', petImage: MAX_IMAGE,
    recordType: 'Prescription', date: 'Feb 20, 2026', dateISO: '2026-02-20',
    vet: 'Dr. Sarah Chen', summary: 'Dasuquin Advanced for hip dysplasia — ongoing joint support',
    status: 'Final',
  },
  {
    id: 5, petName: 'Hugo', breed: 'Persian Cat', petImage: HUGO_IMAGE,
    recordType: 'Visit', date: 'Feb 1, 2026', dateISO: '2026-02-01',
    vet: 'Dr. Sarah Chen', summary: 'Dental recheck — notes being reviewed by vet',
    status: 'Pending Vet Review',
  },
  {
    id: 6, petName: 'Hugo', breed: 'Persian Cat', petImage: HUGO_IMAGE,
    recordType: 'Lab Result', date: 'Feb 1, 2026', dateISO: '2026-02-01',
    vet: 'Dr. Sarah Chen', summary: 'Urinalysis — results under vet review',
    status: 'Pending Vet Review',
  },
  {
    id: 7, petName: 'Hugo', breed: 'Persian Cat', petImage: HUGO_IMAGE,
    recordType: 'Dental', date: 'Jan 15, 2026', dateISO: '2026-01-15',
    vet: 'Dr. Sarah Chen', summary: 'Full dental cleaning — Grade 2 periodontal disease, 1 extraction',
    status: 'Final',
  },
  {
    id: 8, petName: 'Hugo', breed: 'Persian Cat', petImage: HUGO_IMAGE,
    recordType: 'Vaccination', date: 'Dec 10, 2025', dateISO: '2025-12-10',
    vet: 'Dr. Raj Patel', summary: 'FeLV & FVRCP boosters administered — no adverse reaction',
    status: 'Final',
  },
];

// ─── Component ───────────────────────────────────────────────

export default function OwnerRecordsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [petFilter, setPetFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filtered = OWNER_RECORDS.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      r.petName.toLowerCase().includes(q) ||
      r.vet.toLowerCase().includes(q) ||
      r.summary.toLowerCase().includes(q);
    const matchesType   = typeFilter   === 'all' || r.recordType === typeFilter;
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesPet    = petFilter    === 'all' || r.petName === petFilter;
    const matchesDateFrom = !dateFrom || r.dateISO >= dateFrom;
    const matchesDateTo   = !dateTo   || r.dateISO <= dateTo;
    return matchesSearch && matchesType && matchesStatus && matchesPet && matchesDateFrom && matchesDateTo;
  });

  const thisMonthCount  = OWNER_RECORDS.filter((r) => r.dateISO >= '2026-03-01').length;
  const labCount        = OWNER_RECORDS.filter((r) => r.recordType === 'Lab Result').length;
  const pendingCount    = OWNER_RECORDS.filter((r) => r.status === 'Pending Vet Review' || r.status === 'In Progress').length;

  return (
    <div className="max-w-[1440px] mx-auto p-8">

      {/* ── Header ── */}
      <div className="mb-8">
        <h1 className="text-[var(--text-primary)] mb-2" style={{ fontSize: '32px', fontWeight: 700 }}>My Records</h1>
        <p className="text-[var(--text-secondary)]" style={{ fontSize: '16px' }}>
          Medical history for Max &amp; Hugo
        </p>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Records"
          value={OWNER_RECORDS.length.toString()}
          icon={FileText}
          trend={{ value: `${thisMonthCount} this month`, isPositive: true }}
          iconColor="var(--brand-green-text)"
        />
        <StatCard
          title="This Month"
          value={thisMonthCount.toString()}
          icon={CalendarDays}
          trend={{ value: 'Recent visits', isPositive: true }}
          iconColor="#3B82F6"
        />
        <StatCard
          title="Lab Results"
          value={labCount.toString()}
          icon={FlaskConical}
          trend={{ value: '1 in progress', isPositive: false }}
          iconColor="#8B5CF6"
        />
        <StatCard
          title="Awaiting Review"
          value={pendingCount.toString()}
          icon={Lock}
          trend={{ value: 'Locked until vet reviews', isPositive: false }}
          iconColor="#D97706"
        />
      </div>

      {/* ── Status legend ── */}
      <div style={{
        display: 'flex', gap: '24px', marginBottom: '20px', padding: '12px 16px',
        backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)',
        borderRadius: '10px', flexWrap: 'wrap',
      }}>
        {(Object.entries(STATUS_CONFIG) as [RecordStatus, typeof STATUS_CONFIG[RecordStatus]][]).map(([status, cfg]) => {
          const Icon = cfg.Icon;
          return (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700,
                backgroundColor: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`,
              }}>
                <Icon style={{ width: 10, height: 10 }} />
                {cfg.label}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {status === 'Final' && '— Record is complete and available'}
                {status === 'Pending Vet Review' && '— Locked until your vet reviews and approves'}
                {status === 'In Progress' && '— Lab results are being processed'}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Search + Filters ── */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <Input
            placeholder="Search by pet, vet, or summary..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={petFilter} onValueChange={setPetFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Pets" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Pets</SelectItem>
            <SelectItem value="Max">🐕 Max</SelectItem>
            <SelectItem value="Hugo">🐈 Hugo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {(['Visit', 'Vaccination', 'Lab Result', 'Surgery', 'Prescription', 'Dental', 'Imaging'] as RecordType[]).map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[185px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Final">✅ Final</SelectItem>
            <SelectItem value="Pending Vet Review">🔒 Pending Vet Review</SelectItem>
            <SelectItem value="In Progress">⏳ In Progress</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px]" />
          <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>to</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px]" min={dateFrom} />
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)]" style={{ borderRadius: '12px', overflow: 'hidden' }}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {['Pet', 'Type', 'Date', 'Veterinarian', 'Summary', 'Status'].map((h) => (
                <TableHead key={h} className="py-3 px-4" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((rec) => {
              const typeStyle  = recordTypeColors[rec.recordType];
              const statusCfg  = STATUS_CONFIG[rec.status];
              const StatusIcon = statusCfg.Icon;
              const isLocked   = statusCfg.locked;

              return (
                <TableRow
                  key={rec.id}
                  onClick={() => !isLocked && navigate(`/owner/records/${rec.id}`)}
                  style={{ cursor: isLocked ? 'default' : 'pointer', opacity: isLocked ? 0.72 : 1 }}
                  className={isLocked ? '' : 'hover:bg-[var(--surface-elevated)] transition-colors'}
                >
                  {/* Pet */}
                  <TableCell className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <img
                          src={rec.petImage} alt={rec.petName}
                          className="w-10 h-10 object-cover"
                          style={{ borderRadius: '9999px', filter: isLocked ? 'grayscale(30%)' : 'none' }}
                        />
                        {isLocked && (
                          <div style={{
                            position: 'absolute', inset: 0, borderRadius: '9999px',
                            backgroundColor: 'rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Lock style={{ width: 12, height: 12, color: '#fff' }} />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-[var(--text-primary)]" style={{ fontSize: '15px', fontWeight: 600 }}>{rec.petName}</p>
                        <p className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>{rec.breed}</p>
                      </div>
                    </div>
                  </TableCell>

                  {/* Type */}
                  <TableCell className="py-4 px-4">
                    <span style={{ display: 'inline-block', padding: '3px 10px', backgroundColor: typeStyle.bg, color: typeStyle.text, borderRadius: '9999px', fontSize: '12px', fontWeight: 600 }}>
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
                  <TableCell className="py-4 px-4" style={{ maxWidth: '300px' }}>
                    {isLocked ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <StatusIcon style={{ width: 13, height: 13, color: statusCfg.text, flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          {rec.status === 'Pending Vet Review'
                            ? 'Available once your vet completes their review'
                            : 'Lab results are being processed — check back soon'}
                        </span>
                      </div>
                    ) : (
                      <p className="text-[var(--text-secondary)] truncate" style={{ fontSize: '13px' }}>{rec.summary}</p>
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell className="py-4 px-4">
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '4px 11px', borderRadius: '9999px', fontSize: '12px', fontWeight: 700,
                      backgroundColor: statusCfg.bg, color: statusCfg.text,
                      border: `1px solid ${statusCfg.border}`,
                    }}>
                      <StatusIcon style={{ width: 11, height: 11 }} />
                      {statusCfg.label}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-color)] flex items-center justify-between">
          <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>
            Showing {filtered.length} of {OWNER_RECORDS.length} records
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Lock style={{ width: 12, height: 12, color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {OWNER_RECORDS.filter(r => r.status !== 'Final').length} record{OWNER_RECORDS.filter(r => r.status !== 'Final').length !== 1 ? 's' : ''} locked
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
