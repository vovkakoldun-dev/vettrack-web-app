/**
 * MedicalOverviewTab — self-contained tab component for the Visit form.
 *
 * Shows Problems (reuses exported ProblemsSection), Allergies, and Treatments
 * with full CRUD against Supabase. Follows the same prop pattern as
 * InjectionsTab / XRayTab / etc.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTenantDb } from '../context/TenantContext';
import { useAuth } from '../context/AuthContext';
import { ProblemsSection } from './ClientDetailPage';
import {
  AlertCircle, Plus, X, Check, ChevronDown, PlusCircle, Loader2,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '../components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import {
  Popover, PopoverTrigger, PopoverContent,
} from '../components/ui/popover';
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '../components/ui/command';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../components/ui/select';

// ── Types ───────────────────────────────────────────────────────
interface TreatmentRow {
  id: any;
  name: string;
  date: string;
  vet: string;
  notes: string;
  addedBy?: string;
  createdAt?: string;
}

// ── Treatment presets ───────────────────────────────────────────
const TREATMENT_PRESETS = [
  'Rabies Vaccine', 'DHPP Vaccine', 'FVRCP Vaccine', 'FeLV Vaccine',
  'Bordetella Vaccine', 'Leptospirosis Vaccine', 'Lyme Vaccine',
  'Dental Cleaning', 'Dental Extraction', 'Spay', 'Neuter', 'Microchip Implant',
  'Flea/Tick Prevention', 'Heartworm Prevention', 'Deworming',
  'X-Ray', 'Ultrasound', 'Blood Work', 'Urinalysis',
  'Wound Care', 'Sutures', 'Bandage Change', 'Ear Cleaning',
  'Nail Trim', 'Anal Gland Expression',
];

// ── Component ───────────────────────────────────────────────────
export function MedicalOverviewTab({
  petName,
  petDbId,
}: {
  petName: string;
  petDbId: string;
}) {
  const db = useTenantDb();
  const { user } = useAuth();

  // ── Loading state ──────────────────────────────────────────────
  const [loading, setLoading] = useState(true);

  // ── Allergies ──────────────────────────────────────────────────
  const [allergies, setAllergies] = useState<string[]>([]);
  const [allergyInput, setAllergyInput] = useState('');
  const [showAllergyInput, setShowAllergyInput] = useState(false);

  // ── Treatments ─────────────────────────────────────────────────
  const [treatments, setTreatments] = useState<TreatmentRow[]>([]);
  const [treatmentDialogOpen, setTreatmentDialogOpen] = useState(false);
  const [treatmentPopoverOpen, setTreatmentPopoverOpen] = useState(false);
  const [newTreatmentName, setNewTreatmentName] = useState('');
  const [newTreatmentDate, setNewTreatmentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newTreatmentVet, setNewTreatmentVet] = useState('');
  const [newTreatmentNotes, setNewTreatmentNotes] = useState('');

  // ── Vets (for the treatment dialog) ────────────────────────────
  const [vets, setVets] = useState<{ id: string; name: string }[]>([]);

  // ── Fetch data ─────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!petDbId) { setLoading(false); return; }
    setLoading(true);
    const [allergyRes, treatmentRes] = await Promise.all([
      db.from('pet_allergies').select('*').eq('pet_id', petDbId),
      db.from('pet_treatments').select('*').eq('pet_id', petDbId).order('date', { ascending: false }),
    ]);
    if (allergyRes.data) setAllergies(allergyRes.data.map((a: any) => a.name));
    if (treatmentRes.data) {
      setTreatments(
        treatmentRes.data.map((t: any) => ({
          id: t.id,
          name: t.name,
          date: t.date,
          vet: t.vet || '',
          notes: t.notes || '',
          addedBy: t.added_by || '',
          createdAt: t.created_at,
        })),
      );
    }
    setLoading(false);
  }, [db, petDbId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Fetch vets list
  useEffect(() => {
    (async () => {
      const { data } = await db
        .from('staff')
        .select('id, first_name, last_name, role')
        .in('role', ['veterinarian', 'senior_veterinarian', 'specialist'])
        .eq('status', 'Active')
        .order('first_name');
      if (data) setVets(data.map((s: any) => ({ id: s.id, name: `Dr. ${s.first_name} ${s.last_name}` })));
    })();
  }, [db]);

  // ── Allergy handlers ──────────────────────────────────────────
  const handleAddAllergy = async () => {
    const trimmed = allergyInput.trim();
    if (!trimmed || !petDbId) return;
    await db.from('pet_allergies').insert({ pet_id: petDbId, name: trimmed });
    setAllergies((prev) => [...prev, trimmed]);
    setAllergyInput('');
    setShowAllergyInput(false);
  };

  const handleRemoveAllergy = async (allergyName: string) => {
    if (!petDbId) return;
    await db.from('pet_allergies').delete().eq('pet_id', petDbId).eq('name', allergyName);
    setAllergies((prev) => prev.filter((a) => a !== allergyName));
  };

  // ── Treatment handlers ────────────────────────────────────────
  const handleAddTreatment = async () => {
    if (!newTreatmentName.trim() || !petDbId) return;
    let addedByName = 'Unknown';
    if (user) {
      const { data: prof } = await db.from('profiles').select('first_name, last_name').eq('id', user.id).single();
      if (prof) addedByName = `${prof.first_name || ''} ${prof.last_name || ''}`.trim() || user.email || 'Unknown';
    }
    const { data } = await db.from('pet_treatments').insert({
      pet_id: petDbId,
      name: newTreatmentName.trim(),
      date: newTreatmentDate,
      vet: newTreatmentVet,
      notes: newTreatmentNotes,
      added_by: addedByName,
    }).select().single();
    const createdAt = data?.created_at || new Date().toISOString();
    setTreatments((prev) => [{
      id: data?.id || Date.now(),
      name: newTreatmentName.trim(),
      date: newTreatmentDate,
      vet: newTreatmentVet,
      notes: newTreatmentNotes,
      addedBy: addedByName,
      createdAt,
    }, ...prev]);
    setNewTreatmentName('');
    setNewTreatmentDate(new Date().toISOString().split('T')[0]);
    setNewTreatmentVet('');
    setNewTreatmentNotes('');
    setTreatmentDialogOpen(false);
  };

  const handleRemoveTreatment = async (treatmentId: any) => {
    await db.from('pet_treatments').delete().eq('id', treatmentId);
    setTreatments((prev) => prev.filter((t) => t.id !== treatmentId));
  };

  // ── Loading state ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-green-text)]" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Problems / Conditions ── */}
      <ProblemsSection
        petName={petName}
        petDbId={petDbId}
      />

      {/* ── Allergies ── */}
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6" style={{ borderRadius: '12px' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-[#d4183d]" />
            <h3 className="text-[var(--text-primary)]">Allergies</h3>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowAllergyInput(!showAllergyInput)}>
            <Plus className="w-4 h-4" /> Add Allergy
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {allergies.length === 0 && !showAllergyInput && (
            <p className="text-[var(--text-secondary)] py-2" style={{ fontSize: '14px' }}>No allergies on file.</p>
          )}
          {allergies.map((a) => (
            <span
              key={a}
              className="inline-flex items-center gap-1.5 px-3 py-1"
              style={{ backgroundColor: '#d4183d15', color: '#d4183d', borderRadius: '9999px', fontSize: '14px', fontWeight: 600 }}
            >
              <AlertCircle className="w-3 h-3" /> {a}
              <button
                onClick={() => handleRemoveAllergy(a)}
                className="ml-1 hover:opacity-70"
                style={{ fontSize: '16px', lineHeight: 1, fontWeight: 700 }}
              >
                ×
              </button>
            </span>
          ))}
          {showAllergyInput && (
            <div className="flex items-center gap-2">
              <Input
                value={allergyInput}
                onChange={(e) => setAllergyInput(e.target.value)}
                placeholder="Allergy name..."
                className="h-8 w-40"
                onKeyDown={(e) => e.key === 'Enter' && handleAddAllergy()}
              />
              <Button size="sm" onClick={handleAddAllergy}><Check className="w-4 h-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowAllergyInput(false); setAllergyInput(''); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Treatments ── */}
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6" style={{ borderRadius: '12px' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[var(--text-primary)]">Treatments</h3>
          <Button variant="outline" size="sm" onClick={() => setTreatmentDialogOpen(true)}>
            <Plus className="w-4 h-4" /> Add Treatment
          </Button>
        </div>
        {treatments.length === 0 ? (
          <p className="text-[var(--text-secondary)] py-4" style={{ fontSize: '14px' }}>No treatments on file.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Treatment</TableHead>
                <TableHead className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Date & Time</TableHead>
                <TableHead className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Vet</TableHead>
                <TableHead className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Added By</TableHead>
                <TableHead className="py-3 px-4" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Notes</TableHead>
                <TableHead className="py-3 px-4 w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {treatments.map((t) => {
                const dateDisplay = t.createdAt
                  ? new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                  : t.date;
                return (
                  <TableRow key={t.id} className="hover:bg-[var(--surface-elevated)]">
                    <TableCell className="py-3 px-4">
                      <span className="text-[var(--text-primary)]" style={{ fontSize: '16px', fontWeight: 500 }}>{t.name}</span>
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{dateDisplay}</span>
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{t.vet}</span>
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{t.addedBy || '—'}</span>
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{t.notes}</span>
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <button
                        onClick={() => handleRemoveTreatment(t.id)}
                        className="text-[var(--text-secondary)] hover:text-[#d4183d] transition-colors"
                        style={{ fontSize: '16px', lineHeight: 1 }}
                      >
                        ×
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* ── Add Treatment Dialog ── */}
      <Dialog open={treatmentDialogOpen} onOpenChange={(open) => {
        setTreatmentDialogOpen(open);
        if (!open) {
          setNewTreatmentName('');
          setNewTreatmentDate(new Date().toISOString().split('T')[0]);
          setNewTreatmentVet('');
          setNewTreatmentNotes('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Treatment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Treatment Name</label>
              <Popover open={treatmentPopoverOpen} onOpenChange={setTreatmentPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal" style={{ height: '36px' }}>
                    {newTreatmentName || <span className="text-muted-foreground">Select or type a treatment...</span>}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search treatments..." value={newTreatmentName} onValueChange={setNewTreatmentName} />
                    <CommandList>
                      <CommandEmpty>No matching treatment</CommandEmpty>
                      <CommandGroup>
                        {TREATMENT_PRESETS
                          .filter((s) => !treatments.some((t) => t.name === s))
                          .map((s) => (
                            <CommandItem key={s} value={s} onSelect={(val) => { setNewTreatmentName(val); setTreatmentPopoverOpen(false); }}>
                              {s}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                      {newTreatmentName.trim() && !TREATMENT_PRESETS.some((s) => s.toLowerCase() === newTreatmentName.trim().toLowerCase()) && (
                        <div className="p-1 border-t">
                          <button
                            className="w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent flex items-center gap-2"
                            onClick={() => { setTreatmentPopoverOpen(false); }}
                          >
                            <PlusCircle className="w-4 h-4" /> Add &quot;{newTreatmentName.trim()}&quot;
                          </button>
                        </div>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Date</label>
              <Input type="date" value={newTreatmentDate} onChange={(e) => setNewTreatmentDate(e.target.value)} />
            </div>
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Administering Vet</label>
              <Select value={newTreatmentVet} onValueChange={setNewTreatmentVet}>
                <SelectTrigger><SelectValue placeholder="Select vet..." /></SelectTrigger>
                <SelectContent>
                  {vets.map((v) => (
                    <SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[var(--text-primary)] mb-1.5 block" style={{ fontSize: '14px', fontWeight: 600 }}>Notes</label>
              <Textarea placeholder="Treatment notes..." value={newTreatmentNotes} onChange={(e) => setNewTreatmentNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTreatmentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddTreatment} disabled={!newTreatmentName.trim()}>Save Treatment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
