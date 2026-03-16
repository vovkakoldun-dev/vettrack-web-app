import { useState } from 'react';
import { Search, FlaskConical, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, ChevronRight, Download, Upload } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../components/ui/select';
import { useNavigate } from 'react-router';

// ─── Types ─────────────────────────────────────────────────────

type LabFlag = 'Normal' | 'High' | 'Low' | 'Critical';
type LabCategory = 'Hematology' | 'Chemistry' | 'Urinalysis' | 'Cardiac' | 'Thyroid' | 'Microbiology' | 'Parasitology';

interface LabResult {
  id: number;
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
  recordId: number;
  notes?: string;
}

// ─── Mock Data ─────────────────────────────────────────────────

const LAB_RESULTS: LabResult[] = [
  // Max — Wellness Visit (Record VT-2026-001542)
  {
    id: 1, testName: 'WBC Count', category: 'Hematology',
    petName: 'Max', petImage: 'https://images.unsplash.com/photo-1734966213753-1b361564bab4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb2xkZW4lMjByZXRyaWV2ZXIlMjBkb2clMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzMyNDMxMzB8MA&ixlib=rb-4.1.0&q=80&w=400',
    ownerName: 'John Smith', date: '2026-03-10', result: '6.8', unit: '10³/µL',
    referenceRange: '5.0–11.0', flag: 'Normal', vet: 'Dr. Chen', recordId: 1,
    notes: 'Within normal limits',
  },
  {
    id: 2, testName: 'RBC Count', category: 'Hematology',
    petName: 'Max', petImage: 'https://images.unsplash.com/photo-1734966213753-1b361564bab4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb2xkZW4lMjByZXRyaWV2ZXIlMjBkb2clMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzMyNDMxMzB8MA&ixlib=rb-4.1.0&q=80&w=400',
    ownerName: 'John Smith', date: '2026-03-10', result: '6.2', unit: '10⁶/µL',
    referenceRange: '5.5–8.5', flag: 'Normal', vet: 'Dr. Chen', recordId: 1,
  },
  {
    id: 3, testName: 'Hemoglobin', category: 'Hematology',
    petName: 'Max', petImage: 'https://images.unsplash.com/photo-1734966213753-1b361564bab4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb2xkZW4lMjByZXRyaWV2ZXIlMjBkb2clMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzMyNDMxMzB8MA&ixlib=rb-4.1.0&q=80&w=400',
    ownerName: 'John Smith', date: '2026-03-10', result: '14.8', unit: 'g/dL',
    referenceRange: '12.0–18.0', flag: 'Normal', vet: 'Dr. Chen', recordId: 1,
  },
  {
    id: 4, testName: 'ALT (SGPT)', category: 'Chemistry',
    petName: 'Max', petImage: 'https://images.unsplash.com/photo-1734966213753-1b361564bab4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb2xkZW4lMjByZXRyaWV2ZXIlMjBkb2clMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzMyNDMxMzB8MA&ixlib=rb-4.1.0&q=80&w=400',
    ownerName: 'John Smith', date: '2026-03-10', result: '28', unit: 'U/L',
    referenceRange: '10–58', flag: 'Normal', vet: 'Dr. Chen', recordId: 1,
  },
  {
    id: 5, testName: 'Creatinine', category: 'Chemistry',
    petName: 'Max', petImage: 'https://images.unsplash.com/photo-1734966213753-1b361564bab4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb2xkZW4lMjByZXRyaWV2ZXIlMjBkb2clMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzMyNDMxMzB8MA&ixlib=rb-4.1.0&q=80&w=400',
    ownerName: 'John Smith', date: '2026-03-10', result: '0.9', unit: 'mg/dL',
    referenceRange: '0.5–1.8', flag: 'Normal', vet: 'Dr. Chen', recordId: 1,
  },
  {
    id: 6, testName: 'Glucose', category: 'Chemistry',
    petName: 'Max', petImage: 'https://images.unsplash.com/photo-1734966213753-1b361564bab4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb2xkZW4lMjByZXRyaWV2ZXIlMjBkb2clMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzMyNDMxMzB8MA&ixlib=rb-4.1.0&q=80&w=400',
    ownerName: 'John Smith', date: '2026-03-10', result: '98', unit: 'mg/dL',
    referenceRange: '70–138', flag: 'Normal', vet: 'Dr. Chen', recordId: 1,
  },
  {
    id: 7, testName: 'Urinary Specific Gravity', category: 'Urinalysis',
    petName: 'Max', petImage: 'https://images.unsplash.com/photo-1734966213753-1b361564bab4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb2xkZW4lMjByZXRyaWV2ZXIlMjBkb2clMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzMyNDMxMzB8MA&ixlib=rb-4.1.0&q=80&w=400',
    ownerName: 'John Smith', date: '2026-03-10', result: '1.025', unit: '',
    referenceRange: '1.015–1.045', flag: 'Normal', vet: 'Dr. Chen', recordId: 1,
  },

  // Bella — Spay Surgery (Record VT-2026-001478)
  {
    id: 8, testName: 'WBC Count', category: 'Hematology',
    petName: 'Bella', petImage: 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?w=400',
    ownerName: 'Sarah Williams', date: '2026-02-28', result: '9.2', unit: '10³/µL',
    referenceRange: '5.5–19.5', flag: 'Normal', vet: 'Dr. Garcia', recordId: 5,
    notes: 'Pre-operative baseline',
  },
  {
    id: 9, testName: 'Platelet Count', category: 'Hematology',
    petName: 'Bella', petImage: 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?w=400',
    ownerName: 'Sarah Williams', date: '2026-02-28', result: '210', unit: '10³/µL',
    referenceRange: '175–500', flag: 'Normal', vet: 'Dr. Garcia', recordId: 5,
  },
  {
    id: 10, testName: 'ALT (SGPT)', category: 'Chemistry',
    petName: 'Bella', petImage: 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?w=400',
    ownerName: 'Sarah Williams', date: '2026-02-28', result: '45', unit: 'U/L',
    referenceRange: '10–100', flag: 'Normal', vet: 'Dr. Garcia', recordId: 5,
  },
  {
    id: 11, testName: 'Creatinine', category: 'Chemistry',
    petName: 'Bella', petImage: 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?w=400',
    ownerName: 'Sarah Williams', date: '2026-02-28', result: '0.7', unit: 'mg/dL',
    referenceRange: '0.6–2.4', flag: 'Normal', vet: 'Dr. Garcia', recordId: 5,
  },

  // Rocky — Cardiac Evaluation (Record VT-2026-001390)
  {
    id: 12, testName: 'WBC Count', category: 'Hematology',
    petName: 'Rocky', petImage: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',
    ownerName: 'James Wilson', date: '2026-01-15', result: '12.4', unit: '10³/µL',
    referenceRange: '5.0–11.0', flag: 'High', vet: 'Dr. Patel', recordId: 8,
    notes: 'Mild leukocytosis — possible inflammatory response',
  },
  {
    id: 13, testName: 'Hemoglobin', category: 'Hematology',
    petName: 'Rocky', petImage: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',
    ownerName: 'James Wilson', date: '2026-01-15', result: '12.1', unit: 'g/dL',
    referenceRange: '12.0–18.0', flag: 'Low', vet: 'Dr. Patel', recordId: 8,
    notes: 'Borderline low — monitor for anemia progression',
  },
  {
    id: 14, testName: 'Troponin I', category: 'Cardiac',
    petName: 'Rocky', petImage: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',
    ownerName: 'James Wilson', date: '2026-01-15', result: '0.12', unit: 'ng/mL',
    referenceRange: '<0.07', flag: 'Critical', vet: 'Dr. Patel', recordId: 8,
    notes: 'Elevated cardiac troponin — indicates myocardial injury. Recheck in 4 hours.',
  },
  {
    id: 15, testName: 'NT-proBNP', category: 'Cardiac',
    petName: 'Rocky', petImage: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',
    ownerName: 'James Wilson', date: '2026-01-15', result: '850', unit: 'pmol/L',
    referenceRange: '<900', flag: 'High', vet: 'Dr. Patel', recordId: 8,
    notes: 'Approaching critical threshold — consistent with congestive heart failure',
  },
  {
    id: 16, testName: 'C-Reactive Protein', category: 'Chemistry',
    petName: 'Rocky', petImage: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',
    ownerName: 'James Wilson', date: '2026-01-15', result: '2.8', unit: 'mg/dL',
    referenceRange: '<1.0', flag: 'Critical', vet: 'Dr. Patel', recordId: 8,
    notes: 'Significantly elevated — systemic inflammation',
  },
  {
    id: 17, testName: 'Creatinine', category: 'Chemistry',
    petName: 'Rocky', petImage: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',
    ownerName: 'James Wilson', date: '2026-01-15', result: '1.8', unit: 'mg/dL',
    referenceRange: '0.5–1.8', flag: 'High', vet: 'Dr. Patel', recordId: 8,
    notes: 'Upper limit of normal — renal function monitoring recommended',
  },

  // Luna — Thyroid screen
  {
    id: 18, testName: 'Total T4', category: 'Thyroid',
    petName: 'Luna', petImage: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400',
    ownerName: 'Emily Johnson', date: '2026-03-05', result: '4.8', unit: 'µg/dL',
    referenceRange: '1.0–4.0', flag: 'High', vet: 'Dr. Patel', recordId: 1,
    notes: 'Elevated T4 — hyperthyroidism suspected. Recommend Free T4 by equilibrium dialysis.',
  },
  {
    id: 19, testName: 'Free T4', category: 'Thyroid',
    petName: 'Luna', petImage: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400',
    ownerName: 'Emily Johnson', date: '2026-03-05', result: '2.9', unit: 'ng/dL',
    referenceRange: '0.8–2.4', flag: 'High', vet: 'Dr. Patel', recordId: 1,
    notes: 'Confirms hyperthyroidism diagnosis',
  },
  {
    id: 20, testName: 'TSH', category: 'Thyroid',
    petName: 'Luna', petImage: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400',
    ownerName: 'Emily Johnson', date: '2026-03-05', result: '0.01', unit: 'µIU/mL',
    referenceRange: '0.05–0.40', flag: 'Low', vet: 'Dr. Patel', recordId: 1,
    notes: 'Suppressed TSH consistent with hyperthyroidism',
  },

  // Cooper — Dental / infection screen
  {
    id: 21, testName: 'Aerobic Culture', category: 'Microbiology',
    petName: 'Cooper', petImage: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',
    ownerName: 'Michael Brown', date: '2026-03-08', result: 'Staphylococcus pseudintermedius', unit: '',
    referenceRange: 'No growth', flag: 'Critical', vet: 'Dr. Chen', recordId: 1,
    notes: 'Moderate growth. Sensitivity: Amoxicillin-R, Clindamycin-S, Enrofloxacin-S.',
  },
  {
    id: 22, testName: 'WBC Count', category: 'Hematology',
    petName: 'Cooper', petImage: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',
    ownerName: 'Michael Brown', date: '2026-03-08', result: '15.2', unit: '10³/µL',
    referenceRange: '5.0–11.0', flag: 'High', vet: 'Dr. Chen', recordId: 1,
    notes: 'Leukocytosis consistent with active infection',
  },
  {
    id: 23, testName: 'Neutrophil %', category: 'Hematology',
    petName: 'Cooper', petImage: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',
    ownerName: 'Michael Brown', date: '2026-03-08', result: '86', unit: '%',
    referenceRange: '60–77', flag: 'High', vet: 'Dr. Chen', recordId: 1,
    notes: 'Left shift — supports bacterial infection',
  },

  // Daisy — post-op bloodwork
  {
    id: 24, testName: 'Albumin', category: 'Chemistry',
    petName: 'Daisy', petImage: 'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=400',
    ownerName: 'Robert Anderson', date: '2026-03-12', result: '2.3', unit: 'g/dL',
    referenceRange: '2.5–4.4', flag: 'Low', vet: 'Dr. Garcia', recordId: 1,
    notes: 'Mild hypoalbuminemia post-operatively — nutritional support recommended',
  },
  {
    id: 25, testName: 'Total Protein', category: 'Chemistry',
    petName: 'Daisy', petImage: 'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=400',
    ownerName: 'Robert Anderson', date: '2026-03-12', result: '5.8', unit: 'g/dL',
    referenceRange: '5.4–8.2', flag: 'Normal', vet: 'Dr. Garcia', recordId: 1,
  },
  {
    id: 26, testName: 'Packed Cell Volume', category: 'Hematology',
    petName: 'Daisy', petImage: 'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=400',
    ownerName: 'Robert Anderson', date: '2026-03-12', result: '32', unit: '%',
    referenceRange: '37–55', flag: 'Low', vet: 'Dr. Garcia', recordId: 1,
    notes: 'Post-surgical anemia — likely blood loss. Recheck in 72 hours.',
  },

  // Milo — fecal exam
  {
    id: 27, testName: 'Fecal Float', category: 'Parasitology',
    petName: 'Milo', petImage: 'https://images.unsplash.com/photo-1589883661923-6476cb0ae9f2?w=400',
    ownerName: 'Jessica Taylor', date: '2026-03-01', result: 'Toxocara cati eggs detected', unit: '',
    referenceRange: 'Negative', flag: 'High', vet: 'Dr. Chen', recordId: 1,
    notes: 'Moderate egg burden. Pyrantel pamoate prescribed.',
  },
  {
    id: 28, testName: 'Giardia Antigen', category: 'Parasitology',
    petName: 'Milo', petImage: 'https://images.unsplash.com/photo-1589883661923-6476cb0ae9f2?w=400',
    ownerName: 'Jessica Taylor', date: '2026-03-01', result: 'Negative', unit: '',
    referenceRange: 'Negative', flag: 'Normal', vet: 'Dr. Chen', recordId: 1,
  },

  // Charlie — emergency bloodwork
  {
    id: 29, testName: 'Lactate', category: 'Chemistry',
    petName: 'Charlie', petImage: 'https://images.unsplash.com/photo-1612195583950-b8fd34c87093?w=400',
    ownerName: 'David Miller', date: '2026-03-11', result: '3.8', unit: 'mmol/L',
    referenceRange: '0.5–2.0', flag: 'Critical', vet: 'Dr. Garcia', recordId: 1,
    notes: 'Critically elevated lactate — possible tissue hypoperfusion. IV fluids initiated.',
  },
  {
    id: 30, testName: 'BUN', category: 'Chemistry',
    petName: 'Charlie', petImage: 'https://images.unsplash.com/photo-1612195583950-b8fd34c87093?w=400',
    ownerName: 'David Miller', date: '2026-03-11', result: '38', unit: 'mg/dL',
    referenceRange: '7–27', flag: 'High', vet: 'Dr. Garcia', recordId: 1,
    notes: 'Elevated BUN — dehydration likely',
  },
];

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
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
  const [search, setSearch] = useState('');
  const [filterFlag, setFilterFlag] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPet, setFilterPet] = useState<string>('all');

  // Derived stats
  const total = LAB_RESULTS.length;
  const normal = LAB_RESULTS.filter((r) => r.flag === 'Normal').length;
  const abnormal = LAB_RESULTS.filter((r) => r.flag === 'High' || r.flag === 'Low').length;
  const critical = LAB_RESULTS.filter((r) => r.flag === 'Critical').length;

  // Unique pets for filter
  const uniquePets = Array.from(new Set(LAB_RESULTS.map((r) => r.petName))).sort();

  // Filtered results
  const filtered = LAB_RESULTS.filter((r) => {
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
        <StatCard label="Normal" value={normal} color="var(--brand-green-text)" sub={`${Math.round((normal / total) * 100)}% of results`} />
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
                onClick={() => navigate(`/records/${r.recordId}`)}
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
