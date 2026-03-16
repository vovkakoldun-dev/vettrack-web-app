import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Search, Plus, Mail, Phone, ChevronDown, CheckCircle2, AlertCircle, AlertTriangle, Loader2, Users } from 'lucide-react';
import { AddClientDialog } from '../components/AddClientDialog';
import { useClients } from '../hooks/useClients';
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
  const { clients, loading, addClient } = useClients();

  const handleAddClient = async (values: AddClientValues) => {
    const { error } = await addClient(values);
    if (!error) setAddClientOpen(false);
  };

  // Map Supabase rows to display shape
  const displayClients = clients.map(c => ({
    id: c.id,
    petImage: c.pets?.[0]?.photo_url ?? '',
    petName: c.pets?.[0]?.name ?? '—',
    species: c.pets?.[0]?.species ?? '—',
    breed: c.pets?.[0]?.breed ?? '—',
    ownerName: `${c.first_name} ${c.last_name}`,
    ownerEmail: c.email ?? '',
    ownerPhone: c.phone ?? '',
    lastVisit: '—',
    status: ((['Healthy', 'Follow-up', 'Critical'].includes(c.portal_status ?? '')) ? c.portal_status : 'Healthy') as Status,
  }));

  const filtered = displayClients.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.petName.toLowerCase().includes(q) ||
      c.ownerName.toLowerCase().includes(q) ||
      c.breed.toLowerCase().includes(q) ||
      c.ownerEmail.toLowerCase().includes(q)
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

      {/* Search + Filters */}
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin" style={{ color: 'var(--text-secondary)' }} />
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center">
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
                  key={client.id}
                  className="hover:bg-[var(--surface-elevated)] cursor-pointer transition-colors"
                  onClick={() => navigate(`/clients/${client.id}`)}
                >
                  {/* Pet */}
                  <TableCell className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={client.petImage}
                        alt={client.petName}
                        className="w-10 h-10 object-cover"
                        style={{ borderRadius: '9999px' }}
                      />
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
                      <div className="flex items-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                        <Mail className="w-3 h-3 text-[var(--text-secondary)]" />
                        <button
                          onClick={() => navigate('/communications')}
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

                  {/* Last Visit */}
                  <TableCell className="py-4 px-4">
                    <span className="text-[var(--text-secondary)]" style={{ fontSize: '16px', fontWeight: 400 }}>
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
                              onClick={() => {}}
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
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-color)] flex items-center justify-between">
          <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px', fontWeight: 400 }}>
            Showing {filtered.length} of {clients.length} clients
          </p>
        </div>
      </div>
    </div>

      <AddClientDialog open={addClientOpen} onOpenChange={setAddClientOpen} onSave={handleAddClient} />
    </>
  );
}
