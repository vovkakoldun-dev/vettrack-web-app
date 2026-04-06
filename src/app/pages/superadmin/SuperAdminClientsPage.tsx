import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Search, Plus, Mail, Phone, ChevronDown, CheckCircle2, AlertCircle, AlertTriangle, Trash2, Copy, Send, Check, Download, Upload, FileText, X, AlertCircle as AlertIcon, CheckCircle } from 'lucide-react';
import { useTenantDb } from '../../context/TenantContext';
import { getOrgContext } from '../../hooks/useOrgContext';
import { AddClientDialog } from '../../components/AddClientDialog';
import type { AddClientValues } from '../../hooks/useClients';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { useClients } from '../../hooks/useClients';
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

const CSV_HEADERS = ['first_name', 'last_name', 'email', 'phone', 'address', 'city', 'state', 'zip', 'country', 'notes'] as const;

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
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  notes?: string;
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
  const { clients: supabaseClients, loading, addClient, deleteClient, refetch } = useClients();
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, Status>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [emailMenuOpen, setEmailMenuOpen] = useState<string | null>(null);

  // CSV import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);

  // ── Export CSV ───────────────────────────────────────────────
  const handleExportCSV = () => {
    const header = CSV_HEADERS.join(',');
    const rows = supabaseClients.map((c) =>
      CSV_HEADERS.map((h) => escapeCsvField(String(c[h] ?? ''))).join(',')
    );
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
          first_name: fn,
          last_name: ln,
          email: row.email || undefined,
          phone: row.phone || row.phone_number || row['phone number'] || undefined,
          address: row.address || row.street || row.street_address || row['street address'] || undefined,
          city: row.city || undefined,
          state: row.state || row.province || row.state_province || row['state/province'] || undefined,
          zip: row.zip || row.zip_code || row['zip code'] || row.postal_code || row['postal code'] || undefined,
          country,
          notes: row.notes || undefined,
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
  const handleImportConfirm = async () => {
    const validRows = importRows.filter((r) => r._valid);
    if (validRows.length === 0) return;
    setImporting(true);
    let success = 0;
    let failed = 0;
    for (const row of validRows) {
      const { _valid, _error, ...values } = row;
      const { error } = await addClient(values as AddClientValues);
      if (error) {
        failed++;
      } else {
        success++;
      }
    }
    setImporting(false);
    setImportResult({ success, failed });
    if (success > 0) {
      await refetch();
      window.dispatchEvent(new CustomEvent('clientDataChanged'));
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
      await db.from('clients').update({ health_status: newStatus }).eq('id', supaId).eq('organization_id', organizationId);
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
            style={{ gap: '6px' }}
          >
            <Download className="w-4 h-4" />
            Export CSV
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
                  onClick={() => navigate(`/superadmin/clients/${(client as Client & { _supaId: string })._supaId}`)}
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
                    <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600 }}>First Name</TableHead>
                    <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600 }}>Last Name</TableHead>
                    <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600 }}>Email</TableHead>
                    <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600 }}>Phone</TableHead>
                    <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600 }}>City</TableHead>
                    <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600, width: '40px' }}>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importRows.map((row, i) => (
                    <TableRow
                      key={i}
                      style={{ backgroundColor: row._valid ? 'transparent' : 'rgba(212,24,61,0.04)' }}
                    >
                      <TableCell className="py-2 px-3" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{i + 1}</TableCell>
                      <TableCell className="py-2 px-3" style={{ fontSize: '13px', fontWeight: 500 }}>{row.first_name || <span style={{ color: '#d4183d', fontStyle: 'italic' }}>missing</span>}</TableCell>
                      <TableCell className="py-2 px-3" style={{ fontSize: '13px', fontWeight: 500 }}>{row.last_name || <span style={{ color: '#d4183d', fontStyle: 'italic' }}>missing</span>}</TableCell>
                      <TableCell className="py-2 px-3" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{row.email || '—'}</TableCell>
                      <TableCell className="py-2 px-3" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{row.phone || '—'}</TableCell>
                      <TableCell className="py-2 px-3" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{row.city || '—'}</TableCell>
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
                  ))}
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
