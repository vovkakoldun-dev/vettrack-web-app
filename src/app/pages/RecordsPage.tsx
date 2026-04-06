import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import {
  Search, FileText, CalendarDays, ClipboardList, FlaskConical, Trash2, X,
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { StatCard } from '../components/StatCard';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../components/ui/select';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '../components/ui/table';
import { useTenantDb } from '../context/TenantContext';
// ─── Types ───────────────────────────────────────────────────

type RecordType = 'Visit' | 'Vaccination' | 'Lab Result' | 'Surgery' | 'Prescription' | 'Dental' | 'Imaging';
type RecordStatus = 'Final' | 'Pending Review' | 'Amended' | 'Draft';

interface MedicalRecord {
  id: number;
  dbId?: string;
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
  Visit:        { bg: 'color-mix(in srgb, var(--brand-green-text) 12%, transparent)', text: 'var(--brand-green-text)' },
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

// ─── Component ───────────────────────────────────────────────

export default function RecordsPage() {
  const db = useTenantDb();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const basePath = pathname.startsWith('/admin') ? '/admin/records' : '/records';
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const toggleSelect = (dbId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(dbId)) next.delete(dbId); else next.add(dbId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(r => r.dbId!).filter(Boolean)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    const ids = Array.from(selectedIds);
    const { error } = await db.from('medical_records').delete().in('id', ids);
    if (!error) {
      setRecords(prev => prev.filter(r => !r.dbId || !selectedIds.has(r.dbId)));
      setSelectedIds(new Set());
      setSelectMode(false);
    }
    setDeleting(false);
    setShowDeleteConfirm(false);
  };

  useEffect(() => {
    (async () => {
      const { data } = await db
        .from('medical_records')
        .select('id, record_number, record_type, status, visit_date, visit_time, reason, clinical_notes, duration_minutes, pets!left(id, name, species, breed, photo_url), clients!left(id, first_name, last_name), staff!medical_records_vet_org_fkey!left(id, profiles:profiles!staff_profile_org_fkey(first_name, last_name))')
        .order('visit_date', { ascending: false });
      if (data) {
        const mapped: MedicalRecord[] = data.map((r: any, i: number) => {
          const d = new Date(r.visit_date + 'T12:00:00');
          return {
            id: i + 1,
            dbId: r.id,
            petName: r.pets?.name ?? '—',
            petImage: r.pets?.photo_url || '',
            breed: r.pets?.breed ?? '—',
            ownerName: r.clients ? `${r.clients.first_name} ${r.clients.last_name}` : '—',
            recordType: (r.record_type || 'Visit') as RecordType,
            date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            dateISO: r.visit_date,
            vet: r.staff?.profiles ? `Dr. ${r.staff.profiles.first_name} ${r.staff.profiles.last_name}` : '—',
            summary: r.reason || r.clinical_notes || '—',
            status: (r.status || 'Final') as RecordStatus,
          };
        });
        setRecords(mapped);
      }
    })();
  }, []);

  const filtered = records.filter((r) => {
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

  const pendingCount = records.filter((r) => r.status === 'Pending Review').length;
  const thisMonthCount = records.filter((r) => r.dateISO >= '2026-03-01').length;

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
        <StatCard title="Total Records" value={records.length.toString()} icon={FileText} trend={{ value: `${thisMonthCount} this month`, isPositive: true }} iconColor="var(--brand-green-text)" />
        <StatCard title="This Month" value={thisMonthCount.toString()} icon={CalendarDays} trend={{ value: '+5 from last month', isPositive: true }} iconColor="#3B82F6" />
        <StatCard title="Pending Review" value={pendingCount.toString()} icon={ClipboardList} trend={{ value: 'Needs attention', isPositive: false }} iconColor="#F4A261" />
        <StatCard title="Lab Results" value={records.filter((r) => r.recordType === 'Lab Result').length.toString()} icon={FlaskConical} trend={{ value: '2 awaiting results', isPositive: false }} iconColor="#8B5CF6" />
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

      {/* Selection bar */}
      {selectMode && (
        <div className="flex items-center gap-3 mb-4 px-4 py-3 border border-[var(--border-color)] bg-[var(--surface-elevated)]" style={{ borderRadius: '10px' }}>
          <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>
            {selectedIds.size > 0 ? `${selectedIds.size} record${selectedIds.size !== 1 ? 's' : ''} selected` : 'Select records to delete'}
          </span>
          {selectedIds.size > 0 && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#EF4444', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
            >
              <Trash2 style={{ width: '14px', height: '14px' }} /> Delete
            </button>
          )}
          <button
            onClick={() => { setSelectedIds(new Set()); setSelectMode(false); }}
            className="flex items-center gap-1 px-3 py-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
          >
            <X style={{ width: '14px', height: '14px' }} /> Cancel
          </button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6" style={{ borderRadius: '14px', maxWidth: '420px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center" style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#FEE2E2' }}>
                <Trash2 style={{ width: '20px', height: '20px', color: '#EF4444' }} />
              </div>
              <h3 className="text-[var(--text-primary)]" style={{ fontSize: '18px', fontWeight: 700 }}>Delete Records</h3>
            </div>
            <p className="text-[var(--text-secondary)] mb-6" style={{ fontSize: '14px', lineHeight: '1.5' }}>
              Are you sure you want to delete <strong className="text-[var(--text-primary)]">{selectedIds.size} record{selectedIds.size !== 1 ? 's' : ''}</strong>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={deleting}
                className="px-4 py-2 text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#EF4444', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', opacity: deleting ? 0.6 : 1 }}
              >
                {deleting ? 'Deleting...' : `Delete ${selectedIds.size} Record${selectedIds.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)]" style={{ borderRadius: '12px' }}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="py-3 px-4" style={{ width: '44px' }}>
                <div
                  onClick={() => {
                    if (!selectMode) { setSelectMode(true); }
                    else { toggleSelectAll(); }
                  }}
                  style={{
                    width: '18px', height: '18px', borderRadius: '4px', cursor: 'pointer',
                    border: selectMode && selectedIds.size === filtered.length && filtered.length > 0
                      ? '2px solid var(--brand-green-text)'
                      : '2px solid var(--text-secondary)',
                    backgroundColor: selectMode && selectedIds.size === filtered.length && filtered.length > 0
                      ? 'var(--brand-green-text)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: selectMode ? 1 : 0.5,
                    transition: 'all 0.15s ease',
                  }}
                  title={selectMode ? 'Select all' : 'Enable selection mode'}
                >
                  {selectMode && selectedIds.size === filtered.length && filtered.length > 0 && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                  {selectMode && selectedIds.size > 0 && selectedIds.size < filtered.length && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 6h6" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round"/></svg>
                  )}
                </div>
              </TableHead>
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
              const isSelected = rec.dbId ? selectedIds.has(rec.dbId) : false;
              return (
                <TableRow
                  key={rec.id}
                  className="hover:bg-[var(--surface-elevated)] cursor-pointer transition-colors"
                  style={isSelected ? { backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)' } : undefined}
                  onClick={() => navigate(`${basePath}/${rec.dbId || rec.id}`)}
                >
                  {/* Checkbox */}
                  <TableCell className="py-4 px-4" style={{ width: '44px' }}>
                    {selectMode && (
                      <div
                        onClick={(e) => { e.stopPropagation(); toggleSelect(rec.dbId!); }}
                        style={{
                          width: '18px', height: '18px', borderRadius: '4px', cursor: 'pointer',
                          border: isSelected ? '2px solid var(--brand-green-text)' : '2px solid var(--text-secondary)',
                          backgroundColor: isSelected ? 'var(--brand-green-text)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isSelected && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        )}
                      </div>
                    )}
                  </TableCell>
                  {/* Pet */}
                  <TableCell className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      {rec.petImage ? (
                        <img src={rec.petImage} alt={rec.petName} className="w-10 h-10 object-cover" style={{ borderRadius: '9999px' }} />
                      ) : (
                        <div className="w-10 h-10 flex items-center justify-center text-white font-semibold flex-shrink-0" style={{ borderRadius: '9999px', backgroundColor: 'var(--brand-green-text)', fontSize: '13px' }}>{rec.petName.slice(0, 2).toUpperCase()}</div>
                      )}
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
            Showing {filtered.length} of {records.length} records
          </p>
        </div>
      </div>
    </div>
  );
}
