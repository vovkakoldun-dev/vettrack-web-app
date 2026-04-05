import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import {
  Search, Upload, FlaskConical, FileText, Image as ImageIcon, File,
  Eye, CheckCircle2, Clock, ChevronRight, Download, X, Check, Loader2, Trash2, Send,
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../components/ui/select';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { getOrgContext } from '../hooks/useOrgContext';
import { useProfile } from '../hooks/useProfile';

// ─── Types ─────────────────────────────────────────────────────

type ReviewStatus = 'awaiting_review' | 'reviewed';

interface LabFile {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;        // MIME type
  petId: string;
  petName: string;
  petImage: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  testPanel: string;
  notes: string;
  uploadedAt: string;
  uploadedByName: string;
  reviewStatus: ReviewStatus;
  reviewedByName: string;
  reviewedAt: string;
}

// ─── Helpers ───────────────────────────────────────────────────

function formatDate(d: string) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(d: string) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function fileIcon(mime: string) {
  if (mime?.startsWith('image/')) return ImageIcon;
  if (mime === 'application/pdf') return FileText;
  return File;
}

function fileTypeLabel(mime: string) {
  if (mime?.startsWith('image/')) return 'Image';
  if (mime === 'application/pdf') return 'PDF';
  if (mime?.includes('word') || mime?.includes('document')) return 'Document';
  if (mime?.includes('spreadsheet') || mime?.includes('excel')) return 'Spreadsheet';
  return 'File';
}

const statusStyles = {
  awaiting_review: {
    bg: '#F59E0B15', text: '#D97706', border: '#F59E0B30',
    label: 'Awaiting Review', icon: Clock,
  },
  reviewed: {
    bg: '#22C55E15', text: '#16A34A', border: '#22C55E30',
    label: 'Reviewed', icon: CheckCircle2,
  },
};

// ─── Stat Card ────────────────────────────────────────────────

function StatCard({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  return (
    <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-5" style={{ borderRadius: '12px' }}>
      <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: '13px', fontWeight: 500 }}>{label}</p>
      <p style={{ fontSize: '32px', fontWeight: 700, color, lineHeight: 1.1 }}>{value}</p>
      {sub && <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '12px' }}>{sub}</p>}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────

