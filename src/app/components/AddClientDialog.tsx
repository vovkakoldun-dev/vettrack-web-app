import { useState, useRef, useEffect, useMemo } from 'react';
import { Users, Loader2, Camera } from 'lucide-react';
import type { AddClientValues } from '../hooks/useClients';
import { supabase } from '../../lib/supabase';
import { getOrgContext } from '../hooks/useOrgContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from './ui/select';

interface AddClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (values: AddClientValues) => Promise<string | void>;
}

// Generate weight options: 0.5, 1.0, 1.5, ... up to 100 kg
const WEIGHT_OPTIONS = Array.from({ length: 200 }, (_, i) => {
  const val = (i + 1) * 0.5;
  return { value: val.toString(), label: `${val} kg` };
});

function WeightPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search) return WEIGHT_OPTIONS;
    return WEIGHT_OPTIONS.filter(w => w.value.startsWith(search) || w.label.includes(search));
  }, [search]);

  // Scroll to selected value when opening
  useEffect(() => {
    if (open && value && listRef.current) {
      const timer = setTimeout(() => {
        const idx = WEIGHT_OPTIONS.findIndex(w => w.value === value);
        if (idx >= 0 && listRef.current) {
          listRef.current.scrollTop = Math.max(0, idx * 36 - 72);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open, value]);

  // Focus search input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  return (
    <div style={{ position: 'relative' }}>
      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Weight</p>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="border-input flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base bg-input-background md:text-sm dark:bg-input/30"
        style={{ textAlign: 'left', cursor: 'pointer', color: value ? 'var(--text-primary)' : 'var(--text-secondary)' }}
      >
        {value ? `${value} kg` : 'Select weight…'}
        <svg className="ml-auto" style={{ width: '14px', height: '14px', opacity: 0.5, alignSelf: 'center' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            marginTop: '4px', borderRadius: '8px', overflow: 'hidden',
            border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-white)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          }}
        >
          <div style={{ padding: '6px', borderBottom: '1px solid var(--border-color)' }}>
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              placeholder="Search weight…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="border-input flex h-8 w-full min-w-0 rounded-md border px-3 py-1 text-sm bg-input-background dark:bg-input/30"
              style={{ outline: 'none' }}
            />
          </div>
          <div ref={listRef} style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                No match — type a custom value
              </div>
            ) : (
              filtered.map(w => (
                <button
                  key={w.value}
                  type="button"
                  onClick={() => { onChange(w.value); setOpen(false); setSearch(''); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
                    fontSize: '13px', fontWeight: w.value === value ? 600 : 400, cursor: 'pointer',
                    backgroundColor: w.value === value ? '#2D6A4F15' : 'transparent',
                    color: w.value === value ? 'var(--brand-green-text)' : 'var(--text-primary)',
                    border: 'none', outline: 'none',
                  }}
                  className="hover:bg-[var(--surface-elevated)] transition-colors"
                >
                  {w.label}
                </button>
              ))
            )}
          </div>
          {search && !WEIGHT_OPTIONS.find(w => w.value === search) && (
            <div style={{ padding: '6px', borderTop: '1px solid var(--border-color)' }}>
              <button
                type="button"
                onClick={() => { onChange(search); setOpen(false); setSearch(''); }}
                className="hover:bg-[var(--surface-elevated)] transition-colors"
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
                  fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                  color: 'var(--brand-green-text)', border: 'none', borderRadius: '6px',
                  backgroundColor: 'transparent',
                }}
              >
                Use "{search} kg"
              </button>
            </div>
          )}
        </div>
      )}
      {open && <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => { setOpen(false); setSearch(''); }} />}
    </div>
  );
}

const EMPTY = {
  petName: '', species: '', breed: '', sex: '', dob: '', weight: '',
  ownerName: '', email: '', phone: '', address: '', assignedVetId: '',
};

