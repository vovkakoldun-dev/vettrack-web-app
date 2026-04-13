import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  Search, Plus, Mail, Phone, ChevronDown, CheckCircle2, AlertCircle, AlertTriangle,
  Trash2, Copy, Send, Filter, X, ArrowUpDown, Loader2, Users,
} from 'lucide-react';
import { useTenantDb } from '../../context/TenantContext';
import { getOrgContext } from '../../hooks/useOrgContext';
import { AddClientDialog } from '../../components/AddClientDialog';
import type { AddClientValues } from '../../hooks/useClients';
import { Button } from '../../components/ui/button';
import { useClients, deletePetCascade, deleteClientsBulk, deletePetsBulk } from '../../hooks/useClients';
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

// ─── Types ────────────────────────────────────────────────────

type Status = 'Healthy' | 'Follow-up' | 'Critical';

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

export default function AdminClientsPage() {
  const db = useTenantDb();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  // Filters & sort
  const [filterSpecies, setFilterSpecies] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterVet, setFilterVet] = useState<string>('All');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name-az' | 'name-za'>('newest');

  const {
    clients,
    loading,
    loadingMore,
    hasMore,
    totalCount,
    addClient,
    deleteClient,
    refetch,
    loadMore,
  } = useClients({
    pageSize: 30,
    orderColumn: sortOrder === 'name-az' || sortOrder === 'name-za' ? 'created_at' : 'created_at',
    orderAscending: sortOrder === 'oldest',
  });

  const [addClientOpen, setAddClientOpen] = useState(false);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, Status>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [emailMenuOpen, setEmailMenuOpen] = useState<string | null>(null);

  // Bulk select
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  // Metadata (id, petId, petCount) for every selected row — keeps delete logic
  // working even for rows that aren't loaded into `filtered` yet (cross-page
  // selection).
  type RowMeta = { id: string; petId: string | null; petCount: number };
  const [selectedRowsMeta, setSelectedRowsMeta] = useState<Record<string, RowMeta>>({});
  // True while the cross-page fetch for "Select All" is in flight
  const [selectingAll, setSelectingAll] = useState(false);
  // True when the current selection represents EVERY matching row across all
  // pages. Reset whenever filters change or the user toggles a row individually.
  const [allAcrossPagesSelected, setAllAcrossPagesSelected] = useState(false);

  // Vets & counts
  const [vets, setVets] = useState<{ id: string; name: string }[]>([]);
  const [vetOverrides, setVetOverrides] = useState<Record<string, { id: string; name: string } | null>>({});
  const [totalPetCount, setTotalPetCount] = useState<number | null>(null);

  // ── Fetch vets for the Doctor filter & assignment dropdown ──
  useEffect(() => {
    (async () => {
      try {
        const { organizationId } = await getOrgContext();
        const { data } = await db
          .from('staff')
          .select('id, profiles:profiles!staff_profile_id_fkey(first_name, last_name)')
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

  // ── Total pet count for the header (independent of pagination) ──
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
      { rootMargin: '400px 0px' }, // start loading 400px before user reaches the bottom
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, hasMore, loading]);

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

  const updateStatus = async (clientId: string, newStatus: Status) => {
    setStatusOverrides((prev) => ({ ...prev, [clientId]: newStatus }));
    const { organizationId } = await getOrgContext();
    await db
      .from('clients')
      .update({ health_status: newStatus })
      .eq('id', clientId)
      .eq('organization_id', organizationId);
    window.dispatchEvent(new CustomEvent('clientDataChanged'));
  };

  const toggleSelectClient = (rowKey: string) => {
    // Any individual row toggle invalidates the "all across pages" flag.
    setAllAcrossPagesSelected(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
    setSelectedRowsMeta((prev) => {
      const next = { ...prev };
      if (next[rowKey]) {
        delete next[rowKey];
      } else {
        const row = filtered.find((c) => c.rowKey === rowKey);
        if (row) next[rowKey] = { id: row.id, petId: row.petId, petCount: row.petCount };
      }
      return next;
    });
  };

  // Whenever the user changes filters/search, the "all across pages" flag is
  // no longer valid — clear it but keep any already-selected rows.
  useEffect(() => {
    setAllAcrossPagesSelected(false);
  }, [search, filterSpecies, filterStatus, filterVet]);

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);

    // Split selection into:
    //   - clientIdsToDelete: full client + all its pets
    //   - petIdsToDelete: just one pet (when client has multiple pets)
    // Prefer `selectedRowsMeta` (which persists across pages); fall back to
    // the visible `filtered` list for any rows that were selected before
    // cross-page tracking was in place.
    const clientIdsToDelete: string[] = [];
    const petIdsToDelete: string[] = [];
    const seenClientIds = new Set<string>();
    for (const rowKey of selectedIds) {
      const meta =
        selectedRowsMeta[rowKey] ||
        (() => {
          const row = filtered.find((c) => c.rowKey === rowKey);
          return row ? { id: row.id, petId: row.petId, petCount: row.petCount } : null;
        })();
      if (!meta) continue;
      if (meta.petCount <= 1 || !meta.petId) {
        if (!seenClientIds.has(meta.id)) {
          clientIdsToDelete.push(meta.id);
          seenClientIds.add(meta.id);
        }
      } else {
        petIdsToDelete.push(meta.petId);
      }
    }

    const errors: string[] = [];
    try {
      if (clientIdsToDelete.length > 0) {
        await deleteClientsBulk(clientIdsToDelete);
      }
      if (petIdsToDelete.length > 0) {
        await deletePetsBulk(petIdsToDelete);
      }
    } catch (e: any) {
      errors.push(e?.message || 'Unknown error');
    }

    await refetch();
    window.dispatchEvent(new CustomEvent('clientDataChanged'));
    setSelectedIds(new Set());
    setSelectedRowsMeta({});
    setAllAcrossPagesSelected(false);
    setSelectMode(false);
    setBulkDeleting(false);
    setShowBulkDeleteConfirm(false);
    if (errors.length > 0) {
      console.error('[AdminClientsPage handleBulkDelete] errors:', errors);
      alert(`Delete failed:\n\n${errors.join('\n')}`);
    }
  };

  // Map Supabase rows → display shape — one row per pet (so bulk-delete can target individual pets)
  const displayClients = clients.flatMap((c) => {
    const initials = `${(c.first_name?.[0] ?? '').toUpperCase()}${(c.last_name?.[0] ?? '').toUpperCase()}`;
    const ownerName = `${c.first_name} ${c.last_name}`;
    const ownerEmail = c.email ?? '';
    const ownerPhone = c.phone ?? '';
    const status = (statusOverrides[c.id] || (c as any).health_status || 'Healthy') as Status;

    const pets = c.pets && c.pets.length > 0 ? c.pets : [null];
    return pets.map((pet) => ({
      id: c.id,
      petId: pet?.id || null,
      petCount: c.pets?.length || 0,
      rowKey: pet ? `${c.id}-${pet.id}` : c.id,
      petImage: pet?.photo_url || '',
      petName: pet?.name ?? '—',
      species: pet?.species ?? '—',
      breed: pet?.breed ?? '—',
      ownerName,
      ownerEmail,
      ownerPhone,
      ownerInitials: initials,
      assignedVetId: pet?.assigned_vet_id || null,
      assignedVetName: pet?.assigned_vet?.profiles
        ? `Dr. ${(pet.assigned_vet.profiles as any).first_name} ${(pet.assigned_vet.profiles as any).last_name}`
        : null,
      status,
      createdAt: c.created_at,
    }));
  });

  // Unique species from data for filter options
  const speciesOptions = Array.from(
    new Set(displayClients.map((c) => c.species).filter((s) => s && s !== '—')),
  );

  const filtered = displayClients.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      c.petName.toLowerCase().includes(q) ||
      c.ownerName.toLowerCase().includes(q) ||
      c.breed.toLowerCase().includes(q) ||
      c.ownerEmail.toLowerCase().includes(q) ||
      c.ownerPhone.includes(q);
    const matchesSpecies = filterSpecies === 'All' || c.species === filterSpecies;
    const matchesStatus = filterStatus === 'All' || c.status === filterStatus;
    const currentVetName =
      vetOverrides[c.petId || ''] !== undefined
        ? vetOverrides[c.petId || '']?.name || ''
        : c.assignedVetName || '';
    const matchesVet = filterVet === 'All' || currentVetName === filterVet;
    return matchesSearch && matchesSpecies && matchesStatus && matchesVet;
  });

  // Sort
  filtered.sort((a, b) => {
    switch (sortOrder) {
      case 'oldest':
        return (a.createdAt || '').localeCompare(b.createdAt || '');
      case 'newest':
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      case 'name-az':
        return a.petName.localeCompare(b.petName);
      case 'name-za':
        return b.petName.localeCompare(a.petName);
      default:
        return 0;
    }
  });

  const hasActiveFilters =
    filterSpecies !== 'All' || filterStatus !== 'All' || filterVet !== 'All';

  // Fetch EVERY client in the org (bypassing the 30-row pagination) with
  // their pets, apply the same filter logic the table uses, and return one
  // entry per pet-row (matching how `displayClients` builds its rows).
  const fetchAllMatchingRows = async (): Promise<Array<{ rowKey: string; meta: RowMeta }>> => {
    const { organizationId } = await getOrgContext();
    const { data, error } = await db
      .from('clients')
      .select(
        'id, first_name, last_name, email, phone, health_status, pets(id, name, species, breed, assigned_vet_id, assigned_vet:staff!pets_assigned_vet_id_fkey(profiles:profiles!staff_profile_id_fkey(first_name, last_name)))'
      )
      .eq('organization_id', organizationId);
    if (error || !data) {
      console.error('[fetchAllMatchingRows] failed:', error);
      return [];
    }
    const q = search.toLowerCase();
    const out: Array<{ rowKey: string; meta: RowMeta }> = [];
    for (const c of data as any[]) {
      const ownerName = `${c.first_name || ''} ${c.last_name || ''}`;
      const ownerEmail: string = c.email || '';
      const ownerPhone: string = c.phone || '';
      const status = (statusOverrides[c.id] || c.health_status || 'Healthy') as Status;
      const petCount: number = c.pets?.length || 0;
      const pets = petCount > 0 ? c.pets : [null];
      for (const pet of pets) {
        const petName: string = pet?.name || '';
        const species: string = pet?.species || '';
        const breed: string = pet?.breed || '';
        const profiles = pet?.assigned_vet?.profiles;
        const assignedVetName = profiles
          ? `Dr. ${profiles.first_name || ''} ${profiles.last_name || ''}`.trim()
          : null;
        const currentVetName =
          vetOverrides[pet?.id || ''] !== undefined
            ? vetOverrides[pet?.id || '']?.name || ''
            : assignedVetName || '';

        const matchesSearch = !q || (
          petName.toLowerCase().includes(q) ||
          ownerName.toLowerCase().includes(q) ||
          breed.toLowerCase().includes(q) ||
          ownerEmail.toLowerCase().includes(q) ||
          ownerPhone.includes(q)
        );
        const matchesSpecies = filterSpecies === 'All' || species === filterSpecies;
        const matchesStatus = filterStatus === 'All' || status === filterStatus;
        const matchesVet = filterVet === 'All' || currentVetName === filterVet;
        if (matchesSearch && matchesSpecies && matchesStatus && matchesVet) {
          const rowKey: string = pet ? `${c.id}-${pet.id}` : c.id;
          out.push({ rowKey, meta: { id: c.id, petId: pet?.id || null, petCount } });
        }
      }
    }
    return out;
  };

  // Select every matching row across ALL pages. Falls back to the currently
  // visible rows if the cross-page fetch fails.
  const selectAllAcrossPages = async () => {
    if (selectingAll) return;
    setSelectingAll(true);
    try {
      const rows = await fetchAllMatchingRows();
      if (rows.length === 0) {
        const nextIds = new Set(filtered.map((c) => c.rowKey));
        const nextMeta: Record<string, RowMeta> = {};
        for (const r of filtered) nextMeta[r.rowKey] = { id: r.id, petId: r.petId, petCount: r.petCount };
        setSelectedIds(nextIds);
        setSelectedRowsMeta(nextMeta);
        setAllAcrossPagesSelected(false);
      } else {
        const nextIds = new Set<string>();
        const nextMeta: Record<string, RowMeta> = {};
        for (const r of rows) {
          nextIds.add(r.rowKey);
          nextMeta[r.rowKey] = r.meta;
        }
        setSelectedIds(nextIds);
        setSelectedRowsMeta(nextMeta);
        setAllAcrossPagesSelected(true);
      }
    } finally {
      setSelectingAll(false);
    }
  };

  // One-click "Select All" from the header:
  //   • not in selectMode → enter selectMode AND select every matching row
  //     across all pages in one action
  //   • already "all across pages" → clear the selection
  //   • partial selection → expand to select every match across all pages
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
      setSelectedRowsMeta({});
      return;
    }
    await selectAllAcrossPages();
  };

  return (
    <>
      <div className="max-w-[1440px] mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[var(--text-primary)] mb-2">Clients</h1>
            <p className="text-[var(--text-secondary)]" style={{ fontSize: '16px', fontWeight: 400 }}>
              Manage your clients and their pets.
            </p>
          </div>
          <Button onClick={() => setAddClientOpen(true)}>
            <Plus className="w-4 h-4" />
            Add Client
          </Button>
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] pointer-events-none" />
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
              {speciesOptions.map((s) => (
                <DropdownMenuItem key={s} onClick={() => setFilterSpecies(s)}>
                  {s}
                </DropdownMenuItem>
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
              {STATUS_OPTIONS.map((s) => {
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
              {vets.map((v) => (
                <DropdownMenuItem key={v.id} onClick={() => setFilterVet(v.name)}>
                  {v.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear filters chip — only when something is filtered */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                setFilterSpecies('All');
                setFilterStatus('All');
                setFilterVet('All');
              }}
              className="flex items-center gap-1 px-2 py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              style={{
                fontSize: '12px',
                fontWeight: 500,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
              }}
              title="Clear filters"
            >
              <X className="w-3 h-3" />
            </button>
          )}

          {/* Vertical separator */}
          <div
            style={{
              width: '1px',
              height: '24px',
              backgroundColor: 'var(--border-color)',
              marginLeft: 'auto',
            }}
          />

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
                {sortOrder === 'newest'
                  ? 'Newest first'
                  : sortOrder === 'oldest'
                  ? 'Oldest first'
                  : sortOrder === 'name-az'
                  ? 'Name A–Z'
                  : 'Name Z–A'}
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSortOrder('newest')}>
                {sortOrder === 'newest' && (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-2" style={{ color: 'var(--brand-green-text)' }} />
                )}
                Newest first
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder('oldest')}>
                {sortOrder === 'oldest' && (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-2" style={{ color: 'var(--brand-green-text)' }} />
                )}
                Oldest first
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSortOrder('name-az')}>
                {sortOrder === 'name-az' && (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-2" style={{ color: 'var(--brand-green-text)' }} />
                )}
                Name A–Z
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder('name-za')}>
                {sortOrder === 'name-za' && (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-2" style={{ color: 'var(--brand-green-text)' }} />
                )}
                Name Z–A
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Selection bar */}
        {selectMode && (
          <div
            className="flex items-center gap-3 mb-4 px-4 py-3 border border-[var(--border-color)] bg-[var(--surface-elevated)]"
            style={{ borderRadius: '10px' }}
          >
            <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>
              {selectedIds.size > 0
                ? `${selectedIds.size} client${selectedIds.size !== 1 ? 's' : ''} selected`
                : 'Select clients to delete'}
            </span>
            {selectedIds.size > 0 && (
              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-white hover:opacity-90 transition-opacity"
                style={{
                  backgroundColor: '#EF4444',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Trash2 style={{ width: '14px', height: '14px' }} /> Delete
              </button>
            )}
            <button
              onClick={() => {
                setSelectedIds(new Set());
                setSelectedRowsMeta({});
                setAllAcrossPagesSelected(false);
                setSelectMode(false);
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              <X style={{ width: '14px', height: '14px' }} /> Cancel
            </button>
          </div>
        )}

        {/* Bulk delete confirmation dialog */}
        {showBulkDeleteConfirm && (
          <div
            className="fixed inset-0 flex items-center justify-center"
            style={{ zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)' }}
          >
            <div
              className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6"
              style={{
                borderRadius: '14px',
                maxWidth: '420px',
                width: '90%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="flex items-center justify-center"
                  style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#FEE2E2' }}
                >
                  <Trash2 style={{ width: '20px', height: '20px', color: '#EF4444' }} />
                </div>
                <h3 className="text-[var(--text-primary)]" style={{ fontSize: '18px', fontWeight: 700 }}>
                  Delete Clients
                </h3>
              </div>
              <p
                className="text-[var(--text-secondary)] mb-6"
                style={{ fontSize: '14px', lineHeight: '1.5' }}
              >
                Are you sure you want to delete{' '}
                <strong className="text-[var(--text-primary)]">
                  {selectedIds.size} client{selectedIds.size !== 1 ? 's' : ''}
                </strong>
                ? This will remove associated pets, records, and appointments. This action cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  disabled={bulkDeleting}
                  className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  style={{
                    background: 'none',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="px-4 py-2 text-white hover:opacity-90 transition-opacity"
                  style={{
                    backgroundColor: '#EF4444',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    opacity: bulkDeleting ? 0.6 : 1,
                  }}
                >
                  {bulkDeleting
                    ? 'Deleting...'
                    : `Delete ${selectedIds.size} Client${selectedIds.size !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div
          className="bg-[var(--surface-white)] border border-[var(--border-color)]"
          style={{ borderRadius: '12px' }}
        >
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
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          cursor: selectingAll ? 'wait' : 'pointer',
                          border:
                            allSelected || partial
                              ? '2px solid var(--brand-green-text)'
                              : '2px solid var(--text-secondary)',
                          backgroundColor:
                            allSelected || partial ? 'var(--brand-green-text)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
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
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path
                              d="M2 6l3 3 5-5"
                              stroke="#fff"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                        {!selectingAll && partial && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path
                              d="M3 6h6"
                              stroke="#fff"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                        )}
                      </div>
                    );
                  })()}
                </TableHead>
                <TableHead
                  className="py-3 px-4"
                  style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}
                >
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
                <TableHead
                  className="py-3 px-4"
                  style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}
                >
                  Owner
                  {totalCount != null && (
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
                      {totalCount}
                    </span>
                  )}
                </TableHead>
                <TableHead
                  className="py-3 px-4"
                  style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}
                >
                  Species
                </TableHead>
                <TableHead
                  className="py-3 px-4"
                  style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}
                >
                  Breed
                </TableHead>
                <TableHead
                  className="py-3 px-4"
                  style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}
                >
                  Assigned Doctor
                </TableHead>
                <TableHead
                  className="py-3 px-4"
                  style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}
                >
                  Phone
                </TableHead>
                <TableHead
                  className="py-3 px-4"
                  style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}
                >
                  Status
                </TableHead>
                <TableHead className="py-3 px-4 w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={9} className="py-16 text-center">
                    <Loader2
                      className="w-6 h-6 mx-auto animate-spin"
                      style={{ color: 'var(--text-secondary)' }}
                    />
                  </TableCell>
                </TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-16 text-center">
                    <Users className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--border-color)' }} />
                    <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      No clients yet
                    </p>
                    <p
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                        marginTop: '4px',
                      }}
                    >
                      Add your first client using the button above
                    </p>
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                filtered.map((client) => {
                  const opt = STATUS_OPTIONS.find((o) => o.value === client.status) ?? STATUS_OPTIONS[0];
                  const StatusIcon = opt.icon;
                  const isSelected = selectedIds.has(client.rowKey);
                  return (
                    <TableRow
                      key={client.rowKey}
                      className="hover:bg-[var(--surface-elevated)] cursor-pointer transition-colors"
                      style={
                        isSelected
                          ? {
                              backgroundColor:
                                'color-mix(in srgb, var(--brand-green-text) 8%, transparent)',
                            }
                          : undefined
                      }
                      onClick={() =>
                        navigate(
                          `/admin/clients/${client.id}${client.petId ? `?petId=${client.petId}` : ''}`,
                        )
                      }
                    >
                      {/* Checkbox */}
                      <TableCell className="py-4 px-4" style={{ width: '44px' }}>
                        {selectMode && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectClient(client.rowKey);
                            }}
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              border: isSelected
                                ? '2px solid var(--brand-green-text)'
                                : '2px solid var(--text-secondary)',
                              backgroundColor: isSelected
                                ? 'var(--brand-green-text)'
                                : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {isSelected && (
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path
                                  d="M2 6l3 3 5-5"
                                  stroke="#fff"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
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
                              {client.ownerInitials}
                            </div>
                          )}
                          <span
                            className="text-[var(--text-primary)]"
                            style={{ fontSize: '15px', fontWeight: 600 }}
                          >
                            {client.petName}
                          </span>
                        </div>
                      </TableCell>

                      {/* Owner (with custom email copy/send menu) */}
                      <TableCell className="py-4 px-4">
                        <div>
                          <p
                            className="text-[var(--text-primary)]"
                            style={{ fontSize: '15px', fontWeight: 500 }}
                          >
                            {client.ownerName}
                          </p>
                          <div
                            className="flex items-center gap-1 mt-1 relative"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Mail className="w-3 h-3 text-[var(--text-secondary)]" />
                            <button
                              className="hover:underline"
                              style={{
                                fontSize: '12px',
                                color:
                                  copiedEmail === client.ownerEmail
                                    ? '#22c55e'
                                    : 'var(--brand-green-text)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0,
                              }}
                              onClick={() =>
                                setEmailMenuOpen(
                                  emailMenuOpen === client.ownerEmail ? null : client.ownerEmail,
                                )
                              }
                            >
                              {copiedEmail === client.ownerEmail
                                ? '✓ Copied!'
                                : client.ownerEmail || '—'}
                            </button>
                            {emailMenuOpen === client.ownerEmail && client.ownerEmail && (
                              <>
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={() => setEmailMenuOpen(null)}
                                />
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
                                  <div
                                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-[var(--surface-elevated)]"
                                    onClick={() => {
                                      setEmailMenuOpen(null);
                                      navigate('/admin/communications', {
                                        state: {
                                          composeTo: client.ownerEmail,
                                          composeBody: `Hi ${client.ownerName.split(' ')[0]},<br><br>`,
                                        },
                                      });
                                    }}
                                  >
                                    <Send className="w-3.5 h-3.5" /> Send Email
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

                      {/* Assigned Doctor */}
                      <TableCell className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const currentVet =
                            vetOverrides[client.petId || ''] !== undefined
                              ? vetOverrides[client.petId || '']
                              : client.assignedVetName
                              ? { id: client.assignedVetId!, name: client.assignedVetName }
                              : null;
                          return (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="flex items-center gap-1.5 hover:bg-[var(--surface-elevated)] px-2 py-1 transition-colors"
                                  style={{
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    color: currentVet
                                      ? 'var(--text-primary)'
                                      : 'var(--text-secondary)',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {currentVet?.name || 'Unassigned'}
                                  <ChevronDown className="w-3 h-3 opacity-50" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-48">
                                <DropdownMenuLabel>Assign Doctor</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {vets.map((v) => (
                                  <DropdownMenuItem
                                    key={v.id}
                                    onClick={async () => {
                                      if (client.petId) {
                                        const { organizationId } = await getOrgContext();
                                        setVetOverrides((prev) => ({
                                          ...prev,
                                          [client.petId!]: v,
                                        }));
                                        await db
                                          .from('pets')
                                          .update({ assigned_vet_id: v.id })
                                          .eq('id', client.petId)
                                          .eq('organization_id', organizationId);
                                        window.dispatchEvent(new CustomEvent('petDataChanged'));
                                      }
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontWeight: currentVet?.id === v.id ? 600 : 400,
                                      }}
                                    >
                                      {v.name}
                                    </span>
                                  </DropdownMenuItem>
                                ))}
                                {currentVet && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={async () => {
                                        if (client.petId) {
                                          const { organizationId } = await getOrgContext();
                                          setVetOverrides((prev) => ({
                                            ...prev,
                                            [client.petId!]: null,
                                          }));
                                          await db
                                            .from('pets')
                                            .update({ assigned_vet_id: null })
                                            .eq('id', client.petId)
                                            .eq('organization_id', organizationId);
                                          window.dispatchEvent(new CustomEvent('petDataChanged'));
                                        }
                                      }}
                                    >
                                      <span style={{ color: 'var(--text-secondary)' }}>Unassign</span>
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          );
                        })()}
                      </TableCell>

                      {/* Phone */}
                      <TableCell className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                        <a
                          href={`tel:${client.ownerPhone}`}
                          className="flex items-center gap-1.5 hover:underline"
                          style={{
                            fontSize: '14px',
                            color: 'var(--text-primary)',
                            textDecoration: 'none',
                          }}
                        >
                          <Phone className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                          {client.ownerPhone || '—'}
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
                            <DropdownMenuLabel
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                color: 'var(--text-secondary)',
                                letterSpacing: '0.05em',
                              }}
                            >
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
                                    <span
                                      className="block"
                                      style={{
                                        fontSize: '14px',
                                        fontWeight: isCurrent ? 700 : 500,
                                        color: 'var(--text-primary)',
                                      }}
                                    >
                                      {option.value}
                                      {isCurrent && (
                                        <span
                                          style={{
                                            color: option.text,
                                            marginLeft: '6px',
                                            fontSize: '11px',
                                          }}
                                        >
                                          ✓ current
                                        </span>
                                      )}
                                    </span>
                                    <span
                                      className="block text-[var(--text-secondary)]"
                                      style={{ fontSize: '12px' }}
                                    >
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
                        {deletingId === client.rowKey ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="destructive"
                              size="sm"
                              style={{ fontSize: '12px', padding: '2px 8px' }}
                              onClick={async () => {
                                if (client.petCount <= 1 || !client.petId) {
                                  // Only 1 pet (or no pet) — delete the whole client profile
                                  await deleteClient(client.id);
                                } else {
                                  // Multiple pets — only delete this pet (with full cascade)
                                  await deletePetCascade(client.petId);
                                  refetch();
                                }
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
                            onClick={() => setDeletingId(client.rowKey)}
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
              {/* Loading-more indicator (shown while a new page is being fetched) */}
              {loadingMore && (
                <TableRow>
                  <TableCell colSpan={9} className="py-6 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2
                        className="w-4 h-4 animate-spin"
                        style={{ color: 'var(--text-secondary)' }}
                      />
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Loading more clients…
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Infinite-scroll sentinel — when this scrolls into view, loadMore() fires */}
          {hasMore && !loading && (
            <div ref={sentinelRef} aria-hidden="true" style={{ height: '1px' }} />
          )}

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[var(--border-color)] flex items-center justify-between">
            <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>
              {totalCount != null ? (
                <>
                  Showing <strong style={{ color: 'var(--text-primary)' }}>{clients.length}</strong> of{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{totalCount}</strong> clients
                </>
              ) : (
                <>
                  Showing <strong style={{ color: 'var(--text-primary)' }}>{clients.length}</strong> clients
                </>
              )}
              {hasMore && !loadingMore && (
                <span style={{ marginLeft: '8px', opacity: 0.7 }}>· scroll for more</span>
              )}
              {!hasMore && clients.length > 0 && (
                <span style={{ marginLeft: '8px', opacity: 0.7 }}>· all loaded</span>
              )}
            </p>
          </div>
        </div>
      </div>

      <AddClientDialog
        open={addClientOpen}
        onOpenChange={(open) => {
          setAddClientOpen(open);
          if (!open)
            setTimeout(() => {
              refetch();
              window.dispatchEvent(new CustomEvent('notifCountChanged'));
            }, 300);
        }}
        onSave={handleAddClient}
      />
    </>
  );
}
