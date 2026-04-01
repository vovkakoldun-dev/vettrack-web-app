import { useState, useEffect } from 'react';
import { Search, FlaskConical, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, ChevronRight, Download, Upload } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../components/ui/select';
import { useNavigate, useLocation } from 'react-router';
import { supabase } from '../../lib/supabase';

// ─── Types ─────────────────────────────────────────────────────

type LabFlag = 'Normal' | 'High' | 'Low' | 'Critical';
type LabCategory = 'Hematology' | 'Chemistry' | 'Urinalysis' | 'Cardiac' | 'Thyroid' | 'Microbiology' | 'Parasitology';

interface LabResult {
  id: number;
  dbId?: string;
  testName: string;
  category: LabCategory;
  petName: string;
  petImage: string;
  ownerName: string;
  date: string;
  result: string;
  unit: string;
  referenceRange: string;
  flag: LabFlag;
  vet: string;
  recordId: string;
  notes?: string;
}

// ─── Panel → Category mapping ────────────────────────────────────

const panelToCategory: Record<string, LabCategory> = {
  Hematology: 'Hematology',
  Chemistry: 'Chemistry',
  Urinalysis: 'Urinalysis',
  Cardiac: 'Cardiac',
  Thyroid: 'Thyroid',
  Microbiology: 'Microbiology',
  Parasitology: 'Parasitology',
  General: 'Hematology',
  Imaging: 'Hematology',
};

// ─── Helpers ───────────────────────────────────────────────────

const flagStyles: Record<LabFlag, { bg: string; text: string; border: string; icon: typeof CheckCircle2 }> = {
  Normal:   { bg: '#74C69D20', text: 'var(--brand-green-text)', border: '#74C69D', icon: CheckCircle2 },
  High:     { bg: '#F4A26120', text: '#D97706', border: '#F4A261', icon: TrendingUp },
  Low:      { bg: '#3B82F620', text: '#2563EB', border: '#3B82F6', icon: TrendingDown },
  Critical: { bg: '#d4183d20', text: '#d4183d', border: '#d4183d', icon: AlertTriangle },
};

const categoryColors: Record<LabCategory, string> = {
  Hematology:    '#3B82F6',
  Chemistry:     '#8B5CF6',
  Urinalysis:    '#06B6D4',
  Cardiac:       '#EC4899',
  Thyroid:       '#F4A261',
  Microbiology:  '#d4183d',
  Parasitology:  '#2D6A4F',
};

const CATEGORIES: LabCategory[] = ['Hematology', 'Chemistry', 'Urinalysis', 'Cardiac', 'Thyroid', 'Microbiology', 'Parasitology'];

function formatDate(d: string) {
  if (!d) return '—';
  // Handle both "2026-03-29" and full ISO "2026-03-29T..." formats
  const date = d.includes('T') ? new Date(d) : new Date(d + 'T12:00:00');
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Stat Card ────────────────────────────────────────────────

function StatCard({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  return (
    <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-5" style={{ borderRadius: '12px' }}>
      <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: '13px', fontWeight: 500 }}>{label}</p>
      <p style={{ fontSize: '32px', fontWeight: 700, color, lineHeight: 1.1 }}>{value}</p>
      {sub && <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '12px' }}>{sub}</p>}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────

