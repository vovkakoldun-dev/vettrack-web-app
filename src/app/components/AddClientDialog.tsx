import { useState } from 'react';
import { Users, Loader2 } from 'lucide-react';
import type { AddClientValues } from '../hooks/useClients';
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
  onSave?: (values: AddClientValues) => Promise<void>;
}

const EMPTY = {
  petName: '', species: '', breed: '', sex: '', dob: '', weight: '',
  ownerName: '', email: '', phone: '', address: '',
};

export function AddClientDialog({ open, onOpenChange, onSave }: AddClientDialogProps) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof typeof EMPTY) => (val: string) =>
    setForm(prev => ({ ...prev, [field]: val }));

  const handleClose = () => { setForm(EMPTY); setError(null); onOpenChange(false); };

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
      notes: form.petName ? `Pet: ${form.petName}${form.species ? ` (${form.species}${form.breed ? ', ' + form.breed : ''})` : ''}` : undefined,
    };
    try {
      if (onSave) await onSave(values);
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
                    <SelectItem value="Male (neutered)">Male (neutered)</SelectItem>
                    <SelectItem value="Female (spayed)">Female (spayed)</SelectItem>
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