export default function LabPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin');
  const { profile: currentProfile } = useProfile(isAdmin ? 'admin' : 'doctor');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPet, setFilterPet] = useState<string>('all');
  const [labFiles, setLabFiles] = useState<LabFile[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadPetId, setUploadPetId] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadPanel, setUploadPanel] = useState('General');
  const [uploadFile, setUploadFile] = useState<globalThis.File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [catDropdownOpen, setCatDropdownOpen] = useState(false);

  // Preview dialog
  const [previewFile, setPreviewFile] = useState<LabFile | null>(null);
  const [reviewing, setReviewing] = useState(false);

  // Pets list for upload
  const [pets, setPets] = useState<{ id: string; name: string; image: string; ownerName: string; species: string }[]>([]);
  const [petSearch, setPetSearch] = useState('');
  const [petDropdownOpen, setPetDropdownOpen] = useState(false);
  const petSearchRef = useRef<HTMLInputElement>(null);

  // ─── Fetch lab files ────────────────────────────────────────
  const fetchLabFiles = async () => {
    const { organizationId } = await getOrgContext();
    const { data } = await supabase
      .from('lab_results')
      .select(`
        id, file_name, file_url, file_type, test_panel, notes,
        review_status, reviewed_at, tested_at, created_at,
        pet_id,
        pets!left(id, name, photo_url, client_id, clients!left(id, first_name, last_name, email)),
        uploader:profiles!lab_results_uploaded_by_fkey(first_name, last_name),
        reviewer:profiles!lab_results_reviewed_by_fkey(first_name, last_name)
      `)
      .eq('organization_id', organizationId)
      .not('file_url', 'is', null)
      .order('created_at', { ascending: false });

    if (data) {
      const mapped: LabFile[] = data.map((r: any) => ({
        id: r.id,
        fileName: r.file_name || 'Unnamed file',
        fileUrl: r.file_url || '',
        fileType: r.file_type || '',
        petId: r.pet_id || '',
        petName: r.pets?.name ?? '—',
        petImage: r.pets?.photo_url || '',
        ownerId: r.pets?.clients?.id || r.pets?.client_id || '',
        ownerName: r.pets?.clients ? `${r.pets.clients.first_name} ${r.pets.clients.last_name}` : '—',
        ownerEmail: r.pets?.clients?.email || '',
        testPanel: r.test_panel || 'General',
        notes: r.notes || '',
        uploadedAt: r.created_at || '',
        uploadedByName: r.uploader ? `${r.uploader.first_name} ${r.uploader.last_name}`.trim() : '—',
        reviewStatus: r.review_status || 'awaiting_review',
        reviewedByName: r.reviewer ? `Dr. ${r.reviewer.first_name} ${r.reviewer.last_name}`.trim() : '',
        reviewedAt: r.reviewed_at || '',
      }));
      setLabFiles(mapped);
    }
    setLoading(false);
  };

  useEffect(() => { fetchLabFiles(); }, []);

  // ─── Fetch pets for upload ──────────────────────────────────
  useEffect(() => {
    (async () => {
      const { organizationId } = await getOrgContext();
      const { data } = await supabase
        .from('pets')
        .select('id, name, species, photo_url, clients!left(first_name, last_name)')
        .eq('organization_id', organizationId)
        .order('name');
      if (data) {
        setPets(data.map((p: any) => ({
          id: p.id,
          name: p.name,
          image: p.photo_url || '',
          species: p.species || '',
          ownerName: p.clients ? `${p.clients.first_name} ${p.clients.last_name}`.trim() : '—',
        })));
      }
    })();
  }, []);

  // ─── Upload handler ─────────────────────────────────────────
  const handleUpload = async () => {
    if (!uploadFile || !uploadPetId || !user) return;
    setUploading(true);

    const ext = uploadFile.name.split('.').pop() || '';
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('lab-files')
      .upload(path, uploadFile, { contentType: uploadFile.type });

    if (uploadErr) {
      alert('Upload failed: ' + uploadErr.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('lab-files').getPublicUrl(path);
    const fileUrl = urlData.publicUrl;

    const { organizationId } = await getOrgContext();
    const { error: insertErr } = await supabase.from('lab_results').insert({
      pet_id: uploadPetId,
      file_url: fileUrl,
      file_name: uploadFile.name,
      file_type: uploadFile.type,
      test_panel: uploadPanel,
      notes: uploadNotes || null,
      review_status: 'awaiting_review',
      uploaded_by: user.id,
      organization_id: organizationId,
      test_name: uploadFile.name,
      flag: 'normal',
    });

    if (insertErr) {
      alert('Failed to save record: ' + insertErr.message);
      setUploading(false);
      return;
    }

    // ── Notify the pet's assigned vet that a lab result is ready ──
    try {
      const selectedPet = pets.find(p => p.id === uploadPetId);
      const { data: petRow } = await supabase
        .from('pets')
        .select('assigned_vet_id, staff!pets_assigned_vet_id_fkey(id, profiles:profiles!staff_profile_id_fkey(first_name, last_name))')
        .eq('id', uploadPetId)
        .single();

      if (petRow?.assigned_vet_id) {
        const vet = petRow.staff as any;
        const vetName = vet?.profiles ? `${vet.profiles.first_name} ${vet.profiles.last_name}`.trim() : '';
        await supabase.from('notification_events').upsert({
          id: `lab-ready-${uploadPetId}-${Date.now()}`,
          type: 'lab_ready',
          timestamp: new Date().toISOString(),
          data: {
            petId: uploadPetId,
            petName: selectedPet?.name || '',
            ownerName: selectedPet?.ownerName || '',
            fileName: uploadFile.name,
            testPanel: uploadPanel,
            vetId: petRow.assigned_vet_id,
            vetName,
          },
          organization_id: organizationId,
        });
      }
    } catch (_) {
      // Non-critical — don't block upload success
    }

    setUploadOpen(false);
    setUploadFile(null);
    setUploadPetId('');
    setUploadNotes('');
    setUploadPanel('General');
    setUploading(false);
    fetchLabFiles();
  };

  // ─── Review handler ─────────────────────────────────────────
  const handleReview = async () => {
    if (!previewFile || !user) return;
    setReviewing(true);

    const reviewedAt = new Date().toISOString();

    await supabase
      .from('lab_results')
      .update({
        review_status: 'reviewed',
        reviewed_by: user.id,
        reviewed_at: reviewedAt,
      })
      .eq('id', previewFile.id);

    // Fetch reviewer name from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single();

    const reviewerName = profile
      ? `Dr. ${profile.first_name} ${profile.last_name}`.trim()
      : 'You';

    // Update preview in-place so the user sees the status change
    setPreviewFile({
      ...previewFile,
      reviewStatus: 'reviewed',
      reviewedByName: reviewerName,
      reviewedAt,
    });

    setReviewing(false);
    fetchLabFiles();
  };

  // ─── Delete handler ────────────────────────────────────────
  const handleDelete = async (file: LabFile) => {
    if (!confirm(`Delete "${file.fileName}"? This cannot be undone.`)) return;

    // Delete storage file
    const storagePath = file.fileUrl.split('/lab-files/')[1];
    if (storagePath) {
      await supabase.storage.from('lab-files').remove([storagePath]);
    }

    // Delete database row
    await supabase.from('lab_results').delete().eq('id', file.id);

    if (previewFile?.id === file.id) setPreviewFile(null);
    fetchLabFiles();
  };

  // ─── Derived stats ─────────────────────────────────────────
  const total = labFiles.length;
  const awaiting = labFiles.filter(f => f.reviewStatus === 'awaiting_review').length;
  const reviewed = labFiles.filter(f => f.reviewStatus === 'reviewed').length;
  const thisWeek = labFiles.filter(f => {
    const d = new Date(f.uploadedAt);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  }).length;

  // ─── Unique pets for filter ─────────────────────────────────
  const uniquePets = Array.from(new Set(labFiles.map(f => f.petName))).filter(n => n !== '—').sort();

  // ─── Filtered results ──────────────────────────────────────
  const filtered = labFiles.filter(f => {
    const q = search.toLowerCase();
    if (q && !(
      f.fileName.toLowerCase().includes(q) ||
      f.petName.toLowerCase().includes(q) ||
      f.ownerName.toLowerCase().includes(q) ||
      f.testPanel.toLowerCase().includes(q) ||
      f.uploadedByName.toLowerCase().includes(q)
    )) return false;
    if (filterStatus !== 'all' && f.reviewStatus !== filterStatus) return false;
    if (filterPet !== 'all' && f.petName !== filterPet) return false;
    return true;
  });

  // Sort: awaiting review first, then newest
  const sorted = [...filtered].sort((a, b) => {
    if (a.reviewStatus !== b.reviewStatus) {
      return a.reviewStatus === 'awaiting_review' ? -1 : 1;
    }
    return b.uploadedAt.localeCompare(a.uploadedAt);
  });

  return (
    <div className="max-w-[1440px] mx-auto p-8">
      {/* ─── Page Header ─── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[var(--text-primary)]" style={{ fontSize: '32px', fontWeight: 700 }}>Lab Results</h1>
          <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '16px' }}>
            Upload and review diagnostic lab result files for patients.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setUploadOpen(true)}>
            <Upload className="w-4 h-4" /> Upload Result
          </Button>
          <Button>
            <FlaskConical className="w-4 h-4" /> Order New Test
          </Button>
        </div>
      </div>

      {/* ─── Stat Cards ─── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Files" value={total} color="var(--text-primary)" sub="All time" />
        <StatCard label="Awaiting Review" value={awaiting} color="#D97706" sub="Need vet attention" />
        <StatCard label="Reviewed" value={reviewed} color="var(--brand-green-text)" sub={total > 0 ? `${Math.round((reviewed / total) * 100)}% complete` : '0%'} />
        <StatCard label="This Week" value={thisWeek} color="#3B82F6" sub="Last 7 days" />
      </div>

      {/* ─── Filter Bar ─── */}
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-4 mb-4 flex items-center gap-3 flex-wrap" style={{ borderRadius: '12px' }}>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <Input
            placeholder="Search file, pet, owner…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="awaiting_review">Awaiting Review</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterPet} onValueChange={setFilterPet}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="Patient" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Patients</SelectItem>
            {uniquePets.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ─── Results Table ─── */}
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] overflow-hidden" style={{ borderRadius: '12px' }}>
        {/* Table header */}
        <div
          className="grid border-b border-[var(--border-color)] px-5 py-3"
          style={{
            gridTemplateColumns: '2.5fr 1.5fr 130px 140px 150px 32px',
            fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)',
            letterSpacing: '0.05em', textTransform: 'uppercase',
          }}
        >
          <div>File</div>
          <div>Patient</div>
          <div>Uploaded</div>
          <div>Uploaded By</div>
          <div>Status</div>
          <div />
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 text-[var(--border-color)] mx-auto mb-3 animate-spin" />
            <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Loading lab results…</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-[var(--border-color)] mx-auto mb-3" />
            <p className="text-[var(--text-primary)] mb-1" style={{ fontSize: '16px', fontWeight: 600 }}>No lab results found</p>
            <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>
              {labFiles.length === 0
                ? 'Upload your first lab result file to get started.'
                : 'Try adjusting your filters or search.'}
            </p>
          </div>
        ) : (
          sorted.map((f, i) => {
            const ss = statusStyles[f.reviewStatus];
            const StatusIcon = ss.icon;
            const FIcon = fileIcon(f.fileType);
            const isLast = i === sorted.length - 1;

            return (
              <div
                key={f.id}
                className={`grid items-center px-5 py-3.5 cursor-pointer hover:bg-[var(--surface-elevated)] transition-colors ${!isLast ? 'border-b border-[var(--border-color)]' : ''}`}
                style={{ gridTemplateColumns: '2.5fr 1.5fr 130px 140px 150px 32px' }}
                onClick={() => setPreviewFile(f)}
              >
                {/* File name + type */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: f.fileType?.startsWith('image/') ? '#3B82F615' : f.fileType === 'application/pdf' ? '#EF444415' : '#6B728015' }}
                  >
                    <FIcon
                      className="w-4 h-4"
                      style={{ color: f.fileType?.startsWith('image/') ? '#3B82F6' : f.fileType === 'application/pdf' ? '#EF4444' : '#6B7280' }}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[var(--text-primary)] truncate" style={{ fontSize: '14px', fontWeight: 600 }}>{f.fileName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[var(--text-secondary)]" style={{ fontSize: '11px' }}>{fileTypeLabel(f.fileType)}</span>
                      {f.testPanel && f.testPanel !== 'General' && (
                        <>
                          <span className="text-[var(--text-secondary)]" style={{ fontSize: '11px' }}>·</span>
                          <span className="text-[var(--text-secondary)]" style={{ fontSize: '11px' }}>{f.testPanel}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Patient */}
                <div
                  className="flex items-center gap-2.5 hover:underline"
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (f.ownerId) navigate(`${isAdmin ? '/admin' : ''}/clients/${f.ownerId}?petId=${f.petId}`);
                  }}
                >
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={f.petImage} alt={f.petName} className="object-cover" />
                    <AvatarFallback>{f.petName.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-[var(--text-primary)] truncate" style={{ fontSize: '14px', fontWeight: 600 }}>{f.petName}</p>
                    <p className="text-[var(--text-secondary)] truncate" style={{ fontSize: '12px' }}>{f.ownerName}</p>
                  </div>
                </div>

                {/* Uploaded date */}
                <div className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{formatDate(f.uploadedAt)}</div>

                {/* Uploaded by */}
                <div className="text-[var(--text-secondary)] truncate" style={{ fontSize: '13px' }}>{f.uploadedByName}</div>

                {/* Status badge */}
                <div>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5"
                    style={{
                      backgroundColor: ss.bg, color: ss.text,
                      borderRadius: '9999px', fontSize: '11px', fontWeight: 700,
                      border: `1px solid ${ss.border}`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <StatusIcon className="w-3 h-3" />
                    {ss.label}
                  </span>
                </div>

                {/* Arrow */}
                <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
              </div>
            );
          })
        )}
      </div>

      {/* ─── Footer ─── */}
      {sorted.length > 0 && (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>
            Showing <span className="font-semibold text-[var(--text-primary)]">{sorted.length}</span> of{' '}
            <span className="font-semibold text-[var(--text-primary)]">{total}</span> files
          </p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1" style={{ fontSize: '12px', color: '#D97706' }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#D97706' }} />
              Awaiting: {awaiting}
            </span>
            <span className="flex items-center gap-1" style={{ fontSize: '12px', color: '#16A34A' }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#16A34A' }} />
              Reviewed: {reviewed}
            </span>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
           Upload Dialog
         ═══════════════════════════════════════════════════════════ */}
      {uploadOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => !uploading && setUploadOpen(false)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 51, width: 480, backgroundColor: 'var(--surface-white)',
            borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Upload Lab Result</h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>Select a patient and upload the result file</p>
              </div>
              <button onClick={() => !uploading && setUploadOpen(false)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-color)', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {/* Body */}
            <div className="upload-dialog-body" style={{ padding: 24, backgroundColor: 'var(--surface-elevated)' }}>
              {/* Patient search */}
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 6px' }}>Patient <span style={{ color: '#EF4444' }}>*</span></p>
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    border: '1px solid var(--border-color, #E5E7EB)',
                    borderRadius: 8, padding: '0 12px', height: 36,
                    backgroundColor: 'var(--surface-white)',
                    cursor: 'text',
                  }}
                  onClick={() => { setPetDropdownOpen(true); petSearchRef.current?.focus(); }}
                >
                  {uploadPetId && !petDropdownOpen ? (() => {
                    const sel = pets.find(p => p.id === uploadPetId);
                    return sel ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                        <Avatar className="w-5 h-5 flex-shrink-0">
                          <AvatarImage src={sel.image} alt={sel.name} className="object-cover" />
                          <AvatarFallback style={{ fontSize: 8 }}>{sel.name.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{sel.name}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>· {sel.ownerName}</span>
                      </div>
                    ) : null;
                  })() : (
                    <>
                      <Search style={{ width: 14, height: 14, color: 'var(--text-secondary)', flexShrink: 0 }} />
                      <input
                        ref={petSearchRef}
                        value={petSearch}
                        onChange={e => { setPetSearch(e.target.value); setPetDropdownOpen(true); }}
                        onFocus={() => setPetDropdownOpen(true)}
                        placeholder="Search by pet name or owner…"
                        style={{
                          border: 'none', outline: 'none', background: 'transparent',
                          fontSize: 13, color: 'var(--text-primary)', flex: 1, height: '100%',
                        }}
                      />
                    </>
                  )}
                  {uploadPetId && !petDropdownOpen && (
                    <button
                      onClick={e => { e.stopPropagation(); setUploadPetId(''); setPetSearch(''); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: 'var(--text-secondary)' }}
                    >
                      <X style={{ width: 14, height: 14 }} />
                    </button>
                  )}
                </div>
                {petDropdownOpen && (() => {
                  const q = petSearch.toLowerCase();
                  const matches = pets.filter(p =>
                    p.name.toLowerCase().includes(q) || p.ownerName.toLowerCase().includes(q)
                  );
                  return (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 1 }} onClick={() => setPetDropdownOpen(false)} />
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 2,
                        marginTop: 4, backgroundColor: 'var(--surface-white)',
                        border: '1px solid var(--border-color, #E5E7EB)',
                        borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                        maxHeight: 220, overflowY: 'auto',
                      }}>
                        {matches.length === 0 ? (
                          <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
                            No patients found
                          </div>
                        ) : matches.map(p => (
                          <div
                            key={p.id}
                            onClick={() => { setUploadPetId(p.id); setPetSearch(''); setPetDropdownOpen(false); }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '8px 14px', cursor: 'pointer',
                              backgroundColor: uploadPetId === p.id ? 'var(--surface-elevated)' : 'transparent',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = uploadPetId === p.id ? 'var(--surface-elevated)' : 'transparent')}
                          >
                            <Avatar className="w-7 h-7 flex-shrink-0">
                              <AvatarImage src={p.image} alt={p.name} className="object-cover" />
                              <AvatarFallback style={{ fontSize: 10 }}>{p.name.slice(0, 2)}</AvatarFallback>
                            </Avatar>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{p.name}</p>
                              <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
                                {p.species}{p.species && ' · '}{p.ownerName}
                              </p>
                            </div>
                            {uploadPetId === p.id && <CheckCircle2 style={{ width: 14, height: 14, color: 'var(--brand-green-text)', flexShrink: 0 }} />}
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Category — editable combobox */}
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 6px' }}>Category</p>
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <input
                  type="text"
                  value={uploadPanel}
                  onChange={e => { setUploadPanel(e.target.value); setCatDropdownOpen(true); }}
                  onFocus={() => setCatDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setCatDropdownOpen(false), 150)}
                  placeholder="Select or type a category…"
                  style={{
                    width: '100%', height: 36, padding: '0 12px',
                    fontSize: 14, borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--surface-elevated)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
                {catDropdownOpen && (() => {
                  const CATEGORIES = ['General', 'Hematology', 'Chemistry', 'Urinalysis', 'Cardiac', 'Thyroid', 'Microbiology', 'Parasitology'];
                  const filtered = CATEGORIES.filter(c =>
                    c.toLowerCase().includes(uploadPanel.toLowerCase())
                  );
                  if (filtered.length === 0) return null;
                  return (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                      backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-color)',
                      borderRadius: 8, marginTop: 4, maxHeight: 200, overflowY: 'auto',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    }}>
                      {filtered.map(c => (
                        <div
                          key={c}
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => { setUploadPanel(c); setCatDropdownOpen(false); }}
                          style={{
                            padding: '8px 14px', cursor: 'pointer', fontSize: 13,
                            color: 'var(--text-primary)',
                            backgroundColor: uploadPanel === c ? 'var(--surface-elevated)' : 'transparent',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          {c}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* File drop zone */}
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 6px' }}>File <span style={{ color: '#EF4444' }}>*</span></p>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: 12, padding: '24px 16px',
                  textAlign: 'center', cursor: 'pointer',
                  backgroundColor: uploadFile ? '#22C55E08' : 'transparent',
                  marginBottom: 16, transition: 'background-color 0.15s',
                }}
              >
                {uploadFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5" style={{ color: '#16A34A' }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{uploadFile.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      ({(uploadFile.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-[var(--text-secondary)] mx-auto mb-2" />
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                      Click to select a file
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                      PDF, images, or documents up to 10MB
                    </p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx"
                style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.[0]) setUploadFile(e.target.files[0]); }}
              />

              {/* Notes */}
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 6px' }}>Notes <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span></p>
              <Input
                placeholder="Add any notes about this result…"
                value={uploadNotes}
                onChange={e => setUploadNotes(e.target.value)}
              />
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setUploadOpen(false); setUploadFile(null); }}
                disabled={uploading}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                disabled={!uploadFile || !uploadPetId || uploading}
                onClick={handleUpload}
                style={{
                  flex: 2, padding: '10px 0', borderRadius: 10, border: 'none',
                  backgroundColor: uploadFile && uploadPetId ? 'var(--brand-green-text)' : 'var(--border-color)',
                  color: uploadFile && uploadPetId ? '#000' : 'var(--text-secondary)',
                  fontSize: 14, fontWeight: 700, cursor: uploadFile && uploadPetId ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</> : <><Upload className="w-4 h-4" /> Upload Result</>}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
           Preview / Review Dialog
         ═══════════════════════════════════════════════════════════ */}
      {previewFile && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => !reviewing && setPreviewFile(null)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 51, width: '90vw', maxWidth: 900, height: '85vh',
            backgroundColor: 'var(--surface-white)',
            borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 24px', borderBottom: '1px solid var(--border-color)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
            }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={previewFile.petImage} alt={previewFile.petName} className="object-cover" />
                    <AvatarFallback>{previewFile.petName.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-[var(--text-primary)] truncate" style={{ fontSize: 15, fontWeight: 700 }}>{previewFile.fileName}</p>
                    <p className="text-[var(--text-secondary)]" style={{ fontSize: 12 }}>
                      {previewFile.petName} · Uploaded {formatDateTime(previewFile.uploadedAt)} by {previewFile.uploadedByName}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Status badge */}
                {(() => {
                  const ss = statusStyles[previewFile.reviewStatus];
                  const SIcon = ss.icon;
                  return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1" style={{
                      backgroundColor: ss.bg, color: ss.text,
                      borderRadius: 9999, fontSize: 12, fontWeight: 700,
                      border: `1px solid ${ss.border}`,
                    }}>
                      <SIcon className="w-3.5 h-3.5" /> {ss.label}
                    </span>
                  );
                })()}
                {/* Download */}
                <a
                  href={previewFile.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    width: 36, height: 36, borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-secondary)', textDecoration: 'none',
                  }}
                >
                  <Download className="w-4 h-4" />
                </a>
                {/* Share (admin only) */}
                {isAdmin && (
                  <button
                    onClick={() => {
                      const ownerFirst = previewFile.ownerName.split(' ')[0] || previewFile.ownerName;
                      const senderName = currentProfile.fullName || 'HugoIT Veterinary Clinic';
                      const body = `<p>Hi ${ownerFirst},</p><p>Your pet <strong>${previewFile.petName}</strong>'s lab results are ready.</p><p>You can download the results here:<br/><a href="${previewFile.fileUrl}" target="_blank">${previewFile.fileName}</a></p><p>You can also view them in your patient portal.</p><p>Best regards,<br/>${senderName}</p>`;
                      navigate('/admin/communications', {
                        state: {
                          composeTo: previewFile.ownerEmail,
                          composeSubject: `Lab Results Ready — ${previewFile.petName}`,
                          composeBody: body,
                        },
                      });
                    }}
                    title="Share with owner"
                    style={{
                      width: 36, height: 36, borderRadius: 8,
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'transparent', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
                {/* Delete */}
                <button
                  onClick={() => handleDelete(previewFile)}
                  style={{
                    width: 36, height: 36, borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#EF4444',
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                {/* Close */}
                <button onClick={() => setPreviewFile(null)} style={{
                  width: 36, height: 36, borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'transparent', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-secondary)',
                }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* File preview */}
            <div style={{ flex: 1, overflow: 'auto', backgroundColor: '#f8f8f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {previewFile.fileType === 'application/pdf' ? (
                <iframe
                  src={previewFile.fileUrl}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title="Lab result PDF"
                />
              ) : previewFile.fileType?.startsWith('image/') ? (
                <img
                  src={previewFile.fileUrl}
                  alt={previewFile.fileName}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', padding: 24 }}
                />
              ) : (
                <div className="text-center p-12">
                  <File className="w-16 h-16 text-[var(--border-color)] mx-auto mb-4" />
                  <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{previewFile.fileName}</p>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
                    Preview not available for this file type.
                  </p>
                  <a
                    href={previewFile.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: 'none' }}
                  >
                    <Button variant="outline">
                      <Download className="w-4 h-4" /> Download to View
                    </Button>
                  </a>
                </div>
              )}
            </div>

            {/* Footer with notes + review action */}
            <div style={{ borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
              {previewFile.reviewStatus === 'awaiting_review' && (
                <div style={{
                  padding: '8px 24px',
                  backgroundColor: 'rgba(245, 158, 11, 0.06)',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <Eye className="w-3.5 h-3.5" style={{ color: '#D97706', flexShrink: 0 }} />
                  <p style={{ fontSize: 12, color: '#D97706', margin: 0 }}>
                    {isAdmin
                      ? 'Do not share this file with the pet owner until the assigned veterinarian has reviewed it.'
                      : 'Once marked as reviewed, this result will be visible to the pet owner in their portal.'}
                  </p>
                </div>
              )}
              <div style={{
                padding: '14px 24px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 16,
              }}>
                <div className="min-w-0 flex-1">
                  {previewFile.notes && (
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Notes:</span> {previewFile.notes}
                    </p>
                  )}
                  {previewFile.reviewStatus === 'reviewed' && previewFile.reviewedByName && (
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: previewFile.notes ? '4px 0 0' : 0 }}>
                      Reviewed by {previewFile.reviewedByName} on {formatDateTime(previewFile.reviewedAt)}
                    </p>
                  )}
                </div>
                {previewFile.reviewStatus === 'awaiting_review' && !isAdmin && (
                  <button
                    onClick={handleReview}
                    disabled={reviewing}
                    style={{
                      padding: '10px 24px', borderRadius: 10, border: 'none',
                      backgroundColor: 'var(--brand-green-text)',
                      color: '#000', fontSize: 14, fontWeight: 700,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      flexShrink: 0, whiteSpace: 'nowrap',
                    }}
                  >
                    {reviewing
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Reviewing…</>
                      : <><Check className="w-4 h-4" /> Mark as Reviewed</>
                    }
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        .upload-dialog-body [data-slot="select-trigger"],
        .upload-dialog-body [data-slot="input"] {
          border-color: var(--border-color, #E5E7EB) !important;
          background-color: var(--surface-white) !important;
        }
      `}</style>
    </div>
  );
}
