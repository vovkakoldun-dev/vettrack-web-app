import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Search, Plus, Mail, Phone, ChevronDown, CheckCircle2, AlertCircle, AlertTriangle, Loader2, Users, Trash2, Filter, X } from 'lucide-react';
import { AddClientDialog } from '../components/AddClientDialog';
import { useClients } from '../hooks/useClients';
import { supabase } from '../../lib/supabase';
import type { AddClientValues } from '../hooks/useClients';
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';

type Status = 'Healthy' | 'Follow-up' | 'Critical';

const STATUS_OPTIONS: { value: Status; bg: string; text: string; icon: React.ElementType; description: string }[] = [
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

// Mock data removed — replaced with live Supabase queries via useClients()
export default function ClientsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [addClientOpen, setAddClientOpen] = useState(false);
  const { clients, loading, addClient, deleteClient, refetch } = useClients();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, Status>>({});
  const [vets, setVets] = useState<{ id: string; name: string }[]>([]);
  const [vetOverrides, setVetOverrides] = useState<Record<string, { id: string; name: string } | null>>({});
  const [filterSpecies, setFilterSpecies] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterVet, setFilterVet] = useState<string>('All');

  useEffect(() => {
    supabase.from('staff').select('id, first_name, last_name').then(({ data }) => {
      if (data) setVets(data.map((v: any) => ({ id: v.id, name: `Dr. ${v.first_name} ${v.last_name}` })));
    });
  }, []);

  const handleAddClient = async (values: AddClientValues): Promise<string | void> => {
    const { data, error } = await addClient(values);
    if (!error && data) {
      // Refetch after a short delay to pick up the pet record created by AddClientDialog
      setTimeout(() => refetch(), 500);
      return (data as any).id as string;
    }
  };

  const updateStatus = async (clientId: string, newStatus: Status) => {
    setStatusOverrides((prev) => ({ ...prev, [clientId]: newStatus }));
    await supabase.from('clients').update({ health_status: newStatus }).eq('id', clientId);
  };

  // Map Supabase rows to display shape — one row per pet
  const displayClients = clients.flatMap(c => {
    const initials = `${(c.first_name?.[0] ?? '').toUpperCase()}${(c.last_name?.[0] ?? '').toUpperCase()}`;
    const ownerName = `${c.first_name} ${c.last_name}`;
    const ownerEmail = c.email ?? '';
    const ownerPhone = c.phone ?? '';
    const status = (statusOverrides[c.id] || (c as any).health_status || 'Healthy') as Status;

    const pets = c.pets && c.pets.length > 0 ? c.pets : [null];
    return pets.map((pet, idx) => ({
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
      assignedVetName: pet?.assigned_vet ? `Dr. ${(pet.assigned_vet as any).first_name} ${(pet.assigned_vet as any).last_name}` : null,
      status,
    }));
  });

  // Get unique species from data for filter options
  const speciesOptions = Array.from(new Set(displayClients.map(c => c.species).filter(s => s && s !== '—')));

  const filtered = displayClients.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || (
      c.petName.toLowerCase().includes(q) ||
      c.ownerName.toLowerCase().includes(q) ||
      c.breed.toLowerCase().includes(q) ||
      c.ownerEmail.toLowerCase().includes(q)
    );
    const matchesSpecies = filterSpecies === 'All' || c.species === filterSpecies;
    const matchesStatus = filterStatus === 'All' || c.status === filterStatus;
    const currentVetName = vetOverrides[c.petId || ''] !== undefined
      ? vetOverrides[c.petId || '']?.name || ''
      : c.assignedVetName || '';
    const matchesVet = filterVet === 'All' || currentVetName === filterVet;
    return matchesSearch && matchesSpecies && matchesStatus && matchesVet;
  });

  const hasActiveFilters = filterSpecies !== 'All' || filterStatus !== 'All' || filterVet !== 'All';

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

      {/* Search + Filters */}
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <div className="relative" style={{ minWidth: '280px' }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <Input
            placeholder="Search by pet, owner, or breed..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-[var(--surface-elevated)]" style={{ borderRadius: '8px' }}>
          <Filter className="w-3.5 h-3.5 text-[var(--text-secondary)] ml-2" />
          {/* Species Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 px-3 py-1.5 transition-colors" style={{
                borderRadius: '6px', fontSize: '13px', fontWeight: filterSpecies !== 'All' ? 600 : 400,
                backgroundColor: filterSpecies !== 'All' ? 'var(--surface-white)' : 'transparent',
                color: filterSpecies !== 'All' ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: filterSpecies !== 'All' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}>
                {filterSpecies === 'All' ? 'Species' : filterSpecies}
                <ChevronDown className="w-3 h-3" />
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
              <button className="flex items-center gap-1 px-3 py-1.5 transition-colors" style={{
                borderRadius: '6px', fontSize: '13px', fontWeight: filterStatus !== 'All' ? 600 : 400,
                backgroundColor: filterStatus !== 'All' ? 'var(--surface-white)' : 'transparent',
                color: filterStatus !== 'All' ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: filterStatus !== 'All' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}>
                {filterStatus === 'All' ? 'Status' : filterStatus}
                <ChevronDown className="w-3 h-3" />
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
              <button className="flex items-center gap-1 px-3 py-1.5 transition-colors" style={{
                borderRadius: '6px', fontSize: '13px', fontWeight: filterVet !== 'All' ? 600 : 400,
                backgroundColor: filterVet !== 'All' ? 'var(--surface-white)' : 'transparent',
                color: filterVet !== 'All' ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: filterVet !== 'All' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}>
                {filterVet === 'All' ? 'Doctor' : filterVet}
                <ChevronDown className="w-3 h-3" />
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
        </div>

        {hasActiveFilters && (
          <button
            onClick={() => { setFilterSpecies('All'); setFilterStatus('All'); setFilterVet('All'); }}
            className="flex items-center gap-1 px-2 py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            style={{ fontSize: '12px', fontWeight: 500 }}
          >
            <X className="w-3 h-3" />
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)]" style={{ borderRadius: '12px' }}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Pet
              </TableHead>
              <TableHead className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Owner
              </TableHead>
              <TableHead className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Species
              </TableHead>
              <TableHead className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Breed
              </TableHead>
              <TableHead className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Assigned Doctor
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
                <TableCell colSpan={8} className="py-16 text-center">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin" style={{ color: 'var(--text-secondary)' }} />
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center">
                  <Users className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--border-color)' }} />
                  <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>No clients yet</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Add your first client using the button above</p>
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.map((client) => {
              const opt = STATUS_OPTIONS.find((o) => o.value === client.status) ?? STATUS_OPTIONS[0];
              const StatusIcon = opt.icon;
              return (
                <TableRow
                  key={client.rowKey}
                  className="hover:bg-[var(--surface-elevated)] cursor-pointer transition-colors"
                  onClick={() => navigate(`/clients/${client.id}${client.petId ? `?petId=${client.petId}` : ''}`)}
                >
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
                            color: 'var(--brand-green-text, #2D6A4F)',
                            fontSize: '14px',
                            fontWeight: 700,
                          }}
                        >
                          {client.ownerInitials}
                        </div>
                      )}
                      <span className="text-[var(--text-primary)]" style={{ fontSize: '16px', fontWeight: 600 }}>
                        {client.petName}
                      </span>
                    </div>
                  </TableCell>

                  {/* Owner */}
                  <TableCell className="py-4 px-4">
                    <div>
                      <p className="text-[var(--text-primary)]" style={{ fontSize: '16px', fontWeight: 400 }}>
                        {client.ownerName}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <Mail className="w-3 h-3 text-[var(--text-secondary)]" />
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate('/communications'); }}
                          className="hover:underline"
                          style={{ fontSize: '12px', color: 'var(--brand-green-text)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          {client.ownerEmail}
                        </button>
                      </div>
                    </div>
                  </TableCell>

                  {/* Species */}
                  <TableCell className="py-4 px-4">
                    <span className="text-[var(--text-secondary)]" style={{ fontSize: '16px', fontWeight: 400 }}>
                      {client.species}
                    </span>
                  </TableCell>

                  {/* Breed */}
                  <TableCell className="py-4 px-4">
                    <span className="text-[var(--text-secondary)]" style={{ fontSize: '16px', fontWeight: 400 }}>
                      {client.breed}
                    </span>
                  </TableCell>

                  {/* Assigned Doctor */}
                  <TableCell className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                    {(() => {
                      const currentVet = vetOverrides[client.petId || ''] !== undefined
                        ? vetOverrides[client.petId || '']
                        : (client.assignedVetName ? { id: client.assignedVetId!, name: client.assignedVetName } : null);
                      return (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="flex items-center gap-1.5 hover:bg-[var(--surface-elevated)] px-2 py-1 transition-colors"
                              style={{ fontSize: '14px', fontWeight: 500, color: currentVet ? 'var(--text-primary)' : 'var(--text-secondary)', borderRadius: '6px', border: 'none', background: 'none', cursor: 'pointer' }}
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
                                    setVetOverrides((prev) => ({ ...prev, [client.petId!]: v }));
                                    await supabase.from('pets').update({ assigned_vet_id: v.id }).eq('id', client.petId);
                                  }
                                }}
                              >
                                <span style={{ fontWeight: currentVet?.id === v.id ? 600 : 400 }}>
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
                                      setVetOverrides((prev) => ({ ...prev, [client.petId!]: null }));
                                      await supabase.from('pets').update({ assigned_vet_id: null }).eq('id', client.petId);
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
                      style={{ fontSize: '14px', color: 'var(--text-primary)', textDecoration: 'none' }}
                    >
                      <Phone className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                      {client.ownerPhone}
                    </a>
                  </TableCell>

                  {/* Status — clickable dropdown */}
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
                              style={{ opacity: isCurrent ? 1 : undefined }}
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
                              // Multiple pets — only delete this pet
                              await supabase.from('pets').delete().eq('id', client.petId);
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
          </TableBody>
        </Table>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-color)] flex items-center justify-between">
          <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px', fontWeight: 400 }}>
            Showing {filtered.length} of {displayClients.length} entries ({clients.length} clients)
          </p>
        </div>
      </div>
    </div>

      <AddClientDialog open={addClientOpen} onOpenChange={setAddClientOpen} onSave={handleAddClient} />
    </>
  );
}
