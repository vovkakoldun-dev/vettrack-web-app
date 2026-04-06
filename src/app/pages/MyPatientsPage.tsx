import { Link } from 'react-router';
import { Search, ChevronLeft, Filter } from 'lucide-react';
import { useState } from 'react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../components/ui/select';

// ─── Mock Data ───────────────────────────────────────────────

const MY_PATIENTS = [
  { id: 1, petImage: 'https://images.unsplash.com/photo-1734966213753-1b361564bab4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb2xkZW4lMjByZXRyaWV2ZXIlMjBkb2clMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzMyNDMxMzB8MA&ixlib=rb-4.1.0&q=80&w=400', petName: 'Max', ownerName: 'John Smith', species: 'Dog', breed: 'Golden Retriever', age: '5 yrs', lastVisit: 'Mar 11, 2026', nextVisit: 'Apr 8, 2026', status: 'Healthy' as const, notes: 'Routine annual exam — all clear' },
  { id: 3, petImage: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400', petName: 'Cooper', ownerName: 'Michael Brown', species: 'Dog', breed: 'Beagle', age: '3 yrs', lastVisit: 'Mar 11, 2026', nextVisit: 'Mar 25, 2026', status: 'Follow-up' as const, notes: 'Post-dental cleaning check' },
  { id: 4, petImage: 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?w=400', petName: 'Bella', ownerName: 'Sarah Williams', species: 'Cat', breed: 'Siamese', age: '2 yrs', lastVisit: 'Mar 11, 2026', nextVisit: 'Jun 11, 2026', status: 'Healthy' as const, notes: 'Surgery recovery complete' },
  { id: 7, petImage: 'https://images.unsplash.com/photo-1589883661923-6476cb0ae9f2?w=400', petName: 'Milo', ownerName: 'Jessica Taylor', species: 'Cat', breed: 'Maine Coon', age: '4 yrs', lastVisit: 'Mar 10, 2026', nextVisit: 'Sep 10, 2026', status: 'Healthy' as const, notes: 'FVRCP booster administered' },
  { id: 8, petImage: 'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=400', petName: 'Daisy', ownerName: 'Robert Anderson', species: 'Dog', breed: 'Labrador', age: '7 yrs', lastVisit: 'Mar 11, 2026', nextVisit: 'Mar 18, 2026', status: 'Critical' as const, notes: 'Post-surgery monitoring — check wound site' },
  { id: 11, petImage: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400', petName: 'Coco', ownerName: 'Amanda White', species: 'Dog', breed: 'Poodle', age: '1 yr', lastVisit: 'Mar 9, 2026', nextVisit: 'Apr 9, 2026', status: 'Healthy' as const, notes: 'Puppy vaccination series on track' },
  { id: 12, petImage: 'https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=400', petName: 'Oliver', ownerName: 'Lisa Martinez', species: 'Cat', breed: 'Tabby', age: '6 yrs', lastVisit: 'Mar 8, 2026', nextVisit: 'Mar 22, 2026', status: 'Follow-up' as const, notes: 'Dental cleaning needed' },
  { id: 13, petImage: 'https://images.unsplash.com/photo-1558788353-f76d92427f16?w=400', petName: 'Buddy', ownerName: 'Kevin Lee', species: 'Dog', breed: 'Corgi', age: '3 yrs', lastVisit: 'Mar 7, 2026', nextVisit: 'Jun 7, 2026', status: 'Healthy' as const, notes: 'Weight management plan — on track' },
  { id: 14, petImage: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400', petName: 'Luna', ownerName: 'Emily Davis', species: 'Cat', breed: 'Persian', age: '8 yrs', lastVisit: 'Mar 5, 2026', nextVisit: 'Mar 19, 2026', status: 'Follow-up' as const, notes: 'Kidney function follow-up' },
  { id: 15, petImage: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400', petName: 'Rocky', ownerName: 'David Johnson', species: 'Dog', breed: 'Boxer', age: '5 yrs', lastVisit: 'Mar 3, 2026', nextVisit: 'Sep 3, 2026', status: 'Healthy' as const, notes: 'Annual vaccinations complete' },
];

const statusStyles: Record<string, { bg: string; text: string }> = {
  Healthy: { bg: '#74C69D20', text: 'var(--brand-green-text)' },
  'Follow-up': { bg: '#F4A26120', text: '#F4A261' },
  Critical: { bg: '#d4183d20', text: '#d4183d' },
};

// ─── Component ───────────────────────────────────────────────

export default function MyPatientsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = MY_PATIENTS.filter((p) => {
    const matchSearch =
      p.petName.toLowerCase().includes(search.toLowerCase()) ||
      p.ownerName.toLowerCase().includes(search.toLowerCase()) ||
      p.breed.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const healthyCount = MY_PATIENTS.filter((p) => p.status === 'Healthy').length;
  const followUpCount = MY_PATIENTS.filter((p) => p.status === 'Follow-up').length;
  const criticalCount = MY_PATIENTS.filter((p) => p.status === 'Critical').length;

  return (
    <div className="max-w-[1440px] mx-auto p-8">
      {/* Breadcrumb + Header */}
      <div className="mb-6">
        <Link
          to="/my-portal"
          className="inline-flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--brand-green-text)] transition-colors mb-3"
          style={{ fontSize: '14px', fontWeight: 500 }}
        >
          <ChevronLeft className="w-4 h-4" /> Back to My Portal
        </Link>
        <h1 className="text-[var(--text-primary)]" style={{ fontSize: '32px', fontWeight: 700 }}>
          My Patients
        </h1>
        <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '16px' }}>
          {MY_PATIENTS.length} patients under Dr. Sarah Chen's care
        </p>
      </div>

      {/* Stat Chips */}
      <div className="flex items-center gap-3 mb-6">
        <div className="px-4 py-2 bg-[var(--surface-white)] border border-[var(--border-color)] flex items-center gap-2" style={{ borderRadius: '9999px' }}>
          <div className="w-2 h-2 rounded-full bg-[var(--brand-green-text)]" />
          <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>{healthyCount}</span>
          <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Healthy</span>
        </div>
        <div className="px-4 py-2 bg-[var(--surface-white)] border border-[var(--border-color)] flex items-center gap-2" style={{ borderRadius: '9999px' }}>
          <div className="w-2 h-2 rounded-full bg-[#F4A261]" />
          <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>{followUpCount}</span>
          <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Follow-up</span>
        </div>
        <div className="px-4 py-2 bg-[var(--surface-white)] border border-[var(--border-color)] flex items-center gap-2" style={{ borderRadius: '9999px' }}>
          <div className="w-2 h-2 rounded-full bg-[#d4183d]" />
          <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>{criticalCount}</span>
          <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Critical</span>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <Input
            placeholder="Search by pet name, owner, or breed..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--text-secondary)]" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Healthy">Healthy</SelectItem>
              <SelectItem value="Follow-up">Follow-up</SelectItem>
              <SelectItem value="Critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Patients Table */}
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)]" style={{ borderRadius: '12px' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                {['Pet', 'Owner', 'Species / Breed', 'Age', 'Last Visit', 'Next Visit', 'Status', 'Notes'].map((h) => (
                  <th key={h} className="py-3 px-4 text-left">
                    <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px', fontWeight: 600 }}>{h}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const s = statusStyles[p.status] || statusStyles.Healthy;
                return (
                  <tr
                    key={p.id}
                    className="border-b border-[var(--border-color)] last:border-0 hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <Link to={`/clients/${p.id}`} className="flex items-center gap-3">
                        <img
                          src={p.petImage}
                          alt={p.petName}
                          className="w-9 h-9 object-cover flex-shrink-0"
                          style={{ borderRadius: '9999px' }}
                        />
                        <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>
                          {p.petName}
                        </span>
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[var(--text-primary)]" style={{ fontSize: '14px' }}>{p.ownerName}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[var(--text-primary)]" style={{ fontSize: '14px' }}>{p.species}</span>
                      <p className="text-[var(--text-secondary)]" style={{ fontSize: '11px' }}>{p.breed}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{p.age}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{p.lastVisit}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 500 }}>{p.nextVisit}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className="inline-block px-2.5 py-1"
                        style={{
                          backgroundColor: s.bg,
                          color: s.text,
                          borderRadius: '9999px',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-[var(--text-secondary)] max-w-[200px] truncate" style={{ fontSize: '13px' }}>
                        {p.notes}
                      </p>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>No patients found matching your search.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
