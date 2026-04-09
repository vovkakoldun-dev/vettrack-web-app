import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Search, Plus, Mail, Phone, ChevronDown, CheckCircle2, AlertCircle, AlertTriangle, Trash2, Copy, Send, Check, Download, Upload, FileText, X, AlertCircle as AlertIcon, CheckCircle, Filter, ArrowUpDown, Loader2, Users } from 'lucide-react';
import { useTenantDb } from '../../context/TenantContext';
import { getOrgContext } from '../../hooks/useOrgContext';
import { AddClientDialog } from '../../components/AddClientDialog';
import type { AddClientValues } from '../../hooks/useClients';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { useClients, deleteClientsBulk } from '../../hooks/useClients';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../../components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '../../components/ui/table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../../components/ui/dropdown-menu';

// ─── CSV Helpers ─────────────────────────────────────────────
//
// CSV columns mirror the "Add New Client" form 1-for-1 so the file is a
// round-trip blueprint: you can export → tweak → import → recreate.
// One row per pet — owners with multiple pets get multiple rows (owner
// columns repeat). Owners with no pets get a single row with empty pet
// columns. We deliberately omit `notes` because the form has no notes
// field today.
const CSV_HEADERS = [
  'first_name', 'last_name', 'email', 'phone',
  'address', 'city', 'state', 'zip', 'country',
  'pet_name', 'species', 'breed', 'sex',
  'date_of_birth', 'weight_kg', 'assigned_vet',
] as const;

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headerLine = lines[0];
  // Parse header respecting quotes
  const headers = parseCsvLine(headerLine).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

interface ImportRow {
  // Owner
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  // Pet
  pet_name?: string;
  species?: string;
  breed?: string;
  sex?: string;
  date_of_birth?: string;
  weight_kg?: string;
  assigned_vet?: string;
  // Validation metadata
  _valid: boolean;
  _error?: string;
}

// ─── Types ────────────────────────────────────────────────────

type Status = 'Healthy' | 'Follow-up' | 'Critical';

interface Client {
  id: number;
  petImage: string;
  petName: string;
  species: string;
  breed: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  lastVisit: string;
  nextAppointment: string;
  balance: number;
  status: Status;
}

// ─── Status config ────────────────────────────────────────────

const STATUS_OPTIONS: {
  value: Status;
  bg: string;
  text: string;
  icon: React.ElementType;
  description: string;
}[] = [
  {
    value: 'Healthy',
    bg: '#74C69D20',
    text: 'var(--brand-green-text)',
    icon: CheckCircle2,
    description: 'No active concerns',
  },
  {
    value: 'Follow-up',
    bg: '#F4A26120',
    text: '#F4A261',
    icon: AlertCircle,
    description: 'Needs a follow-up visit',
  },
  {
    value: 'Critical',
    bg: '#d4183d20',
    text: '#d4183d',
    icon: AlertTriangle,
    description: 'Urgent attention required',
  },
];

// ─── Page ─────────────────────────────────────────────────────

