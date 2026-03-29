import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Search, Plus, Mail, Phone, ChevronDown, CheckCircle2, AlertCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { getOrgContext } from '../../hooks/useOrgContext';
import { AddClientDialog } from '../../components/AddClientDialog';
import type { AddClientValues } from '../../hooks/useClients';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { useClients } from '../../hooks/useClients';
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

export default function AdminClientsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { clients: supabaseClients, loading, addClient, deleteClient, refetch } = useClients();
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, Status>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAddClient = async (values: AddClientValues): Promise<string | void> => {
    const { data, error } = await addClient(values);
    if (!error && data) {
      return (data as any).id as string;
    }
  };

  // Map Supabase ClientRow[] → Client[] for the existing UI
  const clientList: Client[] = useMemo(() =>
    supabaseClients.map((c, idx) => {
      const pet = c.pets?.[0];
      const initials = `${(c.first_name?.[0] ?? '').toUpperCase()}${(c.last_name?.[0] ?? '').toUpperCase()}`;
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
      };
    }),
    [supabaseClients, statusOverrides],
  ) as (Client & { _supaId: string })[];

  const updateStatus = async (id: number, newStatus: Status) => {
    const entry = clientList.find((c) => c.id === id);
    if (entry) {
      const supaId = (entry as Client & { _supaId: string })._supaId;
      setStatusOverrides((prev) => ({ ...prev, [supaId]: newStatus }));
      const { organizationId } = await getOrgContext();
      await supabase.from('clients').update({ health_status: newStatus }).eq('id', supaId).eq('organization_id', organizationId);
      window.dispatchEvent(new CustomEvent('clientDataChanged'));
    }
  };

  const filtered = clientList.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.petName.toLowerCase().includes(q) ||
      c.ownerName.toLowerCase().includes(q) ||
      c.breed.toLowerCase().includes(q) ||
      c.ownerEmail.toLowerCase().includes(q) ||
      c.ownerPhone.includes(q)
    );
  });

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

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <Input
            placeholder="Search by pet, owner, or breed..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
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
            {filtered.map((client) => {
              const opt = STATUS_OPTIONS.find((o) => o.value === client.status)!;
              const StatusIcon = opt.icon;
              return (
                <TableRow
                  key={client.id}
                  className="hover:bg-[var(--surface-elevated)] cursor-pointer transition-colors"
                  onClick={() => navigate(`/admin/clients/${(client as Client & { _supaId: string })._supaId}`)}
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
                      <div className="flex items-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                        <Mail className="w-3 h-3 text-[var(--text-secondary)]" />
                        <button
                          onClick={() => navigate('/admin/communications')}
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
          </TableBody>
        </Table>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-color)] flex items-center justify-between">
          <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>
            Showing <strong style={{ color: 'var(--text-primary)' }}>{filtered.length}</strong> of{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{clientList.length}</strong> clients
          </p>
        </div>
      </div>
    </div>

      <AddClientDialog open={addClientOpen} onOpenChange={(open) => { setAddClientOpen(open); if (!open) setTimeout(() => { refetch(); window.dispatchEvent(new CustomEvent('notifCountChanged')); }, 300); }} onSave={handleAddClient} />
    </>
  );
}
