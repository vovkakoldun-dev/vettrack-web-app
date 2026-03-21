import { useState, useRef, useEffect } from 'react';
import { Users, Loader2, Camera } from 'lucide-react';
import type { AddClientValues } from '../hooks/useClients';
import { supabase } from '../../lib/supabase';
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
      const { data } = await supabase
        .from('staff')
        .select('id, first_name, last_name, role')
        .in('role', ['veterinarian', 'senior_veterinarian', 'specialist'])
        .eq('status', 'Active')
        .order('first_name');
      if (data) setVets(data.map((s: any) => ({ id: s.id, name: `Dr. ${s.first_name} ${s.last_name}` })));
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
          // Upload photo if selected
          let photoUrl: string | null = null;
          if (photoFile) {
            const ext = photoFile.name.split('.').pop() || 'jpg';
            const path = `${clientId}/${Date.now()}.${ext}`;
            const { error: uploadErr } = await supabase.storage.from('pet-photos').upload(path, photoFile, { upsert: true });
            if (!uploadErr) {
              const { data: urlData } = supabase.storage.from('pet-photos').getPublicUrl(path);
              photoUrl = urlData.publicUrl;
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
          }]);
          if (petErr) console.error('[AddClientDialog] pet insert error:', petErr);
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
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Weight</p>
                <Input placeholder="e.g. 12.5 kg" value={form.weight} onChange={e => set('weight')(e.target.value)} />
              </div>
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