export default function SuperAdminClientsPage() {
  const db = useTenantDb();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  // Filter + sort state (mirrors ClientsPage toolbar) — declared early so it can drive the query
  const [filterSpecies, setFilterSpecies] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterVet, setFilterVet] = useState<string>('All');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name-az' | 'name-za'>('newest');

  // Map sort order → server-side query order. Name sorts fall back to created_at
  // server-side and are then re-sorted client-side over loaded pages.
  const orderAscending = sortOrder === 'oldest';
  const {
    clients: supabaseClients,
    loading,
    loadingMore,
    hasMore,
    totalCount,
    addClient,
    deleteClient,
    refetch,
    loadMore,
  } = useClients({ pageSize: 30, orderColumn: 'created_at', orderAscending });
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, Status>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [emailMenuOpen, setEmailMenuOpen] = useState<string | null>(null);

  const [vets, setVets] = useState<{ id: string; name: string }[]>([]);

  // Bulk-selection state (mirrors ClientsPage)
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  // True while "Select All" is fetching every matching client across all pages
  const [selectingAll, setSelectingAll] = useState(false);
  // True when the current selection represents EVERY matching client across
  // all pages (not just the loaded rows). Reset whenever filters change or
  // the user toggles a row individually.
  const [allAcrossPagesSelected, setAllAcrossPagesSelected] = useState(false);

  // Total pet count for the "Pet" header badge
  const [totalPetCount, setTotalPetCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const fetchPetCount = async () => {
      try {
        const { organizationId } = await getOrgContext();
        const { count } = await db
          .from('pets')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId);
        if (!cancelled && typeof count === 'number') setTotalPetCount(count);
      } catch {}
    };
    fetchPetCount();
    const handler = () => fetchPetCount();
    window.addEventListener('clientDataChanged', handler);
    window.addEventListener('petDataChanged', handler);
    return () => {
      cancelled = true;
      window.removeEventListener('clientDataChanged', handler);
      window.removeEventListener('petDataChanged', handler);
    };
  }, [db]);

  // Load veterinarians for the Doctor filter
  useEffect(() => {
    (async () => {
      try {
        const { organizationId } = await getOrgContext();
        const { data } = await db
          .from('staff')
          .select('id, profiles:profiles!staff_profile_org_fkey(first_name, last_name)')
          .eq('organization_id', organizationId)
          .eq('role', 'veterinarian');
        if (data) {
          setVets(
            data.map((v: any) => ({
              id: v.id,
              name: `Dr. ${v.profiles?.first_name || ''} ${v.profiles?.last_name || ''}`.trim(),
            })),
          );
        }
      } catch {}
    })();
  }, [db]);

  // ── Infinite scroll: fire loadMore when sentinel scrolls into view ──
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '400px 0px' } // start loading 400px before user reaches the bottom
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, hasMore, loading]);

  // CSV import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);

  // ── Export CSV ───────────────────────────────────────────────
  // Exports EVERY client (not just the paginated ones currently in view)
  // along with their pets. One row per pet; pet-less owners get a single
  // row with empty pet columns. Two queries total — clients then pets —
  // so the export scales linearly with row count.
  const [exporting, setExporting] = useState(false);
  const handleExportCSV = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { organizationId } = await getOrgContext();

      // 1. Fetch ALL clients in the org (bypassing pagination)
      const { data: allClients, error: clientErr } = await db
        .from('clients')
        .select('id, first_name, last_name, email, phone, address, city, state, zip, country')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
      if (clientErr || !allClients) {
        console.error('[handleExportCSV] failed to fetch clients:', clientErr);
        alert('Failed to export CSV. See console for details.');
        return;
      }

      // 2. Fetch ALL pets for those clients in a single query, including the
      //    assigned vet's display name (joined through staff → profiles).
      const clientIds = (allClients as any[]).map(c => c.id);
      const petsByClient: Record<string, any[]> = {};
      if (clientIds.length > 0) {
        const { data: pets, error: petErr } = await db
          .from('pets')
          .select('client_id, name, species, breed, sex, date_of_birth, weight_kg, assigned_vet:staff!pets_assigned_vet_org_fkey(profiles:profiles!staff_profile_org_fkey(first_name, last_name))')
          .in('client_id', clientIds);
        if (petErr) {
          console.error('[handleExportCSV] failed to fetch pets:', petErr);
        } else if (pets) {
          for (const p of pets as any[]) {
            if (!petsByClient[p.client_id]) petsByClient[p.client_id] = [];
            petsByClient[p.client_id].push(p);
          }
        }
      }

      // 3. Build CSV rows — one row per pet, owners with no pets get one
      //    row with empty pet columns.
      const header = CSV_HEADERS.join(',');
      const rows: string[] = [];
      for (const c of allClients as any[]) {
        const ownerFields = {
          first_name: c.first_name || '',
          last_name: c.last_name || '',
          email: c.email || '',
          phone: c.phone || '',
          address: c.address || '',
          city: c.city || '',
          state: c.state || '',
          zip: c.zip || '',
          country: c.country || '',
        };
        const pets = petsByClient[c.id] || [];
        if (pets.length === 0) {
          const row = { ...ownerFields, pet_name: '', species: '', breed: '', sex: '', date_of_birth: '', weight_kg: '', assigned_vet: '' };
          rows.push(CSV_HEADERS.map(h => escapeCsvField(String((row as any)[h] ?? ''))).join(','));
        } else {
          for (const pet of pets) {
            const profiles = pet.assigned_vet?.profiles;
            const vetName = profiles
              ? `Dr. ${profiles.first_name || ''} ${profiles.last_name || ''}`.trim()
              : '';
            const row = {
              ...ownerFields,
              pet_name: pet.name || '',
              species: pet.species || '',
              breed: pet.breed || '',
              sex: pet.sex || '',
              date_of_birth: pet.date_of_birth || '',
              weight_kg: pet.weight_kg != null ? String(pet.weight_kg) : '',
              assigned_vet: vetName,
            };
            rows.push(CSV_HEADERS.map(h => escapeCsvField(String((row as any)[h] ?? ''))).join(','));
          }
        }
      }

      const csv = [header, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clients_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('[handleExportCSV] failed:', e);
      alert('Failed to export CSV. See console for details.');
    } finally {
      setExporting(false);
    }
  };

  // ── Import CSV — file select ────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      const rows: ImportRow[] = parsed.map((row) => {
        const fn = row.first_name || row.firstname || row['first name'] || '';
        const ln = row.last_name || row.lastname || row['last name'] || '';
        const rawCountry = (row.country || '').toUpperCase().trim();
        const country = rawCountry === 'CA' || rawCountry === 'CANADA' ? 'CA' : 'US';
        const valid = fn.length > 0 && ln.length > 0;
        return {
          // Owner
          first_name: fn,
          last_name: ln,
          email: row.email || undefined,
          phone: row.phone || row.phone_number || row['phone number'] || undefined,
          address: row.address || row.street || row.street_address || row['street address'] || undefined,
          city: row.city || undefined,
          state: row.state || row.province || row.state_province || row['state/province'] || undefined,
          zip: row.zip || row.zip_code || row['zip code'] || row.postal_code || row['postal code'] || undefined,
          country,
          // Pet — accept several common spellings so users can hand-edit easily
          pet_name: row.pet_name || row.petname || row['pet name'] || undefined,
          species: row.species || undefined,
          breed: row.breed || undefined,
          sex: row.sex || row.gender || undefined,
          date_of_birth: row.date_of_birth || row.dob || row['date of birth'] || undefined,
          weight_kg: row.weight_kg || row.weight || row['weight (kg)'] || row.weight_kgs || undefined,
          assigned_vet: row.assigned_vet || row.vet || row.doctor || row['assigned vet'] || row['assigned doctor'] || undefined,
          _valid: valid,
          _error: valid ? undefined : 'Missing first or last name',
        };
      });
      setImportRows(rows);
      setImportResult(null);
      setImportDialogOpen(true);
    };
    reader.readAsText(file);
    // Reset so same file can be re-selected
    e.target.value = '';
  };

  // ── Import CSV — bulk insert ────────────────────────────────
  // Each CSV row is one (owner, pet) pair. Group rows by owner identity
  // (email, falling back to first+last name) so a single owner with N pets
  // produces ONE client + N pet rows. Vet assignment is matched by name
  // against the org's veterinarian list loaded above.
  const handleImportConfirm = async () => {
    const validRows = importRows.filter((r) => r._valid);
    if (validRows.length === 0) return;
    setImporting(true);
    let success = 0;
    let failed = 0;

    // Build a vet name → id lookup so the imported "assigned_vet" string
    // can be matched (case-insensitive, "Dr. " prefix tolerant).
    const vetByName = new Map<string, string>();
    const norm = (s: string) => s.toLowerCase().replace(/^dr\.?\s+/i, '').trim();
    for (const v of vets) {
      vetByName.set(v.name.toLowerCase().trim(), v.id);
      vetByName.set(norm(v.name), v.id);
    }

    // Group rows by owner identity
    const groups = new Map<string, ImportRow[]>();
    for (const row of validRows) {
      const key = (row.email && row.email.trim().toLowerCase())
        || `${row.first_name.trim().toLowerCase()}|${row.last_name.trim().toLowerCase()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    // Resolve org id once for the pet inserts
    let organizationId: string | null = null;
    try { organizationId = (await getOrgContext()).organizationId; } catch {}

    for (const groupRows of groups.values()) {
      const first = groupRows[0];
      // Strip pet + metadata fields before passing owner data to addClient
      const ownerValues: AddClientValues = {
        first_name: first.first_name,
        last_name: first.last_name,
        email: first.email,
        phone: first.phone,
        address: first.address,
        city: first.city,
        state: first.state,
        zip: first.zip,
        country: first.country,
      };
      const { data: clientData, error } = await addClient(ownerValues);
      if (error || !clientData) {
        failed += groupRows.length;
        continue;
      }
      success += 1;

      // Insert one pet per row that has a pet_name + species
      if (organizationId) {
        for (const r of groupRows) {
          if (!r.pet_name || !r.species) continue;
          const w = r.weight_kg ? parseFloat(r.weight_kg) : NaN;
          const vetId = r.assigned_vet
            ? (vetByName.get(r.assigned_vet.toLowerCase().trim())
              || vetByName.get(norm(r.assigned_vet))
              || null)
            : null;
          const { error: petErr } = await db.from('pets').insert([{
            client_id: (clientData as any).id,
            name: r.pet_name.trim(),
            species: r.species,
            breed: r.breed || null,
            sex: r.sex || 'Unknown',
            date_of_birth: r.date_of_birth || null,
            weight_kg: !isNaN(w) ? w : null,
            assigned_vet_id: vetId,
            is_active: true,
            organization_id: organizationId,
          }]);
          if (petErr) {
            console.warn('[handleImportConfirm] pet insert failed:', petErr.message);
          }
        }
      }
    }

    setImporting(false);
    setImportResult({ success, failed });
    if (success > 0) {
      await refetch();
      window.dispatchEvent(new CustomEvent('clientDataChanged'));
      window.dispatchEvent(new CustomEvent('petDataChanged'));
    }
  };

  const copyToClipboard = (text: string) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    setEmailMenuOpen(null);
    setCopiedEmail(text);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const handleAddClient = async (values: AddClientValues): Promise<string | void> => {
    const { data, error } = await addClient(values);
    if (!error && data) {
      return (data as any).id as string;
    }
  };

  // ── Bulk selection helpers ───────────────────────────────────
  const toggleSelectClient = (supaId: string) => {
    // Any manual row toggle invalidates the "all across pages" assumption.
    setAllAcrossPagesSelected(false);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(supaId)) next.delete(supaId);
      else next.add(supaId);
      return next;
    });
  };

  // Whenever the user changes filters/search, the previously computed
  // "all across pages" selection is no longer valid — clear the flag but
  // keep any already-selected ids so the user doesn't lose their work.
  useEffect(() => {
    setAllAcrossPagesSelected(false);
  }, [search, filterSpecies, filterStatus, filterVet]);

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    const errors: string[] = [];
    try {
      await deleteClientsBulk(Array.from(selectedIds));
    } catch (e: any) {
      errors.push(e?.message || 'Unknown error');
    }
    await refetch();
    window.dispatchEvent(new CustomEvent('clientDataChanged'));
    setSelectedIds(new Set());
    setAllAcrossPagesSelected(false);
    setSelectMode(false);
    setBulkDeleting(false);
    setShowBulkDeleteConfirm(false);
    if (errors.length > 0) {
      console.error('[handleBulkDelete] errors:', errors);
      alert(`Delete failed:\n\n${errors.join('\n')}`);
    }
  };

  // Map Supabase ClientRow[] → Client[] for the existing UI
  const clientList = useMemo(() =>
    supabaseClients.map((c, idx) => {
      const pet = c.pets?.[0];
      const initials = `${(c.first_name?.[0] ?? '').toUpperCase()}${(c.last_name?.[0] ?? '').toUpperCase()}`;
      const assignedVetName = pet?.assigned_vet?.profiles
        ? `Dr. ${(pet.assigned_vet.profiles as any).first_name} ${(pet.assigned_vet.profiles as any).last_name}`
        : null;
      return {
        id: idx + 1,
        petImage: pet?.photo_url || '',
        petName: pet?.name || '—',
        species: pet?.species || '—',
        breed: pet?.breed || '—',
        ownerName: `${c.first_name} ${c.last_name}`,
        ownerInitials: initials,
        ownerEmail: c.email || '—',
        ownerPhone: c.phone || '—',
        lastVisit: new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        nextAppointment: '—',
        balance: 0,
        status: (statusOverrides[c.id] || c.health_status || 'Healthy') as Status,
        _supaId: c.id,
        _createdAt: c.created_at,
        _assignedVetName: assignedVetName,
      };
    }),
    [supabaseClients, statusOverrides],
  );

  // Unique species pulled from data — drives the Species filter
  const speciesOptions = useMemo(
    () => Array.from(new Set(clientList.map(c => c.species).filter(s => s && s !== '—'))),
    [clientList],
  );

  const updateStatus = async (id: number, newStatus: Status) => {
    const entry = clientList.find((c) => c.id === id);
    if (entry) {
      const supaId = (entry as Client & { _supaId: string })._supaId;
      setStatusOverrides((prev) => ({ ...prev, [supaId]: newStatus }));
      const { organizationId } = await getOrgContext();
      await db.from('clients').update({ health_status: newStatus }).eq('id', supaId).eq('organization_id', organizationId);
      window.dispatchEvent(new CustomEvent('clientDataChanged'));
    }
  };

  const filtered = clientList.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || (
      c.petName.toLowerCase().includes(q) ||
      c.ownerName.toLowerCase().includes(q) ||
      c.breed.toLowerCase().includes(q) ||
      c.ownerEmail.toLowerCase().includes(q) ||
      c.ownerPhone.includes(q)
    );
    const matchesSpecies = filterSpecies === 'All' || c.species === filterSpecies;
    const matchesStatus = filterStatus === 'All' || c.status === filterStatus;
    const matchesVet = filterVet === 'All' || c._assignedVetName === filterVet;
    return matchesSearch && matchesSpecies && matchesStatus && matchesVet;
  });

  // Sort the filtered list
  filtered.sort((a, b) => {
    switch (sortOrder) {
      case 'oldest': return (a._createdAt || '').localeCompare(b._createdAt || '');
      case 'newest': return (b._createdAt || '').localeCompare(a._createdAt || '');
      case 'name-az': return a.petName.localeCompare(b.petName);
      case 'name-za': return b.petName.localeCompare(a.petName);
      default: return 0;
    }
  });

  const hasActiveFilters = filterSpecies !== 'All' || filterStatus !== 'All' || filterVet !== 'All';

  // Fetch EVERY client in the org (bypassing the 30-row pagination), apply
  // the exact same filter logic the table uses, and return their ids. This is
  // how "Select All" selects across all pages instead of just the ones the user
  // has scrolled into view.
  const fetchAllMatchingClientIds = async (): Promise<string[]> => {
    const { organizationId } = await getOrgContext();
    const { data, error } = await db
      .from('clients')
      .select(
        'id, first_name, last_name, email, phone, health_status, pets(name, species, breed, assigned_vet:staff!pets_assigned_vet_org_fkey(profiles:profiles!staff_profile_org_fkey(first_name, last_name)))'
      )
      .eq('organization_id', organizationId);
    if (error || !data) {
      console.error('[fetchAllMatchingClientIds] failed:', error);
      return [];
    }
    const q = search.toLowerCase();
    return (data as any[])
      .filter((c) => {
        const pet = c.pets?.[0];
        const petName: string = pet?.name || '';
        const species: string = pet?.species || '';
        const breed: string = pet?.breed || '';
        const ownerName = `${c.first_name || ''} ${c.last_name || ''}`;
        const ownerEmail: string = c.email || '';
        const ownerPhone: string = c.phone || '';
        const profiles = pet?.assigned_vet?.profiles;
        const assignedVetName = profiles
          ? `Dr. ${profiles.first_name || ''} ${profiles.last_name || ''}`.trim()
          : null;
        const status = (statusOverrides[c.id] || c.health_status || 'Healthy') as Status;

        const matchesSearch = !q || (
          petName.toLowerCase().includes(q) ||
          ownerName.toLowerCase().includes(q) ||
          breed.toLowerCase().includes(q) ||
          ownerEmail.toLowerCase().includes(q) ||
          ownerPhone.includes(q)
        );
        const matchesSpecies = filterSpecies === 'All' || species === filterSpecies;
        const matchesStatus = filterStatus === 'All' || status === filterStatus;
        const matchesVet = filterVet === 'All' || assignedVetName === filterVet;
        return matchesSearch && matchesSpecies && matchesStatus && matchesVet;
      })
      .map((c: any) => c.id as string);
  };

  // Select every matching client across ALL pages (not just the currently
  // loaded rows). Shows a loading indicator while the fetch is in flight and
  // falls back to the visible rows if the query fails.
  const selectAllAcrossPages = async () => {
    if (selectingAll) return;
    setSelectingAll(true);
    try {
      const ids = await fetchAllMatchingClientIds();
      if (ids.length === 0) {
        // Nothing matches — clear the flag and fall back to visible rows
        setAllAcrossPagesSelected(false);
        setSelectedIds(new Set(filtered.map((c) => c._supaId).filter(Boolean)));
      } else {
        setSelectedIds(new Set(ids));
        setAllAcrossPagesSelected(true);
      }
    } finally {
      setSelectingAll(false);
    }
  };

  // One-click "Select All" from the header:
  //   • not in selectMode → enter selectMode AND immediately select every
  //     matching client across all pages
  //   • in selectMode with every match already selected → clear the selection
  //   • in selectMode with a partial selection → expand to select every match
  //     across all pages
  const handleHeaderSelectAllClick = async () => {
    if (filtered.length === 0 && !selectMode) return;
    if (!selectMode) {
      setSelectMode(true);
      await selectAllAcrossPages();
      return;
    }
    if (allAcrossPagesSelected) {
      setAllAcrossPagesSelected(false);
      setSelectedIds(new Set());
      return;
    }
    await selectAllAcrossPages();
  };

  return (
    <>
    <div className="max-w-[1440px] mx-auto p-8">

      {/* Hidden file input for CSV import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[var(--text-primary)] mb-2">Clients</h1>
          <p className="text-[var(--text-secondary)]" style={{ fontSize: '16px', fontWeight: 400 }}>
            Manage your clients and their pets.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleExportCSV}
            disabled={exporting}
            style={{ gap: '6px' }}
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            style={{ gap: '6px' }}
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </Button>
          <Button onClick={() => setAddClientOpen(true)}>
            <Plus className="w-4 h-4" />
            Add Client
          </Button>
        </div>
      </div>

      {/* Search + Filters + Sort — unified toolbar */}
      <div
        className="mb-6 flex items-center bg-[var(--surface-elevated)] border border-[var(--border-color)]"
        style={{
          borderRadius: '10px',
          padding: '6px',
          gap: '4px',
        }}
      >
        {/* Search input — borderless, blends into the panel */}
        <div className="relative flex-1 min-w-0" style={{ minWidth: '240px' }}>
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search by pet, owner, or breed..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent border-0 outline-none focus:outline-none focus:ring-0"
            style={{
              height: '32px',
              paddingLeft: '34px',
              paddingRight: '12px',
              fontSize: '13px',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {/* Vertical separator */}
        <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />

        {/* Filter icon */}
        <Filter
          className="w-3.5 h-3.5 text-[var(--text-secondary)]"
          style={{ marginLeft: '6px', marginRight: '2px', flexShrink: 0 }}
        />

        {/* Species Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-1 px-2.5 py-1.5 transition-colors hover:bg-[var(--surface-elevated)]"
              style={{
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: filterSpecies !== 'All' ? 600 : 500,
                backgroundColor: filterSpecies !== 'All' ? 'var(--surface-elevated)' : 'transparent',
                color: filterSpecies !== 'All' ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {filterSpecies === 'All' ? 'Species' : filterSpecies}
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setFilterSpecies('All')}>All Species</DropdownMenuItem>
            <DropdownMenuSeparator />
            {speciesOptions.map(s => (
              <DropdownMenuItem key={s} onClick={() => setFilterSpecies(s)}>{s}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Status Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-1 px-2.5 py-1.5 transition-colors hover:bg-[var(--surface-elevated)]"
              style={{
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: filterStatus !== 'All' ? 600 : 500,
                backgroundColor: filterStatus !== 'All' ? 'var(--surface-elevated)' : 'transparent',
                color: filterStatus !== 'All' ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {filterStatus === 'All' ? 'Status' : filterStatus}
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setFilterStatus('All')}>All Statuses</DropdownMenuItem>
            <DropdownMenuSeparator />
            {STATUS_OPTIONS.map(s => {
              const Icon = s.icon;
              return (
                <DropdownMenuItem key={s.value} onClick={() => setFilterStatus(s.value)}>
                  <Icon className="w-3.5 h-3.5 mr-2" style={{ color: s.text }} />
                  {s.value}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Vet Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-1 px-2.5 py-1.5 transition-colors hover:bg-[var(--surface-elevated)]"
              style={{
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: filterVet !== 'All' ? 600 : 500,
                backgroundColor: filterVet !== 'All' ? 'var(--surface-elevated)' : 'transparent',
                color: filterVet !== 'All' ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {filterVet === 'All' ? 'Doctor' : filterVet}
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setFilterVet('All')}>All Doctors</DropdownMenuItem>
            <DropdownMenuSeparator />
            {vets.map(v => (
              <DropdownMenuItem key={v.id} onClick={() => setFilterVet(v.name)}>{v.name}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Clear filters chip — only when something is filtered */}
        {hasActiveFilters && (
          <button
            onClick={() => { setFilterSpecies('All'); setFilterStatus('All'); setFilterVet('All'); }}
            className="flex items-center gap-1 px-2 py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            style={{ fontSize: '12px', fontWeight: 500, border: 'none', background: 'transparent', cursor: 'pointer' }}
            title="Clear filters"
          >
            <X className="w-3 h-3" />
          </button>
        )}

        {/* Vertical separator */}
        <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', marginLeft: 'auto' }} />

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-1.5 px-2.5 py-1.5 transition-colors hover:bg-[var(--surface-elevated)]"
              style={{
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              {sortOrder === 'newest' ? 'Newest first' : sortOrder === 'oldest' ? 'Oldest first' : sortOrder === 'name-az' ? 'Name A–Z' : 'Name Z–A'}
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setSortOrder('newest')}>
              {sortOrder === 'newest' && <CheckCircle2 className="w-3.5 h-3.5 mr-2" style={{ color: 'var(--brand-green-text)' }} />}
              Newest first
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOrder('oldest')}>
              {sortOrder === 'oldest' && <CheckCircle2 className="w-3.5 h-3.5 mr-2" style={{ color: 'var(--brand-green-text)' }} />}
              Oldest first
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setSortOrder('name-az')}>
              {sortOrder === 'name-az' && <CheckCircle2 className="w-3.5 h-3.5 mr-2" style={{ color: 'var(--brand-green-text)' }} />}
              Name A–Z
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOrder('name-za')}>
              {sortOrder === 'name-za' && <CheckCircle2 className="w-3.5 h-3.5 mr-2" style={{ color: 'var(--brand-green-text)' }} />}
              Name Z–A
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Selection bar */}
      {selectMode && (
        <div className="flex items-center gap-3 mb-4 px-4 py-3 border border-[var(--border-color)] bg-[var(--surface-elevated)]" style={{ borderRadius: '10px' }}>
          <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>
            {selectedIds.size > 0 ? `${selectedIds.size} client${selectedIds.size !== 1 ? 's' : ''} selected` : 'Select clients to delete'}
          </span>
          {selectedIds.size > 0 && (
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#EF4444', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
            >
              <Trash2 style={{ width: '14px', height: '14px' }} /> Delete
            </button>
          )}
          <button
            onClick={() => { setSelectedIds(new Set()); setAllAcrossPagesSelected(false); setSelectMode(false); }}
            className="flex items-center gap-1 px-3 py-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
          >
            <X style={{ width: '14px', height: '14px' }} /> Cancel
          </button>
        </div>
      )}

      {/* Bulk delete confirmation dialog */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6" style={{ borderRadius: '14px', maxWidth: '420px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center" style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#FEE2E2' }}>
                <Trash2 style={{ width: '20px', height: '20px', color: '#EF4444' }} />
              </div>
              <h3 className="text-[var(--text-primary)]" style={{ fontSize: '18px', fontWeight: 700 }}>Delete Clients</h3>
            </div>
            <p className="text-[var(--text-secondary)] mb-6" style={{ fontSize: '14px', lineHeight: '1.5' }}>
              Are you sure you want to delete <strong className="text-[var(--text-primary)]">{selectedIds.size} client{selectedIds.size !== 1 ? 's' : ''}</strong>? This will remove associated pets, records, and appointments. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={bulkDeleting}
                className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="px-4 py-2 text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#EF4444', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', opacity: bulkDeleting ? 0.6 : 1 }}
              >
                {bulkDeleting ? 'Deleting...' : `Delete ${selectedIds.size} Client${selectedIds.size !== 1 ? 's' : ''}`}
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
                {(() => {
                  const allSelected = allAcrossPagesSelected && selectedIds.size > 0;
                  const partial = !allSelected && selectedIds.size > 0;
                  return (
                    <div
                      onClick={handleHeaderSelectAllClick}
                      style={{
                        width: '18px', height: '18px', borderRadius: '4px', cursor: selectingAll ? 'wait' : 'pointer',
                        border: allSelected || partial
                          ? '2px solid var(--brand-green-text)'
                          : '2px solid var(--text-secondary)',
                        backgroundColor: allSelected || partial ? 'var(--brand-green-text)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: 1,
                        transition: 'all 0.15s ease',
                      }}
                      title={
                        selectingAll
                          ? 'Selecting all clients…'
                          : allSelected
                            ? 'Clear selection'
                            : 'Select all clients across all pages'
                      }
                    >
                      {selectingAll && (
                        <Loader2 className="animate-spin" style={{ width: '12px', height: '12px', color: '#fff' }} />
                      )}
                      {!selectingAll && allSelected && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      )}
                      {!selectingAll && partial && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 6h6" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
                      )}
                    </div>
                  );
                })()}
              </TableHead>
              <TableHead className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Pet
                {totalPetCount != null && (
                  <span
                    className="ml-2 inline-flex items-center justify-center"
                    style={{
                      backgroundColor: 'var(--surface-elevated)',
                      color: 'var(--text-secondary)',
                      borderRadius: '9999px',
                      padding: '2px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      minWidth: '24px',
                    }}
                  >
                    {totalPetCount}
                  </span>
                )}
              </TableHead>
              <TableHead className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Owner
                {(totalCount ?? clientList.length) != null && (
                  <span
                    className="ml-2 inline-flex items-center justify-center"
                    style={{
                      backgroundColor: 'var(--surface-elevated)',
                      color: 'var(--text-secondary)',
                      borderRadius: '9999px',
                      padding: '2px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      minWidth: '24px',
                    }}
                  >
                    {totalCount ?? clientList.length}
                  </span>
                )}
              </TableHead>
              <TableHead className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Species
              </TableHead>
              <TableHead className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Breed
              </TableHead>
              <TableHead className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Last Visit
              </TableHead>
              <TableHead className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Phone
              </TableHead>
              <TableHead className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Status
              </TableHead>
              <TableHead className="py-3 px-4 w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={9} className="py-16 text-center">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin" style={{ color: 'var(--text-secondary)' }} />
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-16 text-center">
                  <Users className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--border-color)' }} />
                  <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>No clients found</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Try adjusting filters or add a new client</p>
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.map((client) => {
              const opt = STATUS_OPTIONS.find((o) => o.value === client.status)!;
              const StatusIcon = opt.icon;
              const isSelected = selectedIds.has(client._supaId);
              return (
                <TableRow
                  key={client.id}
                  className="hover:bg-[var(--surface-elevated)] cursor-pointer transition-colors"
                  style={isSelected ? { backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 8%, transparent)' } : undefined}
                  onClick={() => navigate(`/superadmin/clients/${client._supaId}`)}
                >
                  {/* Checkbox */}
                  <TableCell className="py-4 px-4" style={{ width: '44px' }}>
                    {selectMode && (
                      <div
                        onClick={(e) => { e.stopPropagation(); toggleSelectClient(client._supaId); }}
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
                      {client.petImage ? (
                        <img
                          src={client.petImage}
                          alt={client.petName}
                          className="w-10 h-10 object-cover flex-shrink-0"
                          style={{ borderRadius: '9999px' }}
                        />
                      ) : (
                        <div
                          className="w-10 h-10 flex-shrink-0 flex items-center justify-center"
                          style={{
                            borderRadius: '9999px',
                            backgroundColor: 'var(--brand-green-bg, #74C69D20)',
                            color: 'var(--brand-green-text)',
                            fontSize: '14px',
                            fontWeight: 700,
                          }}
                        >
                          {(client as any).ownerInitials}
                        </div>
                      )}
                      <span className="text-[var(--text-primary)]" style={{ fontSize: '15px', fontWeight: 600 }}>
                        {client.petName}
                      </span>
                    </div>
                  </TableCell>

                  {/* Owner */}
                  <TableCell className="py-4 px-4">
                    <div>
                      <p className="text-[var(--text-primary)]" style={{ fontSize: '15px', fontWeight: 500 }}>
                        {client.ownerName}
                      </p>
                      <div className="flex items-center gap-1 mt-1 relative" onClick={(e) => e.stopPropagation()}>
                        <Mail className="w-3 h-3 text-[var(--text-secondary)]" />
                        <button
                          className="hover:underline"
                          style={{ fontSize: '12px', color: copiedEmail === client.ownerEmail ? '#22c55e' : 'var(--brand-green-text)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          onClick={() => setEmailMenuOpen(emailMenuOpen === client.ownerEmail ? null : client.ownerEmail)}
                        >
                          {copiedEmail === client.ownerEmail ? '✓ Copied!' : client.ownerEmail}
                        </button>
                        {emailMenuOpen === client.ownerEmail && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setEmailMenuOpen(null)} />
                            <div
                              className="absolute left-0 top-6 z-50 min-w-[140px] rounded-md border bg-popover p-1 shadow-md"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              <div
                                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-[var(--surface-elevated)]"
                                onClick={() => copyToClipboard(client.ownerEmail)}
                              >
                                <Copy className="w-3.5 h-3.5" /> Copy Email
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Species */}
                  <TableCell className="py-4 px-4">
                    <span className="text-[var(--text-secondary)]" style={{ fontSize: '15px' }}>
                      {client.species}
                    </span>
                  </TableCell>

                  {/* Breed */}
                  <TableCell className="py-4 px-4">
                    <span className="text-[var(--text-secondary)]" style={{ fontSize: '15px' }}>
                      {client.breed}
                    </span>
                  </TableCell>

                  {/* Last Visit */}
                  <TableCell className="py-4 px-4">
                    <span className="text-[var(--text-secondary)]" style={{ fontSize: '15px' }}>
                      {client.lastVisit}
                    </span>
                  </TableCell>

                  {/* Phone */}
                  <TableCell className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                    <a
                      href={`tel:${client.ownerPhone}`}
                      className="flex items-center gap-1.5 hover:underline"
                      style={{ fontSize: '14px', color: 'var(--text-primary)', textDecoration: 'none' }}
                    >
                      <Phone className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                      {client.ownerPhone}
                    </a>
                  </TableCell>

                  {/* Status dropdown */}
                  <TableCell className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="inline-flex items-center gap-1.5 px-3 py-1 transition-opacity hover:opacity-80 focus:outline-none"
                          style={{
                            backgroundColor: opt.bg,
                            color: opt.text,
                            borderRadius: '9999px',
                            fontSize: '14px',
                            fontWeight: 600,
                          }}
                        >
                          <StatusIcon className="w-3.5 h-3.5" />
                          {client.status}
                          <ChevronDown className="w-3 h-3 opacity-60" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" style={{ minWidth: '200px' }}>
                        <DropdownMenuLabel style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                          CHANGE STATUS
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {STATUS_OPTIONS.map((option) => {
                          const Icon = option.icon;
                          const isCurrent = client.status === option.value;
                          return (
                            <DropdownMenuItem
                              key={option.value}
                              onClick={() => updateStatus(client.id, option.value)}
                              className="flex items-start gap-3 cursor-pointer focus:bg-[var(--surface-elevated)] focus:text-[var(--text-primary)] data-[highlighted]:bg-[var(--surface-elevated)] data-[highlighted]:text-[var(--text-primary)]"
                            >
                              <span
                                className="mt-0.5 flex-shrink-0 w-6 h-6 flex items-center justify-center"
                                style={{ borderRadius: '9999px', backgroundColor: option.bg }}
                              >
                                <Icon className="w-3.5 h-3.5" style={{ color: option.text }} />
                              </span>
                              <span className="flex-1">
                                <span className="block" style={{ fontSize: '14px', fontWeight: isCurrent ? 700 : 500, color: 'var(--text-primary)' }}>
                                  {option.value}
                                  {isCurrent && (
                                    <span style={{ color: option.text, marginLeft: '6px', fontSize: '11px' }}>✓ current</span>
                                  )}
                                </span>
                                <span className="block text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>
                                  {option.description}
                                </span>
                              </span>
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>

                  {/* Delete */}
                  <TableCell className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                    {deletingId === (client as Client & { _supaId: string })._supaId ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="destructive"
                          size="sm"
                          style={{ fontSize: '12px', padding: '2px 8px' }}
                          onClick={async () => {
                            await deleteClient((client as Client & { _supaId: string })._supaId);
                            setDeletingId(null);
                          }}
                        >
                          Confirm
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          style={{ fontSize: '12px', padding: '2px 8px' }}
                          onClick={() => setDeletingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingId((client as Client & { _supaId: string })._supaId)}
                        className="p-1.5 rounded-md hover:bg-red-50 transition-colors"
                        title="Delete client"
                      >
                        <Trash2 className="w-4 h-4 text-[var(--text-secondary)] hover:text-red-500" />
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {loadingMore && (
              <TableRow>
                <TableCell colSpan={9} className="py-6 text-center">
                  <Loader2 className="w-5 h-5 mx-auto animate-spin" style={{ color: 'var(--text-secondary)' }} />
                </TableCell>
              </TableRow>
            )}
            {/* Sentinel row for IntersectionObserver — placed in tbody so it sits inside the scroll viewport */}
            {!loading && hasMore && (
              <TableRow>
                <TableCell colSpan={9} className="p-0">
                  <div ref={sentinelRef} style={{ height: '1px' }} />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-color)] flex items-center justify-between">
          <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>
            {totalCount != null ? (
              <>Showing <strong style={{ color: 'var(--text-primary)' }}>{clientList.length}</strong> of <strong style={{ color: 'var(--text-primary)' }}>{totalCount}</strong> clients</>
            ) : (
              <>Showing <strong style={{ color: 'var(--text-primary)' }}>{clientList.length}</strong> clients</>
            )}
            {hasMore && !loadingMore && <span> · scroll for more</span>}
            {!hasMore && clientList.length > 0 && <span> · all loaded</span>}
          </p>
        </div>
      </div>
    </div>

      <AddClientDialog open={addClientOpen} onOpenChange={(open) => { setAddClientOpen(open); if (!open) setTimeout(() => { refetch(); window.dispatchEvent(new CustomEvent('notifCountChanged')); }, 300); }} onSave={handleAddClient} />

      {/* ── CSV Import Preview Dialog ── */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => { if (!importing) { setImportDialogOpen(open); if (!open) { setImportRows([]); setImportResult(null); } } }}>
        <DialogContent style={{ maxWidth: '720px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
          <DialogHeader>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileText className="w-5 h-5" style={{ color: 'var(--brand-green-text)' }} />
              {importResult ? 'Import Complete' : 'Import Clients from CSV'}
            </DialogTitle>
            <DialogDescription>
              {importResult
                ? `${importResult.success} client${importResult.success !== 1 ? 's' : ''} imported successfully${importResult.failed > 0 ? `, ${importResult.failed} failed` : ''}.`
                : `Preview ${importRows.length} row${importRows.length !== 1 ? 's' : ''} found in CSV. ${importRows.filter(r => r._valid).length} valid, ${importRows.filter(r => !r._valid).length} with errors.`
              }
            </DialogDescription>
          </DialogHeader>

          {/* Preview table */}
          {!importResult && (
            <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', marginTop: '8px' }}>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600, width: '28px' }}>#</TableHead>
                    <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600 }}>Owner</TableHead>
                    <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600 }}>Email</TableHead>
                    <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600 }}>Pet</TableHead>
                    <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600 }}>Species</TableHead>
                    <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600 }}>Vet</TableHead>
                    <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600, width: '40px' }}>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importRows.map((row, i) => {
                    const ownerName = `${row.first_name} ${row.last_name}`.trim();
                    return (
                      <TableRow
                        key={i}
                        style={{ backgroundColor: row._valid ? 'transparent' : 'rgba(212,24,61,0.04)' }}
                      >
                        <TableCell className="py-2 px-3" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{i + 1}</TableCell>
                        <TableCell className="py-2 px-3" style={{ fontSize: '13px', fontWeight: 500 }}>{ownerName || <span style={{ color: '#d4183d', fontStyle: 'italic' }}>missing</span>}</TableCell>
                        <TableCell className="py-2 px-3" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{row.email || '—'}</TableCell>
                        <TableCell className="py-2 px-3" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{row.pet_name || '—'}</TableCell>
                        <TableCell className="py-2 px-3" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{row.species || '—'}</TableCell>
                        <TableCell className="py-2 px-3" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{row.assigned_vet || '—'}</TableCell>
                        <TableCell className="py-2 px-3">
                          {row._valid ? (
                            <CheckCircle className="w-4 h-4" style={{ color: 'var(--brand-green-text)' }} />
                          ) : (
                            <span title={row._error}>
                              <AlertIcon className="w-4 h-4" style={{ color: '#d4183d' }} />
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Result summary */}
          {importResult && (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%', margin: '0 auto 16px',
                backgroundColor: importResult.failed === 0 ? 'rgba(116,198,157,0.15)' : 'rgba(244,162,97,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {importResult.failed === 0 ? (
                  <CheckCircle className="w-7 h-7" style={{ color: 'var(--brand-green-text)' }} />
                ) : (
                  <AlertIcon className="w-7 h-7" style={{ color: '#F4A261' }} />
                )}
              </div>
              <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                {importResult.success} client{importResult.success !== 1 ? 's' : ''} imported
              </p>
              {importResult.failed > 0 && (
                <p style={{ fontSize: '14px', color: '#d4183d' }}>
                  {importResult.failed} row{importResult.failed !== 1 ? 's' : ''} failed (missing required fields)
                </p>
              )}
            </div>
          )}

          <DialogFooter style={{ marginTop: '12px' }}>
            {importResult ? (
              <Button onClick={() => { setImportDialogOpen(false); setImportRows([]); setImportResult(null); }}>
                Done
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => { setImportDialogOpen(false); setImportRows([]); }}
                  disabled={importing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleImportConfirm}
                  disabled={importing || importRows.filter(r => r._valid).length === 0}
                  style={{ gap: '6px' }}
                >
                  {importing ? (
                    <>
                      <span className="animate-spin" style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block' }} />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Import {importRows.filter(r => r._valid).length} Client{importRows.filter(r => r._valid).length !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
