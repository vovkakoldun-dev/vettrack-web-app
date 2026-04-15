import { Link } from 'react-router';
import { Search, ChevronLeft, Filter } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../components/ui/select';
import { supabase } from '../../lib/supabase';
import { getOrgContext } from '../hooks/useOrgContext';

// ─── Helpers ────────────────────────────────────────────────

function getAge(dob: string | null): string {
  if (!dob) return '—';
  const birth = new Date(dob);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) years--;
  if (years < 1) {
    const months = (now.getFullYear() - birth.getFullYear()) * 12 + monthDiff;
    return months <= 0 ? 'Newborn' : `${months} mo`;
  }
  return `${years} yr${years > 1 ? 's' : ''}`;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const statusStyles: Record<string, { bg: string; text: string }> = {
  Healthy: { bg: '#74C69D20', text: 'var(--brand-green-text)' },
  'Follow-up': { bg: '#F4A26120', text: '#F4A261' },
  Critical: { bg: '#d4183d20', text: '#d4183d' },
};

// ─── Types ──────────────────────────────────────────────────

interface PatientRow {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  date_of_birth: string | null;
  photo_url: string | null;
  clientId: string;
  ownerName: string;
  lastVisit: string | null;
  nextVisit: string | null;
  status: 'Healthy' | 'Follow-up' | 'Critical';
  notes: string;
}

// ─── Component ──────────────────────────────────────────────