export function AddClientDialog({ open, onOpenChange, onSave }: AddClientDialogProps) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Fetch vets for doctor assignment
  const [vets, setVets] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const { organizationId } = await getOrgContext();
        const { data } = await supabase
          .from('staff')
          .select('id, first_name, last_name, role')
          .eq('organization_id', organizationId)
          .in('role', ['veterinarian', 'senior_veterinarian', 'specialist'])
          .eq('status', 'Active')
          .order('first_name');
        if (data) setVets(data.map((s: any) => ({ id: s.id, name: `Dr. ${s.first_name} ${s.last_name}` })));
      } catch {}
    })();
  }, []);

  const set = (field: keyof typeof EMPTY) => (val: string) =>
    setForm(prev => ({ ...prev, [field]: val }));

  const handleClose = () => { setForm(EMPTY); setError(null); setPhotoFile(null); setPhotoPreview(null); onOpenChange(false); };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!form.ownerName.trim()) { setError('Owner name is required'); return; }
    setSaving(true);
    setError(null);
    // Split ownerName into first + last
    const parts = form.ownerName.trim().split(' ');
    const first_name = parts[0] ?? '';
    const last_name = parts.slice(1).join(' ') || '';
    const values: AddClientValues = {
      first_name,
      last_name,
      email: form.email || undefined,
      phone: form.phone || undefined,
      address: form.address || undefined,
    };
    try {
      let clientId: string | undefined;
      if (onSave) {
        const result = await onSave(values);
        if (typeof result === 'string') clientId = result;
      }

      // If pet info was filled, create the pet linked to the new client
      if (form.petName.trim() && form.species && clientId) {
        const weightNum = form.weight ? parseFloat(form.weight) : undefined;
        const { organizationId } = await getOrgContext();
          // Upload photo if selected
          let photoUrl: string | null = null;
          if (photoFile) {
            const ext = photoFile.name.split('.').pop() || 'jpg';
            const path = `${clientId}/${Date.now()}.${ext}`;
            const { error: uploadErr } = await supabase.storage.from('pet-images').upload(path, photoFile, { upsert: true, contentType: photoFile.type });
            if (!uploadErr) {
              const { data: urlData } = supabase.storage.from('pet-images').getPublicUrl(path);
              photoUrl = urlData.publicUrl + '?t=' + Date.now();
            }
          }
          const { error: petErr } = await supabase.from('pets').insert([{
            client_id: clientId,
            name: form.petName.trim(),
            species: form.species,
            breed: form.breed || null,
            sex: form.sex || 'Unknown',
            date_of_birth: form.dob || null,
            weight_kg: (weightNum && !isNaN(weightNum)) ? weightNum : null,
            photo_url: photoUrl,
            is_active: true,
            assigned_vet_id: form.assignedVetId || null,
            organization_id: organizationId,
          }]);
          if (petErr) {
            console.error('[AddClientDialog] pet insert error:', petErr);
          } else if (form.assignedVetId) {
            // Store assignment event for doctor notification
            try {
              const { organizationId: notifOrgId } = await getOrgContext();
              const vet = vets.find(v => v.id === form.assignedVetId);
              const petRes = await supabase.from('pets').select('id').eq('client_id', clientId).eq('name', form.petName.trim()).eq('organization_id', organizationId).limit(1).single();
              const petId = petRes.data?.id || `new-${Date.now()}`;
              await supabase.from('notification_events').upsert({
                id: `assign-${petId}-${Date.now()}`,
                type: 'vet_assign',
                timestamp: new Date().toISOString(),
                data: {
                  petId,
                  petName: form.petName.trim(),
                  species: form.species,
                  breed: form.breed || '',
                  ownerName: form.ownerName.trim(),
                  clientId,
                  vetId: form.assignedVetId,
                  vetName: vet?.name || '',
                },
                organization_id: notifOrgId,
              });
            } catch {}
          }
      }

      handleClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden [&>button]:top-[14px] [&>button]:right-[14px] [&>button]:w-8 [&>button]:h-8 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:rounded-[8px] [&>button]:!bg-white/15 [&>button]:!text-white [&>button]:!opacity-100 [&>button]:hover:!bg-white/25 [&>button]:transition-colors [&>button>svg]:w-4 [&>button>svg]:h-4"
        style={{ maxWidth: '560px', width: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div style={{ background: '#2D6A4F', padding: '18px 24px', flexShrink: 0 }}>
          <div className="flex items-center gap-3">
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Users style={{ width: '18px', height: '18px', color: '#fff' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>Add New Client</h2>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '1px' }}>Register a new patient and owner</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Pet Information */}
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>Pet Information</p>
            {/* Pet Photo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div
                className="relative group cursor-pointer"
                onClick={() => photoInputRef.current?.click()}
                style={{ width: '56px', height: '56px', borderRadius: '9999px', overflow: 'hidden', flexShrink: 0, backgroundColor: 'var(--surface-elevated)', border: '2px dashed var(--border-color)' }}
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Pet" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Camera style={{ width: '20px', height: '20px', color: 'var(--text-secondary)' }} />
                  </div>
                )}
                {photoPreview && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: '9999px' }}>
                    <Camera style={{ width: '18px', height: '18px', color: '#fff' }} />
                  </div>
                )}
              </div>
              <div>
                <button type="button" onClick={() => photoInputRef.current?.click()} style={{ fontSize: '13px', fontWeight: 600, color: 'var(--brand-green-text)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  {photoPreview ? 'Change photo' : 'Add pet photo'}
                </button>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>JPG, PNG up to 5MB</p>
              </div>
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Pet Name *</p>
                <Input placeholder="e.g. Max" value={form.petName} onChange={e => set('petName')(e.target.value)} />
              </div>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Species *</p>
                <Select value={form.species} onValueChange={set('species')}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dog">🐶 Dog</SelectItem>
                    <SelectItem value="Cat">🐱 Cat</SelectItem>
                    <SelectItem value="Rabbit">🐰 Rabbit</SelectItem>
                    <SelectItem value="Bird">🐦 Bird</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Breed</p>
                <Input placeholder="e.g. Golden Retriever" value={form.breed} onChange={e => set('breed')(e.target.value)} />
              </div>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Sex</p>
                <Select value={form.sex} onValueChange={set('sex')}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Male (Neutered)">Male (Neutered)</SelectItem>
                    <SelectItem value="Female (Spayed)">Female (Spayed)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Date of Birth</p>
                <Input type="date" value={form.dob} onChange={e => set('dob')(e.target.value)} />
              </div>
              <WeightPicker value={form.weight} onChange={set('weight')} />
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Assigned Doctor</p>
                <Select value={form.assignedVetId} onValueChange={set('assignedVetId')}>
                  <SelectTrigger><SelectValue placeholder="Select doctor..." /></SelectTrigger>
                  <SelectContent>
                    {vets.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Owner Information */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>Owner Information</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Full Name *</p>
                <Input placeholder="e.g. John Smith" value={form.ownerName} onChange={e => set('ownerName')(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Email *</p>
                  <Input type="email" placeholder="owner@email.com" value={form.email} onChange={e => set('email')(e.target.value)} />
                </div>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Phone</p>
                  <Input type="tel" placeholder="(555) 000-0000" value={form.phone} onChange={e => set('phone')(e.target.value)} />
                </div>
              </div>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Address</p>
                <Input placeholder="123 Main St, City, State" value={form.address} onChange={e => set('address')(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--border-color)]" style={{ padding: '14px 24px', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
          {error && <p style={{ fontSize: '13px', color: '#d4183d', marginBottom: '4px' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <Button variant="outline" onClick={handleClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} style={{ backgroundColor: '#2D6A4F', color: '#fff', minWidth: '110px' }}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</> : 'Add Client'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
