import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Search, Plus, Mail, Phone, ChevronDown, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { AddClientDialog } from '../../components/AddClientDialog';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
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

// ─── Mock Data ────────────────────────────────────────────────

const INITIAL_CLIENTS: Client[] = [
  {
    id: 1,
    petImage: 'https://images.unsplash.com/photo-1734966213753-1b361564bab4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb2xkZW4lMjByZXRyaWV2ZXIlMjBkb2clMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzMyNDMxMzB8MA&ixlib=rb-4.1.0&q=80&w=400',
    petName: 'Max',
    species: 'Dog',
    breed: 'Golden Retriever',
    ownerName: 'John Smith',
    ownerEmail: 'john.smith@email.com',
    ownerPhone: '(555) 201-4832',
    lastVisit: 'Mar 14, 2026',
    nextAppointment: 'Apr 10, 2026',
    balance: 0,
    status: 'Healthy',
  },
  {
    id: 2,
    petImage: 'https://images.unsplash.com/photo-1670739088209-64414249354b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0YWJieSUyMGNhdCUyMHBvcnRyYWl0fGVufDF8fHx8MTc3MzI3OTg3NHww&ixlib=rb-4.1.0&q=80&w=400',
    petName: 'Luna',
    species: 'Cat',
    breed: 'Tabby',
    ownerName: 'Emily Johnson',
    ownerEmail: 'emily.j@email.com',
    ownerPhone: '(555) 384-2910',
    lastVisit: 'Mar 14, 2026',
    nextAppointment: 'Apr 2, 2026',
    balance: 85.00,
    status: 'Follow-up',
  },
  {
    id: 3,
    petImage: 'https://images.unsplash.com/photo-1685387714439-edef4bd70ef5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWFnbGUlMjBkb2clMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzMyMzM4ODd8MA&ixlib=rb-4.1.0&q=80&w=400',
    petName: 'Cooper',
    species: 'Dog',
    breed: 'Beagle',
    ownerName: 'Michael Brown',
    ownerEmail: 'mbrown@email.com',
    ownerPhone: '(555) 172-6045',
    lastVisit: 'Mar 13, 2026',
    nextAppointment: 'Jun 8, 2026',
    balance: 250.00,
    status: 'Healthy',
  },
  {
    id: 4,
    petImage: 'https://images.unsplash.com/photo-1608574592993-774ffa9a218e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaWFtZXNlJTIwY2F0JTIwcG9ydHJhaXR8ZW58MXx8fHwxNzczMTczMjkwfDA&ixlib=rb-4.1.0&q=80&w=400',
    petName: 'Bella',
    species: 'Cat',
    breed: 'Siamese',
    ownerName: 'Sarah Williams',
    ownerEmail: 'sarah.w@email.com',
    ownerPhone: '(555) 498-3367',
    lastVisit: 'Mar 13, 2026',
    nextAppointment: 'Mar 20, 2026',
    balance: 0,
    status: 'Healthy',
  },
  {
    id: 5,
    petImage: 'https://images.unsplash.com/photo-1665918577658-c7cddc5fd53c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3JnaSUyMGRvZyUyMHBvcnRyYWl0fGVufDF8fHx8MTc3MzI3OTg3NHww&ixlib=rb-4.1.0&q=80&w=400',
    petName: 'Charlie',
    species: 'Dog',
    breed: 'Corgi',
    ownerName: 'David Miller',
    ownerEmail: 'dmiller@email.com',
    ownerPhone: '(555) 710-2284',
    lastVisit: 'Mar 12, 2026',
    nextAppointment: 'Mar 19, 2026',
    balance: 0,
    status: 'Follow-up',
  },
  {
    id: 6,
    petImage: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8ZG9nfGVufDB8fDB8fHww&ixlib=rb-4.1.0&q=80&w=400',
    petName: 'Rocky',
    species: 'Dog',
    breed: 'German Shepherd',
    ownerName: 'James Wilson',
    ownerEmail: 'jwilson@email.com',
    ownerPhone: '(555) 639-8821',
    lastVisit: 'Mar 12, 2026',
    nextAppointment: 'Mar 17, 2026',
    balance: 70.00,
    status: 'Critical',
  },
  {
    id: 7,
    petImage: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8Y2F0fGVufDB8fDB8fHww&ixlib=rb-4.1.0&q=80&w=400',
    petName: 'Milo',
    species: 'Cat',
    breed: 'Persian',
    ownerName: 'Jessica Taylor',
    ownerEmail: 'jessica.t@email.com',
    ownerPhone: '(555) 857-4493',
    lastVisit: 'Mar 11, 2026',
    nextAppointment: 'May 28, 2026',
    balance: 0,
    status: 'Healthy',
  },
  {
    id: 8,
    petImage: 'https://images.unsplash.com/photo-1561037404-61cd46aa615b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8ZG9nfGVufDB8fDB8fHww&ixlib=rb-4.1.0&q=80&w=400',
    petName: 'Daisy',
    species: 'Dog',
    breed: 'Labrador',
    ownerName: 'Robert Anderson',
    ownerEmail: 'r.anderson@email.com',
    ownerPhone: '(555) 321-9907',
    lastVisit: 'Mar 11, 2026',
    nextAppointment: 'Mar 25, 2026',
    balance: 0,
    status: 'Follow-up',
  },
  {
    id: 9,
    petImage: 'https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8Y2F0fGVufDB8fDB8fHww&ixlib=rb-4.1.0&q=80&w=400',
    petName: 'Oliver',
    species: 'Cat',
    breed: 'Maine Coon',
    ownerName: 'Lisa Martinez',
    ownerEmail: 'l.martinez@email.com',
    ownerPhone: '(555) 445-6633',
    lastVisit: 'Mar 11, 2026',
    nextAppointment: 'Apr 20, 2026',
    balance: 250.00,
    status: 'Healthy',
  },
  {
    id: 10,
    petImage: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8ZG9nfGVufDB8fDB8fHww&ixlib=rb-4.1.0&q=80&w=400',
    petName: 'Buddy',
    species: 'Dog',
    breed: 'Poodle',
    ownerName: 'Kevin Lee',
    ownerEmail: 'kevin.lee@email.com',
    ownerPhone: '(555) 596-7721',
    lastVisit: 'Mar 10, 2026',
    nextAppointment: 'May 15, 2026',
    balance: 0,
    status: 'Healthy',
  },
];

// ─── Page ─────────────────────────────────────────────────────

export default function AdminClientsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [clientList, setClientList] = useState<Client[]>(INITIAL_CLIENTS);
  const [addClientOpen, setAddClientOpen] = useState(false);

  const updateStatus = (id: number, newStatus: Status) => {
    setClientList((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
    );
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
                >
                  {/* Pet */}
                  <TableCell className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={client.petImage}
                        alt={client.petName}
                        className="w-10 h-10 object-cover flex-shrink-0"
                        style={{ borderRadius: '9999px' }}
                      />
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

      <AddClientDialog open={addClientOpen} onOpenChange={setAddClientOpen} />
    </>
  );
}