export default function MyPatientsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [doctorName, setDoctorName] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const { organizationId } = await getOrgContext();
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return;

        // Get doctor's name
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', userId)
          .single();
        if (profile) {
          setDoctorName(`Dr. ${profile.first_name} ${profile.last_name}`.trim());
        }

        // Fetch assigned pets with client/owner info
        const { data: petsData } = await supabase
          .from('pets')
          .select(`
            id, name, species, breed, date_of_birth, photo_url,
            client_id,
            clients!inner(id, profile_id, profiles!inner(first_name, last_name))
          `)
          .eq('organization_id', organizationId)
          .eq('assigned_vet_id', userId)
          .eq('is_active', true)
          .order('name');

        const pets = (petsData || []) as any[];
        if (pets.length === 0) { setPatients([]); return; }

        const petIds = pets.map(p => p.id);
        const now = new Date().toISOString();

        // Fetch appointments for these pets (last + upcoming)
        const [pastRes, futureRes, notesRes] = await Promise.all([
          supabase
            .from('appointments')
            .select('pet_id, scheduled_at, reason, status')
            .eq('organization_id', organizationId)
            .in('pet_id', petIds)
            .lt('scheduled_at', now)
            .order('scheduled_at', { ascending: false }),
          supabase
            .from('appointments')
            .select('pet_id, scheduled_at, reason')
            .eq('organization_id', organizationId)
            .in('pet_id', petIds)
            .gte('scheduled_at', now)
            .order('scheduled_at', { ascending: true }),
          supabase
            .from('pet_notes')
            .select('pet_id, content, created_at')
            .in('pet_id', petIds)
            .order('created_at', { ascending: false }),
        ]);

        const pastAppts = pastRes.data || [];
        const futureAppts = futureRes.data || [];
        const petNotes = notesRes.data || [];

        // Build lookup maps (first match per pet = most recent/nearest)
        const lastVisitMap = new Map<string, string>();
        const nextVisitMap = new Map<string, { date: string; reason: string }>();
        const noteMap = new Map<string, string>();

        for (const a of pastAppts) {
          if (!lastVisitMap.has(a.pet_id)) lastVisitMap.set(a.pet_id, a.scheduled_at);
        }
        for (const a of futureAppts) {
          if (!nextVisitMap.has(a.pet_id)) nextVisitMap.set(a.pet_id, { date: a.scheduled_at, reason: a.reason || '' });
        }
        for (const n of petNotes) {
          if (!noteMap.has(n.pet_id)) noteMap.set(n.pet_id, n.content);
        }

        // Build patient rows
        const rows: PatientRow[] = pets.map(p => {
          const client = p.clients;
          const ownerProfile = client?.profiles;
          const ownerName = ownerProfile
            ? `${ownerProfile.first_name || ''} ${ownerProfile.last_name || ''}`.trim()
            : 'Unknown';

          const upcoming = nextVisitMap.get(p.id);
          const note = noteMap.get(p.id) || (upcoming?.reason ? upcoming.reason : '');

          // Derive status: upcoming appointment within 14 days = Follow-up, else Healthy
          let status: PatientRow['status'] = 'Healthy';
          if (upcoming) {
            const daysUntil = (new Date(upcoming.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
            if (daysUntil <= 14) status = 'Follow-up';
          }

          return {
            id: p.id,
            name: p.name,
            species: p.species || '—',
            breed: p.breed,
            date_of_birth: p.date_of_birth,
            photo_url: p.photo_url,
            clientId: client?.id || p.client_id,
            ownerName,
            lastVisit: lastVisitMap.get(p.id) || null,
            nextVisit: upcoming?.date || null,
            status,
            notes: note || 'No notes',
          };
        });

        setPatients(rows);
      } catch (err) {
        console.error('Failed to load patients:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = patients.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch =
      p.name.toLowerCase().includes(q) ||
      p.ownerName.toLowerCase().includes(q) ||
      (p.breed || '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const healthyCount = patients.filter((p) => p.status === 'Healthy').length;
  const followUpCount = patients.filter((p) => p.status === 'Follow-up').length;
  const criticalCount = patients.filter((p) => p.status === 'Critical').length;

  if (loading) {
    return (
      <div className="max-w-[1440px] mx-auto p-8">
        <div className="mb-6">
          <div className="h-4 w-32 rounded bg-[var(--border-color)] mb-3" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div className="h-8 w-48 rounded bg-[var(--border-color)] mb-2" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div className="h-4 w-64 rounded bg-[var(--border-color)]" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
        <div className="flex gap-3 mb-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 w-28 rounded-full bg-[var(--border-color)]" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
        <div className="bg-[var(--surface-white)] border border-[var(--border-color)] rounded-xl p-6">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex gap-4 mb-4">
              <div className="w-9 h-9 rounded-full bg-[var(--border-color)]" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div className="flex-1 h-9 rounded bg-[var(--border-color)]" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
          ))}
        </div>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto p-8">
      {/* Breadcrumb + Header */}
      <div className="mb-6">
        <Link
          to="/my-portal"
          className="inline-flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--brand-green-text)] transition-colors mb-3"
          style={{ fontSize: '14px', fontWeight: 500 }}
        >
          <ChevronLeft className="w-4 h-4" /> Back to My Portal
        </Link>
        <h1 className="text-[var(--text-primary)]" style={{ fontSize: '32px', fontWeight: 700 }}>
          My Patients
        </h1>
        <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '16px' }}>
          {patients.length} patient{patients.length !== 1 ? 's' : ''} under {doctorName || 'your'} care
        </p>
      </div>

      {/* Stat Chips */}
      <div className="flex items-center gap-3 mb-6">
        <div className="px-4 py-2 bg-[var(--surface-white)] border border-[var(--border-color)] flex items-center gap-2" style={{ borderRadius: '9999px' }}>
          <div className="w-2 h-2 rounded-full bg-[var(--brand-green-text)]" />
          <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>{healthyCount}</span>
          <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Healthy</span>
        </div>
        <div className="px-4 py-2 bg-[var(--surface-white)] border border-[var(--border-color)] flex items-center gap-2" style={{ borderRadius: '9999px' }}>
          <div className="w-2 h-2 rounded-full bg-[#F4A261]" />
          <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>{followUpCount}</span>
          <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Follow-up</span>
        </div>
        <div className="px-4 py-2 bg-[var(--surface-white)] border border-[var(--border-color)] flex items-center gap-2" style={{ borderRadius: '9999px' }}>
          <div className="w-2 h-2 rounded-full bg-[#d4183d]" />
          <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>{criticalCount}</span>
          <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Critical</span>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <Input
            placeholder="Search by pet name, owner, or breed..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--text-secondary)]" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Healthy">Healthy</SelectItem>
              <SelectItem value="Follow-up">Follow-up</SelectItem>
              <SelectItem value="Critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Patients Table */}
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)]" style={{ borderRadius: '12px' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                {['Pet', 'Owner', 'Species / Breed', 'Age', 'Last Visit', 'Next Visit', 'Status', 'Notes'].map((h) => (
                  <th key={h} className="py-3 px-4 text-left">
                    <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px', fontWeight: 600 }}>{h}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const s = statusStyles[p.status] || statusStyles.Healthy;
                return (
                  <tr
                    key={p.id}
                    className="border-b border-[var(--border-color)] last:border-0 hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <Link to={`/clients/${p.clientId}`} className="flex items-center gap-3">
                        {p.photo_url ? (
                          <img
                            src={p.photo_url}
                            alt={p.name}
                            className="w-9 h-9 object-cover flex-shrink-0"
                            style={{ borderRadius: '9999px' }}
                          />
                        ) : (
                          <div
                            className="w-9 h-9 flex-shrink-0 flex items-center justify-center text-white"
                            style={{
                              borderRadius: '9999px',
                              background: p.species === 'Cat' ? 'linear-gradient(135deg, #818CF8, #6366F1)' : 'linear-gradient(135deg, #F4A261, #E76F51)',
                              fontSize: '13px', fontWeight: 700,
                            }}
                          >
                            {p.name.charAt(0)}
                          </div>
                        )}
                        <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>
                          {p.name}
                        </span>
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[var(--text-primary)]" style={{ fontSize: '14px' }}>{p.ownerName}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[var(--text-primary)]" style={{ fontSize: '14px' }}>{p.species}</span>
                      <p className="text-[var(--text-secondary)]" style={{ fontSize: '11px' }}>{p.breed || '—'}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{getAge(p.date_of_birth)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{fmtDate(p.lastVisit)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 500 }}>{fmtDate(p.nextVisit)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className="inline-block px-2.5 py-1"
                        style={{
                          backgroundColor: s.bg,
                          color: s.text,
                          borderRadius: '9999px',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-[var(--text-secondary)] max-w-[200px] truncate" style={{ fontSize: '13px' }}>
                        {p.notes}
                      </p>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>
                      {patients.length === 0 ? 'No patients assigned to you yet.' : 'No patients found matching your search.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