export default function LabPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const basePath = pathname.startsWith('/admin') ? '/admin/records' : '/records';
  const [search, setSearch] = useState('');
  const [filterFlag, setFilterFlag] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPet, setFilterPet] = useState<string>('all');
  const [labResults, setLabResults] = useState<LabResult[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('lab_results')
        .select('id, test_name, test_panel, result_value, reference_range, unit, flag, notes, tested_at, reported_at, pets!left(id, name, species, photo_url), medical_records!left(id, clients!left(first_name, last_name)), staff!lab_results_ordered_by_fkey!left(id, profiles:profiles!staff_profile_id_fkey(first_name, last_name))')
        .order('tested_at', { ascending: false });
      if (data) {
        const mapped: LabResult[] = data.map((r: any, i: number) => {
          const flagMap: Record<string, LabFlag> = { normal: 'Normal', high: 'High', low: 'Low', critical: 'Critical' };
          return {
            id: i + 1,
            dbId: r.id,
            testName: r.test_name || '—',
            category: (panelToCategory[r.test_panel] || 'Hematology') as LabCategory,
            petName: r.pets?.name ?? '—',
            petImage: r.pets?.photo_url || '',
            ownerName: r.medical_records?.clients ? `${r.medical_records.clients.first_name} ${r.medical_records.clients.last_name}` : '—',
            date: r.tested_at || '',
            result: r.result_value || 'Pending',
            unit: r.unit || '',
            referenceRange: r.reference_range || '',
            flag: flagMap[r.flag] || 'Normal',
            vet: r.staff?.profiles ? `Dr. ${r.staff.profiles.first_name} ${r.staff.profiles.last_name}` : '—',
            recordId: r.medical_records?.id || '',
            notes: r.notes || undefined,
          };
        });
        setLabResults(mapped);
      }
    })();
  }, []);

  // Derived stats
  const total = labResults.length;
  const normal = labResults.filter((r) => r.flag === 'Normal').length;
  const abnormal = labResults.filter((r) => r.flag === 'High' || r.flag === 'Low').length;
  const critical = labResults.filter((r) => r.flag === 'Critical').length;

  // Unique pets for filter
  const uniquePets = Array.from(new Set(labResults.map((r) => r.petName))).sort();

  // Filtered results
  const filtered = labResults.filter((r) => {
    const q = search.toLowerCase();
    if (q && !(
      r.testName.toLowerCase().includes(q) ||
      r.petName.toLowerCase().includes(q) ||
      r.ownerName.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.result.toLowerCase().includes(q)
    )) return false;
    if (filterFlag !== 'all' && r.flag !== filterFlag) return false;
    if (filterCategory !== 'all' && r.category !== filterCategory) return false;
    if (filterPet !== 'all' && r.petName !== filterPet) return false;
    return true;
  });

  // Sort: critical first, then high/low, then normal; within same flag: newest first
  const flagOrder: Record<LabFlag, number> = { Critical: 0, High: 1, Low: 2, Normal: 3 };
  const sorted = [...filtered].sort((a, b) => {
    const fd = flagOrder[a.flag] - flagOrder[b.flag];
    if (fd !== 0) return fd;
    return b.date.localeCompare(a.date);
  });

  return (
    <div className="max-w-[1440px] mx-auto p-8">
      {/* ─── Page Header ─── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[var(--text-primary)]" style={{ fontSize: '32px', fontWeight: 700 }}>Lab Results</h1>
          <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '16px' }}>
            All diagnostic laboratory findings across patients.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Upload className="w-4 h-4" /> Import Result
          </Button>
          <Button>
            <FlaskConical className="w-4 h-4" /> Order New Test
          </Button>
        </div>
      </div>

      {/* ─── Stat Cards ─── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Results" value={total} color="var(--text-primary)" sub="All time" />
        <StatCard label="Normal" value={normal} color="var(--brand-green-text)" sub={total > 0 ? `${Math.round((normal / total) * 100)}% of results` : '0% of results'} />
        <StatCard label="Abnormal" value={abnormal} color="#D97706" sub="High or Low flags" />
        <StatCard label="Critical" value={critical} color="#d4183d" sub="Immediate attention" />
      </div>

      {/* ─── Filter Bar ─── */}
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-4 mb-4 flex items-center gap-3 flex-wrap" style={{ borderRadius: '12px' }}>
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <Input
            placeholder="Search test, pet, owner…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Category */}
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Flag */}
        <Select value={filterFlag} onValueChange={setFilterFlag}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Flag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Flags</SelectItem>
            <SelectItem value="Normal">Normal</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
            <SelectItem value="Critical">Critical</SelectItem>
          </SelectContent>
        </Select>

        {/* Pet */}
        <Select value={filterPet} onValueChange={setFilterPet}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="Patient" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Patients</SelectItem>
            {uniquePets.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Export */}
        <Button variant="outline" className="h-9 gap-1.5 ml-auto">
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {/* ─── Results Table ─── */}
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] overflow-hidden" style={{ borderRadius: '12px' }}>
        {/* Table header */}
        <div
          className="grid border-b border-[var(--border-color)] px-5 py-3"
          style={{
            gridTemplateColumns: '2fr 1.5fr 120px 130px 150px 100px 90px 32px',
            fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)',
            letterSpacing: '0.05em', textTransform: 'uppercase',
          }}
        >
          <div>Test</div>
          <div>Patient</div>
          <div>Date</div>
          <div>Result</div>
          <div>Reference Range</div>
          <div>Vet</div>
          <div>Flag</div>
          <div />
        </div>

        {sorted.length === 0 ? (
          <div className="p-12 text-center">
            <FlaskConical className="w-12 h-12 text-[var(--border-color)] mx-auto mb-3" />
            <p className="text-[var(--text-primary)] mb-1" style={{ fontSize: '16px', fontWeight: 600 }}>No results found</p>
            <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Try adjusting your filters or search.</p>
          </div>
        ) : (
          sorted.map((r, i) => {
            const fs = flagStyles[r.flag];
            const FlagIcon = fs.icon;
            const catColor = categoryColors[r.category];
            const isLast = i === sorted.length - 1;

            return (
              <div
                key={r.id}
                className={`grid items-center px-5 py-3.5 cursor-pointer hover:bg-[var(--surface-elevated)] transition-colors ${!isLast ? 'border-b border-[var(--border-color)]' : ''}`}
                style={{ gridTemplateColumns: '2fr 1.5fr 120px 130px 150px 100px 90px 32px' }}
                onClick={() => r.recordId ? navigate(`${basePath}/${r.recordId}`) : undefined}
              >
                {/* Test name + category */}
                <div>
                  <p className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>{r.testName}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="inline-block px-1.5 py-0.5"
                      style={{
                        backgroundColor: catColor + '15',
                        color: catColor,
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}
                    >
                      {r.category}
                    </span>
                    {r.notes && (
                      <span className="text-[#9CA3AF] truncate max-w-[180px]" style={{ fontSize: '11px' }}>
                        {r.notes}
                      </span>
                    )}
                  </div>
                </div>

                {/* Patient */}
                <div className="flex items-center gap-2.5">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={r.petImage} alt={r.petName} className="object-cover" />
                    <AvatarFallback>{r.petName.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-[var(--text-primary)] truncate" style={{ fontSize: '14px', fontWeight: 600 }}>{r.petName}</p>
                    <p className="text-[var(--text-secondary)] truncate" style={{ fontSize: '12px' }}>{r.ownerName}</p>
                  </div>
                </div>

                {/* Date */}
                <div className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{formatDate(r.date)}</div>

                {/* Result */}
                <div>
                  <span
                    className="font-bold"
                    style={{ fontSize: '14px', color: r.flag === 'Normal' ? 'var(--text-primary)' : fs.text }}
                  >
                    {r.result}
                  </span>
                  {r.unit && (
                    <span className="text-[var(--text-secondary)] ml-1" style={{ fontSize: '12px' }}>{r.unit}</span>
                  )}
                </div>

                {/* Reference Range */}
                <div className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{r.referenceRange || '—'}</div>

                {/* Vet */}
                <div className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{r.vet}</div>

                {/* Flag Badge */}
                <div>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5"
                    style={{
                      backgroundColor: fs.bg,
                      color: fs.text,
                      borderRadius: '9999px',
                      fontSize: '11px',
                      fontWeight: 700,
                      border: `1px solid ${fs.border}30`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <FlagIcon className="w-3 h-3" />
                    {r.flag}
                  </span>
                </div>

                {/* Arrow */}
                <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
              </div>
            );
          })
        )}
      </div>

      {/* ─── Footer ─── */}
      {sorted.length > 0 && (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>
            Showing <span className="font-semibold text-[var(--text-primary)]">{sorted.length}</span> of{' '}
            <span className="font-semibold text-[var(--text-primary)]">{total}</span> results
          </p>
          <div className="flex items-center gap-3">
            {(['Normal', 'High', 'Low', 'Critical'] as LabFlag[]).map((f) => {
              const count = sorted.filter((r) => r.flag === f).length;
              if (!count) return null;
              const fs = flagStyles[f];
              return (
                <span key={f} className="flex items-center gap-1" style={{ fontSize: '12px', color: fs.text }}>
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: fs.text }} />
                  {f}: {count}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
